import React, { useCallback, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  approveDeviceLinkOnPrimary,
  approveDeviceLinkByCode,
  parseDeviceLinkQr,
} from "@/utils/wallet/linkSeedlessDevice";

export default function ApproveDeviceLinkScreen() {
  const { setToast } = AppSettings();
  const { user } = UserItem();
  const { publicKeyBase58 } = WalletItem();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const scanLock = useRef(false);

  const walletAddress = publicKeyBase58 ?? user?.wallet_address ?? "";
  const username = user?.username ?? "";

  const handleApprove = async (linkId: string, newDevicePublicKey: string) => {
    if (!walletAddress || !username) {
      setToast("Unlock your wallet first", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await approveDeviceLinkOnPrimary({
        linkId,
        walletAddress,
        username,
        newDevicePublicKeyBase64: newDevicePublicKey,
      });
      setToast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.back();
    } finally {
      setBusy(false);
    }
  };

  const onScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanLock.current) return;
      const parsed = parseDeviceLinkQr(result.data);
      if (!parsed) return;
      scanLock.current = true;
      const lookup = await import("@/utils/request/mpcDeviceLink").then((m) =>
        m.lookupDeviceLinkByCode(parsed.linkCode || "")
      );
      if (!lookup.status) {
        setToast(lookup.message, "error");
        scanLock.current = false;
        return;
      }
      await handleApprove(lookup.data.link_id, lookup.data.new_device_public_key);
      scanLock.current = false;
    },
    [walletAddress, username]
  );

  const onCodeApprove = async () => {
    if (!code.trim()) {
      setToast("Enter the link code from your other phone", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await approveDeviceLinkByCode(code.trim().toUpperCase(), username, walletAddress);
      setToast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-3">
      <View className="w-full px-4 flex-row items-center gap-x-5 mb-4">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Approve new device</CText>
      </View>

      <View className="px-4 gap-y-4 flex-1">
        <CText textColor="text-gray-500" className="text-sm">
          Scan the QR or enter the code shown on your other phone. You'll confirm with Face ID.
          Your device share is sent encrypted — it is not stored on our servers.
        </CText>

        {Platform.OS !== "web" && permission?.granted ? (
          <View className="h-56 rounded-2xl overflow-hidden">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onScan}
            />
          </View>
        ) : (
          <Buttons
            text={permission?.granted ? "Camera ready" : "Allow camera to scan"}
            onPress={() => void requestPermission()}
          />
        )}

        <TextInput
          className="bg-white dark:bg-accent rounded-xl p-4 text-dark dark:text-white"
          placeholder="Or enter link code"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <Buttons text="Approve with code" onPress={onCodeApprove} disabled={busy} loading={busy} />
      </View>
    </View>
  );
}
