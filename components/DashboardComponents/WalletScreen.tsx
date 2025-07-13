import { useThemeContext } from "@/misc/context/ThemeContext";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  TouchableNativeFeedback,
  TouchableOpacity,
  View,
} from "react-native";
import CText, { CNumber } from "../TextComp";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Buttons from "../ButtonComp";
import { showToast } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Image } from "expo-image";
import { scale } from "react-native-size-matters";
import UserItem from "@/misc/store/userstore";
import { copyItem } from "@/misc/helpers/miscfunctions.ts";
import WalletItem from "@/misc/store/wallet";

const AiHelpers = [
  {
    title: "AI Assistant (Smart finance)",
    caption: "Smart Hedging & transaction analysis",
  },
  {
    title: " AI Assistant",
    caption: "Smart Ledging & transaction analysis",
  },
  {
    title: " AI Assistant",
    caption: "Smart Ledging & transaction analysis",
  },
];

interface WalletScreenProps {
  onRefresh: () => void;
  refreshing: boolean;
}

export default function WalletScreen({
  onRefresh,
  refreshing,
}: WalletScreenProps) {
  const { userWallet } = UserItem();
  const { publicKey } = WalletItem();

  const [activeItems, setActiveItems] = useState([0, 1]);
  const [activeTab, setActiveTab] = useState("tokens");
  const { isDarkMode } = useThemeContext();

  return (
    <ScrollView
      className=""
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
                  //  router.push('/dashboard/send')
                  showToast("Kindly Use Voice to send tokens");
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
            <View className="flex-1">
              <Buttons
                buttonType="feedback"
                className="py-4 rounded-full"
                onPress={() => {
                  // testFunctions()
                  router.push("/dashboard/qrcode");
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
            {/* <View className="w-[45px] h-[45px] rounded-full  bg-grey dark:bg-accent2 flex justify-center items-center">
                    <TouchableOpacity className="p-2 flex justify-center items-center">
                      <FontAwesome6 name="arrows-rotate" size={16} color={isDarkMode ? "white" : "black"} />
                    </TouchableOpacity>
                  </View> */}
          </View>
        </View>

        <View className="h-[90px] relative w-full">
          {AiHelpers.map((item, index) => {
            return (
              <View
                key={index}
                style={{
                  display: activeItems.includes(index) ? "flex" : "none",
                  position: "relative",
                  bottom: index * 70,
                  zIndex: index * -1,
                  width: `${100 - index * 4}%`,
                }}
                className="h-[80px] m-auto"
              >
                <View className="flex flex-row shadow-sm justify-start items-center gap-3 p-6 rounded-2xl bg-white dark:bg-accent">
                  <View className="h-8 w-8 rounded-full">
                    <Image
                      source={require("@/assets/images/ballicon.png")}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                    />
                  </View>
                  <View>
                    <CText
                      style={{ fontFamily: "bold" }}
                      className="text-[1.1rem]"
                    >
                      {item.title}
                    </CText>
                    <CText className="text-[1rem]">{item.caption}</CText>
                  </View>
                </View>
                <TouchableOpacity
                  className="py-2 px-3 absolute right-2 top-2 h-9 w-9 flex justify-center  items-center rounded-full bg-grey dark:bg-accent2 text-white"
                  onPress={() => {}}
                >
                  <MaterialCommunityIcons
                    name="greater-than"
                    size={12}
                    color={isDarkMode ? "white" : "black"}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View className="w-full min-h-[400px]  pb-[60px] shadow-md m-auto bg-white dark:bg-accent overflow-hidden rounded-3xl">
          <View className="flex flex-row items-center justify-between">
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple("#971BB2", false)}
              onPress={() => setActiveTab("tokens")}
            >
              <View
                className={`w-[50%] py-5 border-b-2 ${
                  activeTab == "tokens" ? "border-purple" : "border-grey"
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
                className={`w-[50%] py-5 border-b-2 ${
                  activeTab == "history"
                    ? "border-purple"
                    : "border-grey dark:border-dark"
                } `}
              >
                <CText className="text-[1.1rem] text-center">History</CText>
              </View>
            </TouchableNativeFeedback>
          </View>

          {activeTab == "tokens" ? (
            <View className="flex-1">
              <View className="py-5 w-full">
                <TouchableOpacity className="bg-grey dark:bg-accent2 rounded-full  m-auto w-10/12 flex flex-row justify-center items-center gap-x-4 p-3">
                  <FontAwesome name="sliders" size={14} color="black" />
                  <CText>Manage tokens</CText>
                </TouchableOpacity>
              </View>
              {userWallet?.tokenAccounts?.map((token: any, index: number) => {
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
                        <View className="flex flex-row items-start gap-x-2">
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
                        <View className="flex flex-col justify-end">
                          {/* <CText className="text-[14px]">
                            {token?.balance?.toFixed(Math.min(token?.decimals, 2))}
                          </CText> */}
                          <CText
                            style={{ fontFamily: "bold" }}
                            className="text-[16px]"
                          >
                            $
                            <CNumber
                              value={
                                token?.usdc_price
                                  ? token?.usdc_price?.toFixed(2)
                                  : 0
                              }
                              className="text-[16px]"
                            />
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
            <View className="flex-1 justify-center items-center">
              <CText>No Transaction History yet!</CText>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
