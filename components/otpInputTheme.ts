import type { Theme } from "react-native-otp-entry";

/** Tighter digit spacing — the library defaults to full width with space-between. */
export const compactOtpInputTheme: Theme = {
  containerStyle: {
    width: "auto",
    gap: 10,
    alignSelf: "center",
  },
};
