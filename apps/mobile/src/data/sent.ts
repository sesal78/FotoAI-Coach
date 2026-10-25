// Puts the server's answer to a sent outbox item into the reads on screen, before the item leaves
// the outbox, so nothing blinks out between the two. A step answer with applied: false carries a
// newer step (for example changed on the web): the screen takes it. Rolls and frames are set from
// the answer directly: no extra read is needed.

import type { QueryClient } from '@tanstack/react-query';

import { keys } from './keys';
import type { OutboxItem } from './outbox';
import {
  FrameResponse,
  PlanSummaryResponse,
  RollResponse,
  StepResponse,
  type PlanResponse,
  type PlansResponse,
  type RollDetailResponse,
  type RollsResponse,
} from './schemas';

const segment = (path: string, after: string) => path.split('/')[path.split('/').indexOf(after) + 1] ?? '';

export function applySent(client: QueryClient, item: OutboxItem, answer: unknown): void {
  if (item.kind === 'step') {
    const parsed = StepResponse.safeParse(answer);
    if (!parsed.success) return;
    const { step } = parsed.data;
    client.setQueryData<PlanResponse>(keys.plan(segment(item.path, 'plans')), (old) =>
      old ? { plan: { ...old.plan, steps: old.plan.steps.map((s) => (s.id === step.id ? step : s)) } } : old,
    );
    return;
  }
  if (item.kind === 'plan') {
    const parsed = PlanSummaryResponse.safeParse(answer);
    if (!parsed.success) return;
    const { plan } = parsed.data;
    client.setQueryData<PlanResponse>(keys.plan(plan.id), (old) => (old ? { plan: { ...old.plan, status: plan.status, updatedAt: plan.updatedAt } } : old));
    client.setQueryData<PlansResponse>(keys.plans, (old) => (old ? { plans: old.plans.map((p) => (p.id === plan.id ? plan : p)) } : old));
    return;
  }
  if (item.kind === 'roll' || item.kind === 'rollStatus') {
    const parsed = RollResponse.safeParse(answer);
    if (!parsed.success) return;
    const { roll } = parsed.data;
    client.setQueryData<RollsResponse>(keys.rolls, (old) => (old ? { rolls: [roll, ...old.rolls.filter((r) => r.id !== roll.id)] } : { rolls: [roll] }));
    client.setQueryData<RollDetailResponse>(keys.roll(roll.id), (old) => ({ roll: { ...roll, frames: old?.roll.frames ?? [] } }));
    return;
  }
  if (item.kind === 'frame') {
    const parsed = FrameResponse.safeParse(answer);
    if (!parsed.success) return;
    const { frame } = parsed.data;
    const rollId = segment(item.path, 'rolls');
    // Counted once: a frame the read already has (a replay, or a read that came first) is not added.
    if (client.getQueryData<RollDetailResponse>(keys.roll(rollId))?.roll.frames.some((f) => f.id === frame.id)) return;
    client.setQueryData<RollDetailResponse>(keys.roll(rollId), (old) => {
      if (!old) return old;
      const framesLogged = old.roll.framesLogged + 1;
      return { roll: { ...old.roll, frames: [...old.roll.frames, frame], framesLogged, framesLeft: Math.max(0, old.roll.exposures - framesLogged) } };
    });
    client.setQueryData<RollsResponse>(keys.rolls, (old) =>
      old
        ? { rolls: old.rolls.map((r) => (r.id === rollId ? { ...r, framesLogged: r.framesLogged + 1, framesLeft: Math.max(0, r.framesLeft - 1) } : r)) }
        : old,
    );
  }
}
