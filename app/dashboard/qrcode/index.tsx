import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";

import { router } from "expo-router";


import IconLibrary from "@/misc/helpers/icons";

import QRCode from 'react-native-qrcode-svg';
import Buttons from "@/components/ButtonComp";
import AntDesign from "@expo/vector-icons/AntDesign";
import EvilIcons from "@expo/vector-icons/EvilIcons";
import WalletItem from "@/misc/store/wallet";

import * as Sharing from 'expo-sharing';
import { copyItem } from "@/misc/helpers/functions";
import { captureRef } from 'react-native-view-shot';
import RNFS from "react-native-fs"


function Scan() {

  const { publicKey } = WalletItem()

  const [walletAddress, setWalletAddress] = useState('Testing')
  const qrcode = useRef(null)

  useEffect(() => {
    if (publicKey) {
      setWalletAddress(publicKey.toString())
    }
  }, [publicKey])
  const share = async () => {
    if (qrcode.current == null) {
      return
    }
    const available = await Sharing.isAvailableAsync()
    if (available) {
      const result = await captureRef(qrcode.current, {
        result: 'tmpfile',
        quality: 1,
        format: 'png',
      });

      await Sharing.shareAsync(result)
    } else {
      return
    }
  }

  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full gap-y-4">

        <View className="w-full  flex flex-row justify-start">
          <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
        </View>
        <View ref={qrcode} className="flex bg-white shadow rounded-xl dark:bg-accent h-fit py-10 w-[370px] m-auto flex-row justify-center items-center ">
          <View className=" border border-purple/40 p-4 rounded-xl">
            <View className="h-[299] w-[299] overflow-hidden rounded-xl">
              <QRCode
                value={walletAddress}
                size={300}
                logo={require('@/assets/images/icon.png')}
                logoBackgroundColor="transparent"
              />
            </View>

            <View className="flex flex-row justify-between py-5">
              <View className="w-[45%]">
                <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={share} type="secondary" text="Share" icon={
                  <View className="rotate-[230deg]">
                    <AntDesign name="arrowdown" size={16} color="white" />
                  </View>
                } />
              </View>
              <View className="w-[45%]">
                <Buttons buttonType="feedback" className="py-4 rounded-full" onPress={
                  async () => await copyItem(publicKey?.toBase58() || "")
                } type="secondary" text="Copy"
                  icon={
                    <View className="">
                      <IconLibrary.copy />

                    </View>
                  }
                />
              </View>
            </View>




          </View>
        </View>


        <View className="bg-[#9DE0E5]/30 border-[##65F5FF33] border-2 rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start">
          <View className="1">
            <IconLibrary.question />
          </View>
          <View className="w-[288px] ">

            <CText style={{ fontFamily: "md" }} className="text-[16px] text-start text-wrap">Use this address to receive tokens and collectibles on the Solana network only..</CText>
          </View>

        </View>





      </View>




    </View>
  );
}

export default Scan

