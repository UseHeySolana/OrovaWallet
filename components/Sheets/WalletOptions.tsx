import { KeyboardAvoidingView, Pressable, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { useThemeContext } from "@/misc/context/ThemeContext";

import { router } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Image } from "expo-image";
import IconLibrary from "@/misc/helpers/icons";

interface WalletSheetTypes {
    open: boolean;
}
const WalletSheet = ({ open }: WalletSheetTypes) => {
    const { isDarkMode } = useThemeContext();
    if (!open) return null;

    return (
        <DragableSheet
            snapPoints={["55%"]}
            child={
                <View className="w-full  gap-y-5 flex flex-col justify-between ">
                    <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Wallet</CText>
                    <View className="flex w-100 justify-center items-center py-">
                        <Image style={{ height: 185, width: 300 }} source={require('@/assets/items/wallet.png')} alt="Wallet" contentFit="contain" />
                    </View>

                    <Pressable onPress={() => {
                        router.push('/auth/secretphrase')
                    }} >
                        <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent2 py-5 rounded-full   gap-x-3">
                            <View className="">
                                <IconLibrary.pluscircle />
                            </View>

                            <View className="">
                                <CText style={{ fontFamily: "bold" }} className="text-primary text-[16px] font-dmBold text-start">Create new Wallet</CText>
                                <CText className="text-primary text-[14px]  text-start">Create a new Solana Wallet</CText>

                            </View>
                        </View>

                    </Pressable>
                    <Pressable onPress={() => router.replace('/auth/importphrase')} >
                        <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent2 py-5 rounded-full   gap-x-3">
                            <View className="bg-white dark:bg-accent rounded-full p-1">
                                <IconLibrary.arrowdown />
                            </View>

                            <View className="">
                                <CText style={{ fontFamily: "bold" }} className="text-primary text-[16px] font-dmBold text-start">Import existing wallet</CText>
                                <CText className="text-primary text-[14px]  text-start">Import a previously existing wallet</CText>

                            </View>
                        </View>

                    </Pressable>
                </View>
            }
        />
    )
}

export default WalletSheet;