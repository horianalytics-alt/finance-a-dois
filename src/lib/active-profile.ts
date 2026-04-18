// Persiste o "perfil ativo" da família no localStorage,
// preferências de tema (light/dark) e paleta de cor.

import type { PaletteId } from "@/lib/palettes";
import { DEFAULT_PALETTE } from "@/lib/palettes";

const KEY = "fc.activeProfile.v1";

export function readActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function writeActiveProfileId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}

export function clearActiveProfileId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

const THEME_KEY = "fc.theme.v1";
export type ThemeMode = "light" | "dark";

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(THEME_KEY);
  if (v === "dark" || v === "light") return v;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeTheme(t: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, t);
}

const PALETTE_KEY = "fc.palette.v1";

export function readPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const v = window.localStorage.getItem(PALETTE_KEY) as PaletteId | null;
  return v ?? DEFAULT_PALETTE;
}

export function writePalette(p: PaletteId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PALETTE_KEY, p);
}
