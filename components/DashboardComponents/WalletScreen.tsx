import { useThemeContext } from "@/context/ThemeContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import { CText, CNumber } from "@/components/TextComp";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Buttons from "@/components/ButtonComp";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Image } from "expo-image";
import { scale } from "react-native-size-matters";
import UserItem from "@/utils/store/userstore.store";
import { copyItem } from "@/utils/functions";
import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import BrainStore from "@/utils/store/brain.store";
import {
  formatDate,
  getWalletTransactions,
  shortenPub,
} from "@/utils/functions/extrafunctions";

function lamportsToSolDisplay(lamports: number): string {
  const sol = lamports / 1e9;
  if (!Number.isFinite(sol)) return "SOL";
  if (Math.abs(sol) < 1e-8) return "0 SOL";
  const abs = Math.abs(sol);
  const decimals = abs < 1 ? 6 : 4;
  return `${sol.toFixed(decimals)} SOL`;
}

/** One-line summary for Helius enhanced tx on the wallet activity list */
function walletTxRowSummary(tx: any, userPk: string) {
  const tokens = tx.tokenTransfers ?? [];
  const tokenHit = tokens.find(
    (t: any) =>
      t?.fromUserAccount === userPk || t?.toUserAccount === userPk
  );
  if (tokenHit) {
    const sent = tokenHit.fromUserAccount === userPk;
    const sym =
      tokenHit.tokenSymbol ||
      tokenHit.symbol ||
      shortenPub(String(tokenHit.mint ?? ""));
    return {
      title: sent ? "SENT" : "RECEIVED",
      subtitle: sent
        ? `to ${shortenPub(String(tokenHit.toUserAccount ?? ""))}`
        : `from ${shortenPub(String(tokenHit.fromUserAccount ?? ""))}`,
      amount: `${sent ? "-" : "+"} ${tokenHit.tokenAmount} ${sym}`,
      sent,
    };
  }

  const natives = tx.nativeTransfers ?? [];
  const solHit = natives.find(
    (n: any) =>
      n?.fromUserAccount === userPk || n?.toUserAccount === userPk
  );
  if (solHit) {
    const sent = solHit.fromUserAccount === userPk;
    const lamports = Number(solHit.amount ?? 0);
    return {
      title: sent ? "SENT SOL" : "RECEIVED SOL",
      subtitle: sent
        ? `to ${shortenPub(String(solHit.toUserAccount ?? ""))}`
        : `from ${shortenPub(String(solHit.fromUserAccount ?? ""))}`,
      amount: `${sent ? "-" : "+"} ${lamportsToSolDisplay(lamports)}`,
      sent,
    };
  }

  const rawType = String(tx.type ?? "ACTIVITY");
  const title = rawType.replace(/_/g, " ");
  const desc = typeof tx.description === "string" ? tx.description.trim() : "";
  return {
    title,
    subtitle: desc || shortenPub(String(tx.signature ?? "")),
    amount: "",
    sent: false,
  };
}

type HelperCard = {
  id: string;
  title: string;
  caption: string;
  link: string;
};

interface WalletScreenProps {
  onRefresh: () => void;
  refreshing: boolean;
}

export default function WalletScreen({
  onRefresh,
  refreshing,
}: WalletScreenProps) {
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
  const [walletHistory, setWalletHistory] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const { isDarkMode } = useThemeContext();

  const [isHelpersExpanded, setIsHelpersExpanded] = useState(false);
  const helpersScrollRef = useRef<ScrollView>(null);
  const [activeHelperIndex, setActiveHelperIndex] = useState(0);

  const CARD_WIDTH = 300;
  const CARD_GAP = 10;
  const AUTO_SCROLL_INTERVAL = 4000;

  /** Carousel content comes only from Brain suggestions (no static marketing cards). */
  const helperCards: HelperCard[] = useMemo(() => {
    const fromBrain = suggestions
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map((s) => ({
        id: s.id,
        title: s.title,
        caption: s.body,
        link: s.link ?? `/brain?focus=${encodeURIComponent(s.id)}`,
      }));
    if (fromBrain.length === 0) {
      return [
        {
          id: "brain-empty",
          title: "Brain",
          caption: "No suggestions yet. Tap to open Brain for alerts and actions.",
          link: "/brain",
        },
      ];
    }
    return fromBrain;
  }, [suggestions]);

  const hasBrainSuggestions = suggestions.length > 0;

  // Auto-scroll AI helpers carousel
  useEffect(() => {
    if (isHelpersExpanded || !hasBrainSuggestions || helperCards.length <= 1) return;
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
  }, [isHelpersExpanded, helperCards.length, hasBrainSuggestions]);

  useEffect(() => {
    if (activeTab !== "history" || !publicKey) return;
    let cancelled = false;
    setWalletHistory(null);
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      const res = await getWalletTransactions({});
      if (cancelled) return;
      setHistoryLoading(false);
      if (res.status && res.data) {
        setWalletHistory(res.data);
      } else {
        setWalletHistory([]);
        if (res.message) setHistoryError(res.message);
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
      const res = await getWalletTransactions({ invalidateCache: true });
      setHistoryLoading(false);
      if (res.status && res.data) {
        setWalletHistory(res.data);
      } else {
        setWalletHistory([]);
        if (res.message) setHistoryError(res.message);
      }
    }
  }, [onRefresh, activeTab, publicKey, networkShort]);

  return (
    <ScrollView
      className=""
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View className=" min-h-[50px] gap-y-3 px-1">
        <View className="m-auto  w-full shadow-sm bg-white dark:bg-transparent rounded-3xl py-4">
          <View className="flex flex-row  justify-between items-center px-5 py-3">
            <View className="">
              <View>
                <CText className="text-[12px]">Wallet balance</CText>
              </View>
              <CText className="text-[45px]">
                $
                <CText className="text-[45px]">
                  <CNumber
                    // value={50}
                    value={Number(userWallet?.totalUsdBalance.toFixed(2))}
                    className="text-[45px]"
                  />
                </CText>
              </CText>
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
            </View>
          </View>

          <View className="bg-grey dark:bg-dark w-full p-[0.6]" />

          <View className="flex flex-row gap-2 py-3 items-center justify-between px-4">
            <View className="flex-1">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => {
                  router.push("/dashboard/send");
                }}
                type="primary"
                text="Send"
                icon={
                  <View className="rotate-[230deg]">
                    <AntDesign
                      name="arrow-down"
                      size={16}
                      color="white"
                    />
                  </View>
                }
              />
            </View>
            <View className="flex-1">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => {
                  // testFunctions()
                  router.push("/dashboard/qrcode");
                }}
                type="primary"
                text="Receive"
                icon={
                  <View className="rotate-[40deg]">
                    <AntDesign
                      name="arrow-down"
                      size={16}
                      color="white"
                    />
                  </View>
                }
              />
            </View>
          </View>
        </View>

        <View className="relative w-full">
          {isHelpersExpanded ? (
            <View className="gap-3 pb-2">
              {helperCards.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (item?.link) router.push(item.link as any);
                  }}
                  className="w-full"
                >
                  <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-4 rounded-2xl bg-white dark:bg-accent w-full">
                    <View className="h-8 w-8 rounded-full">
                      <Image
                        source={require("@/assets/images/ballicon.png")}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                      />
                    </View>
                    <View className="flex-1">
                      <CText
                        style={{ fontFamily: "bold" }}
                        className="text-[1.1rem]"
                      >
                        {item.title}
                      </CText>
                      <CText className="text-[1rem]">{item.caption}</CText>
                    </View>
                    <MaterialCommunityIcons
                      name="greater-than"
                      size={12}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : hasBrainSuggestions ? (
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
                    className="w-[300px]"
                    onPress={() => {
                      // Tap expands; second tap (expanded list) navigates.
                      setIsHelpersExpanded(true);
                    }}
                  >
                    <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-4 py-5 rounded-2xl bg-white dark:bg-accent w-full ">
                      <View className="h-8 w-8 rounded-full">
                        <Image source={require("@/assets/images/ballicon.png")} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                      </View>
                      <View className="flex-1">
                        <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">{item.title}</CText>
                        <CText className="text-[1rem]">{item.caption}</CText>
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
                              {token?.balance < 1
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
                            $
                            {token?.usdc_price?.toFixed(2) ?
                              <CNumber
                                value={
                                  token?.usdc_price?.toFixed(2)
                                }
                                style={{ fontFamily: "bold" }}
                                className="text-[19px] "
                              />
                              : "0.00"}
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
              {historyLoading && (
                <View className="py-8 items-center">
                  <CText>Loading activity…</CText>
                </View>
              )}
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
                      No transactions found for this wallet yet.
                    </CText>
                  </View>
                )}
              {!historyLoading &&
                walletHistory &&
                walletHistory.length > 0 &&
                publicKey &&
                walletHistory.map((tx: any, index: number) => {
                  const pk = publicKey.toString();
                  const row = walletTxRowSummary(tx, pk);
                  const key = tx.signature ?? `tx-${index}`;
                  return (
                    <View key={key}>
                      <TouchableNativeFeedback
                        background={TouchableNativeFeedback.Ripple(
                          "#971BB2",
                          false
                        )}
                        onPress={() => {}}
                      >
                        <View className="px-4 py-4 w-full flex flex-row items-start justify-between">
                          <View className="gap-y-2 flex-1 pr-2">
                            <CText className="text-[0.95rem]">
                              {formatDate(tx.timestamp)}
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
                              {row.amount}
                            </CText>
                          ) : null}
                        </View>
                      </TouchableNativeFeedback>
                      <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
