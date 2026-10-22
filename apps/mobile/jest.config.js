// jest-expo with the pnpm pattern from the Expo unit-testing guide (SDK 58), plus the app's own
// libraries and standard-navigation (an ESM-only dependency of Expo Router 58).
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
  moduleNameMapper: {
    // NativeWind compiles the CSS in Metro; tests get an empty module.
    '\\.css$': '<rootDir>/test/style-stub.js',
    // Lucide's react-native build is .mjs, which Jest does not transform; use its CommonJS build.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|nativewind|react-native-css-interop|standard-navigation))',
  ],
};
