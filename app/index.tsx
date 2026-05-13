import AppSettings from "@/utils/store/settingsstore.store";
import Buttons from "@/components/ButtonComp";
import { Image, ImageBackground } from "expo-image";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from "react-native";
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
    subtitle: `Experience top-notch security, with full control over permissions and privacy.`,
    image: require("@/assets/secure.png"),
  },
];
const { width, height } = Dimensions.get("window");

/** Read stores after `initWallet()` — avoids stale hook values in the same tick as hydration. */
function getPostWalletInitDestination(): string | null {
  const { openWithAuth, pin, alreadyOpened } = AppSettings.getState();
  const { publicKey } = WalletItem.getState();
  const { session } = UserItem.getState();

  if (!openWithAuth && publicKey !== null) {
    return "/dashboard";
  }

  if ((openWithAuth && !session) || pin.length >= 4) {
    return "/auth/login";
  }

  if (alreadyOpened) {
    return "/auth/username";
  }

  return null;
}

export default function Index() {
  const { markOpened, setLoading } = AppSettings();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        await tracker.app_open_count();
      } catch {
        // ignore
      }

      setLoading(true);

      try {
        await initWallet();
      } catch {
        // ignore
      }

      timeout = setTimeout(() => {
        if (cancelled) return;
        const destination = getPostWalletInitDestination();
        if (destination) {
          router.replace(destination);
        }
        setLoading(false);
      }, 75);
    })();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [setLoading]);

  useEffect(() => {
    const runComboUpdateFlow = async () => {
      try {
        if (process.env.EXPO_PUBLIC_ENV === "production") {
          // 1. Try OTA update
          const otaUpdate = await Updates.checkForUpdateAsync();
          if (otaUpdate.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return;
          }

          // 2. If no OTA, check Play Store update
          try {
            const result = await startUpdateFlow(UpdateFlow.FLEXIBLE);
          } catch (e) {
            console.log("error:", e);
          }
        }
      } catch (err) {
        console.warn("Update flow error", err);
      }
    };

    runComboUpdateFlow();
  }, []);

  return (
    <View
      // onLayout={onLayoutRootView}
      className="relative flex-1 bg-white dark:bg-dark"
    >
      <View className="absolute top-10  z-50 flex-row self-center">
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
        contentContainerStyle={{ justifyContent: 'flex-end', alignItems: 'center' }}
      >
        {screens.map((screen, index) => (
          <ImageBackground
            source={screen.image}
            contentFit="contain"
            contentPosition="top center"
            key={index}
            style={{ width, height }}
            className="flex-1 items-center justify-end h-screen gap-y-3 relative"
          >
            <View
              className={`px-3 absolute bottom-20 h-[100%]"
                } left-0`}
            >
              <View
                className={`items-center mt-5 mb-5 flex-1 px-6`}
              >
                <CText className="text-[1.2rem]  text-center font-bold text-primary dark:text-white">
                  {screen.title}
                </CText>
                <CText className="text-[0.8rem] mt-2 text-gray-600 dark:text-white text-center">
                  {screen.subtitle}
                </CText>
              </View>
              <Buttons
                className=""
                text="Next"
                onPress={() => {
                  if (currentIndex >= 2) {
                    markOpened();
                    router.replace("/auth/username");
                  }
                  scrollRef.current?.scrollTo({
                    x: width * (currentIndex + 1),
                  });
                }}
              />
            </View>
          </ImageBackground>
        ))}
      </ScrollView>
    </View>
  );
}
