// v2 gear: the capability catalog, the user's own gear (from the catalog or custom) and the
// loadout they carry today. Catalog data comes from @fotoai/core (the single source the seed
// migration is generated from); the database tables enforce the links. Gear rows go through
// the user's own token, so RLS limits them to the owner. New rows also fill the live app's
// category/brand/model columns, so the current web settings keep working.

import {
  AddGearInput,
  CustomBodyInput,
  CustomLensInput,
  LoadoutInput,
  type BodyDto,
  type GearItem,
  type LensDto,
  type LoadoutDto,
} from '@fotoai/contracts';
import { CATALOG, findBody, findLens, validateSettings, type Body, type Lens } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';
import { z } from 'zod';

import { rejectBrowserIdentity, requirePrincipal } from './auth.ts';
import { ApiError, json, type V2Body } from './handler.ts';
import { readJsonObject } from './http.ts';

const GEAR = 'fotoai_user_gear';
const PREFS = 'fotoai_user_preferences';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GearRow = {
  id: string;
  category: string;
  brand: string;
  model: string;
  body_id: string | null;
  lens_id: string | null;
  custom: unknown;
};
const GEAR_COLUMNS = 'id, category, brand, model, body_id, lens_id, custom';

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);

function validationFrom(issues: Array<{ path: PropertyKey[] }>): ApiError {
  const fields = [...new Set(issues.map((issue) => issue.path.map(String).join('.') || 'body'))];
  return new ApiError('validation', `Invalid gear: ${fields.join(', ')}`);
}

/**
 * A custom body or lens as stored in the row's `custom` column, shaped like a catalog item.
 * The stored value is parsed again: an owner can write any jsonb, and a bad row must show as
 * gear without capability data, not break the list.
 */
function customCapability(row: GearRow): BodyDto | LensDto | null {
  const kind = (row.custom as { kind?: unknown } | null)?.kind;
  if (kind === 'body') {
    const parsed = CustomBodyInput.safeParse(row.custom);
    if (!parsed.success) return null;
    const c = parsed.data;
    return {
      id: row.id, make: c.make, model: c.model, type: c.type, mount: c.mount, modes: c.modes,
      shutter: { slowestSeconds: c.shutter.slowestSeconds, fastestSeconds: c.shutter.fastestSeconds, bulb: c.shutter.bulb ?? null },
      flashSyncSeconds: null, iso: c.iso, metering: null, fixedLensId: null, sources: [],
    };
  }
  if (kind === 'lens') {
    const parsed = CustomLensInput.safeParse(row.custom);
    if (!parsed.success) return null;
    const c = parsed.data;
    return { id: row.id, make: c.make, model: c.model, mount: c.mount, focalMm: c.focalMm, maxAperture: c.maxAperture, minAperture: c.minAperture, sources: [] };
  }
  return null;
}

function toGearItem(row: GearRow): GearItem {
  if (row.body_id) {
    const body = findBody(row.body_id);
    return { id: row.id, kind: 'body', catalogId: row.body_id, name: `${row.brand} ${row.model}`, capability: body ?? null };
  }
  if (row.lens_id) {
    const lens = findLens(row.lens_id);
    return { id: row.id, kind: 'lens', catalogId: row.lens_id, name: `${row.brand} ${row.model}`, capability: lens ?? null };
  }
  const capability = customCapability(row);
  const kind = capability ? ('type' in capability ? 'body' : 'lens') : row.category === 'camera' ? 'body' : row.category === 'lens' ? 'lens' : 'other';
  return { id: row.id, kind, catalogId: null, name: `${row.brand} ${row.model}`, capability };
}

/** Picks the exact schema from the request's own shape, so errors name the real field (a union would not). */
function parseAddGear(body: Record<string, unknown>) {
  const custom = body.custom as { kind?: unknown } | undefined;
  const schema =
    custom && typeof custom === 'object' && custom.kind === 'body'
      ? z.object({ custom: CustomBodyInput }).strict()
      : custom && typeof custom === 'object' && custom.kind === 'lens'
        ? z.object({ custom: CustomLensInput }).strict()
        : AddGearInput;
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationFrom(parsed.error.issues);
  return parsed.data as z.infer<typeof AddGearInput>;
}

export const getGearCatalog: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  await requirePrincipal(request, deps);
  return json({ bodies: CATALOG.bodies, lenses: CATALOG.lenses });
};

export const listMyGear: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(GEAR)
    .select(GEAR_COLUMNS)
    .eq('user_id', principal.userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw upstream('load gear');
  return json({ items: (data as unknown as GearRow[]).map(toGearItem) });
};

export const addMyGear: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const input = parseAddGear(body);
  let row: Record<string, unknown>;
  if ('catalogId' in input) {
    const catalogBody = findBody(input.catalogId);
    const catalogLens = catalogBody ? undefined : findLens(input.catalogId);
    if (!catalogBody && !catalogLens) throw new ApiError('validation', 'Unknown catalog id');
    row = catalogBody
      ? { category: 'camera', brand: catalogBody.make, model: catalogBody.model, body_id: catalogBody.id }
      : { category: 'lens', brand: catalogLens!.make, model: catalogLens!.model, lens_id: catalogLens!.id };
  } else {
    const custom = input.custom;
    row = { category: custom.kind === 'body' ? 'camera' : 'lens', brand: custom.make, model: custom.model, custom };
  }

  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(GEAR)
    .insert({ ...row, user_id: principal.userId } as never)
    .select(GEAR_COLUMNS)
    .single();
  if (error || !data) throw upstream('save gear');
  return json({ item: toGearItem(data as unknown as GearRow) }, { status: 201 });
};

export const deleteMyGear: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Gear id must be a UUID');
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(GEAR).delete().eq('id', id).select('id');
  if (error) throw upstream('delete gear');
  if (!data || data.length === 0) throw new ApiError('not_found', 'Gear not found');
  return json({ success: true });
};

type StoredLoadout = { bodyGearId: string; lensGearId: string | null; film: LoadoutDto['film'] };

async function loadGearRows(deps: Parameters<V2Body>[1], token: string, ids: string[]): Promise<Map<string, GearRow>> {
  const { data, error } = await createUserClient(deps.env, token).from(GEAR).select(GEAR_COLUMNS).in('id', ids);
  if (error) throw upstream('load gear');
  return new Map((data as unknown as GearRow[]).map((row) => [row.id, row]));
}

/** Resolves stored gear ids to a loadout; throws 404/400 when the gear is missing or does not fit. */
async function resolveLoadout(deps: Parameters<V2Body>[1], token: string, stored: StoredLoadout): Promise<LoadoutDto> {
  const rows = await loadGearRows(deps, token, [stored.bodyGearId, ...(stored.lensGearId ? [stored.lensGearId] : [])]);
  const bodyRow = rows.get(stored.bodyGearId);
  if (!bodyRow) throw new ApiError('not_found', 'Body gear not found');
  const bodyItem = toGearItem(bodyRow);
  if (bodyItem.kind !== 'body' || !bodyItem.capability) {
    throw new ApiError('validation', 'This camera has no capability data; add it from the catalog or as custom gear');
  }
  const body = bodyItem.capability as Body;

  let lens: Lens;
  if (body.fixedLensId) {
    if (stored.lensGearId) throw new ApiError('validation', `${body.model} has a built-in lens; leave lensGearId out`);
    lens = findLens(body.fixedLensId)!;
  } else {
    if (!stored.lensGearId) throw new ApiError('validation', 'lensGearId is required for this camera');
    const lensRow = rows.get(stored.lensGearId);
    if (!lensRow) throw new ApiError('not_found', 'Lens gear not found');
    const lensItem = toGearItem(lensRow);
    if (lensItem.kind !== 'lens' || !lensItem.capability) {
      throw new ApiError('validation', 'This lens has no capability data; add it from the catalog or as custom gear');
    }
    lens = lensItem.capability as Lens;
  }

  const check = validateSettings({ body, lens }, { mode: body.modes[0]! });
  const misfit = check.ok ? undefined : check.issues.find((issue) => issue.field === 'lens');
  if (misfit) throw new ApiError('validation', misfit.message);

  return { body: bodyItem, lensGearId: stored.lensGearId, lens, film: stored.film };
}

export const getLoadout: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(PREFS)
    .select('loadout')
    .eq('user_id', principal.userId)
    .maybeSingle();
  if (error) throw upstream('load the loadout');
  const stored = (data as { loadout: StoredLoadout | null } | null)?.loadout ?? null;
  if (!stored) return json({ loadout: null });
  try {
    return json({ loadout: await resolveLoadout(deps, principal.accessToken, stored) });
  } catch (err) {
    // Gear deleted since the loadout was saved: there is no usable loadout any more.
    if (err instanceof ApiError && (err.code === 'not_found' || err.code === 'validation')) return json({ loadout: null });
    throw err;
  }
};

export const putLoadout: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = LoadoutInput.safeParse(body);
  if (!parsed.success) throw validationFrom(parsed.error.issues);

  const stored: StoredLoadout = {
    bodyGearId: parsed.data.bodyGearId,
    lensGearId: parsed.data.lensGearId ?? null,
    film: parsed.data.film ?? null,
  };
  const loadout = await resolveLoadout(deps, principal.accessToken, stored);

  const { error } = await createUserClient(deps.env, principal.accessToken)
    .from(PREFS)
    .upsert({ user_id: principal.userId, loadout: stored } as never, { onConflict: 'user_id' });
  if (error) throw upstream('save the loadout');
  return json({ loadout });
};
