import { ReactNode } from "react";
import { View } from "react-native";
import { authUi } from "@/components/auth/authUi";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export default function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <View
      className={`${authUi.inputShell} ${authUi.inputPadding} ${authUi.inputMinHeight} ${className}`}
    >
      {children}
    </View>
  );
}
