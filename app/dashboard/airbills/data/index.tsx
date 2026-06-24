import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Connection } from "@solana/web3.js";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Contacts from "expo-contacts";

import CText from "@/components/TextComp";
import {
  formatNaira,
  NetworkBadge,
  NetworkPickerSheet,
  AirbillsDataPlanCardBanner,
} from "@/components/Airbills/shared";
import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import { api_key } from "@/utils/dashboard";
import { signTransactions } from "@/utils/functions/extrafunctions";
import {
  airBills,
  normalizeAirbillsPhoneNumber,
  type InternetPlan,
} from "@/libs/tools/airbills/airbills";
import {
  DATA_PLAN_CATEGORIES,
  type DataPlanCategory,
  filterPlansByCategory,
  formatPhoneDisplay,
  parseDataPlan,
  sortParsedPlans,
  type ParsedDataPlan,
} from "@/libs/tools/airbills/dataPlanDisplay";
import { recordAppTransactionAsync } from "@/services/appTransactions";
import {
  calculateCashbackPointsFromConfig,
  formatPointsLabel,
  getHeyPointsBalance,
  getHeyPointsConfig,
  type HeyPointsConfig,
} from "@/services/pointsApi";

function PlanGridCard({
  item,
  width,
  busy,
  cashbackPoints,
  onPress,
}: {
  item: ParsedDataPlan;
  width: number;
  busy: boolean;
  cashbackPoints?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{ width }}
      className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-accent"
    >
      <AirbillsDataPlanCardBanner />
      {!!cashbackPoints && cashbackPoints > 0 && (
        <View className="items-center bg-purple px-1 py-1">
          <CText
            style={{ fontFamily: "bold", color: "#FFFFFF", fontSize: 10 }}
            numberOfLines={1}
          >
            +{cashbackPoints} pts
          </CText>
        </View>
      )}
      <View className="min-h-[92px] items-center justify-center px-2 py-1.5">
        <CText style={{ fontFamily: "bold" }} className="w-full text-center text-[1.1rem]">
          {item.sizeLabel}
        </CText>
        {!!item.validityLabel && (
          <CText className="mt-0.5 w-full text-center text-[0.78rem] text-black/55 dark:text-grey/60">
            {item.validityLabel}
          </CText>
        )}
        <CText style={{ fontFamily: "bold" }} className="mt-1.5 w-full text-center text-[0.95rem]">
          {formatNaira(Number(item.plan.prodAmount))}
        </CText>
        {busy && (
          <View className="absolute inset-0 items-center justify-center bg-black/20 dark:bg-black/40">
            <ActivityIndicator color="#971BB2" />
          </View>
        )}
      </View>
      {!!item.footerLabel && (
        <View className="items-center justify-center bg-purple/10 px-2 py-1">
          <CText
            className="text-center text-[0.68rem] text-purple"
            numberOfLines={2}
          >
            {item.footerLabel}
          </CText>
        </View>
      )}
    </Pressable>
  );
}

export default function AirbillsDataScreen() {
  const params = useLocalSearchParams<{
    phone_number?: string;
    network_id?: string;
  }>();
  const { width } = useWindowDimensions();
  const { isDarkMode } = useThemeContext();
  const { user } = UserItem();
  const { setToast, setLoading, network } = AppSettings();
  const walletAddress = WalletItem((state) => state.publicKey?.toString() || "");

  const savedPhone =
    ToolsItem.getState().getParameterValue(
      "Airbills",
      "internet",
      "phone_number"
    ) || "";
  const savedNetworkId =
    ToolsItem.getState().getParameterValue(
      "Airbills",
      "internet",
      "network_id"
    ) || "";

  const [phoneNumber, setPhoneNumber] = useState(
    normalizeAirbillsPhoneNumber(
      params.phone_number || savedPhone || user?.mobileNumber || ""
    )
  );
  const [networkId, setNetworkId] = useState(
    String(params.network_id || savedNetworkId || "01")
  );
  const [batch, setBatch] = useState("01");
  const [plans, setPlans] = useState<InternetPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<DataPlanCategory>("all");
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);
  const [pointsConfig, setPointsConfig] = useState<HeyPointsConfig | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);

  const mutedIcon = isDarkMode ? "#9CA3AF" : "#6B7280";

  const cardWidth = useMemo(() => (width - 32 - 16) / 3, [width]);

  const refreshPoints = useCallback(async () => {
    const config = await getHeyPointsConfig();
    setPointsConfig(config);
    if (walletAddress && config?.enabled) {
      setPointsBalance(await getHeyPointsBalance(walletAddress));
    }
  }, [walletAddress]);

  useEffect(() => {
    void refreshPoints();
  }, [refreshPoints]);

  useEffect(() => {
    ToolsItem.getState().updateToolParameter("Airbills", "internet", {
      type: "phone_number",
      value: phoneNumber,
    });
  }, [phoneNumber]);

  useEffect(() => {
    if (networkId) {
      ToolsItem.getState().updateToolParameter("Airbills", "internet", {
        type: "network_id",
        value: networkId,
      });
    }
  }, [networkId]);

  const parsedPlans = useMemo(
    () => sortParsedPlans(plans.map(parseDataPlan)),
    [plans]
  );

  const visiblePlans = useMemo(
    () => filterPlansByCategory(parsedPlans, activeCategory),
    [activeCategory, parsedPlans]
  );

  const loadPlans = useCallback(
    async (options?: { silent?: boolean }) => {
      const normalized = normalizeAirbillsPhoneNumber(phoneNumber);
      if (!normalized) {
        if (!options?.silent) setToast("Enter a valid phone number", "error");
        return;
      }

      let resolvedNetworkId = networkId;
      if (!resolvedNetworkId) {
        const networkResponse = await airBills.airtime.detectNetwork(normalized);
        if (!networkResponse.status || !networkResponse.data?.networkId) {
          if (!options?.silent) {
            setToast(
              networkResponse.message ||
                "Could not detect network for this number",
              "error"
            );
          }
          return;
        }
        resolvedNetworkId = networkResponse.data.networkId;
        setNetworkId(resolvedNetworkId);
      }

      setLoadingPlans(true);
      const response = await airBills.internet.listPlans(resolvedNetworkId);
      setLoadingPlans(false);

      if (!response.status || !response.data?.plans?.length) {
        setPlans([]);
        if (!options?.silent) {
          setToast(response.message || "No data plans found", "error");
        }
        return;
      }

      setBatch(response.data.batch);
      setPlans(response.data.plans);
    },
    [networkId, phoneNumber, setToast]
  );

  const loadPlansRef = useRef(loadPlans);
  loadPlansRef.current = loadPlans;

  useEffect(() => {
    if (!phoneNumber.trim()) return;
    const timer = setTimeout(() => {
      void loadPlansRef.current({ silent: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [phoneNumber, networkId]);

  const purchasePlan = useCallback(
    async (plan: InternetPlan) => {
      if (!walletAddress) {
        setToast("Connect your wallet to continue", "error");
        return;
      }

      const normalized = normalizeAirbillsPhoneNumber(phoneNumber);
      if (!normalized) {
        setToast("Enter a valid phone number", "error");
        return;
      }

      const resolvedNetworkId = networkId || plan.networkId;
      setPurchasingPlanId(plan.prodId);
      setLoading(true);

      const response = await airBills.internet.purchaseDataBundle({
        phoneNumber: normalized,
        networkId: resolvedNetworkId,
        amount: Number(plan.prodAmount),
        prodId: plan.prodId,
        batch,
        userWalletAddress: walletAddress,
        token: "USDC",
      });

      if (!response.status || !response.data?.ix || !response.data?.id) {
        setLoading(false);
        setPurchasingPlanId(null);
        setToast(response.message || "Purchase failed", "error");
        return;
      }

      const signed = await signTransactions({
        tx: response.data.ix,
        confirmMessage: `Buy ${plan.prodName} for ${formatNaira(Number(plan.prodAmount))}?`,
      });

      if (!signed.status) {
        setLoading(false);
        setPurchasingPlanId(null);
        setToast(signed.message || "Transaction cancelled", "error");
        return;
      }

      const connection = new Connection(`${network}${api_key}`);
      const confirmed = await connection.confirmTransaction(
        signed.message,
        "confirmed"
      );

      if (!confirmed) {
        setLoading(false);
        setPurchasingPlanId(null);
        setToast("Transaction was not confirmed", "error");
        return;
      }

      const completeResponse = await airBills.internet.completePurchase(
        response.data.id
      );
      setLoading(false);
      setPurchasingPlanId(null);

      if (!completeResponse.status) {
        setToast("Payment sent but bundle fulfillment failed", "error");
        return;
      }

      recordAppTransactionAsync({
        signature: signed.message,
        transaction_type: "internet",
        status: "confirmed",
        provider: "airbills",
        app_called: "Airbills",
        input_token_symbol: "USDC",
        input_amount: Number(plan.prodAmount),
        input_amount_usd: Number(plan.prodAmount),
        amount: Number(plan.prodAmount),
        token: "USDC",
        raw_metadata: {
          mobile_number: normalized,
          network_id: resolvedNetworkId,
          prod_id: plan.prodId,
          plan_name: plan.prodName,
        },
      });

      await refreshPoints();

      setToast(`${plan.prodName} purchased successfully`, "success");
    },
    [batch, network, networkId, phoneNumber, refreshPoints, setLoading, setToast, walletAddress]
  );

  const pickContactNumber = useCallback(async () => {
    if (user?.mobileNumber) {
      setPhoneNumber(normalizeAirbillsPhoneNumber(user.mobileNumber));
      return;
    }

    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      setToast("Allow contacts access or enter the number manually", "error");
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
      pageSize: 50,
    });

    const firstWithPhone = data.find(
      (contact) => contact.phoneNumbers?.[0]?.number
    );
    const raw = firstWithPhone?.phoneNumbers?.[0]?.number;
    if (!raw) {
      setToast("No contacts with phone numbers found", "error");
      return;
    }
    setPhoneNumber(normalizeAirbillsPhoneNumber(raw));
  }, [setToast, user?.mobileNumber]);

  const listHeader = (
    <View>
      <View className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-accent">
        <Image
          source={require("@/assets/apps/airbillsbg.jpeg")}
          style={{ width: "100%", height: 112 }}
          contentFit="cover"
        />
        <View className="px-4 py-3">
          <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
            Top up data anytime, anywhere
          </CText>
          {pointsConfig?.enabled && pointsConfig.cashback_enabled && (
            <CText className="mt-1 text-[0.82rem] text-black/60 dark:text-grey/70">
              Earn Hey Points on every data purchase. Redeem for airtime or gas fees only.
            </CText>
          )}
        </View>
      </View>

      <View className="mt-4 flex-row items-center rounded-2xl border border-grey bg-white px-3 py-2 dark:border-accent2 dark:bg-accent">
        <Pressable
          onPress={() => setNetworkPickerOpen(true)}
          className="flex-row items-center gap-x-2 pr-3"
        >
          <NetworkBadge networkId={networkId || "01"} />
          <Ionicons name="chevron-down" size={16} color={mutedIcon} />
        </Pressable>
        <View className="h-8 w-px bg-grey dark:bg-accent2" />
        <TextInput
          className="flex-1 px-3 text-[1.05rem] text-black dark:text-grey"
          value={formatPhoneDisplay(phoneNumber)}
          onChangeText={(text) =>
            setPhoneNumber(normalizeAirbillsPhoneNumber(text))
          }
          placeholder="0813 2532 430"
          placeholderTextColor={mutedIcon}
          keyboardType="phone-pad"
        />
        <Pressable
          onPress={pickContactNumber}
          className="h-10 w-10 items-center justify-center rounded-full bg-purple"
        >
          <Ionicons name="person" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="mt-5">
        <CText style={{ fontFamily: "bold" }} className="text-[1.15rem]">
          Data Plans
        </CText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3 mb-4"
        contentContainerStyle={{ gap: 18, paddingRight: 12, paddingBottom: 8 }}
      >
        {DATA_PLAN_CATEGORIES.map((category) => {
          const active = activeCategory === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategory(category.id)}
              className="items-center"
            >
              <CText
                style={{ fontFamily: active ? "bold" : "reg" }}
                className={`text-center text-[0.95rem] ${
                  active ? "" : "text-black/45 dark:text-grey/50"
                }`}
              >
                {category.label}
              </CText>
              {active && (
                <View className="mt-2 h-[2px] w-full rounded-full bg-purple" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {loadingPlans && (
        <View className="my-8 items-center">
          <ActivityIndicator color="#971BB2" />
        </View>
      )}
    </View>
  );

  const emptyState = !loadingPlans ? (
    <View className="mt-10 items-center px-4">
      <CText className="text-center text-[0.95rem] text-black/60 dark:text-grey/70">
        {plans.length
          ? "No plans in this category yet. Try another tab."
          : "Enter a phone number to load available data plans."}
      </CText>
    </View>
  ) : null;

  return (
    <View className="relative flex-1 bg-grey dark:bg-dark">
      <View className="w-full flex-row items-center justify-between px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-x-3">
          <Pressable
            onPress={() => router.back()}
            className="rounded-full bg-white p-3 dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
            Mobile Data
          </CText>
        </View>
        <View className="items-end gap-y-1">
          {pointsConfig?.enabled && (
            <View className="rounded-full bg-purple/10 px-3 py-1">
              <CText style={{ fontFamily: "bold" }} className="text-[0.78rem] text-purple">
                {formatPointsLabel(pointsBalance)}
              </CText>
            </View>
          )}
          <Pressable onPress={() => router.push("/dashboard/transactions")}>
            <CText style={{ fontFamily: "bold" }} className="text-[0.95rem] text-purple">
              History
            </CText>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visiblePlans}
        numColumns={3}
        columnWrapperStyle={{ gap: 8 }}
        keyExtractor={(item) => `${item.plan.prodId}-${item.plan.prodCode}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => (
          <PlanGridCard
            item={item}
            width={cardWidth}
            busy={purchasingPlanId === item.plan.prodId}
            cashbackPoints={calculateCashbackPointsFromConfig(
              pointsConfig,
              Number(item.plan.prodAmount)
            )}
            onPress={() => purchasePlan(item.plan)}
          />
        )}
      />

      {networkPickerOpen && (
        <NetworkPickerSheet
          open={networkPickerOpen}
          networkId={networkId}
          onClose={() => setNetworkPickerOpen(false)}
          onSelect={setNetworkId}
        />
      )}
    </View>
  );
}
