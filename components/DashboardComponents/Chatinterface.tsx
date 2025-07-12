import React, { useRef, useState } from "react";
import { useThemeContext } from "@/misc/context/ThemeContext";
import LottieView from "lottie-react-native";

import { Platform, ScrollView, TextInput, View } from "react-native";
import ToolItem from "../ChatItems/ToolItem";
import ChatBox from "../ChatItems/ChatBox";
import AppSettings from "@/misc/store/settingsstore";
import { useAi } from "@/misc/context/AiContext";
import { MessageType } from "@/misc/store/conversation";
import { BlurView } from "expo-blur";

const colors = {
  loading: {
    color1: "#971BB2", // main purple
    color2: "#D98BEA", // lighter purple for shimmer effect
  },
  aispeaking: {
    color1: "#4B00E0", // electric violet
    color2: "#00F0FF", // neon cyan
  },
  human: {
    color1: "#1BB296", // teal (fresh, natural contrast to purple)
    color2: "#A3F3E4", // minty highlight for friendliness
  },
};

interface ChatInterfaceProps {
  messages: MessageType[];
}

export default function ChatInterface({ messages }: ChatInterfaceProps) {
  const { isDarkMode } = useThemeContext();
  const { network, setLoading, aiName, refresher, pin, pinReminder } =
    AppSettings();
  const animation = useRef<LottieView>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const {
    connection,
    sessionManager,
    isSessionActive,
    startSession,
    stopSession,
    currentMode,
    conversationId,
  } = useAi();

  return (
    <View className="flex-1 justify-start py-2  overflow-hidden  rounded-3xl">
      {messages.length > 0 && (
        <View className="h-[44rem] z-50">
          <ScrollView
            ref={scrollViewRef}
            className=" py-2 relative h-[40rem] gap-y-4"
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((item: any, index: number) => {
              const isSystem = item.role === "system";
              const toolCall = item.role === "tool";

              return (
                <View key={index + item.id} className="mb-3 relative">
                  {toolCall ? (
                    <>
                      <ToolItem
                        item={item}
                        isSystem={isSystem}
                        aiName={aiName}
                      />
                    </>
                  ) : (
                    <ChatBox item={item} isSystem={isSystem} aiName={aiName} />
                    // <View
                    //   className={`w-full flex-col gap-y-2 mb-2 ${isSystem ? "justify-start" : "justify-end"}`}
                    // >
                    //   <View className="flex flex-row items-center gap-x-2 ">
                    //     <Image
                    //       source={require('@/assets/images/ai.png')}
                    //       style={{ width: 30, height: 30 }}
                    //       contentFit="contain"
                    //       className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                    //     />
                    //     <CText className="text-[12px]" style={{ fontFamily: "bold" }}>
                    //       {isSystem ? aiName : `@${user?.username}`}
                    //     </CText>
                    //   </View>
                    //   <View
                    //     className={`bg-white dark:bg-black p-2 rounded-b-xl rounded-tr-xl dark:border border-accent2 w-[70%] gap-y-2 ${isSystem ? "ml-2" : "mr-2"}`}
                    //   >
                    //     <View className="bg-grey dark:bg-accent p-2 rounded-lg">
                    //       <CText className="text-[12px]">{item.content}</CText>
                    //     </View>
                    //   </View>
                    // </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View className="flex-1 h-full w-full absolute bottom-0 z-1">
        {Platform.OS === "ios" ? (
          <>
            {/* <Text style={styles.text}>{text}</Text> */}
            <LottieView
              autoPlay={true}
              loop
              speed={10}
              ref={animation}
              style={{
                position: "absolute",
                bottom: -10,
                // zIndex: 1,
                width: 1000,
                height: 500,
              }}
              resizeMode="cover"
              colorFilters={[
                {
                  keypath: "Shape Layer 2",
                  color: colors[currentMode].color1,
                },
                {
                  keypath: "Shape Layer 1",
                  color: colors[currentMode].color2,
                },
              ]}
              source={require("@/assets/anim/lower.json")}
            />
            <BlurView
              intensity={50}
              style={{
                flex: 1,
                justifyContent: "center",
                width: "100%",
                height: "100%",
              }}
            ></BlurView>
          </>
        ) : (
          <LottieView
            autoPlay={true}
            loop
            speed={10}
            ref={animation}
            style={{
              position: "absolute",
              bottom: -10,
              // zIndex: 1,
              width: 1000,
              height: 500,
            }}
            resizeMode="cover"
            colorFilters={[
              {
                keypath: "Shape Layer 2",
                color: colors[currentMode].color1,
              },
              {
                keypath: "Shape Layer 1",
                color: colors[currentMode].color2,
              },
            ]}
            source={require("@/assets/anim/lower.json")}
          />
        )}
      </View>
    </View>
  );
}
