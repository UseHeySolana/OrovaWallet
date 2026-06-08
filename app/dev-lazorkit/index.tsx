import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { LazorKitProvider, useWallet } from "@lazorkit/wallet-mobile-adapter";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";

const REDIRECT_URL = "heysolana://dev-lazorkit";

async function copyToClipboard(label: string, value: string) {
  if (!value) return;
  try {
    await Clipboard.setStringAsync(value);
    AppSettings.getState().setToast(`${label} copied`, "success");
  } catch {
    AppSettings.getState().setToast("Copy failed", "error");
  }
}

function DevLazorKitContent() {
  const {
    smartWalletPubkey,
    passkeyPubkey,
    isConnected,
    isConnecting,
    isSigning,
    error,
    connect,
    disconnect,
    signMessage,
  } = useWallet();
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<string | null>(null);

  const walletAddress = smartWalletPubkey?.toBase58() ?? "";
  const shortAddress = useMemo(() => {
    if (!walletAddress) return "Not connected";
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`;
  }, [walletAddress]);

  const connectWallet = async () => {
    try {
      await connect({ redirectUrl: REDIRECT_URL });
      AppSettings.getState().setToast("LazorKit wallet connected", "success");
    } catch (err: any) {
      Alert.alert("LazorKit connect failed", err?.message ?? "Unknown error");
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
      setLastPayload(null);
      setLastSignature(null);
      AppSettings.getState().setToast("LazorKit wallet disconnected", "info");
    } catch (err: any) {
      Alert.alert("LazorKit disconnect failed", err?.message ?? "Unknown error");
    }
  };

  const signDevMessage = async () => {
    try {
      const result = await signMessage(
        `HeySolana LazorKit dev check: ${new Date().toISOString()}`,
        { redirectUrl: REDIRECT_URL }
      );
      setLastSignature(result.signature);
      setLastPayload(result.signedPayload);
      AppSettings.getState().setToast("Message signed", "success");
    } catch (err: any) {
      Alert.alert("LazorKit sign failed", err?.message ?? "Unknown error");
    }
  };

  if (!__DEV__) {
    return (
      <View className="flex-1 bg-grey dark:bg-dark justify-center items-center px-6">
        <CText className="text-center">
          This screen is only available in development builds.
        </CText>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 px-5 py-3 rounded-full bg-purple"
        >
          <CText className="text-white">Go back</CText>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-grey dark:bg-dark px-4 pt-3">
      <View className="flex-row items-center gap-x-2 mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
          Dev - LazorKit
        </CText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4 rounded-2xl bg-white dark:bg-accent border border-grey/10 mb-4">
          <CText style={{ fontFamily: "bold" }} className="text-[1rem] mb-2">
            Passkey smart wallet
          </CText>
          <CText className="opacity-70 mb-3">
            This uses LazorKit devnet defaults only. No app-level paymaster URL,
            API key, or production relay config is set.
          </CText>
          <CText>Status: {isConnected ? "Connected" : "Disconnected"}</CText>
          <CText className="mt-1">Vault: {shortAddress}</CText>
          {passkeyPubkey ? (
            <CText className="mt-1 opacity-70">
              Passkey bytes: {passkeyPubkey.length}
            </CText>
          ) : null}
          {error ? (
            <CText className="mt-2 text-red-500">{error.message}</CText>
          ) : null}
        </View>

        <View className="gap-y-3">
          <Pressable
            disabled={isConnecting}
            onPress={connectWallet}
            className="py-3 px-4 rounded-xl bg-purple"
          >
            <CText className="text-white text-center">
              {isConnecting ? "Connecting..." : "Connect with Passkey"}
            </CText>
          </Pressable>

          <Pressable
            disabled={!walletAddress}
            onPress={() => copyToClipboard("Vault address", walletAddress)}
            className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
          >
            <CText className="text-center">Copy Vault Address</CText>
          </Pressable>

          <Pressable
            disabled={!isConnected || isSigning}
            onPress={signDevMessage}
            className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
          >
            <CText className="text-center">
              {isSigning ? "Signing..." : "Sign Test Message"}
            </CText>
          </Pressable>

          <Pressable
            disabled={!isConnected}
            onPress={disconnectWallet}
            className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
          >
            <CText className="text-center">Disconnect LazorKit Wallet</CText>
          </Pressable>
        </View>

        {lastSignature ? (
          <View className="mt-4 p-4 rounded-2xl bg-white dark:bg-accent border border-grey/10">
            <CText style={{ fontFamily: "bold" }} className="mb-2">
              Last signature
            </CText>
            <Pressable
              onPress={() => copyToClipboard("Signature", lastSignature)}
            >
              <CText className="text-[0.8rem] opacity-70" numberOfLines={4}>
                {lastSignature}
              </CText>
            </Pressable>
            {lastPayload ? (
              <Pressable
                className="mt-3"
                onPress={() => copyToClipboard("Signed payload", lastPayload)}
              >
                <CText className="text-[0.8rem] opacity-70" numberOfLines={4}>
                  {lastPayload}
                </CText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function DevLazorKitScreen() {
  return (
    <LazorKitProvider isDebug={__DEV__}>
      <DevLazorKitContent />
    </LazorKitProvider>
  );
}
