import type { ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  LogoutOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  Container,
  Divider,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/language-switch";
import { useAuth } from "@/contexts/auth-context";
import { tokens } from "@/locales/tokens";

type DashboardLayoutProps = {
  children: ReactNode;
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/auth/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.auth.errors.generic));
    }
  };

  const name =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        color="inherit"
        elevation={0}
        position="sticky"
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Toolbar sx={{ minHeight: 68 }}>
          <Stack
            alignItems="center"
            direction="row"
            spacing={1.5}
            onClick={() => router.push("/dashboard")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push("/dashboard");
              }
            }}
            sx={{ cursor: "pointer" }}
          >
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <AccountBalanceWalletOutlined />
            </Avatar>
            <Box>
              <Typography variant="h6">{t(tokens.common.appName)}</Typography>
              <Typography color="text.secondary" variant="body2">
                {t(tokens.layout.monthlyControl)}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            alignItems="center"
            direction="row"
            divider={<Divider flexItem orientation="vertical" />}
            spacing={2}
          >
            <LanguageSwitch />
            <Stack alignItems="center" direction="row" spacing={1}>
              <Avatar sx={{ height: 32, width: 32 }}>
                {name.slice(0, 1).toUpperCase()}
              </Avatar>
              <Typography
                sx={{ display: { xs: "none", md: "block" }, maxWidth: 160 }}
                noWrap
                variant="body2"
              >
                {name}
              </Typography>
              <Tooltip title={t(tokens.layout.logout)}>
                <IconButton aria-label={t(tokens.layout.logout)} onClick={handleSignOut}>
                  <LogoutOutlined />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
