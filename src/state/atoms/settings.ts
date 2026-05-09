import { atom } from "recoil";
import { persistAtom } from "@/state/recoil-persist";

export type Language = "ptBR" | "en";

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
