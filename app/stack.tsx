import React from "react";
import ConfirmActionSheetGlobal from "@/components/Sheets/ConfirmationSheetGlobal";
import CText from "@/components/TextComp";
import { useThemeContext } from "@/misc/context/ThemeContext";
import IconLibrary from "@/misc/helpers/icons";
import AppSettings from "@/misc/store/settingsstore";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { View } from "react-native";


export default function StackView() {

    const { isDarkMode } = useThemeContext();
    const { isLoading, toast } = AppSettings();

    const LoadingScreen = () => (
        <View className='h-full absolute w-full z-50 bg-white/55 dark:bg-black/55 flex justify-center items-center '>
            <Image source={require('@/assets/images/splaash.gif')} alt="Security image" style={{ height: 70, width: 70 }} contentFit="contain" />
        </View>
    );

    // const ToastModal = ({ type, message }: { type: "success" | "error" | "info"; message: string }) => {
    //     const bgClass =
    //         type === "success"
    //             ? "bg-green-400/15 border border-green-400"
    //             : type === "error"
    //                 ? "bg-red-600/15 border border-red-600"
    //                 : "bg-orange-400/15 border border-orange-400";

    //     const textClass =
    //         type === "success"
    //             ? "text-green-600"
    //             : type === "error"
    //                 ? "text-red-600"
    //                 : "text-orange-600";
    //     return (
    //         <View className="absolute top-0 px-4  bg-grey dark:bg-dark py-5 w-full flex items-center rounded-xl">
    //             <View className={`p-3 rounded-xl flex-wrap ${bgClass} w-full flex flex-row items-center`}>
    //                 {type === "success" && <IconLibrary.check color="green" />}
    //                 {type === "error" && <IconLibrary.error color="red" />}
    //                 {type === "info" && <IconLibrary.info color="orange" />}
    //                 <CText className={`ml-2 ${textClass} text-[18px] w-fit`} style={{ fontFamily: 'bold' }}>{message}</CText>
    //             </View>
    //         </View>
    //     );
    // };


    const ToastModal = ({ type, message }: { type: "success" | "error" | "info"; message: string }) => {
        const bgClass =
            type === "success"
                ? "bg-green-100 dark:bg-green-900 border border-green-500"
                : type === "error"
                    ? "bg-red-100 dark:bg-red-900 border border-red-500"
                    : "bg-yellow-100 dark:bg-yellow-900 border border-yellow-500";

    
                    const textColor =
            type === "success"
                ? "text-green-700 dark:text-green-300"
                : type === "error"
                    ? "text-red-700 dark:text-red-300"
                    : "text-yellow-700 dark:text-yellow-300";
    
        const iconColor =
            type === "success"
                ? "green"
                : type === "error"
                    ? "red"
                    : "orange";

        return (
            <View
                className={`absolute top-5 left-4 right-4 rounded-2xl bg-white/50 px-4 py-5 shadow-md z-50`}
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 5,
                }}
            >
                <View className="flex-row items-center">
                    {type === "success" && <IconLibrary.check color={iconColor} size={20} />}
                    {type === "error" && <IconLibrary.error color={iconColor} size={20} />}
                    {type === "info" && <IconLibrary.info color={iconColor} size={20} />}

                    <CText className={`ml-3`} textColor={textColor} style={{ fontFamily: 'bold', flex: 1 }}>
                        {message}
                    </CText>
                </View>
            </View>
        );
    };
    return (
        <>
            <Stack
                screenOptions={{
                    headerShown: false,
                    statusBarStyle: isDarkMode ? 'light' : 'dark',
                    statusBarBackgroundColor: isDarkMode ? '#0C0C0C' : "#f3f3f3",
                }}
            >

            </Stack>
            {toast.show && <ToastModal type={toast.type} message={toast.message} />}
            {isLoading && <LoadingScreen />}
            <ConfirmActionSheetGlobal />
        </>

    );
}

