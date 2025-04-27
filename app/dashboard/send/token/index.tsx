import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import IconLibrary from "@/misc/helpers/icons";
import CText from "@/components/TextComp";
import UserItem from "@/misc/store/userstore";


/**
  * What should be done here
  * Send Token Info
  */
function SendToken() {

    const { mint } = useLocalSearchParams();
    const [token, setToken] = useState<any>(null);

    const { userWallet } = UserItem()

    useEffect(() => {
        if (mint) {
            const tokens = userWallet.tokenAccounts.filter((item: any) => item.mint === mint);
            setToken(tokens[0]);
        }
    }, [mint])


    return (
        <View
            className="relative w-full bg-grey dark:bg-dark flex-1 py-4 items-center"
        >
            <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
                <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
                    <IconLibrary.back />
                </Pressable>
                <CText className="text-[1.4rem]">Send {token?.name}</CText>
            </View>

            <View>

            </View>



        </View>
    );
}

export default SendToken

