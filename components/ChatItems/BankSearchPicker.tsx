import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useAi } from "@/context/AiContext";
import type { BankSearchPickRow } from "@/utils/store/conversation.store";
import { CText } from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type Props = {
  query: string;
  hits: BankSearchPickRow[];
  amount: number;
  token: string;
  accountNumber: string;
  fiatAmount?: number;
};

/**
 * Horizontal bank cards for pajit-offramp — same pattern as token / data-plan pickers.
 * User taps Select; we send a chat message with bank_id so the tool can confirm the account.
 */
export default function BankSearchPicker({
  query,
  hits,
  amount,
  token,
  accountNumber,
  fiatAmount,
}: Props) {
  const { sendChatMessage } = useAi();

  const onPick = (row: BankSearchPickRow) => {
    const amountPart =
      fiatAmount != null && fiatAmount > 0
        ? `${amount} ${token} (about ₦${fiatAmount})`
        : `${amount} ${token}`;
    sendChatMessage(
      `I select this bank for my ${amountPart} offramp to account ${accountNumber}: ${row.name} (bank_id: ${row.id})`
    );
  };

  return (
    <View className="mt-3 w-full rounded-xl border border-[#971BB2]/25 dark:border-white/15 bg-grey/40 dark:bg-accent/50 overflow-hidden">
      <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
        <CText
          style={{ fontFamily: "bold" }}
          className="text-[15px] text-dark dark:text-white"
        >
          Choose a bank
        </CText>
        <CText className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
          Swipe for more · “{query}” · {hits.length} match
          {hits.length === 1 ? "" : "es"}
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
        {hits.map((row) => (
          <View
            key={row.id}
            className="flex flex-col items-stretch justify-start bg-white dark:bg-accent shadow-lg p-2 w-[180px] rounded-xl"
          >
            <View className="w-full h-[88px] rounded-lg overflow-hidden bg-purple/10 items-center justify-center">
              {row.logo ? (
                <Image
                  source={{ uri: row.logo }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              ) : (
                <MaterialCommunityIcons name="bank" size={36} color="#971BB2" />
              )}
            </View>

            <View className="mt-2 gap-y-1 flex-1">
              <CText
                numberOfLines={2}
                className="text-[13px]"
                style={{ fontFamily: "bold" }}
              >
                {row.name}
              </CText>
              {!!row.code && (
                <CText className="text-[10px] text-gray-600 dark:text-gray-400">
                  Code {row.code}
                </CText>
              )}
            </View>

            <View className="mt-2">
              <Buttons text="Select" onPress={() => onPick(row)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
