import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import DragableSheet from "@/components/commons/CustomItems/DragableSheet";
import CText from "@/components/TextComp";
import { OtpInput } from "react-native-otp-entry";
import { useThemeContext } from "@/context/ThemeContext";
import Buttons from "@/components/ButtonComp";
import React, { useEffect, useRef, useState } from "react";
import AppSettings from "@/utils/store/settingsstore.store";

interface SetPinSheet {
  open: boolean;
  setOpen: (open: boolean) => void;
  usage?: "verify" | "first-time";
  onSuccess?: () => void;
}
const SetPin = ({ open, setOpen, usage, onSuccess }: SetPinSheet) => {
  const { isDarkMode } = useThemeContext();
  if (!open) return null;

  const { pin: previousPin, setToast, setPinReminder } = AppSettings();

  const [attempts, setAttempts] = useState(0);

  const [stage, setStage] = useState("new-pin");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const otpRef = useRef<any>(null);

  const [enterPreviousPin, setEnterPreviousPin] = useState<string | null>(null);

  useEffect;
  useEffect(() => {
    if (previousPin.length == 4) {
      setStage("enter-previous-pin");
    }
  }, [previousPin]);

  const handlePinChange = () => {
    if (confirmPin == pin) {
      AppSettings.getState().setPin(pin);
      AppSettings.getState().setOpenWithAuth(true);
      setToast("PIN set successfully", "success");
      setOpen(false);
    } else {
      setToast("Pin provided does not match", "error");
    }
  };

  const verifyPreviousPin = () => {
    if (attempts >= 4) {
      setToast("You have reached the maximum number of attempts", "error");
      setOpen(false);
      // Close the app after 4 failed attempts
      if (Platform.OS === "ios") {
        BackHandler.exitApp();
      } else {
        BackHandler.exitApp();
      }
      return;
    }
    if (enterPreviousPin == previousPin) {
      setStage("new-pin");
      setPin("");
      setConfirmPin("");
      otpRef.current.clear();
    } else {
      setAttempts(attempts + 1);
      setToast("Pin provided does not match", "error");
    }
  };

  const verifyPin = () => {
    if (attempts >= 3) {
      setToast("You have reached the maximum number of attempts", "error");
      setOpen(false);
      if (Platform.OS === "ios") {
        BackHandler.exitApp();
      } else {
        BackHandler.exitApp();
      }
      return;
    } else {
      console.log(pin, previousPin);
      if (pin == previousPin) {
        onSuccess?.();
        setOpen(false);
      } else {
        setAttempts(attempts + 1);
        setToast("Pin provided does not match", "error");
      }
    }
  };

  return (
    <DragableSheet
      close={() => setOpen(false)}
      panClose={true}
      snapPoints={["60%"]}
      child={
        usage === "verify" ? (
          <View className=" py-4 w-full h-fit gap-y-10 flex-1 flex-col justify-start ">
            <View className="w-8/12 m-auto">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[20px] text-center"
              >
                Enter your PIN
              </CText>
            </View>

            <View className="flex-1">
              <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 py-5">
                <View className="w-10/12 m-auto bg-white dark:bg-accent2 h-fit py-3 px-2 rounded-2xl">
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
                    onFilled={(text) => setPin(text)}
                  />
                </View>
              </KeyboardAvoidingView>
            </View>

            <Buttons
              buttonType="pressable"
              onPress={() => {
                verifyPin();
              }}
              className=""
              text={"Confirm"}
              type="primary"
            />
          </View>
        ) : (
          <View className=" py-4 w-full h-fit gap-y-10 flex-1 flex-col justify-start ">
            <View className="w-8/12 m-auto">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[20px] text-center"
              >
                {stage === "enter-previous-pin"
                  ? "Enter Previous PIN"
                  : stage === "new-pin"
                  ? "Enter New PIN"
                  : "Confirm PIN"}
              </CText>
              <CText
                style={{ fontFamily: "md" }}
                textColor="text-purple"
                className="text-[12px] text-center"
              >
                {stage === "enter-previous-pin"
                  ? "Enter your previous PIN to change pin"
                  : stage === "new-pin"
                  ? "Create a PIN to secure your account"
                  : "Confirm your PIN to secure your account"}
              </CText>
            </View>

            <View className="flex-1">
              <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 px-4 py-5">
                <View className="bg-white w-10/12 m-auto dark:bg-accent2 h-fit py-3 px-2 rounded-2xl">
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
                    onFilled={(text) =>
                      stage === "new-pin"
                        ? setPin(text)
                        : stage === "enter-previous-pin"
                        ? setEnterPreviousPin(text)
                        : setConfirmPin(text)
                    }
                  />
                </View>
              </KeyboardAvoidingView>
            </View>

            {stage === "enter-previous-pin" ? (
              <Buttons
                buttonType="pressable"
                onPress={() => {
                  verifyPreviousPin();
                }}
                className=""
                text={"Verify"}
                type="primary"
              />
            ) : (
              <>
                <Buttons
                  buttonType="pressable"
                  onPress={() => {
                    if (stage === "new-pin") {
                      if (pin.length < 4) {
                        console.log("pin", pin);
                        setToast("PIN must be 4 digits", "error");
                      } else {
                        setStage("confirm-pin");
                        otpRef.current.clear();
                      }
                    } else {
                      handlePinChange();
                    }
                  }}
                  className=""
                  text={stage === "new-pin" ? "Next" : "Saved"}
                  type="primary"
                />
                {usage == "first-time" && stage == "new-pin" && (
                  <Buttons
                    buttonType="pressable"
                    onPress={() => {
                      setOpen(false);
                      // setPinReminder(new Date().getTime() + 1000 * 60 * 60 * 24 * 30);
                      setPinReminder(new Date().getTime() + 1000 * 30);
                      setStage("new-pin");
                      otpRef.current.clear();
                      setPin("");
                      setConfirmPin("");
                    }}
                    className=""
                    text="Cancel"
                    type="secondary"
                  />
                )}
                {stage === "confirm-pin" && (
                  <Buttons
                    buttonType="pressable"
                    onPress={() => {
                      setStage("new-pin");
                      otpRef.current.clear();
                      setPin("");
                      setConfirmPin("");
                    }}
                    className=""
                    text="Back"
                    type="secondary"
                  />
                )}
              </>
            )}
          </View>
        )
      }
    />
  );
};

export default SetPin;
