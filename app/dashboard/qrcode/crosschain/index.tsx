import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import DextopusCrossChainDeposit from "@/components/DextopusCrossChainDeposit";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import { DEXTOPUS_SOLANA_CHAIN_ID } from "@/services/dextopusApi";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CrossChainReceivePage() {
  const params = useLocalSearchParams<{
    chainId?: string | string[];
    chainName?: string | string[];
    originAsset?: string | string[];
    originSymbol?: string | string[];
    settlementAsset?: string | string[];
    settlementSymbol?: string | string[];
  }>();

  const chainId = Number(firstParam(params.chainId));
  const originAsset = firstParam(params.originAsset);
  const originSymbol = firstParam(params.originSymbol);
  const settlementAsset = firstParam(params.settlementAsset);
  const settlementSymbol = firstParam(params.settlementSymbol);

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1">
      <View className="w-full px-4 pt-4 pb-3 flex flex-row justify-start items-center gap-x-4">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
          Receive crypto
        </CText>
      </View>

      <View className="flex-1 px-4">
        <CText className="text-[0.95rem] text-gray-500 dark:text-gray-400 mb-4">
          Choose where the sender will send from and where you want the funds to settle.
        </CText>

        <DextopusCrossChainDeposit
          initialChainId={Number.isFinite(chainId) ? chainId : undefined}
          initialOriginAsset={originAsset}
          initialOriginSymbol={originSymbol}
          initialSettlementChainId={DEXTOPUS_SOLANA_CHAIN_ID}
          initialSettlementAsset={settlementAsset}
          initialSettlementSymbol={settlementSymbol}
          hideSavedList
        />
      </View>
    </View>
  );
}
