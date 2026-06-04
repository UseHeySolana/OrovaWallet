import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { useThemeContext } from "@/context/ThemeContext";
import { confirm } from "@/services/confirmation";
import { signVersionedTxFromBase64 } from "@/utils/functions/extrafunctions";
import {
  browseTokenHitsForSwap,
  type TokenSearchHit,
} from "@/libs/jupiter/tokensV2Search";
import {
  getSwapV2Order,
  humanFromSmallestUnits,
  postSwapV2Execute,
  smallestUnitsFromHuman,
} from "@/libs/jupiter/swapV2";
import {
  getSwapFeeConfig,
  type SwapFeeConfig,
} from "@/services/swapFeeConfig";
import { recordSwapTransaction } from "@/services/appTransactions";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SLIPPAGE_BPS = 50;

export type SwapToken = {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
  balance?: number;
  /** Total USD value of wallet holding (from balance API). */
  usdcTotal?: number;
};

const DEFAULT_SOL: SwapToken = {
  mint: SOL_MINT,
  name: "Solana",
  symbol: "SOL",
  decimals: 9,
  image:
    "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422",
};

const DEFAULT_USDC: SwapToken = {
  mint: USDC_MINT,
  name: "USDC",
  symbol: "USDC",
  decimals: 6,
  image:
    "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?1547042194",
};

function walletTokenToSwapToken(t: any): SwapToken {
  return {
    mint: t.mint,
    name: t.name || t.symbol || "?",
    symbol: t.symbol || "?",
    decimals: t.decimals ?? 9,
    image: t.image,
    balance: typeof t.balance === "number" ? t.balance : undefined,
    usdcTotal:
      typeof t.usdc_price === "number" && Number.isFinite(t.usdc_price)
        ? t.usdc_price
        : undefined,
  };
}

function usdPerToken(token: SwapToken | null): number {
  if (!token?.balance || token.balance <= 0 || !token.usdcTotal) return 0;
  return token.usdcTotal / token.balance;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSwapPageAmount(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatEditableSwapAmount(value: string): string {
  if (!value) return "";
  const [integerPart, decimalPart] = value.split(".");
  const integer = integerPart
    ? Number(integerPart).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "0";

  if (value.endsWith(".")) return `${integer}.`;
  if (decimalPart != null) return `${integer}.${decimalPart.slice(0, 3)}`;
  return integer;
}

function formatBalance(token: SwapToken | null): string {
  if (!token?.balance) return "0";
  return formatSwapPageAmount(token.balance);
}

function hitToSwapToken(
  h: TokenSearchHit,
  walletByMint: Map<string, SwapToken>
): SwapToken {
  const held = walletByMint.get(h.meta.address);
  return {
    mint: h.meta.address,
    name: h.meta.name,
    symbol: h.meta.symbol,
    decimals: h.meta.decimals,
    image: h.meta.logo,
    balance: held?.balance,
    usdcTotal: held?.usdcTotal,
  };
}

function pickDefaultFrom(tokens: SwapToken[]): SwapToken {
  const sol = tokens.find((t) => t.mint === SOL_MINT);
  if (sol) return sol;
  return tokens[0] ?? DEFAULT_SOL;
}

/** Receive side defaults to USDC (wallet balance merged when held). */
function pickDefaultTo(
  walletByMint: Map<string, SwapToken>,
  fromMint: string
): SwapToken {
  if (fromMint === USDC_MINT) {
    return walletByMint.get(SOL_MINT) ?? DEFAULT_SOL;
  }
  return walletByMint.get(USDC_MINT) ?? DEFAULT_USDC;
}

export default function SwapScreen() {
  const { userWallet } = UserItem();
  const { publicKey } = WalletItem();
  const { isDarkMode } = useThemeContext();
  const { setToast } = AppSettings();

  const walletTokens = useMemo(
    () => (userWallet?.tokenAccounts ?? []).map(walletTokenToSwapToken),
    [userWallet?.tokenAccounts]
  );

  const walletByMint = useMemo(() => {
    const map = new Map<string, SwapToken>();
    for (const t of walletTokens) map.set(t.mint, t);
    return map;
  }, [walletTokens]);

  const [fromToken, setFromToken] = useState<SwapToken | null>(null);
  const [toToken, setToToken] = useState<SwapToken | null>(null);
  const [amount, setAmount] = useState("");
  const [quoteOut, setQuoteOut] = useState<number | null>(null);
  const [quoteMinOut, setQuoteMinOut] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapFeeConfig, setSwapFeeConfig] = useState<SwapFeeConfig>({
    referralAccount: "",
    referralFeeBps: 0,
  });

  const [pickerLeg, setPickerLeg] = useState<"from" | "to" | null>(null);
  const [sheetSearch, setSheetSearch] = useState("");
  const [searchHits, setSearchHits] = useState<TokenSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fromToken) return;
    const from = pickDefaultFrom(walletTokens);
    setFromToken(from);
    setToToken(pickDefaultTo(walletByMint, from.mint));
  }, [walletTokens, walletByMint, fromToken]);

  useEffect(() => {
    getSwapFeeConfig().then(setSwapFeeConfig);
  }, []);

  const orderExtras = useMemo(
    () => ({
      slippageBps: SLIPPAGE_BPS,
      ...(swapFeeConfig.referralAccount &&
        swapFeeConfig.referralFeeBps >= 50
        ? {
          referralAccount: swapFeeConfig.referralAccount,
          referralFeeBps: swapFeeConfig.referralFeeBps,
        }
        : {}),
    }),
    [swapFeeConfig]
  );

  const closePicker = () => {
    setPickerLeg(null);
    setSheetSearch("");
    setSearchHits([]);
  };

  const flipTokens = () => {
    if (!fromToken || !toToken) return;
    const prevFrom = fromToken;
    const prevTo = toToken;
    const walletMatch = walletTokens.find((t) => t.mint === prevTo.mint);
    setFromToken(walletMatch ?? prevTo);
    setToToken(prevFrom);
    setAmount("");
    setQuoteOut(null);
    setQuoteMinOut(null);
    setQuoteError(null);
  };

  const handleAmountChange = (text: string) => {
    const numeric = text.replace(/,/g, "").replace(/[^0-9.]/g, "");
    const parts = numeric.split(".");
    if (parts.length > 2) return;
    if (parts.length === 2 && parts[1].length > 3) {
      return;
    }
    setAmount(numeric);
  };

  const setAmountFromPercent = (pct: number) => {
    if (!fromToken?.balance) return;
    const val = fromToken.balance * pct;
    if (val <= 0) {
      setAmount("");
      return;
    }
    const str =
      val < 1
        ? val.toFixed(3).replace(/\.?0+$/, "")
        : val.toFixed(3).replace(/\.?0+$/, "");
    setAmount(str);
  };

  const sellUsd = useMemo(() => {
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num * usdPerToken(fromToken);
  }, [amount, fromToken]);

  const buyUsd = useMemo(() => {
    if (quoteOut == null || quoteOut <= 0) return 0;
    return quoteOut * usdPerToken(toToken);
  }, [quoteOut, toToken]);

  const fetchQuote = useCallback(async () => {
    if (!fromToken || !toToken || fromToken.mint === toToken.mint) {
      setQuoteOut(null);
      setQuoteMinOut(null);
      setQuoteError(null);
      return;
    }
    const num = parseFloat(amount);
    if (!amount || !Number.isFinite(num) || num <= 0) {
      setQuoteOut(null);
      setQuoteMinOut(null);
      setQuoteError(null);
      return;
    }

    const smallest = smallestUnitsFromHuman(num, fromToken.decimals);
    if (!smallest) {
      setQuoteOut(null);
      setQuoteMinOut(null);
      setQuoteError("Invalid amount");
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    const res = await getSwapV2Order({
      inputMint: fromToken.mint,
      outputMint: toToken.mint,
      amountSmallestInput: smallest,
      ...orderExtras,
    });
    setQuoteLoading(false);

    if (!res.status || !res.data) {
      setQuoteOut(null);
      setQuoteMinOut(null);
      setQuoteError(res.message || "Could not fetch quote");
      return;
    }

    setQuoteOut(humanFromSmallestUnits(res.data.outAmount, toToken.decimals));
    const minRaw = res.data.otherAmountThreshold ?? res.data.outAmount;
    setQuoteMinOut(humanFromSmallestUnits(minRaw, toToken.decimals));
  }, [fromToken, toToken, amount, orderExtras]);

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => {
      fetchQuote();
    }, 500);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [fetchQuote]);

  useEffect(() => {
    if (!pickerLeg) return;
    let cancelled = false;
    setSearchLoading(true);
    const delay = sheetSearch.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      const hits = await browseTokenHitsForSwap(sheetSearch);
      if (cancelled) return;
      setSearchHits(hits);
      setSearchLoading(false);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerLeg, sheetSearch]);

  /** Jupiter list; for SELL, tokens you hold float to the top. */
  const pickerHits = useMemo(() => {
    if (pickerLeg !== "from") return searchHits;
    return [...searchHits].sort((a, b) => {
      const balA = walletByMint.get(a.meta.address)?.balance ?? 0;
      const balB = walletByMint.get(b.meta.address)?.balance ?? 0;
      if (balB > 0 && balA <= 0) return 1;
      if (balA > 0 && balB <= 0) return -1;
      return 0;
    });
  }, [searchHits, pickerLeg, walletByMint]);

  const selectFromJupiter = (h: TokenSearchHit) => {
    const t = hitToSwapToken(h, walletByMint);
    if (pickerLeg === "from") {
      setFromToken(t);
      if (toToken?.mint === t.mint) {
        setToToken(pickDefaultTo(walletByMint, t.mint));
      }
    } else if (pickerLeg === "to") {
      setToToken(t);
      if (fromToken?.mint === t.mint) {
        const altHeld = walletTokens.find((w) => w.mint !== t.mint);
        if (altHeld) setFromToken(altHeld);
        else {
          const altHit = pickerHits.find((x) => x.meta.address !== t.mint);
          if (altHit) setFromToken(hitToSwapToken(altHit, walletByMint));
        }
      }
    }
    closePicker();
    setAmount("");
    setQuoteOut(null);
    setQuoteMinOut(null);
  };

  const feePercentLabel =
    swapFeeConfig.referralFeeBps >= 50
      ? (swapFeeConfig.referralFeeBps / 100).toFixed(2)
      : null;

  const canSwap =
    fromToken &&
    toToken &&
    fromToken.mint !== toToken.mint &&
    amount &&
    parseFloat(amount) > 0 &&
    quoteOut != null &&
    quoteOut > 0 &&
    !quoteLoading &&
    !swapping;

  const primaryLabel = swapping
    ? "Swapping…"
    : !amount || parseFloat(amount) <= 0
      ? "Enter amount"
      : quoteLoading
        ? "Fetching quote…"
        : canSwap
          ? "Swap"
          : quoteError
            ? "Unable to quote"
            : "Enter amount";

  const handleSwap = async () => {
    if (!fromToken || !toToken || !publicKey || !canSwap) return;

    const num = parseFloat(amount);
    if (fromToken.balance != null && num > fromToken.balance) {
      setToast("Insufficient balance", "error");
      return;
    }

    const smallest = smallestUnitsFromHuman(num, fromToken.decimals);
    if (!smallest) {
      setToast("Invalid amount", "error");
      return;
    }

    setSwapping(true);
    const orderRes = await getSwapV2Order({
      inputMint: fromToken.mint,
      outputMint: toToken.mint,
      amountSmallestInput: smallest,
      taker: publicKey.toString(),
      ...orderExtras,
    });

    if (!orderRes.status || !orderRes.data?.transaction) {
      setSwapping(false);
      setToast(orderRes.message || "Swap order failed", "error");
      return;
    }

    const orderData = orderRes.data;
    const requestId =
      typeof orderData.requestId === "string" && orderData.requestId.length > 0
        ? orderData.requestId
        : null;

    const outLabel = formatSwapPageAmount(
      humanFromSmallestUnits(orderData.outAmount, toToken.decimals)
    );

    const feeNote = feePercentLabel
      ? ` Includes ${feePercentLabel}% Hey Solana fee.`
      : "";
    const minNote =
      quoteMinOut != null && quoteMinOut > 0
        ? ` Min receive ~${formatSwapPageAmount(quoteMinOut)} ${toToken.symbol}.`
        : "";
    const approved = await confirm({
      message: `Swap ${formatSwapPageAmount(amount)} ${fromToken.symbol} → ~${outLabel} ${toToken.symbol}?${feeNote}${minNote}`,
      type: AppSettings.getState().openWithAuth ? "fingerprint" : undefined,
    });

    if (!approved) {
      setSwapping(false);
      return;
    }

    const signed = await signVersionedTxFromBase64(orderData.transaction);
    if (!signed.status) {
      setSwapping(false);
      setToast(signed.message || "Signing failed", "error");
      return;
    }

    if (requestId) {
      const execRes = await postSwapV2Execute({
        signedTransaction: signed.signedBase64,
        requestId,
        lastValidBlockHeight:
          typeof orderData.lastValidBlockHeight === "string"
            ? orderData.lastValidBlockHeight
            : undefined,
      });
      setSwapping(false);
      if (!execRes.status || !execRes.data?.signature) {
        setToast(execRes.message || "Swap failed", "error");
        return;
      }
      recordSwapTransaction({
        signature: execRes.data.signature,
        inputMint: fromToken.mint,
        inputSymbol: fromToken.symbol,
        inputAmount: num,
        outputMint: toToken.mint,
        outputSymbol: toToken.symbol,
        outputAmount: humanFromSmallestUnits(orderData.outAmount, toToken.decimals),
        platformFeeBps: swapFeeConfig.referralFeeBps,
        app_called: "Orova",
        provider: "jupiter",
      });
      router.replace({
        pathname: "/dashboard/transaction",
        params: {
          id: execRes.data.signature,
        },
      });
      return;
    }

    setSwapping(false);
    setToast("Swap could not be submitted (missing request id)", "error");
  };

  const TokenPill = ({
    token,
    onPress,
  }: {
    token: SwapToken | null;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-x-2 bg-grey dark:bg-accent2 rounded-full pl-2 pr-3 py-2"
    >
      {token ? (
        <>
          <View className="h-7 w-7 rounded-full overflow-hidden">
            <Image
              source={token.image ?? require("@/assets/images/icon.png")}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </View>
          <CText style={{ fontFamily: "bold" }} className="text-[15px]">
            {token.symbol}
          </CText>
        </>
      ) : (
        <CText className="text-[14px] px-1">Select</CText>
      )}
      <AntDesign
        name="down"
        size={12}
        color={isDarkMode ? "#9CA3AF" : "#6B7280"}
      />
    </Pressable>
  );

  const renderTokenRow = (
    t: SwapToken,
    selected: boolean,
    onPress: () => void,
    hit?: TokenSearchHit
  ) => (
    <Pressable
      android_ripple={{ color: "#971BB2" }}
      onPress={onPress}
      className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
    >
      <View className="flex-row items-center gap-x-3 flex-1">
        <View className="h-12 w-12 overflow-hidden rounded-full">
          <Image
            source={t.image ?? require("@/assets/images/icon.png")}
            style={{ height: "100%", width: "100%" }}
            contentFit="cover"
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-x-2">
            <CText style={{ fontFamily: "bold" }} className="text-[16px]">
              {t.symbol}
            </CText>
            {hit?.isVerified ? (
              <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded">
                <CText className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Verified
                </CText>
              </View>
            ) : null}
          </View>
          <CText
            className="text-[13px] text-gray-600 dark:text-gray-300"
            numberOfLines={1}
          >
            {t.name}
          </CText>
          {t.balance != null && t.balance > 0 ? (
            <CText className="text-[12px] text-purple mt-0.5">
              In wallet:{" "}
              {formatSwapPageAmount(t.balance)}
            </CText>
          ) : null}
        </View>
      </View>
      {selected ? <AntDesign name="check" size={20} color="#971BB2" /> : null}
    </Pressable>
  );

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
          Swap
        </CText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 160, flexGrow: 1 }}
      >
        {/* SELL */}
        <View className="bg-white dark:bg-accent rounded-2xl px-4 pt-3 pb-3 min-h-[140px]">
          <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            SELL
          </CText>

          <View className="flex-row items-start justify-between gap-x-3">
            <View className="flex-1 min-w-0">
              <TextInput
                className="text-[36px] text-black dark:text-white p-0"
                style={{ fontFamily: "bold", lineHeight: 42 }}
                value={formatEditableSwapAmount(amount)}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={isDarkMode ? "#4B5563" : "#D1D5DB"}
                keyboardType="decimal-pad"
              />
              <View className="flex-row items-center gap-x-2 mt-1">
                <CText className="text-[15px] text-gray-500 dark:text-gray-400">
                  {formatUsd(sellUsd)}
                </CText>
              </View>
            </View>
            <TokenPill
              token={fromToken}
              onPress={() => setPickerLeg("from")}
            />
          </View>

          <View className="flex-row justify-end mt-3">
            <CText className="text-[12px] text-gray-500 dark:text-gray-400">
              Balance: {formatBalance(fromToken)}
            </CText>
          </View>
        </View>

        {/* Flip */}
        <View className="items-center z-10" style={{ marginTop: -14, marginBottom: -14 }}>
          <Pressable
            onPress={flipTokens}
            className="p-2.5 rounded-full bg-white dark:bg-accent border-[3px] border-grey dark:border-dark"
          >
            <MaterialCommunityIcons
              name="swap-vertical"
              size={20}
              color="#971BB2"
            />
          </Pressable>
        </View>

        {/* BUY */}
        <View className="bg-white dark:bg-accent rounded-2xl px-4 pt-3 pb-3 min-h-[140px]">
          <View className="flex-row items-center gap-x-1.5 mb-3">
            <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400">
              BUY
            </CText>
            <Pressable
              hitSlop={8}
              onPress={() =>
                setToast(
                  feePercentLabel
                    ? `Jupiter quote · ${SLIPPAGE_BPS / 100}% slippage · ${feePercentLabel}% Hey Solana fee`
                    : `Jupiter quote · ${SLIPPAGE_BPS / 100}% max slippage`,
                  "info"
                )
              }
            >
              <AntDesign
                name="infocirlceo"
                size={13}
                color={isDarkMode ? "#6B7280" : "#9CA3AF"}
              />
            </Pressable>
          </View>

          <View className="flex-row items-start justify-between gap-x-3">
            <View className="flex-1 min-w-0">
              {quoteLoading ? (
                <ActivityIndicator color="#971BB2" style={{ marginVertical: 12 }} />
              ) : (
                <CText
                  style={{ fontFamily: "bold", lineHeight: 42 }}
                  className="text-[36px] text-black dark:text-white"
                >
                  {quoteOut != null ? formatSwapPageAmount(quoteOut) : "0"}
                </CText>
              )}
              <CText className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
                {formatUsd(buyUsd)}
              </CText>
              {quoteError ? (
                <CText className="text-[12px] text-red-400 mt-1">{quoteError}</CText>
              ) : null}
              {!quoteError && quoteMinOut != null && quoteMinOut > 0 && !quoteLoading ? (
                <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                  Min receive: {formatSwapPageAmount(quoteMinOut)} {toToken?.symbol ?? ""}
                </CText>
              ) : null}
              {feePercentLabel && !quoteLoading ? (
                <CText className="text-[12px] text-purple mt-0.5">
                  Hey Solana fee: {feePercentLabel}%
                </CText>
              ) : null}
            </View>
            <TokenPill token={toToken} onPress={() => setPickerLeg("to")} />
          </View>

          <View className="flex-row justify-end mt-3">
            <CText className="text-[12px] text-gray-500 dark:text-gray-400">
              Balance: {formatBalance(toToken)}
            </CText>
          </View>
        </View>

        {/* Percentage shortcuts */}
        <View className="flex-row gap-x-2 mt-6">
          {(
            [
              { label: "25%", pct: 0.25 },
              { label: "50%", pct: 0.5 },
              { label: "75%", pct: 0.75 },
              { label: "Max", pct: 1 },
            ] as const
          ).map(({ label, pct }) => (
            <Pressable
              key={label}
              onPress={() => setAmountFromPercent(pct)}
              className="flex-1 py-3.5 rounded-xl bg-white dark:bg-accent items-center justify-center active:opacity-80"
            >
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[15px] text-gray-700 dark:text-gray-200"
              >
                {label}
              </CText>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Primary CTA */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-2 bg-grey dark:bg-dark">
        <Pressable
          onPress={() => {
            if (canSwap && !swapping) void handleSwap();
          }}
          disabled={!canSwap || swapping}
          className={`w-full py-4 rounded-full items-center justify-center ${canSwap && !swapping
              ? "bg-[#971BB2]"
              : "bg-white dark:bg-accent"
            }`}
        >
          {swapping ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <CText
              style={{ fontFamily: "bold" }}
              className={`text-[16px] ${canSwap ? "text-white" : "text-gray-400 dark:text-gray-500"
                }`}
            >
              {primaryLabel}
            </CText>
          )}
        </Pressable>
      </View>

      {pickerLeg ? (
        <DragableSheet
          close={closePicker}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[18px] text-center"
              >
                {pickerLeg === "from" ? "Pay with" : "Receive"}
              </CText>
              <CText className="text-[12px] text-center text-gray-500 dark:text-gray-400">
                Jupiter token list · search any symbol or mint
              </CText>
              <SearchInput onSearch={setSheetSearch} value={sheetSearch} />

              {searchLoading ? (
                <ActivityIndicator color="#971BB2" className="py-6" />
              ) : pickerHits.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  {sheetSearch.trim()
                    ? "No tokens found. Try a symbol or mint address."
                    : "Could not load tokens. Check EXPO_PUBLIC_JUP_API_KEY."}
                </CText>
              ) : (
                <FlatList
                  data={pickerHits}
                  keyExtractor={(h) => h.meta.address}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  renderItem={({ item: h }) => {
                    const t = hitToSwapToken(h, walletByMint);
                    const selected =
                      pickerLeg === "from"
                        ? fromToken?.mint === h.meta.address
                        : toToken?.mint === h.meta.address;
                    return renderTokenRow(t, selected, () => selectFromJupiter(h), h);
                  }}
                />
              )}
            </View>
          }
        />
      ) : null}
    </View>
  );
}
