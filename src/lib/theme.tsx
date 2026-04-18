import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readPalette,
  readTheme,
  writePalette,
  writeTheme,
  type ThemeMode,
} from "@/lib/active-profile";
import { applyPalette, DEFAULT_PALETTE, type PaletteId } from "@/lib/palettes";

interface ThemeCtx {
  theme: ThemeMode;
  toggle: () => void;
  setTheme: (t: ThemeMode) => void;
  palette: PaletteId;
  setPalette: (p: PaletteId) => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [hydrated, setHydrated] = useState(false);

  // Hidratação inicial — lê localStorage uma vez no client
  useEffect(() => {
    setThemeState(readTheme());
    setPaletteState(readPalette());
    setHydrated(true);
  }, []);

  // Aplica modo escuro/claro
  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme, hydrated]);

  // Aplica paleta sempre que tema OU paleta mudarem
  useEffect(() => {
    if (!hydrated) return;
    applyPalette(palette, theme);
    writePalette(palette);
  }, [palette, theme, hydrated]);

  const setPalette = useCallback((p: PaletteId) => {
    setPaletteState(p);
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({ theme, toggle, setTheme, palette, setPalette }),
    [theme, toggle, setTheme, palette, setPalette],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
