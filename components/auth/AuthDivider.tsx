import { View } from "react-native";
import CText from "@/components/TextComp";

export default function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <View className="flex-row items-center gap-x-3">
      <View className="flex-1 h-px bg-dark/10 dark:bg-white/10" />
      <CText className="text-[0.875rem] opacity-50">{label}</CText>
      <View className="flex-1 h-px bg-dark/10 dark:bg-white/10" />
    </View>
  );
}
