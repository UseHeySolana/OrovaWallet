import { FlatList, Pressable, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import { scale } from "@/utils/layout/scale";
import { isTablet } from "@/utils/layout/tablet";
import { router } from "expo-router";
import IconLibrary from "@/utils/icons";
import Convo, { ConversationType } from "@/utils/store/conversation.store";
import { confirm } from "@/services/confirmation";

const ConversationItem = ({ conversation }: { conversation: ConversationType }) => {
  const { deleteConversation } = Convo();

  const date = new Date(Number(conversation.id));

  const handleDeleteConversation = async (conversationId: string) => {
    const response = await confirm({
      message: "Are you sure you want to delete this conversation?",
      subtitle: "This action cannot be undone",
    });
    if (response) {
      deleteConversation(conversationId);
    }
  };

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/dashboard",
          params: { convoId: conversation?.id },
        })
      }
      className="flex flex-row justify-between items-center border-b border-grey dark:border-dark rounded-xl py-3"
    >
      <View className="flex-1 flex-col justify-start items-start gap-y-1 pr-3">
        <CText numberOfLines={1} ellipsizeMode="tail">
          {conversation?.summary}
        </CText>
        <CText className="opacity-60">
          {date.toLocaleString()} · Tap to continue
        </CText>
      </View>

      <Pressable
        className="p-2 rounded-full"
        onPress={() => handleDeleteConversation(conversation?.id)}
      >
        <IconLibrary.delete />
      </Pressable>
    </TouchableOpacity>
  );
};

export default function Chat() {
  const { conversations, deleteAllConversations } = Convo();
  const pad = isTablet();

  const clearAll = async () => {
    const response = await confirm({
      message: "Are you sure you want to clear all conversations?",
      subtitle: "This action cannot be undone",
    });
    if (response) {
      deleteAllConversations();
    }
  };

  return (
    <View className="relative pt-3 px-4 bg-grey dark:bg-dark w-full flex-1 items-center justify-start">
      <View
        className="w-full flex-1 gap-y-4"
        style={pad ? { maxWidth: 720 } : undefined}
      >
        <View className="w-full flex flex-row justify-start items-center gap-x-2">
          <Pressable
            onPress={() => router.back()}
            className="p-3 rounded-full bg-white dark:bg-accent"
          >
            <IconLibrary.back />
          </Pressable>
          <View className="flex flex-1 flex-row justify-between items-center gap-x-2">
            <CText
              style={{ fontFamily: "md" }}
              className="text-[1.rem] text-start text-wrap"
            >
              Conversations
            </CText>
            {conversations.length > 0 && (
              <TouchableOpacity
                onPress={() => clearAll()}
                className="flex flex-row justify-center items-center py-2 px-2 rounded-full bg-red-500"
              >
                <IconLibrary.delete color={"white"} />
                <CText textColor={"text-white"}>Clear All</CText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View
          style={{
            padding: scale(10),
            flex: 1,
            width: "100%",
          }}
          className="flex bg-white shadow rounded-xl dark:bg-accent flex-row justify-center items-stretch"
        >
          <FlatList
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={{
              gap: scale(10),
              flexGrow: 1,
            }}
            ListEmptyComponent={
              <View className="flex flex-1 flex-row justify-center items-center px-4">
                <CText className="text-center">
                  No conversations found, start a new conversation
                </CText>
              </View>
            }
            data={[...conversations].sort((a, b) => Number(b.id) - Number(a.id))}
            renderItem={({ item }) => (
              <ConversationItem conversation={item} />
            )}
          />
        </View>
      </View>
    </View>
  );
}
