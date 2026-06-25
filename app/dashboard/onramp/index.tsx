import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import { pajcash, Chain, Currency, PAJCASH_REVALIDATE_MESSAGE } from "@/libs/tools/pajcash/pajcash";
import { getPajCashFeeConfig } from "@/services/pajcashFeeConfig";
import { copyItem, resolveTokenByQuery } from "@/utils/functions";
import { refreshUserWalletBalances } from "@/utils/wallet/walletBalanceCache";
import {
  collectWalletIncomingChanges,
  snapshotUserWallet,
} from "@/utils/wallet/walletChangeNotify";
import {
  browseTokenHitsForSwap,
  type TokenSearchHit,
} from "@/libs/jupiter/tokensV2Search";
import {
  recordDepositTransaction,
  type AppTransactionStatus,
} from "@/services/appTransactions";
import {
  findOrCreateDextopusDepositAddress,
  DEXTOPUS_BRIDGE_FEE_RATE,
  DEXTOPUS_NATIVE_SOL_ASSET,
  DEXTOPUS_SOLANA_CHAIN_ID,
  DEXTOPUS_USDC_MAINNET,
  PAJCASH_SOL_MINT,
  grossUpForDextopusFee,
  isEvmAddress,
  getDextopusChains,
  getDextopusTokens,
  type DextopusChain,
  type DextopusToken,
} from "@/services/dextopusApi";

type OnrampBridgeRoute = {
  deposit_address: string;
  settlement_chain_id: number;
  settlement_chain_name: string;
  settlement_asset: string;
  settlement_symbol: string;
  settlement_address: string;
  recipient_receive_amount: number;
  /** USDC-equivalent value routed through Dextopus (for quotes and metadata). */
  usdc_equivalent_amount: number;
  /** Native SOL amount PajCash delivers to the Dextopus deposit address. */
  sol_send_amount: number;
};

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

function formatAmountWithCommas(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/,/g, "");
  const [integerPart, decimalPart] = normalized.split(".");
  if (!integerPart || Number.isNaN(Number(normalized))) return raw;
  const sign = integerPart.startsWith("-") ? "-" : "";
  const unsignedInteger = sign ? integerPart.slice(1) : integerPart;
  const formattedInteger = unsignedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${formattedInteger}${decimalPart != null ? `.${decimalPart}` : ""}`;
}

const SOL_MINT = PAJCASH_SOL_MINT;

/** Convert a USDC-equivalent amount to SOL using PajCash rates (for bridged onramp funding). */
async function resolveSolAmountForBridge(usdcEquivalent: number): Promise<number> {
  if (!Number.isFinite(usdcEquivalent) || usdcEquivalent <= 0) {
    throw new Error("Enter a valid amount before creating the order.");
  }
  const fiatRes = await pajcash.getFiatQuote(
    usdcEquivalent,
    DEXTOPUS_USDC_MAINNET,
    Currency.NGN
  );
  if (!fiatRes.status) {
    throw new Error(fiatRes.message || "Could not price SOL for this order.");
  }
  const solRes = await pajcash.getTokenQuote(
    fiatRes.data.fiatAmount,
    SOL_MINT,
    Currency.NGN
  );
  if (!solRes.status) {
    throw new Error(solRes.message || "Could not price SOL for this order.");
  }
  const amount = Number(solRes.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Could not compute SOL amount for this order.");
  }
  return amount;
}

const NATIVE_SOL_HIT: TokenSearchHit = {
  meta: {
    name: "Solana",
    address: SOL_MINT,
    symbol: "SOL",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png?1640133422",
  },
  isVerified: true,
};

function isNativeSolQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    q === "sol" ||
    q === "solana" ||
    q === SOL_MINT.toLowerCase() ||
    SOL_MINT.toLowerCase().startsWith(q)
  );
}

/** Jupiter search can return other "SOL" tokens; pin wrapped native SOL first. */
function withNativeSolFirst(hits: TokenSearchHit[], query: string): TokenSearchHit[] {
  if (!isNativeSolQuery(query)) return hits;
  const rest = hits.filter((hit) => hit.meta.address !== SOL_MINT);
  return [NATIVE_SOL_HIT, ...rest];
}

function orderStatusValues(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const keys = [
    "status",
    "state",
    "paymentStatus",
    "transactionStatus",
    "orderStatus",
    "fiatStatus",
    "cryptoStatus",
  ];
  return keys
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}

function isOrderConfirmed(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (record.isPaid === true || record.isCompleted === true || record.confirmed === true) {
    return true;
  }
  return orderStatusValues(data).some((status) =>
    ["paid", "confirmed", "complete", "completed", "successful", "success", "settled"].includes(status)
  );
}

function isOrderFailed(data: unknown): boolean {
  return orderStatusValues(data).some((status) =>
    ["failed", "cancelled", "canceled", "expired", "rejected"].includes(status)
  );
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function pajCashOrderId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return asOptionalString(
    record.id ??
    record.orderId ??
    record.order_id ??
    record.transactionId ??
    record.transaction_id ??
    record.reference ??
    record.referenceId ??
    record.reference_id ??
    record.paymentReference ??
    record.payment_reference
  );
}

function pajCashTokenAmount(
  data: unknown,
  fallback?: unknown
): number | undefined {
  if (!data || typeof data !== "object") return asFiniteNumber(fallback);
  const record = data as Record<string, unknown>;
  return asFiniteNumber(
    record.amount ??
    record.tokenAmount ??
    record.token_amount ??
    record.cryptoAmount ??
    record.crypto_amount ??
    record.receiveAmount ??
    record.receive_amount ??
    record.outputAmount ??
    record.output_amount ??
    fallback
  );
}

function pajCashOrderSignature(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  return asOptionalString(
    record.signature ??
    record.transactionHash ??
    record.transaction_hash ??
    record.txHash ??
    record.tx_hash ??
    record.hash
  );
}

export default function Onramp() {
  const { user } = UserItem();
  const publicKey = WalletItem((state) => state.publicKey);
  const { setToast } = AppSettings();
  const pajSession = PajCashSession();
  const paymentPollRunRef = useRef(0);
  const recordedOnrampStatesRef = useRef<Set<string>>(new Set());

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
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState("");
  const [paymentCheckState, setPaymentCheckState] = useState<
    "idle" | "checking" | "confirmed" | "failed"
  >("idle");
  const [paymentCheckMessage, setPaymentCheckMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [lastError, setLastError] = useState("");
  const [platformUsdcFee, setPlatformUsdcFee] = useState(0);

  const [selectedChainId, setSelectedChainId] = useState(DEXTOPUS_SOLANA_CHAIN_ID);
  const [chains, setChains] = useState<DextopusChain[]>([]);
  const [chainPickerOpen, setChainPickerOpen] = useState(false);
  const [chainSearch, setChainSearch] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [dextopusAddress, setDextopusAddress] = useState<string | null>(null);
  const [activeBridgeRoute, setActiveBridgeRoute] = useState<OnrampBridgeRoute | null>(null);
  const [dextopusTokens, setDextopusTokens] = useState<DextopusToken[]>([]);
  const [dexTokenSearchLoading, setDexTokenSearchLoading] = useState(false);
  const [bridgedSolPreview, setBridgedSolPreview] = useState<number | null>(null);

  const isSolanaChain = selectedChainId === DEXTOPUS_SOLANA_CHAIN_ID;

  useEffect(() => {
    getDextopusChains().then((list) => setChains(list)).catch(() => { });
  }, []);

  useEffect(() => {
    void getPajCashFeeConfig().then((config) => {
      setPlatformUsdcFee(config.onrampUsdcFee);
    });
  }, []);

  useEffect(() => {
    if (isSolanaChain) return;
    let cancelled = false;
    setDexTokenSearchLoading(true);
    getDextopusTokens(selectedChainId, false)
      .then((tokens) => {
        if (!cancelled) setDextopusTokens(tokens);
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setDexTokenSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedChainId, isSolanaChain]);

  const filteredChains = useMemo(() => {
    const query = chainSearch.trim().toLowerCase();
    if (!query) return chains;
    return chains.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        String(c.chainId).includes(query)
    );
  }, [chains, chainSearch]);

  const formatDexChainName = (name: string) =>
    name
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  const selectedChainName = useMemo(() => {
    if (isSolanaChain) return "Solana";
    const found = chains.find((c) => c.chainId === selectedChainId);
    return found ? formatDexChainName(found.name) : `Chain ${selectedChainId}`;
  }, [chains, selectedChainId, isSolanaChain]);

  const saveRecipient = (value: string) => {
    logOnramp("Saving PajCash recipient", {
      recipient: value.includes("@") ? "email" : value,
    });
    ToolsItem.getState().updateToolParameter("Pajcash", "credentials", {
      type: "email_or_phone",
      value,
    });
  };

  const recordPajCashOnrampOrder = (
    orderData: unknown,
    status: AppTransactionStatus,
    statusData?: unknown,
    bridgeRoute?: OnrampBridgeRoute | null
  ) => {
    if (!publicKey || !orderData || typeof orderData !== "object") {
      logOnrampError("Skipping transaction record: missing wallet or order data", {
        hasPublicKey: Boolean(publicKey),
        hasOrderData: Boolean(orderData),
      });
      return;
    }

    const orderRecord = orderData as Record<string, unknown>;
    const orderId = pajCashOrderId(orderData);
    const amount =
      bridgeRoute?.recipient_receive_amount ??
      pajCashTokenAmount(orderData, quote?.amount ?? tokenAmount);

    if (!orderId || amount == null) {
      logOnrampError("Skipping transaction record: missing order id or token amount", {
        orderKeys: Object.keys(orderRecord),
        hasOrderId: Boolean(orderId),
        hasAmount: amount != null,
      });
      return;
    }

    const recordKey = `${orderId}:${status}`;
    if (recordedOnrampStatesRef.current.has(recordKey)) return;
    recordedOnrampStatesRef.current.add(recordKey);

    recordDepositTransaction({
      client_reference: `pajcash:onramp:${orderId}`,
      signature: pajCashOrderSignature(statusData) ?? pajCashOrderSignature(orderData),
      provider: "pajcash",
      app_called: "Pajcash",
      amount,
      token: asOptionalString(
        orderRecord.tokenSymbol ?? orderRecord.token_symbol ?? orderRecord.symbol
      ) ?? tokenLabel,
      mint: asOptionalString(orderRecord.mint ?? quote?.mint) ?? selectedToken?.address,
      recipient: bridgeRoute?.settlement_address ?? publicKey.toBase58(),
      status,
      raw_metadata: {
        order_id: orderId,
        wallet_address: publicKey.toBase58(),
        fiat_amount: asOptionalString(
          orderRecord.fiatAmount ?? orderRecord.fiat_amount ?? fiatAmount
        ),
        bank: asOptionalString(orderRecord.bank),
        account_number: asOptionalString(
          orderRecord.accountNumber ?? orderRecord.account_number
        ),
        account_name: asOptionalString(
          orderRecord.accountName ?? orderRecord.account_name
        ),
        rate: asOptionalString(orderRecord.rate),
        fee: asOptionalString(orderRecord.fee),
        confirmation_source:
          status === "confirmed"
            ? statusData
              ? "pajcash_status"
              : "wallet_activity"
            : "order_created",
        ...(bridgeRoute
          ? {
              bridge: {
                provider: "dextopus",
                pajcash_recipient: bridgeRoute.deposit_address,
                deposit_address: bridgeRoute.deposit_address,
                origin_chain_id: DEXTOPUS_SOLANA_CHAIN_ID,
                origin_asset: DEXTOPUS_NATIVE_SOL_ASSET,
                origin_symbol: "SOL",
                pajcash_mint: SOL_MINT,
                settlement_chain_id: bridgeRoute.settlement_chain_id,
                settlement_chain_name: bridgeRoute.settlement_chain_name,
                settlement_asset: bridgeRoute.settlement_asset,
                settlement_symbol: bridgeRoute.settlement_symbol,
                settlement_address: bridgeRoute.settlement_address,
                recipient_receive_amount: bridgeRoute.recipient_receive_amount,
                usdc_equivalent_amount: bridgeRoute.usdc_equivalent_amount,
                sol_send_amount: bridgeRoute.sol_send_amount,
                dextopus_fee_rate: DEXTOPUS_BRIDGE_FEE_RATE,
              },
            }
          : {}),
      },
    });
  };

  useEffect(() => {
    return () => {
      paymentPollRunRef.current += 1;
    };
  }, []);

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
    if (isNativeSolQuery(normalizedQuery)) {
      logOnramp("Resolved native SOL", { mint: SOL_MINT });
      return SOL_MINT;
    }
    logOnramp("Resolving token", { query });
    const meta = await resolveTokenByQuery(query);
    if (meta) {
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

  const tokenLabel = isSolanaChain
    ? (selectedToken?.symbol || token.trim().toUpperCase())
    : "USDC";
  const isPajCashVerified = pajSession.isSessionValid();
  const activeQuoteAmount = quoteMode === "fiat" ? fiatAmount : tokenAmount;
  const parsedRecipientAmount = parseAmount(tokenAmount);
  const bridgedUsdcEquivalent =
    !isSolanaChain && Number.isFinite(parsedRecipientAmount) && parsedRecipientAmount > 0
      ? grossUpForDextopusFee(parsedRecipientAmount)
      : null;
  const expectedTokenAmount =
    quoteMode === "fiat"
      ? formatQuoteAmount(quote?.amount) || tokenAmount
      : tokenAmount;
  const expectedFiatAmount =
    quoteMode === "token"
      ? formatQuoteAmount(quote?.fiatAmount) || fiatAmount
      : fiatAmount;
  const formattedExpectedTokenAmount = formatAmountWithCommas(expectedTokenAmount);
  const formattedExpectedFiatAmount = formatAmountWithCommas(expectedFiatAmount);

  useEffect(() => {
    if (isSolanaChain || !bridgedUsdcEquivalent || !pajcash.getSessionToken()) {
      setBridgedSolPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void resolveSolAmountForBridge(bridgedUsdcEquivalent)
        .then((solAmount) => {
          if (!cancelled) setBridgedSolPreview(solAmount);
        })
        .catch(() => {
          if (!cancelled) setBridgedSolPreview(null);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isSolanaChain, bridgedUsdcEquivalent]);

  useEffect(() => {
    if (!tokenPickerOpen) return;
    if (!isSolanaChain) {
      const query = tokenSearch.trim().toLowerCase();
      const source = query
        ? dextopusTokens.filter(
          (t) =>
            t.symbol.toLowerCase().includes(query) ||
            t.name?.toLowerCase().includes(query) ||
            t.address.toLowerCase().includes(query)
        )
        : dextopusTokens;
      const hits: TokenSearchHit[] = source.slice(0, 30).map((t) => ({
        meta: {
          address: t.address,
          symbol: t.symbol,
          name: t.name ?? t.symbol,
          decimals: t.decimals ?? 6,
          logo: t.logoUrl ?? "",
        },
        isVerified: true,
      }));
      setTokenHits(hits);
      return;
    }

    let cancelled = false;
    setTokenSearchLoading(true);
    const delay = tokenSearch.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      const hits = await browseTokenHitsForSwap(tokenSearch);
      if (cancelled) return;
      setTokenHits(withNativeSolFirst(hits, tokenSearch));
      setTokenSearchLoading(false);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tokenPickerOpen, tokenSearch, isSolanaChain, dextopusTokens]);

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
        setLastError(PAJCASH_REVALIDATE_MESSAGE);
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

    const mint = !isSolanaChain
      ? DEXTOPUS_USDC_MAINNET
      : await resolveMint(token);
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
        : await pajcash.getFiatQuote(
            !isSolanaChain ? grossUpForDextopusFee(amount) : amount,
            mint,
            Currency.NGN
          );

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
    const quoteData = res.data;
    logOnramp("Quote succeeded", {
      amount,
      quoteMode,
      fiatAmount: quoteData.fiatAmount,
      tokenAmount: quoteData.amount,
      rate: "rate" in quoteData ? quoteData.rate : undefined,
      tokenRate: quoteData.tokenRate,
      mint: quoteData.mint,
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
      setLastError(PAJCASH_REVALIDATE_MESSAGE);
      setStatusMessage("");
      logOnrampError("Order blocked: PajCash session missing or expired");
      setToast(PAJCASH_REVALIDATE_MESSAGE, "error");
      return;
    }
    setLastError("");
    setStatusMessage("Resolving token...");
    const mint = !isSolanaChain
      ? DEXTOPUS_USDC_MAINNET
      : await resolveMint(token);
    if (!mint) {
      setLastError("Could not resolve that SPL token");
      setStatusMessage("");
      setToast("Could not resolve that SPL token", "error");
      return;
    }

    const desiredTokenAmount = parseAmount(tokenAmount);
    const orderByTokenAmount =
      quoteMode === "token" &&
      Number.isFinite(desiredTokenAmount) &&
      desiredTokenAmount > 0;

    let fiatOrderAmount = parseAmount(fiatAmount);

    if (!orderByTokenAmount) {
      if (!Number.isFinite(fiatOrderAmount) || fiatOrderAmount <= 0) {
        setLastError("Enter a valid NGN amount");
        setStatusMessage("");
        logOnrampError("Order blocked: invalid fiat amount", { fiatAmount });
        setToast("Enter a valid NGN amount", "error");
        return;
      }
    }

    if (!isSolanaChain && !destAddress.trim()) {
      setLastError(`Enter the ${selectedChainName} wallet address to receive ${tokenLabel}`);
      setStatusMessage("");
      setToast(`Enter the ${selectedChainName} wallet address`, "error");
      return;
    }

    if (!isSolanaChain && !isEvmAddress(destAddress)) {
      const message = `Enter a valid ${selectedChainName} wallet address (0x…).`;
      setLastError(message);
      setStatusMessage("");
      setToast(message, "error");
      return;
    }

    let bridgeRoute: OnrampBridgeRoute | null = null;
    let pajcashMint = mint;
    let pajcashTokenAmount = orderByTokenAmount ? desiredTokenAmount : undefined;

    // Cross-chain: PajCash funds Dextopus with native SOL; Dextopus settles on the recipient chain.
    if (!isSolanaChain && selectedToken && destAddress.trim()) {
      setStatusMessage("Preparing bridge route...");
      setDextopusAddress(null);
      setActiveBridgeRoute(null);
      try {
        const dexAddr = await findOrCreateDextopusDepositAddress({
          wallet_address: publicKey.toBase58(),
          origin_chain_id: DEXTOPUS_SOLANA_CHAIN_ID,
          origin_asset: DEXTOPUS_NATIVE_SOL_ASSET,
          origin_symbol: "SOL",
          settlement_chain_id: selectedChainId,
          settlement_asset: selectedToken.address,
          settlement_symbol: selectedToken.symbol,
          settlement_address: destAddress.trim(),
        });
        const recipientReceiveAmount =
          orderByTokenAmount && Number.isFinite(desiredTokenAmount) && desiredTokenAmount > 0
            ? desiredTokenAmount
            : parseAmount(formatQuoteAmount(quote?.amount) || "0");
        const usdcEquivalentAmount =
          recipientReceiveAmount > 0
            ? grossUpForDextopusFee(recipientReceiveAmount)
            : grossUpForDextopusFee(parseAmount(formatQuoteAmount(quote?.amount) || "0"));

        let solSendAmount: number;
        if (orderByTokenAmount) {
          solSendAmount = await resolveSolAmountForBridge(usdcEquivalentAmount);
        } else {
          const solQuote = await pajcash.getTokenQuote(fiatOrderAmount, SOL_MINT, Currency.NGN);
          if (!solQuote.status) {
            throw new Error(solQuote.message || "Could not price SOL for this order.");
          }
          solSendAmount = Number(solQuote.data.amount);
          if (!Number.isFinite(solSendAmount) || solSendAmount <= 0) {
            throw new Error("Could not compute SOL amount for this order.");
          }
        }

        bridgeRoute = {
          deposit_address: dexAddr.deposit_address,
          settlement_chain_id: selectedChainId,
          settlement_chain_name: selectedChainName,
          settlement_asset: selectedToken.address,
          settlement_symbol: selectedToken.symbol,
          settlement_address: destAddress.trim(),
          recipient_receive_amount: recipientReceiveAmount,
          usdc_equivalent_amount: usdcEquivalentAmount,
          sol_send_amount: solSendAmount,
        };
        setDextopusAddress(dexAddr.deposit_address);
        setActiveBridgeRoute(bridgeRoute);
        pajcashMint = SOL_MINT;
        pajcashTokenAmount = solSendAmount;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not prepare the bridge to the recipient network.";
        setLastError(message);
        setStatusMessage("");
        setToast(message, "error");
        return;
      }
    }

    const pajcashRecipient = bridgeRoute?.deposit_address ?? publicKey.toBase58();

    setStatusMessage("Creating PajCash onramp order...");
    logOnramp("Creating order", {
      fiatAmount: orderByTokenAmount ? undefined : fiatOrderAmount,
      tokenAmount: orderByTokenAmount ? pajcashTokenAmount : undefined,
      recipientReceiveAmount:
        orderByTokenAmount && !isSolanaChain ? desiredTokenAmount : undefined,
      solSendAmount: bridgeRoute?.sol_send_amount,
      currency: Currency.NGN,
      recipient: pajcashRecipient,
      mint: pajcashMint,
      chain: Chain.SOLANA,
      bridged: Boolean(bridgeRoute),
    });
    setLoading("order");
    const res = await pajcash.createOnramp({
      ...(orderByTokenAmount
        ? { amount: pajcashTokenAmount }
        : { fiatAmount: fiatOrderAmount }),
      currency: Currency.NGN,
      recipient: pajcashRecipient,
      mint: pajcashMint,
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

    if (orderByTokenAmount) {
      setFiatAmount(formatQuoteAmount(res.data.fiatAmount));
      setQuote((prev: Record<string, unknown> | null) => ({
        ...(prev ?? {}),
        amount: res.data.amount,
        fiatAmount: res.data.fiatAmount,
        fee: res.data.fee,
        rate: res.data.rate,
        mint: res.data.mint,
      }));
    }

    recordPajCashOnrampOrder(res.data, "pending", undefined, bridgeRoute);
    setOrder(res.data);
    setOrderSheetOpen(true);
    setPaymentCheckState("idle");
    setPaymentCheckMessage("");
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

    if (!bridgeRoute) {
      setDextopusAddress(null);
      setActiveBridgeRoute(null);
    }
  };

  const handlePaid = async () => {
    if (!order?.id || paymentCheckState === "checking") return;
    const runId = paymentPollRunRef.current + 1;
    paymentPollRunRef.current = runId;
    setPaymentCheckState("checking");
    setPaymentCheckMessage("Checking PajCash payment status...");
    setToast("Checking payment", "info");

    let walletSnapshot = snapshotUserWallet(UserItem.getState().userWallet);
    const maxAttempts = 36;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (paymentPollRunRef.current !== runId) return;

      const statusRes = await pajcash.getOrderStatus(String(order.id));
      if (paymentPollRunRef.current !== runId) return;

      if (statusRes.status) {
        logOnramp("Order status polled", {
          orderId: order.id,
          attempt,
          data: statusRes.data as unknown as Record<string, unknown>,
        });
        if (isOrderConfirmed(statusRes.data)) {
          recordPajCashOnrampOrder(order, "confirmed", statusRes.data, activeBridgeRoute);
          setPaymentCheckState("confirmed");
          const successMessage = activeBridgeRoute
            ? "Payment confirmed. Your funds are being delivered to the recipient network."
            : "Payment confirmed. Your tokens should arrive shortly.";
          setPaymentCheckMessage(successMessage);
          setStatusMessage(successMessage);
          setToast("Payment confirmed", "success");
          return;
        }
        if (isOrderFailed(statusRes.data)) {
          setPaymentCheckState("failed");
          setPaymentCheckMessage("PajCash could not confirm this payment. Please check the order details.");
          setToast("Payment not confirmed", "error");
          return;
        }
      } else {
        logOnrampError("Order status poll failed", {
          orderId: order.id,
          attempt,
          message: statusRes.message,
        });
      }

      if (user && publicKey && !activeBridgeRoute) {
        const refreshed = await refreshUserWalletBalances({ force: true });
        if (paymentPollRunRef.current !== runId) return;
        if (refreshed) {
          const nextWallet = snapshotUserWallet(UserItem.getState().userWallet);
          const incoming = collectWalletIncomingChanges(walletSnapshot, nextWallet);
          if (incoming.length > 0) {
            recordPajCashOnrampOrder(order, "confirmed");
            setPaymentCheckState("confirmed");
            setPaymentCheckMessage("Wallet activity detected. Your onramp is good to go.");
            setStatusMessage("Wallet activity detected. Your onramp is good to go.");
            setToast("Wallet activity detected", "success");
            return;
          }
          walletSnapshot = nextWallet;
        }
      }

      setPaymentCheckMessage(
        `Still checking payment... attempt ${attempt}/${maxAttempts}`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (paymentPollRunRef.current !== runId) return;
    setPaymentCheckState("failed");
    setPaymentCheckMessage("Still waiting for confirmation. You can keep this order and check again.");
  };

  const closeOrderSheet = () => {
    paymentPollRunRef.current += 1;
    setOrderSheetOpen(false);
  };

  const handlePaymentSheetAction = () => {
    if (paymentCheckState === "confirmed") {
      closeOrderSheet();
      return;
    }
    void handlePaid();
  };

  const copyPaymentDetail = async (label: string, value: string) => {
    const copied = await copyItem(value);
    setToast(copied ? `${label} copied` : "Copy failed", copied ? "success" : "error");
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
              value={formatAmountWithCommas(fiatAmount)}
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
        {isSolanaChain
          ? "YOU RECEIVE"
          : `RECIPIENT RECEIVES (${selectedToken?.symbol ?? tokenLabel} on ${selectedChainName})`}
      </CText>
      <View className="flex-row items-start justify-between gap-x-3">
        <View className="flex-1 min-w-0">
          {loading === "quote" && quoteMode === "fiat" ? (
            <ActivityIndicator color="#971BB2" style={{ marginVertical: 12 }} />
          ) : (
            <TextInput
              className="text-[36px] text-black dark:text-white p-0"
              style={{ fontFamily: "bold", lineHeight: 42 }}
              value={formatAmountWithCommas(tokenAmount)}
              onChangeText={handleTokenAmountChange}
              placeholder="0"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
            />
          )}
          <CText className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
            {isSolanaChain
              ? `Expected: ${formattedExpectedTokenAmount || "0"} ${tokenLabel || "token"}`
              : `About ${formattedExpectedTokenAmount || "0"} ${selectedToken?.symbol ?? tokenLabel} after delivery`}
          </CText>
          {bridgedSolPreview ? (
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Routes {formatAmountWithCommas(bridgedSolPreview)} SOL via Dextopus (0.5% fee included)
            </CText>
          ) : bridgedUsdcEquivalent ? (
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Pricing SOL route…
            </CText>
          ) : null}
          {expectedFiatAmount ? (
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Pay about {formattedExpectedFiatAmount} NGN
              {quoteMode === "token" ? " (fee included)" : ""}
            </CText>
          ) : null}
          {platformUsdcFee > 0 ? (
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              Platform fee: {formatAmountWithCommas(platformUsdcFee)} USDC
            </CText>
          ) : null}
          {quoteError ? (
            <CText className="text-[12px] text-red-400 mt-1">{quoteError}</CText>
          ) : null}
        </View>
        <TokenPill />
      </View>
      <View className="mt-3">
        {isSolanaChain ? (
          <>
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
          </>
        ) : (
          <CText className="text-[0.8rem] text-black/50 dark:text-grey/60">
            {selectedToken
              ? `${selectedToken.symbol} on ${selectedChainName} will be sent to your recipient address after bridging.`
              : "Select a token using the pill above."}
          </CText>
        )}
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
          Onramp
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

          <Pressable
            onPress={() => setChainPickerOpen(true)}
            className="w-full flex-row items-center justify-between bg-white dark:bg-accent rounded-2xl px-4 py-4"
          >
            <View>
              <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                NETWORK
              </CText>
              <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                {selectedChainName}
              </CText>
            </View>
            <AntDesign name="down" size={12} color="#6B7280" />
          </Pressable>

          {!isSolanaChain && (
            <View className="bg-white dark:bg-accent rounded-2xl px-4 py-4">
              <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                RECIPIENT WALLET
              </CText>
              <TextInput
                className="h-[44px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 px-3"
                value={destAddress}
                placeholder={`Enter ${selectedChainName} wallet address`}
                placeholderTextColor="grey"
                onChangeText={setDestAddress}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <CText className="text-[0.75rem] text-gray-400 dark:text-gray-500 mt-1">
                {tokenLabel} will be sent to this address on {selectedChainName}.
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
                  text="Onramp"
                  loading={loading === "order"}
                  onPress={createOrder}
                />
              </View>

            </>
          )}
          <View className="w-full items-center pt-2 pb-4">
            <CText className="text-[0.85rem] text-black/50 dark:text-grey/60">
              Powered by PajCash
            </CText>
          </View>
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
                {isSolanaChain ? "Select SPL token" : `Select token on ${selectedChainName}`}
              </CText>
              <CText className="text-[12px] text-center text-gray-500 dark:text-gray-400">
                {isSolanaChain
                  ? "Jupiter token list · search any symbol or mint"
                  : `Tokens available for deposit on ${selectedChainName}`}
              </CText>
              <SearchInput onSearch={setTokenSearch} value={tokenSearch} />
              {tokenSearchLoading || dexTokenSearchLoading ? (
                <ActivityIndicator color="#971BB2" className="py-6" />
              ) : tokenHits.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  {tokenSearch.trim()
                    ? "No tokens found. Try a symbol or mint address."
                    : isSolanaChain
                      ? "Could not load tokens. Check EXPO_PUBLIC_JUP_API_KEY."
                      : dexTokenSearchLoading
                        ? "Loading tokens..."
                        : `No tokens available on ${selectedChainName}.`}
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
      {chainPickerOpen ? (
        <DragableSheet
          close={() => { setChainPickerOpen(false); setChainSearch(""); }}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select network
              </CText>
              <SearchInput onSearch={setChainSearch} value={chainSearch} />
              <FlatList
                data={[
                  { chainId: DEXTOPUS_SOLANA_CHAIN_ID, name: "Solana" },
                  ...filteredChains.filter((c) => c.chainId !== DEXTOPUS_SOLANA_CHAIN_ID),
                ]}
                keyExtractor={(item) => String(item.chainId)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = selectedChainId === item.chainId;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedChainId(item.chainId);
                        setSelectedToken(null);
                        setToken("");
                        setTokenHits([]);
                        setQuote(null);
                        setQuoteError("");
                        setDestAddress("");
                        setDextopusAddress(null);
                        setActiveBridgeRoute(null);
                        setChainPickerOpen(false);
                        setChainSearch("");
                      }}
                      className="py-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <CText style={{ fontFamily: selected ? "bold" : "regular" }}>
                        {item.name}
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
      {order && orderSheetOpen ? (
        <DragableSheet
          close={closeOrderSheet}
          panClose
          snapPoints={["52%", "90%"]}
          child={
            <View className="w-full flex-1 gap-y-4 pb-6">
              <View className="gap-y-1">
                <CText style={{ fontFamily: "bold" }} className="text-[1.35rem] text-center">
                  Pay bank transfer
                </CText>
                <CText className="text-[0.9rem] text-center text-black/60 dark:text-grey/70">
                  Transfer exactly this amount to complete your onramp order.
                </CText>
              </View>

              <View className="w-full p-4 rounded-2xl bg-grey/50 dark:bg-black/30 gap-y-3">
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Bank</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {order.bank}
                  </CText>
                </View>
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Account name</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {order.accountName}
                  </CText>
                </View>
                <View className="flex-row justify-between items-center gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Account number</CText>
                  <View className="flex-row items-center justify-end gap-x-2 flex-1">
                    <CText style={{ fontFamily: "bold" }} className="text-right">
                      {order.accountNumber}
                    </CText>
                    <Pressable
                      onPress={() =>
                        void copyPaymentDetail("Account number", String(order.accountNumber))
                      }
                      className="px-2 py-1 rounded-full bg-white dark:bg-accent2"
                    >
                      <MaterialCommunityIcons
                        name="content-copy"
                        size={16}
                        color="#971BB2"
                      />
                    </Pressable>
                  </View>
                </View>
                <View className="flex-row justify-between items-center gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Amount</CText>
                  <View className="flex-row items-center justify-end gap-x-2 flex-1">
                    <CText style={{ fontFamily: "bold" }} className="text-right">
                      {formatAmountWithCommas(order.fiatAmount)} NGN
                    </CText>
                    <Pressable
                      onPress={() =>
                        void copyPaymentDetail("Amount", String(order.fiatAmount))
                      }
                      className="px-2 py-1 rounded-full bg-white dark:bg-accent2"
                    >
                      <MaterialCommunityIcons
                        name="content-copy"
                        size={16}
                        color="#971BB2"
                      />
                    </Pressable>
                  </View>
                </View>
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Token amount</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {formatAmountWithCommas(
                      activeBridgeRoute?.recipient_receive_amount ?? order.amount
                    )}{" "}
                    {activeBridgeRoute
                      ? activeBridgeRoute.settlement_symbol
                      : tokenLabel}
                  </CText>
                </View>
                {activeBridgeRoute ? (
                  <View className="flex-row justify-between gap-x-3">
                    <CText className="text-black/60 dark:text-grey/70">SOL routed</CText>
                    <CText className="flex-1 text-right text-black/70 dark:text-grey/80">
                      {formatAmountWithCommas(activeBridgeRoute.sol_send_amount)} SOL
                    </CText>
                  </View>
                ) : null}
                {asFiniteNumber(order.fee) ? (
                  <View className="flex-row justify-between gap-x-3">
                    <CText className="text-black/60 dark:text-grey/70">PajCash fee</CText>
                    <CText className="flex-1 text-right text-black/70 dark:text-grey/80">
                      {formatAmountWithCommas(order.fee)} USDC
                    </CText>
                  </View>
                ) : null}
                <View className="gap-y-1">
                  <CText className="text-black/60 dark:text-grey/70">Order ID</CText>
                  <CText
                    selectable
                    style={{ fontFamily: "bold" }}
                    className="text-[0.9rem]"
                  >
                    {order.id}
                  </CText>
                </View>
              </View>

              {dextopusAddress ? (
                <View className="w-full p-4 rounded-2xl bg-purple/5 border border-purple/20 gap-y-2">
                  <CText style={{ fontFamily: "bold" }} className="text-purple">
                    Delivery to {selectedChainName}
                  </CText>
                  <CText className="text-[0.85rem] text-black/60 dark:text-grey/70">
                    PajCash will deliver SOL to the delivery route. Dextopus will settle{" "}
                    {tokenLabel} at the recipient address on {selectedChainName}.
                  </CText>
                  <CText className="text-[0.75rem] text-black/40 dark:text-grey/50">
                    Recipient: {destAddress.trim()}
                  </CText>
                </View>
              ) : null}

              {paymentCheckMessage ? (
                <View
                  className={`w-full p-3 rounded-2xl ${paymentCheckState === "confirmed"
                      ? "bg-green-100 dark:bg-green-950/30"
                      : paymentCheckState === "failed"
                        ? "bg-orange-100 dark:bg-orange-950/30"
                        : "bg-grey/50 dark:bg-black/30"
                    }`}
                >
                  <View className="flex-row items-center gap-x-2">
                    {paymentCheckState === "checking" ? (
                      <ActivityIndicator color="#971BB2" />
                    ) : (
                      <MaterialCommunityIcons
                        name={
                          paymentCheckState === "confirmed"
                            ? "check-circle-outline"
                            : "information-outline"
                        }
                        size={18}
                        color={paymentCheckState === "confirmed" ? "#16A34A" : "#971BB2"}
                      />
                    )}
                    <CText className="flex-1 text-[0.9rem] text-black/70 dark:text-grey/80">
                      {paymentCheckMessage}
                    </CText>
                  </View>
                </View>
              ) : null}

              <Buttons
                type="primary"
                className="w-full py-4 px-4 rounded-3xl"
                text={
                  paymentCheckState === "checking"
                    ? "Checking payment..."
                    : paymentCheckState === "confirmed"
                      ? "Done"
                      : paymentCheckState === "failed"
                        ? "Check again"
                        : "I have paid"
                }
                loading={paymentCheckState === "checking"}
                onPress={handlePaymentSheetAction}
              />
            </View>
          }
        />
      ) : null}
    </View>
  );
}
