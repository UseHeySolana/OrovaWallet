import { useEffect, useState } from "react";
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
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import AppleSignInButton from "@/components/auth/AppleSignInButton";
import {
  CountrySelection,
  parseSmartContact,
} from "@/utils/contact/smartContact";
import {
  getGoogleSignInErrorMessage,
  signInWithGoogleForAuth,
} from "@/services/google/googleAuth";
import { isGoogleSignInConfigured } from "@/utils/google/googleConfig";
import {
  getAppleSignInErrorMessage,
  isAppleSignInAvailable,
  signInWithAppleForAuth,
} from "@/services/apple/appleAuth";

export default function RegisterContact() {
  const { setToast } = AppSettings();

  const [contactInput, setContactInput] = useState("");
  const [selectedValue, setSelectedValue] =
    useState<CountrySelection>(DEFAULT_COUNTRY);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);

  const googleEnabled = isGoogleSignInConfigured();

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable().then((available) => {
      if (!cancelled) setAppleEnabled(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogleForAuth();
      router.push({
        pathname: "/auth/username",
        params: {
          contactMethod: "google",
          email: session.email,
        },
      });
    } catch (error) {
      setToast(getGoogleSignInErrorMessage(error), "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const continueWithApple = async () => {
    setAppleLoading(true);
    try {
      const session = await signInWithAppleForAuth();
      router.push({
        pathname: "/auth/username",
        params: {
          contactMethod: "apple",
          email: session.email || "",
        },
      });
    } catch (error) {
      setToast(getAppleSignInErrorMessage(error), "error");
    } finally {
      setAppleLoading(false);
    }
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

      {appleEnabled || googleEnabled ? (
        <View className="mt-2 w-full items-center gap-3">
          {appleEnabled ? (
            <AppleSignInButton
              loading={appleLoading}
              onPress={continueWithApple}
            />
          ) : null}
          {googleEnabled ? (
            <GoogleSignInButton
              loading={googleLoading}
              onPress={continueWithGoogle}
              accessibilityLabel="Sign up with Google"
            />
          ) : null}
        </View>
      ) : null}
    </AuthFlowScreen>
  );
}
