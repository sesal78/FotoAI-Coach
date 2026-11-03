// Native modules with no JS fallback in Jest.
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));

// The map is native. Tests see a View per map and marker, with the props the app passes.
jest.mock('react-native-maps', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const MapView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref, testID: props.testID ?? 'map' }));
  const Marker = (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: props.testID ?? 'marker' });
  return { __esModule: true, default: MapView, Marker, PROVIDER_GOOGLE: 'google' };
});

// expo-crypto's randomUUID is native; in Jest it returns nothing. Ids made on the phone (outbox
// items, rolls, frames) need to be real and unique in tests too.
jest.mock('expo-crypto', () => ({ ...jest.requireActual('expo-crypto'), randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

// TanStack Query keeps each cached read on a timer (gcTime: up to 7 days, see query-defaults.ts).
// The test clients are never cleared, so those timers kept Jest open after the tests ended: the
// CI "workspace" job then ran until GitHub stopped it at 6 hours. Unref'd timers still fire, but
// no longer keep the test process open. The global timer is looked up at call time, so tests
// with fake timers still control them.
type NodeTimer = ReturnType<typeof setTimeout> & { unref?: () => void };
const { timeoutManager } = jest.requireActual('@tanstack/react-query');
timeoutManager.setTimeoutProvider({
  setTimeout: (callback: () => void, delay: number) => {
    const timer = globalThis.setTimeout(callback, delay) as NodeTimer;
    timer.unref?.();
    return timer;
  },
  clearTimeout: (timer: NodeTimer | undefined) => globalThis.clearTimeout(timer),
  setInterval: (callback: () => void, delay: number) => {
    const timer = globalThis.setInterval(callback, delay) as NodeTimer;
    timer.unref?.();
    return timer;
  },
  clearInterval: (timer: NodeTimer | undefined) => globalThis.clearInterval(timer),
});
