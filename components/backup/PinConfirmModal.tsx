import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";

import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { useThemeContext } from "@/context/ThemeContext";
import { compactOtpInputTheme } from "@/components/otpInputTheme";

type PinConfirmModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
};

export default function PinConfirmModal({
  visible,
  title,
  subtitle,
  confirmLabel = "Confirm",
  loading = false,
  onClose,
  onConfirm,
}: PinConfirmModalProps) {
  const { isDarkMode } = useThemeContext();
  const otpRef = useRef<OtpInputRef>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!visible) {
      setPin("");
      otpRef.current?.clear();
    }
  }, [visible]);

  const handleClose = () => {
    setPin("");
    otpRef.current?.clear();
    onClose();
  };

  const handleConfirm = () => {
    if (pin.length < 4) return;
    onConfirm(pin);
  };

  if (!visible) return null;

  return (
    <DragableSheet
      snapPoints={["58%"]}
      panClose
      close={handleClose}
      child={
        <View className="py-4 w-full h-fit gap-y-8 flex-1 flex-col justify-between">
          <View className="w-full gap-y-2">
            <CText style={{ fontFamily: "bold" }} className="text-[1.2rem] text-center">
              {title}
            </CText>
            <CText
              style={{ fontFamily: "md" }}
              textColor="text-purple"
              className="text-[0.85rem] text-center px-2"
            >
              {subtitle}
            </CText>
          </View>

          <View className="flex-1">
            <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 px-4 py-5">
              <View className="bg-white dark:bg-accent2 h-fit py-3 px-2 rounded-2xl items-center">
                <OtpInput
                  ref={otpRef}
                  secureTextEntry
                  focusColor="purple"
                  numberOfDigits={4}
                  blurOnFilled
                  theme={compactOtpInputTheme}
                  textProps={{
                    style: {
                      fontFamily: "bold",
                      color: isDarkMode ? "white" : "black",
                    },
                  }}
                  onFilled={(value) => setPin(value)}
                  onTextChange={(value) => setPin(value)}
                />
              </View>
            </KeyboardAvoidingView>
          </View>

          <Buttons
            buttonType="pressable"
            onPress={handleConfirm}
            text={confirmLabel}
            loading={loading}
            type="primary"
          />
        </View>
      }
    />
  );
}
