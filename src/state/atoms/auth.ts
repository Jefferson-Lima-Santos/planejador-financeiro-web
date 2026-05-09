import { atom } from "recoil";
import type { Session, User } from "@supabase/supabase-js";

export const authSessionAtom = atom<Session | null>({
  key: "authSession",
  default: null,
});

export const authUserAtom = atom<User | null>({
  key: "authUser",
  default: null,
});

// Epoch millis do vencimento atual do access token (quando conhecido).
export const authTokenExpiresAtAtom = atom<number | null>({
  key: "authTokenExpiresAt",
  default: null,
});

// Atualiza quando o Supabase emite TOKEN_REFRESHED.
export const authTokenRefreshTickAtom = atom<number>({
  key: "authTokenRefreshTick",
  default: 0,
});
