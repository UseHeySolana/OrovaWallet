import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import { getKeypairFromMnemonic, isJson } from "@/misc/helpers/wallet";


import AppSettings from "@/misc/store/settingsstore";
import WalletItem from "@/misc/store/wallet";
import { saveWalletAddress } from "@/misc/helpers/db/db";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { pasteItem } from "@/misc/helpers/miscfunctions.ts";
import { useThemeContext } from "@/misc/context/ThemeContext";
import IconLibrary from "@/misc/helpers/icons";
import { useKeyboard } from "@/misc/context/KeyboardContext";
/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */

export default function ImportPhrase({ navigation }: any) {
  const { isDarkMode } = useThemeContext();
  const { isKeyboardVisible } = useKeyboard()
  const [mnemonic, setMnemonic] = useState("");
  const { isLoading, setLoading, setToast } = AppSettings()
  const { updateKeypair, updatePassphrase } = WalletItem();
  const { setUser, user } = UserItem();

  const importWallet = async () => {
    if (mnemonic == "") {
      setToast("No Phrase Imported", "error");
      setLoading(false);
      return;
    }

    if (isJson(mnemonic)) {
      if (JSON.parse(mnemonic).length != 64) {
        setToast("Awwn! this is not a valid private key!", "error");
        setLoading(false);

        return;
      }
    } else {
      if (mnemonic.trim().split(/\s+/).length != 12) {
        setToast("Invalid phrase!, phrase must be 12.", "error");
        setLoading(false);
        return;
      }
    }
    setLoading(true);

    try {
      const keyPair = await getKeypairFromMnemonic(mnemonic.trim());
      console.log(keyPair.publicKey, user);
      updatePassphrase(mnemonic.trim());
      // Only proceed once keypair is available
      if (keyPair && keyPair.publicKey && user) {
        try {
          const response = await saveWalletAddress(
            keyPair.publicKey.toBase58(),
            user.username
          );
          if (response.status !== false) {
            updateKeypair(keyPair);
            setToast("Wallet Created", "success");
            router.replace("/dashboard");
            setLoading(false);
          }
        } catch (error) {
          setLoading(false);
          console.error("Error saving wallet address:", error);
        }
      } else {
        setLoading(false);
        console.error(
          "Failed to generate keypair: keypair is null or undefined"
        );
      }
    } catch (error) {
      setLoading(false);
      console.error("Error generating keypair:", error);
    }
  };
  return (
    <View className="pt-4 relative bg-gray dark:bg-dark h-[100%]">
      <View className="gap-y-5 w-full px-4 flex flex-1 flex-col justify-start ">
        <View className=" bg-white dark:bg-accent rounded-3xl px-3 py-10 gap-y-5">
          <View className="gap-x-5">
            <CText
              style={{ fontFamily: "bold" }}
              className="text-[1.5em] text-center"
            >
              Import existing wallet
            </CText>
            <CText className="text-[1em] text-center">
              Enter the secret phrase to restore your Solana wallet.
            </CText>
          </View>

          <View className="w-100 m-auto bg-grey dark:bg-accent w-full rounded-2xl p-2  ">
            <View className="bg-white dark:bg-accent2 p-3 rounded-2xl">
              <View className="py-4">
                <CText className="text-[1em]" style={{ fontFamily: "bold" }}>
                  Secret Phrase or Private Key
                </CText>
              </View>
              <View className="border-b border-gray-200"></View>
              <View className="relative">
                <TextInput
                  style={{ fontFamily: "bold" }}
                  multiline
                  returnKeyType="done"
                  value={mnemonic}
                  numberOfLines={100}
                  className=" px-4  w-full h-[12.43rem] text-[1rem] text-dark dark:text-white"
                  onChangeText={(text) => {
                    setMnemonic(text);
                  }}
                />
                <View className="w-[6.25rem] absolute right-0 bottom-0">
                  <Buttons
                    buttonType="feedback"
                    type={isDarkMode ? "primary" : "secondary"}
                    onPress={async () => {
                      setMnemonic(await pasteItem());
                    }}
                    text="Paste"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
        <View className="bg-[#9DE0E5]/30 border-[##65F5FF33] border-2 rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start">
          <View className="1">
            <IconLibrary.question />
          </View>
          <View className="w-[12.5rem] flex-1 ">
            <CText
              style={{ fontFamily: "md" }}
              className="text-[1em] text-start text-wrap"
            >
              The secret phrase is typically 12 words separated by single
              spaces.
            </CText>
          </View>
        </View>
      </View>
      {!isKeyboardVisible && (
        <View className="w-full px-4 m-auto p-2 gap-y-3 bottom-10 relative">
          <Buttons onPress={importWallet} text="Import Wallet" />
          <Buttons
            buttonType="feedback"
            type="secondary"
            onPress={() => router.push("/auth/secretphrase")}
            text="I don't know what a secret phrase is"
          />
        </View>
      )}
    </View>
  );
}


