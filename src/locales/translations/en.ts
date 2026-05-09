import { tokens } from "@/locales/tokens";

export const en = {
  [tokens.common.appName]: "Financial Planner",
  [tokens.common.cancel]: "Cancel",
  [tokens.common.dashboard]: "Dashboard",
  [tokens.common.languageChanged]: "Language changed",
  [tokens.common.loading]: "Loading",
  [tokens.common.save]: "Save",
  [tokens.layout.language]: "Language",
  [tokens.layout.logout]: "Sign out",
  [tokens.layout.monthlyControl]: "Monthly control",
  [tokens.auth.createAccount]: "Create account",
  [tokens.auth.email]: "Email",
  [tokens.auth.emailInvalid]: "Enter a valid email.",
  [tokens.auth.emailRequired]: "Enter your email.",
  [tokens.auth.footer]:
    "Your information stays protected and each account can only access its own financial data.",
  [tokens.auth.intro]: "Access your account to track months, themes and entries.",
  [tokens.auth.login]: "Sign in",
  [tokens.auth.name]: "Name",
  [tokens.auth.nameRequired]: "Enter your name.",
  [tokens.auth.password]: "Password",
  [tokens.auth.passwordMin]: "Password must have at least 6 characters.",
  [tokens.auth.passwordRequired]: "Enter your password.",
  [tokens.auth.signInSuccess]: "Signed in.",
  [tokens.auth.signUpSuccess]:
    "Account created. Check your email if confirmation is enabled.",
  [tokens.auth.subtitle]:
    "Organize real expenses by theme, browse months and keep an audit trail.",
  [tokens.auth.supabaseMissing]:
    "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
  [tokens.auth.title]: "Sign in to your plan",
  [tokens.auth.errors.invalidCredentials]:
    "Invalid email or password. Check your credentials and try again.",
  [tokens.auth.errors.generic]: "Could not authenticate.",
};
