import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import { scale } from 'react-native-size-matters';
import { router } from "expo-router";
import IconLibrary from "@/utils/icons";
import Convo, { ConversationType } from "@/utils/store/conversation.store";
import { confirm } from "@/services/confirmation";
import { useThemeContext } from "@/context/ThemeContext";


const ConversationItem = ({ conversation }: { conversation: ConversationType }) => {
  const { deleteConversation } = Convo()

  const date = new Date(Number(conversation.id));

  const handleDeleteConversation = async (conversation: string) => {
    const response = await confirm({ message: "Are you sure you want to delete this conversation?", subtitle: "This action cannot be undone" })
    if (response) {
      deleteConversation(conversation)
    }
  }

  return (
    <TouchableOpacity
      onPress={() => router.push({
        pathname: '/dashboard',
        params: { convoId: conversation?.id },
      })}
     className="flex flex-row justify-between items-center border-b border-grey dark:border-dark rounded-xl py-3">
      <View className="flex-1 flex-col justify-start items-start gap-y-1">
        <CText numberOfLines={1} ellipsizeMode="tail">
          {conversation?.summary}
        </CText>
        <CText>{date.toLocaleString()}</CText>
      </View>

      <Pressable className=" p-2 rounded-full" onPress={() => handleDeleteConversation(conversation?.id)}>
        <IconLibrary.delete />
      </Pressable>
    </TouchableOpacity>
  )
}

export default function Chat() {
  const { conversations, deleteConversation, getConversationMessages, deleteAllConversations } = Convo()
  const { isDarkMode } = useThemeContext()

  const clearAll = async () => {
    const response = await confirm({ message: "Are you sure you want to clear all conversations?", subtitle: "This action cannot be undone" })
    if (response) {
      deleteAllConversations()
    }
  }
  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark  w-100 flex-1 items-start justify-start gap-y-4">
      <View className="w-full gap-y-4">

        <View className="w-full  flex flex-row justify-start items-center gap-x-2">
          <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
            <IconLibrary.back />
          </Pressable>
          <View className="flex flex-1 flex-row justify-between items-center gap-x-2">

            <CText style={{ fontFamily: "md" }} className="text-[1.rem] text-start text-wrap">Conversations</CText>
            {conversations.length > 0 &&
              <TouchableOpacity onPress={() => clearAll()} className="flex flex-row justify-center items-center  py-2 px-2 rounded-full bg-red-500">
                <IconLibrary.delete color={"white"}  />
                <CText textColor={"text-white"}>Clear All</CText>
              </TouchableOpacity>
            }
          </View>

        </View>

        <View
          style={{
            width: scale(320),
            padding: scale(10),
          }}
          className="flex bg-white shadow rounded-xl dark:bg-accent h-fit m-auto flex-row justify-center items-center ">

          <FlatList
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            contentContainerStyle={{
              gap: scale(10),
            }}
            ListEmptyComponent={
              <View className="flex flex-row justify-center items-center">
                <CText>No conversations found, start a new conversation</CText>
              </View>
            }

            data={conversations.sort((a, b) => Number(b.id) - Number(a.id))} renderItem={({ item }) => <ConversationItem conversation={item} />} />


        </View>








      </View>




    </View>
  );
}
