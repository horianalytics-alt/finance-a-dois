// Persiste o "perfil ativo" da família no localStorage.
// Quando a mesma conta controla dois perfis (ex: Heitor e Carol),
// este valor define quem é o "autor padrão" das novas transações.

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
  // segue preferência do sistema na 1ª visita
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeTheme(t: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, t);
}
