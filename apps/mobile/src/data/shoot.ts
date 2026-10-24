// Shoot hooks (3E): plans, steps, film rolls and frames. Reads are kept on the phone (a plan without
// its Google place name). Field changes go through the outbox and show at once: every read here is
// the server's answer plus the changes still waiting, so a refresh never undoes an unsent tap.

import { PlanSummaryDto, type FrameDto, type FrameInput, type GeneratePlanInput, type RollDto, type RollInput, type ShootPlanDto } from '@fotoai/contracts';
import { findStock } from '@fotoai/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getApi } from './client';
import { enqueue, fieldOwner, outbox } from './field';
import { keys } from './keys';
import type { OutboxItem } from './outbox';
import { PlanResponse, PlansResponse, RollDetailResponse, RollsResponse, type PlanResponse as PlanAnswer, type PlansResponse as PlansAnswer } from './schemas';

type StepStatus = ShootPlanDto['steps'][number]['status'];
type PlanStatus = PlanSummaryDto['status'];

/** The signed-in account's outbox items, kept live. */
export function useOutbox(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => {
      const owner = fieldOwner();
      if (!owner) return setItems([]);
      void outbox.list(owner).then((list) => live && setItems(list));
    };
    load();
    const off = outbox.subscribe(load);
    return () => {
      live = false;
      off();
    };
  }, []);
  return items;
}

const waiting = (items: OutboxItem[], kind: OutboxItem['kind']) => items.filter((i) => i.kind === kind && i.state === 'waiting');

/** A plan with the step changes and status still waiting to be sent. */
export function withPending(plan: ShootPlanDto, items: OutboxItem[]): ShootPlanDto {
  const steps = plan.steps.map((step) => {
    const change = waiting(items, 'step').find((i) => i.key === `step:${step.id}`);
    const body = change?.body as { status: StepStatus; updatedAt: string } | undefined;
    return body && body.updatedAt > step.updatedAt ? { ...step, status: body.status, updatedAt: body.updatedAt } : step;
  });
  const status = (waiting(items, 'plan').find((i) => i.key === `plan:${plan.id}`)?.body as { status?: PlanStatus } | undefined)?.status;
  return { ...plan, steps, ...(status ? { status } : {}) };
}

export const usePlans = () => useQuery({ queryKey: keys.plans, queryFn: () => getApi().request('/api/v2/plans', { schema: PlansResponse }) });

export function usePlan(id: string) {
  const query = useQuery({ queryKey: keys.plan(id), queryFn: () => getApi().request(`/api/v2/plans/${encodeURIComponent(id)}`, { schema: PlanResponse }) });
  const items = useOutbox();
  const plan = useMemo(() => (query.data ? withPending(query.data.plan, items) : undefined), [query.data, items]);
  return { ...query, plan };
}

/** Makes a plan with the AI (online only): the server uses the saved loadout. */
export function useMakePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanInput) => getApi().request('/api/v2/plans', { schema: PlanResponse, method: 'POST', body: input }),
    onSuccess: ({ plan }) => {
      client.setQueryData<PlanAnswer>(keys.plan(plan.id), { plan });
      client.setQueryData<PlansAnswer>(keys.plans, (old) => {
        // The list holds summaries: parsing drops the place name and the steps.
        return old ? { plans: [PlanSummaryDto.parse(plan), ...old.plans.filter((p) => p.id !== plan.id)] } : old;
      });
    },
  });
}

/** Done, Skip or Undo on a step: shows at once, waits in the outbox; the newest change wins. */
export function useStepChange(planId: string) {
  return useCallback(
    (stepId: string, status: StepStatus) =>
      enqueue({
        kind: 'step',
        method: 'PATCH',
        path: `/api/v2/plans/${encodeURIComponent(planId)}/steps/${encodeURIComponent(stepId)}`,
        body: { status, updatedAt: new Date().toISOString() },
        key: `step:${stepId}`,
      }),
    [planId],
  );
}

export function usePlanStatus(planId: string) {
  return useCallback(
    (status: PlanStatus) => enqueue({ kind: 'plan', method: 'PATCH', path: `/api/v2/plans/${encodeURIComponent(planId)}`, body: { status }, key: `plan:${planId}` }),
    [planId],
  );
}

type NewRoll = Omit<RollInput, 'id'>;

/** A roll loaded on this phone and not sent yet, shown as the server would show it. */
function pendingRoll(item: OutboxItem): RollDto {
  const body = item.body as RollInput;
  const stock = body.stockId ? findStock(body.stockId) : undefined;
  const boxIso = stock?.boxIso ?? body.boxIso ?? 0;
  const at = new Date(item.createdAt).toISOString();
  return {
    id: body.id,
    stockId: body.stockId ?? null,
    stockName: stock?.names[0] ?? body.stockName ?? '',
    boxIso,
    ratedIso: body.ratedIso ?? boxIso,
    exposures: body.exposures,
    bodyGearId: body.bodyGearId,
    status: 'loaded',
    loadedAt: at,
    finishedAt: null,
    notes: body.notes ?? null,
    framesLogged: 0,
    framesLeft: body.exposures,
    createdAt: at,
    updatedAt: at,
  };
}

/** A roll with the frames and status change still waiting to be sent. */
function rollWithPending(roll: RollDto, frames: FrameDto[], items: OutboxItem[]) {
  const known = new Set(frames.map((f) => f.id));
  const extra = waiting(items, 'frame')
    .filter((i) => i.path === `/api/v2/rolls/${encodeURIComponent(roll.id)}/frames` && !known.has((i.body as FrameInput).id))
    .map((i): FrameDto => {
      const f = i.body as FrameInput;
      return { id: f.id, frameNo: f.frameNo, settings: f.settings, lensGearId: f.lensGearId ?? null, stepId: f.stepId ?? null, lat: f.lat ?? null, lng: f.lng ?? null, note: f.note ?? null, shotAt: f.shotAt, createdAt: f.shotAt };
    });
  const status = (waiting(items, 'rollStatus').find((i) => i.key === `rollStatus:${roll.id}`)?.body as { status?: RollDto['status'] } | undefined)?.status;
  const framesLogged = roll.framesLogged + extra.length;
  return {
    roll: { ...roll, framesLogged, framesLeft: Math.max(0, roll.exposures - framesLogged), ...(status ? { status } : {}) },
    frames: [...frames, ...extra].sort((a, b) => a.frameNo - b.frameNo),
  };
}

export function useRolls() {
  const query = useQuery({ queryKey: keys.rolls, queryFn: () => getApi().request('/api/v2/rolls', { schema: RollsResponse }) });
  const items = useOutbox();
  const rolls = useMemo(() => {
    const server = query.data?.rolls ?? [];
    const loadedHere = waiting(items, 'roll').filter((i) => !server.some((r) => r.id === (i.body as RollInput).id)).map(pendingRoll);
    return [...loadedHere, ...server].map((r) => rollWithPending(r, [], items).roll);
  }, [query.data, items]);
  return { ...query, rolls };
}

export function useRoll(id: string) {
  const query = useQuery({ queryKey: keys.roll(id), queryFn: () => getApi().request(`/api/v2/rolls/${encodeURIComponent(id)}`, { schema: RollDetailResponse }) });
  const items = useOutbox();
  const view = useMemo(() => {
    if (query.data) {
      const { frames, ...roll } = query.data.roll;
      return rollWithPending(roll, frames, items);
    }
    const loadedHere = waiting(items, 'roll').find((i) => i.key === `roll:${id}`);
    return loadedHere ? rollWithPending(pendingRoll(loadedHere), [], items) : { roll: undefined, frames: [] as FrameDto[] };
  }, [query.data, items, id]);
  return { ...query, ...view };
}

/** Loads a film roll: its id is made here, so sending it twice stores it once. Returns the id. */
export function useLoadRoll() {
  return useCallback(async (input: NewRoll) => {
    const id = Crypto.randomUUID();
    await enqueue({ kind: 'roll', method: 'POST', path: '/api/v2/rolls', body: { ...input, id }, key: `roll:${id}` });
    return id;
  }, []);
}

export function useLogFrame(rollId: string) {
  return useCallback(
    async (input: Omit<FrameInput, 'id' | 'shotAt'>) => {
      const id = Crypto.randomUUID();
      await enqueue({ kind: 'frame', method: 'POST', path: `/api/v2/rolls/${encodeURIComponent(rollId)}/frames`, body: { ...input, id, shotAt: new Date().toISOString() }, key: `frame:${id}` });
      return id;
    },
    [rollId],
  );
}

export function useFinishRoll(rollId: string) {
  return useCallback(
    () => enqueue({ kind: 'rollStatus', method: 'PATCH', path: `/api/v2/rolls/${encodeURIComponent(rollId)}`, body: { status: 'finished' }, key: `rollStatus:${rollId}` }),
    [rollId],
  );
}
