import { ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useAi } from "@/context/AiContext";
import type { TokenSearchPickRow } from "@/utils/store/conversation.store";
import { CText } from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import IconLibrary from "@/utils/icons";

type Props = {
  query: string;
  hits: TokenSearchPickRow[];
  /** From swap_tokens / check_price when disambiguating one side of the pair. */
  swapLeg?: "from" | "to";
};

function shortMint(mint: string) {
  if (mint.length <= 14) return mint;
  return `${mint.slice(0, 6)}…${mint.slice(-6)}`;
}

/**
 * Horizontal token cards (same layout idea as the Amazon product widget).
 * Verified tokens show a green check badge on the logo.
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
          Swipe for more · verified first · {hits.length} match{hits.length === 1 ? "" : "es"}
        </CText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingVertical: 10, paddingHorizontal: 10, paddingRight: 28 }}
      >
        {hits.map((row) => (
          <View
            key={row.mint}
            className="flex flex-col items-stretch justify-start bg-white dark:bg-accent shadow-lg p-2 w-[200px] rounded-xl"
          >
            <View className="w-full h-[100px] rounded-lg overflow-hidden bg-grey/30 dark:bg-accent2/50 relative">
              <Image
                source={{ uri: row.logo }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
              {row.isVerified ? (
                <View
                  className="absolute top-2 right-2 rounded-full bg-emerald-500 items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 3,
                  }}
                >
                  <IconLibrary.check color="#FFFFFF" size={16} />
                </View>
              ) : null}
            </View>

            <View className="mt-2 gap-y-1 flex-1">
              <CText
                numberOfLines={1}
                className="text-[13px]"
                style={{ fontFamily: "bold" }}
              >
                {row.symbol}
              </CText>
              <CText
                numberOfLines={2}
                className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight"
              >
                {row.name}
              </CText>
              <CText
                selectable
                numberOfLines={1}
                className="text-[9px] text-gray-500 dark:text-gray-500"
              >
                {shortMint(row.mint)}
              </CText>
              <CText className="text-[9px] text-gray-500 dark:text-gray-500">
                Decimals {row.decimals}
              </CText>
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
