import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import {
  startDeviceLinkRequest,
  waitForDeviceLinkApproval,
} from "@/utils/wallet/linkSeedlessDevice";
import { copyItem } from "@/utils/functions";

export default function MpcLinkNewDeviceScreen() {
  const { setToast } = AppSettings();
  const { user } = UserItem();
  const [busy, setBusy] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linkId, setLinkId] = useState("");
  const [status, setStatus] = useState("");

  const walletAddress = user?.wallet_address ?? "";
  const username = user?.username ?? "";

  useEffect(() => {
    if (!walletAddress || !username) return;
    (async () => {
      setBusy(true);
      try {
        const data = await startDeviceLinkRequest({ username, walletAddress });
        setLinkCode(data.link_code);
        setLinkId(data.link_id);
        setStatus("Open Hey Solana on your primary phone → Security → Approve new device");
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Could not start linking", "error");
      } finally {
        setBusy(false);
      }
    })();
  }, [walletAddress, username]);

  const onWaitForApproval = async () => {
    if (!linkId) return;
    setBusy(true);
    setStatus("Waiting for approval on your primary phone…");
    try {
      const result = await waitForDeviceLinkApproval({
        linkId,
        walletAddress,
        username,
      });
      if (!result.ok) {
        setStatus(result.message);
        setToast(result.message, "error");
        return;
      }
      setToast(result.message, "success");
      router.replace("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-grey dark:bg-dark pt-10">
      <View className="w-11/12 m-auto flex-row items-center gap-3 mb-4">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]" style={{ fontFamily: "bold" }}>
          Link this phone
        </CText>
      </View>

      <ScrollView className="w-11/12 m-auto" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="bg-white dark:bg-accent rounded-3xl p-6 gap-y-4">
          <CText textColor="text-gray-500" className="text-center">
            Your device key stays on your phones only. The server never stores it. Approve from
            your primary device with Face ID.
          </CText>
          {linkCode ? (
            <Pressable
              onPress={() => {
                void copyItem(linkCode);
                setToast("Code copied", "success");
              }}
              className="items-center py-4"
            >
              <CText textColor="text-gray-400" className="text-sm">
                Link code
              </CText>
              <CText className="text-[2rem] tracking-widest" style={{ fontFamily: "bold" }}>
                {linkCode}
              </CText>
              <CText textColor="text-violet-600" className="text-sm">
                Tap to copy
              </CText>
            </Pressable>
          ) : null}
          {status ? (
            <CText textColor="text-violet-600" className="text-center text-sm">
              {status}
            </CText>
          ) : null}
        </View>

        <View className="mt-6 gap-y-3">
          {busy ? (
            <ActivityIndicator color="#971BB2" />
          ) : (
            <Buttons text="I've approved on my primary phone" onPress={onWaitForApproval} disabled={!linkId} />
          )}
          <Pressable
            onPress={() => router.replace("/auth/login")}
            className="py-3"
          >
            <CText className="text-center text-violet-600">
              Try passkey restore (same Apple / Google account)
            </CText>
          </Pressable>
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
