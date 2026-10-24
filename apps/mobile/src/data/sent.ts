// Puts the server's answer to a sent outbox item into the reads on screen. A step answer with
// applied: false carries a newer step (for example changed on the web): the screen takes it.

import type { QueryClient } from '@tanstack/react-query';

import { keys } from './keys';
import type { OutboxItem } from './outbox';
import { PlanSummaryResponse, StepResponse, type PlanResponse, type PlansResponse } from './schemas';

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
  // Rolls and frames: read them again (the phone is online right now).
  void client.invalidateQueries({ queryKey: keys.rolls });
  void client.invalidateQueries({ queryKey: keys.roll(segment(item.path, 'rolls') || ((item.body as { id?: string } | undefined)?.id ?? '')) });
}
