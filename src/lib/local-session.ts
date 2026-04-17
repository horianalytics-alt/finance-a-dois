// Persistência leve do family_id e profile_id no LocalStorage,
// conforme requisito da Seção 1.

const KEY = "fc.session.v1";

export type LocalSession = {
  family_id: string;
  profile_id: string;
  family_code: string;
  profile_name: string;
};

export function readLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalSession;
  } catch {
    return null;
  }
}

export function writeLocalSession(s: LocalSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearLocalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

const HIDE_KEY = "fc.hideValues.v1";
export function readHideValues(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HIDE_KEY) === "1";
}
export function writeHideValues(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIDE_KEY, v ? "1" : "0");
}
