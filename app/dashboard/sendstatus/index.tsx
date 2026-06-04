import { useLocalSearchParams, router } from "expo-router";
import CText from "@/components/TextComp";
import {
  Pressable,
  View,
  TouchableOpacity,
  Linking,
} from "react-native";
import IconLibrary from "@/utils/icons";
import TxQueue from "@/utils/store/txqueue.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { useEffect, useRef } from "react";
import Buttons from "@/components/ButtonComp";
import { TransactionStatusRingSkeleton } from "@/components/skeletons";
import { recordOfframpTransaction } from "@/services/appTransactions";
import { formatAppTxAmount } from "@/utils/appTransactionDisplay";
import { invalidateWalletBalanceCache } from "@/utils/wallet/walletBalanceCache";

function goToDashboard() {
  invalidateWalletBalanceCache();
  router.replace("/dashboard");
}

export default function SendStatus() {
  const {
    id,
    amount,
    recipient,
    tokenName,
    displayName,
    mint,
    mode,
    orderId,
    fiatAmount,
    bank,
    accountNumber,
  } =
    useLocalSearchParams();
  const item = TxQueue((s) =>
    typeof id === "string" ? s.items[id] : undefined
  );
  const recordedRef = useRef(false);

  const openExplorer = () => {
    if (item?.txid) {
      const network = AppSettings.getState().networkShort;
      const explorerUrl = `https://explorer.solana.com/tx/${item.txid}?cluster=${network}`;
      Linking.openURL(explorerUrl);
    }
  };

  useEffect(() => {
    if (item?.status === "confirmed" && item.txid) {
      if (mode === "offramp" && !recordedRef.current) {
        recordedRef.current = true;
        recordOfframpTransaction({
          signature: item.txid,
          provider: "pajcash",
          app_called: "Pajcash",
          amount: Number(amount ?? 0),
          token: String(tokenName ?? "SPL"),
          mint: mint as string,
          recipient: recipient as string,
          raw_metadata: {
            order_id: orderId,
            fiat_amount: fiatAmount,
            bank,
            account_number: accountNumber,
          },
        });
      }
      router.replace({
        pathname: "/dashboard/transaction",
        params: {
          id: item.txid,
        },
      });
    }
  }, [item?.status, item?.txid]);

  const statusText = (() => {
    switch (item?.status) {
      case "queued":
      case "signing":
      case "submitted":
      case "confirming":
        return "Processing transaction...";
      case "confirmed":
        return "Transaction confirmed";
      case "failed":
        return "Transaction failed";
      default:
        return "Preparing transaction...";
    }
  })();

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Send Status</CText>
      </View>

      <View className="px-4 flex-1 items-center justify-center gap-y-6">
        {item?.status !== "failed" ? (
          <TransactionStatusRingSkeleton />
        ) : (
          <View className="w-24 h-24 bg-red-500 rounded-full items-center justify-center">
            <IconLibrary.cancel size={48} color="white" />
          </View>
        )}

        <CText className="text-[20px]" style={{ fontFamily: "bold" }}>
          {statusText}
        </CText>
        <CText className="text-center text-[14px] text-gray-600 dark:text-gray-300">
          {displayName || (recipient as string)}
        </CText>
        <CText className="text-center text-[14px] text-gray-600 dark:text-gray-300">
          {formatAppTxAmount(amount as string, tokenName as string)}
        </CText>

        {item?.status === "failed" && (
          <View className="w-full mt-4">
            <CText className="text-center text-red-500">
              {item?.error || "Something went wrong."}
            </CText>
          </View>
        )}

        <View className="w-full mt-auto pb-8 gap-y-3">
          {item?.txid && (
            <Buttons
              text="View on Explorer"
              type="secondary"
              onPress={openExplorer}
            />
          )}
          <Buttons
            text="Back to Dashboard"
            type="primary"
            onPress={goToDashboard}
          />
        </View>
      </View>
    </View>
  );
}
