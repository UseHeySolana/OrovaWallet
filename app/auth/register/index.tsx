import { useState } from "react";
import { View } from "react-native";
import Buttons from "@/components/ButtonComp";
import { router } from "expo-router";
import AppSettings from "@/utils/store/settingsstore.store";
import SmartContactInput, {
  DEFAULT_COUNTRY,
} from "@/components/auth/SmartContactInput";
import LegalConsentNotice from "@/components/auth/LegalConsentNotice";
import AuthFlowScreen from "@/components/auth/AuthFlowScreen";
import AuthFlowFooter from "@/components/auth/AuthFlowFooter";
import AuthFlowHeader from "@/components/auth/AuthFlowHeader";
import {
  CountrySelection,
  parseSmartContact,
} from "@/utils/contact/smartContact";

export default function RegisterContact() {
  const { setToast } = AppSettings();

  const [contactInput, setContactInput] = useState("");
  const [selectedValue, setSelectedValue] =
    useState<CountrySelection>(DEFAULT_COUNTRY);

  const continueToUsername = () => {
    const parsed = parseSmartContact(contactInput, selectedValue);
    if (parsed.mode === "invalid") {
      setToast(parsed.message, "error");
      return;
    }

    if (parsed.mode === "email") {
      router.push({
        pathname: "/auth/username",
        params: {
          contactMethod: "email",
          email: parsed.email,
        },
      });
      return;
    }

    router.push({
      pathname: "/auth/username",
      params: {
        contactMethod: "phone",
        mobileNumber: parsed.mobileNumber,
        callingCode: parsed.callingCode,
        country: parsed.country,
      },
    });
  };

  return (
    <AuthFlowScreen footer={<AuthFlowFooter />}>
      <AuthFlowHeader
        showLogo
        title="Create your account"
        subtitle="Sign up with your email or mobile number to get started."
      />

      <SmartContactInput
        value={contactInput}
        onChangeText={setContactInput}
        selectedValue={selectedValue}
        onCountryChange={setSelectedValue}
      />

      <View>
        <Buttons
          buttonType="pressable"
          onPress={continueToUsername}
          text="Continue"
          type="primary"
        />
        <LegalConsentNotice />
      </View>
    </AuthFlowScreen>
  );
}
