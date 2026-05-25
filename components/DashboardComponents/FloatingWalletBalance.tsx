import { StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

import CText, { CNumber } from "@/components/TextComp";
import { useWalletScroll } from "@/context/WalletScrollContext";
import UserItem from "@/utils/store/userstore.store";

type FloatingWalletBalanceProps = {
  showWallet: boolean;
  balancesHidden: boolean;
};

export default function FloatingWalletBalance({
  showWallet,
  balancesHidden,
}: FloatingWalletBalanceProps) {
  const { userWallet } = UserItem();
  const {
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
  } = useWalletScroll();

  const balance = Number(userWallet?.totalUsdBalance?.toFixed(2) ?? 0);

  const flightStyle = useAnimatedStyle(() => {
    if (!showWallet || sourceReady.value < 1 || destReady.value < 1) {
      return styles.hidden;
    }

    const range = Math.max(collapseRange.value, 1);
    const progress = interpolate(
      scrollY.value,
      [0, range],
      [0, 1],
      Extrapolation.CLAMP
    );

    if (progress <= 0.04 || progress >= 0.88) {
      return styles.hidden;
    }

    const srcLeft = sourceX.value;
    const srcTop = sourceY.value - scrollY.value;
    const dstLeft = destX.value;
    const dstTop = destY.value;

    const leftTL = srcLeft + (dstLeft - srcLeft) * progress;
    const topTL = srcTop + (dstTop - srcTop) * progress;

    const scale =
      sourceWidth.value > 0
        ? (sourceWidth.value +
            (destWidth.value - sourceWidth.value) * progress) /
          sourceWidth.value
        : 1 + (0.34 - 1) * progress;

    const scaledW = sourceWidth.value * scale;
    const scaledH = sourceHeight.value * scale;

    return {
      position: "absolute",
      left: leftTL - (sourceWidth.value - scaledW) / 2,
      top: topTL - (sourceHeight.value - scaledH) / 2,
      width: sourceWidth.value,
      opacity: 1,
      transform: [{ scale }],
      zIndex: 200,
    };
  }, [showWallet]);

  return (
    <Animated.View pointerEvents="none" style={[flightStyle, styles.row]}>
      {balancesHidden ? (
        <CText
          className="text-[45px] text-dark dark:text-white"
          style={{ fontFamily: "bold" }}
        >
          ****
        </CText>
      ) : (
        <>
          <CText className="text-[45px] text-dark dark:text-white">$</CText>
          <CNumber
            value={balance}
            className="text-[45px]"
            style={{ fontFamily: "bold" }}
          />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
    position: "absolute",
    left: -9999,
    top: -9999,
    zIndex: -1,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
});
