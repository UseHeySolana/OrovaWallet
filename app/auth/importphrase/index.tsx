import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import EvilIcons from '@expo/vector-icons/EvilIcons';
import Buttons from "@/components/ButtonComp";
import { generateMnemonic, getKeypairFromMnemonic } from "@/misc/helpers/wallet";
import * as Clipboard from 'expo-clipboard';
import { isJson } from "@/misc/helpers/ai";
import AppSettings from "@/misc/store/settingsstore";
import WalletItem from "@/misc/store/wallet";
import { fetchData, handleSearch, MessageData, saveWalletAddress } from "@/misc/helpers/db";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { pasteItem } from "@/misc/helpers/functions";
import { useThemeContext } from "@/misc/context/ThemeContext";
import IconLibrary from "@/misc/helpers/icons";
/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */

export default function ImportPhrase({ navigation }: any) {
  const { isDarkMode } = useThemeContext();
  const [mnemonic, setMnemonic] = useState("");
  const { isLoading, setLoading, setToast } = AppSettings()
  const { updateKeypair } = WalletItem()
  const { setUser, user } = UserItem()



  const importWallet = async () => {
    setLoading(true)
    if (mnemonic == "") {
      setToast("No Phrase Imported", "error")
      setLoading(false)
      return;
    }

    if (isJson(mnemonic)) {
      if (JSON.parse(mnemonic).length != 64) {
        setToast("Awwn! this is not a valid private key!", "error")
        setLoading(false)

        return;
      }
    } else {
      if (mnemonic.trim().split(/\s+/).length != 12) {
        setToast("Invalid phrase!, phrase must be 12.", "error")
        setLoading(false)
        return;
      }
    }

    try {
      const keyPair = await getKeypairFromMnemonic(mnemonic.trim());
      // Only proceed once keypair is available
      if (keyPair && keyPair.publicKey && user) {

        const response = await saveWalletAddress(keyPair.publicKey.toBase58(), user.username)
        if (response.status !== false) {
          await updateKeypair(keyPair);
          setToast("Wallet Created", 'success')
          router.replace('/dashboard')
          setLoading(false)
        }
      } else {
        setLoading(false);
        console.error("Failed to generate keypair: keypair is null or undefined");
      }
    } catch (error) {
      setLoading(false)
      console.error("Error generating keypair:", error);
    }
  }
  return (
    <View
      className="pt-4 relative bg-gray dark:bg-dark h-[100%]"
    >
      <View className="gap-y-5 w-full px-4 flex flex-1 flex-col justify-between ">
        <View className=" bg-white dark:bg-accent rounded-3xl px-3 py-10 gap-y-5">
          <View className="gap-x-5">
            <CText style={{ fontFamily: "bold" }} className="text-[24px] text-center">Import existing wallet</CText>
            <CText className="text-[16px] text-center">Enter the secret phrase to restore your Solana wallet.</CText>
          </View>

          <View className="w-100 m-auto bg-grey dark:bg-accent w-full rounded-2xl p-2  ">
            <View className="bg-white dark:bg-accent2 p-3 rounded-2xl">

              <View className="py-4">
                <CText className="text-[16px]" style={{ fontFamily: "bold" }} >Secret Phrase or Private Key</CText>
              </View>
              <View className="border-b border-gray-200">
              </View>
              <View className="relative">
                <TextInput
                  style={{ fontFamily: "bold", fontSize: 24, }}
                  multiline

                  value={mnemonic}
                  numberOfLines={100}
                  className=" px-4  w-full h-[250]  text-dark dark:text-white"
                  onChangeText={(text) => {
                    setMnemonic(text)
                  }}
                />
                <View className="w-[100px] absolute right-0 bottom-0">
                  <Buttons buttonType="feedback" type={isDarkMode ? "primary" : "secondary"} onPress={async () => {
                    setMnemonic(await pasteItem())
                  }} text="Paste" />

                </View>


              </View>

            </View>

          </View>

        </View>
        <View className="bg-[#9DE0E5]/30 border-[##65F5FF33] border-2 rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start">
          <View className="1">
            <IconLibrary.question />
          </View>
          <View className="w-[288px] ">

            <CText style={{ fontFamily: "md" }} className="text-[16px] text-start text-wrap">The secret phrase is typically 12 words separated by single spaces.</CText>
          </View>

        </View>

      </View>

      <View className="w-full px-4 m-auto p-2 gap-y-3  relative">
        <Buttons onPress={importWallet} text="Import Wallet" />
        <Buttons buttonType="feedback" type="secondary" onPress={() => router.push("/auth/secretphrase")} text="I don't know what a secret phrase is" />
      </View>

    </View>
  );
}


