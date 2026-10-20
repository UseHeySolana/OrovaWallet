import { scale as sizeMattersScale } from "react-native-size-matters";
import { isTablet, tabletSize } from "@/utils/layout/tablet";

/**
 * Phone layouts use size-matters. On iPad we apply a fixed boost so
 * controls and type grow together without phone-letterboxing.
 */
export function scale(size: number): number {
  if (isTablet()) {
    return tabletSize(size);
  }
  return sizeMattersScale(size);
}
