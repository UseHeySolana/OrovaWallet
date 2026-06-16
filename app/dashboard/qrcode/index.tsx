import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";

import SolanaReceiveQr from "@/components/SolanaReceiveQr";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import WalletItem from "@/utils/store/wallet.store";
import {
  getDextopusChains,
  listDextopusDepositAddresses,
  type DextopusChain,
  type DextopusDepositAddress,
} from "@/services/dextopusApi";

function formatChainName(name: string) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function savedAddressLabel(
  address: DextopusDepositAddress,
  chainNameById: Map<number, string>
) {
  const token = address.origin_symbol || "Token";
  const chain =
    chainNameById.get(address.origin_chain_id) ||
    `Chain ${address.origin_chain_id}`;
  return `${token} from ${formatChainName(chain)}`;
}

export default function QrCode() {
  const { publicKey } = WalletItem();
  const walletAddress = publicKey?.toString() ?? "";

  const [chains, setChains] = useState<DextopusChain[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<DextopusDepositAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chainNameById = useMemo(
    () => new Map(chains.map((chain) => [chain.chainId, chain.name])),
    [chains]
  );

  const loadData = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const [chainList, addresses] = await Promise.all([
        getDextopusChains(),
        listDextopusDepositAddresses(walletAddress),
      ]);
      setChains(chainList);
      setSavedAddresses(addresses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receive options");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openSavedAddress = (address: DextopusDepositAddress) => {
    router.push({
      pathname: "/dashboard/qrcode/crosschain",
      params: {
        chainId: String(address.origin_chain_id),
        chainName: chainNameById.get(address.origin_chain_id) || "",
        originAsset: address.origin_asset,
        originSymbol: address.origin_symbol || "",
        settlementAsset: address.settlement_asset,
        settlementSymbol: address.settlement_symbol || "USDC",
      },
    } as any);
  };

  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark w-full flex-1 items-start justify-start gap-y-4">
      <View className="w-full flex flex-row justify-start">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>

      <View className="w-full">
        <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
          Receive crypto
        </CText>
        <CText className="text-[0.95rem] text-gray-500 dark:text-gray-400 mt-1">
          Share your Solana address, or get a deposit address for another network.
        </CText>
      </View>

      <ScrollView className="w-full flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-y-5 pb-10">
          <SolanaReceiveQr />

          <View className="bg-white dark:bg-accent rounded-xl p-4 gap-y-3">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
              Receiving from another network?
            </CText>
            <CText className="text-gray-500 dark:text-gray-400">
              Generate a deposit address for Base, Ethereum, and more. Funds arrive in your HeySolana wallet on Solana.
            </CText>

            {loading ? (
              <View className="py-4 items-center">
                <ActivityIndicator />
              </View>
            ) : error ? (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <CText className="text-red-600 dark:text-red-300">{error}</CText>
              </View>
            ) : (
              <>
                {savedAddresses.length > 0 ? (
                  <View className="gap-y-2">
                    {savedAddresses.map((address) => (
                      <TouchableOpacity
                        key={address.id}
                        onPress={() => openSavedAddress(address)}
                        className="bg-grey dark:bg-dark rounded-xl p-3 flex-row items-center"
                      >
                        <View className="w-10 h-10 rounded-full bg-purple/10 items-center justify-center mr-3">
                          <MaterialCommunityIcons
                            name="swap-horizontal"
                            size={20}
                            color="#971BB2"
                          />
                        </View>
                        <View className="flex-1">
                          <CText style={{ fontFamily: "bold" }}>
                            {savedAddressLabel(address, chainNameById)}
                          </CText>
                          <CText className="text-gray-500 dark:text-gray-400 mt-1">
                            Arrives as {address.settlement_symbol || "USDC"} on Solana
                          </CText>
                        </View>
                        <IconLibrary.angle_right />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Add another network"
                  onPress={() => router.push("/dashboard/qrcode/crosschain")}
                  className="bg-purple rounded-xl py-4 px-4"
                >
                  <CText
                    className="text-white text-center"
                    style={{ fontFamily: "bold" }}
                  >
                    {savedAddresses.length > 0 ? "Add another network" : "Set up cross-chain receive"}
                  </CText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
