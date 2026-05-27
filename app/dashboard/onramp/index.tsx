import { Pressable, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";

export default function Onramp() {
  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark flex-1 items-start justify-start gap-y-4">
      <View className="w-full flex flex-row justify-start">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>

      <View className="w-full flex-1 items-center justify-center">
        <View className="w-full bg-white dark:bg-accent rounded-3xl p-6 items-center gap-y-4 shadow-sm">
          <View className="h-16 w-16 rounded-full bg-purple items-center justify-center">
            <Ionicons name="card-outline" size={30} color="white" />
          </View>
          <View className="items-center gap-y-2">
            <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">
              Onramp
            </CText>
            <CText className="text-[1.05rem] text-center text-black/70 dark:text-grey/70">
              Buy crypto with fiat. This screen is ready for the onramp flow
              design.
            </CText>
          </View>
        </View>
      </View>
    </View>
  );
}
