import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";


/**
  * What should be done here
  * Show token info
  * Show charts
  */
function TokenSummary() {

    const { mint } = useLocalSearchParams();

    useEffect(() => {

    }, [mint])


    return (
        <View
            className="relative w-full bg-grey dark:bg-dark flex-1 items-center"
        >
            <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
                <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
                    <IconLibrary.back />
                </Pressable>
                <CText className="text-[1.4rem]">Token</CText>
            </View>

        </View>
    );
}

export default TokenSummary

