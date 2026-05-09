import { FormEvent, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AccountBalanceWalletOutlined,
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
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { isSupabaseConfigured } from "@/config";
import { useAuth } from "@/contexts/auth-context";

type AuthMode = "signIn" | "signUp";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = useMemo(() => {
    const value = router.query.returnTo;
    return typeof value === "string" ? value : "/dashboard";
  }, [router.query.returnTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "signUp") {
        await signUp(email, password, name);
        toast.success("Cadastro criado. Confira seu e-mail se a confirmacao estiver ativa.");
      } else {
        await signIn(email, password);
        toast.success("Entrada realizada.");
      }

      router.replace(returnTo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel autenticar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Entrar | Planejador Financeiro</title>
      </Head>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          minHeight: "100vh",
          py: 6,
        }}
      >
        <Container maxWidth="sm">
          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
              <Stack alignItems="center" spacing={2.5}>
                <Avatar sx={{ bgcolor: "primary.main", height: 56, width: 56 }}>
                  <AccountBalanceWalletOutlined />
                </Avatar>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h1">Planejador Financeiro</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Acesse sua conta para acompanhar meses, temas e lancamentos.
                  </Typography>
                </Box>
              </Stack>

              <Tabs
                centered
                onChange={(_event, value: AuthMode) => setMode(value)}
                sx={{ mt: 4 }}
                value={mode}
              >
                <Tab label="Entrar" value="signIn" />
                <Tab label="Cadastrar" value="signUp" />
              </Tabs>

              {!isSupabaseConfigured && (
                <Alert severity="warning" sx={{ mt: 3 }}>
                  Configure `NEXT_PUBLIC_SUPABASE_URL` e
                  `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`.
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                <Stack spacing={2.5}>
                  {mode === "signUp" && (
                    <TextField
                      autoComplete="name"
                      fullWidth
                      label="Nome"
                      onChange={(event) => setName(event.target.value)}
                      required
                      value={name}
                    />
                  )}
                  <TextField
                    autoComplete="email"
                    fullWidth
                    label="E-mail"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                  <TextField
                    autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                    fullWidth
                    label="Senha"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                  <Button
                    disabled={isSubmitting || !isSupabaseConfigured}
                    fullWidth
                    size="large"
                    startIcon={
                      mode === "signIn" ? <LoginOutlined /> : <PersonAddAltOutlined />
                    }
                    type="submit"
                    variant="contained"
                  >
                    {mode === "signIn" ? "Entrar" : "Criar conta"}
                  </Button>
                </Stack>
              </Box>

              <Divider sx={{ my: 3 }} />
              <Typography color="text.secondary" variant="body2">
                A autenticacao usa Supabase Auth. Os dados financeiros ficam
                ligados ao `auth.users.id` com regras RLS por usuario.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  );
}
