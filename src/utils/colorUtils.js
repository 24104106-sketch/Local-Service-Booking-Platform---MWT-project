// Takes one color the person picks and derives every shade the app actually
// needs from it — this is what makes "pick a color" feel like "the whole
// theme changed" instead of just recoloring buttons. Same idea as Android's
// Material You or Windows accent color: one seed color, a generated palette.

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Given any hex color and the current light/dark mode, returns every CSS
 * variable this app needs to feel fully recolored: the accent itself
 * (clamped to a readable button-contrast lightness), a darker hover shade,
 * a soft tint for badges/highlights, and a tinted sidebar gradient so even
 * the navy sidebar picks up a hint of the chosen color instead of staying
 * static navy regardless of what's picked.
 */
export function derivePaletteFromColor(hex, mode) {
  const { h, s } = hexToHsl(hex);
  const satForButtons = clamp(s, 45, 85);

  const blue = hslToHex(h, satForButtons, mode === "dark" ? 62 : 48);
  const blueDark = hslToHex(h, satForButtons, mode === "dark" ? 78 : 33);
  const blueSoft = mode === "dark"
    ? hslToHex(h, clamp(satForButtons - 15, 20, 60), 16)
    : hslToHex(h, clamp(satForButtons - 15, 20, 60), 94);

  const sidebarFrom = hslToHex(h, clamp(satForButtons - 20, 15, 45), mode === "dark" ? 3 : 6);
  const sidebarTo = hslToHex(h, clamp(satForButtons - 15, 15, 45), mode === "dark" ? 6 : 11);

  return { blue, blueDark, blueSoft, sidebarFrom, sidebarTo };
}
