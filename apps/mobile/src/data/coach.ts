// The coach chat (3F). The history is read when the sheet opens and kept in memory only (never
// saved on the phone). A message needs a signal: it is sent once, from the tap, never queued.
// The server stores both sides; the app adds them to the history it shows.

import { CoachMessageDto, CoachReply, type CoachInput } from '@fotoai/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';

import { getApi } from './client';
import { keys } from './keys';
import { OkResponse } from './schemas';

export const CoachHistoryResponse = z.object({ messages: z.array(CoachMessageDto) });
export type CoachHistory = z.infer<typeof CoachHistoryResponse>;

const ClearResponse = OkResponse.extend({ deleted: z.number() });

/** The last 50 messages, oldest first. */
export function useCoachHistory() {
  return useQuery({
    queryKey: keys.coachHistory,
    meta: { save: false },
    queryFn: () => getApi().request('/api/v2/coach/history', { schema: CoachHistoryResponse }),
  });
}

export function useSendCoach() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: CoachInput) => getApi().request('/api/v2/coach', { method: 'POST', body: input, schema: CoachReply }),
    onSuccess: ({ reply, proposal }, input) => {
      const now = new Date().toISOString();
      const sent: CoachMessageDto[] = [
        { id: Crypto.randomUUID(), role: 'user', content: input.message, proposal: null, createdAt: now },
        { id: Crypto.randomUUID(), role: 'assistant', content: reply, proposal, createdAt: now },
      ];
      client.setQueryData<CoachHistory>(keys.coachHistory, (old) => ({ messages: [...(old?.messages ?? []), ...sent] }));
    },
  });
}

export function useClearCoach() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: () => getApi().request('/api/v2/coach/history', { method: 'DELETE', schema: ClearResponse }),
    onSuccess: () => client.setQueryData<CoachHistory>(keys.coachHistory, { messages: [] }),
  });
}
