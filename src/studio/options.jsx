// Colours, sizes, fonts and clipart used by the studio.

export const COLOURS = [
  { name: "White", hex: "#f4f4f2" },
  { name: "Black", hex: "#1b1b1d" },
  { name: "Heather Grey", hex: "#b9b9bb" },
  { name: "Charcoal", hex: "#3d4148" },
  { name: "Sand", hex: "#d9cfbf" },
  { name: "Navy", hex: "#1f2a44" },
  { name: "Red", hex: "#b3261e" },
  { name: "Forest", hex: "#2f4a3a" },
  { name: "Sky", hex: "#8fb8de" },
  { name: "Lilac", hex: "#b9a7d9" },
  { name: "Butter", hex: "#efd98a" },
];

export const SIZES = ["S", "M", "L", "XL", "XXL"];

export const FONTS = [
  { name: "Anton", css: "'Anton', sans-serif", weight: 400 },
  { name: "Bebas Neue", css: "'Bebas Neue', sans-serif", weight: 400 },
  { name: "Inter Black", css: "'Inter', sans-serif", weight: 900 },
  { name: "Playfair", css: "'Playfair Display', serif", weight: 700, italic: true },
  { name: "Marker", css: "'Permanent Marker', cursive", weight: 400 },
  { name: "Pacifico", css: "'Pacifico', cursive", weight: 400 },
  { name: "Space Mono", css: "'Space Mono', monospace", weight: 700 },
];

export const INKS = ["#111111", "#ffffff", "#d43f21", "#f2b705", "#2d6cdf", "#2f9e5b", "#e64fa3", "#8a5cf6"];

// Simple icons (24 x 24). "fill" icons use solid colour, "stroke" icons are line art.
export const CLIPART = [
  { id: "star", kind: "fill", d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { id: "heart", kind: "fill", d: "M12 21s-7.5-4.6-10-9.5C.5 8 2.5 4 6.5 4c2.2 0 3.8 1.2 5.5 3.2C13.7 5.2 15.3 4 17.5 4c4 0 6 4 4.5 7.5C19.5 16.4 12 21 12 21z" },
  { id: "bolt", kind: "fill", d: "M13 2L4 14h7l-1 8 9-12h-7l1-8z" },
  { id: "sparkle", kind: "fill", d: "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" },
  { id: "crown", kind: "fill", d: "M3 18h18v2H3zM3 7l4.5 4L12 4l4.5 7L21 7l-2 9H5z" },
  { id: "flame", kind: "fill", d: "M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" },
  { id: "moon", kind: "fill", d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" },
  { id: "mountain", kind: "fill", d: "M2 20L9 8l4 6 3-4 6 10z" },
  { id: "smile", kind: "stroke", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01" },
  { id: "peace", kind: "stroke", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 12l-6.4 6.4M12 12l6.4 6.4" },
  { id: "wave", kind: "stroke", d: "M2 10c3-4 5-4 8 0s5 4 8 0 3-3 4-2M2 16c3-4 5-4 8 0s5 4 8 0 3-3 4-2" },
  { id: "infinity", kind: "stroke", d: "M6 9a3 3 0 1 0 0 6c3 0 9-6 12-6a3 3 0 1 1 0 6c-3 0-9-6-12-6z" },
];

export function ClipartSvg({ id, color = "currentColor" }) {
  const c = CLIPART.find(x => x.id === id) || CLIPART[0];
  return c.kind === "fill" ? (
    <svg viewBox="0 0 24 24" fill={color}><path d={c.d} /></svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.d} /></svg>
  );
}

export const fontOf = name => FONTS.find(f => f.name === name) || FONTS[0];

export const colourName = hex => COLOURS.find(c => c.hex.toLowerCase() === String(hex).toLowerCase())?.name || "Custom";

export function isDark(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
