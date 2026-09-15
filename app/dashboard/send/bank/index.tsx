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
import { router, useLocalSearchParams } from "expo-router";
import { Connection, PublicKey } from "@solana/web3.js";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";

import Buttons from "@/components/ButtonComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import SearchInput from "@/components/SearchInput/SearchInput";
import { ButtonInlineLoader } from "@/components/skeletons";
import { CText } from "@/components/TextComp";
import {
  deletePajCashBeneficiary,
  savePajCashBeneficiary,
} from "@/services/pajcashBeneficiariesApi";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import PajCashBeneficiaries, {
  type PajCashBeneficiary,
} from "@/utils/store/pajcashBeneficiaries.store";
import PajCashSession from "@/utils/store/pajcashSession.store";
import TxQueue from "@/utils/store/txqueue.store";
import UserItem from "@/utils/store/userstore.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import { Chain, Currency, pajcash, PAJCASH_REVALIDATE_MESSAGE } from "@/libs/tools/pajcash/pajcash";
import { getPajCashFeeConfig } from "@/services/pajcashFeeConfig";
import { getHeliusApiKeySync } from "@/services/rpcConfig";
import WalletItem from "@/utils/store/wallet.store";
import {
  SOL_MINT,
  formatSolAmount,
  formatSolFee,
  getMaxSendableSol,
  solTransferFitsBalance,
} from "@/utils/wallet/solTransferFees";

type Bank = {
  id: string;
  code?: string;
  name: string;
  image?: string;
  logo?: string;
  icon?: string;
  logoUrl?: string;
  logo_url?: string;
  bankLogo?: string;
  bank_logo?: string;
};

function getBankLogo(bank: Bank): string | undefined {
  return (
    bank.logo ||
    bank.image ||
    bank.icon ||
    bank.logoUrl ||
    bank.logo_url ||
    bank.bankLogo ||
    bank.bank_logo
  );
}

function normalizePhoneForPaj(phone?: string | null): string {
  const compact = String(phone || "").replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("234")) return `+${compact}`;
  if (/^0[789][01]\d{8}$/.test(compact)) return `+234${compact.slice(1)}`;
  return compact;
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function formatDisplayAmount(value: unknown): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatRawAmount(value: unknown): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return numeric.toFixed(3).replace(/\.?0+$/, "");
}

function formatEditableAmount(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/,/g, "");
  const [integerPart, decimalPart] = normalized.split(".");
  const integer = integerPart
    ? Number(integerPart).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "0";

  if (normalized.endsWith(".")) return `${integer}.`;
  if (decimalPart != null) return `${integer}.${decimalPart.slice(0, 3)}`;
  return integer;
}

function normalizeMintParam(
  raw: string | string[] | undefined
): string | undefined {
  if (typeof raw === "string") return raw;
  return raw?.[0];
}

export default function SendToBank() {
  const params = useLocalSearchParams<{
    mint?: string | string[];
    symbol?: string | string[];
    name?: string | string[];
    balance?: string | string[];
    decimals?: string | string[];
    image?: string | string[];
  }>();
  const selectedMint = normalizeMintParam(params.mint);
  const routeToken = useMemo(() => {
    if (!selectedMint) return null;
    const symbol = normalizeMintParam(params.symbol) || "Token";
    const decimals = Number(normalizeMintParam(params.decimals) ?? 0);
    const balance = Number(normalizeMintParam(params.balance) ?? 0);
    const image = normalizeMintParam(params.image);
    return {
      mint: selectedMint,
      symbol,
      name: normalizeMintParam(params.name) || symbol,
      balance: Number.isFinite(balance) ? balance : 0,
      decimals: Number.isFinite(decimals) ? decimals : 0,
      image,
    };
  }, [params.balance, params.decimals, params.image, params.name, params.symbol, selectedMint]);
  const { user, userWallet } = UserItem();
  const { publicKey } = WalletItem();
  const { setToast } = AppSettings();
  const pajSession = PajCashSession();
  const { beneficiaries, upsertBeneficiary, removeBeneficiary } =
    PajCashBeneficiaries();
  const lastResolvedAccountRef = useRef<string | null>(null);

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

  const tokens = useMemo(
    () =>
      (userWallet?.tokenAccounts ?? []).filter((token: any) => token?.mint),
    [userWallet?.tokenAccounts]
  );

  const [emailOrPhone, setEmailOrPhone] = useState(defaultRecipient);
  const [otp, setOtp] = useState("");
  const [selectedToken, setSelectedToken] = useState<any>(routeToken);
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [tokenSearch, setTokenSearch] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [beneficiaryPickerOpen, setBeneficiaryPickerOpen] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [fiatAmount, setFiatAmount] = useState("");
  const [quoteMode, setQuoteMode] = useState<"token" | "fiat">("token");
  const [order, setOrder] = useState<any>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lastError, setLastError] = useState("");
  const [loading, setLoading] = useState<
    "otp" | "verify" | "banks" | "resolve" | "quote" | "order" | null
  >(null);
  const [quote, setQuote] = useState<any>(null);
  const [platformUsdcFee, setPlatformUsdcFee] = useState(0);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [solMaxSendable, setSolMaxSendable] = useState<number | null>(null);
  const [solFeeLamports, setSolFeeLamports] = useState<number | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);

  const isSolToken = selectedToken?.mint === SOL_MINT;
  const spendableTokenBalance =
    isSolToken && solMaxSendable != null
      ? solMaxSendable
      : Number(selectedToken?.balance ?? 0);

  const isPajCashVerified = pajSession.isSessionValid();
  const isFiatMode = quoteMode === "fiat";
  const tokenAmount = parseAmount(amount);
  const ngnAmount = parseAmount(fiatAmount);
  const activeQuoteAmount = isFiatMode ? ngnAmount : tokenAmount;
  const orderAmount = Number(order?.amount ?? tokenAmount);
  const quotedTokenAmount = formatDisplayAmount(quote?.amount) || formatDisplayAmount(amount);
  const quotedNairaAmount = formatDisplayAmount(quote?.fiatAmount) || formatDisplayAmount(fiatAmount);

  const filteredTokens = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter((token: any) => {
      const name = (token?.name ?? "").toLowerCase();
      const symbol = (token?.symbol ?? "").toLowerCase();
      const mint = (token?.mint ?? "").toLowerCase();
      return name.includes(q) || symbol.includes(q) || mint.includes(q);
    });
  }, [tokenSearch, tokens]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((bank) => {
      const name = (bank.name ?? "").toLowerCase();
      const code = (bank.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [bankSearch, banks]);

  useEffect(() => {
    if (selectedMint) {
      const tokenFromRoute = tokens.find((token: any) => token.mint === selectedMint);
      if (tokenFromRoute && selectedToken?.mint !== tokenFromRoute.mint) {
        setSelectedToken(tokenFromRoute);
      } else if (!tokenFromRoute && routeToken && selectedToken?.mint !== routeToken.mint) {
        setSelectedToken(routeToken);
      }
      return;
    }

    if (!selectedToken && tokens.length > 0) {
      setSelectedToken(tokens[0]);
    }
  }, [routeToken, selectedMint, selectedToken, tokens]);

  useEffect(() => {
    const network = AppSettings.getState().network;
    setConnection(new Connection(`${network}${getHeliusApiKeySync()}`));
  }, []);

  useEffect(() => {
    void getPajCashFeeConfig().then((config) => {
      setPlatformUsdcFee(config.offrampUsdcFee);
    });
  }, []);

  useEffect(() => {
    if (!connection || !publicKey || !isSolToken) {
      setSolMaxSendable(null);
      setSolFeeLamports(null);
      return;
    }

    void (async () => {
      try {
        const { maxSol, feeLamports } = await getMaxSendableSol(
          connection,
          publicKey,
          publicKey
        );
        setSolMaxSendable(maxSol);
        setSolFeeLamports(feeLamports);
      } catch (error) {
        console.error("Failed to estimate SOL offramp limits:", error);
        setSolMaxSendable(Number(selectedToken?.balance ?? 0));
        setSolFeeLamports(null);
      }
    })();
  }, [connection, publicKey, isSolToken, selectedToken?.balance]);

  useEffect(() => {
    if (!isPajCashVerified || banks.length > 0 || loading === "banks") return;
    void loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPajCashVerified, banks.length, loading]);

  useEffect(() => {
    if (!isPajCashVerified || !selectedToken || !activeQuoteAmount || activeQuoteAmount <= 0) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading((current) => current ?? "quote");
      const res =
        quoteMode === "fiat"
          ? await pajcash.getTokenQuote(activeQuoteAmount, selectedToken.mint, Currency.NGN)
          : await pajcash.getFiatQuote(activeQuoteAmount, selectedToken.mint, Currency.NGN);
      setLoading((current) => (current === "quote" ? null : current));
      if (res.status) {
        setQuote(res.data);
        if (quoteMode === "fiat") {
          setAmount(formatRawAmount(res.data.amount));
        } else {
          setFiatAmount(formatRawAmount(res.data.fiatAmount));
        }
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [activeQuoteAmount, isPajCashVerified, selectedToken, quoteMode]);

  const saveRecipient = (value: string) => {
    ToolsItem.getState().updateToolParameter("Pajcash", "credentials", {
      type: "email_or_phone",
      value,
    });
  };

  const sendOtp = async () => {
    const recipient = emailOrPhone.trim();
    if (!recipient) {
      setLastError("Enter your PajCash email or phone");
      setToast("Enter your PajCash email or phone", "error");
      return;
    }
    setLastError("");
    setStatusMessage("Sending PajCash OTP...");
    setLoading("otp");
    const res = await pajcash.initiateSession(recipient);
    setLoading(null);
    if (!res.status) {
      setLastError(res.message);
      setStatusMessage("");
      setToast(res.message, "error");
      return;
    }
    saveRecipient(recipient);
    setStatusMessage("OTP sent. Check your phone or email.");
    setToast("PajCash OTP sent", "success");
  };

  const verifyOtp = async () => {
    const recipient = emailOrPhone.trim();
    if (!recipient || !otp.trim()) {
      setLastError("Enter your email/phone and OTP");
      setToast("Enter your email/phone and OTP", "error");
      return;
    }
    setLastError("");
    setStatusMessage("Verifying PajCash OTP...");
    setLoading("verify");
    const res = await pajcash.verifySession(recipient, otp);
    setLoading(null);
    if (!res.status) {
      setLastError(res.message);
      setStatusMessage("");
      setToast(res.message, "error");
      return;
    }
    saveRecipient(recipient);
    setOtp("");
    setStatusMessage("PajCash verified. Add the bank account to continue.");
    setToast("PajCash verified", "success");
  };

  const loadBanks = async () => {
    if (!pajcash.getSessionToken()) return;
    setLoading("banks");
    const res = await pajcash.listBanks();
    setLoading(null);
    if (!res.status) {
      setLastError(res.message);
      setToast(res.message, "error");
      return;
    }
    setBanks(res.data as Bank[]);
  };

  const resolveAccount = async (options: { quiet?: boolean } = {}) => {
    const normalizedAccount = accountNumber.trim();
    if (!selectedBank || normalizedAccount.length !== 10) {
      if (!options.quiet) {
        setLastError("Select a bank and enter a 10-digit account number");
        setToast("Select a bank and enter a 10-digit account number", "error");
      }
      return false;
    }
    if (!options.quiet) {
      setLastError("");
      setStatusMessage("Resolving bank account...");
    }
    setLoading("resolve");
    const res = await pajcash.resolveBank(selectedBank.id, normalizedAccount);
    setLoading(null);
    if (!res.status) {
      setAccountName("");
      setLastError(res.message);
      if (!options.quiet) {
        setStatusMessage("");
        setToast(res.message, "error");
      }
      return false;
    }

    const data = res.data as unknown as Record<string, unknown>;
    const resolvedName =
      String(data.accountName ?? data.account_name ?? data.name ?? "").trim();
    const nextAccountName = resolvedName || "Account resolved";
    setAccountName(nextAccountName);
    const beneficiary = {
      bankId: selectedBank.id,
      bankName: selectedBank.name,
      bankCode: selectedBank.code,
      accountNumber: normalizedAccount,
      accountName: nextAccountName,
    };
    upsertBeneficiary(beneficiary);
    savePajCashBeneficiary(beneficiary)
      .then(upsertBeneficiary)
      .catch((err) => {
        console.warn("[PajCash Beneficiaries] save failed", err);
      });
    setLastError("");
    if (!options.quiet) {
      setStatusMessage("Bank account resolved.");
      setToast("Bank account resolved", "success");
    }
    return true;
  };

  useEffect(() => {
    const normalizedAccount = accountNumber.trim();
    if (!selectedBank || normalizedAccount.length !== 10 || accountName) return;
    const resolveKey = `${selectedBank.id}:${normalizedAccount}`;
    if (lastResolvedAccountRef.current === resolveKey || loading === "resolve") {
      return;
    }

    lastResolvedAccountRef.current = resolveKey;
    const timer = setTimeout(() => {
      void resolveAccount({ quiet: true });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountName, accountNumber, selectedBank?.id, loading]);

  const handleAmountChange = (value: string) => {
    const numeric = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
    const parts = numeric.split(".");
    if (parts.length > 2) return;
    const maxDecimals =
      selectedToken?.decimals != null ? Math.min(selectedToken.decimals, 3) : 3;
    if (parts.length === 2 && parts[1].length > maxDecimals) {
      return;
    }
    setQuoteMode("token");
    setAmount(numeric);
    setQuote(null);
  };

  const handleFiatAmountChange = (value: string) => {
    const numeric = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
    const parts = numeric.split(".");
    if (parts.length > 2) return;
    if (parts.length === 2 && parts[1].length > 3) return;
    setQuoteMode("fiat");
    setFiatAmount(numeric);
    setQuote(null);
  };

  const toggleAmountMode = (useNaira: boolean) => {
    setQuoteMode(useNaira ? "fiat" : "token");
    setQuote(null);
  };

  const createOrder = async () => {
    if (!isPajCashVerified) {
      setLastError(PAJCASH_REVALIDATE_MESSAGE);
      setToast(PAJCASH_REVALIDATE_MESSAGE, "error");
      return;
    }
    if (!selectedToken) {
      setLastError("Select a token to offramp");
      setToast("Select a token to offramp", "error");
      return;
    }
    if (
      quoteMode === "fiat" &&
      (!Number.isFinite(ngnAmount) || ngnAmount <= 0)
    ) {
      setLastError("Enter a valid NGN amount");
      setToast("Enter a valid NGN amount", "error");
      return;
    }
    if (
      quoteMode === "token" &&
      (!Number.isFinite(tokenAmount) || tokenAmount <= 0)
    ) {
      setLastError("Enter a valid token amount");
      setToast("Enter a valid token amount", "error");
      return;
    }
    const estimatedTokenAmount =
      quoteMode === "fiat" ? Number(quote?.amount ?? tokenAmount) : tokenAmount;
    if (
      quoteMode === "fiat" &&
      (!Number.isFinite(estimatedTokenAmount) || estimatedTokenAmount <= 0)
    ) {
      setLastError("Please wait for the token amount to calculate");
      setToast("Please wait for the token amount to calculate", "error");
      return;
    }
    if (
      Number.isFinite(estimatedTokenAmount) &&
      estimatedTokenAmount > 0 &&
      estimatedTokenAmount > spendableTokenBalance
    ) {
      setLastError(
        isSolToken
          ? `Insufficient SOL after network fees. Max sendable: ${formatSolAmount(spendableTokenBalance)} SOL`
          : `Insufficient ${selectedToken.symbol} balance`
      );
      setToast(
        isSolToken ? "Insufficient balance after network fees" : "Insufficient balance",
        "error"
      );
      return;
    }
    if (
      isSolToken &&
      connection &&
      publicKey &&
      Number.isFinite(estimatedTokenAmount) &&
      estimatedTokenAmount > 0
    ) {
      const fit = await solTransferFitsBalance(
        connection,
        publicKey,
        publicKey,
        estimatedTokenAmount
      );
      if (!fit.ok) {
        setSolMaxSendable(fit.maxSol);
        setSolFeeLamports(fit.feeLamports);
        setLastError(
          `Insufficient SOL after network fees. Max sendable: ${formatSolAmount(fit.maxSol)} SOL`
        );
        setToast("Insufficient balance after network fees", "error");
        return;
      }
      setSolFeeLamports(fit.feeLamports);
    }
    if (!selectedBank || accountNumber.trim().length < 10) {
      setLastError("Select a bank and enter an account number");
      setToast("Select a bank and enter an account number", "error");
      return;
    }
    if (!accountName) {
      const resolved = await resolveAccount();
      if (!resolved) return;
    }

    setLastError("");
    setStatusMessage("");
    setLoading("order");
    const orderPayload = {
      bank: selectedBank.id,
      accountNumber: accountNumber.trim(),
      currency: Currency.NGN,
      mint: selectedToken.mint,
      chain: Chain.SOLANA,
      ...(quoteMode === "fiat" ? { fiatAmount: ngnAmount } : { amount: tokenAmount }),
    };
    const res = await pajcash.createOfframp(orderPayload);
    setLoading(null);
    console.log("[PajCash Offramp] createOfframp response", {
      request: orderPayload,
      response: res,
    });

    if (!res.status) {
      setLastError(res.message);
      setStatusMessage("");
      setToast(res.message, "error");
      return;
    }

    const nextOrder = res.data as any;
    const requiredAmount = Number(nextOrder.amount ?? tokenAmount);
    if (requiredAmount > spendableTokenBalance) {
      setLastError(
        isSolToken
          ? `PajCash requires ${formatDisplayAmount(requiredAmount)} ${selectedToken.symbol}, but your sendable balance after fees is ${formatSolAmount(spendableTokenBalance)} SOL.`
          : `PajCash requires ${formatDisplayAmount(requiredAmount)} ${selectedToken.symbol}, but your balance is lower.`
      );
      setStatusMessage("");
      setToast(
        isSolToken ? "Insufficient balance after network fees" : "Insufficient balance",
        "error"
      );
      return;
    }

    setOrder(nextOrder);
    setOrderSheetOpen(true);
    setStatusMessage("Offramp order created. Review and send tokens to complete.");
    setToast("Offramp order created", "success");
  };

  const sendOrderTokens = async () => {
    if (!order || !selectedToken) return;
    const isSol = selectedToken.mint === SOL_MINT;

    if (isSol && connection && publicKey) {
      const fit = await solTransferFitsBalance(
        connection,
        publicKey,
        new PublicKey(String(order.address)),
        orderAmount
      );
      if (!fit.ok) {
        setToast("Insufficient balance after network fees", "error");
        setLastError(
          `Cannot send ${formatDisplayAmount(orderAmount)} SOL. Max sendable after fees: ${formatSolAmount(fit.maxSol)} SOL`
        );
        return;
      }
    }

    const id = TxQueue.getState().enqueue(
      isSol
        ? {
          kind: "sol",
          recipient: String(order.address),
          amount: orderAmount,
        }
        : {
          kind: "spl",
          recipient: String(order.address),
          mint: selectedToken.mint,
          amount: orderAmount,
          decimals: selectedToken.decimals,
          symbol: selectedToken.symbol,
        }
    );

    setOrderSheetOpen(false);
    router.push({
      pathname: "/dashboard/sendstatus",
      params: {
        id,
        amount: String(orderAmount),
        recipient: String(order.address),
        tokenName: selectedToken.symbol,
        displayName: `${selectedBank?.name ?? "Bank"} payout`,
        mint: selectedToken.mint,
        mode: "offramp",
        orderId: String(order.id),
        fiatAmount: String(order.fiatAmount ?? quote?.fiatAmount ?? ""),
        bank: selectedBank?.name ?? "",
        accountNumber,
      },
    });
  };

  const setMaxAmount = async () => {
    if (selectedToken?.balance == null) return;

    if (isSolToken) {
      setMaxLoading(true);
      try {
        if (!connection || !publicKey) {
          setToast("Unable to calculate max amount", "error");
          return;
        }
        const { maxSol, feeLamports } = await getMaxSendableSol(
          connection,
          publicKey,
          publicKey
        );
        if (maxSol <= 0) {
          setToast("Balance is too low to cover network fees", "error");
          return;
        }
        setSolMaxSendable(maxSol);
        setSolFeeLamports(feeLamports);
        setAmount(formatSolAmount(maxSol));
        setQuote(null);
      } catch (error) {
        console.error("Failed to set max SOL offramp amount:", error);
        setToast("Failed to calculate max amount", "error");
      } finally {
        setMaxLoading(false);
      }
      return;
    }

    setAmount(formatRawAmount(selectedToken.balance));
  };

  const selectToken = (token: any) => {
    setSelectedToken(token);
    setTokenPickerOpen(false);
    setTokenSearch("");
    setQuote(null);
  };

  const selectBank = (bank: Bank) => {
    setSelectedBank(bank);
    setBankPickerOpen(false);
    setBankSearch("");
    setAccountName("");
    lastResolvedAccountRef.current = null;
  };

  const selectBeneficiary = (beneficiary: PajCashBeneficiary) => {
    setSelectedBank({
      id: beneficiary.bankId,
      name: beneficiary.bankName,
      code: beneficiary.bankCode,
    });
    setAccountNumber(beneficiary.accountNumber);
    setAccountName(beneficiary.accountName);
    setBeneficiaryPickerOpen(false);
    lastResolvedAccountRef.current = `${beneficiary.bankId}:${beneficiary.accountNumber}`;
  };

  const deleteBeneficiary = (beneficiary: PajCashBeneficiary) => {
    removeBeneficiary(beneficiary.id);
    deletePajCashBeneficiary(beneficiary).catch((err) => {
      console.warn("[PajCash Beneficiaries] delete failed", err);
      upsertBeneficiary(beneficiary);
      setToast("Could not delete beneficiary. Please try again.", "error");
    });
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
          Send to bank
        </CText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="w-full gap-y-5">
          {loading === "order" ? (
            <View className="w-full p-3 rounded-2xl bg-purple/10 dark:bg-purple/15 flex-row items-center gap-x-3">
              <ButtonInlineLoader variant="secondary" />
              <CText className="text-[0.95rem]" textColor="text-purple">
                Creating order
              </CText>
            </View>
          ) : null}

          {!!statusMessage && (
            <View className="w-full p-3 rounded-2xl bg-green-100 dark:bg-green-950/30">
              <CText className="text-[0.95rem]" textColor="text-green-700 dark:text-green-300">
                {statusMessage}
              </CText>
            </View>
          )}

          {!!lastError && (
            <View className="w-full p-3 rounded-2xl bg-red-100 dark:bg-red-950/30">
              <CText className="text-[0.95rem]" textColor="text-red-700 dark:text-red-300">
                {lastError}
              </CText>
            </View>
          )}

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
            <View className="bg-white dark:bg-accent rounded-2xl px-4 pt-3 pb-4 gap-y-2">
              <View className="flex-row items-center justify-between mb-1">
                <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400">
                  AMOUNT
                </CText>
                <View className="flex-row rounded-full bg-grey dark:bg-accent2 p-0.5">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !isFiatMode }}
                    onPress={() => toggleAmountMode(false)}
                    className={`px-3 py-1 rounded-full ${!isFiatMode ? "bg-white dark:bg-accent" : ""}`}
                  >
                    <CText
                      style={{ fontFamily: !isFiatMode ? "bold" : "reg" }}
                      className={`text-[12px] ${!isFiatMode ? "text-purple" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      Token
                    </CText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isFiatMode }}
                    onPress={() => toggleAmountMode(true)}
                    className={`px-3 py-1 rounded-full ${isFiatMode ? "bg-white dark:bg-accent" : ""}`}
                  >
                    <CText
                      style={{ fontFamily: isFiatMode ? "bold" : "reg" }}
                      className={`text-[12px] ${isFiatMode ? "text-purple" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      Naira
                    </CText>
                  </Pressable>
                </View>
              </View>
              <View className="flex-row items-start justify-between gap-x-3">
                <View className="flex-1 min-w-0">
                  <TextInput
                    className="text-[36px] text-black dark:text-white p-0"
                    style={{ fontFamily: "bold", lineHeight: 42 }}
                    value={formatEditableAmount(isFiatMode ? fiatAmount : amount)}
                    onChangeText={isFiatMode ? handleFiatAmountChange : handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="decimal-pad"
                  />
                  {!isFiatMode ? (
                    <CText className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
                      Balance: {formatDisplayAmount(selectedToken?.balance) || "0"} {selectedToken?.symbol ?? ""}
                      {isSolToken && solMaxSendable != null ? (
                        ` · Max ${formatSolAmount(solMaxSendable)}`
                      ) : ""}
                      {isSolToken && solFeeLamports != null ? (
                        ` (fee ~${formatSolFee(solFeeLamports)} SOL)`
                      ) : ""}
                    </CText>
                  ) : null}
                  {loading === "quote" ? (
                    <ActivityIndicator color="#971BB2" size="small" style={{ marginTop: 6 }} />
                  ) : null}
                  {quote ? (
                    <CText
                      style={{ fontFamily: isFiatMode ? "bold" : "reg" }}
                      className={`text-[12px] mt-1 ${isFiatMode ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      {isFiatMode
                        ? `${quotedTokenAmount || "0"} ${selectedToken?.symbol ?? ""}`
                        : `${quotedNairaAmount || "0"} NGN`}
                    </CText>
                  ) : null}
                </View>
                <View className="items-end gap-y-2">
                  {isFiatMode ? (
                    <View className="bg-grey dark:bg-accent2 rounded-full px-3 py-2">
                      <CText style={{ fontFamily: "bold" }} className="text-[15px]">
                        NGN
                      </CText>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => setTokenPickerOpen(true)}
                        className="flex-row items-center gap-x-2 bg-grey dark:bg-accent2 rounded-full pl-2 pr-3 py-2"
                      >
                        {selectedToken?.image ? (
                          <View className="h-7 w-7 rounded-full overflow-hidden">
                            <Image
                              source={selectedToken.image}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          </View>
                        ) : null}
                        <CText style={{ fontFamily: "bold" }} className="text-[15px]">
                          {selectedToken?.symbol ?? "Token"}
                        </CText>
                        <AntDesign name="down" size={12} color="#6B7280" />
                      </Pressable>
                      <TouchableOpacity
                        onPress={() => void setMaxAmount()}
                        disabled={maxLoading}
                        className="bg-[#971BB2] px-3 py-1.5 rounded-lg"
                      >
                        <CText className="text-white text-[12px]" style={{ fontFamily: "bold" }}>
                          {maxLoading ? "..." : "MAX"}
                        </CText>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
              {quote?.fee ? (
                <View className="flex-row justify-between">
                  <CText className="text-black/60 dark:text-grey/70">Fee</CText>
                  <CText>{formatDisplayAmount(quote.fee) || String(quote.fee)}</CText>
                </View>
              ) : null}
              {platformUsdcFee > 0 ? (
                <View className="flex-row justify-between">
                  <CText className="text-black/60 dark:text-grey/70">Platform fee</CText>
                  <CText>{formatDisplayAmount(platformUsdcFee)} USDC</CText>
                </View>
              ) : null}
            </View>

            <View className="bg-white dark:bg-accent rounded-2xl px-4 py-4 gap-y-3">
              <CText className="text-[11px] tracking-widest text-gray-500 dark:text-gray-400">
                BANK ACCOUNT
              </CText>
              <Pressable
                onPress={() => setBankPickerOpen(true)}
                className="w-full h-[48px] rounded-xl border border-grey dark:border-accent2 px-3 flex-row items-center justify-between"
              >
                <CText className="text-[15px]">
                  {selectedBank?.name ?? "Select bank"}
                </CText>
                {loading === "banks" ? (
                  <ActivityIndicator color="#971BB2" />
                ) : (
                  <AntDesign name="down" size={14} color="#6B7280" />
                )}
              </Pressable>
              <TextInput
                className="w-full h-[48px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-3"
                value={accountNumber}
                placeholder="Account number"
                placeholderTextColor="grey"
                onChangeText={(value) => {
                  setAccountNumber(value.replace(/[^0-9]/g, "").slice(0, 10));
                  setAccountName("");
                  lastResolvedAccountRef.current = null;
                }}
                keyboardType="number-pad"
              />
              {accountName ? (
                <View className="flex-row items-center gap-x-2">
                  <MaterialCommunityIcons name="check-circle" size={18} color="#22C55E" />
                  <CText className="text-green-600 dark:text-green-400">
                    {accountName}
                  </CText>
                </View>
              ) : loading === "resolve" ? (
                <View className="flex-row items-center gap-x-2">
                  <ActivityIndicator color="#971BB2" />
                  <CText className="text-gray-500 dark:text-gray-400">
                    Resolving account...
                  </CText>
                </View>
              ) :
                null}
            </View>

            <Buttons
              type="primary"
              className="w-full py-4 px-4 rounded-3xl"
              text="Send"
              loading={loading === "order"}
              onPress={createOrder}
            />

            {beneficiaries.length > 0 ? (
              <View className="bg-white dark:bg-accent rounded-2xl overflow-hidden">
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-grey dark:border-accent2">
                  <View className="flex-row items-center gap-x-6">
                    <CText style={{ fontFamily: "bold" }} textColor="text-purple">
                      Recents
                    </CText>
                    <CText className="text-gray-500 dark:text-gray-400">
                      Favourites
                    </CText>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="View all beneficiaries"
                    onPress={() => setBeneficiaryPickerOpen(true)}
                    className="p-1"
                  >
                    <AntDesign name="search" size={18} color="#971BB2" />
                  </TouchableOpacity>
                </View>

                {beneficiaries.slice(0, 3).map((beneficiary, index) => (
                  <TouchableOpacity
                    key={beneficiary.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Send to ${beneficiary.accountName}`}
                    onPress={() => selectBeneficiary(beneficiary)}
                    className="px-4 py-4 flex-row items-center justify-between gap-x-3"
                  >
                    <View className="flex-1 min-w-0">
                      <CText
                        style={{ fontFamily: "bold" }}
                        className="text-[0.95rem]"
                        numberOfLines={1}
                      >
                        {beneficiary.accountName}
                      </CText>
                      <CText
                        className="text-[0.85rem] text-gray-500 dark:text-gray-400 mt-1"
                        numberOfLines={1}
                      >
                        {beneficiary.accountNumber} {beneficiary.bankName}
                      </CText>
                    </View>
                    <View className="h-10 w-10 rounded-full bg-purple/10 items-center justify-center">
                      <MaterialCommunityIcons
                        name="bank-transfer-out"
                        size={22}
                        color="#971BB2"
                      />
                    </View>
                    {index < Math.min(beneficiaries.length, 3) - 1 ? (
                      <View className="absolute bottom-0 left-4 right-4 h-[1px] bg-grey dark:bg-accent2" />
                    ) : null}
                  </TouchableOpacity>
                ))}

                {beneficiaries.length > 3 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="View all beneficiaries"
                    onPress={() => setBeneficiaryPickerOpen(true)}
                    className="items-center py-3"
                  >
                    <View className="flex-row items-center gap-x-1 px-3 py-1 rounded-full bg-grey dark:bg-accent2">
                      <CText className="text-[0.8rem]">View All</CText>
                      <AntDesign name="right" size={10} color="#6B7280" />
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="w-full items-center pt-2 pb-4">
            <CText className="text-[0.85rem] text-black/50 dark:text-grey/60">
              Powered by PajCash
            </CText>
          </View>
        </View>
      </ScrollView>

      {tokenPickerOpen ? (
        <DragableSheet
          close={() => setTokenPickerOpen(false)}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select token
              </CText>
              <SearchInput onSearch={setTokenSearch} value={tokenSearch} />
              {filteredTokens.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  No tokens found.
                </CText>
              ) : (
                <FlatList
                  data={filteredTokens}
                  keyExtractor={(item: any) => item.mint}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }: { item: any }) => (
                    <Pressable
                      onPress={() => selectToken(item)}
                      className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
                    >
                      <View className="flex-row items-center gap-x-3 flex-1">
                        <View className="h-11 w-11 rounded-full overflow-hidden bg-grey/50 dark:bg-accent2">
                          <Image
                            source={item?.image ?? require("@/assets/images/icon.png")}
                            style={{ height: "100%", width: "100%" }}
                            contentFit="cover"
                          />
                        </View>
                        <View className="flex-1">
                          <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                            {item.symbol}
                          </CText>
                          <CText numberOfLines={1} className="text-[0.85rem] text-black/60 dark:text-grey/70">
                            {item.name}
                          </CText>
                        </View>
                      </View>
                      {selectedToken?.mint === item.mint ? (
                        <AntDesign name="check" size={20} color="#971BB2" />
                      ) : null}
                    </Pressable>
                  )}
                />
              )}
            </View>
          }
        />
      ) : null}

      {beneficiaryPickerOpen ? (
        <DragableSheet
          close={() => setBeneficiaryPickerOpen(false)}
          panClose
          snapPoints={["58%", "82%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select beneficiary
              </CText>
              {beneficiaries.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  Resolved bank accounts will appear here after your first send.
                </CText>
              ) : (
                <FlatList
                  data={beneficiaries}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <View className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 gap-x-3">
                      <Pressable
                        onPress={() => selectBeneficiary(item)}
                        className="flex-row items-center gap-x-3 flex-1"
                      >
                        <View className="h-11 w-11 rounded-full bg-purple/10 items-center justify-center">
                          <MaterialCommunityIcons
                            name="bank"
                            size={22}
                            color="#971BB2"
                          />
                        </View>
                        <View className="flex-1">
                          <CText style={{ fontFamily: "bold" }} className="text-[1rem]" numberOfLines={1}>
                            {item.accountName}
                          </CText>
                          <CText className="text-[0.85rem] text-black/60 dark:text-grey/70" numberOfLines={1}>
                            {item.bankName}
                          </CText>
                          <CText className="text-[0.8rem] text-black/50 dark:text-grey/60">
                            {item.accountNumber}
                          </CText>
                        </View>
                      </Pressable>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.accountName}`}
                        onPress={() => deleteBeneficiary(item)}
                        className="p-2 rounded-full bg-grey dark:bg-accent2"
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          }
        />
      ) : null}

      {bankPickerOpen ? (
        <DragableSheet
          close={() => setBankPickerOpen(false)}
          panClose
          snapPoints={["72%", "88%"]}
          child={
            <View className="w-full flex-1 gap-y-3 pb-6">
              <CText style={{ fontFamily: "bold" }} className="text-[18px] text-center">
                Select bank
              </CText>
              <SearchInput onSearch={setBankSearch} value={bankSearch} />
              {loading === "banks" ? (
                <ActivityIndicator color="#971BB2" className="py-6" />
              ) : filteredBanks.length === 0 ? (
                <CText className="text-center text-gray-500 py-6 px-4">
                  No banks found. Verify PajCash and try again.
                </CText>
              ) : (
                <FlatList
                  data={filteredBanks}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => selectBank(item)}
                      className="flex-row items-center justify-between gap-x-3 py-4 border-b border-gray-200 dark:border-gray-700"
                    >
                      <View className="flex-row items-center gap-x-3 flex-1">
                        <View className="h-11 w-11 rounded-full overflow-hidden bg-grey/50 dark:bg-accent2 items-center justify-center">
                          {getBankLogo(item) ? (
                            <Image
                              source={{ uri: getBankLogo(item) }}
                              style={{ height: "100%", width: "100%" }}
                              contentFit="cover"
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name="bank"
                              size={22}
                              color="#971BB2"
                            />
                          )}
                        </View>
                        <CText
                          style={{ fontFamily: "bold" }}
                          className="text-[1rem] flex-1"
                          numberOfLines={1}
                        >
                          {item.name}
                        </CText>
                      </View>
                      {selectedBank?.id === item.id ? (
                        <AntDesign name="check" size={20} color="#971BB2" />
                      ) : null}
                    </Pressable>
                  )}
                />
              )}
            </View>
          }
        />
      ) : null}

      {order && orderSheetOpen ? (
        <DragableSheet
          close={() => setOrderSheetOpen(false)}
          panClose
          snapPoints={["52%", "72%"]}
          child={
            <View className="w-full flex-1 gap-y-4 pb-6">
              <View className="gap-y-1">
                <CText style={{ fontFamily: "bold" }} className="text-[1.35rem] text-center">
                  Confirm offramp
                </CText>
                <CText className="text-[0.9rem] text-center text-black/60 dark:text-grey/70">
                  Send the token amount below to complete your bank payout.
                </CText>
              </View>

              <View className="w-full p-4 rounded-2xl bg-grey/50 dark:bg-black/30 gap-y-3">
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Bank</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {selectedBank?.name}
                  </CText>
                </View>
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Account</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {accountName || accountNumber}
                  </CText>
                </View>
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">You send</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {formatDisplayAmount(orderAmount) || "0"} {selectedToken?.symbol}
                  </CText>
                </View>
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">You receive</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {formatDisplayAmount(order.fiatAmount ?? quote?.fiatAmount) || "0"} NGN
                  </CText>
                </View>
                {Number(order.fee) > 0 ? (
                  <View className="flex-row justify-between gap-x-3">
                    <CText className="text-black/60 dark:text-grey/70">Platform fee</CText>
                    <CText className="flex-1 text-right text-black/70 dark:text-grey/80">
                      {formatDisplayAmount(order.fee)} USDC
                    </CText>
                  </View>
                ) : null}
                <View className="flex-row justify-between gap-x-3">
                  <CText className="text-black/60 dark:text-grey/70">Order</CText>
                  <CText style={{ fontFamily: "bold" }} className="flex-1 text-right">
                    {order.id}
                  </CText>
                </View>
              </View>

              <Buttons
                type="primary"
                className="w-full py-4 px-4 rounded-3xl"
                text={`Send ${formatDisplayAmount(orderAmount) || "0"} ${selectedToken?.symbol}`}
                onPress={() => void sendOrderTokens()}
              />
              <Buttons
                type="secondary"
                className="w-full py-4 px-4 rounded-3xl"
                text="Cancel"
                onPress={() => setOrderSheetOpen(false)}
              />
            </View>
          }
        />
      ) : null}
    </View>
  );
}
