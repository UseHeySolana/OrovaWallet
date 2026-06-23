import { Image } from "expo-image";
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
} from "react-native";
import { CText } from "../TextComp";
import { copyItem } from "@/utils/functions";
import { openURL } from "@/utils/functions/extrafunctions";
import IconLibrary from "@/utils/icons";
import { useAi } from "@/context/AiContext";
import AppSettings from "@/utils/store/settingsstore.store";
import Products from "./Products";
import ProductDetails from "./ProductDetails";
import KalshiMarkets from "./KalshiMarkets";
import MagicBlockTransfer from "./MagicBlockTransfer";
import TokenSearchPicker from "./TokenSearchPicker";

interface ItemProps {
  item: any;
  isSystem: boolean;
  aiName: string;
}
const ToolItem = (props: ItemProps) => {
  const { item, isSystem, aiName } = props;
  const { sessionManager } = useAi();
  const { setToast } = AppSettings();
  const params =
    (item?.tool?.arguments?.parameter &&
      Object.keys(item.tool?.arguments?.parameter)) ||
    (item.tool?.arguments && Object.keys(item.tool?.arguments)) ||
    [];

  const iconSource =
    item.tool?.status === "pending"
      ? require("@/assets/toolstatus/pending.png")
      : item.tool?.status === "complete"
        ? require("@/assets/toolstatus/complete.png")
        : require("@/assets/toolstatus/failed.png");

  const isPajcashTool =
    item?.tool?.action?.includes("pajcash") ||
    item?.tool?.action?.includes("pajit") ||
    item?.tool?.action?.includes("naira-rate");
  const pajcashPayment = item?.pajcashOnrampPayment;

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const AnimatedImage = Animated.createAnimatedComponent(Image);
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleCopyPajcashAccount = async () => {
    if (!pajcashPayment?.accountNumber) return;
    const copied = await copyItem(pajcashPayment.accountNumber);
    setToast(copied ? "Account number copied" : "Copy failed", copied ? "success" : "error");
  };


  return (
    <View className="py-4 shadow-sm px-4 flex flex-col items-start justify-center text-[1.14rem]  bg-white dark:bg-dark dark:border border-accent rounded-xl gap-y-3">
      <View className="flex flex-row items-center justify-between w-full bg-white dark:bg-accent2 p-1 rounded-full gap-x-3">
        <View className="flex-1 flex-row items-center gap-x-2 bg-grey dark:bg-accent p-2 rounded-full ">
          {item?.tool?.action?.includes("amazon") ||
            item?.tool?.action?.includes("product-details") ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/crossmint/logo.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : item?.tool?.action?.includes("airtime") ||
            item?.tool?.action?.includes("data") ||
            item?.tool?.action?.includes("electricity") ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/airbillslogo.jpg")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : item?.tool?.action?.includes("search_spl_tokens") ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/jup.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : item?.tool?.action?.includes("swap") ||
            item?.tool?.action?.includes("price") ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/jup.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : isPajcashTool ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/pajcas.jpg")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : item?.tool?.action?.includes("private_") ||
            item?.tool?.action?.includes("magicblock") ||
            item?.tool?.action === "check_private_balance" ? (
            <View className="w-10 h-10 rounded-full overflow-hidden bg-[#7B5CFF]/20">
              <Image
                source={require("@/assets/apps/magicblock/logo.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          ) : (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
              />
            </View>
          )}
          <View>
            {item.tool ? (
              <CText className="text-[1.23rem]" style={{ fontFamily: "bold" }}>
                {item?.tool?.action?.includes("jumia")
                  ? "Jumia"
                  : item?.tool?.action?.includes("amazon")
                    ? "Crossmint"
                    : item?.tool?.action?.includes("airtime") ||
                        item?.tool?.action?.includes("data") ||
                        item?.tool?.action?.includes("electricity")
                      ? "AirBills"
                      : item?.tool?.action?.includes("search_spl_tokens")
                        ? "Jupiter"
                        : item?.tool?.action?.includes("swap") ||
                            item?.tool?.action?.includes("price")
                          ? "Jupiter"
                        : item?.tool?.action?.includes("private_") ||
                          item?.tool?.action?.includes("magicblock") ||
                          item?.tool?.action === "check_private_balance"
                          ? "MagicBlock"
                          : item.tool?.arguments?.owner
                            ? item?.tool?.arguments?.owner
                            : isPajcashTool
                              ? "Pajcash"
                              : aiName}
              </CText>
            ) : (
              <CText className="text-[1.23rem]" style={{ fontFamily: "bold" }}>
                {item?.tool?.owner ? item?.tool?.owner : aiName}
              </CText>
            )}
            <CText>Tool Used</CText>
          </View>
        </View>

        <View>
          <View className="bg-grey dark:bg-accent p-2 w-10 h-10 rounded-full">
            <AnimatedImage
              source={iconSource}
              style={[
                { width: "100%", height: "100%" },
                item?.tool?.status === "pending" && {
                  transform: [{ rotate: spin }],
                },
              ]}
              contentFit="contain"
              className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
            />
          </View>
        </View>
      </View>

      <View className="flex-1 w-full bg-white  dark:bg-accent2 p-3 rounded-xl">
        <CText
          className="uppercase text-[1.23rem]"
          style={{ fontFamily: "bold" }}
        >
          {item?.tool?.arguments?.tool
            ? item?.tool?.arguments?.tool?.replace("_", " ").replace("-", " ")
            : item?.tool?.action?.replace("_", " ").replace("-", " ")}
        </CText>
        <View
          className="p-2 w-full flex flex-row justify-between border border-grey/0 overflow-hidden ">
          <View>
            {params?.map((param: any, index: number) => (
              <View
                key={index}
                className="flex flex-row  items-center justify-start gap-x-1"
              >
                <CText className="text-[1rem] uppercase">
                  {param.replace("_", " ").replace("-", " ")}{": "}
                </CText>

                <CText
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    minWidth: 0
                  }}
                  className="text-[1rem]">
                  {item?.tool?.arguments.parameter
                    ? item.tool.arguments?.parameter[param]
                    : item.tool.arguments[param]}
                </CText>
              </View>
            ))}
          </View>

          {item?.tool?.link && (
            <TouchableOpacity
              style={{
                zIndex: 99999999,
              }}
              onPress={() => openURL(item?.tool?.link)}
              className="p-3"
            >
              <IconLibrary.external />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {item?.messageType === "pajcash_onramp" && pajcashPayment && (
        <View className="w-full bg-[#F6ECFA] dark:bg-accent2 border border-[#971BB2]/20 rounded-2xl p-4 gap-y-3">
          <View className="flex-row items-center justify-between">
            <View>
              <CText className="text-[0.85rem] uppercase text-[#971BB2]" style={{ fontFamily: "bold" }}>
                Pajcash payment
              </CText>
              <CText className="text-[1rem]" style={{ fontFamily: "bold" }}>
                Pay {pajcashPayment.fiatAmount} NGN
              </CText>
            </View>
            <View className="bg-white dark:bg-accent rounded-full px-3 py-1">
              <CText className="text-[0.85rem]" style={{ fontFamily: "bold" }}>
                {pajcashPayment.tokenAmount} {pajcashPayment.tokenSymbol}
              </CText>
            </View>
          </View>

          <View className="bg-white dark:bg-accent rounded-xl p-3 gap-y-2">
            <CText className="text-[0.8rem] uppercase text-gray-500">Account number</CText>
            <View className="flex-row items-center justify-between gap-x-3">
              <CText className="text-[1.35rem]" style={{ fontFamily: "bold" }}>
                {pajcashPayment.accountNumber}
              </CText>
              <TouchableOpacity
                onPress={handleCopyPajcashAccount}
                activeOpacity={0.8}
                className="flex-row items-center gap-x-2 bg-[#971BB2] rounded-full px-3 py-2"
              >
                <IconLibrary.copy size={15} color="white" />
                <CText className="text-white text-[0.85rem]" style={{ fontFamily: "bold" }}>
                  Copy
                </CText>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-y-1">
            <CText className="text-[0.95rem]">Bank: {pajcashPayment.bank}</CText>
            <CText className="text-[0.95rem]">Account name: {pajcashPayment.accountName}</CText>
            <CText className="text-[0.8rem] text-gray-500">Order: {pajcashPayment.orderId}</CText>
          </View>
        </View>
      )}

      {item?.product && (
        <Products products={item?.product} sessionManager={sessionManager} source={item?.source} />
      )}

      {item?.tokenSearchPicker &&
        Array.isArray(item.tokenSearchPicker.hits) &&
        item.tokenSearchPicker.hits.length > 1 && (
          <TokenSearchPicker
            query={item.tokenSearchPicker.query}
            hits={item.tokenSearchPicker.hits}
            swapLeg={item.tokenSearchPicker.swapLeg}
          />
        )}

      {item?.messageType === "kalshi" && Array.isArray(item?.markets) && item.markets.length > 0 && (
        <KalshiMarkets markets={item.markets} sessionManager={sessionManager} />
      )}

      {item?.messageType === "magicblock" && item?.privateTransfer && (
        <MagicBlockTransfer transfer={item.privateTransfer} />
      )}

      {item?.product_details && (
        <ProductDetails
          productDetails={item?.product_details}
          sessionManager={sessionManager}
          source={item?.source ?? (item?.tool?.action?.includes("jumia") ? "jumia" : "crossmint")}
        />
      )}
    </View>
  );
};

export default ToolItem
