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
