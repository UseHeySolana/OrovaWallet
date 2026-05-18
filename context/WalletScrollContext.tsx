import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { RefObject } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";

const DEFAULT_COLLAPSE_RANGE = 88;

export type BalanceLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WalletScrollContextValue = {
  scrollY: SharedValue<number>;
  collapseRange: SharedValue<number>;
  sourceX: SharedValue<number>;
  sourceY: SharedValue<number>;
  sourceWidth: SharedValue<number>;
  sourceHeight: SharedValue<number>;
  sourceReady: SharedValue<number>;
  destX: SharedValue<number>;
  destY: SharedValue<number>;
  destWidth: SharedValue<number>;
  destHeight: SharedValue<number>;
  destReady: SharedValue<number>;
  overlayRootRef: RefObject<View | null>;
  setSourceLayout: (layout: BalanceLayout) => void;
  setDestLayout: (layout: BalanceLayout) => void;
  resetScroll: () => void;
};

const WalletScrollContext = createContext<WalletScrollContextValue | null>(
  null
);

export function WalletScrollProvider({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  const overlayRootRef = useRef<View | null>(null);
  const scrollY = useSharedValue(0);
  const collapseRange = useSharedValue(DEFAULT_COLLAPSE_RANGE);

  const sourceX = useSharedValue(0);
  const sourceY = useSharedValue(0);
  const sourceWidth = useSharedValue(0);
  const sourceHeight = useSharedValue(0);
  const sourceReady = useSharedValue(0);

  const destX = useSharedValue(0);
  const destY = useSharedValue(0);
  const destWidth = useSharedValue(0);
  const destHeight = useSharedValue(0);
  const destReady = useSharedValue(0);

  const setSourceLayout = useCallback(
    ({ x, y, width, height }: BalanceLayout) => {
      sourceX.value = x;
      sourceY.value = y;
      sourceWidth.value = width;
      sourceHeight.value = height;
      sourceReady.value = 1;
    },
    [sourceX, sourceY, sourceWidth, sourceHeight, sourceReady]
  );

  const setDestLayout = useCallback(
    ({ x, y, width, height }: BalanceLayout) => {
      destX.value = x;
      destY.value = y;
      destWidth.value = width;
      destHeight.value = height;
      destReady.value = 1;
    },
    [destX, destY, destWidth, destHeight, destReady]
  );

  const resetScroll = useCallback(() => {
    scrollY.value = 0;
  }, [scrollY]);

  useEffect(() => {
    if (!active) {
      scrollY.value = 0;
    }
  }, [active, scrollY]);

  const value = useMemo(
    () => ({
      scrollY,
      collapseRange,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      sourceReady,
      destX,
      destY,
      destWidth,
      destHeight,
      destReady,
      overlayRootRef,
      setSourceLayout,
      setDestLayout,
      resetScroll,
    }),
    [
      scrollY,
      collapseRange,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      sourceReady,
      destX,
      destY,
      destWidth,
      destHeight,
      destReady,
      setSourceLayout,
      setDestLayout,
      resetScroll,
    ]
  );

  return (
    <WalletScrollContext.Provider value={value}>
      {children}
    </WalletScrollContext.Provider>
  );
}

export function useWalletScroll() {
  const ctx = useContext(WalletScrollContext);
  if (!ctx) {
    throw new Error("useWalletScroll must be used within WalletScrollProvider");
  }
  return ctx;
}
