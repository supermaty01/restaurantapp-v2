/**
 * Clay design system (docs/14).
 *
 * Colours resolve through the CSS variables in global.css, so `bg-surface`
 * means the right thing in both schemes and no element needs a `dark:` twin.
 * The palette itself is defined once in lib/design/tokens.ts.
 *
 * `darkMode: 'class'` is deliberate: the app has a light/dark/system setting,
 * so the scheme has to be settable, not just inherited from the OS.
 * ThemeContext drives it through NativeWind's `colorScheme.set`.
 */

/** Binds a semantic name to its CSS variable, keeping Tailwind's `/opacity`. */
const themed = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: themed('canvas'),
        surface: {
          DEFAULT: themed('surface'),
          alt: themed('surface-alt'),
        },
        sunken: themed('sunken'),
        line: {
          DEFAULT: themed('line'),
          strong: themed('line-strong'),
        },
        ink: {
          DEFAULT: themed('ink'),
          muted: themed('ink-muted'),
          subtle: themed('ink-subtle'),
        },
        primary: {
          DEFAULT: themed('primary'),
          pressed: themed('primary-pressed'),
        },
        'on-primary': themed('on-primary'),
        accent: themed('accent'),
        sage: themed('sage'),
        danger: themed('danger'),
        inverse: themed('inverse'),
        'on-inverse': themed('on-inverse'),
      },
      fontFamily: {
        // Fraunces para lo editorial, Manrope para el resto. El porqué de estas
        // dos y no las anteriores está en lib/design/tokens.ts.
        display: ['Fraunces_500Medium'],
        'display-semi': ['Fraunces_600SemiBold'],
        sans: ['Manrope_400Regular'],
        medium: ['Manrope_500Medium'],
        semi: ['Manrope_600SemiBold'],
        bold: ['Manrope_700Bold'],
      },
      borderRadius: {
        sm: '9px',
        md: '11px',
        lg: '13px',
        xl: '16px',
        pill: '100px',
      },
    },
  },
  plugins: [],
};
