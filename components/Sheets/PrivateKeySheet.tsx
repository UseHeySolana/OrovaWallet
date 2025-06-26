import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { OtpInput } from "react-native-otp-entry";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Buttons from "../ButtonComp";
import React, { useEffect, useRef, useState } from "react";
import AppSettings from "@/misc/store/settingsstore";
import { copyItem } from "@/misc/helpers/miscfunctions.ts";
import WalletItem from "@/misc/store/wallet";
import { keypairSign } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import { Keypair } from "@solana/web3.js";

interface PrivateKeySheetTypes {
  open: boolean;

  setOpen: (open: boolean) => void;
  type: "private-key" | "passphrase";
}
const PrivateKeySheet = ({ open, setOpen, type }: PrivateKeySheetTypes) => {
  const { isDarkMode } = useThemeContext();
  if (!open) return null;
  const [privateKey, setPrivateKey] = useState<any | null>(null);
  const { setToast } = AppSettings();

  useEffect(() => {
    (async () => {
      if (type === "private-key") {
        const sign = await keypairSign();
        if (sign) {
          const key = Array.from(sign.secretKey);
          setPrivateKey(key);
        }
      } else {
        setPrivateKey(WalletItem.getState().passphrase);
      }
    })();
  }, []);

  const copyValue = () => {
    if (type === "private-key") {
      copyItem(privateKey?.secretKey || "");
      setToast("Copied to clipboard", "success");
    } else {
      copyItem(privateKey?.secretKey.toString() || "");
    }
  };

  return (
    <DragableSheet
      close={() => setOpen(false)}
      panClose={true}
      snapPoints={["60%"]}
      child={
        <View className=" py-4 w-full h-fit gap-y-10 flex-1 flex-col justify-start ">
          <View className="w-8/12 m-auto">
            <CText
              style={{ fontFamily: "bold" }}
              className="text-[20px] text-center"
            >
              {type === "private-key" ? "Your Private Key" : "Your Passphrase"}
            </CText>
          </View>

          <View className="flex-1">
            <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 px-4 py-5">
              <View className="bg-white dark:bg-accent2 h-fit p-5 rounded-2xl">
                <CText
                  selectable={true}
                  style={{ fontFamily: "bold" }}
                  className="text-[1.55rem] "
                >
                  {type === "private-key"
                    ? JSON.stringify(privateKey)
                    : privateKey}
                </CText>
              </View>
            </KeyboardAvoidingView>
          </View>

          <Buttons
            buttonType="pressable"
            onPress={() => {
              copyValue();
            }}
            className=""
            text={"Copy"}
            type="primary"
          />
        </View>
      }
    />
  );
};

export default PrivateKeySheet;
