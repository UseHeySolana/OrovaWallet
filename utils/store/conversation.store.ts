import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

export interface MessageType {
  role: "system" | "user" | "tool";
  content: string;
  timestamp: number;
  id: string;
  conversation_id: string;
  tool?: {
    owner?: string;
    action: string;
    link?: string;
    status: "pending" | "failed" | "complete";
    arguments?: any;
  };
  product?: {
    name: string;
    asin: string;
    price: number;
    currency: string;
    image: string;
    link: string;
    rating: number;
  }[];
  product_details?: any;
  source: string;
}

export interface ConversationType {
  id: string;
  summary: string;
}

type ToolType = NonNullable<MessageType["tool"]>;

interface Conversation {
  conversations: ConversationType[];
  createConversation: (conversation: ConversationType) => void;
  deleteConversation: (conversation: string) => void;
  clearAll: () => void;
  messages: MessageType[];
  setMessages: (messages: MessageType) => void;
  updateMessage: ({
    messageId,
    toolUpdates,
    content,
    productUpdates,
    source,
  }: {
    messageId: string;
    toolUpdates?: Partial<ToolType>;
    content?: Partial<MessageType>;
    productUpdates?: Partial<MessageType["product"]>;
    source: string;
  }) => void;
  getConversationMessages: (conversation: string) => MessageType[] | null;
  updateConversation: (conversationId: string, summary: string) => void;
  deleteAllConversations: () => void;
  updateProductDetails: (messageId: string, productDetails: any) => void;
}

const Convo = create(
  persist<Conversation>(
    (set, get) => ({
      deleteAllConversations: () => {
        set({ conversations: [] });
      },
      conversations: [],
      createConversation: (conversation: ConversationType) =>
        set({ conversations: [...get().conversations, conversation] }),
      messages: [],
      clearAll: () => {
        set({ messages: [] });
        set({ conversations: [] });
      },
      deleteConversation: (conversation: string) => {
        const filteredConvo = get().conversations.filter(
          (convo) => convo.id !== conversation
        );
        set({ conversations: filteredConvo });
      },
      setMessages: (message) => set({ messages: [...get().messages, message] }),
      getConversationMessages: (conversation: string) => {
        const result =
          get().conversations.find((item) => item.id === conversation) || null;
        if (result) {
          const messages = get()
            .messages.filter(
              (messages) => messages.conversation_id === conversation
            )
            .sort((a, b) => a.timestamp - b.timestamp);
          return messages || [];
        } else {
          return null;
        }
      },
      updateConversation: (conversationId: string, summary: string) => {
        set((state) => ({
          conversations: state.conversations.map((convo) => {
            if (convo.id === conversationId) {
              return { ...convo, summary: summary };
            }
            return convo;
          }),
        }));
      },
      updateMessage: ({
        messageId,
        toolUpdates,
        content,
        productUpdates,
        source,
      }: {
        messageId: string;
        toolUpdates?: Partial<ToolType>;
        content?: Partial<MessageType>;
        productUpdates?: Partial<MessageType["product"]>;
        source: string;
      }) => {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId) return msg;

            return {
              ...msg,
              tool: {
                ...(msg.tool ?? {}), // fallback to empty object if tool is undefined
                ...toolUpdates,
              },
              product: {
                ...(msg.product ?? {}), // fallback to empty object if product is undefined
                ...productUpdates,
              },
              source: source,
              ...content,
            } as MessageType;
          }),
        }));
      },
      updateProductDetails: (messageId: string, productDetails: any) => {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId) return msg;
            return {
              ...msg,
              product_details: productDetails,
            } as MessageType;
          }),
        }));
      },
    }),
    {
      name: "conversations", // Storage key
      storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
      onRehydrateStorage: () => (state) => {
        // console.log("Rehydrating:", state);
      },
    }
  )
);

export default Convo;
