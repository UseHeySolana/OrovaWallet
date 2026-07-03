import { Linking } from "react-native";
import { View } from "react-native";
import CText from "@/components/TextComp";

const TERMS_URL = "https://heysolana.com/terms";
const PRIVACY_URL = "https://heysolana.com/privacy";

export default function LegalConsentNotice() {
  return (
    <View className="mt-3">
      <CText className="text-[0.85rem] text-center leading-5 text-dark/60 dark:text-white/60">
        By continuing, you agree to our{" "}
        <CText
          onPress={() => Linking.openURL(TERMS_URL)}
          style={{ fontFamily: "bold" }}
          textColor="text-purple"
          className="text-[0.85rem]"
        >
          Terms
        </CText>
        {" "}
        &{" "}
        <CText
          onPress={() => Linking.openURL(PRIVACY_URL)}
          style={{ fontFamily: "bold" }}
          textColor="text-purple"
          className="text-[0.85rem]"
        >
          Privacy Policy
        </CText>
        .
      </CText>
    </View>
  );
}
