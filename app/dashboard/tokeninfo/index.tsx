import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router, useLocalSearchParams } from "expo-router";
import { Keypair } from "@solana/web3.js";
import UserItem from "@/misc/store/userstore";


/**
  * What should be done here
  * Show token info
  * Show charts
  */
function TokenInfo() {
  const [recording, setRecording] = useState(false);

  const { mint } = useLocalSearchParams();

  useEffect(() => {

  }, [mint])


  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);


  return (
    <View
      className="relative h-full w-100 flex items-center"
    >
      <View className="h-full  w-100 m-auto flex justify-center items-start">
        <View className="w-11/12 m-auto p-2">
          <View className="">
            <CText className="text-[75px] text-purple font-bold">"</CText>
            <CText style={{ fontFamily: "bold" }} className="text-[80px] text-wrap">Hey Solana, send 5 SOL to Alex</CText>
            <CText className="text-[75px] text-purple font-bold self-end rotate-180">"</CText>
          </View>
          <View>
            <CText className="text-[32px] text-gray-400">Let’s register your voice! say the big text you see on your screen, LFG</CText>
          </View>
        </View>

      </View>



    </View>
  );
}

export default TokenInfo

