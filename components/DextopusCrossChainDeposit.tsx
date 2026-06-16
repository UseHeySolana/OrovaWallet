import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
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
  DEXTOPUS_NATIVE_SOL_ASSET,
  DEXTOPUS_SOLANA_CHAIN_ID,
  DEXTOPUS_USDC_MAINNET,
  getDextopusChains,
  getDextopusDestinations,
  getDextopusTokens,
  listDextopusDepositAddresses,
  listDextopusDeposits,
  type DextopusChain,
  type DextopusDeposit,
  type DextopusDepositAddress,
  type DextopusDestination,
  type DextopusToken,
} from "@/services/dextopusApi";

const WRAPPED_SOL_ASSET = "So11111111111111111111111111111111111111112";

const DEFAULT_SETTLEMENT_OPTIONS = [
  {
    symbol: "USDC",
    asset: DEXTOPUS_USDC_MAINNET,
    label: "USDC on Solana",
  },
] as const;

type SettlementOption = {
  symbol: string;
  asset: string;
  label: string;
};
type PickerKind = "network" | "token" | "settlement";

function isSolanaChain(chainId: number) {
  return chainId === DEXTOPUS_SOLANA_CHAIN_ID;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

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

function settlementAssetsMatch(a?: string | null, b?: string | null) {
  const left = normalizeAsset(a);
  const right = normalizeAsset(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const solAssets = new Set([
    normalizeAsset(DEXTOPUS_NATIVE_SOL_ASSET),
    normalizeAsset(WRAPPED_SOL_ASSET),
  ]);
  return solAssets.has(left) && solAssets.has(right);
}

function toSettlementOption(destination: DextopusDestination): SettlementOption {
  const isSol =
    destination.symbol.toUpperCase() === "SOL" ||
    settlementAssetsMatch(destination.currency, WRAPPED_SOL_ASSET);

  return {
    symbol: destination.symbol,
    asset: isSol ? DEXTOPUS_NATIVE_SOL_ASSET : destination.currency,
    label: `${destination.symbol} on Solana`,
  };
}

function dedupeSettlementOptions(options: SettlementOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.symbol}:${normalizeAsset(option.asset)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
  initialSettlementAsset,
  initialSettlementSymbol,
  hideSavedList = false,
}: DextopusCrossChainDepositProps = {}) {
  const { publicKey } = WalletItem();
  const walletAddress = publicKey?.toString() ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [chains, setChains] = useState<DextopusChain[]>([]);
  const [tokens, setTokens] = useState<DextopusToken[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<DextopusDepositAddress[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<DextopusDeposit[]>([]);

  const [settlementOptions, setSettlementOptions] = useState<SettlementOption[]>([
    ...DEFAULT_SETTLEMENT_OPTIONS,
  ]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);

  const [selectedChain, setSelectedChain] = useState<DextopusChain | null>(null);
  const [selectedToken, setSelectedToken] = useState<DextopusToken | null>(null);
  const [settlementAsset, setSettlementAsset] = useState<string>(
    initialSettlementAsset || DEXTOPUS_USDC_MAINNET
  );
  const [settlementSymbol, setSettlementSymbol] = useState<string>(
    initialSettlementSymbol || "USDC"
  );
  const [activeAddress, setActiveAddress] = useState<DextopusDepositAddress | null>(null);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const qrcodeRef = useRef(null);
  const initialSelectionApplied = useRef(false);

  const originChains = useMemo(
    () => chains.filter((chain) => !isSolanaChain(chain.chainId)),
    [chains]
  );

  const selectedSettlement = useMemo(
    () =>
      settlementOptions.find((option) => settlementAssetsMatch(option.asset, settlementAsset)) ??
      settlementOptions[0],
    [settlementAsset, settlementOptions]
  );

  const matchingSavedAddress = useMemo(() => {
    if (!selectedChain || !selectedToken) return null;

    return (
      savedAddresses.find(
        (address) =>
          address.origin_chain_id === selectedChain.chainId &&
          normalizeAsset(address.origin_asset) === normalizeAsset(selectedToken.address) &&
          address.settlement_chain_id === DEXTOPUS_SOLANA_CHAIN_ID &&
          settlementAssetsMatch(address.settlement_asset, settlementAsset)
      ) ?? null
    );
  }, [savedAddresses, selectedChain, selectedToken, settlementAsset]);

  const filteredChains = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (activePicker !== "network" || !query) return originChains;
    return originChains.filter(
      (chain) =>
        chain.name.toLowerCase().includes(query) ||
        String(chain.chainId).includes(query)
    );
  }, [activePicker, originChains, pickerSearch]);

  const filteredTokens = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (activePicker !== "token" || !query) return tokens;
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name?.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
    );
  }, [activePicker, pickerSearch, tokens]);

  const filteredSettlementOptions = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (activePicker !== "settlement" || !query) return settlementOptions;
    return settlementOptions.filter(
      (option) =>
        option.symbol.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query) ||
        option.asset.toLowerCase().includes(query)
    );
  }, [activePicker, pickerSearch, settlementOptions]);

  const openPicker = (picker: PickerKind) => {
    setPickerSearch("");
    setActivePicker(picker);
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
    if (chain) {
      setSelectedChain(chain);
    }
  }, [chains, initialChainId, selectedChain]);

  useEffect(() => {
    if (!selectedChain) {
      setTokens([]);
      setSelectedToken(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const tokenList = await getDextopusTokens(selectedChain.chainId, true);
        if (!cancelled) {
          setTokens(tokenList);
          setSelectedToken((current) => {
            if (initialOriginAsset && !initialSelectionApplied.current) {
              const fromParams = tokenList.find(
                (token) => normalizeAsset(token.address) === normalizeAsset(initialOriginAsset)
              );
              if (fromParams) return fromParams;
            }

            if (current?.chainId === selectedChain.chainId) {
              return (
                tokenList.find(
                  (token) => normalizeAsset(token.address) === normalizeAsset(current.address)
                ) ?? current
              );
            }

            if (initialOriginAsset && initialOriginSymbol) {
              return {
                chainId: selectedChain.chainId,
                address: initialOriginAsset,
                symbol: initialOriginSymbol,
              };
            }

            return tokenList[0] ?? null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tokens");
          setTokens([]);
          setSelectedToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialOriginAsset, initialOriginSymbol, selectedChain]);

  useEffect(() => {
    if (!selectedChain || !selectedToken) {
      setSettlementOptions([...DEFAULT_SETTLEMENT_OPTIONS]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingDestinations(true);
      setError(null);
      try {
        const destinations = await getDextopusDestinations(
          selectedChain.chainId,
          selectedToken.address,
          true
        );
        if (cancelled) return;

        const options = dedupeSettlementOptions(destinations.map(toSettlementOption));
        const nextOptions =
          options.length > 0 ? options : [...DEFAULT_SETTLEMENT_OPTIONS];
        setSettlementOptions(nextOptions);

        const preferredAsset =
          initialSettlementAsset && !initialSelectionApplied.current
            ? initialSettlementAsset
            : undefined;
        const matched = preferredAsset
          ? nextOptions.find((option) => settlementAssetsMatch(option.asset, preferredAsset))
          : undefined;
        const usdc = nextOptions.find((option) => option.symbol.toUpperCase() === "USDC");
        const nextAsset =
          matched?.asset ?? usdc?.asset ?? nextOptions[0]?.asset ?? DEXTOPUS_USDC_MAINNET;
        const nextSymbol =
          nextOptions.find((option) => settlementAssetsMatch(option.asset, nextAsset))
            ?.symbol ??
          initialSettlementSymbol ??
          "USDC";

        setSettlementAsset(nextAsset);
        setSettlementSymbol(nextSymbol);
      } catch (err) {
        if (!cancelled) {
          setSettlementOptions([...DEFAULT_SETTLEMENT_OPTIONS]);
          setError(
            err instanceof Error
              ? err.message
              : "Could not load supported receive options for this token"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDestinations(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialSettlementAsset, initialSettlementSymbol, selectedChain, selectedToken]);

  useEffect(() => {
    if (!initialSelectionApplied.current && initialSettlementAsset) {
      setSettlementAsset(initialSettlementAsset);
      if (initialSettlementSymbol) {
        setSettlementSymbol(initialSettlementSymbol);
      }
      if (initialSettlementAsset !== DEXTOPUS_USDC_MAINNET) {
        setShowAdvanced(true);
      }
    }

    if (selectedChain && selectedToken) {
      initialSelectionApplied.current = true;
    }
  }, [
    initialSettlementAsset,
    initialSettlementSymbol,
    selectedChain,
    selectedToken,
  ]);

  useEffect(() => {
    if (matchingSavedAddress) {
      setActiveAddress(matchingSavedAddress);
      return;
    }

    setActiveAddress((current) => {
      if (!current || !selectedChain || !selectedToken) return current;
      const stillMatchesSelection =
        current.origin_chain_id === selectedChain.chainId &&
        normalizeAsset(current.origin_asset) === normalizeAsset(selectedToken.address) &&
        current.settlement_chain_id === DEXTOPUS_SOLANA_CHAIN_ID &&
        settlementAssetsMatch(current.settlement_asset, settlementAsset);

      return stillMatchesSelection ? current : null;
    });
  }, [matchingSavedAddress, selectedChain, selectedToken, settlementAsset]);

  const handleGenerate = async () => {
    if (!walletAddress || !selectedChain || !selectedToken) {
      setError("Select the sender's network and token first.");
      return;
    }
    if (submitting) return;

    if (matchingSavedAddress) {
      setActiveAddress(matchingSavedAddress);
      setError(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const address = await createDextopusDepositAddress({
        wallet_address: walletAddress,
        origin_chain_id: selectedChain.chainId,
        origin_asset: selectedToken.address,
        origin_symbol: selectedToken.symbol,
        settlement_asset: settlementAsset,
        settlement_symbol: settlementSymbol,
        settlement_address: walletAddress,
        refund_to: isSolanaChain(selectedChain.chainId) ? walletAddress : undefined,
      });
      setActiveAddress(address);
      setSavedAddresses((prev) => {
        const withoutDup = prev.filter(
          (item) =>
            !(
              item.origin_chain_id === address.origin_chain_id &&
              normalizeAsset(item.origin_asset) === normalizeAsset(address.origin_asset) &&
              item.settlement_chain_id === address.settlement_chain_id &&
              settlementAssetsMatch(item.settlement_asset, address.settlement_asset)
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

  const selectSettlement = (option: SettlementOption) => {
    setSettlementAsset(option.asset);
    setSettlementSymbol(option.symbol);
    setActiveAddress(null);
    closePicker();
  };

  const renderSelector = (label: string, value: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`bg-white dark:bg-accent rounded-xl px-4 py-4 flex-row justify-between items-center ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <View className="flex-1 pr-4">
        <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem]">{label}</CText>
        <CText style={{ fontFamily: "bold" }} className="text-[1rem] mt-1">
          {value}
        </CText>
      </View>
      <IconLibrary.angle_right />
    </TouchableOpacity>
  );

  const chainLabel = selectedChain ? formatChainName(selectedChain.name) : "the selected network";

  return (
    <View className="relative w-full flex-1 items-start justify-start gap-y-4 bg-transparent">
      {loading ? (
        <View className="w-full py-10 items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView className="w-full flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-y-5 pb-10">
            {renderSelector(
              "Sender's network",
              selectedChain ? formatChainName(selectedChain.name) : "Choose network",
              () => openPicker("network")
            )}

            {renderSelector(
              "Token being sent",
              selectedToken
                ? `${selectedToken.symbol}${selectedToken.name ? ` · ${selectedToken.name}` : ""}`
                : selectedChain
                  ? "Choose token"
                  : "Choose sender's network first",
              () => openPicker("token"),
              !selectedChain
            )}

            {settlementOptions.length > 1 ? (
              <TouchableOpacity
                onPress={() => setShowAdvanced((value) => !value)}
                className="flex-row items-center justify-between px-1"
              >
                <CText className="text-gray-500 dark:text-gray-400">Advanced</CText>
                <CText className="text-purple">
                  {showAdvanced ? "Hide" : "Show"}
                </CText>
              </TouchableOpacity>
            ) : null}

            {showAdvanced && settlementOptions.length > 1
              ? renderSelector(
                  "Receive in wallet as",
                  selectedSettlement.label,
                  () => openPicker("settlement")
                )
              : null}

            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <CText className="text-red-600 dark:text-red-300">{error}</CText>
              </View>
            ) : null}

            <Buttons
              text={
                submitting || loadingDestinations
                  ? "Loading..."
                  : matchingSavedAddress
                    ? "Show deposit address"
                    : "Create deposit address"
              }
              onPress={handleGenerate}
              loading={submitting || loadingDestinations}
            />

            {activeAddress?.deposit_address ? (
              <View className="bg-white dark:bg-accent rounded-xl p-4 gap-y-4">
                <CText style={{ fontFamily: "bold" }} className="text-[1.05rem]">
                  Your deposit address
                </CText>
                {matchingSavedAddress ? (
                  <CText className="text-purple">Using your saved address for this setup.</CText>
                ) : null}
                <CText className="text-gray-500 dark:text-gray-400">
                  Send {selectedToken?.symbol ?? "tokens"} on {chainLabel} to this address. It will arrive in your HeySolana wallet as {settlementSymbol} on Solana.
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
                      {address.origin_symbol || "TOKEN"} from chain {address.origin_chain_id}
                    </CText>
                    <CText className="text-gray-500 dark:text-gray-400 mt-1">
                      Arrives as {address.settlement_symbol || "USDC"} on Solana
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
                    <CText style={{ fontFamily: "bold" }}>{formatStatus(deposit.status)}</CText>
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
                {activePicker === "network"
                  ? "Sender's network"
                  : activePicker === "token"
                    ? "Token being sent"
                    : "Receive in wallet as"}
              </CText>
              <SearchInput onSearch={setPickerSearch} value={pickerSearch} />

              {activePicker === "network" ? (
                <FlatList
                  data={filteredChains}
                  keyExtractor={(item) => String(item.chainId)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const selected = selectedChain?.chainId === item.chainId;
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedChain(item);
                          setSelectedToken(null);
                          setActiveAddress(null);
                          closePicker();
                        }}
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
              ) : activePicker === "token" ? (
                <FlatList
                  data={filteredTokens}
                  keyExtractor={(item) => item.address}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const selected = selectedToken?.address === item.address;
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedToken(item);
                          setActiveAddress(null);
                          closePicker();
                        }}
                        className="py-4 border-b border-gray-100 dark:border-gray-800 flex-row items-center"
                      >
                        <View
                          className="rounded-full bg-grey dark:bg-accent2 overflow-hidden items-center justify-center mr-3"
                          style={{ width: 44, height: 44 }}
                        >
                          {item.logoUrl ? (
                            <Image
                              source={{ uri: item.logoUrl }}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          ) : (
                            <CText style={{ fontFamily: "bold" }} className="text-[14px]">
                              {item.symbol.slice(0, 1)}
                            </CText>
                          )}
                        </View>
                        <View className="flex-1">
                          <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                            {item.symbol}
                          </CText>
                          <CText numberOfLines={1} className="text-gray-500 dark:text-gray-400 mt-1">
                            {item.name || item.address}
                          </CText>
                        </View>
                        {selected ? <IconLibrary.check color="#971BB2" size={18} /> : null}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <CText className="text-center text-gray-500 py-6">
                      No tokens found for this network.
                    </CText>
                  }
                />
              ) : (
                <FlatList
                  data={[...filteredSettlementOptions]}
                  keyExtractor={(item) => item.asset}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const selected = settlementAsset === item.asset;
                    return (
                      <TouchableOpacity
                        onPress={() => selectSettlement(item)}
                        className="py-4 border-b border-gray-100 dark:border-gray-800"
                      >
                        <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                          {item.label}
                        </CText>
                        <CText className="text-gray-500 dark:text-gray-400 mt-1">
                          Funds settle to this asset on Solana
                        </CText>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <CText className="text-center text-gray-500 py-6">
                      No receive options found.
                    </CText>
                  }
                />
              )}
            </View>
          }
        />
      ) : null}
    </View>
  );
}
