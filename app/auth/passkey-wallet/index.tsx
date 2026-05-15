import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { saveWalletAddress } from "@/utils/request/db";
import { createSeedlessPasskeyWallet } from "@/utils/wallet/createSeedlessWallet";

const highlights = [
  "No seed phrase to write down",
  "Unlock with Face ID or fingerprint",
  "Your keys are split between device and server",
];

export default function PasskeyWalletOnboarding() {
  const { setLoading, isLoading, setToast } = AppSettings();
  const { user } = UserItem();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.wallet_type === "mpc" && user?.wallet_address) {
      router.replace("/auth/mpc-restore");
    }
  }, [user?.wallet_type, user?.wallet_address]);

  const onCreate = async () => {
    if (user?.wallet_type === "mpc" && user?.wallet_address) {
      setToast("You already have a seedless wallet. Restoring instead.", "info");
      router.replace("/auth/mpc-restore");
      return;
    }
    setBusy(true);
    setLoading(true);
    try {
      const result = await createSeedlessPasskeyWallet({
        username: user?.username,
      });
      if (!result.ok || !result.walletAddress) {
        if (result.message?.includes("already has a seedless wallet")) {
          setToast(result.message, "error");
          router.replace("/auth/mpc-restore");
          return;
        }
        setToast(result.message, "error");
        return;
      }

      if (user?.username) {
        const saved = await saveWalletAddress(result.walletAddress, user.username);
        if (saved.status === false) {
          setToast(saved.message ?? "Could not link wallet to account", "error");
          return;
        }
        setToast("Seedless wallet ready", "success");
        router.replace("/dashboard");
        return;
      }

      setToast("Wallet created — finish signing up to link it", "success");
      router.replace("/auth/username");
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-10">
      <View className="w-11/12 m-auto flex-row items-center gap-3 mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]" style={{ fontFamily: "bold" }}>
          Seedless wallet
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
            The simple way to hold SOL
          </CText>
          <CText textColor="text-gray-500" className="text-center">
            Recommended for new Hey Solana users. No recovery phrase on day one.
          </CText>
        </View>

        <View className="bg-white dark:bg-accent rounded-3xl p-5 mt-4 gap-y-2">
          {highlights.map((line) => (
            <CText key={line} textColor="text-gray-600 dark:text-gray-300">
              • {line}
            </CText>
          ))}
        </View>

        <View className="mt-6 gap-y-3">
          {busy || isLoading ? (
            <ActivityIndicator />
          ) : (
            <Buttons text="Create seedless wallet" onPress={onCreate} />
          )}
          <Pressable onPress={() => router.push("/auth/secretphrase")} className="py-3">
            <CText className="text-center text-violet-600 dark:text-violet-300">
              Use recovery phrase instead
            </CText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
