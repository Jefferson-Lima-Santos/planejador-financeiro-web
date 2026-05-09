import { useCallback, useState } from "react";
import { Box, IconButton, MenuItem, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import toast from "react-hot-toast";
import { tokens } from "@/locales/tokens";
import { languageAtom, type Language } from "@/state/atoms/settings";

const languageOptions: Record<Language, { flag: string; label: string; htmlLang: string }> = {
  ptBR: {
    flag: "/assets/flags/pt_BR.svg",
    htmlLang: "pt-BR",
    label: "Português (Brasil)",
  },
  en: {
    flag: "/assets/flags/en_US.svg",
    htmlLang: "en",
    label: "English",
  },
};

export function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [savedLanguage, setSavedLanguage] = useRecoilState(languageAtom);
  const currentLanguage = (i18n.language in languageOptions
    ? i18n.language
    : savedLanguage) as Language;
  const currentOption = languageOptions[currentLanguage];

  const handleChange = useCallback(
    async (language: Language) => {
      await i18n.changeLanguage(language);
      localStorage.setItem("language", language);
      setSavedLanguage(language);
      document.documentElement.lang = languageOptions[language].htmlLang;
      setAnchorEl(null);
      toast.success(t(tokens.common.languageChanged));
    },
    [i18n, setSavedLanguage, t]
  );

  return (
    <>
      <Tooltip title={t(tokens.layout.language)}>
        <IconButton
          aria-label={t(tokens.layout.language)}
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
          <Box
            alt={currentOption.label}
            component="img"
            src={currentOption.flag}
            sx={{
              borderRadius: "50%",
              height: { xs: 22, sm: 24 },
              width: { xs: 22, sm: 24 },
            }}
          />
        </IconButton>
      </Tooltip>
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        onClose={() => setAnchorEl(null)}
        open={Boolean(anchorEl)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <Box sx={{ py: 1, width: 230 }}>
          {(Object.keys(languageOptions) as Language[]).map((language) => {
            const option = languageOptions[language];

            return (
              <MenuItem key={language} onClick={() => handleChange(language)}>
                <Stack alignItems="center" direction="row" spacing={1.5}>
                  <Box
                    alt={option.label}
                    component="img"
                    src={option.flag}
                    sx={{ borderRadius: "50%", height: 24, width: 24 }}
                  />
                  <Typography variant="body2">{option.label}</Typography>
                </Stack>
              </MenuItem>
            );
          })}
        </Box>
      </Popover>
    </>
  );
}
