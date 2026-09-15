import { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View, TextInput, TouchableOpacity } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { useThemeContext } from "@/context/ThemeContext";
import { Connection, PublicKey } from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import { getHeliusApiKeySync } from "@/services/rpcConfig";
import ConfirmActionSheet from "@/components/Sheets/ConfirmationSheet";
import ButtonComp from "@/components/ButtonComp";
import TxQueue from "@/utils/store/txqueue.store";
import { SendFlowScreenSkeleton } from "@/components/skeletons";
import {
  SOL_MINT,
  formatSolAmount,
  formatSolFee,
  getMaxSendableSol,
  solTransferFitsBalance,
} from "@/utils/wallet/solTransferFees";

export default function TokenAmount() {
  const { mint, recipient, displayName } = useLocalSearchParams();
  const [token, setToken] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [maxSendable, setMaxSendable] = useState<number | null>(null);
  const [estimatedFeeLamports, setEstimatedFeeLamports] = useState<number | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);

  const { setToast } = AppSettings();
  const { publicKey } = WalletItem();
  const { userWallet } = UserItem();
  const { isDarkMode } = useThemeContext();

  const isSol = token?.mint === SOL_MINT;
  const spendableBalance = isSol && maxSendable != null ? maxSendable : token?.balance ?? 0;

  useEffect(() => {
    if (mint) {
      const tokens = userWallet.tokenAccounts.filter(
        (item: any) => item.mint === mint
      );
      setToken(tokens[0]);
    }

    const network = AppSettings.getState().network;
    const conn = new Connection(`${network}${getHeliusApiKeySync()}`);
    setConnection(conn);
  }, [mint, userWallet.tokenAccounts]);

  const refreshSolLimits = useCallback(async () => {
    if (!connection || !publicKey || !recipient || token?.mint !== SOL_MINT) {
      setMaxSendable(null);
      setEstimatedFeeLamports(null);
      return;
    }

    try {
      const { maxSol, feeLamports } = await getMaxSendableSol(
        connection,
        publicKey,
        new PublicKey(recipient as string)
      );
      setMaxSendable(maxSol);
      setEstimatedFeeLamports(feeLamports);
    } catch (error) {
      console.error("Failed to estimate SOL transfer limits:", error);
      setMaxSendable(token?.balance ?? 0);
      setEstimatedFeeLamports(null);
    }
  }, [connection, publicKey, recipient, token?.balance, token?.mint]);

  useEffect(() => {
    void refreshSolLimits();
  }, [refreshSolLimits]);

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.]/g, "");
    const parts = numericValue.split(".");
    if (parts.length > 2) return;
    if (parts.length === 2 && parts[1].length > token?.decimals) return;
    setAmount(numericValue);
  };

  const setMaxAmount = async () => {
    if (!token) return;

    if (isSol) {
      setMaxLoading(true);
      try {
        if (!connection || !publicKey || !recipient) {
          setToast("Unable to calculate max amount", "error");
          return;
        }
        const { maxSol, feeLamports } = await getMaxSendableSol(
          connection,
          publicKey,
          new PublicKey(recipient as string)
        );
        if (maxSol <= 0) {
          setToast("Balance is too low to cover network fees", "error");
          return;
        }
        setMaxSendable(maxSol);
        setEstimatedFeeLamports(feeLamports);
        setAmount(formatSolAmount(maxSol));
      } catch (error) {
        console.error("Failed to set max SOL amount:", error);
        setToast("Failed to calculate max amount", "error");
      } finally {
        setMaxLoading(false);
      }
      return;
    }

    setAmount(token.balance.toString());
  };

  const getUsdValue = () => {
    if (!amount || !token) return "0.00";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return "0.00";

    const usdValue = numAmount * (token.usdc_price / token.balance);
    return `$${usdValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const handleSend = async () => {
    if (!token || !amount || !connection || !recipient) {
      setToast("Please fill in all required fields", "error");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setToast("Please enter a valid amount", "error");
      return;
    }

    if (numAmount > spendableBalance) {
      setToast(
        isSol ? "Insufficient balance after network fees" : "Insufficient balance",
        "error"
      );
      return;
    }

    if (isSol && publicKey) {
      const fit = await solTransferFitsBalance(
        connection,
        publicKey,
        new PublicKey(recipient as string),
        numAmount
      );
      if (!fit.ok) {
        setEstimatedFeeLamports(fit.feeLamports);
        setMaxSendable(fit.maxSol);
        setToast("Insufficient balance after network fees", "error");
        return;
      }
      setEstimatedFeeLamports(fit.feeLamports);
    }

    setShowConfirmation(true);
  };

  const executeTransaction = () => {
    try {
      const numAmount = parseFloat(amount);
      const id = TxQueue.getState().enqueue(
        isSol
          ? {
            kind: "sol",
            recipient: recipient as string,
            amount: numAmount,
          }
          : {
            kind: "spl",
            recipient: recipient as string,
            mint: token.mint,
            amount: numAmount,
            decimals: token.decimals,
            symbol: token.symbol,
          }
      );

      router.push({
        pathname: "/dashboard/sendstatus",
        params: {
          id,
          amount: amount,
          recipient: recipient as string,
          tokenName: token.symbol,
          displayName: displayName || (recipient as string),
          mint: token.mint,
        },
      });
    } catch (error) {
      console.error("Queue error:", error);
      setToast("Failed to start transaction. Please try again.", "error");
    }
  };

  const confirmationSubtitle = (() => {
    const feeLine =
      isSol && estimatedFeeLamports != null
        ? `\nNetwork fee: ~${formatSolFee(estimatedFeeLamports)} SOL`
        : "";
    return `Send ${amount} ${token?.symbol} to ${displayName || (recipient as string).substring(0, 20) + "..."
      }\n\nAmount: ${amount} ${token?.symbol}\nUSD Value: ${getUsdValue()}${feeLine}`;
  })();

  if (!token) {
    return <SendFlowScreenSkeleton />;
  }

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Send {token?.name}</CText>
      </View>

      <View className="px-4 flex-1">
        <View className="bg-white dark:bg-accent rounded-xl p-4 mb-6">
          <CText className="text-[14px] text-gray-600 dark:text-gray-300 mb-2">
            Recipient
          </CText>
          <CText
            className="text-[16px] font-mono"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayName || recipient}
          </CText>
          {displayName && displayName !== recipient && (
            <CText
              className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 font-mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {recipient}
            </CText>
          )}
        </View>

        <View className="p-2 rounded-xl bg-white dark:bg-accent2">
          <View className="mb-6">
            <View className="p-2">
              <TextInput
                className="text-[40px] text-black dark:text-white text-start mb-2"
                value={amount}
                onChangeText={handleAmountChange}
                placeholder={`0.00 ${token?.symbol}`}
                placeholderTextColor={isDarkMode ? "#9CA3AF" : "#6B7280"}
                keyboardType="numeric"
                autoFocus
              />
              <CText className="text-start text-[20px] text-gray-600 dark:text-gray-300">
                {getUsdValue()}
              </CText>
            </View>
          </View>

          <View className="bg-white dark:bg-accent rounded-xl p-4 mb-6 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <CText className="text-[20px] ">
                {token?.balance < 1
                  ? token?.balance?.toFixed(Math.min(token?.decimals, 5))
                  : token?.balance.toFixed(Math.min(token?.decimals, 3))}{" "}
                {token.symbol}
              </CText>
              <CText className="text-[14px] text-gray-600 dark:text-gray-300">
                {isSol ? "Wallet balance" : "Available Balance"}
              </CText>
              {isSol && maxSendable != null ? (
                <CText className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                  Max sendable: {formatSolAmount(maxSendable)} SOL
                  {estimatedFeeLamports != null
                    ? ` (fee ~${formatSolFee(estimatedFeeLamports)} SOL)`
                    : ""}
                </CText>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => void setMaxAmount()}
              disabled={maxLoading}
              className="bg-[#971BB2] px-4 py-2 rounded-lg"
            >
              <CText
                className="text-white text-[14px]"
                style={{ fontFamily: "bold" }}
              >
                {maxLoading ? "..." : "MAX"}
              </CText>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-auto pb-6">
          <ButtonComp
            text={`Send ${amount || "0"} ${token?.symbol}`}
            onPress={() => void handleSend()}
            type="primary"
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > spendableBalance
            }
          />
        </View>
      </View>

      <ConfirmActionSheet
        open={showConfirmation}
        close={setShowConfirmation}
        title="Confirm Transaction"
        subtitle={confirmationSubtitle}
        actionNo={() => setShowConfirmation(false)}
        actionYes={() => {
          setShowConfirmation(false);
          executeTransaction();
        }}
      />
    </View>
  );
}
