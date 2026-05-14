import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useAi } from "@/context/AiContext";
import type { TokenSearchPickRow } from "@/utils/store/conversation.store";
import { CText } from "@/components/TextComp";

type Props = {
  query: string;
  hits: TokenSearchPickRow[];
  /** From swap_tokens / check_price when disambiguating one side of the pair. */
  swapLeg?: "from" | "to";
};

/**
 * Shown when Jupiter returns multiple matches (search, swap, or price).
 * Verified tokens are sorted first (see sortTokenSearchHitsForDisplay).
 */
export default function TokenSearchPicker({ query, hits, swapLeg }: Props) {
  const { sendChatMessage } = useAi();

  const onPick = (row: TokenSearchPickRow) => {
    if (swapLeg === "from") {
      sendChatMessage(
        `I select this token as the one I'm selling (fromToken) for "${query}": ${row.symbol} — mint ${row.mint}`
      );
      return;
    }
    if (swapLeg === "to") {
      sendChatMessage(
        `I select this token as the one I'm buying (toToken) for "${query}": ${row.symbol} — mint ${row.mint}`
      );
      return;
    }
    sendChatMessage(
      `I select this token for "${query}": ${row.symbol} — mint ${row.mint}`
    );
  };

  return (
    <View className="mt-3 w-full rounded-xl border border-[#971BB2]/25 dark:border-white/15 bg-grey/40 dark:bg-accent/50 overflow-hidden">
      <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
        <CText style={{ fontFamily: "bold" }} className="text-[15px] text-dark dark:text-white">
          Choose a token
        </CText>
        <CText className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
          Verified matches first · {hits.length} result{hits.length === 1 ? "" : "s"}
        </CText>
      </View>
      <ScrollView
        style={{ maxHeight: 280 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {hits.map((row) => (
          <Pressable
            key={row.mint}
            onPress={() => onPick(row)}
            className="flex-row items-center gap-3 px-3 py-3 border-b border-gray-200/80 dark:border-white/10 active:bg-[#971BB2]/10"
          >
            <Image
              source={{ uri: row.logo }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              contentFit="cover"
            />
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-2 flex-wrap">
                <CText style={{ fontFamily: "bold" }} className="text-[15px] text-dark dark:text-white">
                  {row.symbol}
                </CText>
                {row.isVerified ? (
                  <View className="px-2 py-0.5 rounded-full bg-emerald-500/20">
                    <CText className="text-[11px] text-emerald-700 dark:text-emerald-300" style={{ fontFamily: "md" }}>
                      Verified
                    </CText>
                  </View>
                ) : null}
              </View>
              <CText numberOfLines={1} className="text-[13px] text-gray-600 dark:text-gray-400">
                {row.name}
              </CText>
              <CText
                selectable
                numberOfLines={2}
                className="text-[11px] text-gray-500 dark:text-gray-500 mt-1"
              >
                {row.mint}
              </CText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
