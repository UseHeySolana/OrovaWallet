import { Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import { copyItem } from "@/utils/functions";
import { formatDate, openURL, shortenPub } from "@/utils/functions/extrafunctions";
import {
  getAppTransaction,
  type AppTransaction,
} from "@/services/appTransactions";
import {
  formatAmountLikeMetadata,
  formatAppTxAmount,
} from "@/utils/appTransactionDisplay";

function formatType(type?: string | null) {
  return String(type ?? "transaction")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeDate(value?: string | null) {
  if (!value) return "Pending";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function explorerUrl(tx: AppTransaction) {
  if (!tx.signature) return null;
  return `https://explorer.solana.com/tx/${tx.signature}?cluster=${tx.cluster}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <View className="flex-row items-start justify-between gap-x-4 py-3 border-b border-grey/40 dark:border-dark">
      <CText className="text-[0.9rem] text-black/55 dark:text-grey/70">
        {label}
      </CText>
      <CText
        className={`flex-1 text-right text-[0.95rem] ${mono ? "font-mono" : ""}`}
        numberOfLines={2}
        ellipsizeMode="middle"
        style={{ fontFamily: mono ? "reg" : "bold" }}
      >
        {String(value)}
      </CText>
    </View>
  );
}

function TransactionIdRow({
  value,
  onCopy,
}: {
  value?: string | null;
  onCopy: () => void;
}) {
  if (!value) return null;
  return (
    <View className="flex-row items-start justify-between gap-x-4 py-3 border-b border-grey/40 dark:border-dark">
      <CText className="text-[0.9rem] text-black/55 dark:text-grey/70">
        Transaction ID
      </CText>
      <View className="flex-1 items-end">
        <TouchableOpacity
          onPress={onCopy}
          className="mb-1 h-8 w-8 items-center justify-center rounded-full bg-grey dark:bg-accent2"
        >
          <IconLibrary.copy size={14} />
        </TouchableOpacity>
        <CText
          className="text-right text-[0.95rem] font-mono"
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {value}
        </CText>
      </View>
    </View>
  );
}

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { setToast } = AppSettings();
  const receiptRef = useRef<View>(null);
  const [tx, setTx] = useState<AppTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransaction = useCallback(async () => {
    if (!id) {
      setError("Transaction not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await getAppTransaction(id);
      if (res.status) {
        setTx(res.data);
        setLoading(false);
        return;
      }

      if (attempt === 3) {
        setError(res.message ?? "Unable to load transaction");
        setLoading(false);
        return;
      }

      await delay(700);
    }
  }, [id]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);

  const metadataRows = useMemo(() => {
    if (!tx?.raw_metadata) return [];
    return Object.entries(tx.raw_metadata)
      .map(([key, value]) => {
        const formatted = formatAmountLikeMetadata(key, value);
        if (!formatted) return null;
        return {
          label: key.replace(/_/g, " "),
          value: formatted,
        };
      })
      .filter((row): row is { label: string; value: string } => row !== null);
  }, [tx?.raw_metadata]);

  const shareReceipt = async () => {
    if (!tx) return;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setToast("Sharing is not available on this device", "error");
        return;
      }

      const imageUri = await captureRef(receiptRef.current as View, {
        result: "tmpfile",
        quality: 1,
        format: "png",
      });
      await Sharing.shareAsync(imageUri, {
        mimeType: "image/png",
        dialogTitle: "Share transaction receipt",
      });
    } catch {
      setToast("Unable to share receipt", "error");
    }
  };

  const copySignature = async () => {
    if (!tx?.signature) return;
    const copied = await copyItem(tx.signature);
    setToast(copied ? "Transaction ID copied" : "Copy failed", copied ? "success" : "error");
  };

  const openExplorer = () => {
    if (!tx) return;
    const url = explorerUrl(tx);
    if (url) void openURL(url);
  };

  return (
    <View className="relative w-full flex-1 bg-grey dark:bg-dark py-4">
      <View className="w-full px-4 flex-row items-center gap-x-5 mb-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.35rem]" style={{ fontFamily: "bold" }}>
          Transaction Details
        </CText>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#971BB2" />
          <CText className="mt-3 text-black/60 dark:text-grey/70">
            Loading transaction...
          </CText>
        </View>
      ) : error ? (
        <View className="flex-1 px-4 items-center justify-center">
          <CText className="text-center text-red-500">{error}</CText>
          <TouchableOpacity
            onPress={() => void loadTransaction()}
            className="mt-4 rounded-full bg-purple px-6 py-3"
          >
            <CText className="text-white" style={{ fontFamily: "bold" }}>
              Retry
            </CText>
          </TouchableOpacity>
        </View>
      ) : tx ? (
        <ScrollView
          ref={receiptRef as Ref<ScrollView>}
          className="flex-1 px-4 py-2"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="rounded-3xl bg-white dark:bg-accent p-5 mb-4">
            <View className="items-center py-2">
              <View className={`px-4 py-2 rounded-full ${tx.status === "confirmed" ? "bg-green-100 dark:bg-green-950/50" : tx.status === "failed" ? "bg-red-100 dark:bg-red-950/50" : "bg-purple/10"}`}>
                <CText
                  className={`${tx.status === "confirmed" ? "text-green-600" : tx.status === "failed" ? "text-red-500" : "text-purple"} capitalize`}
                  style={{ fontFamily: "bold" }}
                >
                  {tx.status}
                </CText>
              </View>
              <CText className="mt-4 text-[1.5rem]" style={{ fontFamily: "bold" }}>
                {formatType(tx.transaction_type)}
              </CText>
              <CText className="mt-1 text-black/55 dark:text-grey/70">
                {safeDate(tx.confirmed_at ?? tx.created_at)}
              </CText>
            </View>
          </View>

          <View
            collapsable={false}
            className="rounded-3xl bg-white dark:bg-accent p-5 mb-4"
          >
            <CText className="text-[1.1rem] mb-2" style={{ fontFamily: "bold" }}>
              Receipt
            </CText>
            <DetailRow label="App" value={tx.app_called ?? "HeySolana"} />
            <DetailRow label="Provider" value={tx.provider} />
            <DetailRow
              label="Amount"
              value={formatAppTxAmount(tx.input_amount ?? tx.amount, tx.input_token_symbol ?? tx.token)}
            />
            <DetailRow
              label="Received"
              value={formatAppTxAmount(tx.output_amount, tx.output_token_symbol)}
            />
            <DetailRow
              label="USD value"
              value={formatAppTxAmount(tx.input_amount_usd, "USD")}
            />
            <DetailRow
              label="Platform fee"
              value={formatAppTxAmount(tx.platform_fee_amount, tx.platform_fee_token)}
            />
            <DetailRow
              label="Recipient"
              value={tx.recipient_address ? shortenPub(tx.recipient_address) : null}
              mono
            />
            <DetailRow label="Reference" value={tx.client_reference} mono />
            <TransactionIdRow value={tx.signature} onCopy={copySignature} />
            <DetailRow label="Network" value={tx.cluster} />
          </View>

          {metadataRows.length > 0 && (
            <View className="rounded-3xl bg-white dark:bg-accent p-5 mb-4">
              <CText className="text-[1.1rem] mb-2" style={{ fontFamily: "bold" }}>
                Extra Details
              </CText>
              {metadataRows.map((row) => (
                <DetailRow key={row.label} label={formatType(row.label)} value={row.value} />
              ))}
            </View>
          )}

          <View className="flex-row gap-x-3">
            <TouchableOpacity
              onPress={shareReceipt}
              className="flex-1 rounded-full bg-purple py-4"
            >
              <CText className="text-center text-white" style={{ fontFamily: "bold" }}>
                Share Receipt
              </CText>
            </TouchableOpacity>
            {tx.signature && (
              <TouchableOpacity
                onPress={openExplorer}
                className="flex-1 rounded-full bg-white dark:bg-accent py-4"
              >
                <CText className="text-center" style={{ fontFamily: "bold" }}>
                  View on Explorer
                </CText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
