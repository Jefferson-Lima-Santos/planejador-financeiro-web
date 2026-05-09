import { recoilPersist } from "recoil-persist";

const storage = typeof window === "undefined" ? undefined : localStorage;

export const { persistAtom } = recoilPersist({
  key: "planejador-financeiro",
  // recoil-persist aceita storage opcional; no SSR não existe localStorage.
  storage: storage as unknown as Storage,
});
