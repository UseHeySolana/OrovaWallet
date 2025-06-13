import AppSettings from "@/misc/store/settingsstore";
import Buttons from "@/components/ButtonComp";
import { Image, ImageBackground } from "expo-image";
// import { Link, router, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import WalletItem from "@/misc/store/wallet";
import UserItem from "@/misc/store/userstore";
import CText from "@/components/TextComp";
import { startUpdateFlow, UpdateFlow } from '@gurukumparan/react-native-android-inapp-updates';
import * as Updates from 'expo-updates';
import tracker from "@/misc/helpers/db/tracker";

const screens = [
  {
    title: "Control Your Wallet with Just Your Voice",
    subtitle: "Say 'Hey Solana' to send, trade, and manage crypto hands-free. Your most intuitive wallet is here.",
    image: require("@/assets/images/wallet.png")
  },
  {
    title: "Smarter Transactions with AI Insights",
    subtitle: "Optimize your portfolio with AI-driven insights and actions.",
    image: require("@/assets/smater.png")

  },
  {
    title: "Secure & Fast - Your Security, Our Priority",
    subtitle: `Experience top-notch security, with full control over permissions and privacy.`,
    image: require("@/assets/secure.png")

  }
]
const { width, height } = Dimensions.get('window');


export default function Index() {

  const { alreadyOpened, markOpened, openWithAuth } = AppSettings()
  const { publicKey } = WalletItem()
  const { user, session } = UserItem()
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };


  const getDestination = () => {

    // User is logged in
    if (!openWithAuth && publicKey !== null) {
      return '/dashboard';
    }

    //Go to verification if verification is enabled
    if (openWithAuth && !session) {
      return '/auth/login';
    }


    // // User has a wallet connected but needs to log in
    // if (alreadyOpened && user === null && publicKey !== null) {
    //   return '/auth/login';
    // }

    // User has opened the app before but needs to set username
    if (alreadyOpened) {
      return '/auth/username';
    }

    // Default case - no destination
    return null;
  };

  useEffect(() => {
    (async () => {
      const response = await tracker.app_open_count();
    })();
    // Delay navigation to make sure the layout is initialized
    const timeout = setTimeout(() => {
      const destination = getDestination();
      if (destination) {
        router.replace(destination);
      }
    }, 100); // Delay by 500ms, adjust if needed

    return () => clearTimeout(timeout); // Cleanup timeout on component unmount
  }, [alreadyOpened, publicKey, user]);


  useEffect(() => {
    const runComboUpdateFlow = async () => {
      try {
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
          console.log('error:', e);
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
      className="relative bg-white dark:bg-dark"
    >
      <View className="absolute top-10  z-50 flex-row self-center">
        {screens.map((_, index) => (
          <Pressable
            onPress={() => {
              scrollRef.current?.scrollTo({ x: width * index });
            }}
            key={index}
            className={`h-2 w-2 mx-1 rounded-3xl ${currentIndex === index ? 'bg-purple w-6' : 'bg-gray-400'}`}
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
        className=""
      >

        {screens.map((screen, index) => (

          <View key={index} style={{ width, height }} className="flex items-center justify-start gap-y-3 relative">


            <View className="relative top-0  h-full w-full">
              <Image
                source={screen.image}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                contentPosition="top center"
              />
            </View>

            <View className="items-center mt-5 absolute bottom-[15%] px-6">
              <CText className="text-[1.2rem]  text-center font-bold text-primary dark:text-white">{screen.title}</CText>
              <CText className="text-[0.8rem] mt-2 text-gray-600 dark:text-white text-center">{screen.subtitle}</CText>
            </View>

            <View className="px-3 w-full absolute h-fit bottom-10 left-0">
              <Buttons
                className=""
                text="Next"
                // textClass="text-[#000000]"
                onPress={() => {
                  if (currentIndex >= 2) {
                    markOpened();
                    router.replace('/auth/username')
                  }
                  scrollRef.current?.scrollTo({ x: width * (currentIndex + 1) });
                }}
              />
            </View>

          </View>

        ))}
      </ScrollView>
    </View>
  );
}

