import { useCallback, useState } from "react";
import {
  Box,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DarkModeOutlined, LightModeOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { tokens } from "@/locales/tokens";
import { themeModeAtom, type ThemeMode } from "@/state/atoms/settings";

const themeOptions: Record<
  ThemeMode,
  {
    icon: typeof LightModeOutlined;
    labelToken: string;
  }
> = {
  dark: {
    icon: DarkModeOutlined,
    labelToken: tokens.layout.themeDark,
  },
  light: {
    icon: LightModeOutlined,
    labelToken: tokens.layout.themeLight,
  },
};

export function ThemeSwitch() {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [themeMode, setThemeMode] = useRecoilState(themeModeAtom);
  const CurrentIcon = themeOptions[themeMode].icon;

  const handleChange = useCallback(
    (mode: ThemeMode) => {
      localStorage.setItem("themeMode", mode);
      setThemeMode(mode);
      setAnchorEl(null);
      toast.success(t(tokens.common.themeChanged));
    },
    [setThemeMode, t]
  );

  return (
    <>
      <Tooltip title={t(tokens.layout.theme)}>
        <IconButton
          aria-label={t(tokens.layout.theme)}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            height: { xs: 38, sm: 40 },
            width: { xs: 38, sm: 40 },
            transition: "transform 160ms ease, box-shadow 160ms ease",
            "&:hover": {
              boxShadow: "0 10px 20px rgba(15, 23, 42, 0.14)",
              transform: "translateY(-1px)",
            },
          }}
        >
          <CurrentIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        onClose={() => setAnchorEl(null)}
        open={Boolean(anchorEl)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <Box sx={{ py: 1, width: 220 }}>
          {(Object.keys(themeOptions) as ThemeMode[]).map((mode) => {
            const option = themeOptions[mode];
            const OptionIcon = option.icon;

            return (
              <MenuItem key={mode} onClick={() => handleChange(mode)}>
                <Stack alignItems="center" direction="row" spacing={1.5}>
                  <OptionIcon fontSize="small" />
                  <Typography variant="body2">{t(option.labelToken)}</Typography>
                </Stack>
              </MenuItem>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
