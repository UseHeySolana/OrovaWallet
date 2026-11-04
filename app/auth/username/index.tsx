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
import {
  consumePendingAppleAuth,
  peekPendingAppleAuth,
} from "@/services/apple/appleAuth";
import { createWalletForUser } from "@/utils/wallet/createWalletForUser";

type RegisterParams = {
  contactMethod?: "phone" | "email" | "google" | "apple";
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
        : params.contactMethod === "apple"
          ? "apple"
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
  const [registeredUserId, setRegisteredUserId] = useState<number | undefined>();

  const hasContact =
    contactMethod === "google"
      ? email.length > 0 && Boolean(peekPendingGoogleAuth()?.idToken)
      : contactMethod === "apple"
        ? Boolean(peekPendingAppleAuth()?.identityToken)
        : contactMethod === "email"
          ? email.length > 0
          : mobileNumber.length > 0;

  const canSignUp = usernameStatus === "available";
  const isGoogleSignup = contactMethod === "google";
  const isAppleSignup = contactMethod === "apple";
  const isSocialSignup = isGoogleSignup || isAppleSignup;

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
    id?: number;
    username: string;
    mobileNumber: string;
    phoneE164?: string;
    email?: string;
  }) => {
    setUser({
      ...sessionUser,
      id: sessionUser.id ?? registeredUserId,
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

      const appleSession = isAppleSignup ? consumePendingAppleAuth() : null;
      if (isAppleSignup && !appleSession?.identityToken) {
        setToast("Apple sign-in expired. Please try again.", "error");
        router.replace("/auth/register");
        return;
      }

      const socialEmail =
        (isGoogleSignup ? googleSession?.email : undefined) ||
        (isAppleSignup ? appleSession?.email || email : undefined) ||
        email;

      const response = await registerUser({
        username: username.trim(),
        phone_number:
          contactMethod === "phone"
            ? `+${callingCode}${mobileNumber}`
            : undefined,
        email:
          contactMethod === "email" || isSocialSignup
            ? socialEmail || undefined
            : undefined,
        country: contactMethod === "phone" ? country : undefined,
        google_id_token: googleSession?.idToken,
        google_id: googleSession?.id,
        apple_id_token: appleSession?.identityToken,
        apple_id: appleSession?.id,
      });

      if (response.status !== false) {
        const serverUserId =
          typeof response.data?.id === "number" ? response.data.id : undefined;
        if (serverUserId != null) {
          setRegisteredUserId(serverUserId);
        }

        if (isSocialSignup) {
          await finishSignupWithWallet({
            id: serverUserId,
            username: username.trim(),
            mobileNumber: "",
            email: socialEmail || response.data?.email || "",
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
          id: registeredUserId,
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
            isSocialSignup
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

        {isAppleSignup ? (
          <View className={`${authUi.headerContentWidth} self-center`}>
            <CText className={`${authUi.caption} text-center`}>
              {email
                ? "Signed in with Apple as "
                : "Signed in with Apple. Choose a username to finish setup."}
              {email ? (
                <CText style={{ fontFamily: "bold" }} className={authUi.caption}>
                  {email}
                </CText>
              ) : null}
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
            text={isSocialSignup ? "Create account & wallet" : "Sign up"}
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
