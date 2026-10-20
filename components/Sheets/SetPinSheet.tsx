import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { OtpInput } from "react-native-otp-entry";
import { useThemeContext } from "@/context/ThemeContext";
import Buttons from "../ButtonComp";
import React, { useEffect, useRef, useState } from "react";
import AppSettings from "@/utils/store/settingsstore.store";
import { compactOtpInputTheme } from "@/components/otpInputTheme";
import { tabletSize } from "@/utils/layout/tablet";

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
      if (pin == previousPin) {
        onSuccess?.();
        setOpen(false);
      } else {
        setAttempts(attempts + 1);
        setToast("Pin provided does not match", "error");
      }
    }
  };

  const title =
    stage === "enter-previous-pin"
      ? "Enter Previous PIN"
      : stage === "new-pin"
        ? "Enter New PIN"
        : "Confirm PIN";

  const subtitle =
    stage === "enter-previous-pin"
      ? "Enter your previous PIN to change pin"
      : stage === "new-pin"
        ? "Create a PIN to secure your account"
        : "Confirm your PIN to secure your account";

  const pinInput = (
    <OtpInput
      ref={otpRef}
      secureTextEntry={true}
      focusColor={"#971BB2"}
      theme={compactOtpInputTheme}
      textProps={{
        style: {
          fontFamily: "bold",
          fontSize: tabletSize(18),
          color: isDarkMode ? "white" : "black",
        },
      }}
      blurOnFilled={true}
      numberOfDigits={4}
      onFilled={(text) => {
        if (usage === "verify") {
          setPin(text);
          return;
        }
        if (stage === "new-pin") setPin(text);
        else if (stage === "enter-previous-pin") setEnterPreviousPin(text);
        else setConfirmPin(text);
      }}
    />
  );

  return (
    <DragableSheet
      close={() => setOpen(false)}
      panClose={true}
      snapPoints={["60%"]}
      child={
        usage === "verify" ? (
          <View className="py-4 w-full h-fit gap-y-8 flex-1 flex-col justify-start">
            <View className="w-full max-w-md self-center px-2">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[1.35rem] leading-8 text-center"
              >
                Enter your PIN
              </CText>
            </View>

            <View className="flex-1">
              <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 py-5 px-4">
                <View className="bg-white dark:bg-accent2 h-fit py-4 px-3 rounded-2xl items-center">
                  {pinInput}
                </View>
              </KeyboardAvoidingView>
            </View>

            <Buttons
              buttonType="pressable"
              onPress={() => {
                verifyPin();
              }}
              text="Confirm"
              type="primary"
            />
          </View>
        ) : (
          <View className="py-4 w-full h-fit gap-y-8 flex-1 flex-col justify-start">
            <View className="w-full max-w-md self-center px-2 gap-y-2">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[1.35rem] leading-8 text-center"
              >
                {title}
              </CText>
              <CText
                style={{ fontFamily: "md" }}
                className="text-[1.0625rem] leading-6 text-center text-black/80 dark:text-white/85"
              >
                {subtitle}
              </CText>
            </View>

            <View className="flex-1">
              <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 px-4 py-5">
                <View className="bg-white dark:bg-accent2 h-fit py-4 px-3 rounded-2xl items-center">
                  {pinInput}
                </View>
              </KeyboardAvoidingView>
            </View>

            {stage === "enter-previous-pin" ? (
              <Buttons
                buttonType="pressable"
                onPress={() => {
                  verifyPreviousPin();
                }}
                text="Verify"
                type="primary"
              />
            ) : (
              <>
                <Buttons
                  buttonType="pressable"
                  onPress={() => {
                    if (stage === "new-pin") {
                      if (pin.length < 4) {
                        setToast("PIN must be 4 digits", "error");
                      } else {
                        setStage("confirm-pin");
                        otpRef.current.clear();
                      }
                    } else {
                      handlePinChange();
                    }
                  }}
                  text={stage === "new-pin" ? "Next" : "Saved"}
                  type="primary"
                />
                {usage == "first-time" && stage == "new-pin" && (
                  <Buttons
                    buttonType="pressable"
                    onPress={() => {
                      setOpen(false);
                      setPinReminder(new Date().getTime() + 1000 * 30);
                      setStage("new-pin");
                      otpRef.current.clear();
                      setPin("");
                      setConfirmPin("");
                    }}
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
