import { useThemeContext } from "@/context/ThemeContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from "react-native-reanimated";
import { CText, CNumber } from "@/components/TextComp";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Image } from "expo-image";
import { scale } from "@/utils/layout/scale";
import { isTablet } from "@/utils/layout/tablet";
import UserItem from "@/utils/store/userstore.store";
import { copyItem } from "@/utils/functions";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import BrainStore from "@/utils/store/brain.store";
import { formatDate } from "@/utils/functions/extrafunctions";
import { TxHistoryRowsSkeleton } from "@/components/skeletons";
import { buildHelperCards } from "@/utils/walletHelperCards";
import WalletToolsSection from "@/components/DashboardComponents/WalletToolsSection";
import { useWalletScroll } from "@/context/WalletScrollContext";
import { measureInOverlay } from "@/utils/measureInOverlay";
import {
  getAppTransactions,
  appTransactionRouteId,
  type AppTransaction,
} from "@/services/appTransactions";
import { appTxRowSummary } from "@/utils/appTransactionDisplay";
import AddWalletAccount from "@/components/Sheets/AddWalletAccount";
import AccountsStore from "@/utils/store/accounts.store";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const APP_TRANSACTION_PREVIEW_LIMIT = 10;
const ACTION_BUTTON_SIZE = scale(45);
const actionButtonStyle = {
  width: ACTION_BUTTON_SIZE,
  height: ACTION_BUTTON_SIZE,
  borderRadius: ACTION_BUTTON_SIZE / 2,
};

interface WalletScreenProps {
  onRefresh: () => void;
  refreshing: boolean;
  balancesHidden: boolean;
  onToggleBalancesHidden: () => void;
}

export default function WalletScreen({
  onRefresh,
  refreshing,
  balancesHidden,
  onToggleBalancesHidden,
}: WalletScreenProps) {
  const { scrollY, collapseRange, overlayRootRef, setSourceLayout } =
    useWalletScroll();
  const sourceMeasureRef = useRef<View>(null);
  const { userWallet, visibleTokenMints } = UserItem();
  const { publicKey } = WalletItem();
  const { networkShort } = AppSettings();
  const { suggestions } = BrainStore();

  const displayedTokens =
    visibleTokenMints === null
      ? userWallet?.tokenAccounts ?? []
      : (userWallet?.tokenAccounts ?? []).filter((t: any) =>
        visibleTokenMints.includes(t.mint)
      );

  const [activeTab, setActiveTab] = useState("tokens");
  const [walletHistory, setWalletHistory] = useState<AppTransaction[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const { isDarkMode } = useThemeContext();
  const refreshAccounts = AccountsStore((s) => s.refreshAccounts);
  const pad = isTablet();

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const helpersScrollRef = useRef<ScrollView>(null);
  const [activeHelperIndex, setActiveHelperIndex] = useState(0);

  const CARD_WIDTH = 300;
  const CARD_GAP = 10;
  const AUTO_SCROLL_INTERVAL = 4000;

  /** Carousel shows the latest Brain suggestions. */
  const helperCards = useMemo(
    () => buildHelperCards(suggestions),
    [suggestions]
  );

  const hasBrainSuggestions = suggestions.length > 0;

  // Auto-scroll AI helpers carousel
  useEffect(() => {
    if (!hasBrainSuggestions || helperCards.length <= 1) return;
    const id = setInterval(() => {
      setActiveHelperIndex((prev) => {
        const next = (prev + 1) % helperCards.length;
        helpersScrollRef.current?.scrollTo({
          x: next * (CARD_WIDTH + CARD_GAP),
          animated: true,
        });
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
    return () => clearInterval(id);
  }, [helperCards.length, hasBrainSuggestions]);

  useEffect(() => {
    if (activeTab !== "history" || !publicKey) return;
    let cancelled = false;
    setWalletHistory(null);
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      const res = await getAppTransactions({
        limit: APP_TRANSACTION_PREVIEW_LIMIT,
        syncFirst: true,
      });
      if (cancelled) return;
      setHistoryLoading(false);
      if (!res.status) {
        setWalletHistory([]);
        if (res.message) setHistoryError(res.message);
      } else {
        setWalletHistory(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, publicKey, networkShort]);

  const handleRefresh = useCallback(async () => {
    await onRefresh();
    if (activeTab === "history" && publicKey) {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await getAppTransactions({
        limit: APP_TRANSACTION_PREVIEW_LIMIT,
        syncFirst: true,
      });
      setHistoryLoading(false);
      if (!res.status) {
        setWalletHistory([]);
        if (res.message) setHistoryError(res.message);
      } else {
        setWalletHistory(res.data);
      }
    }
  }, [onRefresh, activeTab, publicKey]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const onBalanceHeaderLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      collapseRange.value = height;
    }
  };

  const measureSource = useCallback(() => {
    measureInOverlay(sourceMeasureRef, overlayRootRef, setSourceLayout);
  }, [overlayRootRef, setSourceLayout]);

  useEffect(() => {
    const id = requestAnimationFrame(() => measureSource());
    return () => cancelAnimationFrame(id);
  }, [measureSource, userWallet?.totalUsdBalance, balancesHidden]);

  const inlineBalanceStyle = useAnimatedStyle(() => {
    const range = Math.max(collapseRange.value, 1);
    const progress = interpolate(
      scrollY.value,
      [0, range * 0.12],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity: 1 - progress };
  });

  return (
    <AnimatedScrollView
      className=""
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View className=" min-h-[50px] gap-y-3 px-1">
        <View className="m-auto  w-full shadow-sm bg-white dark:bg-transparent rounded-3xl py-4">
          <View
            onLayout={onBalanceHeaderLayout}
            className="flex flex-row justify-between items-center px-5 py-3"
          >
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-x-2">
                <CText
                  className={
                    pad ? "text-[17px] leading-6" : "text-[15px] leading-5"
                  }
                >
                  Wallet balance
                </CText>
                <TouchableOpacity
                  accessibilityLabel={
                    balancesHidden ? "Show balances" : "Hide balances"
                  }
                  onPress={onToggleBalancesHidden}
                  className="p-1 rounded-full bg-grey dark:bg-accent2"
                >
                  <Ionicons
                    name={balancesHidden ? "eye-off-outline" : "eye-outline"}
                    size={14}
                    color={isDarkMode ? "white" : "black"}
                  />
                </TouchableOpacity>
              </View>
              <View>
                <View
                  ref={sourceMeasureRef}
                  onLayout={measureSource}
                  collapsable={false}
                >
                  <Animated.View
                    style={inlineBalanceStyle}
                    className="flex-row items-baseline"
                  >
                    {balancesHidden ? (
                      <CText
                        className="text-[45px]"
                        style={{ fontFamily: "bold" }}
                      >
                        ****
                      </CText>
                    ) : (
                      <CText className="text-[45px]">
                        $
                        <CText className="text-[45px]">
                          <CNumber
                            value={Number(
                              userWallet?.totalUsdBalance?.toFixed(2) ?? 0
                            )}
                            className="text-[45px]"
                          />
                        </CText>
                      </CText>
                    )}
                  </Animated.View>
                </View>
              </View>
            </View>
            <View className="flex flex-row justify-center items-center gap-2">
              <TouchableOpacity
                onPress={async () =>
                  await copyItem(publicKey?.toString() || "")
                }
                className="p-3  rounded-full bg-grey dark:bg-accent2"
              >
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/dashboard/qrcode")}
                className="p-3  rounded-full bg-grey dark:bg-accent2"
              >
                <AntDesign
                  name="qrcode"
                  size={16}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add account"
                onPress={() => setAddAccountOpen(true)}
                className="p-3 rounded-full bg-grey dark:bg-accent2"
              >
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={isDarkMode ? "white" : "black"}
                />
              </TouchableOpacity>
            </View>
          </View>

          <AddWalletAccount
            open={addAccountOpen}
            onClose={() => setAddAccountOpen(false)}
          />

          <View className="bg-grey dark:bg-dark w-full p-[0.6]" />

          <View className="flex flex-row py-4 justify-between items-start">
            <View className="flex-1 items-center gap-y-2">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Send"
                onPress={() => {
                  router.push("/dashboard/send");
                }}
                className="bg-purple justify-center items-center"
                style={actionButtonStyle}
              >
                <View className="rotate-[230deg]">
                  <AntDesign name="arrow-down" size={18} color="white" />
                </View>
              </TouchableOpacity>
              <CText
                className={
                  pad ? "text-[1.125rem] leading-6" : "text-[1rem] leading-5"
                }
              >
                Send
              </CText>
            </View>
            <View className="flex-1 items-center gap-y-2">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Swap"
                onPress={() => {
                  router.push("/dashboard/swap");
                }}
                className="bg-purple  justify-center items-center"
                style={actionButtonStyle}
              >
                <MaterialCommunityIcons
                  name="swap-horizontal"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
              <CText
                className={
                  pad ? "text-[1.125rem] leading-6" : "text-[1rem] leading-5"
                }
              >
                Swap
              </CText>
            </View>
            <View className="flex-1 items-center gap-y-2">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Deposit"
                onPress={() => {
                  router.push("/dashboard/deposit" as any);
                }}
                className="bg-purple justify-center items-center"
                style={actionButtonStyle}
              >
                <View className="rotate-[40deg]">
                  <AntDesign name="arrow-down" size={18} color="white" />
                </View>
              </TouchableOpacity>
              <CText
                className={
                  pad ? "text-[1.125rem] leading-6" : "text-[1rem] leading-5"
                }
              >
                Deposit
              </CText>
            </View>
          </View>
        </View>

        <WalletToolsSection />

        {/* Temporarily hidden — Brain suggestions carousel
        <View className="relative w-full">
          {hasBrainSuggestions ? (
            <View className="w-full">
              <ScrollView
                ref={helpersScrollRef}
                className=""
                showsHorizontalScrollIndicator={false}
                horizontal
                pagingEnabled={false}
                snapToInterval={CARD_WIDTH + CARD_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{ gap: CARD_GAP, paddingRight: CARD_GAP }}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const index = Math.round(x / (CARD_WIDTH + CARD_GAP));
                  const max = Math.max(0, helperCards.length - 1);
                  const clamped = Math.min(Math.max(0, index), max);
                  setActiveHelperIndex(clamped);
                }}
                scrollEventThrottle={16}
              >
                {helperCards.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="w-[300px] h-[100px] py-1 px-1"
                    onPress={() => router.push("/dashboard/aicards")}
                  >
                    <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-4 py-5 rounded-2xl bg-white dark:bg-accent w-full ">
                      <View className="h-8 w-8 rounded-full">
                        <Image source={require("@/assets/images/ballicon.png")} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                      </View>
                      <View className="flex-1">
                        <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">{item.title}</CText>
                        <CText className="text-[1rem]">{item.caption.slice(0, 50)}...</CText>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {helperCards.length > 1 && (
                <View className="flex-row justify-center items-center gap-1.5 pt-3 pb-1">
                  {helperCards.map((item, index) => (
                    <View
                      key={item.id}
                      className={`h-2 rounded-full ${index === activeHelperIndex ? "w-5 bg-purple" : "w-2 bg-grey dark:bg-accent2"}`}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View className="w-full px-1">
              <TouchableOpacity
                activeOpacity={0.9}
                className="w-full"
                onPress={() => router.push("/brain")}
              >
                <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-4 py-5 rounded-2xl bg-white dark:bg-accent w-full">
                  <View className="h-8 w-8 rounded-full">
                    <Image
                      source={require("@/assets/images/ballicon.png")}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                    />
                  </View>
                  <View className="flex-1 min-w-0">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                      {helperCards[0]?.title}
                    </CText>
                    <CText className="text-[1rem]">{helperCards[0]?.caption}</CText>
                  </View>
                  <MaterialCommunityIcons
                    name="greater-than"
                    size={12}
                    color={isDarkMode ? "white" : "black"}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
        */}

        <View className="w-full min-h-[400px]  pb-[60px] shadow-md m-auto bg-white dark:bg-accent overflow-hidden rounded-3xl">
          <View className="flex flex-row items-center justify-between">
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple("#971BB2", false)}
              onPress={() => setActiveTab("tokens")}
            >
              <View
                className={`w-[50%] py-5 border-b-2 ${activeTab === "tokens" ? "border-purple" : "border-grey"
                  } `}
              >
                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[1.1rem]  text-center"
                >
                  Tokens
                </CText>
              </View>
            </TouchableNativeFeedback>
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple("#971BB2", false)}
              onPress={() => setActiveTab("history")}
            >
              <View
                className={`w-[50%] py-5 border-b-2 ${activeTab === "history"
                  ? "border-purple"
                  : "border-grey dark:border-dark"
                  } `}
              >
                <CText className="text-[1.1rem] text-center">History</CText>
              </View>
            </TouchableNativeFeedback>
          </View>

          {activeTab === "tokens" ? (
            <View className="flex-1">
              <View className="py-5 w-full">
                <TouchableOpacity
                  onPress={() => router.push("/dashboard/managetokens")}
                  className="bg-grey dark:bg-accent2 rounded-full  m-auto w-10/12 flex flex-row justify-center items-center gap-x-4 p-3"
                >
                  <FontAwesome
                    name="sliders"
                    size={14}
                    color={isDarkMode ? "white" : "black"}
                  />
                  <CText>Manage tokens</CText>
                </TouchableOpacity>
              </View>
              {displayedTokens?.map((token: any, index: number) => {
                return (
                  <View key={index}>
                    <TouchableNativeFeedback
                      key={index}
                      background={TouchableNativeFeedback.Ripple(
                        "#971BB2",
                        false
                      )}
                      onPress={() => {
                        router.push({
                          pathname: "/dashboard/tokeninfo",
                          params: { mint: token.mint },
                        });
                      }}
                    >
                      <View className=" px-4 py-4  w-full  flex flex-row items-start justify-between text-[1.14rem]">
                        <View className="flex-1 flex-row  w-[80%] items-start gap-x-2">
                          <View
                            style={{
                              width: scale(30),
                              height: scale(30),
                            }}
                            className="overflow-hidden rounded-full"
                          >
                            <Image
                              source={
                                token?.image ??
                                require("@/assets/images/icon.png")
                              }
                              alt={token?.name}
                              style={{ height: "100%", width: "100%" }}
                              contentFit="cover"
                            />
                          </View>

                          <View className="text-[14px]">
                            <CText
                              style={{ fontFamily: "bold" }}
                              className="text-[1rem]"
                            >
                              {token?.name || "?"}
                            </CText>
                            <CText
                              style={{ fontFamily: "reg" }}
                              className="text-[1rem]"
                            >
                              {balancesHidden
                                ? "****"
                                : token?.balance < 1
                                  ? token?.balance?.toFixed(
                                    Math.min(token?.decimals, 5)
                                  )
                                  : token?.balance.toFixed(
                                    Math.min(token?.decimals, 3)
                                  )}
                            </CText>
                          </View>
                        </View>
                        <View className="flex flex-col w-[20%] justify-start">
                          {/* <CText className="text-[14px]">
                            {token?.balance?.toFixed(
                              Math.min(token?.decimals, 2)
                            )}
                          </CText> */}
                          <CText
                            style={{ fontFamily: "bold" }}
                            className="text-[19px]"
                          >
                            {balancesHidden ? (
                              "****"
                            ) : (
                              <>
                                $
                                {token?.usdc_price?.toFixed(2) ? (
                                  <CNumber
                                    value={token?.usdc_price?.toFixed(2)}
                                    style={{ fontFamily: "bold" }}
                                    className="text-[19px] "
                                  />
                                ) : (
                                  "0.00"
                                )}
                              </>
                            )}
                          </CText>
                        </View>
                      </View>
                    </TouchableNativeFeedback>
                    <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 min-h-[200px]">
              {historyLoading && <TxHistoryRowsSkeleton rows={6} />}
              {!historyLoading && historyError && (
                <View className="px-4 py-6">
                  <CText className="text-center text-red-500">
                    {historyError}
                  </CText>
                </View>
              )}
              {!historyLoading &&
                !historyError &&
                walletHistory &&
                walletHistory.length === 0 && (
                  <View className="py-8 items-center px-4">
                    <CText className="text-center text-grey/60">
                      No app transactions found for this wallet yet.
                    </CText>
                  </View>
                )}
              {!historyLoading &&
                walletHistory &&
                walletHistory.length > 0 &&
                walletHistory.map((tx: AppTransaction, index: number) => {
                  const row = appTxRowSummary(tx);
                  const key = tx.local_id ?? tx.id ?? tx.signature ?? `tx-${index}`;
                  const date = tx.confirmed_at ?? tx.created_at ?? "";
                  return (
                    <View key={key}>
                      <TouchableNativeFeedback
                        background={TouchableNativeFeedback.Ripple(
                          "#971BB2",
                          false
                        )}
                        onPress={() => {
                          router.push({
                            pathname: "/dashboard/transaction",
                            params: { id: appTransactionRouteId(tx) },
                          });
                        }}
                      >
                        <View className="px-4 py-4 w-full flex flex-row items-start justify-between">
                          <View className="gap-y-2 flex-1 pr-2">
                            <CText className="text-[0.95rem]">
                              {date ? formatDate(date) : "Pending"}
                            </CText>
                            <CText
                              style={{ fontFamily: "bold" }}
                              className="text-[1rem]"
                            >
                              {row.title}
                            </CText>
                            <CText
                              style={{ fontFamily: "reg" }}
                              className="text-[0.9rem] text-grey/70 dark:text-grey/50"
                            >
                              {row.subtitle}
                            </CText>
                          </View>
                          {row.amount ? (
                            <CText
                              textColor={
                                row.sent ? "text-red-400" : "text-green-400"
                              }
                              style={{ fontFamily: "reg" }}
                              className="text-[1rem] max-w-[45%] text-right"
                            >
                              {balancesHidden ? "****" : row.amount}
                            </CText>
                          ) : null}
                        </View>
                      </TouchableNativeFeedback>
                      <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
                    </View>
                  );
                })}
              {!historyLoading && walletHistory && walletHistory.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/dashboard/transactions")}
                  className="mx-4 my-5 rounded-full bg-grey dark:bg-accent2 py-4"
                >
                  <CText className="text-center" style={{ fontFamily: "bold" }}>
                    View all transactions
                  </CText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </AnimatedScrollView>
  );
}
