// Paletas de cor disponíveis no seletor.
// Cada paleta sobrescreve apenas as variáveis "primary", "ring" e gradientes/brillho.
// As cores semânticas (success/destructive/investment) são fixas para legibilidade financeira.

export type PaletteId =
  | "navy"      // padrão V2.1 — Azul Marinho
  | "rose"      // tema legado (rosa/magenta original)
  | "leather"   // Marrom Couro
  | "emerald"   // Verde Esmeralda
  | "carmine"   // Vermelho Carmim
  | "fuchsia"   // Rosa Vibrante
  | "violet";   // Roxo/Lilás Profundo

export interface PaletteSpec {
  id: PaletteId;
  label: string;
  swatch: string; // cor de preview (hex/oklch) usada no seletor
  light: {
    primary: string;
    primaryGlow: string;
    primaryFg: string;
    ring: string;
    accent: string;
    accentFg: string;
    sidebarPrimary: string;
    sidebarAccent: string;
    sidebarAccentFg: string;
    themeColor: string; // <meta name="theme-color">
  };
  dark: {
    primary: string;
    primaryGlow: string;
    primaryFg: string;
    ring: string;
    accent: string;
    accentFg: string;
    sidebarPrimary: string;
    sidebarAccent: string;
    sidebarAccentFg: string;
    themeColor: string;
  };
}

export const PALETTES: PaletteSpec[] = [
  {
    id: "navy",
    label: "Azul Marinho",
    swatch: "#1e40af",
    light: {
      primary: "oklch(0.42 0.16 258)",
      primaryGlow: "oklch(0.55 0.18 250)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.42 0.16 258)",
      accent: "oklch(0.94 0.04 258)",
      accentFg: "oklch(0.30 0.10 258)",
      sidebarPrimary: "oklch(0.42 0.16 258)",
      sidebarAccent: "oklch(0.94 0.04 258)",
      sidebarAccentFg: "oklch(0.30 0.10 258)",
      themeColor: "#1e40af",
    },
    dark: {
      primary: "oklch(0.62 0.18 255)",
      primaryGlow: "oklch(0.72 0.15 250)",
      primaryFg: "oklch(0.10 0.02 258)",
      ring: "oklch(0.62 0.18 255)",
      accent: "oklch(0.32 0.075 258)",
      accentFg: "oklch(0.97 0.012 258)",
      sidebarPrimary: "oklch(0.62 0.18 255)",
      sidebarAccent: "oklch(0.32 0.075 258)",
      sidebarAccentFg: "oklch(0.97 0.012 258)",
      themeColor: "#1e40af",
    },
  },
  {
    id: "rose",
    label: "Rosa Original",
    swatch: "#e94f8b",
    light: {
      primary: "oklch(0.62 0.20 5)",
      primaryGlow: "oklch(0.70 0.20 340)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.62 0.20 5)",
      accent: "oklch(0.94 0.04 310)",
      accentFg: "oklch(0.30 0.10 310)",
      sidebarPrimary: "oklch(0.62 0.20 5)",
      sidebarAccent: "oklch(0.94 0.04 310)",
      sidebarAccentFg: "oklch(0.30 0.10 310)",
      themeColor: "#e94f8b",
    },
    dark: {
      primary: "oklch(0.72 0.21 5)",
      primaryGlow: "oklch(0.75 0.20 340)",
      primaryFg: "oklch(0.16 0.02 320)",
      ring: "oklch(0.72 0.21 5)",
      accent: "oklch(0.32 0.075 310)",
      accentFg: "oklch(0.97 0.012 340)",
      sidebarPrimary: "oklch(0.72 0.21 5)",
      sidebarAccent: "oklch(0.32 0.075 310)",
      sidebarAccentFg: "oklch(0.97 0.012 340)",
      themeColor: "#e94f8b",
    },
  },
  {
    id: "leather",
    label: "Marrom Couro",
    swatch: "#78350f",
    light: {
      primary: "oklch(0.42 0.10 60)",
      primaryGlow: "oklch(0.55 0.12 55)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.42 0.10 60)",
      accent: "oklch(0.92 0.04 60)",
      accentFg: "oklch(0.32 0.10 55)",
      sidebarPrimary: "oklch(0.42 0.10 60)",
      sidebarAccent: "oklch(0.92 0.04 60)",
      sidebarAccentFg: "oklch(0.32 0.10 55)",
      themeColor: "#78350f",
    },
    dark: {
      primary: "oklch(0.62 0.12 60)",
      primaryGlow: "oklch(0.70 0.12 55)",
      primaryFg: "oklch(0.10 0.02 60)",
      ring: "oklch(0.62 0.12 60)",
      accent: "oklch(0.32 0.06 60)",
      accentFg: "oklch(0.97 0.012 60)",
      sidebarPrimary: "oklch(0.62 0.12 60)",
      sidebarAccent: "oklch(0.32 0.06 60)",
      sidebarAccentFg: "oklch(0.97 0.012 60)",
      themeColor: "#78350f",
    },
  },
  {
    id: "emerald",
    label: "Verde Esmeralda",
    swatch: "#047857",
    light: {
      primary: "oklch(0.45 0.13 165)",
      primaryGlow: "oklch(0.58 0.15 160)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.45 0.13 165)",
      accent: "oklch(0.92 0.04 165)",
      accentFg: "oklch(0.32 0.08 165)",
      sidebarPrimary: "oklch(0.45 0.13 165)",
      sidebarAccent: "oklch(0.92 0.04 165)",
      sidebarAccentFg: "oklch(0.32 0.08 165)",
      themeColor: "#047857",
    },
    dark: {
      primary: "oklch(0.65 0.15 165)",
      primaryGlow: "oklch(0.72 0.14 160)",
      primaryFg: "oklch(0.10 0.02 165)",
      ring: "oklch(0.65 0.15 165)",
      accent: "oklch(0.32 0.06 165)",
      accentFg: "oklch(0.97 0.012 165)",
      sidebarPrimary: "oklch(0.65 0.15 165)",
      sidebarAccent: "oklch(0.32 0.06 165)",
      sidebarAccentFg: "oklch(0.97 0.012 165)",
      themeColor: "#047857",
    },
  },
  {
    id: "carmine",
    label: "Vermelho Carmim",
    swatch: "#9f1239",
    light: {
      primary: "oklch(0.45 0.18 18)",
      primaryGlow: "oklch(0.55 0.20 14)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.45 0.18 18)",
      accent: "oklch(0.93 0.04 18)",
      accentFg: "oklch(0.30 0.10 18)",
      sidebarPrimary: "oklch(0.45 0.18 18)",
      sidebarAccent: "oklch(0.93 0.04 18)",
      sidebarAccentFg: "oklch(0.30 0.10 18)",
      themeColor: "#9f1239",
    },
    dark: {
      primary: "oklch(0.65 0.20 18)",
      primaryGlow: "oklch(0.72 0.20 14)",
      primaryFg: "oklch(0.10 0.02 18)",
      ring: "oklch(0.65 0.20 18)",
      accent: "oklch(0.32 0.075 18)",
      accentFg: "oklch(0.97 0.012 18)",
      sidebarPrimary: "oklch(0.65 0.20 18)",
      sidebarAccent: "oklch(0.32 0.075 18)",
      sidebarAccentFg: "oklch(0.97 0.012 18)",
      themeColor: "#9f1239",
    },
  },
  {
    id: "fuchsia",
    label: "Rosa Vibrante",
    swatch: "#c026d3",
    light: {
      primary: "oklch(0.55 0.22 330)",
      primaryGlow: "oklch(0.65 0.22 320)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.55 0.22 330)",
      accent: "oklch(0.94 0.05 320)",
      accentFg: "oklch(0.32 0.10 320)",
      sidebarPrimary: "oklch(0.55 0.22 330)",
      sidebarAccent: "oklch(0.94 0.05 320)",
      sidebarAccentFg: "oklch(0.32 0.10 320)",
      themeColor: "#c026d3",
    },
    dark: {
      primary: "oklch(0.68 0.22 330)",
      primaryGlow: "oklch(0.75 0.22 320)",
      primaryFg: "oklch(0.10 0.02 330)",
      ring: "oklch(0.68 0.22 330)",
      accent: "oklch(0.32 0.08 320)",
      accentFg: "oklch(0.97 0.012 320)",
      sidebarPrimary: "oklch(0.68 0.22 330)",
      sidebarAccent: "oklch(0.32 0.08 320)",
      sidebarAccentFg: "oklch(0.97 0.012 320)",
      themeColor: "#c026d3",
    },
  },
  {
    id: "violet",
    label: "Roxo Profundo",
    swatch: "#5b21b6",
    light: {
      primary: "oklch(0.45 0.18 295)",
      primaryGlow: "oklch(0.58 0.18 285)",
      primaryFg: "oklch(0.99 0 0)",
      ring: "oklch(0.45 0.18 295)",
      accent: "oklch(0.93 0.05 295)",
      accentFg: "oklch(0.32 0.10 295)",
      sidebarPrimary: "oklch(0.45 0.18 295)",
      sidebarAccent: "oklch(0.93 0.05 295)",
      sidebarAccentFg: "oklch(0.32 0.10 295)",
      themeColor: "#5b21b6",
    },
    dark: {
      primary: "oklch(0.65 0.20 295)",
      primaryGlow: "oklch(0.72 0.18 285)",
      primaryFg: "oklch(0.10 0.02 295)",
      ring: "oklch(0.65 0.20 295)",
      accent: "oklch(0.32 0.08 295)",
      accentFg: "oklch(0.97 0.012 295)",
      sidebarPrimary: "oklch(0.65 0.20 295)",
      sidebarAccent: "oklch(0.32 0.08 295)",
      sidebarAccentFg: "oklch(0.97 0.012 295)",
      themeColor: "#5b21b6",
    },
  },
];

export const DEFAULT_PALETTE: PaletteId = "navy";

export function getPalette(id: PaletteId): PaletteSpec {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function applyPalette(id: PaletteId, mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  const palette = getPalette(id);
  const cfg = palette[mode];
  const root = document.documentElement;
  root.style.setProperty("--primary", cfg.primary);
  root.style.setProperty("--primary-foreground", cfg.primaryFg);
  root.style.setProperty("--primary-glow", cfg.primaryGlow);
  root.style.setProperty("--ring", cfg.ring);
  root.style.setProperty("--accent", cfg.accent);
  root.style.setProperty("--accent-foreground", cfg.accentFg);
  root.style.setProperty("--sidebar-primary", cfg.sidebarPrimary);
  root.style.setProperty("--sidebar-accent", cfg.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", cfg.sidebarAccentFg);
  root.style.setProperty("--sidebar-ring", cfg.ring);
  // theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", cfg.themeColor);
}
