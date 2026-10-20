import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import QRCode from "react-native-qrcode-svg";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { scale } from "@/utils/layout/scale";

import Buttons from "@/components/ButtonComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import WalletItem from "@/utils/store/wallet.store";
import { copyItem } from "@/utils/functions";
import {
  findOrCreateDextopusDepositAddress,
  isEvmAddress,
  matchDextopusDepositAddress,
  normalizeDextopusAsset,
  DEXTOPUS_SOLANA_CHAIN_ID,
  DEXTOPUS_REFUND_REQUIRED_ORIGIN_CHAIN_IDS,
  DEXTOPUS_UNSUPPORTED_ORIGIN_CHAIN_IDS,
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

function pickDefaultToken(tokens: DextopusToken[]): DextopusToken | null {
  if (tokens.length === 0) return null;
  const usdc = tokens.find((t) => t.symbol.toUpperCase() === "USDC");
  const usdt = tokens.find((t) => t.symbol.toUpperCase() === "USDT");
  return usdc ?? usdt ?? tokens[0];
}

function CrossChainDepositQr({
  depositAddress,
  routeSummary,
}: {
  depositAddress: string;
  routeSummary: string;
}) {
  const qrcodeRef = useRef(null);

  const share = async () => {
    if (qrcodeRef.current == null) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) return;
    const result = await captureRef(qrcodeRef.current, {
      result: "tmpfile",
      quality: 1,
      format: "png",
    });
    await Sharing.shareAsync(result);
  };

  return (
    <View className="gap-y-4 pb-8">
      <CText className="text-center text-gray-500 dark:text-gray-400 px-2">{routeSummary}</CText>

      <View
        style={{ width: scale(320), padding: scale(10) }}
        className="flex bg-white shadow-sm rounded-xl dark:bg-accent h-fit m-auto flex-row justify-center items-center"
      >
        <View className="border border-purple/40 p-4 rounded-xl">
          <View
            ref={qrcodeRef}
            style={{ width: scale(250), height: scale(250) }}
            className="overflow-hidden rounded-xl"
          >
            <QRCode
              value={depositAddress}
              size={scale(249)}
              logo={require("@/assets/images/ballicon.png")}
              logoBackgroundColor="transparent"
            />
          </View>

          <View className="flex flex-row justify-between py-5">
            <View className="w-[45%]">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={share}
                type="primary"
                text="Share"
                icon={
                  <View className="rotate-[270deg]">
                    <AntDesign name="down" size={16} color="white" />
                  </View>
                }
              />
            </View>
            <View className="w-[45%]">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => copyItem(depositAddress)}
                type="primary"
                text="Copy"
                icon={
                  <View>
                    <IconLibrary.copy color="white" />
                  </View>
                }
              />
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => copyItem(depositAddress)}
        className="bg-white dark:bg-accent rounded-xl p-3 mx-1"
      >
        <CText className="text-center text-[0.85rem]">{depositAddress}</CText>
        <CText className="text-center text-purple mt-1 text-[0.8rem]">Tap to copy address</CText>
      </TouchableOpacity>
    </View>
  );
}

type PickerKind = "originNetwork" | "originToken" | "settlementNetwork" | "settlementToken";

type DextopusCrossChainDepositProps = {
  initialChainId?: number;
  initialSettlementChainId?: number;
  initialOriginAsset?: string;
  initialOriginSymbol?: string;
  initialSettlementAsset?: string;
  initialSettlementSymbol?: string;
  hideSavedList?: boolean;
  embedded?: boolean;
  lockSettlementNetwork?: boolean;
  onDepositViewChange?: (active: boolean) => void;
};

export default function DextopusCrossChainDeposit({
  initialChainId,
  initialSettlementChainId,
  initialOriginAsset,
  initialOriginSymbol,
  initialSettlementAsset,
  initialSettlementSymbol,
  hideSavedList = false,
  embedded = false,
  lockSettlementNetwork = false,
  onDepositViewChange,
}: DextopusCrossChainDepositProps = {}) {
  const { publicKey } = WalletItem();
  const walletAddress = publicKey?.toString() ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chains, setChains] = useState<DextopusChain[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<DextopusDepositAddress[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<DextopusDeposit[]>([]);

  const [originChain, setOriginChain] = useState<DextopusChain | null>(null);
  const [originToken, setOriginToken] = useState<DextopusToken | null>(null);
  const [originTokens, setOriginTokens] = useState<DextopusToken[]>([]);

  const [settlementChain, setSettlementChain] = useState<DextopusChain | null>(null);
  const [settlementToken, setSettlementToken] = useState<DextopusToken | null>(null);
  const [settlementTokens, setSettlementTokens] = useState<DextopusToken[]>([]);
  const [settlementAddress, setSettlementAddress] = useState("");

  const [activeAddress, setActiveAddress] = useState<DextopusDepositAddress | null>(null);
  const [depositViewActive, setDepositViewActive] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const initialSelectionApplied = useRef(false);

  const chainNameById = useMemo(
    () => new Map(chains.map((chain) => [chain.chainId, chain.name])),
    [chains]
  );

  const enterDepositView = useCallback(
    (address: DextopusDepositAddress) => {
      setActiveAddress(address);
      setDepositViewActive(true);
      setError(null);
      onDepositViewChange?.(true);
    },
    [onDepositViewChange]
  );

  const startNewRoute = useCallback(() => {
    setActiveAddress(null);
    setDepositViewActive(false);
    setError(null);
    setOriginChain(null);
    setOriginToken(null);
    setOriginTokens([]);
    onDepositViewChange?.(false);
  }, [onDepositViewChange]);

  const originChains = useMemo(
    () =>
      chains.filter(
        (chain) =>
          chain.chainId !== DEXTOPUS_SOLANA_CHAIN_ID &&
          !DEXTOPUS_REFUND_REQUIRED_ORIGIN_CHAIN_IDS.has(chain.chainId) &&
          !DEXTOPUS_UNSUPPORTED_ORIGIN_CHAIN_IDS.has(chain.chainId)
      ),
    [chains]
  );

  const settlementChains = useMemo(() => chains, [chains]);

  const isSolanaSettlement = settlementChain?.chainId === DEXTOPUS_SOLANA_CHAIN_ID;

  const pickerTitle = useMemo(() => {
    switch (activePicker) {
      case "originNetwork":
        return "Send from";
      case "originToken":
        return "Token to send";
      case "settlementNetwork":
        return "Settle to";
      case "settlementToken":
        return "Token to receive";
      default:
        return "";
    }
  }, [activePicker]);

  const filteredPickerItems = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (activePicker === "originNetwork") {
      const list = originChains;
      if (!query) return list;
      return list.filter(
        (chain) =>
          chain.name.toLowerCase().includes(query) || String(chain.chainId).includes(query)
      );
    }
    if (activePicker === "settlementNetwork") {
      const list = settlementChains;
      if (!query) return list;
      return list.filter(
        (chain) =>
          chain.name.toLowerCase().includes(query) || String(chain.chainId).includes(query)
      );
    }
    if (activePicker === "originToken") {
      const list = originTokens;
      if (!query) return list;
      return list.filter(
        (token) =>
          token.symbol.toLowerCase().includes(query) ||
          token.name?.toLowerCase().includes(query)
      );
    }
    if (activePicker === "settlementToken") {
      const list = settlementTokens;
      if (!query) return list;
      return list.filter(
        (token) =>
          token.symbol.toLowerCase().includes(query) ||
          token.name?.toLowerCase().includes(query)
      );
    }
    return [];
  }, [activePicker, originChains, originTokens, pickerSearch, settlementChains, settlementTokens]);

  const openPicker = (kind: PickerKind) => {
    setPickerSearch("");
    setActivePicker(kind);
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
    if (!initialChainId || originChain || chains.length === 0) return;
    const chain = chains.find((item) => item.chainId === initialChainId);
    if (chain && chain.chainId !== DEXTOPUS_SOLANA_CHAIN_ID) setOriginChain(chain);
  }, [chains, initialChainId, originChain]);

  useEffect(() => {
    if (!initialSettlementChainId || settlementChain || chains.length === 0) return;
    const chain = chains.find((item) => item.chainId === initialSettlementChainId);
    if (chain) setSettlementChain(chain);
  }, [chains, initialSettlementChainId, settlementChain]);

  useEffect(() => {
    if (settlementChain || chains.length === 0) return;
    if (initialSettlementChainId) return;
    const solana = chains.find((item) => item.chainId === DEXTOPUS_SOLANA_CHAIN_ID);
    if (solana) setSettlementChain(solana);
  }, [chains, initialSettlementChainId, settlementChain]);

  useEffect(() => {
    if (!originChain) {
      setOriginTokens([]);
      setOriginToken(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const tokenList = await getDextopusTokens(originChain.chainId, true);
        if (cancelled) return;

        if (tokenList.length === 0) {
          setError(`No tokens available to send from ${formatChainName(originChain.name)}.`);
          setOriginTokens([]);
          setOriginToken(null);
          return;
        }

        setOriginTokens(tokenList);

        if (initialOriginAsset && !initialSelectionApplied.current) {
          const preset =
            tokenList.find(
              (token) =>
                normalizeDextopusAsset(token.address) === normalizeDextopusAsset(initialOriginAsset)
            ) ?? null;
          setOriginToken(
            preset ?? {
              chainId: originChain.chainId,
              address: initialOriginAsset,
              symbol: initialOriginSymbol ?? "TOKEN",
            }
          );
        } else {
          setOriginToken(pickDefaultToken(tokenList));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load send-from tokens");
          setOriginTokens([]);
          setOriginToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialOriginAsset, initialOriginSymbol, originChain]);

  useEffect(() => {
    if (!settlementChain) {
      setSettlementTokens([]);
      setSettlementToken(null);
      setSettlementAddress("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const tokenList = await getDextopusTokens(settlementChain.chainId, true);
        if (cancelled) return;

        if (tokenList.length === 0) {
          setError(`No tokens available on ${formatChainName(settlementChain.name)}.`);
          setSettlementTokens([]);
          setSettlementToken(null);
          return;
        }

        setSettlementTokens(tokenList);

        if (initialSettlementAsset && !initialSelectionApplied.current) {
          const preset =
            tokenList.find(
              (token) =>
                normalizeDextopusAsset(token.address) ===
                normalizeDextopusAsset(initialSettlementAsset)
            ) ?? null;
          setSettlementToken(
            preset ?? {
              chainId: settlementChain.chainId,
              address: initialSettlementAsset,
              symbol: initialSettlementSymbol ?? "TOKEN",
            }
          );
        } else {
          setSettlementToken(pickDefaultToken(tokenList));
        }

        if (settlementChain.chainId === DEXTOPUS_SOLANA_CHAIN_ID) {
          setSettlementAddress(walletAddress);
        } else {
          setSettlementAddress("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settlement tokens");
          setSettlementTokens([]);
          setSettlementToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialSettlementAsset, initialSettlementSymbol, settlementChain, walletAddress]);

  useEffect(() => {
    if (originChain && originToken && settlementChain && settlementToken) {
      initialSelectionApplied.current = true;
    }
  }, [originChain, originToken, settlementChain, settlementToken]);

  const resetGeneratedAddress = () => {
    setActiveAddress(null);
    if (depositViewActive) {
      setDepositViewActive(false);
      onDepositViewChange?.(false);
    }
  };

  const selectOriginChain = (chain: DextopusChain) => {
    setOriginChain(chain);
    setOriginToken(null);
    resetGeneratedAddress();
    closePicker();
  };

  const selectSettlementChain = (chain: DextopusChain) => {
    setSettlementChain(chain);
    setSettlementToken(null);
    resetGeneratedAddress();
    closePicker();
  };

  const selectOriginToken = (token: DextopusToken) => {
    setOriginToken(token);
    resetGeneratedAddress();
    closePicker();
  };

  const selectSettlementToken = (token: DextopusToken) => {
    setSettlementToken(token);
    resetGeneratedAddress();
    closePicker();
  };

  const handleGenerate = async () => {
    if (!walletAddress) return;

    if (!originChain) {
      setError("Choose where the sender will send from.");
      return;
    }
    if (!originToken) {
      setError("Choose the token the sender will use.");
      return;
    }
    if (!settlementChain) {
      setError("Choose where you want to receive the funds.");
      return;
    }
    if (!settlementToken) {
      setError("Choose the token you want to receive.");
      return;
    }

    const resolvedSettlementAddress = isSolanaSettlement
      ? walletAddress
      : settlementAddress.trim();

    if (!isSolanaSettlement && !isEvmAddress(resolvedSettlementAddress)) {
      setError(`Enter a valid ${formatChainName(settlementChain.name)} wallet address (0x…).`);
      return;
    }

    if (submitting) return;

    const payload = {
      wallet_address: walletAddress,
      origin_chain_id: originChain.chainId,
      origin_asset: originToken.address,
      origin_symbol: originToken.symbol,
      settlement_chain_id: settlementChain.chainId,
      settlement_asset: settlementToken.address,
      settlement_symbol: settlementToken.symbol,
      settlement_address: resolvedSettlementAddress,
    };

    const existing = matchDextopusDepositAddress(savedAddresses, payload);
    if (existing) {
      enterDepositView(existing);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const address = await findOrCreateDextopusDepositAddress(payload);
      setSavedAddresses((prev) => {
        const withoutDup = prev.filter((item) => item.id !== address.id);
        return [address, ...withoutDup];
      });
      enterDepositView(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deposit address");
    } finally {
      setSubmitting(false);
    }
  };

  const originChainLabel = originChain ? formatChainName(originChain.name) : "Choose network";
  const settlementChainLabel = settlementChain
    ? formatChainName(settlementChain.name)
    : "Choose network";

  const activeAddressRouteSummary = useMemo(() => {
    if (!activeAddress) return "";
    const originName = formatChainName(
      chainNameById.get(activeAddress.origin_chain_id) ?? `Chain ${activeAddress.origin_chain_id}`
    );
    const settlementName = formatChainName(
      chainNameById.get(activeAddress.settlement_chain_id) ??
        `Chain ${activeAddress.settlement_chain_id}`
    );
    return `Send ${activeAddress.origin_symbol || "tokens"} on ${originName}. Funds arrive as ${activeAddress.settlement_symbol || "tokens"} on ${settlementName}.`;
  }, [activeAddress, chainNameById]);

  const pickerRow = (
    label: string,
    value: string,
    hint: string | undefined,
    onPress: () => void,
    disabled = false
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="bg-white dark:bg-accent rounded-xl px-4 py-4 flex-row justify-between items-center"
    >
      <View className="flex-1 pr-4">
        <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem]">{label}</CText>
        <CText style={{ fontFamily: "bold" }} className="text-[1rem] mt-1">
          {value}
        </CText>
        {hint ? (
          <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem] mt-0.5">{hint}</CText>
        ) : null}
      </View>
      {!disabled ? <IconLibrary.angle_right /> : null}
    </TouchableOpacity>
  );

  const setupContent = (
    <View className="gap-y-4 pb-10">
      <View className="gap-y-2">
        <CText style={{ fontFamily: "bold" }} className="text-[0.95rem]">
          Send from
        </CText>
        <CText className="text-gray-500 dark:text-gray-400 text-[0.85rem]">
          Which network and token will the sender use?
        </CText>
        {pickerRow(
          "Network",
          originChainLabel,
          originToken ? `Sending ${originToken.symbol}` : undefined,
          () => openPicker("originNetwork")
        )}
        {originChain
          ? pickerRow(
              "Token",
              originToken?.symbol ?? "Choose token",
              originToken?.name,
              () => openPicker("originToken")
            )
          : null}
      </View>

      <View className="gap-y-2">
        <CText style={{ fontFamily: "bold" }} className="text-[0.95rem]">
          Settle to
        </CText>
        <CText className="text-gray-500 dark:text-gray-400 text-[0.85rem]">
          Where should the funds arrive after bridging?
        </CText>
        {pickerRow(
          "Network",
          settlementChainLabel,
          settlementToken ? `Receiving ${settlementToken.symbol}` : undefined,
          () => openPicker("settlementNetwork"),
          lockSettlementNetwork
        )}
        {settlementChain
          ? pickerRow(
              "Token",
              settlementToken?.symbol ?? "Choose token",
              settlementToken?.name,
              () => openPicker("settlementToken")
            )
          : null}
        {settlementChain && !isSolanaSettlement ? (
          <View className="bg-white dark:bg-accent rounded-xl px-4 py-4">
            <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem]">
              Recipient wallet
            </CText>
            <TextInput
              className="h-[44px] mt-2 text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 px-3"
              value={settlementAddress}
              placeholder={`Enter ${settlementChainLabel} wallet address`}
              placeholderTextColor="grey"
              onChangeText={(value) => {
                setSettlementAddress(value);
                resetGeneratedAddress();
              }}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        ) : settlementChain && isSolanaSettlement ? (
          <View className="bg-white dark:bg-accent rounded-xl px-4 py-4">
            <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem]">
              Recipient wallet
            </CText>
            <CText style={{ fontFamily: "bold" }} className="text-[0.95rem] mt-2">
              Your HeySolana wallet
            </CText>
            <CText className="text-gray-500 dark:text-gray-400 text-[0.8rem] mt-1">
              {walletAddress}
            </CText>
          </View>
        ) : null}
      </View>

      {error ? (
        <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <CText className="text-red-600 dark:text-red-300">{error}</CText>
        </View>
      ) : null}

      <Buttons
        text={submitting ? "Creating address..." : "Generate deposit QR"}
        onPress={handleGenerate}
        loading={submitting}
      />
    </View>
  );

  const depositViewContent = activeAddress?.deposit_address ? (
    <View className="gap-y-4 pb-10">
      <TouchableOpacity onPress={startNewRoute} className="self-start px-1 py-1">
        <CText className="text-purple" style={{ fontFamily: "bold" }}>
          + Add new route
        </CText>
      </TouchableOpacity>

      <CrossChainDepositQr
        depositAddress={activeAddress.deposit_address}
        routeSummary={activeAddressRouteSummary}
      />
    </View>
  ) : null;

  const mainContent =
    depositViewActive && activeAddress?.deposit_address ? depositViewContent : setupContent;

  const pickerItems = filteredPickerItems as (DextopusChain | DextopusToken)[];

  return (
    <View className="relative w-full flex-1 items-start justify-start gap-y-4 bg-transparent">
      {loading ? (
        <View className="w-full py-10 items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : embedded ? (
        <View className="w-full">{mainContent}</View>
      ) : (
        <ScrollView
          className="w-full flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {mainContent}
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
                {pickerTitle}
              </CText>
              <SearchInput onSearch={setPickerSearch} value={pickerSearch} />

              <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                {pickerItems.length === 0 ? (
                  <CText className="text-center text-gray-500 py-6">No options found.</CText>
                ) : (
                  pickerItems.map((item) => {
                    if (activePicker === "originNetwork" || activePicker === "settlementNetwork") {
                      const chain = item as DextopusChain;
                      const selected =
                        activePicker === "originNetwork"
                          ? originChain?.chainId === chain.chainId
                          : settlementChain?.chainId === chain.chainId;
                      return (
                        <TouchableOpacity
                          key={`chain-${chain.chainId}`}
                          onPress={() =>
                            activePicker === "originNetwork"
                              ? selectOriginChain(chain)
                              : selectSettlementChain(chain)
                          }
                          className="py-4 border-b border-gray-100 dark:border-gray-800"
                        >
                          <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                            {formatChainName(chain.name)}
                          </CText>
                        </TouchableOpacity>
                      );
                    }

                    const token = item as DextopusToken;
                    const selected =
                      activePicker === "originToken"
                        ? originToken?.address === token.address
                        : settlementToken?.address === token.address;
                    return (
                      <TouchableOpacity
                        key={`token-${token.chainId}-${token.address}`}
                        onPress={() =>
                          activePicker === "originToken"
                            ? selectOriginToken(token)
                            : selectSettlementToken(token)
                        }
                        className="py-4 border-b border-gray-100 dark:border-gray-800"
                      >
                        <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                          {token.symbol}
                        </CText>
                        {token.name ? (
                          <CText className="text-gray-500 dark:text-gray-400 mt-1">{token.name}</CText>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          }
        />
      ) : null}
    </View>
  );
}
