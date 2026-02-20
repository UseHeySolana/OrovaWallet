import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";

import { scale } from 'react-native-size-matters';
import { router } from "expo-router";


import IconLibrary from "@/utils/icons";

import QRCode from "react-native-qrcode-svg";
import Buttons from "@/components/ButtonComp";
import AntDesign from "@expo/vector-icons/AntDesign";
import EvilIcons from "@expo/vector-icons/EvilIcons";
import WalletItem from "@/utils/store/wallet.store";

import * as Sharing from "expo-sharing";
import { copyItem } from "@/utils/functions";
import { captureRef } from 'react-native-view-shot';
import RNFS from "react-native-fs"


export default function QrCode() {

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
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
        </View>

        <View
          style={{
            width: scale(320),
            padding: scale(10),
          }}
          className="flex bg-white shadow-sm rounded-xl dark:bg-accent h-fit m-auto flex-row justify-center items-center "
        >
          <View className=" border border-purple/40 p-4 rounded-xl">
            <View
              ref={qrcode}
              style={{
                width: scale(250),
                height: scale(250),
              }}
              className=" overflow-hidden rounded-xl"
            >
              <QRCode
                value={walletAddress}
                size={scale(249)}
                logo={require("@/assets/images/ballicon.png")}
                logoBackgroundColor="transparent"
              />
            </View>

            <View className="flex flex-row justify-between py-5">
              <View className="w-[45%]">
                <Buttons
                  buttonType="feedback"
                  className="py-4 rounded-full"
                  onPress={share}
                  type="secondary"
                  text="Share"
                  icon={
                    <View className="rotate-[230deg]">
                      <AntDesign name="arrowdown" size={16} color="white" />
                    </View>
                  }
                />
              </View>
              <View className="w-[45%]">
                <Buttons
                  buttonType="feedback"
                  className="py-4 rounded-full"
                  onPress={async () =>
                    await copyItem(publicKey?.toString() || "")
                  }
                  type="secondary"
                  text="Copy"
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
          <View
            style={{
              width: scale(280),
            }}
          >
            <CText
              style={{ fontFamily: "md" }}
              className="text-[1.rem] text-start text-wrap"
            >
              Use this address to receive tokens and collectibles on the Solana
              network only..
            </CText>
          </View>
        </View>
      </View>
    </View>
  );
}
