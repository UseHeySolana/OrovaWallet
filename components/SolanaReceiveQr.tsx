import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { scale } from "react-native-size-matters";

import Buttons from "@/components/ButtonComp";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { copyItem } from "@/utils/functions";
import WalletItem from "@/utils/store/wallet.store";

export default function SolanaReceiveQr() {
  const { publicKey } = WalletItem();
  const [walletAddress, setWalletAddress] = useState("Testing");
  const qrcode = useRef(null);

  useEffect(() => {
    if (publicKey) {
      setWalletAddress(publicKey.toString());
    }
  }, [publicKey]);

  const share = async () => {
    if (qrcode.current == null) {
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return;
    }

    const result = await captureRef(qrcode.current, {
      result: "tmpfile",
      quality: 1,
      format: "png",
    });

    await Sharing.shareAsync(result);
  };

  return (
    <View className="gap-y-4 pb-8">
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
                type="primary"
                text="Share"
                icon={
                  <View className="rotate-[270deg]">
                    <AntDesign name="down" size={16} color="white" />
                  </View>
                }
              />
            </View>
            <View className="w-[45%]">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={async () => await copyItem(publicKey?.toString() || "")}
                type="primary"
                text="Copy"
                icon={
                  <View className="">
                    <IconLibrary.copy color="white" />
                  </View>
                }
              />
            </View>
          </View>
        </View>
      </View>

      <View className="bg-[#9DE0E5]/30 border-[##65F5FF33] border-2 rounded-3xl p-4 flex flex-row gap-x-2 justify-start items-center">
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
            Use this address only for Solana network transfers.
          </CText>
        </View>
      </View>
    </View>
  );
}
