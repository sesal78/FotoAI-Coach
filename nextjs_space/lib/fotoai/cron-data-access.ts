// Service-role data access for the scheduled (cron) jobs.
//
// Cron is the only FotoAI code that reads and writes across users with the
// service role, so RLS does not protect it. This module puts the owner rule
// back in code. Every job works through a UserServiceAccess bound to ONE
// user id taken from the auth user listing (never from a request):
//   * select  -> always filters user_id = eq.<bound id>; a different user_id filter throws
//   * insert  -> always writes user_id = <bound id>; a different user_id throws
//   * update  -> always filters BOTH id and user_id; changing user_id throws
// Only the guarded client methods serviceSelect / serviceInsert /
// serviceUpdate / adminListUsers are used.
//
// createCronGenerationDataAccess() implements GenerationDataAccess for
// generateChallengeFor() by running the owner-scoped generation repo
// (repo-generation.ts) over a user-bound adapter, so the query shapes stay in
// one place. The adapter refuses any repo call that is not owner-filtered.

import type { GenerationDataAccess } from './challenge-generation.ts';
import { FotoaiError, FotoaiNotFoundError, FotoaiUpstreamError } from './errors.ts';
import type { VerifiedUser } from './membership.ts';
import { isUuid, requireUuid } from './object-keys.ts';
import { createGenerationRepo } from './repo-generation.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

export type CronServiceClient = Pick<
  FotoaiSupabaseClient,
  'serviceSelect' | 'serviceInsert' | 'serviceUpdate' | 'adminListUsers'
>;

/** The cron job's per-user scope. The id comes from adminListUsers only. */
export interface CronScope {
  userId: string;
}

export const T_AGENT_ACTIONS = 'fotoai_agent_actions';
export const USERS_PAGE_SIZE = 100;
/** Hard stop so a listing that ignores `page` cannot loop forever (100k users). */
export const MAX_USER_PAGES = 1000;

type Row = Record<string, unknown>;

function refuse(message: string): never {
  throw new FotoaiError(500, 'cron_scope', `Cron data access refused: ${message}`);
}

/**
 * Every auth user, paging adminListUsers(page, perPage) until a short page.
 * Users without a UUID id are dropped; a page that adds no new users ends it.
 */
export async function listAllUsers(client: Pick<CronServiceClient, 'adminListUsers'>, perPage = USERS_PAGE_SIZE): Promise<VerifiedUser[]> {
  const seen = new Map<string, VerifiedUser>();
  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const batch = await client.adminListUsers(page, perPage);
    let added = 0;
    for (const user of batch) {
      if (isUuid(user.id) && !seen.has(user.id)) {
        seen.set(user.id, user);
        added += 1;
      }
    }
    if (batch.length < perPage || added === 0) return [...seen.values()];
  }
  throw new FotoaiUpstreamError(0, `User listing did not end after ${MAX_USER_PAGES} pages`);
}

export interface UserServiceAccess {
  readonly userId: string;
  select<T = Row>(table: string, query: Record<string, string>): Promise<T[]>;
  insert<T = Row>(table: string, row: Row): Promise<T>;
  /** Updates exactly one row matched by id AND user_id; 404 otherwise. */
  updateById<T = Row>(table: string, id: string, patch: Row): Promise<T>;
  logAction(actionType: string, details: Row, success?: boolean): Promise<void>;
}

/** Service-role access bound to one user. See the header for the rules. */
export function bindServiceToUser(client: CronServiceClient, userId: string): UserServiceAccess {
  const uid = requireUuid(userId, 'cron user id');
  const ownerFilter = `eq.${uid}`;

  const assertRowsOwned = (rows: unknown[], table: string) => {
    for (const row of rows) {
      const owner = (row as Row | null)?.user_id;
      if (owner !== undefined && owner !== uid) refuse(`${table} returned another user's row`);
    }
  };

  const access: UserServiceAccess = {
    userId: uid,

    async select<T = Row>(table: string, query: Record<string, string>): Promise<T[]> {
      if (query.user_id !== undefined && query.user_id !== ownerFilter) refuse(`select on ${table} for another user`);
      const rows = await client.serviceSelect<T>(table, { ...query, user_id: ownerFilter });
      assertRowsOwned(rows, table);
      return rows;
    },

    async insert<T = Row>(table: string, row: Row): Promise<T> {
      if (row.user_id !== undefined && row.user_id !== uid) refuse(`insert into ${table} for another user`);
      const inserted = await client.serviceInsert<T>(table, { ...row, user_id: uid });
      assertRowsOwned([inserted], table);
      return inserted;
    },

    async updateById<T = Row>(table: string, id: string, patch: Row): Promise<T> {
      const rowId = requireUuid(id, `${table} id`);
      if (patch.user_id !== undefined && patch.user_id !== uid) refuse(`update on ${table} changes the owner`);
      const safe = { ...patch };
      delete safe.user_id;
      delete safe.id;
      const rows = await client.serviceUpdate<T>(table, { id: `eq.${rowId}`, user_id: ownerFilter }, safe);
      assertRowsOwned(rows, table);
      if (rows.length !== 1) throw new FotoaiNotFoundError(`${table} row not found`);
      return rows[0];
    },

    async logAction(actionType, details, success = true) {
      await access.insert(T_AGENT_ACTIONS, {
        action_type: actionType,
        details,
        success,
        executed_at: new Date().toISOString(),
      });
    },
  };
  return access;
}

/**
 * Presents a UserServiceAccess as the rest* subset repo-generation.ts uses.
 * The user token argument is ignored (there is none in cron); the owner
 * filters the repo adds are checked again here.
 */
function generationClientFor(access: UserServiceAccess): FotoaiSupabaseClient {
  const ownerFilter = `eq.${access.userId}`;
  const adapter = {
    restSelect(table: string, query: Record<string, string>) {
      if (query.user_id !== ownerFilter) refuse(`unscoped select on ${table}`);
      return access.select(table, query);
    },
    restInsert(table: string, row: Row) {
      if (row.user_id !== access.userId) refuse(`unscoped insert into ${table}`);
      return access.insert(table, row);
    },
    async restUpdate(table: string, query: Record<string, string>, patch: Row) {
      const keys = Object.keys(query).sort().join(',');
      if (keys !== 'id,user_id' || query.user_id !== ownerFilter || !query.id.startsWith('eq.')) {
        refuse(`update on ${table} must filter exactly id and user_id`);
      }
      return [await access.updateById(table, query.id.slice('eq.'.length), patch)];
    },
  };
  // Any other client method is absent on purpose: calling it fails loudly.
  return adapter as unknown as FotoaiSupabaseClient;
}

/** GenerationDataAccess for generateChallengeFor() in the daily-challenge job. */
export function createCronGenerationDataAccess(client: CronServiceClient): GenerationDataAccess<CronScope> {
  const bound = (scope: CronScope) => {
    const access = bindServiceToUser(client, scope.userId);
    const owner: OwnerScope = { userId: access.userId, accessToken: '' };
    return { access, owner, repo: createGenerationRepo(generationClientFor(access)) };
  };
  return {
    getPreferences: (scope) => { const b = bound(scope); return b.repo.getPreferences(b.owner); },
    listGearNames: (scope) => { const b = bound(scope); return b.repo.listGearNames(b.owner); },
    listRecentChallengeTexts: (scope, limit) => { const b = bound(scope); return b.repo.listRecentChallengeTexts(b.owner, limit); },
    findPendingIssuedSince: (scope, since) => { const b = bound(scope); return b.repo.findPendingIssuedSince(b.owner, since); },
    insertChallenge: (scope, row) => { const b = bound(scope); return b.repo.insertChallenge(b.owner, row); },
    incrementIssued: (scope, type, now) => { const b = bound(scope); return b.repo.incrementIssued(b.owner, type, now); },
    logAgentAction: (scope, type, details) => bound(scope).access.logAction(type, details),
  };
}
