import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import Buttons from "@/components/ButtonComp";
import { registerUser, verifyCode } from "@/utils/request/db";
import Otpsheet from "@/components/Sheets/OtpSheets";
import { toPhoneE164 } from "@/utils/phone/phoneE164";
import AuthFlowScreen from "@/components/auth/AuthFlowScreen";
import AuthFlowFooter from "@/components/auth/AuthFlowFooter";
import AuthFlowHeader from "@/components/auth/AuthFlowHeader";
import UsernameField, {
  UsernameAvailabilityStatus,
} from "@/components/auth/UsernameField";
import AppSettings from "@/utils/store/settingsstore.store";
import CText from "@/components/TextComp";
import { authUi } from "@/components/auth/authUi";
import {
  consumePendingGoogleAuth,
  peekPendingGoogleAuth,
} from "@/services/google/googleAuth";
import { createWalletForUser } from "@/utils/wallet/createWalletForUser";

type RegisterParams = {
  contactMethod?: "phone" | "email" | "google";
  email?: string;
  mobileNumber?: string;
  callingCode?: string;
  country?: string;
};

export default function Username() {
  const params = useLocalSearchParams<RegisterParams>();

  const contactMethod =
    params.contactMethod === "email"
      ? "email"
      : params.contactMethod === "google"
        ? "google"
        : "phone";
  const email = typeof params.email === "string" ? params.email : "";
  const mobileNumber =
    typeof params.mobileNumber === "string" ? params.mobileNumber : "";
  const callingCode =
    typeof params.callingCode === "string" ? params.callingCode : "234";
  const country = typeof params.country === "string" ? params.country : "Nigeria";

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] =
    useState<UsernameAvailabilityStatus>("idle");
  const [otpValue, setOtpValue] = useState("");
  const { setUser, user } = UserItem();
  const { setLoading, isLoading, setToast } = AppSettings();
  const [currentState, setCurrentState] = useState<"set-pin" | "">("");

  const hasContact =
    contactMethod === "google"
      ? email.length > 0 && Boolean(peekPendingGoogleAuth()?.idToken)
      : contactMethod === "email"
        ? email.length > 0
        : mobileNumber.length > 0;

  const canSignUp = usernameStatus === "available";
  const isGoogleSignup = contactMethod === "google";

  useEffect(() => {
    if (user?.wallet_address?.trim()) {
      router.replace("/dashboard");
      return;
    }
    if (!hasContact) {
      router.replace("/auth/register");
    }
  }, [user?.wallet_address, hasContact]);

  const finishSignupWithWallet = async (sessionUser: {
    username: string;
    mobileNumber: string;
    phoneE164?: string;
    email?: string;
  }) => {
    setUser({
      ...sessionUser,
      pin: "",
      wallet_address: "",
    });

    setLoading(true);
    try {
      const result = await createWalletForUser(sessionUser.username);
      if (!result.success) {
        setToast(result.message, "error");
        return;
      }

      setToast("Account created — set a PIN and back up your wallet", "success");
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const saveUserToDB = async () => {
    if (!username.trim()) {
      return;
    }
    if (!canSignUp) {
      return;
    }
    if (!hasContact) {
      setToast("Contact details missing. Please start again.", "error");
      router.replace("/auth/register");
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const googleSession = isGoogleSignup ? consumePendingGoogleAuth() : null;
      if (isGoogleSignup && !googleSession?.idToken) {
        setToast("Google sign-in expired. Please try again.", "error");
        router.replace("/auth/register");
        return;
      }

      const response = await registerUser({
        username: username.trim(),
        phone_number:
          contactMethod === "phone"
            ? `+${callingCode}${mobileNumber}`
            : undefined,
        email:
          contactMethod === "email" || contactMethod === "google"
            ? email
            : undefined,
        country: contactMethod === "phone" ? country : undefined,
        google_id_token: googleSession?.idToken,
        google_id: googleSession?.id,
      });

      if (response.status !== false) {
        if (isGoogleSignup) {
          await finishSignupWithWallet({
            username: username.trim(),
            mobileNumber: "",
            email,
          });
          return;
        }
        setCurrentState("set-pin");
      } else {
        setToast(response.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast("Invalid Otp", "error");
      return;
    }
    setLoading(true);
    try {
      const response = await verifyCode(otpValue, username.trim());
      if (response.status !== false) {
        setToast("Verification Successfull", "success");
        await finishSignupWithWallet({
          username: username.trim(),
          mobileNumber: contactMethod === "phone" ? mobileNumber : "",
          phoneE164:
            contactMethod === "phone"
              ? toPhoneE164(mobileNumber, [callingCode])
              : undefined,
          email: contactMethod === "email" ? email : undefined,
        });
      } else {
        setToast(response.message || "Something went wrong", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthFlowScreen footer={<AuthFlowFooter />}>
        <AuthFlowHeader
          showLogo
          title="Pick a username"
          subtitle={
            isGoogleSignup
              ? "Choose a unique username — we'll create your wallet automatically."
              : "Your username will be unique and can be used to make transactions."
          }
        />

        {isGoogleSignup ? (
          <View className={`${authUi.headerContentWidth} self-center`}>
            <CText className={`${authUi.caption} text-center`}>
              Signed in with Google as{" "}
              <CText style={{ fontFamily: "bold" }} className={authUi.caption}>
                {email}
              </CText>
            </CText>
          </View>
        ) : null}

        <UsernameField
          value={username}
          onChangeText={setUsername}
          onStatusChange={setUsernameStatus}
        />

        <View style={{ opacity: canSignUp ? 1 : 0.45 }}>
          <Buttons
            buttonType="pressable"
            onPress={() => {
              if (canSignUp) saveUserToDB();
            }}
            text={isGoogleSignup ? "Create account & wallet" : "Sign up"}
            loading={isLoading}
            type="primary"
          />
        </View>
      </AuthFlowScreen>

      <Otpsheet
        open={currentState === "set-pin"}
        verifyOtp={verifyOtp}
        setOtpValue={(text) => setOtpValue(text)}
      />
    </>
  );
}
