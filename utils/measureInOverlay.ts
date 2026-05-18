import type { RefObject } from "react";
import type { View } from "react-native";

import type { BalanceLayout } from "@/context/WalletScrollContext";

export function measureInOverlay(
  targetRef: RefObject<View | null>,
  overlayRef: RefObject<View | null>,
  onMeasured: (layout: BalanceLayout) => void
) {
  const target = targetRef.current;
  const overlay = overlayRef.current;
  if (!target || !overlay) return;

  target.measureLayout(
    overlay,
    (x, y, width, height) => {
      if (width > 0 && height > 0) {
        onMeasured({ x, y, width, height });
      }
    },
    () => {}
  );
}
