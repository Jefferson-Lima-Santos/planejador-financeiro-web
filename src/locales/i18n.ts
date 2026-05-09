import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "@/locales/translations/en";
import { ptBR } from "@/locales/translations/pt-br";

const savedLanguage =
  typeof window !== "undefined" ? localStorage.getItem("language") : null;

i18n.use(initReactI18next).init({
  fallbackLng: "ptBR",
  interpolation: {
    escapeValue: false,
  },
  lng: savedLanguage || "ptBR",
  resources: {
    en: {
      translation: en,
    },
    ptBR: {
      translation: ptBR,
    },
  },
});

export default i18n;
