import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { fakeApi } from '../../../test/harness';
import { ThemeProvider, ThemeSync, useTheme } from '../ThemeProvider';

const mockStore = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => mockStore.get(k) ?? null,
    setItemSync: (k: string, v: string) => void mockStore.set(k, v),
    removeItemSync: (k: string) => mockStore.delete(k),
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
  },
}));
const mockApi: { current: ReturnType<typeof fakeApi> | null } = { current: null };
jest.mock('../../data/client', () => ({ getApi: () => mockApi.current }));

function Probe() {
  const { setting, setSetting } = useTheme();
  return <Text testID="probe" onPress={() => setSetting('golden_dark')}>{setting}</Text>;
}

beforeEach(() => mockStore.clear());

test('the theme choice survives a restart and shows on the first frame', async () => {
  const first = await render(<ThemeProvider><Probe /></ThemeProvider>);
  await act(async () => await fireEvent.press(screen.getByTestId('probe')));
  expect(screen.getByTestId('probe').props.children).toBe('golden_dark');
  await first.unmount();

  // A restart: the saved choice is read before the first frame, so there is no flicker.
  const frames: string[] = [];
  function Spy() {
    frames.push(useTheme().setting);
    return null;
  }
  await render(<ThemeProvider><Spy /></ThemeProvider>);
  expect(frames[0]).toBe('golden_dark');
});

test("the account's theme wins on sign-in", async () => {
  mockStore.set('fotoai.theme.v1', 'golden');
  mockApi.current = fakeApi({ 'GET /api/v2/me/preferences': { theme: 'camera', units: 'metric', home: null } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ThemeSync />
        <Probe />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('camera'));
  expect(mockStore.get('fotoai.theme.v1')).toBe('camera');
});

test('a theme chosen offline is not overwritten by the account, and is sent when the account answers', async () => {
  mockStore.set('fotoai.theme.v1', 'camera');
  mockStore.set('fotoai.theme.unsaved.v1', 'camera');
  mockApi.current = fakeApi({
    'GET /api/v2/me/preferences': { theme: 'golden', units: 'metric', home: null },
    'PATCH /api/v2/me/preferences': (b: unknown) => ({ theme: 'camera', units: 'metric', home: null, ...(b as object) }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ThemeSync />
        <Probe />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockApi.current!.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ theme: 'camera' }));
  expect(screen.getByTestId('probe').props.children).toBe('camera');
  await waitFor(() => expect(mockStore.has('fotoai.theme.unsaved.v1')).toBe(false));
});
