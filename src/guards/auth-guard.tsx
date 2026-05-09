import { type ReactNode, useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/auth-context";

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized || isAuthenticated) {
      return;
    }

    const returnTo = router.asPath;
    router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized || !isAuthenticated) {
    return (
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          minHeight: "100vh",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
