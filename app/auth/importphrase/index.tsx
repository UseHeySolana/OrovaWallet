import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native";
import { CText } from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import { validateMnemonic } from "bip39";
import { getKeypairFromMnemonic, isJson } from "@/utils/wallet";
import { createWalletForUser } from "@/utils/wallet/createWalletForUser";

import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { saveWalletAddress } from "@/utils/request/db";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import { pasteItem } from "@/utils/functions";
import { setWalletSecret } from "@/utils/storage/secureStore";

import { useThemeContext } from "@/context/ThemeContext";
import IconLibrary from "@/utils/icons";
import { useKeyboard } from "@/context/KeyboardContext";
/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */

export default function ImportPhrase({ navigation }: any) {
  const { isDarkMode } = useThemeContext();
  const [mnemonic, setMnemonic] = useState("");
  const { setLoading, setToast } = AppSettings()
  const { updateKeypair, updatePassphrase } = WalletItem();
  const { user, setUser } = UserItem();
  const { isKeyboardVisible } = useKeyboard();

  const secretErrorMessage = (value: string) => {
    const trimmed = value.trim();
    if (isJson(trimmed)) {
      return "That private key is not valid. Paste the full key, or enter your 12-word phrase.";
    }
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.length !== 12 && words.length !== 24) {
      return `A secret phrase is 12 or 24 words. This one has ${words.length}.`;
    }
    return "That secret phrase is not valid. Check the spelling of each word and try again.";
  };

  const importWallet = async () => {
    const trimmed = mnemonic.trim().replace(/\s+/g, " ");
    if (trimmed === "") {
      setToast("Enter a secret phrase or private key first.", "error");
      return;
    }

    if (isJson(trimmed)) {
      try {
        if (JSON.parse(trimmed).length !== 64) {
          setToast(secretErrorMessage(trimmed), "error");
          return;
        }
      } catch {
        setToast(secretErrorMessage(trimmed), "error");
        return;
      }
    } else if (trimmed.includes(" ") && !validateMnemonic(trimmed)) {
      setToast(secretErrorMessage(trimmed), "error");
      return;
    }

    setLoading(true);

    try {
      const keyPair = await getKeypairFromMnemonic(trimmed);
      if (!keyPair?.publicKey || !user?.username) {
        setToast("Sign in again, then import the phrase.", "error");
        return;
      }

      try {
        await setWalletSecret(trimmed);
      } catch (e) {
        setToast("Could not save your phrase securely on this device.", "error");
        console.error("setWalletSecret failed:", e);
        return;
      }

      updatePassphrase(trimmed);
      const response = await saveWalletAddress(
        keyPair.publicKey.toBase58(),
        user.username
      );
      if (response.status === false) {
        setToast(response.message || "Could not import this wallet.", "error");
        return;
      }

      updateKeypair(keyPair);
      setUser({
        ...user,
        wallet_address: keyPair.publicKey.toBase58(),
      });
      setToast("Wallet restored", "success");
      router.replace("/dashboard");
    } catch (error) {
      console.error("Error generating keypair:", error);
      setToast(secretErrorMessage(trimmed), "error");
    } finally {
      setLoading(false);
    }
  };

  const createNewWallet = async () => {
    if (!user?.username) {
      setToast("Sign in again, then create a wallet.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await createWalletForUser(user.username);
      if (!result.success) {
        setToast(result.message, "error");
        return;
      }
      setToast("Wallet ready", "success");
      router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  };
  return (
    <KeyboardAvoidingView
      className="bg-gray dark:bg-dark flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
    >
      <View className="flex-1 pt-4">
        <View className="gap-y-5 w-full px-4 flex flex-1 flex-col justify-start ">
          <View className=" bg-white dark:bg-accent rounded-3xl px-3 py-10 gap-y-5">
            <View className="gap-x-5">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[1.5rem] leading-8 text-center"
              >
                Import existing wallet
              </CText>
              <CText className="text-[1.0625rem] leading-6 text-center text-black/80 dark:text-white/85">
                Enter the secret phrase to restore your Solana wallet.
              </CText>
            </View>

            <View className="w-100 m-auto bg-grey dark:bg-accent w-full rounded-2xl p-2  ">
              <View className="bg-white dark:bg-accent2 p-3 rounded-2xl">
                <View className="py-4">
                  <CText className="text-[1.0625rem] leading-6" style={{ fontFamily: "bold" }}>
                    Secret Phrase or Private Key
                  </CText>
                </View>
                <View className="border-b border-gray-200"></View>
                <View className="relative">
                  <TextInput
                    style={{ fontFamily: "bold" }}
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                    showSoftInputOnFocus
                    value={mnemonic}
                    numberOfLines={100}
                    className="px-4 w-full h-[12.43rem] text-[1.0625rem] leading-6 text-dark dark:text-white"
                    onChangeText={(text) => {
                      setMnemonic(text);
                    }}
                    onSubmitEditing={Keyboard.dismiss}
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
                className="text-[1.0625rem] leading-6 text-start text-wrap"
              >
                The secret phrase is typically 12 words separated by single
                spaces.
              </CText>
            </View>
          </View>

          <View className="w-full px-0 m-auto p-2 gap-y-3 mt-auto pb-4">
            {!isKeyboardVisible ? (
              <Buttons
                onPress={() => {
                  Keyboard.dismiss();
                  return importWallet();
                }}
                text="Import Wallet"
              />
            ) : (
              <Buttons
                onPress={() => {
                  Keyboard.dismiss();
                }}
                text="Done"
              />
            )}
            <Buttons
              buttonType="feedback"
              type="secondary"
              onPress={() => {
                Keyboard.dismiss();
                return createNewWallet();
              }}
              text="Create a new wallet instead"
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


