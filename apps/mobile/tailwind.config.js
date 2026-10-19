// Tailwind 3 for NativeWind 4. Colours read the theme's CSS variables (set from @fotoai/ui
// tokens by the ThemeProvider), so one class name works in every theme. The key list must match
// tailwindColors() in @fotoai/ui (checked by src/ui/__tests__/tailwind-test.ts).
const KEYS = ['bg', 'surface', 'surface-alt', 'text', 'text-muted', 'primary', 'on-primary', 'accent', 'on-accent', 'border', 'success', 'warning', 'danger', 'on-danger'];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(KEYS.map((k) => [k, `rgb(var(--color-${k}) / <alpha-value>)`])),
    },
  },
  plugins: [],
};
