import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import {
  upgradeToSeedlessWallet,
  removeMnemonicAfterSeedlessUpgrade,
  canOfferSeedlessUpgrade,
} from "@/utils/wallet/upgradeToPasskeyWallet";
import { confirm } from "@/services/confirmation";
import * as LocalAuthentication from "expo-local-authentication";

export default function SeedlessUpgradeScreen() {
  const { isDarkMode } = useThemeContext();
  const { setToast, walletMode } = AppSettings();
  const { user } = UserItem();
  const { publicKeyBase58 } = WalletItem();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [step, setStep] = useState<"intro" | "done">("intro");

  const username = user?.username ?? "";
  const walletAddress = publicKeyBase58 ?? user?.wallet_address ?? "";

  const refresh = useCallback(async () => {
    const offer = await canOfferSeedlessUpgrade();
    setCanUpgrade(offer);
    if (walletMode === "mpc") {
      setStep("done");
    }
  }, [walletMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUpgrade = async () => {
    if (!username) {
      setToast("Sign in with your account first", "error");
      return;
    }

    if (!canUpgrade) {
      setToast("Unlock your wallet from the home screen, then try again", "error");
      return;
    }

    let confirmed = false;
    try {
      confirmed = await confirm({
        message:
          "Upgrade to a seedless wallet? Your Solana address stays the same. Your recovery phrase stays on this device until you remove it.",
      });
    } catch {
      setToast("Could not show confirmation. Restart the app and try again.", "error");
      return;
    }
    if (!confirmed) return;

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (hasHardware) {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (enrolled) {
        const bio = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm seedless upgrade",
          cancelLabel: "Cancel",
        });
        if (!bio.success) {
          setToast("Authentication cancelled", "info");
          return;
        }
      }
    }

    setLoading(true);
    setStatus("Verifying wallet…");
    try {
      setStatus("Securing your wallet…");
      const result = await upgradeToSeedlessWallet({ username, walletAddress });
      if (!result.ok) {
        setToast(result.message, "error");
        return;
      }
      setToast(result.message, "success");
      setStep("done");
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upgrade failed";
      setToast(msg, "error");
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[SeedlessUpgrade]", e);
      }
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const onRemoveMnemonic = async () => {
    let confirmed = false;
    try {
      confirmed = await confirm({
        message:
          "Remove your recovery phrase from this device? Only do this after saving a backup.",
      });
    } catch {
      return;
    }
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await removeMnemonicAfterSeedlessUpgrade({
        username,
        walletAddress: walletAddress || publicKeyBase58 || "",
      });
      setToast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        router.replace("/dashboard");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not remove phrase", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-3">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5 mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Seedless wallet</CText>
      </View>

      <ScrollView className="px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-white dark:bg-accent rounded-2xl p-4 gap-y-3">
          {walletMode === "mpc" || step === "done" ? (
            <>
              <CText className="text-[1.1rem]" style={{ fontFamily: "bold" }}>
                Seedless wallet active
              </CText>
              <CText textColor="text-gray-500">
                Device share stays on your phone only. Server holds one share for signing — never
                the full key. Link another phone from Security → Approve new device.
              </CText>
              {walletAddress ? (
                <CText textColor="text-gray-400" className="text-sm">
                  {walletAddress}
                </CText>
              ) : null}
              <Buttons
                text="Approve new device"
                onPress={() => router.push("/settings/security/approve-device-link")}
                disabled={loading}
              />
              <Buttons
                text="Remove recovery phrase from device"
                onPress={onRemoveMnemonic}
                disabled={loading}
              />
              <Buttons
                text="Back to wallet"
                type="secondary"
                onPress={() => router.replace("/dashboard")}
                disabled={loading}
              />
            </>
          ) : (
            <>
              <CText className="text-[1.1rem]" style={{ fontFamily: "bold" }}>
                Upgrade to seedless
              </CText>
              <CText textColor="text-gray-500">
                No seed phrase to manage. Same Solana address. Your key is split on this
                device — the full key never leaves your phone.
              </CText>
              <View className="gap-y-1 mt-2">
                <CText textColor="text-gray-500">• Same wallet address</CText>
                <CText textColor="text-gray-500">• Face ID / fingerprint to unlock</CText>
                <CText textColor="text-gray-500">• Remove recovery phrase when ready</CText>
              </View>
              {!canUpgrade ? (
                <CText textColor="text-red-500" className="mt-2">
                  Unlock your wallet from the home screen, then return here.
                </CText>
              ) : null}
              {status ? (
                <CText textColor="text-violet-600" className="mt-2 text-center">
                  {status}
                </CText>
              ) : null}
              {loading ? (
                <ActivityIndicator className="mt-4" color={isDarkMode ? "#fff" : "#000"} />
              ) : (
                <Buttons
                  text="Enable seedless wallet"
                  onPress={onUpgrade}
                  disabled={!canUpgrade || loading}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
