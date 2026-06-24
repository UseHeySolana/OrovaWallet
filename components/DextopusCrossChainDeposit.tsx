import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { scale } from "react-native-size-matters";

import Buttons from "@/components/ButtonComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import WalletItem from "@/utils/store/wallet.store";
import { copyItem } from "@/utils/functions";
import {
  createDextopusDepositAddress,
  DEXTOPUS_SOLANA_CHAIN_ID,
  DEXTOPUS_USDC_MAINNET,
  getDextopusChains,
  getDextopusTokens,
  listDextopusDepositAddresses,
  listDextopusDeposits,
  type DextopusChain,
  type DextopusDeposit,
  type DextopusDepositAddress,
  type DextopusToken,
} from "@/services/dextopusApi";

function formatChainName(name: string) {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeAsset(asset?: string | null) {
  return (asset ?? "").trim().toLowerCase();
}

type PickerKind = "network";

type DextopusCrossChainDepositProps = {
  initialChainId?: number;
  initialOriginAsset?: string;
  initialOriginSymbol?: string;
  initialSettlementAsset?: string;
  initialSettlementSymbol?: string;
  hideSavedList?: boolean;
};

export default function DextopusCrossChainDeposit({
  initialChainId,
  initialOriginAsset,
  initialOriginSymbol,
  hideSavedList = false,
}: DextopusCrossChainDepositProps = {}) {
  const { publicKey } = WalletItem();
  const walletAddress = publicKey?.toString() ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chains, setChains] = useState<DextopusChain[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<DextopusDepositAddress[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<DextopusDeposit[]>([]);

  const [selectedChain, setSelectedChain] = useState<DextopusChain | null>(null);
  const [selectedToken, setSelectedToken] = useState<DextopusToken | null>(null);
  const [activeAddress, setActiveAddress] = useState<DextopusDepositAddress | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const qrcodeRef = useRef(null);
  const initialSelectionApplied = useRef(false);

  const originChains = useMemo(
    () => chains.filter((chain) => chain.chainId !== DEXTOPUS_SOLANA_CHAIN_ID),
    [chains]
  );

  const filteredChains = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (activePicker !== "network" || !query) return originChains;
    return originChains.filter(
      (chain) =>
        chain.name.toLowerCase().includes(query) ||
        String(chain.chainId).includes(query)
    );
  }, [activePicker, originChains, pickerSearch]);

  const openPicker = () => {
    setPickerSearch("");
    setActivePicker("network");
  };

  const closePicker = () => {
    setActivePicker(null);
    setPickerSearch("");
  };

  const loadBaseData = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const [chainList, addresses, deposits] = await Promise.all([
        getDextopusChains(),
        listDextopusDepositAddresses(walletAddress),
        listDextopusDeposits(walletAddress),
      ]);
      setChains(chainList);
      setSavedAddresses(addresses);
      setRecentDeposits(deposits.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cross-chain deposit data");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!initialChainId || selectedChain || chains.length === 0) return;
    const chain = chains.find((item) => item.chainId === initialChainId);
    if (chain) setSelectedChain(chain);
  }, [chains, initialChainId, selectedChain]);

  useEffect(() => {
    if (!selectedChain) {
      setSelectedToken(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const tokenList = await getDextopusTokens(selectedChain.chainId, true);
        if (cancelled) return;

        if (tokenList.length === 0) {
          setError(`No tokens available for deposits on ${formatChainName(selectedChain.name)}.`);
          setSelectedToken(null);
          return;
        }

        const usdc = tokenList.find((t) => t.symbol.toUpperCase() === "USDC");
        const usdt = tokenList.find((t) => t.symbol.toUpperCase() === "USDT");
        const autoToken = usdc ?? usdt ?? tokenList[0];
        setSelectedToken(autoToken);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tokens");
          setSelectedToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedChain]);

  useEffect(() => {
    if (!initialSelectionApplied.current && initialOriginAsset && selectedChain) {
      initialSelectionApplied.current = true;
    } else if (selectedChain && selectedToken) {
      initialSelectionApplied.current = true;
    }
  }, [initialOriginAsset, selectedChain, selectedToken]);

  const resolveTokenForCreate = useCallback((): DextopusToken | null => {
    if (initialOriginAsset && !initialSelectionApplied.current) {
      return {
        chainId: selectedChain?.chainId ?? 0,
        address: initialOriginAsset,
        symbol: initialOriginSymbol ?? "TOKEN",
      };
    }
    return selectedToken;
  }, [initialOriginAsset, initialOriginSymbol, selectedChain, selectedToken]);

  const handleGenerate = async () => {
    if (!walletAddress || !selectedChain) {
      setError("Select the sender's network first.");
      return;
    }

    const token = resolveTokenForCreate();
    if (!token) {
      setError("No token available for this network.");
      return;
    }

    if (submitting) return;

    const existing = savedAddresses.find(
      (address) =>
        address.origin_chain_id === selectedChain.chainId &&
        normalizeAsset(address.origin_asset) === normalizeAsset(token.address) &&
        address.settlement_chain_id === DEXTOPUS_SOLANA_CHAIN_ID
    );

    if (existing) {
      setActiveAddress(existing);
      setError(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const address = await createDextopusDepositAddress({
        wallet_address: walletAddress,
        origin_chain_id: selectedChain.chainId,
        origin_asset: token.address,
        origin_symbol: token.symbol,
        settlement_asset: DEXTOPUS_USDC_MAINNET,
        settlement_symbol: "USDC",
        settlement_address: walletAddress,
      });
      setActiveAddress(address);
      setSavedAddresses((prev) => {
        const withoutDup = prev.filter(
          (item) =>
            !(
              item.origin_chain_id === address.origin_chain_id &&
              normalizeAsset(item.origin_asset) === normalizeAsset(address.origin_asset) &&
              item.settlement_chain_id === address.settlement_chain_id
            )
        );
        return [address, ...withoutDup];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deposit address");
    } finally {
      setSubmitting(false);
    }
  };

  const selectChain = (chain: DextopusChain) => {
    setSelectedChain(chain);
    setSelectedToken(null);
    setActiveAddress(null);
    closePicker();
  };

  const chainLabel = selectedChain ? formatChainName(selectedChain.name) : "the selected network";
  const tokenLabel = selectedToken ? selectedToken.symbol : "";

  return (
    <View className="relative w-full flex-1 items-start justify-start gap-y-4 bg-transparent">
      {loading ? (
        <View className="w-full py-10 items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView className="w-full flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-y-5 pb-10">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Sender's network"
              onPress={openPicker}
              className="bg-white dark:bg-accent rounded-xl px-4 py-4 flex-row justify-between items-center"
            >
              <View className="flex-1 pr-4">
                <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem]">
                  Sender's network
                </CText>
                <CText style={{ fontFamily: "bold" }} className="text-[1rem] mt-1">
                  {selectedChain ? formatChainName(selectedChain.name) : "Choose network"}
                </CText>
                {selectedToken ? (
                  <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem] mt-0.5">
                    Receiving {selectedToken.symbol} deposits
                  </CText>
                ) : null}
              </View>
              <IconLibrary.angle_right />
            </TouchableOpacity>

            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <CText className="text-red-600 dark:text-red-300">{error}</CText>
              </View>
            ) : null}

            <Buttons
              text={
                submitting
                  ? "Creating address..."
                  : activeAddress
                    ? "Show deposit address"
                    : "Create deposit address"
              }
              onPress={handleGenerate}
              loading={submitting}
            />

            {activeAddress?.deposit_address ? (
              <View className="bg-white dark:bg-accent rounded-xl p-4 gap-y-4">
                <CText style={{ fontFamily: "bold" }} className="text-[1.05rem]">
                  Your deposit address
                </CText>
                <CText className="text-gray-500 dark:text-gray-400">
                  Send {tokenLabel || "tokens"} on {chainLabel} to this address. It will arrive in your HeySolana wallet as USDC on Solana.
                </CText>

                <View className="items-center">
                  <View
                    ref={qrcodeRef}
                    style={{ width: scale(220), height: scale(220) }}
                    className="bg-white p-3 rounded-xl"
                  >
                    <QRCode value={activeAddress.deposit_address} size={scale(190)} />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => copyItem(activeAddress.deposit_address)}
                  className="bg-grey dark:bg-dark rounded-xl p-3"
                >
                  <CText className="text-center">{activeAddress.deposit_address}</CText>
                  <CText className="text-center text-purple mt-1">Tap to copy</CText>
                </TouchableOpacity>
              </View>
            ) : null}

            {!hideSavedList && savedAddresses.length > 0 ? (
              <View className="gap-y-2">
                <CText style={{ fontFamily: "bold" }}>Saved addresses</CText>
                {savedAddresses.map((address) => (
                  <View key={address.id} className="bg-white dark:bg-accent rounded-xl p-3 mb-2">
                    <CText style={{ fontFamily: "bold" }}>
                      {address.origin_symbol || "TOKEN"} from{" "}
                      {formatChainName(
                        chains.find((c) => c.chainId === address.origin_chain_id)?.name ??
                          `Chain ${address.origin_chain_id}`
                      )}
                    </CText>
                    <CText className="text-gray-500 dark:text-gray-400 mt-1">
                      Arrives as USDC on Solana
                    </CText>
                  </View>
                ))}
              </View>
            ) : null}

            {recentDeposits.length > 0 ? (
              <View className="gap-y-2">
                <CText style={{ fontFamily: "bold" }}>Recent deposits</CText>
                {recentDeposits.map((deposit) => (
                  <View key={deposit.id} className="bg-white dark:bg-accent rounded-xl p-3 mb-2">
                    <CText style={{ fontFamily: "bold" }}>
                      {deposit.status?.replace(/_/g, " ").toLowerCase() ?? "pending"}
                    </CText>
                    <CText className="text-gray-500 dark:text-gray-400 mt-1">
                      {deposit.origin_amount_formatted || deposit.origin_amount || "—"} →{" "}
                      {deposit.settlement_amount_formatted || deposit.settlement_amount || "pending"}
                    </CText>
                    {deposit.settlement_amount_usd ? (
                      <CText className="mt-1">${deposit.settlement_amount_usd}</CText>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {activePicker ? (
        <DragableSheet
          close={closePicker}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Sender's network
              </CText>
              <SearchInput onSearch={setPickerSearch} value={pickerSearch} />

              <FlatList
                data={filteredChains}
                keyExtractor={(item) => String(item.chainId)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = selectedChain?.chainId === item.chainId;
                  return (
                    <TouchableOpacity
                      onPress={() => selectChain(item)}
                      className="py-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                        {formatChainName(item.name)}
                      </CText>
                      <CText className="text-gray-500 dark:text-gray-400 mt-1">
                        Chain ID {item.chainId}
                      </CText>
                    </TouchableOpacity>
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
