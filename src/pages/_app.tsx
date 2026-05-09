import "@/styles/globals.css";
import "@/locales/i18n";
import type { AppProps } from "next/app";
import Head from "next/head";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/auth-context";
import { theme } from "@/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          <Head>
            <title>Planejador Financeiro</title>
            <meta
              name="description"
              content="Controle financeiro mensal com Supabase Auth"
            />
            <meta
              name="viewport"
              content="initial-scale=1, width=device-width"
            />
          </Head>
          <CssBaseline />
          <Component {...pageProps} />
          <Toaster position="top-right" />
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
