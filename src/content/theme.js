import { DEFAULT_THEME, THEME_PALETTES } from './defaults.js';

// Mezcla con blanco (tonos claros) o negro (tonos oscuros) en estas proporciones.
const LIGHT = [['50', 0.95], ['100', 0.9], ['200', 0.75], ['300', 0.6], ['400', 0.3]];
const DARK = [['600', 0.15], ['700', 0.3], ['800', 0.45], ['900', 0.6], ['950', 0.75]];

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (rgb, target, ratio) => rgb.map((c) => Math.round(c + (target - c) * ratio));
const fmt = (rgb) => rgb.join(' ');

// Deriva una escala 50–950 en formato "r g b" a partir de un color hex.
export function deriveScale(hex) {
  const base = hexToRgb(hex);
  const scale = {};
  for (const [step, ratio] of LIGHT) scale[step] = fmt(mix(base, 255, ratio));
  scale['500'] = fmt(base);
  for (const [step, ratio] of DARK) scale[step] = fmt(mix(base, 0, ratio));
  return scale;
}

// Devuelve solo las variables CSS de los colores que difieren del default.
export function themeToCssVars(theme, defaults = DEFAULT_THEME) {
  const vars = {};
  for (const [key, palette] of Object.entries(THEME_PALETTES)) {
    if (theme[key] && theme[key].toLowerCase() !== defaults[key].toLowerCase()) {
      for (const [step, value] of Object.entries(deriveScale(theme[key]))) {
        vars[`--c-${palette}-${step}`] = value;
      }
    }
  }
  if (theme.ink && theme.ink.toLowerCase() !== defaults.ink.toLowerCase()) {
    vars['--c-ink'] = fmt(hexToRgb(theme.ink));
  }
  return vars;
}
