import Buttons from "@/components/ButtonComp";
import AppSettings from "@/misc/store/settingsstore";
import { Image, ImageBackground } from "expo-image";
import { Link, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, View } from "react-native";
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
  const router = useRouter()
  const { alreadyOpened,markOpened} = AppSettings()
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const onLayoutRootView = useCallback(async () => {
  
  }, []);
  useFocusEffect(()=>{
    if (alreadyOpened) { 
      router.replace('/aisetup')
     }
  })
  return (
    <View
    onLayout={onLayoutRootView}
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
                    router.replace("/aisetup")
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
