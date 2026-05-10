import { ReactNode } from "react";
import { Box } from "@mui/material";

type AnimatedMonthSectionProps = {
  animationSx: object;
  children: ReactNode;
  sectionKey: string;
};

export const AnimatedMonthSection = ({
  animationSx,
  children,
  sectionKey,
}: AnimatedMonthSectionProps) => {
  return (
    <Box key={sectionKey} sx={animationSx}>
      {children}
    </Box>
  );
};
