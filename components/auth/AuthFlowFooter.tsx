import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import { isTablet } from "@/utils/layout/tablet";

interface AuthFlowFooterProps {
  prompt?: string;
  actionLabel?: string;
  onPress?: () => void;
}

export default function AuthFlowFooter({
  prompt = "Already have an Account?",
  actionLabel = "Log in",
  onPress = () => router.push("/auth/login"),
}: AuthFlowFooterProps) {
  const pad = isTablet();
  const textClass = pad
    ? "text-[1.1875rem] leading-7"
    : "text-[1.0625rem] leading-6";

  return (
    <View className="absolute bottom-10 w-full flex-row justify-center items-center gap-x-2 px-4">
      <CText className={textClass}>{prompt}</CText>
      <TouchableOpacity onPress={onPress}>
        <CText
          style={{ fontFamily: "bold" }}
          textColor="text-purple"
          className={textClass}
        >
          {actionLabel}
        </CText>
      </TouchableOpacity>
    </View>
  );
}
