import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, RefreshControl, ScrollView, TouchableNativeFeedback, TouchableOpacity, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import UserItem from "@/utils/store/userstore.store";
import { Image } from "expo-image";
import { scale } from "react-native-size-matters";
import Buttons from "@/components/ButtonComp";
import {
  formatDate,
  getTokenTransactions,
  shortenPub,
  showToast,
} from "@/utils/functions/extrafunctions";
import { cache } from "@/utils/storage/cache";
import { useThemeContext } from "@/context/ThemeContext";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import AntDesign from "@expo/vector-icons/AntDesign";
import WalletItem from "@/utils/store/wallet.store";

/**
 * What should be done here
 * Show token info
 * Show charts
 */
function TokenInfo() {
  const { mint } = useLocalSearchParams();
  const [token, setToken] = useState<any>(null);
  const [history, setTokenHistory] = useState<any[] | null>(null);
  const { isDarkMode } = useThemeContext();
  const { publicKey } = WalletItem();

  const [update, setUpdate] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { userWallet } = UserItem();

  useEffect(() => {
    if (mint) {
      const tokens = userWallet?.tokenAccounts?.filter(
        (item: any) => item.mint === mint
      );
      setToken(tokens[0]);
    }
    const getTx = async () => {
      if (publicKey) {
        const txHistory = await getTokenTransactions(mint as string);
        if (txHistory.status) {
          setTokenHistory(txHistory.data);
        }
        setRefreshing(false);
      }
    };
    getTx();
  }, [mint, publicKey, update]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (publicKey) {
        const cacheKey = `txHistory:${publicKey.toString()}`;
        await cache.remove(cacheKey);
      }
    } catch (e) {
    } finally {
      setUpdate(Math.random());
    }
  };

  return (
    <View className="relative w-full bg-grey pt-4 dark:bg-dark flex-1 items-center">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">{token?.name}</CText>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        className="flex-1 flex-col w-full px-4 pt-4"
      >
        <View className="flex flex-col py-5 rounded-3xl shadow dark:shadow-none  bg-white  dark:bg-accent  items-center justify-center gap-y-4 mb-2">
          <View
            style={{
              width: scale(50),
              height: scale(50),
            }}
            className="overflow-hidden rounded-full bg-white dark:bg-accent"
          >
            <Image
              source={token?.image ?? require("@/assets/images/icon.png")}
              alt={token?.name}
              style={{ height: "100%", width: "100%" }}
              contentFit="cover"
            />
          </View>

          <View className="gap-x-1 flex flex-row items-center justify-center">
            <CText style={{ fontFamily: "reg" }} className="text-[3.2rem]">
              {token?.balance < 1
                ? token?.balance?.toFixed(Math.min(token?.decimals, 5))
                : token?.balance.toFixed(Math.min(token?.decimals, 3))}
            </CText>
            <CText style={{ fontFamily: "reg" }} className="text-[1.5rem]">
              {token?.symbol || "?"}
            </CText>
          </View>
          <CText style={{ fontFamily: "reg" }} className="text-[1.5rem]">
            ${token?.usdc_price?.toFixed(2) || "?"}
          </CText>

          <View className="dark:bg-accent2 bg-white p-2 rounded-3xl">
            <CText style={{ fontFamily: "reg" }} className="text-[1rem]">
              {shortenPub(publicKey?.toString() || "")}
            </CText>
          </View>

          <View className="bg-grey dark:bg-dark py-[1px] w-full"></View>
          <View className="flex flex-row gap-2 items-center justify-between px-4">
            <View className="w-[40%]">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => {
                  router.push({
                    pathname: "/dashboard/send/token",
                    params: { mint: mint },
                  });
                }}
                type="secondary"
                text="Send"
                icon={
                  <View className="rotate-[230deg]">
                    <AntDesign
                      name="arrowdown"
                      size={16}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </View>
                }
              />
            </View>
            <View className="w-[40%]">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => {
                  showToast("Kindly Use Voice to send tokens");

                  // sendMessage()
                }}
                type="secondary"
                text="Receive"
                icon={
                  <View className="rotate-[40deg]">
                    <AntDesign
                      name="arrowdown"
                      size={16}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </View>
                }
              />
            </View>
          </View>
        </View>

        <View className="w-full min-h-[400px]  pb-[60px] shadow-md m-auto bg-white dark:bg-accent overflow-hidden rounded-3xl">
          <View className="flex flex-row items-center justify-start">
            <View className={`w-[50%] py-5 border-b-2  border-purple `}>
              <CText className="text-[1.1rem] text-center">History</CText>
            </View>
          </View>

          <View className="flex-1">
            {history?.map((tokenHistory: any, index: number) => {
              const isNativeTransfer = tokenHistory.nativeTransfers.length;
              const isTokenTransfer = tokenHistory.tokenTransfers.length;
              const txType = tokenHistory.type;
              const transfer = isTokenTransfer
                ? tokenHistory.tokenTransfers[0]
                : null;

              return (
                <View key={index}>
                  <TouchableNativeFeedback
                    key={index}
                    background={TouchableNativeFeedback.Ripple(
                      "#971BB2",
                      false
                    )}
                    onPress={() => {
                      // router.push({
                      //   pathname: '/dashboard/tokeninfo',
                      //   params: { mint: token.mint },
                      // });
                    }}
                  >
                    <View className=" px-4 py-4  w-full   flex flex-row items-start justify-between text-[1.14rem]">
                      <View className="gap-y-2">
                        <CText>{formatDate(tokenHistory.timestamp)}</CText>
                        <View className="flex flex-row items-center gap-x-2">
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
                            {txType.toLowerCase() == "transfer" ? (
                              <View>
                                <CText style={{ fontFamily: "bold" }}>
                                  {transfer?.fromUserAccount ===
                                  publicKey?.toString()
                                    ? "SENT"
                                    : "RECEIVED"}
                                </CText>
                                <CText
                                  style={{ fontFamily: "reg" }}
                                  textColor="text-grey/40"
                                >
                                  {transfer?.fromUserAccount ===
                                  publicKey?.toString()
                                    ? "to " +
                                      shortenPub(transfer?.toUserAccount)
                                    : "from " +
                                      shortenPub(transfer?.fromUserAccount)}
                                </CText>
                              </View>
                            ) : (
                              <View>
                                <CText>Swapped</CText>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View className="flex flex-col justify-end">
                        {/* <CText className="text-[14px]">
                            {token?.balance?.toFixed(Math.min(token?.decimals, 2))}
                          </CText> */}
                        {isTokenTransfer && (
                          <CText
                            textColor={
                              transfer?.fromUserAccount ===
                              publicKey?.toString()
                                ? "text-red-400"
                                : "text-green-400"
                            }
                            style={{ fontFamily: "reg" }}
                            className="text-[1rem]"
                          >
                            {transfer?.fromUserAccount === publicKey?.toString()
                              ? "-"
                              : "+"}{" "}
                            {transfer?.tokenAmount} {token?.symbol}
                          </CText>
                        )}
                      </View>
                    </View>
                  </TouchableNativeFeedback>
                  <View className="bg-grey dark:bg-dark w-full p-[0.6]" />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default TokenInfo

