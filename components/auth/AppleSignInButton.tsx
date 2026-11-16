import { ActivityIndicator, Platform, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeContext } from "@/context/ThemeContext";

interface AppleSignInButtonProps {
  loading?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export default function AppleSignInButton({
  loading = false,
  onPress,
  accessibilityLabel = "Sign in with Apple",
}: AppleSignInButtonProps) {
  const { isDarkMode } = useThemeContext();

  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={loading}
      className="h-14 w-14 items-center justify-center self-center"
    >
      {loading ? (
        <ActivityIndicator color={isDarkMode ? "#FFFFFF" : "#000000"} />
      ) : (
        <Ionicons
          name="logo-apple"
          size={40}
          color={isDarkMode ? "#FFFFFF" : "#000000"}
        />
      )}
    </Pressable>
  );
}
