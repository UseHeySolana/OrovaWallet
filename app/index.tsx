import AppSettings from "@/misc/store/settingsstore";
import Buttons from "@/components/ButtonComp";
import { Image, ImageBackground } from "expo-image";
// import { Link, router, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import WalletItem from "@/misc/store/wallet";
import UserItem from "@/misc/store/userstore";


Buttons
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


export default function Home() {

  const { alreadyOpened, markOpened, skippedAiSettings, createdWallet } = AppSettings()
  const { publicKey } = WalletItem()
  const { user } = UserItem()
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const getDestination = () => {
    // User is logged in
    if (publicKey !== null && user !== null) {
      return '/dashboard';
    }

    // User has a wallet connected but needs to log in
    if (alreadyOpened && user === null && publicKey !== null) {
      return '/auth/login';
    }

    // User has opened the app before but needs to set username
    if (alreadyOpened) {
      return '/auth/username';
    }

    // Default case - no destination
    return null;
  };

  useEffect(() => {
    console.log(user)
    console.log(publicKey)
    // Delay navigation to make sure the layout is initialized
    const timeout = setTimeout(() => {
      const destination = getDestination();
      if (destination) {
        router.replace(destination);
      }
    }, 500); // Delay by 500ms, adjust if needed

    return () => clearTimeout(timeout); // Cleanup timeout on component unmount
  }, [alreadyOpened, publicKey, user]);



  return (
    <View
      // onLayout={onLayoutRootView}
      className="relative"
    >
      <View className="absolute top-10  z-50 flex-row self-center">
        {screens.map((_, index) => (
          <Pressable
            onPress={() => {
              /**
               * if current index is 1
               */
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
            <View className="h-[72%] relative top-0   w-full">
              <Image
                source={screen.image}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            </View>

            <View className="items-center mt-5 px-6">
              <Text className="text-3xl  text-center font-bold text-primary">{screen.title}</Text>
              <Text className="text-lg mt-2 text-gray-600 text-center">{screen.subtitle}</Text>
            </View>

            <View className="px-3 w-full absolute h-fit bottom-12 left-0">
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
      {/* Pagination Dots */}


    </View>
  );
}

