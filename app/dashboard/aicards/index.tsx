import { useMemo } from "react";
import { Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import BrainStore from "@/utils/store/brain.store";
import { useThemeContext } from "@/context/ThemeContext";
import { buildHelperCards } from "@/utils/walletHelperCards";

export default function AiCardsScreen() {
  const { suggestions } = BrainStore();
  const { isDarkMode } = useThemeContext();

  const helperCards = useMemo(
    () => buildHelperCards(suggestions),
    [suggestions]
  );

  const hasSuggestions = suggestions.length > 0;

  return (
    <View className="relative w-full bg-grey pt-4 dark:bg-dark flex-1">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.4rem]">
          AI cards
        </CText>
      </View>

      <CText className="px-4 pt-2 pb-4 text-[0.95rem] text-gray-600 dark:text-gray-400">
        {hasSuggestions
          ? "All AI suggestions and actions for your wallet."
          : "Open Brain to get personalized alerts and actions."}
      </CText>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="gap-3">
          {helperCards.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => {
                if (item.link) router.push(item.link as any);
              }}
              className="w-full"
            >
              <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-4 rounded-2xl bg-white dark:bg-accent w-full">
                <View className="h-8 w-8 rounded-full">
                  <Image
                    source={require("@/assets/images/ballicon.png")}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-1 min-w-0">
                  <CText
                    style={{ fontFamily: "bold" }}
                    className="text-[1.1rem]"
                  >
                    {item.title}
                  </CText>
                  <CText className="text-[1rem]">{item.caption}</CText>
                </View>
                <MaterialCommunityIcons
                  name="greater-than"
                  size={12}
                  color={isDarkMode ? "white" : "black"}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
