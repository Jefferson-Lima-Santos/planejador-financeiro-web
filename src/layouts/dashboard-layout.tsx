import type { ReactNode } from "react";
import { LogoutOutlined } from "@mui/icons-material";
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
import { ThemeSwitch } from "@/components/theme-switch";
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
  const initials = name.slice(0, 1).toUpperCase();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        color="inherit"
        elevation={0}
        position="sticky"
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Toolbar
          sx={{
            gap: { xs: 1, sm: 2 },
            minHeight: { xs: 60, sm: 68 },
            px: { xs: 1.5, sm: 3 },
          }}
        >
          <Stack
            alignItems="center"
            direction="row"
            spacing={{ xs: 1, sm: 1.5 }}
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
            <Box
              alt={t(tokens.common.appName)}
              component="img"
              src="/assets/app-logo.svg"
              sx={{
                borderRadius: { xs: 2, sm: 2.25 },
                boxShadow: "0 8px 18px rgba(37, 99, 235, 0.22)",
                height: { xs: 38, sm: 40 },
                width: { xs: 38, sm: 40 },
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                noWrap
                sx={{ fontSize: { xs: 16, sm: 20 }, lineHeight: 1.15 }}
                variant="h6"
              >
                {t(tokens.common.appName)}
              </Typography>
              <Typography
                color="text.secondary"
                noWrap
                sx={{ display: { xs: "none", sm: "block" } }}
                variant="body2"
              >
                {t(tokens.layout.monthlyControl)}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Stack
            alignItems="center"
            direction="row"
            divider={<Divider flexItem orientation="vertical" />}
            spacing={{ xs: 1, sm: 2 }}
            sx={{ flexShrink: 0 }}
          >
            <ThemeSwitch />
            <LanguageSwitch />
            <Stack alignItems="center" direction="row" spacing={1}>
              <Avatar sx={{ height: { xs: 30, sm: 32 }, width: { xs: 30, sm: 32 } }}>
                {initials}
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

      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}
