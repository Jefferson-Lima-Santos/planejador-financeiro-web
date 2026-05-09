import { InputAdornment, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material/TextField";
import { formatCurrencyInput } from "@/utils/money";

export function AppTextField(props: TextFieldProps) {
  const { InputLabelProps, InputProps, sx, type, ...other } = props;

  return (
    <TextField
      fullWidth
      type={type}
      InputLabelProps={{
        shrink: type === "date" ? true : InputLabelProps?.shrink,
        ...InputLabelProps,
      }}
      InputProps={{
        ...InputProps,
        sx: {
          bgcolor: "background.paper",
          borderRadius: 1,
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          "&:hover": {
            boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
          },
          ...InputProps?.sx,
        },
      }}
      sx={{
        "& .MuiInputBase-input": {
          fontWeight: 600,
        },
        "& .MuiInputBase-input::placeholder": {
          color: "text.disabled",
          opacity: 1,
        },
        "& .MuiFormHelperText-root": {
          mx: 0,
        },
        ...sx,
      }}
      {...other}
    />
  );
}

type MoneyTextFieldProps = Omit<TextFieldProps, "onChange" | "value"> & {
  onChange: (value: string) => void;
  value: string;
};

export function MoneyTextField({
  InputProps,
  inputProps,
  onChange,
  value,
  ...other
}: MoneyTextFieldProps) {
  return (
    <AppTextField
      InputProps={{
        startAdornment: <InputAdornment position="start">R$</InputAdornment>,
        ...InputProps,
      }}
      inputProps={{
        inputMode: "numeric",
        ...inputProps,
        "aria-label": other.label ? `${other.label} em reais` : "Valor em reais",
      }}
      onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
      placeholder="0,00"
      value={value}
      {...other}
    />
  );
}
