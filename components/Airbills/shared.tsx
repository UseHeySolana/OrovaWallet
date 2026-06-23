import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";

export const AIRBILLS_NETWORKS = [
  { id: "01", label: "MTN", color: "#FFCC00", textColor: "#111111" },
  { id: "02", label: "Glo", color: "#50B848", textColor: "#FFFFFF" },
  { id: "03", label: "9mobile", color: "#006848", textColor: "#FFFFFF" },
  { id: "04", label: "Airtel", color: "#ED1C24", textColor: "#FFFFFF" },
] as const;

export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatNairaSpaced(amount: number) {
  return `₦ ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type QuickAirtimeOption = {
  amount: number;
  cashbackPoints: number;
};

export const DEFAULT_QUICK_AIRTIME_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export function buildQuickAirtimeOptions(
  amounts: number[] = DEFAULT_QUICK_AIRTIME_AMOUNTS,
  cashbackPercent = 10,
  minPurchaseNgn = 50,
  maxCashbackPoints = 500
): QuickAirtimeOption[] {
  return amounts.map((amount) => {
    let cashbackPoints = 0;
    if (amount >= minPurchaseNgn && cashbackPercent > 0) {
      cashbackPoints = Math.floor((amount * cashbackPercent) / 100);
      if (maxCashbackPoints > 0) {
        cashbackPoints = Math.min(cashbackPoints, maxCashbackPoints);
      }
    }
    return { amount, cashbackPoints };
  });
}

export function AirtimeQuickAmountTile({
  option,
  width,
  active,
  disabled,
  onPress,
}: {
  option: QuickAirtimeOption;
  width: number;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ width }}
      className={`overflow-hidden rounded-xl ${
        active ? "border-2 border-purple" : "border border-grey dark:border-accent2"
      }`}
    >
      {option.cashbackPoints > 0 && (
        <View className="items-center bg-purple px-1 py-1">
          <CText
            style={{ fontFamily: "bold", color: "#FFFFFF", fontSize: 10 }}
            numberOfLines={1}
          >
            +{option.cashbackPoints} pts
          </CText>
        </View>
      )}
      <View
        className={`items-center justify-center bg-grey/40 px-1 py-3 dark:bg-accent2 ${
          option.cashbackPoints > 0 ? "min-h-[78px]" : "min-h-[68px]"
        }`}
      >
        <CText
          style={{ fontFamily: "bold", fontSize: 17 }}
          className="text-center text-black dark:text-white"
        >
          {formatNairaSpaced(option.amount)}
        </CText>
      </View>
    </Pressable>
  );
}

export function NetworkBadge({
  networkId,
  size = 40,
}: {
  networkId: string;
  size?: number;
}) {
  const network = AIRBILLS_NETWORKS.find((item) => item.id === networkId);
  if (!network) {
    return (
      <View
        style={{ width: size, height: size }}
        className="items-center justify-center rounded-full bg-grey dark:bg-accent2"
      >
        <Ionicons name="cellular" size={size * 0.45} color="#971BB2" />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: network.color,
      }}
      className="items-center justify-center rounded-full"
    >
      <CText
        style={{
          fontFamily: "bold",
          color: network.textColor,
          fontSize: size * 0.22,
        }}
      >
        {network.label.slice(0, 4)}
      </CText>
    </View>
  );
}

export function NetworkPickerSheet({
  open,
  networkId,
  onClose,
  onSelect,
}: {
  open: boolean;
  networkId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  if (!open) return null;

  const selected =
    AIRBILLS_NETWORKS.find((item) => item.id === networkId) ||
    AIRBILLS_NETWORKS[0];

  return (
    <DragableSheet panClose close={onClose} snapPoints={["42%"]}>
      <View className="pb-6">
        <CText style={{ fontFamily: "bold" }} className="mb-4 text-[1.1rem]">
          Select network
        </CText>
        {AIRBILLS_NETWORKS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              onSelect(item.id);
              onClose();
            }}
            className="mb-2 flex-row items-center rounded-2xl bg-grey/40 px-4 py-3 dark:bg-accent2"
          >
            <NetworkBadge networkId={item.id} />
            <CText className="ml-3 flex-1 text-[1rem]">{item.label}</CText>
            {selected.id === item.id && (
              <Ionicons name="checkmark-circle" size={20} color="#971BB2" />
            )}
          </Pressable>
        ))}
      </View>
    </DragableSheet>
  );
}
