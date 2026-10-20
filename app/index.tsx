import AppSettings from "@/utils/store/settingsstore.store";
import Buttons from "@/components/ButtonComp";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import { CText } from "@/components/TextComp";
import {
  startUpdateFlow,
  UpdateFlow,
} from "@gurukumparan/react-native-android-inapp-updates";
import * as Updates from "expo-updates";
import tracker from "@/utils/tracker";
import { initWallet } from "@/utils/wallet/initWallet";
import { AppLoadingOverlay } from "@/components/skeletons";

const screens = [
  {
    title: "Control Your Wallet with Just Your Voice",
    subtitle:
      "Say 'Hey Solana' to send, trade, and manage crypto hands-free. Your most intuitive wallet is here.",
    image: require("@/assets/images/wallet.png"),
  },
  {
    title: "Smarter Transactions with AI Insights",
    subtitle: "Optimize your portfolio with AI-driven insights and actions.",
    image: require("@/assets/smater.png"),
  },
  {
    title: "Secure & Fast - Your Security, Our Priority",
    subtitle:
      "Experience top-notch security, with full control over permissions and privacy.",
    image: require("@/assets/secure.png"),
  },
];

/** Read stores after `initWallet()` — avoids stale hook values in the same tick as hydration. */
function getPostWalletInitDestination(walletHydrated: boolean): string | null {
  const { openWithAuth, pin, alreadyOpened } = AppSettings.getState();
  const { publicKey } = WalletItem.getState();
  const { session } = UserItem.getState();

  if (!openWithAuth && walletHydrated && publicKey !== null) {
    return "/dashboard";
  }

  if ((openWithAuth && !session) || pin.length >= 4) {
    return "/auth/login";
  }

  if (alreadyOpened) {
    return "/auth/register";
  }

  return null;
}

async function runComboUpdateFlow() {
  try {
    if (process.env.EXPO_PUBLIC_ENV !== "production") {
      return;
    }

    const otaUpdate = await Updates.checkForUpdateAsync();
    if (otaUpdate.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return;
    }

    try {
      await startUpdateFlow(UpdateFlow.FLEXIBLE);
    } catch (e) {
      console.log("error:", e);
    }
  } catch (err) {
    console.warn("Update flow error", err);
  }
}

export default function Index() {
  const { markOpened } = AppSettings();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isPad = Platform.OS === "ios" && Platform.isPad;
  const copyMaxWidth = Math.min(width - 48, isPad ? 640 : width);
  const bottomPad = Math.max(insets.bottom, 16) + (isPad ? 48 : 8);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await tracker.app_open_count();
      } catch {
        // ignore
      }

      try {
        const [{ hydrated }] = await Promise.all([
          initWallet(),
          runComboUpdateFlow(),
        ]);
        if (!cancelled) {
          const destination = getPostWalletInitDestination(hydrated);
          if (destination) {
            router.replace(destination as any);
          } else {
            setIsBootstrapping(false);
          }
        }
      } catch {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isBootstrapping) {
    return (
      <View className="relative flex-1 bg-white dark:bg-dark">
        <AppLoadingOverlay />
      </View>
    );
  }

  return (
    <View className="relative flex-1 bg-white dark:bg-dark">
      <View
        className="absolute z-50 flex-row self-center"
        style={{ top: Math.max(insets.top, 16) + 8 }}
      >
        {screens.map((_, index) => (
          <Pressable
            onPress={() => {
              scrollRef.current?.scrollTo({ x: width * index });
            }}
            key={index}
            className={`h-2 w-2 mx-1 rounded-3xl ${currentIndex === index ? "bg-purple w-6" : "bg-gray-400"
              }`}
          />
        ))}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {screens.map((screen, index) => (
          <View
            key={index}
            style={{ width, height }}
            className="flex-1 bg-white dark:bg-dark"
          >
            <Image
              source={screen.image}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width,
                height,
              }}
              contentFit="cover"
              contentPosition="top center"
            />

            <View
              className="flex-1 justify-end items-center px-6"
              style={{ paddingBottom: bottomPad }}
            >
              <View
                className="items-center w-full mb-6"
                style={{ maxWidth: copyMaxWidth }}
              >
                  <CText
                    style={{ fontFamily: "bold" }}
                    className={`${
                      isPad
                        ? "text-[2.25rem] leading-[2.75rem]"
                        : "text-[1.5rem] leading-8"
                    } text-center text-primary dark:text-white`}
                  >
                    {screen.title}
                  </CText>
                  <CText
                    className={`${
                      isPad
                        ? "text-[1.25rem] leading-8"
                        : "text-[1.0625rem] leading-6"
                    } mt-3 text-center text-black/80 dark:text-white/85`}
                  >
                    {screen.subtitle}
                  </CText>
              </View>
              <View className="w-full" style={{ maxWidth: copyMaxWidth }}>
                <Buttons
                  text="Next"
                  onPress={() => {
                    if (currentIndex >= 2) {
                      markOpened();
                      router.replace("/auth/register");
                      return;
                    }
                    scrollRef.current?.scrollTo({
                      x: width * (currentIndex + 1),
                    });
                  }}
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
