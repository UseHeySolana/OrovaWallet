import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";

import DextopusCrossChainDeposit from "@/components/DextopusCrossChainDeposit";
import SolanaReceiveQr from "@/components/SolanaReceiveQr";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { DEXTOPUS_SOLANA_CHAIN_ID, type DextopusChain } from "@/services/dextopusApi";

const CROSS_CHAIN_RECEIVE = 0;

function formatChainName(name: string) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function QrCode() {
  const [selectedNetworkId, setSelectedNetworkId] = useState(DEXTOPUS_SOLANA_CHAIN_ID);
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);
  const [networkSearch, setNetworkSearch] = useState("");

  const networkOptions = useMemo(() => {
    const solana: DextopusChain = {
      chainId: DEXTOPUS_SOLANA_CHAIN_ID,
      name: "Solana",
    };
    const crossChain: DextopusChain = {
      chainId: CROSS_CHAIN_RECEIVE,
      name: "Another network",
    };
    return [solana, crossChain];
  }, []);

  const isSolanaReceive = selectedNetworkId === DEXTOPUS_SOLANA_CHAIN_ID;

  const filteredNetworks = useMemo(() => {
    const query = networkSearch.trim().toLowerCase();
    if (!query) return networkOptions;
    return networkOptions.filter((chain) =>
      formatChainName(chain.name).toLowerCase().includes(query)
    );
  }, [networkOptions, networkSearch]);

  const selectedNetworkName = useMemo(() => {
    const found = networkOptions.find((chain) => chain.chainId === selectedNetworkId);
    return found ? formatChainName(found.name) : "Solana";
  }, [networkOptions, selectedNetworkId]);

  const selectNetwork = (chainId: number) => {
    setSelectedNetworkId(chainId);
    setNetworkPickerOpen(false);
    setNetworkSearch("");
  };

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1">
      <View className="w-full px-4 pt-4 pb-3 flex flex-row justify-start items-center gap-x-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
          Receive crypto
        </CText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="gap-y-4 pb-6">
          <CText className="text-[0.95rem] text-gray-500 dark:text-gray-400">
            {isSolanaReceive
              ? "Share your Solana address for SPL tokens and SOL."
              : "Choose where the sender will send from and where you want to settle."}
          </CText>

          <Pressable
            onPress={() => setNetworkPickerOpen(true)}
            className="w-full flex-row items-center justify-between bg-white dark:bg-accent rounded-2xl px-4 py-4"
          >
            <View>
              <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                NETWORK
              </CText>
              <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                {selectedNetworkName}
              </CText>
            </View>
            <AntDesign name="down" size={12} color="#6B7280" />
          </Pressable>

          {isSolanaReceive ? (
            <SolanaReceiveQr />
          ) : (
            <DextopusCrossChainDeposit key="cross-chain-receive" embedded hideSavedList />
          )}
        </View>
      </ScrollView>

      {networkPickerOpen ? (
        <DragableSheet
          close={() => {
            setNetworkPickerOpen(false);
            setNetworkSearch("");
          }}
          panClose
          snapPoints={["50%", "65%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select network
              </CText>
              <SearchInput onSearch={setNetworkSearch} value={networkSearch} />
              <FlatList
                data={filteredNetworks}
                keyExtractor={(item) => String(item.chainId)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = selectedNetworkId === item.chainId;
                  const isSolana = item.chainId === DEXTOPUS_SOLANA_CHAIN_ID;
                  return (
                    <Pressable
                      onPress={() => selectNetwork(item.chainId)}
                      className="py-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                        {formatChainName(item.name)}
                      </CText>
                      <CText className="text-gray-500 dark:text-gray-400 mt-1 text-[0.85rem]">
                        {isSolana
                          ? "Direct Solana wallet address"
                          : "Cross-chain — pick send-from and settle-to, then generate QR"}
                      </CText>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <CText className="text-center text-gray-500 py-6">No networks found.</CText>
                }
              />
            </View>
          }
        />
      ) : null}
    </View>
  );
}
