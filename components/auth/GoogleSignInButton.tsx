import { ActivityIndicator, Pressable } from "react-native";
import { Image } from "expo-image";

interface GoogleSignInButtonProps {
  loading?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

export default function GoogleSignInButton({
  loading = false,
  onPress,
  accessibilityLabel = "Sign in with Google",
}: GoogleSignInButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={loading}
      className="h-14 w-14 items-center justify-center self-center"
    >
      {loading ? (
        <ActivityIndicator color="#4285F4" />
      ) : (
        <Image
          source={require("@/assets/icon/googleicon.png")}
          style={{ width: 44, height: 44 }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      )}
    </Pressable>
  );
}
