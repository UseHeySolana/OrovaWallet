import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { getCode, verifyCode } from "@/utils/request/db";
import WalletItem from "@/utils/store/wallet.store";
import { CountryPickerModal } from "react-native-country-code-select";
import { TouchableOpacity } from "react-native";
import { useThemeContext } from "@/context/ThemeContext";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import { cleanNumber } from "@/utils/functions/extrafunctions";
import { toPhoneE164 } from "@/utils/phone/phoneE164";
import { delay } from "@/utils/functions";
import { BiometricAuth } from "@/utils/dashboard";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";

/**
  * What should be done here
 Login Page
  */
export default function Login() {
  const [userDetails, setUserDetails] = useState({
    username: "",
    mobileNumber: "",
    wallet_address: "",
  });

  const [otpValue, setOtpValue] = useState("");
  const { setUser, user, session, clearData } = UserItem();
  const { keypair, updateKeypair, publicKey } = WalletItem();
  const { setLoading, isLoading, setToast, openWithAuth, pin } = AppSettings();
  const [currentState, setCurrentState] = useState<
    "verify-phrase" | "start-wallet" | "sign-up" | "set-pin" | ""
  >("");

  const [selectedValue, setSelectedValue] = useState({
    callingCode: ["234"],
    countryInitials: "NG",
    name: "Nigeria",
    region: "Africa",
    subregion: "Western Africa",
  });
  const [fingerPrintSigning, setFingerPrintSigning] = useState(false);
  const [pinSignin, setPinSignin] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
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

    const fields = [];
    if (userDetails.mobileNumber === "") {
      fields.push("Mobile Number");
    }
    if (fields.length > 0) {
      setToast(`${fields.join(",")} required`, "error");
      return;
    }
    setLoading(true);
    delay(1000);
    const data = {
      phone_number:
        "+" + selectedValue.callingCode + cleanNumber(userDetails.mobileNumber),
    };
    const response = await getCode(data.phone_number, selectedValue.name);
    console.log(response);
    if (response.status !== false) {
      setUserDetails({
        ...userDetails,
        username: response.data.username,
        wallet_address: response.data.wallet_address,
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
          phoneE164: toPhoneE164(
            userDetails.mobileNumber,
            selectedValue.callingCode
          ),
          pin: "",
        });
        router.replace("/dashboard");
        return;
      } else {
        setUser({
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          phoneE164: toPhoneE164(
            userDetails.mobileNumber,
            selectedValue.callingCode
          ),
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

  return (
    <View className="relative bg-grey dark:bg-dark h-full w-100 flex justify-center items-center">
      <View className=" py-5 w-full px-4 gap-y-10 flex-col justify-center ">
        {!fingerPrintSigning && !pinSignin ? (
          <>
            <View className="flex flex-col justify-center items-center gap-y-2">
              <View className="w-full flex justify-center items-center">
                <View className="h-[3.125em] w-[3.125em]  rounded-full">
                  <Image
                    source={require("@/assets/images/ballicon.png")}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
              </View>
              <View className="w-8/12 m-auto">
                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[1.25em] text-center"
                >
                  Welcome back!
                </CText>
                <CText className="text-[1em] text-center">
                  Let's make handsfreee transactions
                </CText>
              </View>
            </View>

            <KeyboardAvoidingView className="bg-grey dark:bg-accent  rounded-3xl gap-y-3">
              <View className="bg-white  dark:bg-accent h-fit py-3 rounded-2xl">
                <View className="flex flex-row px-4 justify-between items-center">
                  <TouchableOpacity
                    onPress={() => {
                      setIsVisible(true);
                    }}
                  >
                    <CText style={{ fontFamily: "bold" }}>
                      +{selectedValue.callingCode}
                    </CText>
                  </TouchableOpacity>
                  <TextInput
                    style={{ fontFamily: "bold" }}
                    className="p-4 py-5 flex-1 text-dark dark:text-white"
                    value={userDetails.mobileNumber}
                    keyboardType="phone-pad"
                    placeholderTextColor={isDarkMode ? "white" : "black"}
                    onChangeText={(text) => {
                      setUserDetails({ ...userDetails, mobileNumber: text });
                    }}
                    placeholder={`enter a phone number`}
                  />
                </View>
              </View>
            </KeyboardAvoidingView>

            <View>
              <Buttons
                buttonType="pressable"
                onPress={
                  () => {
                    Login();
                  }}
                className=""
                text="Login"
                loading={isLoading}
                type="primary"
              />
              <View className="py-2 flex flex-row justify-center items-center gap-x-2">
                <CText className="text-center">Don't have an Account?</CText>
                <TouchableOpacity
                  onPress={() => router.replace("/auth/username")}
                >
                  <CText style={{ fontFamily: "bold" }} textColor="text-purple">
                    Sign up
                  </CText>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : pinSignin ? (
          <>
            <View className="flex flex-col justify-center items-center gap-y-2">
              <View className="w-full flex justify-center items-center">
                <View className="h-[3.125em] w-[3.125em]  rounded-full">
                  <Image
                    source={require("@/assets/images/ballicon.png")}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
              </View>
              <View className="w-8/12 m-auto">
                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[1.25em] text-center"
                >
                  Welcome back!
                </CText>
                <CText className="text-[1em] text-center">
                  Let's make handsfreee transactions
                </CText>
              </View>
            </View>

            <View className="w-full flex flex-col justify-center items-center gap-y-2">
              <CText>Enter your pin</CText>
            </View>

            <KeyboardAvoidingView className="bg-grey dark:bg-accent  rounded-3xl ">
              <View className="h-fit py-3  rounded-2xl">
                <View className="flex flex-row w-8/12 bg-white p-2 rounded-2xl  dark:bg-accent  m-auto px-4 justify-center items-center">
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
                </View>
              </View>
            </KeyboardAvoidingView>

            <View>
              <Buttons
                buttonType="pressable"
                onPress={() => verifyPin()}
                className=""
                text="Login"
                loading={isLoading}
                type="primary"
              />
              <View className="py-2 flex flex-row justify-center items-center gap-x-2">
                <CText className="text-center">Don't have an Account?</CText>
                <TouchableOpacity
                  onPress={() => router.replace("/auth/username")}
                >
                  <CText style={{ fontFamily: "bold" }} textColor="text-purple">
                    Sign up
                  </CText>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            <View className="flex flex-col justify-center items-center gap-y-2">
              <View className="w-full flex justify-center items-center">
                <View className="h-[10.125rem] w-[10.125rem]  rounded-full">
                  <Image
                    source={require("@/assets/images/icon.png")}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
              </View>
            </View>

            <View className="w-10/12 m-auto  flex justify-center gap-y-10 items-center">
              <TouchableOpacity
                onPress={BiometricAuth}
                className="bg-purple py-5 flex flex-row justify-center items-center gap-x-3  rounded-full overflow-hidden w-full"
              >
                <View className="h-[1.5rem] w-[1.5rem]  rounded-full">
                  <Image
                    source={require("@/assets/images/biometric2.png")}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>

                <CText className="text-white text-[1.5em] font-bold">
                  Unlock with Biometric
                </CText>
              </TouchableOpacity>
              <View className="">
                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[1em] text-center"
                >
                  Tap to login with your biometrics
                </CText>
                <TouchableOpacity onPress={() => setFingerPrintSigning(false)}>
                  <CText
                    textColor="text-purple"
                    className="text-[1em] text-center"
                  >
                    or login with mobile number
                  </CText>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      <CountryPickerModal
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        //@ts-ignore
        onSelect={(e) => setSelectedValue(e)}
      />

      <Otpsheet
        open={currentState === "set-pin"}
        verifyOtp={verifyOtp}
        setOtpValue={(text) => setOtpValue(text)}
      />

      <WalletSheet open={currentState === "start-wallet"} />
    </View>
  );
}

