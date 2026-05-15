import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import AppSettings from "@/utils/store/settingsstore.store";
import { canOfferSeedlessUpgrade } from "@/utils/wallet/upgradeToPasskeyWallet";

const REMINDER_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 3;

/**
 * Soft reminder for legacy mnemonic users to upgrade to passkey/MPC wallet.
 */
export default function MpcUpgradeBanner() {
  const { walletMode, mpcUpgradeReminderDismissedAt, dismissMpcUpgradeReminder } =
    AppSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      if (walletMode === "mpc") {
        setVisible(false);
        return;
      }
      if (mpcUpgradeReminderDismissedAt) {
        const elapsed = Date.now() - mpcUpgradeReminderDismissedAt;
        if (elapsed < REMINDER_COOLDOWN_MS) {
          setVisible(false);
          return;
        }
      }
      const offer = await canOfferSeedlessUpgrade();
      setVisible(offer);
    })();
  }, [walletMode, mpcUpgradeReminderDismissedAt]);

  if (!visible) return null;

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-violet-100 dark:bg-violet-950 border border-violet-300 dark:border-violet-800 p-4">
      <View className="flex-row justify-between items-start gap-2">
        <View className="flex-1 gap-y-1">
          <CText style={{ fontFamily: "bold" }}>Upgrade to seedless</CText>
          <CText textColor="text-gray-600 dark:text-gray-300" className="text-sm">
            Keep your same address with seedless security. Takes about a minute.
          </CText>
          <Pressable
            onPress={() => router.push("/settings/security/passkey-upgrade")}
            className="mt-2"
          >
            <CText textColor="text-violet-700 dark:text-violet-300" style={{ fontFamily: "bold" }}>
              Learn more →
            </CText>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            dismissMpcUpgradeReminder();
            setVisible(false);
          }}
          className="p-1"
          accessibilityLabel="Dismiss"
        >
          <CText textColor="text-gray-500">✕</CText>
        </Pressable>
      </View>
    </View>
  );
}
