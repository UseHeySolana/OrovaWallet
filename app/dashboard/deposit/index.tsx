import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { router } from "expo-router";
import { Pressable, TouchableOpacity, View } from "react-native";

const depositOptions = [
  {
    title: "Buy with card or bank transfer",
    description: "Use your preferred payment method",
    icon: <Ionicons name="cash-outline" size={27} color="#6B6B78" />,
    onPress: () => router.push("/dashboard/onramp" as any),
  },
  {
    title: "Receive crypto",
    description: "Receive on Solana or from another chain",
    icon: <MaterialCommunityIcons name="qrcode-scan" size={27} color="#6B6B78" />,
    onPress: () => router.push("/dashboard/qrcode"),
  },
];

export default function Deposit() {
  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark w-full flex-1 items-start justify-start gap-y-6">
      <View className="w-full flex flex-row justify-start">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>

      <View className="w-full gap-y-4">
        {depositOptions.map((option) => (
          <TouchableOpacity
            key={option.title}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            onPress={option.onPress}
            className="w-full flex-row items-center py-3"
          >
            <View className="flex-row items-center gap-x-4 flex-1">
              <View className="w-11 items-center">{option.icon}</View>
              <View className="flex-1">
                <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                  {option.title}
                </CText>
                <CText className="mt-1 text-[0.95rem] text-gray-500 dark:text-gray-400">
                  {option.description}
                </CText>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
