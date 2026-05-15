import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import i18n, { DEFAULT_LANG, SUPPORTED_LANGS, type SupportedLang } from "../i18n";

export type ThemeMode = "dark" | "light" | "auto";
const THEME_MODES: ThemeMode[] = ["dark", "light", "auto"];

export type ResolvedTheme = "dark" | "light";

export interface AppConfig {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  lang: SupportedLang;
  settings: Record<string, string>;
  refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfig | null>(null);

function isThemeMode(v: string | undefined): v is ThemeMode {
  return !!v && (THEME_MODES as string[]).includes(v);
}

function isLang(v: string | undefined): v is SupportedLang {
  return !!v && (SUPPORTED_LANGS as readonly string[]).includes(v);
}

function detectSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => detectSystemTheme());

  const refresh = useCallback(async () => {
    try {
      const res = await api.settings();
      setSettings(res.settings);
    } catch {
      // best-effort; fall back to defaults
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const themeMode: ThemeMode = isThemeMode(settings["ui.theme"]) ? settings["ui.theme"] : "dark";
  const lang: SupportedLang = isLang(settings["ui.lang"]) ? settings["ui.lang"] : DEFAULT_LANG;
  const resolvedTheme: ResolvedTheme = themeMode === "auto" ? systemTheme : themeMode;

  useEffect(() => {
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [lang]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = resolvedTheme;
    }
  }, [resolvedTheme]);

  const value = useMemo<AppConfig>(
    () => ({ themeMode, resolvedTheme, lang, settings, refresh }),
    [themeMode, resolvedTheme, lang, settings, refresh]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used inside <AppConfigProvider>");
  return ctx;
}
