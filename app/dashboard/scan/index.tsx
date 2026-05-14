import { useCallback, useRef } from "react";
import { Alert, Platform, Pressable, View } from "react-native";

import CText from "@/components/TextComp";
import { router } from "expo-router";
import IconLibrary from "@/utils/icons";
import Buttons from "@/components/ButtonComp";
import AntDesign from "@expo/vector-icons/AntDesign";
import WalletItem from "@/utils/store/wallet.store";
import { copyItem } from "@/utils/functions";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

export default function Scan() {
  const { publicKey } = WalletItem();
  const [permission, requestPermission] = useCameraPermissions();
  const scanCooldown = useRef(false);

  const share = async () => {
    // const available = Sharing.isAvailableAsync()
    // console.log(available);
  };

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (scanCooldown.current) return;
    scanCooldown.current = true;
    const { data } = result;
    Alert.alert("QR code scanned", data, [
      {
        text: "Copy",
        onPress: () => {
          void copyItem(data);
          scanCooldown.current = false;
        },
      },
      {
        text: "OK",
        style: "cancel",
        onPress: () => {
          scanCooldown.current = false;
        },
      },
    ]);
  }, []);

  const renderScanner = () => {
    if (Platform.OS === "web") {
      return (
        <View className="h-full w-full items-center justify-center bg-black/10 px-4">
          <CText className="text-center text-sm">QR scanning runs on the device camera (iOS / Android).</CText>
        </View>
      );
    }

    if (!permission) {
      return (
        <View className="h-full w-full items-center justify-center bg-black/10 px-4">
          <CText className="text-center text-sm">Checking camera permission…</CText>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View className="h-full w-full items-center justify-center gap-y-3 bg-black/10 px-4">
          <CText className="text-center text-sm">Allow camera access to scan QR codes.</CText>
          <Buttons
            buttonType="feedback"
            className="rounded-full px-6 py-3"
            onPress={() => void requestPermission()}
            type="primary"
            text="Enable camera"
          />
        </View>
      );
    }

    return (
      <CameraView
        facing="back"
        style={{ width: "100%", height: "100%" }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onBarcodeScanned}
      />
    );
  };

  return (
    <View className="relative flex-1 items-start justify-start gap-y-4 bg-grey px-4 pt-3 dark:bg-dark">
      <View className="w-full gap-y-4">
        <View className="flex w-full flex-row justify-start">
          <Pressable onPress={() => router.back()} className="rounded-full bg-white p-3 dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
        </View>

        <View className="m-auto flex h-fit w-[370px] flex-row items-center justify-center rounded-xl bg-white py-10 shadow dark:bg-accent">
          <View className="rounded-xl border border-purple/40 p-4">
            <CText className="mb-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Point the camera at a QR code (e.g. Solana address or link).
            </CText>
            <View className="h-[299] w-[299] overflow-hidden rounded-xl">{renderScanner()}</View>

            <View className="flex flex-row justify-between py-5">
              <View className="w-[45%]">
                <Buttons
                  buttonType="feedback"
                  className="rounded-full py-4"
                  onPress={share}
                  type="secondary"
                  text="Share"
                  icon={
                    <View className="rotate-[230deg]">
                      <AntDesign name="down" size={16} color="white" />
                    </View>
                  }
                />
              </View>
              <View className="w-[45%]">
                <Buttons
                  buttonType="feedback"
                  className="rounded-full py-4"
                  onPress={() => void copyItem(publicKey?.toString() ?? "")}
                  type="secondary"
                  text="Copy"
                  icon={
                    <View>
                      <IconLibrary.copy />
                    </View>
                  }
                />
              </View>
            </View>
          </View>
        </View>

        <View className="flex flex-row items-start justify-start gap-x-2 rounded-3xl border-2 border-[#65F5FF33] bg-[#9DE0E5]/30 p-4">
          <View>
            <IconLibrary.question />
          </View>
          <View className="w-[288px]">
            <CText style={{ fontFamily: "md" }} className="text-start text-[16px] text-wrap">
              Use this address to receive tokens and collectibles on the Solana network only..
            </CText>
          </View>
        </View>
      </View>
    </View>
  );
}
