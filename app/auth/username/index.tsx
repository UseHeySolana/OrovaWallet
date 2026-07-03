import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import Buttons from "@/components/ButtonComp";
import { registerUser, verifyCode } from "@/utils/request/db";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import { toPhoneE164 } from "@/utils/phone/phoneE164";
import { delay } from "@/utils/functions";
import AuthFlowScreen from "@/components/auth/AuthFlowScreen";
import AuthFlowFooter from "@/components/auth/AuthFlowFooter";
import AuthFlowHeader from "@/components/auth/AuthFlowHeader";
import UsernameField, {
  UsernameAvailabilityStatus,
} from "@/components/auth/UsernameField";
import AppSettings from "@/utils/store/settingsstore.store";

type RegisterParams = {
  contactMethod?: "phone" | "email";
  email?: string;
  mobileNumber?: string;
  callingCode?: string;
  country?: string;
};

export default function Username() {
  const params = useLocalSearchParams<RegisterParams>();

  const contactMethod = params.contactMethod === "email" ? "email" : "phone";
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
  const [currentState, setCurrentState] = useState<
    "verify-phrase" | "start-wallet" | "sign-up" | "set-pin" | ""
  >("");

  const hasContact =
    contactMethod === "email"
      ? email.length > 0
      : mobileNumber.length > 0;

  const canSignUp = usernameStatus === "available";

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setCurrentState("start-wallet");
      return;
    }
    if (!hasContact) {
      router.replace("/auth/register");
    }
  }, [user, hasContact]);

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
    delay(1000);

    const response = await registerUser({
      username: username.trim(),
      phone_number:
        contactMethod === "phone"
          ? `+${callingCode}${mobileNumber}`
          : undefined,
      email: contactMethod === "email" ? email : undefined,
      country: contactMethod === "phone" ? country : undefined,
    });

    if (response.status !== false) {
      setCurrentState("set-pin");
      setLoading(false);
    } else {
      setToast(response.message, "error");
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast("Invalid Otp", "error");
      return;
    }
    setLoading(true);
    const response = await verifyCode(otpValue, username.trim());
    if (response.status !== false) {
      setToast("Verification Successfull", "success");
      setUser({
        username: username.trim(),
        mobileNumber:
          contactMethod === "phone" ? mobileNumber : "",
        phoneE164:
          contactMethod === "phone"
            ? toPhoneE164(mobileNumber, [callingCode])
            : undefined,
        email: contactMethod === "email" ? email : undefined,
        pin: "",
      });
      setCurrentState("start-wallet");
      setLoading(false);
    } else {
      setToast(response.message || "Something went wrong", "error");
      setLoading(false);
    }
  };

  return (
    <>
      <AuthFlowScreen footer={<AuthFlowFooter />}>
        <AuthFlowHeader
          showLogo
          title="Pick a username"
          subtitle="Your username will be unique and can be used to make transactions."
        />

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
            text="Sign up"
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

      <WalletSheet open={currentState === "start-wallet"} />
    </>
  );
}
