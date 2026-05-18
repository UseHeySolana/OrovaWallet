import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import AppSettings from "@/utils/store/settingsstore.store";
import ButtonComp from "@/components/ButtonComp";

export default function SwapSuccess() {
  const { txid, fromSymbol, toSymbol, fromAmount, toAmount } =
    useLocalSearchParams<{
      txid?: string;
      fromSymbol?: string;
      toSymbol?: string;
      fromAmount?: string;
      toAmount?: string;
    }>();

  const openExplorer = () => {
    if (txid) {
      const network = AppSettings.getState().networkShort;
      Linking.openURL(
        `https://explorer.solana.com/tx/${txid}?cluster=${network}`
      );
    }
  };

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 py-4">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5 mb-6">
        <Pressable
          onPress={() => router.replace("/dashboard")}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Swap complete</CText>
      </View>

      <View className="px-4 flex-1">
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-4">
            <IconLibrary.check size={48} color="white" />
          </View>
          <CText
            className="text-[24px] text-center"
            style={{ fontFamily: "bold" }}
          >
            Swap successful
          </CText>
          <CText className="text-[16px] text-center text-gray-600 dark:text-gray-300 mt-2 px-4">
            Swapped {fromAmount} {fromSymbol} for about {toAmount} {toSymbol}
          </CText>
        </View>

        {txid ? (
          <Pressable
            onPress={openExplorer}
            className="bg-white dark:bg-accent rounded-xl p-4 mb-6"
          >
            <CText className="text-[12px] text-gray-500 dark:text-gray-400 mb-1">
              Transaction
            </CText>
            <CText
              className="text-[13px] font-mono"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {txid}
            </CText>
            <CText className="text-purple text-[14px] mt-2">
              View on Explorer →
            </CText>
          </Pressable>
        ) : null}

        <View className="mt-auto pb-6 gap-y-3">
          <ButtonComp text="Back to wallet" onPress={() => router.replace("/dashboard")} />
        </View>
      </View>
    </View>
  );
}
