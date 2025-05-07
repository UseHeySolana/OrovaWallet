import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

export interface MessageType {
    role: 'system' | 'user' | 'tool';
    content: string;
    timestamp: number;
    id: string;
    conversation_id: string;
    tool?: {
        owner?: string,
        action: string,
        link?: string,
        status: 'pending' | 'failed' | 'complete',
        arguments?: any,
    }
}

type ToolType = NonNullable<MessageType['tool']>;

interface Conversation {
    conversations: string[];
    createConversation: (conversation: string) => void;
    deleteConversation: (conversation: string) => void;
    clearAll: () => void;
    messages: MessageType[];
    setMessages: (messages: MessageType) => void;
    updateMessage: (messageId: string, toolUpdates: Partial<ToolType>) => void;
    getConversationMessages: (conversation: string) => MessageType[] | null;
}

const Convo = create(
    persist<Conversation>(
        (set, get) => ({
            conversations: [],
            createConversation: (conversation: string) => set({ conversations: [...get().conversations, conversation] }),
            messages: [],
            clearAll: () => {
                set({ messages: [] })
                set({ conversations: [] })
            },
            deleteConversation: (conversation: string) => {
                const filteredConvo = get().conversations.filter(convo => convo !== conversation);
                set({ conversations: filteredConvo })
            },
            setMessages: (message) => set({ messages: [...get().messages, message] }),
            getConversationMessages: (conversation: string) => {
                const result = get().conversations.find(item => item === conversation) || null
                if (result) {
                    const messages = get().messages.filter(messages => messages.conversation_id === conversation)
                    return messages || [];
                } else {
                    return null;
                }
            },
            updateMessage: (
                messageId: string,
                toolUpdates: Partial<ToolType>
            ) => {
                set((state) => ({
                    messages: state.messages.map((msg) => {
                        if (msg.id !== messageId) return msg;

                        return {
                            ...msg,
                            tool: {
                                ...(msg.tool ?? {}), // fallback to empty object if tool is undefined
                                ...toolUpdates,
                            },
                        } as MessageType;
                    }),
                }))
            }
        }),
        {
            name: 'conversations', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                // console.log("Rehydrating:", state);
            }
        }
    )
);

export default Convo;
