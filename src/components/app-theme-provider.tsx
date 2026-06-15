import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useRecoilState } from "recoil";
import { useAuth } from "@/contexts/auth-context";
import {
  getUserPreference,
  upsertUserPreference,
  USER_PREFERENCE_THEME_MODE,
} from "@/lib/user-preferences";
import { themeModeAtom, type ThemeMode } from "@/state/atoms/settings";
import { buildTheme } from "@/theme";

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const { isInitialized, user } = useAuth();
  const [themeMode, setThemeMode] = useRecoilState(themeModeAtom);
  const hasLoadedPreferenceRef = useRef(false);
  const lastSavedModeRef = useRef<ThemeMode | null>(null);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (!user) {
      hasLoadedPreferenceRef.current = false;
      lastSavedModeRef.current = null;
      return;
    }

    let isMounted = true;

    const loadPreference = async () => {
      const savedMode = await getUserPreference<ThemeMode>(USER_PREFERENCE_THEME_MODE);

      if (!isMounted) {
        return;
      }

      if (savedMode === "light" || savedMode === "dark") {
        setThemeMode(savedMode);
        localStorage.setItem("themeMode", savedMode);
        lastSavedModeRef.current = savedMode;
      } else {
        await upsertUserPreference(USER_PREFERENCE_THEME_MODE, themeMode);
        lastSavedModeRef.current = themeMode;
      }

      hasLoadedPreferenceRef.current = true;
    };

    void loadPreference();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, setThemeMode, themeMode, user]);

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!isInitialized || !user || !hasLoadedPreferenceRef.current) {
      return;
    }

    if (lastSavedModeRef.current === themeMode) {
      return;
    }

    lastSavedModeRef.current = themeMode;
    void upsertUserPreference(USER_PREFERENCE_THEME_MODE, themeMode);
  }, [isInitialized, themeMode, user]);

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
