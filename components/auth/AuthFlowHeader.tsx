import { ReactNode } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import CText from "@/components/TextComp";
import { authUi } from "@/components/auth/authUi";

interface AuthFlowHeaderProps {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  children?: ReactNode;
}

export default function AuthFlowHeader({
  title,
  subtitle,
  showLogo = false,
  children,
}: AuthFlowHeaderProps) {
  return (
    <View className={`w-full items-center ${authUi.headerGap}`}>
      {showLogo && (
        <View className="h-12 w-12 rounded-full mb-2">
          <Image
            source={require("@/assets/images/ballicon.png")}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
        </View>
      )}
      <View className={authUi.headerContentWidth}>
        <CText style={{ fontFamily: "bold" }} className={authUi.title}>
          {title}
        </CText>
        {subtitle ? (
          <CText className={`${authUi.subtitle} mt-2`}>{subtitle}</CText>
        ) : null}
      </View>
      {children}
    </View>
  );
}
