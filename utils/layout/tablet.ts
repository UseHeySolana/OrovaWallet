import { Dimensions, Platform } from "react-native";

/** Moderate boost so phone-sized type/icons read correctly on iPad. */
export const TABLET_SCALE = 1.22;

export function isTablet(): boolean {
  if (Platform.OS === "ios" && Platform.isPad) {
    return true;
  }
  const { width, height } = Dimensions.get("window");
  return Math.min(width, height) >= 768;
}

export function tabletSize(size: number): number {
  if (!isTablet()) return size;
  return Math.round(size * TABLET_SCALE);
}
