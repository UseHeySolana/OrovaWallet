import { ReactNode } from "react";
import { View } from "react-native";
import { useKeyboard } from "@/context/KeyboardContext";
import { authUi } from "@/components/auth/authUi";
import { isTablet } from "@/utils/layout/tablet";

interface AuthFlowScreenProps {
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthFlowScreen({
  children,
  footer,
}: AuthFlowScreenProps) {
  const { isKeyboardVisible } = useKeyboard();
  const pad = isTablet();

  return (
    <View className="relative bg-grey dark:bg-dark flex-1 w-full">
      <View
        className={`flex-1 w-full ${authUi.screenPadding} flex-col ${
          isKeyboardVisible ? "justify-start pt-8" : "justify-center"
        }`}
      >
        <View
          className={`w-full self-center ${authUi.sectionGap}`}
          style={{ maxWidth: pad ? 560 : 448 }}
        >
          {children}
        </View>
      </View>
      {!isKeyboardVisible && footer}
    </View>
  );
}
