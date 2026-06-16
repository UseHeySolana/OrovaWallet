import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import DextopusCrossChainDeposit from "@/components/DextopusCrossChainDeposit";
import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";

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
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark w-full flex-1 items-start justify-start gap-y-4">
      <View className="w-full flex flex-row justify-start">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
      </View>

      <View className="w-full">
        <CText style={{ fontFamily: "bold" }} className="text-[1.35rem]">
          Receive from another network
        </CText>
        <CText className="text-[0.95rem] text-gray-500 dark:text-gray-400 mt-1">
          Tell us what the sender will use. We will show the right deposit address for your HeySolana wallet.
        </CText>
      </View>

      <DextopusCrossChainDeposit
        initialChainId={Number.isFinite(chainId) ? chainId : undefined}
        initialOriginAsset={originAsset}
        initialOriginSymbol={originSymbol}
        initialSettlementAsset={settlementAsset}
        initialSettlementSymbol={settlementSymbol}
        hideSavedList
      />
    </View>
  );
}
