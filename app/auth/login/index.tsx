import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import Buttons from "@/components/ButtonComp";
import { getCode, verifyCode } from "@/utils/request/db";
import WalletItem from "@/utils/store/wallet.store";
import { TouchableOpacity } from "react-native";
import { useThemeContext } from "@/context/ThemeContext";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import SmartContactInput, {
  DEFAULT_COUNTRY,
} from "@/components/auth/SmartContactInput";
import AuthFlowScreen from "@/components/auth/AuthFlowScreen";
import AuthFlowHeader from "@/components/auth/AuthFlowHeader";
import AuthFlowFooter from "@/components/auth/AuthFlowFooter";
import AuthCard from "@/components/auth/AuthCard";
import { authUi } from "@/components/auth/authUi";
import {
  CountrySelection,
  parseSmartContact,
} from "@/utils/contact/smartContact";
import { toPhoneE164 } from "@/utils/phone/phoneE164";
import { delay } from "@/utils/functions";
import { BiometricAuth } from "@/utils/dashboard";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";

/**
  * What should be done here
 Login Page
  */
export default function Login() {
  const [contactInput, setContactInput] = useState("");
  const [userDetails, setUserDetails] = useState({
    username: "",
    mobileNumber: "",
    wallet_address: "",
    email: "",
  });

  const [otpValue, setOtpValue] = useState("");
  const { setUser, user, session, clearData } = UserItem();
  const { keypair, updateKeypair, publicKey } = WalletItem();
  const { setLoading, isLoading, setToast, openWithAuth, pin } = AppSettings();
  const [currentState, setCurrentState] = useState<
    "verify-phrase" | "start-wallet" | "sign-up" | "set-pin" | ""
  >("");

  const [selectedValue, setSelectedValue] =
    useState<CountrySelection>(DEFAULT_COUNTRY);
  const [fingerPrintSigning, setFingerPrintSigning] = useState(false);
  const [pinSignin, setPinSignin] = useState(false);
  const { isDarkMode } = useThemeContext();
  const otpRef = useRef<OtpInputRef>(null);
  const [attempts, setAttempts] = useState(0);

  const [pinValue, setPinValue] = useState("");
  useEffect(() => {
    (async () => {
      if (user) {
        setUserDetails({
          ...userDetails,
          mobileNumber: user.mobileNumber,
        });
        if (openWithAuth) {
          setFingerPrintSigning(true);
          setTimeout(() => {
            BiometricAuth();
          }, 1000);
        } else if (pin.length > 0) {
          setPinSignin(true);
        } else {
          setCurrentState("start-wallet");
        }
      }
    })();
  }, [user]);

  const Login = async () => {
    const parsed = parseSmartContact(contactInput, selectedValue);
    if (parsed.mode === "invalid") {
      setToast(parsed.message, "error");
      return;
    }

    setLoading(true);
    delay(1000);

    const response = await getCode(
      parsed.mode === "email"
        ? { email: parsed.email }
        : {
            phone_number: parsed.phoneE164,
            country: parsed.country,
          }
    );

    if (response.status !== false) {
      setUserDetails({
        ...userDetails,
        username: response.data.username,
        wallet_address: response.data.wallet_address,
        email: response.data.email || (parsed.mode === "email" ? parsed.email : ""),
        mobileNumber: parsed.mode === "phone" ? parsed.mobileNumber : "",
      });
      setCurrentState("set-pin");
      setLoading(false);
    } else {
      setToast(response.message || "Something went wrong", "error");
      setLoading(false);
    }
  };

  const verifyPin = async () => {
    if (pinValue.length < 4) {
      setToast("Invalid Pin", "error");
      otpRef.current?.clear();
      return;
    }
    if (pinValue === pin) {
      setToast("Pin Verified", "success");
      router.replace("/dashboard");
    } else {
      setToast("Invalid Pin", "error");
      otpRef.current?.clear();
      setAttempts(attempts + 1);
      if (attempts === 1) {
        setToast("Invalid Pin, 2 attempts left", "error");
      } else if (attempts === 2) {
        setToast("Invalid Pin, 1 attempt left", "error");
      }

      if (attempts >= 3) {
        setToast("You have reached the maximum number of attempts", "error");
        setCurrentState("");
        clearData();
        if (Platform.OS === "ios") {
          BackHandler.exitApp();
        } else {
          BackHandler.exitApp();
        }
        return;
      }
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast("Invalid Otp", "error");
      return;
    }
    setLoading(true);
    const response = await verifyCode(otpValue, userDetails.username);
    if (response.status !== false) {
      setToast("Verification Successfull", "success");
      //check if the publick key stored is the same as the address coming, route to dashboard
      if (
        publicKey !== null &&
        publicKey.toString() === userDetails.wallet_address
      ) {
        setUser({
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          phoneE164: userDetails.mobileNumber
            ? toPhoneE164(
                userDetails.mobileNumber,
                selectedValue.callingCode
              )
            : undefined,
          email: userDetails.email || undefined,
          wallet_address: userDetails.wallet_address,
          pin: "",
        });
        router.replace("/dashboard");
        return;
      } else {
        setUser({
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          phoneE164: userDetails.mobileNumber
            ? toPhoneE164(
                userDetails.mobileNumber,
                selectedValue.callingCode
              )
            : undefined,
          email: userDetails.email || undefined,
          wallet_address: userDetails.wallet_address,
          pin: "",
        });
        setCurrentState("start-wallet");
        setLoading(false);
        return;
      }
    } else {
      setToast(response.message || "Something went wrong", "error");
      setLoading(false);
    }
  };

  const signUpFooter = (
    <AuthFlowFooter
      prompt="Don't have an Account?"
      actionLabel="Sign up"
      onPress={() => router.replace("/auth/register")}
    />
  );

  return (
    <>
      {fingerPrintSigning ? (
        <View className="relative bg-grey dark:bg-dark flex-1 w-full justify-center items-center px-4">
          <View className="w-full max-w-md flex justify-center gap-y-10 items-center">
            <View className="h-40 w-40 rounded-full">
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>

            <TouchableOpacity
              onPress={BiometricAuth}
              className="bg-purple py-5 flex flex-row justify-center items-center gap-x-3 rounded-full overflow-hidden w-full"
            >
              <View className="h-6 w-6 rounded-full">
                <Image
                  source={require("@/assets/images/biometric2.png")}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              </View>

              <CText className="text-white text-[1.5rem] font-bold">
                Unlock with Biometric
              </CText>
            </TouchableOpacity>

            <View className={authUi.headerGap}>
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[1rem] text-center"
              >
                Tap to login with your biometrics
              </CText>
              <TouchableOpacity onPress={() => setFingerPrintSigning(false)}>
                <CText
                  textColor="text-purple"
                  className="text-[1rem] text-center"
                >
                  or login with mobile number or email
                </CText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <AuthFlowScreen footer={signUpFooter}>
          {pinSignin ? (
            <>
              <AuthFlowHeader
                showLogo
                title="Welcome back!"
                subtitle="Let's make handsfreee transactions"
              />

              <CText className={`${authUi.subtitle} text-center`}>
                Enter your pin
              </CText>

              <AuthCard className="items-center">
                <OtpInput
                  ref={otpRef}
                  secureTextEntry={true}
                  focusColor={"purple"}
                  textProps={{
                    style: {
                      fontFamily: "bold",
                      color: isDarkMode ? "white" : "black",
                    },
                  }}
                  blurOnFilled={true}
                  numberOfDigits={4}
                  onFilled={(text) => {
                    setPinValue(text);
                  }}
                />
              </AuthCard>

              <Buttons
                buttonType="pressable"
                onPress={() => verifyPin()}
                text="Login"
                loading={isLoading}
                type="primary"
              />
            </>
          ) : (
            <>
              <AuthFlowHeader
                showLogo
                title="Welcome back!"
                subtitle="Let's make handsfreee transactions"
              />

              <SmartContactInput
                value={contactInput}
                onChangeText={setContactInput}
                selectedValue={selectedValue}
                onCountryChange={setSelectedValue}
              />

              <Buttons
                buttonType="pressable"
                onPress={() => Login()}
                text="Login"
                loading={isLoading}
                type="primary"
              />
            </>
          )}
        </AuthFlowScreen>
      )}

      <Otpsheet
        open={currentState === "set-pin"}
        verifyOtp={verifyOtp}
        setOtpValue={(text) => setOtpValue(text)}
      />

      <WalletSheet open={currentState === "start-wallet"} />
    </>
  );
}

