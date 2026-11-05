import type { CoachMessageDto } from '@fotoai/contracts';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { challenge } from '../../test/fixtures';
import { fakeApi, renderScreen } from '../../test/harness';
import { ApiClientError } from '../lib/api';
import { CoachSheet } from '../ui/coach/CoachSheet';

const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../data/client', () => ({ getApi: () => mockApi.current }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => undefined } }));

const PLAN = '22222222-aaaa-4bbb-8ccc-000000000001';
const PLACE = 'ChIJ3S-JXmauEmsRUcIaWtf4MzE';
const msg = (n: number, role: 'user' | 'assistant', content: string, proposal: CoachMessageDto['proposal'] = null): CoachMessageDto => ({
  id: `77777777-aaaa-4bbb-8ccc-00000000000${n}`,
  role,
  content,
  proposal,
  createdAt: `2026-11-05T0${n}:00:00.000Z`,
});

function routes(over: Record<string, unknown> = {}) {
  return fakeApi({
    'GET /api/v2/coach/history': { messages: [msg(1, 'user', 'Hi coach'), msg(2, 'assistant', 'Hello! What shall we shoot?')] },
    'GET /api/v2/rolls': { rolls: [] },
    ...over,
  });
}

const onClose = jest.fn();

beforeEach(() => {
  onlineManager.setOnline(true);
  onClose.mockClear();
  (router.push as jest.Mock).mockClear();
  (router.navigate as jest.Mock).mockClear();
});

afterAll(() => onlineManager.setOnline(true));

test('the history shows oldest first, and Send sends the message with the screen context', async () => {
  mockApi.current = routes({ 'POST /api/v2/coach': { reply: 'Try the pier at dusk.', proposal: null } });
  await renderScreen(<CoachSheet pathname={`/plan/${PLAN}`} params={{ id: PLAN }} onClose={onClose} />);
  const first = await screen.findByText('Hi coach');
  expect(first).toBeTruthy();
  expect(screen.getByText('Hello! What shall we shoot?')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Message to the coach'), '  Where should I go?  ');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Send' })));
  expect(mockApi.current.calls.find((c) => c.method === 'POST')).toEqual({
    method: 'POST',
    path: '/api/v2/coach',
    body: { message: 'Where should I go?', context: { screen: 'shoot', planId: PLAN } },
  });
  expect(await screen.findByText('Try the pier at dusk.')).toBeTruthy();
  expect(screen.getByText('Where should I go?')).toBeTruthy();
  // The field is empty again after a send.
  expect(screen.getByLabelText('Message to the coach').props.value).toBe('');
});

test('a coach proposal opens the right screen: a challenge opens it', async () => {
  const c = challenge();
  mockApi.current = routes({ 'POST /api/v2/coach': { reply: 'Here is a challenge.', proposal: { kind: 'challenge', challenge: c } } });
  await renderScreen(<CoachSheet pathname="/today" params={{}} onClose={onClose} />);
  await screen.findByText('Hi coach');
  await fireEvent.changeText(screen.getByLabelText('Message to the coach'), 'Give me a challenge');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Send' })));
  expect(await screen.findByText(c.challengeText)).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Open challenge' })));
  expect(onClose).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith(`/challenge/${c.id}`);
});

test('a coach proposal opens the right screen: a plan opens Shoot with the place and the date', async () => {
  mockApi.current = routes({
    'GET /api/v2/coach/history': { messages: [msg(1, 'assistant', 'Plan a shoot here on Saturday.', { kind: 'plan', placeId: PLACE, date: '2026-11-07' })] },
  });
  await renderScreen(<CoachSheet pathname={`/place/${PLACE}`} params={{ placeId: PLACE }} onClose={onClose} />);
  expect(await screen.findByText('Plan a shoot on 2026-11-07')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Plan this shoot' })));
  expect(onClose).toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledWith(`/shoot?placeId=${PLACE}&date=2026-11-07`);
});

test('Clear history asks first', async () => {
  mockApi.current = routes({ 'DELETE /api/v2/coach/history': { success: true, deleted: 2 } });
  const alert = jest.spyOn(Alert, 'alert');
  await renderScreen(<CoachSheet pathname="/today" params={{}} onClose={onClose} />);
  await screen.findByText('Hi coach');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Coach menu' })));
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Clear history' })));
  // Nothing is deleted before the yes.
  expect(mockApi.current.calls.some((c) => c.method === 'DELETE')).toBe(false);
  expect(alert).toHaveBeenCalledWith('Clear the coach history?', expect.any(String), expect.any(Array));
  const buttons = alert.mock.calls[0]![2] as Array<{ text: string; onPress?: () => void }>;
  await act(async () => buttons.find((b) => b.text === 'Clear')!.onPress!());
  expect(mockApi.current.calls.some((c) => c.method === 'DELETE' && c.path === '/api/v2/coach/history')).toBe(true);
  expect(await screen.findByText('No messages yet')).toBeTruthy();
  expect(screen.queryByText('Hi coach')).toBeNull();
  alert.mockRestore();
});

test('a 429 shows the server message', async () => {
  mockApi.current = routes({ 'POST /api/v2/coach': new ApiClientError('rate_limited', 429, 'Too many messages. Try again in 30 minutes.') });
  await renderScreen(<CoachSheet pathname="/today" params={{}} onClose={onClose} />);
  await screen.findByText('Hi coach');
  await fireEvent.changeText(screen.getByLabelText('Message to the coach'), 'Hello again');
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Send' })));
  expect(await screen.findByText('Too many messages. Try again in 30 minutes.')).toBeTruthy();
  expect(mockApi.current.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  // The text stays, so it can be sent again later.
  expect(screen.getByLabelText('Message to the coach').props.value).toBe('Hello again');
});

test('a message over 2000 characters cannot be sent', async () => {
  mockApi.current = routes();
  await renderScreen(<CoachSheet pathname="/today" params={{}} onClose={onClose} />);
  await screen.findByText('Hi coach');
  await fireEvent.changeText(screen.getByLabelText('Message to the coach'), 'a'.repeat(2001));
  expect(screen.getByText('2001/2000: make it shorter')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Send' })));
  expect(mockApi.current.calls.some((c) => c.method === 'POST')).toBe(false);
});

test('offline: Send says it needs a signal, and the history loaded before still shows', async () => {
  mockApi.current = routes();
  await renderScreen(<CoachSheet pathname="/today" params={{}} onClose={onClose} />);
  await screen.findByText('Hi coach');
  await act(async () => onlineManager.setOnline(false));
  await fireEvent.changeText(screen.getByLabelText('Message to the coach'), 'Anyone there?');
  expect(screen.getByText('Needs a signal')).toBeTruthy();
  await act(async () => await fireEvent.press(screen.getByText('Needs a signal')));
  expect(mockApi.current.calls.some((c) => c.method === 'POST')).toBe(false);
  expect(screen.getByText('Hi coach')).toBeTruthy();
});
