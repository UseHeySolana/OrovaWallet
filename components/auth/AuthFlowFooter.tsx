import { TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import CText from "@/components/TextComp";

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
  return (
    <View className="absolute bottom-10 w-full flex-row justify-center items-center gap-x-2 px-4">
      <CText className="text-[1.125em]">{prompt}</CText>
      <TouchableOpacity onPress={onPress}>
        <CText
          style={{ fontFamily: "bold" }}
          textColor="text-purple"
          className="text-[1.125em]"
        >
          {actionLabel}
        </CText>
      </TouchableOpacity>
    </View>
  );
}
