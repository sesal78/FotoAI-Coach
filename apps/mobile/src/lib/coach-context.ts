// What the coach is told about the screen a message is sent from: the tab it belongs to and the
// plan, roll, place or spot on screen, so a proposal can be about it. An id the server would
// refuse is left out rather than sent.

import { PLACE_ID_RE, type CoachInput } from '@fotoai/contracts';

type Context = CoachInput['context'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (id: string | undefined) => (id && UUID.test(id) ? id : undefined);

/** `{ planId: x }` when x is set, else `{}`: the server takes no empty or null ids. */
function only<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value ? ({ [key]: value } as Record<K, string>) : {};
}

export function coachContext(pathname: string, params: Record<string, string | undefined>, activeRollId?: string): Context {
  const segment = pathname.split('/').filter(Boolean)[0] ?? '';
  switch (segment) {
    case 'explore':
      return { screen: 'explore' };
    case 'place': {
      const placeId = params.placeId && PLACE_ID_RE.test(params.placeId) ? params.placeId : undefined;
      return { screen: 'explore', ...only('placeId', placeId) };
    }
    case 'spot':
      return { screen: 'explore', ...only('spotId', uuid(params.id)) };
    case 'shoot':
      return { screen: 'shoot', ...only('rollId', uuid(activeRollId)) };
    case 'plan':
      return { screen: 'shoot', ...only('planId', uuid(params.id)) };
    case 'roll':
      return { screen: 'shoot', ...only('rollId', uuid(params.id)) };
    case 'photos':
    case 'photo':
      return { screen: 'photos' };
    case 'me':
      return { screen: 'me' };
    default:
      // Today, a challenge, and anything else.
      return { screen: 'today' };
  }
}
