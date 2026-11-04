import { ActivityIndicator, Platform, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useThemeContext } from "@/context/ThemeContext";

interface AppleSignInButtonProps {
  loading?: boolean;
  onPress: () => void;
}

export default function AppleSignInButton({
  loading = false,
  onPress,
}: AppleSignInButtonProps) {
  const { isDarkMode } = useThemeContext();

  if (Platform.OS !== "ios") {
    return null;
  }

  return (
    <View className="h-14 w-full max-w-[280px] self-center overflow-hidden rounded-xl">
      {loading ? (
        <View className="h-14 w-full items-center justify-center rounded-xl bg-black">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={
            isDarkMode
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={{ width: "100%", height: 56 }}
          onPress={onPress}
        />
      )}
    </View>
  );
}
