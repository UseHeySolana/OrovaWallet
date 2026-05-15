import { Pressable, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import { CText } from "../TextComp";

import { router } from "expo-router";
import { Image } from "expo-image";
import IconLibrary from "@/utils/icons";
import UserItem from "@/utils/store/userstore.store";

interface WalletSheetTypes {
    open: boolean;
}
const WalletSheet = ({ open }: WalletSheetTypes) => {
    const { user } = UserItem();
    const isMpcAccount = user?.wallet_type === "mpc" && Boolean(user?.wallet_address);
    if (!open) return null;

    return (
        <DragableSheet
            snapPoints={["70%"]}
            child={
                <View className="w-full h-fit gap-y-5 flex-1 flex-col justify-between ">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.1rem] text-center">Wallet</CText>
                    <View className="flex  m-auto justify-center items-center py-2">
                        <Image style={{ height: 185, width: 300 }} source={require('@/assets/items/wallet.png')} alt="Wallet" contentFit="contain" />
                    </View>
                    <View className="py-4 gap-y-4">
                        <Pressable onPress={() => {
                            if (isMpcAccount) {
                                router.push('/auth/mpc-link');
                                return;
                            }
                            router.push('/auth/passkey-wallet');
                        }} >
                            <View className="flex flex-row justify-start items-center px-5 bg-violet-100 dark:bg-violet-950 border border-violet-300 dark:border-violet-800 py-3 rounded-full gap-x-3">
                                <View className="">
                                    <IconLibrary.security />
                                </View>
                                <View className="">
                                    <CText style={{ fontFamily: "bold" }} className="text-primary text-[1.1rem] text-start">
                                        {isMpcAccount ? "Restore seedless wallet" : "Seedless wallet"}
                                    </CText>
                                    <CText className="text-primary text-[1rem] text-start">
                                        {isMpcAccount
                                            ? "Face ID / fingerprint — same address"
                                            : "No seed phrase — Face ID / fingerprint"}
                                    </CText>
                                </View>
                            </View>
                        </Pressable>
                        <Pressable onPress={() => {
                            router.push('/auth/secretphrase')
                        }} >
                            <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent2 py-3 rounded-full gap-x-3">
                                <View className="">
                                    <IconLibrary.pluscircle />
                                </View>

                                <View className="">
                                    <CText style={{ fontFamily: "bold" }} className="text-primary text-[1.1rem] font-dmBold text-start">Recovery phrase wallet</CText>
                                    <CText className="text-primary text-[1rem]  text-start">Classic 12-word backup</CText>

                                </View>
                            </View>

                        </Pressable>
                        <Pressable onPress={() => router.replace('/auth/importphrase')} >
                            <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent2 py-3 rounded-full   gap-x-3">
                                <View className="bg-white dark:bg-accent rounded-full p-1">
                                    <IconLibrary.arrowdown />
                                </View>

                                <View className="">
                                    <CText style={{ fontFamily: "bold" }} className="text-primary text-[1.1rem] font-dmBold text-start">Import existing wallet</CText>
                                    <CText className="text-primary text-[1rem]  text-start">Import a previously existing wallet</CText>

                                </View>
                            </View>

                        </Pressable>
                    </View>
                </View>
            }
        />
    )
}

export default WalletSheet;