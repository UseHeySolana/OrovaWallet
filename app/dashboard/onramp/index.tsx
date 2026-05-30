import { useEffect, useMemo, useState } from "react";
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
import { PublicKey } from "@solana/web3.js";

import Buttons from "@/components/ButtonComp";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import PajCashSession from "@/utils/store/pajcashSession.store";
import { pajcash, Chain, Currency } from "@/libs/tools/pajcash/pajcash";
import { resolveTokenByQuery } from "@/utils/functions";
import {
  browseTokenHitsForSwap,
  type TokenSearchHit,
} from "@/libs/jupiter/tokensV2Search";

function isNigerianPhoneNumber(phone?: string | null): boolean {
  const compact = String(phone || "").replace(/[\s()-]/g, "");
  return (
    compact.startsWith("+234") ||
    compact.startsWith("234") ||
    /^0[789][01]\d{8}$/.test(compact)
  );
}

function normalizePhoneForPaj(phone?: string | null): string {
  const compact = String(phone || "").replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("234")) return `+${compact}`;
  if (/^0[789][01]\d{8}$/.test(compact)) return `+234${compact.slice(1)}`;
  return compact;
}

function parseMintAddress(token: string): string | null {
  try {
    return new PublicKey(token.trim()).toBase58();
  } catch {
    return null;
  }
}

function logOnramp(message: string, data?: Record<string, unknown>) {
  console.log("[PajCash Onramp]", message, data ?? "");
}

function logOnrampError(message: string, data?: Record<string, unknown>) {
  console.error("[PajCash Onramp]", message, data ?? "");
}

function shortMint(mint: string) {
  if (mint.length <= 14) return mint;
  return `${mint.slice(0, 6)}...${mint.slice(-6)}`;
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function formatQuoteAmount(value: unknown): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return String(value);
}

export default function Onramp() {
  const { user } = UserItem();
  const publicKey = WalletItem((state) => state.publicKey);
  const { setToast } = AppSettings();
  const pajSession = PajCashSession();

  const defaultRecipient = useMemo(
    () =>
      ToolsItem.getState().getParameterValue(
        "Pajcash",
        "credentials",
        "email_or_phone"
      ) ||
      user?.email ||
      normalizePhoneForPaj(user?.phoneE164 || user?.mobileNumber),
    [user?.email, user?.mobileNumber, user?.phoneE164]
  );
  const isNigerian = isNigerianPhoneNumber(user?.phoneE164 || user?.mobileNumber);

  const [emailOrPhone, setEmailOrPhone] = useState(defaultRecipient);
  const [otp, setOtp] = useState("");
  const [fiatAmount, setFiatAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [quoteMode, setQuoteMode] = useState<"fiat" | "token">("token");
  const [isTokenFirst, setIsTokenFirst] = useState(true);
  const [token, setToken] = useState("USDC");
  const [selectedToken, setSelectedToken] =
    useState<TokenSearchHit["meta"] | null>(null);
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenHits, setTokenHits] = useState<TokenSearchHit[]>([]);
  const [tokenSearchLoading, setTokenSearchLoading] = useState(false);
  const [loading, setLoading] = useState<
    "otp" | "verify" | "quote" | "order" | null
  >(null);
  const [order, setOrder] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [lastError, setLastError] = useState("");

  const saveRecipient = (value: string) => {
    logOnramp("Saving PajCash recipient", {
      recipient: value.includes("@") ? "email" : value,
    });
    ToolsItem.getState().updateToolParameter("Pajcash", "credentials", {
      type: "email_or_phone",
      value,
    });
  };

  const resolveMint = async (query: string) => {
    const normalizedQuery = query.trim();
    if (
      selectedToken &&
      (selectedToken.address === normalizedQuery ||
        selectedToken.symbol.toLowerCase() === normalizedQuery.toLowerCase())
    ) {
      logOnramp("Using selected token", {
        symbol: selectedToken.symbol,
        mint: selectedToken.address,
      });
      return selectedToken.address;
    }
    logOnramp("Resolving token", { query });
    const meta = await resolveTokenByQuery(query);
    if (meta && meta.symbol !== "SOL") {
      logOnramp("Resolved token from metadata", {
        symbol: meta.symbol,
        mint: meta.address,
        decimals: meta.decimals,
      });
      return meta.address;
    }
    const mint = parseMintAddress(query);
    if (mint) {
      logOnramp("Using raw mint address", { mint });
      return mint;
    }
    logOnrampError("Token resolution failed", { query });
    return null;
  };

  const tokenLabel = selectedToken?.symbol || token.trim().toUpperCase();
  const isPajCashVerified = pajSession.isSessionValid();
  const activeQuoteAmount = quoteMode === "fiat" ? fiatAmount : tokenAmount;
  const expectedTokenAmount =
    quoteMode === "fiat"
      ? formatQuoteAmount(quote?.amount) || tokenAmount
      : tokenAmount;
  const expectedFiatAmount =
    quoteMode === "token"
      ? formatQuoteAmount(quote?.fiatAmount) || fiatAmount
      : fiatAmount;

  useEffect(() => {
    if (!tokenPickerOpen) return;
    let cancelled = false;
    setTokenSearchLoading(true);
    const delay = tokenSearch.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      const hits = await browseTokenHitsForSwap(tokenSearch);
      if (cancelled) return;
      setTokenHits(hits.filter((hit) => hit.meta.symbol !== "SOL"));
      setTokenSearchLoading(false);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tokenPickerOpen, tokenSearch]);

  const closeTokenPicker = () => {
    setTokenPickerOpen(false);
    setTokenSearch("");
  };

  const selectToken = (hit: TokenSearchHit) => {
    setSelectedToken(hit.meta);
    setToken(hit.meta.symbol);
    setQuote(null);
    setQuoteError("");
    closeTokenPicker();
  };

  const handleFiatAmountChange = (value: string) => {
    const numeric = value.replace(/[^0-9.]/g, "");
    const parts = numeric.split(".");
    if (parts.length > 2) return;
    setQuoteMode("fiat");
    setFiatAmount(numeric);
    setQuote(null);
    setQuoteError("");
  };

  const handleTokenAmountChange = (value: string) => {
    const numeric = value.replace(/[^0-9.]/g, "");
    const parts = numeric.split(".");
    if (parts.length > 2) return;
    setQuoteMode("token");
    setTokenAmount(numeric);
    setQuote(null);
    setQuoteError("");
  };

  const sendOtp = async () => {
    const recipient = emailOrPhone.trim();
    if (!recipient) {
      setLastError("Enter your PajCash email or phone");
      setStatusMessage("");
      logOnrampError("OTP request blocked: missing recipient");
      setToast("Enter your PajCash email or phone", "error");
      return;
    }
    setLastError("");
    setStatusMessage("Sending PajCash OTP...");
    logOnramp("Sending OTP", {
      recipient: recipient.includes("@") ? "email" : recipient,
    });
    setLoading("otp");
    const res = await pajcash.initiateSession(recipient);
    setLoading(null);
    if (!res.status) {
      setLastError(res.message);
      setStatusMessage("");
      logOnrampError("OTP request failed", { message: res.message });
      setToast(res.message, "error");
      return;
    }
    saveRecipient(recipient);
    setStatusMessage("OTP sent. Check your phone or email.");
    logOnramp("OTP request succeeded", {
      destination: res.data.email ? "email" : res.data.phone,
    });
    setToast("PajCash OTP sent", "success");
  };

  const verifyOtp = async () => {
    const recipient = emailOrPhone.trim();
    if (!recipient || !otp.trim()) {
      setLastError("Enter your email/phone and OTP");
      setStatusMessage("");
      logOnrampError("OTP verify blocked: missing recipient or OTP", {
        hasRecipient: Boolean(recipient),
        hasOtp: Boolean(otp.trim()),
      });
      setToast("Enter your email/phone and OTP", "error");
      return;
    }
    setLastError("");
    setStatusMessage("Verifying PajCash OTP...");
    logOnramp("Verifying OTP", {
      recipient: recipient.includes("@") ? "email" : recipient,
    });
    setLoading("verify");
    const res = await pajcash.verifySession(recipient, otp);
    setLoading(null);
    if (!res.status) {
      const message =
        res.message === "Failed to initiate OTP: No recipients defined"
          ? "PajCash could not verify this recipient. Use the same email or phone number you requested the OTP with."
          : res.message;
      setLastError(message);
      setStatusMessage("");
      logOnrampError("OTP verify failed", { message });
      setToast(message, "error");
      return;
    }
    saveRecipient(recipient);
    setOtp("");
    setStatusMessage("PajCash verified. You can create an onramp order.");
    logOnramp("OTP verify succeeded", {
      recipient: res.data.recipient,
      expiresAt: res.data.expiresAt,
      isActive: res.data.isActive,
    });
    setToast("PajCash verified", "success");
  };

  const previewRate = async (options: { quiet?: boolean } = {}) => {
    if (!pajcash.getSessionToken()) {
      if (!options.quiet) {
        setLastError("Verify your PajCash session first");
        setStatusMessage("");
      }
      return;
    }

    const amount = parseAmount(activeQuoteAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !token.trim()) {
      if (!options.quiet) {
        setLastError("Enter a valid amount and token");
        setStatusMessage("");
      }
      return;
    }

    if (!options.quiet) {
      setLastError("");
      setQuoteError("");
      setStatusMessage("Fetching PajCash rate...");
      setLoading("quote");
    }

    const mint = await resolveMint(token);
    if (!mint) {
      if (!options.quiet) {
        setLastError("Could not resolve that SPL token");
        setQuoteError("Could not resolve that SPL token");
        setStatusMessage("");
        setLoading(null);
      }
      return;
    }

    logOnramp("Fetching onramp quote", {
      amount,
      quoteMode,
      currency: Currency.NGN,
      mint,
    });
    const res =
      quoteMode === "fiat"
        ? await pajcash.getTokenQuote(amount, mint, Currency.NGN)
        : await pajcash.getFiatQuote(amount, mint, Currency.NGN);

    if (!options.quiet) {
      setLoading(null);
    }

    if (!res.status) {
      setQuote(null);
      setQuoteError(res.message);
      if (!options.quiet) {
        setLastError(res.message);
        setStatusMessage("");
        setToast(res.message, "error");
      }
      logOnrampError("Quote failed", { message: res.message });
      return;
    }

    setQuote(res.data);
    setLastError("");
    setQuoteError("");
    if (quoteMode === "fiat") {
      setTokenAmount(formatQuoteAmount(res.data.amount));
    } else {
      setFiatAmount(formatQuoteAmount(res.data.fiatAmount));
    }
    if (!options.quiet) {
      setStatusMessage(
        quoteMode === "fiat"
          ? `Rate ready: ${amount} NGN is about ${res.data.amount ?? "?"} ${tokenLabel}.`
          : `Rate ready: ${amount} ${tokenLabel} is about ${res.data.fiatAmount ?? "?"} NGN.`
      );
    }
    logOnramp("Quote succeeded", {
      amount,
      quoteMode,
      fiatAmount: res.data.fiatAmount,
      tokenAmount: res.data.amount,
      rate: res.data.rate,
      tokenRate: res.data.tokenRate,
      mint: res.data.mint,
    });
  };

  useEffect(() => {
    if (!pajcash.getSessionToken()) return;
    const amount = parseAmount(activeQuoteAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !token.trim()) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const id = setTimeout(() => {
      void previewRate({ quiet: true });
    }, 800);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuoteAmount, quoteMode, token, selectedToken?.address]);

  const createOrder = async () => {
    if (!publicKey) {
      setLastError("Please connect your wallet first");
      setStatusMessage("");
      logOnrampError("Order blocked: wallet missing");
      setToast("Please connect your wallet first", "error");
      return;
    }
    if (!pajcash.getSessionToken()) {
      setLastError("Verify your PajCash session first");
      setStatusMessage("");
      logOnrampError("Order blocked: PajCash session missing or expired");
      setToast("Verify your PajCash session first", "error");
      return;
    }
    setLastError("");
    setStatusMessage("Resolving token...");
    const mint = await resolveMint(token);
    if (!mint) {
      setLastError("Could not resolve that SPL token");
      setStatusMessage("");
      setToast("Could not resolve that SPL token", "error");
      return;
    }

    let amount = parseAmount(fiatAmount);
    const desiredTokenAmount = parseAmount(tokenAmount);
    if (
      (!Number.isFinite(amount) || amount <= 0) &&
      quoteMode === "token" &&
      Number.isFinite(desiredTokenAmount) &&
      desiredTokenAmount > 0
    ) {
      setStatusMessage("Fetching PajCash rate...");
      const fiatQuote = await pajcash.getFiatQuote(desiredTokenAmount, mint, Currency.NGN);
      if (!fiatQuote.status) {
        setLastError(fiatQuote.message);
        setStatusMessage("");
        setToast(fiatQuote.message, "error");
        return;
      }
      const quotedFiat = parseAmount(String(fiatQuote.data.fiatAmount ?? ""));
      amount = quotedFiat;
      setFiatAmount(formatQuoteAmount(fiatQuote.data.fiatAmount));
      setQuote(fiatQuote.data);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setLastError("Enter a valid NGN amount");
      setStatusMessage("");
      logOnrampError("Order blocked: invalid fiat amount", { fiatAmount });
      setToast("Enter a valid NGN amount", "error");
      return;
    }

    setStatusMessage("Creating PajCash onramp order...");
    logOnramp("Creating order", {
      fiatAmount: amount,
      currency: Currency.NGN,
      recipient: publicKey.toBase58(),
      mint,
      chain: Chain.SOLANA,
    });
    setLoading("order");
    const res = await pajcash.createOnramp({
      fiatAmount: amount,
      currency: Currency.NGN,
      recipient: publicKey.toBase58(),
      mint,
      chain: Chain.SOLANA,
    });
    setLoading(null);

    if (!res.status) {
      setLastError(res.message);
      setStatusMessage("");
      logOnrampError("Order creation failed", { message: res.message });
      setToast(res.message, "error");
      return;
    }

    setOrder(res.data);
    setLastError("");
    setStatusMessage("Onramp order created. Pay the bank details below.");
    logOnramp("Order creation succeeded", {
      id: res.data.id,
      bank: res.data.bank,
      accountNumber: res.data.accountNumber,
      fiatAmount: res.data.fiatAmount,
      amount: res.data.amount,
      mint: res.data.mint,
      rate: res.data.rate,
      fee: res.data.fee,
    });
    setToast("Onramp order created", "success");
  };

  const renderTokenRow = ({ item }: { item: TokenSearchHit }) => {
    const isSelected = selectedToken?.address === item.meta.address;
    return (
      <Pressable
        onPress={() => selectToken(item)}
        className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
      >
        <View className="flex-row items-center gap-x-3 flex-1">
          <View className="h-11 w-11 rounded-full overflow-hidden bg-grey/50 dark:bg-accent2">
            <Image
              source={{ uri: item.meta.logo }}
              style={{ height: "100%", width: "100%" }}
              contentFit="cover"
            />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-x-2">
              <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                {item.meta.symbol}
              </CText>
              {item.isVerified ? (
                <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded">
                  <CText className="text-[0.65rem] text-emerald-600 dark:text-emerald-400">
                    Verified
                  </CText>
                </View>
              ) : null}
            </View>
            <CText
              numberOfLines={1}
              className="text-[0.85rem] text-black/60 dark:text-grey/70"
            >
              {item.meta.name}
            </CText>
            <CText className="text-[0.75rem] text-black/40 dark:text-grey/50">
              {shortMint(item.meta.address)}
            </CText>
          </View>
        </View>
        {isSelected ? <AntDesign name="check" size={20} color="#971BB2" /> : null}
      </Pressable>
    );
  };

  const TokenPill = () => (
    <Pressable
      onPress={() => setTokenPickerOpen(true)}
      className="flex-row items-center gap-x-2 bg-grey dark:bg-accent2 rounded-full pl-2 pr-3 py-2"
    >
      {selectedToken ? (
        <View className="h-7 w-7 rounded-full overflow-hidden bg-grey/50 dark:bg-accent2">
          <Image
            source={{ uri: selectedToken.logo }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>
      ) : null}
      <CText style={{ fontFamily: "bold" }} className="text-[15px]">
        {tokenLabel || "Token"}
      </CText>
      <AntDesign name="down" size={12} color="#6B7280" />
    </Pressable>
  );

  const fiatAmountCard = (
    <View className="bg-white dark:bg-accent rounded-2xl px-4 pt-3 pb-3 min-h-[135px]">
      <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-3">
        YOU PAY
      </CText>
      <View className="flex-row items-start justify-between gap-x-3">
        <View className="flex-1 min-w-0">
          {loading === "quote" && quoteMode === "token" ? (
            <ActivityIndicator color="#971BB2" style={{ marginVertical: 12 }} />
          ) : (
            <TextInput
              className="text-[36px] text-black dark:text-white p-0"
              style={{ fontFamily: "bold", lineHeight: 42 }}
              value={fiatAmount}
              onChangeText={handleFiatAmountChange}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
            />
          )}
          <CText className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
            NGN
          </CText>
        </View>
        <View className="bg-grey dark:bg-accent2 rounded-full px-3 py-2">
          <CText style={{ fontFamily: "bold" }} className="text-[15px]">
            NGN
          </CText>
        </View>
      </View>
    </View>
  );

  const tokenAmountCard = (
    <View className="bg-white dark:bg-accent rounded-2xl px-4 pt-3 pb-3 min-h-[145px]">
      <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-3">
        YOU RECEIVE
      </CText>
      <View className="flex-row items-start justify-between gap-x-3">
        <View className="flex-1 min-w-0">
          {loading === "quote" && quoteMode === "fiat" ? (
            <ActivityIndicator color="#971BB2" style={{ marginVertical: 12 }} />
          ) : (
            <TextInput
              className="text-[36px] text-black dark:text-white p-0"
              style={{ fontFamily: "bold", lineHeight: 42 }}
              value={tokenAmount}
              onChangeText={handleTokenAmountChange}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
            />
          )}
          <CText className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
            Expected: {expectedTokenAmount || "0"} {tokenLabel || "token"}
          </CText>
          {expectedFiatAmount ? (
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Pay about {expectedFiatAmount} NGN
            </CText>
          ) : null}
          {quoteError ? (
            <CText className="text-[12px] text-red-400 mt-1">{quoteError}</CText>
          ) : null}
        </View>
        <TokenPill />
      </View>
      <View className="mt-3">
        <TextInput
          className="w-full h-[44px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 px-3"
          value={token}
          placeholder="Token symbol or mint, e.g. BONK"
          placeholderTextColor="grey"
          onChangeText={(value) => {
            setToken(value);
            setSelectedToken(null);
            setQuote(null);
            setQuoteError("");
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <CText className="text-[0.8rem] text-black/50 dark:text-grey/60 mt-1">
          Search or paste any SPL token mint.
        </CText>
      </View>
    </View>
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
          PajCash Onramp
        </CText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="w-full gap-y-5">
          {!!statusMessage && (
            <View className="w-full p-3 rounded-2xl bg-green-100 dark:bg-green-950/30">
              <CText
                style={{ fontFamily: "reg" }}
                className="text-[0.95rem]"
                textColor="text-green-700 dark:text-green-300"
              >
                {statusMessage}
              </CText>
            </View>
          )}

          {!!lastError && (
            <View className="w-full p-3 rounded-2xl bg-red-100 dark:bg-red-950/30">
              <CText
                style={{ fontFamily: "reg" }}
                className="text-[0.95rem]"
                textColor="text-red-700 dark:text-red-300"
              >
                {lastError}
              </CText>
            </View>
          )}

          {!isNigerian ? (
            <View className="w-full p-4 rounded-2xl bg-grey/50 dark:bg-black/30 gap-y-2">
              <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                Not available for this account
              </CText>
              <CText className="text-[0.95rem] text-black/70 dark:text-grey/70">
                PajCash onramp is currently enabled for Nigerian users only.
                Update your account phone number to a +234 number to use it.
              </CText>
            </View>
          ) : (
            <>
              {!isPajCashVerified ? (
                <View className="w-full p-4 rounded-2xl bg-grey/50 dark:bg-black/30 gap-y-3">
                  <View className="flex-row justify-between items-center">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                      PajCash verification
                    </CText>
                    <CText className="text-[0.85rem]" textColor="text-orange-500">
                      OTP needed
                    </CText>
                  </View>
                  <TextInput
                    className="w-full h-[46px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-3"
                    value={emailOrPhone}
                    placeholder="Email or +234 phone"
                    placeholderTextColor="grey"
                    onChangeText={setEmailOrPhone}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  <TextInput
                    className="w-full h-[46px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-3"
                    value={otp}
                    placeholder="OTP"
                    placeholderTextColor="grey"
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />
                  <View className="flex-row gap-x-2">
                    <Buttons
                      type="secondary"
                      className="flex-1 py-3 px-4 rounded-3xl"
                      text="Send OTP"
                      loading={loading === "otp"}
                      onPress={sendOtp}
                    />
                    <Buttons
                      type="primary"
                      className="flex-1 py-3 px-4 rounded-3xl"
                      text="Verify"
                      loading={loading === "verify"}
                      onPress={verifyOtp}
                    />
                  </View>
                </View>
              ) : null}

              <View className="w-full gap-y-3">
                {isTokenFirst ? tokenAmountCard : fiatAmountCard}

                <View className="items-center z-10" style={{ marginTop: -14, marginBottom: -14 }}>
                  <Pressable
                    onPress={() => setIsTokenFirst((value) => !value)}
                    className="p-2.5 rounded-full bg-white dark:bg-accent border-[3px] border-grey dark:border-dark"
                  >
                    <MaterialCommunityIcons
                      name="swap-vertical"
                      size={20}
                      color="#971BB2"
                    />
                  </Pressable>
                </View>

                {isTokenFirst ? fiatAmountCard : tokenAmountCard}
                <Buttons
                  type="primary"
                  className="w-full py-4 px-4 rounded-3xl"
                  text="Create Onramp Order"
                  loading={loading === "order"}
                  onPress={createOrder}
                />
              </View>

              {order && (
                <View className="w-full p-4 rounded-2xl bg-grey/50 dark:bg-black/30 gap-y-2">
                  <CText style={{ fontFamily: "bold" }} className="text-[1.15rem]">
                    Pay bank transfer
                  </CText>
                  <CText>Bank: {order.bank}</CText>
                  <CText>Account name: {order.accountName}</CText>
                  <CText>Account number: {order.accountNumber}</CText>
                  <CText>Amount: {order.fiatAmount} NGN</CText>
                  <CText>Token amount: {order.amount}</CText>
                  <CText className="text-[0.9rem] text-black/70 dark:text-grey/70">
                    Order ID: {order.id}
                  </CText>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      {tokenPickerOpen ? (
        <DragableSheet
          close={closeTokenPicker}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select SPL token
              </CText>
              <CText className="text-[12px] text-center text-gray-500 dark:text-gray-400">
                Jupiter token list · search any symbol or mint
              </CText>
              <SearchInput onSearch={setTokenSearch} value={tokenSearch} />
              {tokenSearchLoading ? (
                <ActivityIndicator color="#971BB2" className="py-6" />
              ) : tokenHits.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  {tokenSearch.trim()
                    ? "No tokens found. Try a symbol or mint address."
                    : "Could not load tokens. Check EXPO_PUBLIC_JUP_API_KEY."}
                </CText>
              ) : (
                <FlatList
                  data={tokenHits}
                  keyExtractor={(hit) => hit.meta.address}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  renderItem={renderTokenRow}
                />
              )}
            </View>
          }
        />
      ) : null}
    </View>
  );
}
