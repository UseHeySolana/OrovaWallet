import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Connection } from "@solana/web3.js";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Contacts from "expo-contacts";

import Buttons from "@/components/ButtonComp";
import CText from "@/components/TextComp";
import {
  AirtimeQuickAmountTile,
  buildQuickAirtimeOptions,
  formatNaira,
  formatUsdc,
  NetworkBadge,
  NetworkPickerSheet,
} from "@/components/Airbills/shared";
import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import ToolsItem from "@/utils/store/toolsitems.store";
import { api_key } from "@/utils/dashboard";
import { signTransactions } from "@/utils/functions/extrafunctions";
import { airBills, normalizeAirbillsPhoneNumber } from "@/libs/tools/airbills/airbills";
import { formatPhoneDisplay } from "@/libs/tools/airbills/dataPlanDisplay";
import { recordAppTransactionAsync } from "@/services/appTransactions";
import {
  cancelHeyPointsAirtimeRedemption,
  checkoutAirtimeWithTreasury,
  formatPointsLabel,
  fulfillAirtimeTreasuryLeg,
  getHeyPointsBalance,
  getHeyPointsConfig,
  maxPointsForAirtimePurchase,
  redeemHeyPointsForAirtime,
  redeemHeyPointsForGas,
  type HeyPointsConfig,
} from "@/services/pointsApi";

const MIN_AIRTIME = 50;
const MAX_AIRTIME = 50_000;
const QUICK_AMOUNT_COLUMNS = 3;
const QUICK_AMOUNT_GAP = 8;
const QUICK_AMOUNT_HORIZONTAL_PADDING = 64;

function parseAmountInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export default function AirbillsAirtimeScreen() {
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
    ToolsItem.getState().getParameterValue("Airbills", "airtime", "phone_number") ||
    ToolsItem.getState().getParameterValue("Airbills", "internet", "phone_number") ||
    "";
  const savedNetworkId =
    ToolsItem.getState().getParameterValue("Airbills", "airtime", "network_id") ||
    ToolsItem.getState().getParameterValue("Airbills", "internet", "network_id") ||
    "";

  const [phoneNumber, setPhoneNumber] = useState(
    normalizeAirbillsPhoneNumber(
      params.phone_number || savedPhone || user?.mobileNumber || ""
    )
  );
  const [networkId, setNetworkId] = useState(
    String(params.network_id || savedNetworkId || "01")
  );
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [pointsConfig, setPointsConfig] = useState<HeyPointsConfig | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [redeemingGas, setRedeemingGas] = useState(false);

  const mutedIcon = isDarkMode ? "#9CA3AF" : "#6B7280";
  const cardWidth = useMemo(
    () =>
      (width -
        QUICK_AMOUNT_HORIZONTAL_PADDING -
        QUICK_AMOUNT_GAP * (QUICK_AMOUNT_COLUMNS - 1)) /
      QUICK_AMOUNT_COLUMNS,
    [width]
  );

  const quickOptions = useMemo(() => {
    if (pointsConfig?.quick_amounts?.length) {
      return pointsConfig.quick_amounts.map((item) => ({
        amount: item.amount_ngn,
        cashbackPoints: item.cashback_points,
      }));
    }
    return buildQuickAirtimeOptions();
  }, [pointsConfig]);

  const checkoutAmount = useMemo(() => {
    if (customAmount.trim()) return parseAmountInput(customAmount);
    return selectedAmount ?? 0;
  }, [customAmount, selectedAmount]);

  const maxApplicablePoints = useMemo(
    () => maxPointsForAirtimePurchase(pointsConfig, pointsBalance, checkoutAmount),
    [checkoutAmount, pointsBalance, pointsConfig]
  );

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
    ToolsItem.getState().updateToolParameter("Airbills", "airtime", {
      type: "phone_number",
      value: phoneNumber,
    });
  }, [phoneNumber]);

  useEffect(() => {
    if (networkId) {
      ToolsItem.getState().updateToolParameter("Airbills", "airtime", {
        type: "network_id",
        value: networkId,
      });
    }
  }, [networkId]);

  useEffect(() => {
    if (usePoints && maxApplicablePoints > 0) {
      setPointsToUse(maxApplicablePoints);
    } else if (!usePoints) {
      setPointsToUse(0);
    }
  }, [usePoints, maxApplicablePoints]);

  const resolveAmount = () => {
    if (customAmount.trim()) return parseAmountInput(customAmount);
    return selectedAmount ?? 0;
  };

  const purchaseAirtime = useCallback(
    async (faceAmount: number) => {
      if (!walletAddress) {
        setToast("Connect your wallet to continue", "error");
        return;
      }

      const normalized = normalizeAirbillsPhoneNumber(phoneNumber);
      if (!normalized) {
        setToast("Enter a valid phone number", "error");
        return;
      }

      if (!Number.isFinite(faceAmount) || faceAmount < MIN_AIRTIME || faceAmount > MAX_AIRTIME) {
        setToast(
          `Amount must be between ${formatNaira(MIN_AIRTIME)} and ${formatNaira(MAX_AIRTIME)}`,
          "error"
        );
        return;
      }

      let redemptionId: string | undefined;
      let pointsUsed = 0;
      let ngnPayable = faceAmount;
      let requiresTreasuryLeg = false;

      if (usePoints && pointsConfig?.redeem_airtime_enabled) {
        pointsUsed = Math.min(
          pointsToUse,
          maxPointsForAirtimePurchase(pointsConfig, pointsBalance, faceAmount)
        );

        if (pointsUsed > 0 && pointsConfig.treasury_checkout_enabled && pointsUsed >= faceAmount) {
          setPurchasing(true);
          setLoading(true);
          try {
            const result = await checkoutAirtimeWithTreasury({
              walletAddress,
              phoneNumber: normalized,
              networkId,
              airtimeAmountNgn: faceAmount,
              points: pointsUsed,
            });
            setPointsBalance(result.balance);

            recordAppTransactionAsync({
              signature: result.treasury.signature,
              transaction_type: "airtime",
              status: "confirmed",
              provider: "airbills",
              app_called: "Airbills",
              input_token_symbol: "USDC",
              input_amount: 0,
              input_amount_usd:
                result.treasury.amount_in_token > 0
                  ? result.treasury.amount_in_token
                  : undefined,
              amount: faceAmount,
              token: "USDC",
              raw_metadata: {
                mobile_number: normalized,
                network_id: networkId,
                airtime_selected_ngn: faceAmount,
                points_used: pointsUsed,
                points_redemption_id: result.redemption.redemption_id,
                treasury_full_checkout: true,
                treasury_signature: result.treasury.signature,
                treasury_amount_in_token: result.treasury.amount_in_token,
                usdc_paid: 0,
              },
            });

            await refreshPoints();
            setToast(
              `${formatNaira(faceAmount)} airtime purchased (${formatPointsLabel(pointsUsed)} applied)`,
              "success"
            );
            setCustomAmount("");
            setSelectedAmount(null);
          } catch (error) {
            setToast(
              error instanceof Error ? error.message : "Treasury checkout failed",
              "error"
            );
          } finally {
            setPurchasing(false);
            setLoading(false);
          }
          return;
        }

        if (pointsUsed > 0) {
          try {
            const redemption = await redeemHeyPointsForAirtime({
              walletAddress,
              points: pointsUsed,
              airtimeAmountNgn: faceAmount,
            });
            redemptionId = redemption.redemption_id;
            ngnPayable = redemption.usdc_due_ngn ?? redemption.ngn_payable ?? faceAmount - pointsUsed;
            requiresTreasuryLeg = !!redemption.requires_treasury_leg;
            setPointsBalance(redemption.balance);
          } catch (error) {
            setToast(
              error instanceof Error ? error.message : "Could not apply Hey Points",
              "error"
            );
            return;
          }
        }
      }

      setPurchasing(true);
      setLoading(true);

      const cancelRedemption = async () => {
        if (!redemptionId) return;
        try {
          await cancelHeyPointsAirtimeRedemption({
            walletAddress,
            redemptionId,
          });
          await refreshPoints();
        } catch {
          // Best effort refund
        }
      };

      const response = await airBills.airtime.purchaseAirtime(
        normalized,
        ngnPayable,
        walletAddress,
        networkId
      );

      if (!response.status || !response.data?.ix || !response.data?.id) {
        await cancelRedemption();
        setPurchasing(false);
        setLoading(false);
        setToast(response.message || "Airtime purchase failed", "error");
        return;
      }

      const usdcPayable = Number(response.data.amountInToken ?? 0);

      const confirmParts = [
        `Buy ${formatNaira(ngnPayable)} airtime for ${formatPhoneDisplay(normalized)}`,
      ];
      if (pointsUsed > 0) {
        confirmParts.push(`(${formatPointsLabel(pointsUsed)} applied)`);
      }
      if (Number.isFinite(usdcPayable) && usdcPayable > 0) {
        confirmParts.push(`Pay ${formatUsdc(usdcPayable)}`);
      }
      confirmParts.push("?");

      const signed = await signTransactions({
        tx: response.data.ix,
        confirmMessage: confirmParts.join(" "),
      });

      if (!signed.status) {
        await cancelRedemption();
        setPurchasing(false);
        setLoading(false);
        setToast(signed.message || "Transaction cancelled", "error");
        return;
      }

      const connection = new Connection(`${network}${api_key}`);
      const confirmed = await connection.confirmTransaction(signed.message, "confirmed");

      if (!confirmed) {
        await cancelRedemption();
        setPurchasing(false);
        setLoading(false);
        setToast("Transaction was not confirmed", "error");
        return;
      }

      const completeResponse = await airBills.airtime.completePurchase(response.data.id);
      setPurchasing(false);
      setLoading(false);

      if (!completeResponse.status) {
        await cancelRedemption();
        setToast("Payment sent but airtime fulfillment failed", "error");
        return;
      }

      let treasurySignature: string | undefined;
      let treasuryUsdcPaid: number | undefined;

      if (requiresTreasuryLeg && redemptionId) {
        setLoading(true);
        try {
          const treasuryLeg = await fulfillAirtimeTreasuryLeg({
            walletAddress,
            redemptionId,
            phoneNumber: normalized,
            networkId,
            userTransactionSignature: signed.message,
          });
          treasurySignature = treasuryLeg.treasury.signature;
          treasuryUsdcPaid = treasuryLeg.treasury.amount_in_token;
          setPointsBalance(treasuryLeg.balance);
        } catch (error) {
          setToast(
            error instanceof Error
              ? `${error.message}. Your payment went through; contact support if airtime is short.`
              : "Points top-up failed after payment. Contact support if airtime is short.",
            "error"
          );
        } finally {
          setLoading(false);
        }
      }

      recordAppTransactionAsync({
        signature: signed.message,
        transaction_type: "airtime",
        status: "confirmed",
        provider: "airbills",
        app_called: "Airbills",
        input_token_symbol: "USDC",
        input_amount: ngnPayable,
        input_amount_usd:
          Number.isFinite(usdcPayable) && usdcPayable > 0 ? usdcPayable : undefined,
        amount: requiresTreasuryLeg ? faceAmount : ngnPayable,
        token: "USDC",
        raw_metadata: {
          mobile_number: normalized,
          network_id: networkId,
          airtime_selected_ngn: faceAmount,
          airtime_amount_ngn: ngnPayable,
          usdc_paid: usdcPayable,
          points_used: pointsUsed,
          points_redemption_id: redemptionId,
          requires_treasury_leg: requiresTreasuryLeg,
          treasury_signature: treasurySignature,
          treasury_amount_in_token: treasuryUsdcPaid,
        },
      });

      await refreshPoints();

      const loadedNgn = requiresTreasuryLeg && treasurySignature ? faceAmount : ngnPayable;
      const successParts = [`${formatNaira(loadedNgn)} airtime purchased`];
      if (pointsUsed > 0) {
        successParts.push(`(${formatPointsLabel(pointsUsed)} applied)`);
      }
      setToast(`${successParts.join(" ")} successfully`, "success");
      setCustomAmount("");
      setSelectedAmount(null);
    },
    [
      maxApplicablePoints,
      network,
      networkId,
      phoneNumber,
      pointsBalance,
      pointsConfig,
      pointsToUse,
      refreshPoints,
      setLoading,
      setToast,
      usePoints,
      walletAddress,
    ]
  );

  const redeemGasWithPoints = useCallback(async () => {
    if (!walletAddress) {
      setToast("Connect your wallet to continue", "error");
      return;
    }
    if (!pointsConfig?.redeem_gas_enabled || pointsBalance < 1) {
      setToast("No Hey Points available for gas", "error");
      return;
    }

    const points = Math.min(pointsBalance, 50);
    setRedeemingGas(true);
    try {
      const result = await redeemHeyPointsForGas({ walletAddress, points });
      setPointsBalance(result.balance);
      setToast(
        `${formatPointsLabel(result.points_used)} redeemed for ~${result.gas_lamports_est.toLocaleString()} lamports gas credit`,
        "success"
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Gas redemption failed", "error");
    } finally {
      setRedeemingGas(false);
    }
  }, [pointsBalance, pointsConfig, setToast, walletAddress]);

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

    const firstWithPhone = data.find((contact) => contact.phoneNumbers?.[0]?.number);
    const raw = firstWithPhone?.phoneNumbers?.[0]?.number;
    if (!raw) {
      setToast("No contacts with phone numbers found", "error");
      return;
    }
    setPhoneNumber(normalizeAirbillsPhoneNumber(raw));
  }, [setToast, user?.mobileNumber]);

  const pointsEnabled = !!pointsConfig?.enabled;
  const showPointsCheckout =
    pointsEnabled &&
    pointsConfig?.redeem_airtime_enabled &&
    pointsBalance > 0 &&
    checkoutAmount >= MIN_AIRTIME;

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
            Airtime
          </CText>
        </View>
        <View className="items-end gap-y-1">
          {pointsEnabled && (
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

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-accent">
          <Image
            source={require("@/assets/apps/airbillsbg.jpeg")}
            style={{ width: "100%", height: 112 }}
            contentFit="cover"
          />
          <View className="px-4 py-3">
            <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
              Top up airtime anytime
            </CText>
            {pointsEnabled && pointsConfig?.cashback_enabled && (
              <CText className="mt-1 text-[0.82rem] text-black/60 dark:text-grey/70">
                Earn Hey Points on airtime and data purchases. Redeem for airtime or gas fees only.
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

        <View className="mt-5 rounded-2xl bg-white p-4 shadow-sm dark:bg-accent">
          <CText
            style={{ fontFamily: "bold" }}
            className="mb-3 text-[1rem] text-black dark:text-white"
          >
            Top up
          </CText>

          <View className="flex-row flex-wrap" style={{ gap: QUICK_AMOUNT_GAP }}>
            {quickOptions.map((option) => {
              const active = selectedAmount === option.amount && !customAmount.trim();
              return (
                <AirtimeQuickAmountTile
                  key={option.amount}
                  option={option}
                  width={cardWidth}
                  active={active}
                  disabled={purchasing}
                  onPress={() => {
                    setSelectedAmount(option.amount);
                    setCustomAmount("");
                    void purchaseAirtime(option.amount);
                  }}
                />
              );
            })}
          </View>

          {showPointsCheckout && (
            <View className="mt-4 rounded-2xl border border-purple/20 bg-purple/5 px-3 py-3 dark:border-purple/30 dark:bg-purple/10">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <CText style={{ fontFamily: "bold" }} className="text-[0.92rem]">
                    Use Hey Points
                  </CText>
                  <CText className="mt-1 text-[0.78rem] text-black/60 dark:text-grey/70">
                    {checkoutAmount >= MIN_AIRTIME
                      ? `Apply up to ${formatPointsLabel(maxApplicablePoints)} on this purchase`
                      : "Select an amount first"}
                  </CText>
                </View>
                <Switch
                  value={usePoints}
                  onValueChange={setUsePoints}
                  trackColor={{ false: "#D1D5DB", true: "#971BB2" }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {usePoints && maxApplicablePoints > 0 && (
                <CText className="mt-2 text-[0.8rem] text-purple">
                  {formatPointsLabel(pointsToUse)} off ·{" "}
                  {pointsConfig?.treasury_checkout_enabled
                    ? `${formatNaira(checkoutAmount)} airtime (you pay ${formatNaira(Math.max(0, checkoutAmount - pointsToUse))} USDC)`
                    : `${formatNaira(Math.max(MIN_AIRTIME, checkoutAmount - pointsToUse))} airtime (USDC amount set by Airbills FX)`}
                </CText>
              )}
            </View>
          )}

          <View className="mt-4 flex-row items-center gap-x-2">
            <TextInput
              className="h-[48px] flex-1 rounded-full border border-grey bg-grey/40 px-4 text-[1rem] text-black dark:border-accent2 dark:bg-black/30 dark:text-grey"
              value={customAmount}
              onChangeText={(text) => {
                setCustomAmount(text.replace(/[^\d]/g, ""));
                setSelectedAmount(null);
              }}
              placeholder={`₦ ${MIN_AIRTIME.toLocaleString()}–${MAX_AIRTIME.toLocaleString()}`}
              placeholderTextColor={mutedIcon}
              keyboardType="number-pad"
            />
            <Buttons
              type="primary"
              className="h-[48px] min-w-[96px] rounded-full px-6 py-3"
              text={purchasing ? "..." : "Pay"}
              onPress={() => void purchaseAirtime(resolveAmount())}
            />
          </View>

          {pointsEnabled && pointsConfig?.redeem_gas_enabled && pointsBalance > 0 && (
            <Pressable
              disabled={redeemingGas}
              onPress={() => void redeemGasWithPoints()}
              className="mt-3 flex-row items-center justify-center rounded-2xl border border-grey px-3 py-3 dark:border-accent2"
            >
              <Ionicons name="flash-outline" size={16} color="#971BB2" />
              <CText className="ml-2 text-[0.85rem] text-purple">
                {redeemingGas
                  ? "Redeeming..."
                  : `Redeem ${formatPointsLabel(Math.min(pointsBalance, 50))} for gas`}
              </CText>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {purchasing && (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator color="#971BB2" size="large" />
        </View>
      )}

      <NetworkPickerSheet
        open={networkPickerOpen}
        networkId={networkId}
        onClose={() => setNetworkPickerOpen(false)}
        onSelect={setNetworkId}
      />
    </View>
  );
}
