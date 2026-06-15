import { alpha, createTheme } from "@mui/material/styles";
import type { ThemeMode } from "@/state/atoms/settings";

export const buildTheme = (mode: ThemeMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: "#2563eb",
        dark: "#1d4ed8",
        light: "#60a5fa",
      },
      secondary: {
        main: "#0f766e",
        light: "#2dd4bf",
      },
      success: {
        main: "#16a34a",
      },
      warning: {
        main: "#d97706",
      },
      error: {
        main: "#dc2626",
      },
      background:
        mode === "dark"
          ? {
              default: "#07111f",
              paper: "#0f1b2d",
            }
          : {
              default: "#f6f7f9",
              paper: "#ffffff",
            },
      text:
        mode === "dark"
          ? {
              primary: "#f8fafc",
              secondary: "#94a3b8",
            }
          : undefined,
      divider: mode === "dark" ? "rgba(148, 163, 184, 0.16)" : undefined,
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: {
        fontSize: "2rem",
        fontWeight: 700,
        letterSpacing: 0,
      },
      h2: {
        fontSize: "1.5rem",
        fontWeight: 700,
        letterSpacing: 0,
      },
      h3: {
        fontSize: "1.25rem",
        fontWeight: 700,
        letterSpacing: 0,
      },
      button: {
        fontWeight: 700,
        textTransform: "none",
        letterSpacing: 0,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background:
              mode === "dark"
                ? "radial-gradient(circle at top, rgba(37, 99, 235, 0.16), transparent 32%), #07111f"
                : "#f6f7f9",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backdropFilter: "blur(16px)",
            backgroundColor:
              mode === "dark"
                ? alpha("#07111f", 0.82)
                : alpha("#ffffff", 0.88),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow:
              mode === "dark"
                ? "0 22px 54px rgba(2, 6, 23, 0.36)"
                : "0 1px 2px rgba(15, 23, 42, 0.06)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
    },
  });
