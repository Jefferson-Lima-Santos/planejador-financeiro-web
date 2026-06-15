import { atom } from "recoil";
import { persistAtom } from "@/state/recoil-persist";

export type Language = "ptBR" | "en";
export type ThemeMode = "light" | "dark";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "ptBR";
  }

  const saved = localStorage.getItem("language");
  return saved === "en" || saved === "ptBR" ? saved : "ptBR";
};

export const languageAtom = atom<Language>({
  key: "language",
  default: getInitialLanguage(),
  effects_UNSTABLE: [persistAtom],
});

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = localStorage.getItem("themeMode");
  return saved === "light" || saved === "dark" ? saved : "dark";
};

export const themeModeAtom = atom<ThemeMode>({
  key: "themeMode",
  default: getInitialThemeMode(),
  effects_UNSTABLE: [persistAtom],
});
