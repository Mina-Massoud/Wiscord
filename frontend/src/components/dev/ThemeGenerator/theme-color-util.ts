// Tiny color helpers scoped to the theme generator. Keeps the row component
// free of inline parsing logic and makes the rgba <-> hex+alpha bridge testable.

export interface RgbaParts {
  hex: string;
  alpha: number;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
const RGBA_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

function toHexComponent(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

export function parseRgba(value: string): RgbaParts | null {
  const match = RGBA_RE.exec(value.trim());
  if (match === null) return null;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) {
    return null;
  }
  return { hex: `#${toHexComponent(r)}${toHexComponent(g)}${toHexComponent(b)}`, alpha: a };
}

export function rgbaFromHexAndAlpha(hex: string, alpha: number): string {
  const m = HEX_RE.exec(hex);
  if (m === null) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

const HSL_TRIPLET_RE = /^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/;

export function isValidHslTriplet(value: string): boolean {
  return HSL_TRIPLET_RE.test(value);
}

// Convert a `H S% L%` triplet to a hex string so the native color picker
// can display it. Conversion only — the source of truth stays the triplet.
export function hslTripletToHex(value: string): string {
  const match = HSL_TRIPLET_RE.exec(value);
  if (match === null) return '#000000';
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const { r, g, b } = hslToRgb(h, s, l);
  return `#${toHexComponent(r * 255)}${toHexComponent(g * 255)}${toHexComponent(b * 255)}`;
}

export function hexToHslTriplet(hex: string): string {
  const m = HEX_RE.exec(hex);
  if (m === null) return '0 0% 0%';
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3),
  };
}

function hueToRgb(p: number, q: number, tIn: number): number {
  let t = tIn;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h / 6, s, l };
}
