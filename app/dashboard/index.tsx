import React, { useCallback, useEffect, useRef, useState } from "react";
import LottieView from "lottie-react-native";
import {
  AppState,
  type AppStateStatus,
  View,
  TouchableOpacity,
} from "react-native";
import DashboardOverlayRoot from "@/components/DashboardComponents/DashboardOverlayRoot";
import DashboardWalletHeader from "@/components/DashboardComponents/DashboardWalletHeader";
import FloatingWalletBalance from "@/components/DashboardComponents/FloatingWalletBalance";
import { WalletScrollProvider } from "@/context/WalletScrollContext";
import UserItem from "@/utils/store/userstore.store";
import {
  hasCachedWalletBalances,
  isWalletBalanceCacheFresh,
  refreshUserWalletBalances,
  WALLET_POLL_INTERVAL_MS,
} from "@/utils/wallet/walletBalanceCache";
import {
  notifyWalletSnapshotChanges,
  resetWalletChangeNotifyCooldowns,
  snapshotUserWallet,
} from "@/utils/wallet/walletChangeNotify";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { useAi } from "@/context/AiContext";
import { VOICE_VERIFICATION_ENABLED } from "@/utils/constant";

import { Base } from "@/components//Navigation/Base";
import { useThemeContext } from "@/context/ThemeContext";
import Convo, { MessageType } from "@/utils/store/conversation.store";
import { toolRouter } from "@/libs/tool-implemetation/toolsregistry";
import SetPin from "@/components/Sheets/SetPinSheet";

import ToolsItem from "@/utils/store/toolsitems.store";
import QuickActions from "@/services/WidgetService/QuickActions";
import ChatInterface from "@/components/DashboardComponents/Chatinterface";
import WalletScreen from "@/components/DashboardComponents/WalletScreen";

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
/**
 * What should be done here
 * 1. Get User Tokens and Balance
 * 2. AI interactions can also be done Here
 */
export default function Dashboard() {
  const { convoId } = useLocalSearchParams();
  const { messages, getConversationMessages } = Convo();
  const { user } = UserItem();
  const { setLoading, pin } = AppSettings();
  const {
    sessionManager,
    isSessionActive,
    startSession,
    stopSession,
    currentMode,
    conversationId,
    voiceEnrolled,
  } = useAi();
  const { publicKey } = WalletItem();
  const [refreshing, setRefreshing] = useState(false);
  const animation = useRef<LottieView>(null);

  const [showWallet, setShowWallet] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);
  const { isDarkMode } = useThemeContext();

  const [message, setMessage] = useState<MessageType[]>([]);
  const [setPinOpen, setSetPinOpen] = useState(false);
  /** After first successful full wallet sync, silent refreshes may toast / notify on incoming deltas */
  const walletNotifyPrimedRef = useRef(false);
  const skipFocusRefreshRef = useRef(true);

  useEffect(() => {
    walletNotifyPrimedRef.current = false;
    skipFocusRefreshRef.current = true;
    resetWalletChangeNotifyCooldowns();
    UserItem.getState().setWalletLastSyncedAt(null);
  }, [user?.username, publicKey?.toBase58()]);

  useEffect(() => {
    console.log(
      ToolsItem.getState()
        .getToolParameters("Crossmint", "tracking email")[0]
        ?.value.toLowerCase()
    );
  }, []);

  useEffect(() => {
    if (pin.length > 0) {
      setSetPinOpen(false);
    } else {
      setSetPinOpen(true);
    }
  }, [pin]);

  useEffect(() => {
    if (conversationId !== "") {
      const messageItem = getConversationMessages(conversationId) || [];
      setMessage(messageItem);
    } else if (convoId || !(convoId != undefined)) {
      const messageItem = getConversationMessages(convoId as string) || [];
      setMessage(messageItem);
    }
  }, [conversationId, messages, convoId]);



  useEffect(() => {
    if (currentMode === "aispeaking" || currentMode === "human") {
      animation.current?.play();
    } else if (currentMode === "loading") {
      animation.current?.pause();
    }
  }, [currentMode]);

  useEffect(() => {
    if (sessionManager) {
      const tools = toolRouter(sessionManager);
    }
  }, [sessionManager]);

  const refreshWallet = useCallback(
    async (options: { showLoading?: boolean; force?: boolean } = {}) => {
      const { showLoading = false, force = false } = options;
      if (!user || !publicKey) return;
      if (showLoading) {
        await setLoading(true);
      }
      const prevWallet = snapshotUserWallet(UserItem.getState().userWallet);
      try {
        const ok = await refreshUserWalletBalances({ force });
        if (showLoading && ok) {
          walletNotifyPrimedRef.current = true;
        }
        if (!showLoading && walletNotifyPrimedRef.current && ok) {
          notifyWalletSnapshotChanges(
            prevWallet,
            UserItem.getState().userWallet
          );
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [user, publicKey, setLoading]
  );

  useEffect(() => {
    const { userWallet, walletLastSyncedAt } = UserItem.getState();
    const hasCache = hasCachedWalletBalances(userWallet);
    const fresh = isWalletBalanceCacheFresh(walletLastSyncedAt);

    if (fresh && hasCache) {
      walletNotifyPrimedRef.current = true;
      return;
    }

    void refreshWallet({ showLoading: !hasCache });
  }, [refreshWallet]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefreshRef.current) {
        skipFocusRefreshRef.current = false;
        return;
      }
      if (!isWalletBalanceCacheFresh(UserItem.getState().walletLastSyncedAt)) {
        void refreshWallet({ showLoading: false });
      }
    }, [refreshWallet])
  );

  useEffect(() => {
    if (!user || !publicKey) return undefined;

    const pollIfActive = () => {
      if (AppState.currentState === "active") {
        void refreshWallet({ showLoading: false });
      }
    };

    const id = setInterval(pollIfActive, WALLET_POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        void refreshWallet({ showLoading: false });
      }
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [user, publicKey, refreshWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshWallet({ showLoading: false, force: true });
    } finally {
      setRefreshing(false);
      setShowWallet(false);
    }
  };

  const startStreamingSession = async () => {
    if (!sessionManager) return;
    startSession();
    setShowWallet(false);
    router.setParams({
      convoId: null,
    });
  };

  const stopStreamingSession = async () => {
    if (!sessionManager) return;
    stopSession();
    setShowWallet(true);
  };

  return (
    <WalletScrollProvider active={showWallet}>
      <DashboardOverlayRoot
        overlay={
          <FloatingWalletBalance
            showWallet={showWallet}
            balancesHidden={balancesHidden}
          />
        }
      >
        <View className="flex-1 pt-3 pb-2 w-screen px-4 h-screen gap-y-4">
          <DashboardWalletHeader
            showWallet={showWallet}
            balancesHidden={balancesHidden}
            isDarkMode={isDarkMode}
            onBalancePress={() => setShowWallet(true)}
          />
          {showWallet ? (
            <WalletScreen
              onRefresh={onRefresh}
              refreshing={refreshing}
              balancesHidden={balancesHidden}
              onToggleBalancesHidden={() =>
                setBalancesHidden((hidden) => !hidden)
              }
            />
          ) : (
            <>
              <ChatInterface messages={message} />
              <QuickActions showInDashboard={false} />
            </>
          )}
          {(showWallet || !VOICE_VERIFICATION_ENABLED || voiceEnrolled === true) && (
            <Base
              showWallet={showWallet}
              setShowWallet={setShowWallet}
              stopSession={stopStreamingSession}
              startSession={startStreamingSession}
              isSessionActive={isSessionActive}
            />
          )}

          <SetPin open={setPinOpen} setOpen={setSetPinOpen} usage="first-time" />
        </View>
      </DashboardOverlayRoot>
    </WalletScrollProvider>
  );
}
