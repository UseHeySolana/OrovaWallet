import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { recoverSeedlessWallet } from "@/utils/wallet/recoverSeedlessWallet";
import { useThemeContext } from "@/context/ThemeContext";

export default function MpcRestoreScreen() {
  const { setToast } = AppSettings();
  const { user } = UserItem();
  const { isDarkMode } = useThemeContext();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

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
    setStatus("Checking passkey on this device…");
    try {
      const result = await recoverSeedlessWallet({ walletAddress, username });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      setToast(result.message, "success");
      router.replace("/dashboard");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-10">
      <View className="w-11/12 m-auto flex-row items-center gap-3 mb-4">
        <Pressable onPress={() => router.replace("/auth/login")} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]" style={{ fontFamily: "bold" }}>
          Restore seedless wallet
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
            Your device key stays on your phone only. The server holds one share for signing — never
            the full key. On a new phone, link from your primary device.
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
          {busy ? (
            <ActivityIndicator color={isDarkMode ? "#fff" : "#971BB2"} />
          ) : (
            <>
              <Buttons
                text="Link from primary phone"
                onPress={() => router.push("/auth/mpc-link")}
              />
              <Buttons
                text="Use synced passkey (same Apple ID)"
                type="secondary"
                onPress={onPasskeyRestore}
              />
            </>
          )}
          <Pressable onPress={() => router.replace("/auth/importphrase")} className="py-3">
            <CText className="text-center text-violet-600 dark:text-violet-300">
              Use recovery phrase instead
            </CText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
