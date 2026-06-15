import "@/styles/globals.css";
import "@/locales/i18n";
import type { AppProps } from "next/app";
import Head from "next/head";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Toaster } from "react-hot-toast";
import { RecoilRoot } from "recoil";
import { AppThemeProvider } from "@/components/app-theme-provider";
import { AuthProvider } from "@/contexts/auth-context";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <RecoilRoot>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          <AppThemeProvider>
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
            <Component {...pageProps} />
            <Toaster position="top-right" />
          </AppThemeProvider>
        </AuthProvider>
      </LocalizationProvider>
    </RecoilRoot>
  );
}
