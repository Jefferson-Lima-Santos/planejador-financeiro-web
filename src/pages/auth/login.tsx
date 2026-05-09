import { FormEvent, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AccountBalanceWalletOutlined,
  CheckCircleOutlineOutlined,
  LoginOutlined,
  PersonAddAltOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  GlobalStyles,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AppTextField } from "@/components/form-fields";
import { LanguageSwitch } from "@/components/language-switch";
import { isSupabaseConfigured } from "@/config";
import { useAuth } from "@/contexts/auth-context";
import { tokens } from "@/locales/tokens";

type AuthMode = "signIn" | "signUp";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAuthErrorMessage = (
  message: string | undefined,
  t: (token: string) => string
) => {
  if (message === "Invalid login credentials") {
    return t(tokens.auth.errors.invalidCredentials);
  }

  return message || t(tokens.auth.errors.generic);
};

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = useMemo(() => {
    const value = router.query.returnTo;
    return typeof value === "string" ? value : "/dashboard";
  }, [router.query.returnTo]);

  const errors = useMemo(() => {
    const nextErrors = {
      email: "",
      name: "",
      password: "",
      passwordConfirmation: "",
    };

    if (mode === "signUp" && !name.trim()) {
      nextErrors.name = t(tokens.auth.nameRequired);
    }

    if (!email.trim()) {
      nextErrors.email = t(tokens.auth.emailRequired);
    } else if (!emailRegex.test(email)) {
      nextErrors.email = t(tokens.auth.emailInvalid);
    }

    if (!password) {
      nextErrors.password = t(tokens.auth.passwordRequired);
    } else if (password.length < 6) {
      nextErrors.password = t(tokens.auth.passwordMin);
    }

    if (mode === "signUp") {
      if (!passwordConfirmation) {
        nextErrors.passwordConfirmation = t(tokens.auth.passwordConfirmationRequired);
      } else if (passwordConfirmation !== password) {
        nextErrors.passwordConfirmation = t(tokens.auth.passwordConfirmationMismatch);
      }
    }

    return nextErrors;
  }, [email, mode, name, password, passwordConfirmation, t]);

  const isFormValid =
    !errors.email &&
    !errors.password &&
    !errors.name &&
    !errors.passwordConfirmation;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setErrorText("");

    if (!isFormValid) {
      setErrorText(
        errors.email ||
          errors.password ||
          errors.passwordConfirmation ||
          errors.name ||
          t(tokens.auth.errors.generic)
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signUp") {
        await signUp(email, password, name);
        toast.success(t(tokens.auth.signUpSuccess));
      } else {
        await signIn(email, password);
        toast.success(t(tokens.auth.signInSuccess));
      }

      router.replace(returnTo);
    } catch (error) {
      const message = getAuthErrorMessage(
        error instanceof Error ? error.message : undefined,
        t
      );
      setErrorText(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${t(tokens.auth.login)} | ${t(tokens.common.appName)}`}</title>
      </Head>
      <GlobalStyles
        styles={{
          "@keyframes auth-card-in": {
            "0%": { opacity: 0, transform: "translateY(18px) scale(0.98)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
          },
          "@keyframes error-shake": {
            "0%, 100%": { transform: "translateX(0)" },
            "20%": { transform: "translateX(-8px)" },
            "40%": { transform: "translateX(8px)" },
            "60%": { transform: "translateX(-5px)" },
            "80%": { transform: "translateX(5px)" },
          },
        }}
      />
      <Box
        sx={{
          alignItems: "center",
          backgroundImage:
            "linear-gradient(110deg, rgba(7, 17, 32, 0.88), rgba(15, 23, 42, 0.58) 44%, rgba(37, 99, 235, 0.18)), url('/assets/auth-background.jpg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
          display: "flex",
          minHeight: "100vh",
          overflow: "hidden",
          position: "relative",
          py: 6,
        }}
      >
        <Box sx={{ position: "absolute", right: 24, top: 24, zIndex: 2 }}>
          <LanguageSwitch />
        </Box>

        <Container maxWidth="lg">
          <Box
            sx={{
              alignItems: "center",
              display: "grid",
              gap: { xs: 4, md: 8 },
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 480px" },
            }}
          >
            <Box sx={{ color: "common.white", maxWidth: 620 }}>
              <Typography
                component="p"
                sx={{
                  fontWeight: 700,
                  letterSpacing: 0,
                  mb: 2,
                  opacity: 0.82,
                }}
              >
                {t(tokens.common.appName)}
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: "2.2rem", md: "3.75rem" },
                  fontWeight: 800,
                  letterSpacing: 0,
                  lineHeight: 1,
                }}
              >
                {t(tokens.auth.title)}
              </Typography>
              <Typography
                sx={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: "1.08rem",
                  lineHeight: 1.7,
                  mt: 2.5,
                  maxWidth: 540,
                }}
              >
                {t(tokens.auth.subtitle)}
              </Typography>
            </Box>

            <Card
              sx={{
                animation: "auth-card-in 420ms ease both",
                backdropFilter: "blur(18px)",
                bgcolor: "rgba(255, 255, 255, 0.94)",
                border: "1px solid rgba(255, 255, 255, 0.64)",
                boxShadow: "0 30px 90px rgba(15, 23, 42, 0.34)",
              }}
            >
              <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
              <Stack alignItems="center" spacing={2.5}>
                <Avatar sx={{ bgcolor: "primary.main", height: 56, width: 56 }}>
                  <AccountBalanceWalletOutlined />
                </Avatar>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h1">{t(tokens.common.appName)}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {t(tokens.auth.intro)}
                  </Typography>
                </Box>
              </Stack>

              <Tabs
                centered
                onChange={(_event, value: AuthMode) => {
                  setMode(value);
                  setErrorText("");
                  setHasSubmitted(false);
                }}
                sx={{ mt: 4 }}
                value={mode}
              >
                <Tab label={t(tokens.auth.login)} value="signIn" />
                <Tab label={t(tokens.auth.createAccount)} value="signUp" />
              </Tabs>

              {!isSupabaseConfigured && (
                <Alert severity="warning" sx={{ mt: 3 }}>
                  {t(tokens.auth.supabaseMissing)}
                </Alert>
              )}

              {errorText && (
                <Alert
                  severity="error"
                  sx={{
                    animation: "error-shake 360ms ease",
                    mt: 3,
                  }}
                >
                  {errorText}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                <Stack spacing={2.5}>
                  {mode === "signUp" && (
                    <AppTextField
                      autoComplete="name"
                      error={hasSubmitted && Boolean(errors.name)}
                      fullWidth
                      helperText={hasSubmitted ? errors.name : ""}
                      label={t(tokens.auth.name)}
                      onChange={(event) => {
                        setName(event.target.value);
                        setErrorText("");
                      }}
                      required
                      value={name}
                    />
                  )}
                  <AppTextField
                    autoComplete="email"
                    error={hasSubmitted && Boolean(errors.email)}
                    fullWidth
                    helperText={hasSubmitted ? errors.email : ""}
                    label={t(tokens.auth.email)}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrorText("");
                    }}
                    required
                    type="email"
                    value={email}
                    InputProps={
                      email && !errors.email
                        ? {
                            endAdornment: (
                              <InputAdornment position="end">
                                <CheckCircleOutlineOutlined color="success" />
                              </InputAdornment>
                            ),
                          }
                        : undefined
                    }
                  />
                  <AppTextField
                    autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                    error={hasSubmitted && Boolean(errors.password)}
                    fullWidth
                    helperText={hasSubmitted ? errors.password : ""}
                    label={t(tokens.auth.password)}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrorText("");
                    }}
                    required
                    type="password"
                    value={password}
                  />
                  {mode === "signUp" && (
                    <AppTextField
                      autoComplete="new-password"
                      error={hasSubmitted && Boolean(errors.passwordConfirmation)}
                      fullWidth
                      helperText={hasSubmitted ? errors.passwordConfirmation : ""}
                      label={t(tokens.auth.passwordConfirmation)}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        setErrorText("");
                      }}
                      required
                      type="password"
                      value={passwordConfirmation}
                    />
                  )}
                  <Button
                    disabled={isSubmitting || !isSupabaseConfigured || !isFormValid}
                    fullWidth
                    size="large"
                    startIcon={
                      mode === "signIn" ? <LoginOutlined /> : <PersonAddAltOutlined />
                    }
                    sx={{
                      minHeight: 48,
                      transition:
                        "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
                      "&:hover": {
                        boxShadow: "0 12px 26px rgba(37, 99, 235, 0.28)",
                        filter: "brightness(1.03)",
                        transform: "translateY(-2px)",
                      },
                      "&:active": {
                        transform: "translateY(0)",
                      },
                    }}
                    type="submit"
                    variant="contained"
                  >
                    {mode === "signIn"
                      ? t(tokens.auth.login)
                      : t(tokens.auth.createAccount)}
                  </Button>
                </Stack>
              </Box>

              <Divider sx={{ my: 3 }} />
              <Typography color="text.secondary" variant="body2">
                {t(tokens.auth.footer)}
              </Typography>
            </CardContent>
          </Card>
          </Box>
        </Container>
      </Box>
    </>
  );
}
