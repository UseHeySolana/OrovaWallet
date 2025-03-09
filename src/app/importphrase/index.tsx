import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import CText from "@/src/components/TextComp";
import DragableSheet from "@/src/components/CustomItems/DragableSheet";
import EvilIcons from '@expo/vector-icons/EvilIcons';
import Buttons from "@/src/components/ButtonComp";
import { generateMnemonic } from "@/src/misc/helpers/wallet";
import * as Clipboard from 'expo-clipboard';
import { isJson } from "@/src/misc/helpers/ai";
/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */

export default function ImportPhrase({ navigation }: any) {
  const [mnemonic, setMnemonic] = useState(""); 

  const importWallet = async () => {
    console.log("Importing")
    if (mnemonic == "") {
        Alert.alert("No Phrase Imported", "error")
        return;
    }

    if (isJson(mnemonic)) {
        if (JSON.parse(mnemonic).length != 64) {
            Alert.alert("Awwn! this is not a valid private key!", "error")
            return;
        }
    } else {
        if (mnemonic.trim().split(/\s+/).length != 12) {
            Alert.alert("Invalid phrase!, phrase must be 12.", "error")
            return;
        }
    }

    // const keypair = await getKeypairFromMnemonic(mnemonic);
// console.log(keypair)
    // const checkAddress = handleSearch(keypair.publicKey.toBase58(), users)
    // if (checkAddress.length > 0) {
    //     location.href = '/home';
    //     storage.set('mnemonic', mnemonic)
    //     storage.set('user_id', checkAddress[0].id)
    // } else {

    // }
}
  return (
    <View
      className="py-10 relative  h-[100%]"
    >
      <View className="gap-y-5 w-full px-4">
        <View className=" bg-white rounded-3xl px-3 py-10 gap-y-5">
          <View className="gap-x-5">
            <CText style={{ fontFamily: "bold" }} className="text-[24px] text-center">Import existing wallet</CText>
            <CText className="text-[16px] text-center">Enter the secret phrase to restore your Solana wallet.</CText>
          </View>

          <View className="w-100 m-auto bg-grey w-full rounded-2xl p-2  ">
            <View className="bg-white p-3 rounded-2xl">

              <View className="py-4">
                <CText className="text-[16px]" style={{ fontFamily: "bold" }} >Secret Phrase or Private Key</CText>
              </View>
              <View className="border-b border-gray-200">
              </View>
              <View className="relative">
                <TextInput

                  style={{ fontFamily: "bold", height: 200 }}
                  multiline
                  numberOfLines={100}
                  className="py-5  text-start text-[20px] w-full h-full"
                  onChangeText={(text) => {
                    setMnemonic(text)
                  }}
                />
                <View className="w-[100px] absolute right-0 bottom-0">
                  <Buttons buttonType="feedback" type="secondary" onPress={() => navigation.navigate("SecretPhrase")} text="Paste" />

                </View>


              </View>

            </View>

          </View>

        </View>


        <View className="bg-[#9DE0E5]/30 border-[##65F5FF33] border-2 rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start">
          <View className="1">
            <EvilIcons name="question" size={24} color="black" />
          </View>
          <View className="w-[288px] ">

            <CText style={{ fontFamily: "md" }} className="text-[16px] text-start text-wrap">The secret phrase is typically 12 words separated by single spaces.</CText>
          </View>

        </View>

      </View>

      <View className="w-full px-4 m-auto p-2 gap-y-3 bottom-10 absolute">
        <Buttons onPress={importWallet} text="Import Wallet" />
        <Buttons buttonType="feedback" type="secondary" onPress={() => navigation.navigate("SecretPhrase")} text="I don't know what a secret phrase is" />
      </View>

    </View>
  );
}


