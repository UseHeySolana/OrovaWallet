import { useThemeContext } from "@/context/ThemeContext";
import { Image } from "expo-image";
import React from 'react'
import { View } from "react-native";
import CText from "../TextComp";

interface ChatBoxProps {
    item: any
    isSystem: boolean
    aiName: string
    user: any
}
const ChatBox = (props: ChatBoxProps) => {
    const { item, isSystem, aiName, user } = props;
    const isUser = item.role === 'user';
    return (
        <View
            className={`w-full flex-col gap-y-2 mb-2 ${!isUser ? "justify-end" : "items-end"}`}
        >
            <View className={`flex flex-row items-center gap-x-2 ${isUser ? "mr-2" : "ml-2"}`}>
                {isSystem && (
                    <Image
                        source={require('@/assets/images/ai.png')}
                        style={{ width: 30, height: 30 }}
                        contentFit="contain"
                        className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                    />
                )}
                <CText className="text-[12px]" style={{ fontFamily: "bold" }}>
                    {isUser ? `@${user?.username}` : aiName}
                </CText>
                {isUser && (
                    <Image
                        source={require('@/assets/images/ai.png')}
                        style={{ width: 30, height: 30 }}
                        contentFit="contain"
                        className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                    />
                )}
            </View>
            <View
                className={`bg-white dark:bg-black p-2 rounded-b-xl ${isUser ? "rounded-tl-xl" : "rounded-tr-xl"} dark:border border-accent2 w-[70%] gap-y-2 ${isUser ? "mr-2" : "ml-2"}`}
            >
                <View className="bg-grey dark:bg-accent p-2 rounded-lg">
                    <CText className={`text-[12px] ${isUser ? "text-right" : "text-left"}`}>{item.content}</CText>
                </View>
            </View>
        </View>
    )
}

export default ChatBox
