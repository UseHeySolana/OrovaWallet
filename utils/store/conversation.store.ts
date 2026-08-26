import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DataPlanCategory, DataPlanPickerRow } from '@/libs/tools/airbills/dataPlanDisplay';

/** Rows for Jupiter token search picker (verified sorted first in UI). */
export interface TokenSearchPickRow {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  isVerified: boolean;
  organicScore?: number;
}

/** Rows for PajCash bank search picker on pajit-offramp tool cards. */
export interface BankSearchPickRow {
  id: string;
  name: string;
  code?: string;
  logo?: string;
}

export type { DataPlanPickerRow } from '@/libs/tools/airbills/dataPlanDisplay';

export interface ChowdeckAddressPickRow {
  place_id: string;
  label: string;
  description: string;
}
export interface PrivateTransferMeta {
  visibility: "public" | "private";
  fromBalance: "base" | "ephemeral";
  toBalance: "base" | "ephemeral";
  split: number;
  minDelayMs: string;
  maxDelayMs: string;
  gasless: boolean;
  amount: number;
  tokenSymbol: string;
  recipient: string;
  validator?: string;
  /** Number of split chunks settled so far (0..split). */
  settlementProgress: number;
  /** Submitted base-chain or ephemeral txid. */
  txid?: string;
}

export interface PajcashOnrampPaymentMeta {
  orderId: string;
  fiatAmount: string;
  tokenAmount: string;
  tokenSymbol: string;
  accountNumber: string;
  accountName: string;
  bank: string;
  recipient: string;
}

export interface MessageType {
  role: "system" | "user" | "tool";
  content: string;
  timestamp: number;
  id: string;
  conversation_id: string;
  messageType?: "kalshi" | "commerce" | "generic" | "magicblock" | "token_search" | string;
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
    menu_id?: number;
    vendor_id?: number;
    vendor_name?: string;
    base_price?: number;
    delivery_fee?: number;
    minimum_order_ngn?: number;
    is_vendor_open?: boolean;
  }[];
  markets?: any[];
  product_details?: any;
  privateTransfer?: PrivateTransferMeta;
  pajcashOnrampPayment?: PajcashOnrampPaymentMeta;
  /** Jupiter token disambiguation (search_spl_tokens / swap / price, multiple hits). */
  tokenSearchPicker?: {
    query: string;
    hits: TokenSearchPickRow[];
    /** When shown under swap_tokens or check_price, which leg is being chosen. */
    swapLeg?: "from" | "to";
  };
  /** PajCash bank search results for offramp — user taps a card to select. */
  bankSearchPicker?: {
    query: string;
    hits: BankSearchPickRow[];
    amount: number;
    token: string;
    accountNumber: string;
    fiatAmount?: number;
  };
  /** Airbills data bundle category + plan picker on buy-data-bundle tool card. */
  dataPlanPicker?: {
    phoneNumber: string;
    networkName: string;
    stage: "category" | "plans";
    category?: DataPlanCategory;
    plans: DataPlanPickerRow[];
  };
  /** Chowdeck delivery address autocomplete picker (tap to save). */
  chowdeckAddressPicker?: {
    query: string;
    options: ChowdeckAddressPickRow[];
  };
  /** Human-friendly Chowdeck cart payment summary (hide raw tool IDs). */
  chowdeckCartSummary?: {
    product_name: string;
    vendor_name: string;
    quantity: number;
    options_label?: string;
    subtotal_ngn: number;
    delivery_fee_ngn: number;
    total_ngn: number;
    amount_usdc: number | null;
    amount_sol: number | null;
    payment_token: "USDC" | "SOL";
  };
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
    productUpdates?: MessageType["product"];
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
        productUpdates?: MessageType["product"];
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
              product: productUpdates ?? msg.product,
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
