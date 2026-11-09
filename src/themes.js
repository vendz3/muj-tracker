// Color themes. Each theme is 5 base colors + a card divider line, plus a few derived for legibility:
//   accentStrong  button fill (where the brief's accent is too light behind white text)
//   accentText    accent used as text on cards, >= 4.5:1
//   onAccent      text on accent fills
//   accent2Text   secondary accent as text (the brief's light accents are ~2–3.7:1 on white)
// applyTheme() turns a theme into CSS variables that Tailwind's classes already read
// (neutral-* = surfaces/text, accent-* = accent), so components keep their classes.
export const THEMES = [
  {
    id: "neon", name: "Neon Drive", description: "Hluboká černá, neonová růžová a cyan. Energie na každý den.", dark: true,
    bg: "#09090B", card: "#141418", text: "#FAFAFA", accent: "#D946EF", accent2: "#22D3EE", line: "#27272A",
    accentStrong: "#D946EF", accentText: "#E879F9", onAccent: "#09090B", accent2Text: "#22D3EE",
  },
  {
    id: "midnight", name: "Midnight Pro", description: "Tmavá břidlice a elegantní modrá, jako dark mode v macOS.", dark: true,
    bg: "#0F172A", card: "#1E293B", text: "#F8FAFC", accent: "#3B82F6", accent2: "#34D399", line: "#334155",
    accentStrong: "#2563EB", accentText: "#60A5FA", onAccent: "#FFFFFF", accent2Text: "#34D399",
  },
  {
    id: "zen", name: "Zen Minimal", description: "Čistá bílá, tlumená šalvěj a břidlice. Nic navíc.", dark: false,
    bg: "#FFFFFF", card: "#FFFFFF", text: "#111827", accent: "#5F7F6A", accent2: "#64748B", line: "#F3F4F6",
    accentStrong: "#4D6B57", accentText: "#4D6B57", onAccent: "#FFFFFF", accent2Text: "#475569",
  },
  {
    id: "prism", name: "Vibrant Prism", description: "Tmavý grafit a zářivé barvy duhy. Grafy, které hrají.", dark: true,
    bg: "#141416", card: "#1F1F23", text: "#F5F5F7", accent: "#FF5E9C", accent2: "#4ECDC4", line: "#2C2C31",
    accentStrong: "#FF5E9C", accentText: "#FF8DB8", onAccent: "#14141A", accent2Text: "#4ECDC4",
    // Optional extras: chart = palette cycled per chart card, fill = button gradient, glow = hover shadow.
    chart: ["#4ECDC4", "#FF6B6B", "#FFE66D", "#C56CF0", "#32FF7E", "#5DADFF"],
    fill: "linear-gradient(135deg, #FF5E9C, #FF9F43)", glow: "#FF5E9C80",
  },
];
export const DEFAULT_THEME = "midnight";
const STORE = "lj-theme";

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
// `t` of color a over b (sRGB).
export const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v * t + rgb(b)[i] * (1 - t)));

// WCAG contrast ratio of two hex colors.
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Neutral scale = text mixed into the card. 800/700 (raised surface / border) are fixed ratios; text steps
// 600…100 take the smallest ratio that reaches their contrast target (500 is checked on the raised 800
// surface, where it is used as placeholder / muted text in fields), never below the base ratio.
const SURFACES = { 800: 0.07, 700: 0.16 };
const TEXT = [
  [600, 0.5, 3.6],
  [500, 0.62, 4.8],
  [400, 0.74, 6.5],
  [300, 0.84, 8.5],
  [200, 0.92, 11],
  [100, 0.97, 14],
];

export function themeVars(t) {
  const v = { "--color-neutral-950": t.bg, "--color-neutral-900": t.card, "--color-neutral-50": t.text };
  for (const [step, k] of Object.entries(SURFACES)) v[`--color-neutral-${step}`] = mix(t.text, t.card, k);
  let k = 0;
  for (const [step, base, target] of TEXT) {
    const ref = step === 500 ? v["--color-neutral-800"] : t.card;
    k = Math.max(k, base);
    while (k < 1 && contrast(mix(t.text, t.card, k), ref) < target) k = Math.min(1, k + 0.01);
    v[`--color-neutral-${step}`] = mix(t.text, t.card, k);
  }
  Object.assign(v, {
    "--color-accent-900": t.accentStrong,
    "--color-accent-600": t.accentStrong,
    "--color-accent-500": t.accent,
    "--color-accent-400": t.accentText,
    "--color-accent-300": t.accentText,
    "--color-accent-200": t.accentText,
    "--color-on-accent": t.onAccent,
    "--color-accent2": t.accent2,
    "--color-accent2-text": t.accent2Text,
    "--color-line": t.line,
    "--color-shade": t.dark ? "#00000066" : `${t.text}1f`,
    // "" makes setProperty remove the variable, so switching away from a theme with extras leaves none behind.
    "--accent-fill": t.fill ?? "",
    "--accent-glow": t.glow ?? "",
  });
  for (let i = 0; i < 6; i++) v[`--color-cycle-${i + 1}`] = t.chart?.[i] ?? "";
  if (!t.dark) Object.assign(v, { "--color-red-400": "#DC2626", "--color-red-500": "#EF4444" }); // readable errors on light
  return v;
}

export const getTheme = (id) => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME);
export const storedThemeId = () => {
  try {
    return localStorage.getItem(STORE) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

// Apply to <html> and remember. The variables are cached too, so index.html can paint the right
// colors before any JS module loads (no flash of the default theme).
export function applyTheme(id) {
  const t = getTheme(id);
  const vars = themeVars(t);
  const root = document.documentElement;
  for (const [k, val] of Object.entries(vars)) root.style.setProperty(k, val);
  root.style.colorScheme = t.dark ? "dark" : "light";
  root.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg); // browser bar follows the theme
  try {
    localStorage.setItem(STORE, t.id);
    localStorage.setItem(`${STORE}-vars`, JSON.stringify({ ...vars, "color-scheme": root.style.colorScheme }));
  } catch {
    // private mode / storage full: the theme still applies for this visit
  }
  return t;
}
