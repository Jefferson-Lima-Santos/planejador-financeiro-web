import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useSetRecoilState } from "recoil";
import { supabase } from "@/lib/supabase";
import {
  authSessionAtom,
  authTokenExpiresAtAtom,
  authTokenRefreshTickAtom,
  authUserAtom,
} from "@/state/atoms/auth";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const setAuthSession = useSetRecoilState(authSessionAtom);
  const setAuthUser = useSetRecoilState(authUserAtom);
  const setAuthTokenExpiresAt = useSetRecoilState(authTokenExpiresAtAtom);
  const setAuthTokenRefreshTick = useSetRecoilState(authTokenRefreshTickAtom);

  const syncSession = useCallback(
    (nextSession: Session | null) => {
      setSession(nextSession);
      setAuthSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      setAuthTokenExpiresAt(
        typeof nextSession?.expires_at === "number"
          ? nextSession.expires_at * 1000
          : null
      );
    },
    [setAuthSession, setAuthTokenExpiresAt, setAuthUser]
  );

  const handleAuthChange = useCallback(
    (event: AuthChangeEvent, nextSession: Session | null) => {
      syncSession(nextSession);

      if (event === "TOKEN_REFRESHED") {
        setAuthTokenRefreshTick(Date.now());
      }
    },
    [setAuthTokenRefreshTick, syncSession]
  );

  useEffect(() => {
    if (!supabase) {
      setIsInitialized(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session);
      setIsInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      handleAuthChange(event, nextSession);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthChange, syncSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error(
        "Não foi possível conectar o serviço agora. Confira a configuração e tente novamente."
      );
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      if (!supabase) {
        throw new Error(
          "Não foi possível conectar o serviço agora. Confira a configuração e tente novamente."
        );
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        throw error;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      syncSession(null);
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, [syncSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isInitialized,
      isAuthenticated: Boolean(session?.user),
      signIn,
      signUp,
      signOut,
    }),
    [isInitialized, session, signIn, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth precisa estar dentro do AuthProvider.");
  }

  return context;
};
