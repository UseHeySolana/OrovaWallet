import type { Theme } from "react-native-otp-entry";
import { isTablet, tabletSize } from "@/utils/layout/tablet";

const pad = isTablet();
const digitSize = tabletSize(pad ? 52 : 48);
const digitGap = tabletSize(pad ? 12 : 10);

/**
 * Fixed digit boxes instead of space-between across the sheet width.
 * On iPad the library default stretches 4–6 cells across ~500pt+.
 */
export const compactOtpInputTheme: Theme = {
  containerStyle: {
    width: "auto",
    gap: digitGap,
    alignSelf: "center",
    justifyContent: "center",
  },
  pinCodeContainerStyle: {
    width: digitSize,
    height: digitSize,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  focusedPinCodeContainerStyle: {
    borderWidth: 2,
  },
  pinCodeTextStyle: {
    fontSize: tabletSize(18),
    fontFamily: "bold",
  },
};
