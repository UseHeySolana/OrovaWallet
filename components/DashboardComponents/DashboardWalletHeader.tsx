import { useCallback, useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";

import CText, { CNumber } from "@/components/TextComp";
import { useWalletScroll } from "@/context/WalletScrollContext";
import UserItem from "@/utils/store/userstore.store";
import { measureInOverlay } from "@/utils/measureInOverlay";

type DashboardWalletHeaderProps = {
  showWallet: boolean;
  balancesHidden: boolean;
  isDarkMode: boolean;
  onBalancePress: () => void;
};

export default function DashboardWalletHeader({
  showWallet,
  balancesHidden,
  isDarkMode,
  onBalancePress,
}: DashboardWalletHeaderProps) {
  const { user, userWallet } = UserItem();
  const { scrollY, collapseRange, overlayRootRef, setDestLayout } =
    useWalletScroll();
  const destMeasureRef = useRef<View>(null);

  const balance = Number(userWallet?.totalUsdBalance?.toFixed(2) ?? 0);

  const measureDest = useCallback(() => {
    measureInOverlay(destMeasureRef, overlayRootRef, setDestLayout);
  }, [overlayRootRef, setDestLayout]);

  useEffect(() => {
    const id = requestAnimationFrame(() => measureDest());
    return () => cancelAnimationFrame(id);
  }, [measureDest, balance, showWallet, balancesHidden]);

  const headerBalanceStyle = useAnimatedStyle(() => {
    if (!showWallet) {
      return { opacity: 1 };
    }

    const range = Math.max(collapseRange.value, 1);
    const progress = interpolate(
      scrollY.value,
      [0, range],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: interpolate(progress, [0.88, 1], [0, 1], Extrapolation.CLAMP),
    };
  }, [showWallet]);

  return (
    <View className="flex flex-row justify-between items-center">
      <View className="flex-1 flex-row items-center gap-x-2 min-w-0 mr-2">
        <TouchableOpacity
          onPress={() => router.push("/dashboard/account")}
          activeOpacity={0.8}
          className="bg-white dark:bg-accent p-3 rounded-3xl flex flex-row items-center gap-x-1 shrink"
        >
          <View className="h-6 w-6 rounded-full overflow-hidden">
            {user?.profileImageUri ? (
              <Image
                source={{ uri: user.profileImageUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Image
                source={require("@/assets/images/ballicon.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            )}
          </View>
          <CText
            style={{ fontFamily: "md" }}
            className="text-dark dark:text-white"
            numberOfLines={1}
          >
            @{user?.username}
          </CText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBalancePress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Show wallet"
        >
          <View
            ref={destMeasureRef}
            onLayout={measureDest}
            collapsable={false}
            pointerEvents="none"
            className="shrink"
          >
            <Animated.View
              style={headerBalanceStyle}
              className="flex-row items-baseline"
            >
              {balancesHidden ? (
                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[0.95rem] text-dark dark:text-white"
                >
                  ****
                </CText>
              ) : (
                <>
                  <CText
                    style={{ fontFamily: "bold" }}
                    className="text-[0.95rem] text-dark dark:text-white"
                  >
                    $
                  </CText>
                  <CNumber
                    value={balance}
                    className="text-[0.95rem]"
                    style={{ fontFamily: "bold" }}
                  />
                </>
              )}
            </Animated.View>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/settings")}
        className="p-3 rounded-full bg-white dark:bg-accent"
      >
        <Feather
          name="settings"
          size={16}
          color={isDarkMode ? "white" : "black"}
        />
      </TouchableOpacity>
    </View>
  );
}
