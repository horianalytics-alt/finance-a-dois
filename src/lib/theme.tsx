import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readTheme, writeTheme, type ThemeMode } from "@/lib/active-profile";

interface ThemeCtx {
  theme: ThemeMode;
  toggle: () => void;
  setTheme: (t: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const t = readTheme();
    setThemeState(t);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    writeTheme(theme);
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
