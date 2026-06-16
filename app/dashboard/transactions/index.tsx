import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableNativeFeedback,
  View,
} from "react-native";
import { router } from "expo-router";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { getAppTransactions, appTransactionRouteId, type AppTransaction } from "@/services/appTransactions";
import { formatDate } from "@/utils/functions/extrafunctions";
import { appTxRowSummary } from "@/utils/appTransactionDisplay";

function safeDate(value?: string | null) {
  if (!value) return "Pending";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function TransactionRow({ tx, index }: { tx: AppTransaction; index: number }) {
  const row = appTxRowSummary(tx);
  const date = tx.confirmed_at ?? tx.created_at ?? "";

  return (
    <View key={tx.local_id ?? tx.id ?? tx.signature ?? `tx-${index}`}>
      <TouchableNativeFeedback
        background={TouchableNativeFeedback.Ripple("#971BB2", false)}
        onPress={() => {
          router.push({
            pathname: "/dashboard/transaction",
            params: { id: appTransactionRouteId(tx) },
          });
        }}
      >
        <View className="px-4 py-4 w-full flex-row items-start justify-between">
          <View className="gap-y-2 flex-1 pr-2">
            <CText className="text-[0.95rem]">{safeDate(date)}</CText>
            <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
              {row.title}
            </CText>
            <CText
              style={{ fontFamily: "reg" }}
              className="text-[0.9rem] text-grey/70 dark:text-grey/50"
            >
              {row.subtitle}
            </CText>
          </View>
          {row.amount ? (
            <CText
              textColor={row.sent ? "text-red-400" : "text-green-400"}
              style={{ fontFamily: "reg" }}
              className="text-[1rem] max-w-[45%] text-right"
            >
              {row.amount}
            </CText>
          ) : null}
        </View>
      </TouchableNativeFeedback>
      <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
    </View>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<AppTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const res = await getAppTransactions({ limit: 100, syncFirst: true });
    if (res.status) {
      setTransactions(res.data);
    } else {
      setTransactions([]);
      setError(res.message ?? "Unable to load transactions");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

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
          Transaction History
        </CText>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#971BB2" />
          <CText className="mt-3 text-black/60 dark:text-grey/70">
            Loading transactions...
          </CText>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadTransactions(true)}
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="rounded-3xl bg-white dark:bg-accent overflow-hidden min-h-[220px]">
            {error ? (
              <View className="px-4 py-10">
                <CText className="text-center text-red-500">{error}</CText>
              </View>
            ) : transactions.length === 0 ? (
              <View className="px-4 py-10">
                <CText className="text-center text-grey/70">
                  No app transactions found for this wallet yet.
                </CText>
              </View>
            ) : (
              transactions.map((tx, index) => (
                <TransactionRow
                  key={tx.local_id ?? tx.id ?? tx.signature ?? `tx-${index}`}
                  tx={tx}
                  index={index}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
