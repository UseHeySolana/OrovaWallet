import { Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";

const options = [
  {
    title: "Airtime",
    description: "Top up any number",
    icon: "phone-portrait-outline" as const,
    route: "/dashboard/airbills/airtime",
  },
  {
    title: "Mobile Data",
    description: "Browse data bundles",
    icon: "cellular-outline" as const,
    route: "/dashboard/airbills/data",
  },
];

export default function AirbillsHubScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 12) / 2;

  return (
    <View className="relative flex-1 bg-grey px-4 pt-3 dark:bg-dark">
      <View className="mb-6 flex-row items-center gap-x-3">
        <Pressable
          onPress={() => router.back()}
          className="rounded-full bg-white p-3 dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
          Airbills
        </CText>
      </View>

      <View className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-accent">
        <Image
          source={require("@/assets/apps/airbillsbg.jpeg")}
          style={{ width: "100%", height: 120 }}
          contentFit="cover"
        />
        <View className="flex-row items-center gap-x-3 px-4 py-3">
          <View className="h-12 w-12 overflow-hidden rounded-2xl">
            <Image
              source={require("@/assets/apps/airbillslogo.jpg")}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
          <View className="flex-1">
            <CText style={{ fontFamily: "bold" }} className="text-[1.05rem]">
              Bills & top-ups
            </CText>
            <CText className="text-[0.88rem] text-black/60 dark:text-grey/70">
              Airtime, mobile data, and more
            </CText>
          </View>
        </View>
      </View>

      <CText style={{ fontFamily: "bold" }} className="mb-3 text-[1.05rem]">
        Choose a service
      </CText>

      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {options.map((option) => (
          <Pressable
            key={option.route}
            onPress={() => router.push(option.route as any)}
            style={{ width: cardWidth }}
            className="min-h-[148px] items-center justify-center rounded-2xl bg-white px-3 py-5 shadow-sm dark:bg-accent"
          >
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-purple/10">
              <Ionicons name={option.icon} size={26} color="#971BB2" />
            </View>
            <CText
              style={{ fontFamily: "bold" }}
              className="w-full text-center text-[1.05rem]"
            >
              {option.title}
            </CText>
            <CText className="mt-1 w-full text-center text-[0.82rem] text-black/55 dark:text-grey/60">
              {option.description}
            </CText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
