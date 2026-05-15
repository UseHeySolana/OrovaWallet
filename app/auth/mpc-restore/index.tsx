import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { recoverSeedlessWallet } from "@/utils/wallet/recoverSeedlessWallet";
import { hasMpcShareA } from "@/utils/storage/mpcShareStore";
import { useThemeContext } from "@/context/ThemeContext";

export default function MpcRestoreScreen() {
  const { setToast } = AppSettings();
  const { user } = UserItem();
  const { isDarkMode } = useThemeContext();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [shareOnDevice, setShareOnDevice] = useState<boolean | null>(null);
  const autoUnlockStarted = useRef(false);

  const walletAddress = user?.wallet_address ?? "";
  const username = user?.username ?? "";

  const showError = (message: string) => {
    setStatus(message);
    setToast(message, "error");
  };

  const onPasskeyRestore = async () => {
    if (!walletAddress || !username) {
      showError("Account details missing. Sign in again.");
      router.replace("/auth/login");
      return;
    }

    setBusy(true);
    setStatus("Confirm with your passkey…");
    try {
      const result = await recoverSeedlessWallet({ walletAddress, username });
      if (!result.ok) {
        showError(result.message);
        if (result.needsDeviceLink) {
          router.replace("/auth/mpc-link");
        }
        return;
      }
      setToast(result.message, "success");
      router.replace("/dashboard");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      const hasShare = await hasMpcShareA();
      setShareOnDevice(hasShare);
      if (!hasShare) {
        router.replace("/auth/mpc-link");
        return;
      }
      if (!autoUnlockStarted.current) {
        autoUnlockStarted.current = true;
        void onPasskeyRestore();
      }
    })();
  }, [walletAddress, username]);

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-10">
      <View className="w-11/12 m-auto flex-row items-center gap-3 mb-4">
        <Pressable onPress={() => router.replace("/auth/login")} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]" style={{ fontFamily: "bold" }}>
          Unlock seedless wallet
        </CText>
      </View>

      <ScrollView className="w-11/12 m-auto" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="bg-white dark:bg-accent rounded-3xl p-6 items-center gap-y-4">
          <Image
            source={require("@/assets/items/wallet.png")}
            style={{ width: 200, height: 140 }}
            contentFit="contain"
          />
          <CText className="text-center text-[1.1rem]" style={{ fontFamily: "bold" }}>
            Welcome back, {username || "there"}
          </CText>
          <CText textColor="text-gray-500" className="text-center text-sm">
            Use your passkey to unlock this wallet. Your device key never leaves this phone.
          </CText>
          {walletAddress ? (
            <CText textColor="text-gray-400" className="text-sm text-center">
              {walletAddress}
            </CText>
          ) : null}
        </View>

        <View className="mt-6 gap-y-3">
          {status ? (
            <CText textColor="text-violet-600" className="text-center text-sm px-2">
              {status}
            </CText>
          ) : null}
          {busy || shareOnDevice === null ? (
            <ActivityIndicator color={isDarkMode ? "#fff" : "#971BB2"} />
          ) : shareOnDevice ? (
            <Buttons text="Sign in with Passkey" onPress={onPasskeyRestore} />
          ) : null}
          {!busy && shareOnDevice === false ? (
            <Buttons text="Link from primary phone" onPress={() => router.replace("/auth/mpc-link")} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
