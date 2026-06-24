import { ScrollView, View } from "react-native";
import { useAi } from "@/context/AiContext";
import type { DataPlanPickerRow } from "@/utils/store/conversation.store";
import { CText } from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import {
  AirbillsDataPlanCardBanner,
  formatNaira,
} from "@/components/Airbills/shared";
import {
  CHAT_DATA_PLAN_CATEGORIES,
  type DataPlanCategory,
} from "@/libs/tools/airbills/dataPlanDisplay";

type Props = {
  phoneNumber: string;
  networkName: string;
  stage: "category" | "plans";
  category?: DataPlanCategory;
  plans: DataPlanPickerRow[];
};

export default function DataPlanPicker({
  phoneNumber,
  networkName,
  stage,
  category,
  plans,
}: Props) {
  const { sendChatMessage } = useAi();

  const onPickCategory = (id: DataPlanCategory, label: string) => {
    sendChatMessage(
      `I want a ${label.toLowerCase()} data plan for ${phoneNumber} on ${networkName}.`
    );
  };

  const onPickPlan = (plan: DataPlanPickerRow) => {
    sendChatMessage(
      `Buy this ${networkName} data plan for ${phoneNumber}: ${plan.prodName} (prodId: ${plan.prodId}, amount: ${plan.prodAmount}).`
    );
  };

  if (stage === "category") {
    return (
      <View className="mt-3 w-full rounded-xl border border-[#971BB2]/25 dark:border-white/15 bg-grey/40 dark:bg-accent/50 overflow-hidden">
        <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
          <CText
            style={{ fontFamily: "bold" }}
            className="text-[15px] text-dark dark:text-white"
          >
            Choose a plan type
          </CText>
          <CText className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
            {networkName} · {phoneNumber}
          </CText>
        </View>
        <View className="flex-row flex-wrap gap-2 p-3">
          {CHAT_DATA_PLAN_CATEGORIES.map((item) => (
            <View key={item.id} className="min-w-[46%] flex-1">
              <Buttons
                text={item.label}
                compact
                onPress={() => onPickCategory(item.id, item.label)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const categoryLabel =
    CHAT_DATA_PLAN_CATEGORIES.find((item) => item.id === category)?.label ??
    "Data";

  return (
    <View className="mt-3 w-full rounded-xl border border-[#971BB2]/25 dark:border-white/15 bg-grey/40 dark:bg-accent/50 overflow-hidden">
      <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
        <CText
          style={{ fontFamily: "bold" }}
          className="text-[15px] text-dark dark:text-white"
        >
          {categoryLabel} plans
        </CText>
        <CText className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
          Swipe for more · {networkName} · {plans.length} plan
          {plans.length === 1 ? "" : "s"}
        </CText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 10,
          paddingRight: 28,
        }}
      >
        {plans.map((plan) => (
          <View
            key={plan.prodId}
            className="flex flex-col items-stretch justify-between bg-white dark:bg-accent shadow-lg w-[168px] rounded-2xl overflow-hidden"
          >
            <AirbillsDataPlanCardBanner />
            <View className="min-h-[92px] items-center justify-center px-2 py-1.5">
              <CText
                numberOfLines={1}
                className="w-full text-center text-[1.1rem]"
                style={{ fontFamily: "bold" }}
              >
                {plan.sizeLabel}
              </CText>
              {!!plan.validityLabel && (
                <CText className="mt-0.5 w-full text-center text-[0.78rem] text-black/55 dark:text-grey/60">
                  {plan.validityLabel}
                </CText>
              )}
              <CText
                className="mt-1.5 w-full text-center text-[0.95rem]"
                style={{ fontFamily: "bold" }}
              >
                {formatNaira(plan.prodAmount)}
              </CText>
            </View>
            {!!plan.footerLabel && (
              <View className="items-center justify-center bg-purple/10 px-2 py-1">
                <CText
                  className="text-center text-[0.68rem] text-purple"
                  numberOfLines={2}
                >
                  {plan.footerLabel}
                </CText>
              </View>
            )}
            <View className="px-2 pb-2 pt-1">
              <Buttons compact text="Select" onPress={() => onPickPlan(plan)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
