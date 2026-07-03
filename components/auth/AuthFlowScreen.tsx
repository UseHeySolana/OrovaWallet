import { ReactNode } from "react";
import { View } from "react-native";
import { useKeyboard } from "@/context/KeyboardContext";
import { authUi } from "@/components/auth/authUi";

interface AuthFlowScreenProps {
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthFlowScreen({
  children,
  footer,
}: AuthFlowScreenProps) {
  const { isKeyboardVisible } = useKeyboard();

  return (
    <View className="relative bg-grey dark:bg-dark flex-1 w-full">
      <View
        className={`flex-1 w-full ${authUi.screenPadding} flex-col ${
          isKeyboardVisible ? "justify-start pt-8" : "justify-center"
        }`}
      >
        <View className={`w-full max-w-md self-center ${authUi.sectionGap}`}>
          {children}
        </View>
      </View>
      {!isKeyboardVisible && footer}
    </View>
  );
}
