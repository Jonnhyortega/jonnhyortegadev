import colors from 'tailwindcss/colors';

// Convierte "#rrggbb" en "r g b" para usarlo como valor por defecto de la variable CSS.
const hexToTriplet = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(' ');
};

// Cada tono lee su variable --c-<paleta>-<tono>; sin ella queda el color oficial de Tailwind 3.
const editablePalette = (name) =>
  Object.fromEntries(
    Object.entries(colors[name]).map(([shade, hex]) => [
      shade,
      `rgb(var(--c-${name}-${shade}, ${hexToTriplet(hex)}) / <alpha-value>)`,
    ]),
  );

export default {
  content: [
    "./index.html",
    "./admin.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        purple: editablePalette('purple'),
        violet: editablePalette('violet'),
        fuchsia: editablePalette('fuchsia'),
        yellow: editablePalette('yellow'),
        ink: {
          DEFAULT: 'rgb(var(--c-ink, 7 3 15) / <alpha-value>)',
          900: '#0b0618',
          800: '#120a24',
          700: '#1a1033',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        gridmove: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 64px' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        scrollLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 6s linear infinite',
        blink: 'blink 1s steps(1) infinite',
        gridmove: 'gridmove 2.4s linear infinite',
        pulseRing: 'pulseRing 2s ease-out infinite',
        scrollLine: 'scrollLine 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
