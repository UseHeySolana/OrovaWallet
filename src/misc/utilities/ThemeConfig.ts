
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

const ThemeConfig = {
  prColor: "#192259",
  secColor: "#ff2e63",
  secColorBold: "#922c78",
  SPACING: 16,
  isDarkMode: false,
  screenWidth: width,
  screenHeight: height,
  clrWht: "#fff",
  mutedColor: "#888",
  mutedColor_xs: "#EDEDED",
  mutedColor_md: "#686868",
  mutedDrkColor: "#4E4D4D",
  textMuted: "#4E4D4D",
  textMutedxs: "#505050",
  iconMutedColor: "#A39C98",
  iconMutedColor_lg: "#7D7D7D",
  iconMutedDrkColor: "#696767",
  textDrkColor: "#311C0C",
  prColorText: "#fff",
  prLightColor: "#FEF2E9",
};

export default ThemeConfig;
