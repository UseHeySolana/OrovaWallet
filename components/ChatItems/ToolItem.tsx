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
import DataPlanPicker from "./DataPlanPicker";
import ChowdeckAddressPicker from "./ChowdeckAddressPicker";
interface ItemProps {
  item: any;
  isSystem: boolean;
  aiName: string;
}

/** Tool arguments can be objects/arrays (e.g. Chowdeck modifiers); render them as readable text. */
const formatParamValue = (value: any): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        entry && typeof entry === "object"
          ? entry.option_name ?? entry.name ?? entry.label ?? JSON.stringify(entry)
          : String(entry)
      )
      .join(", ");
  }
  if (typeof value === "object") {
    return value.option_name ?? value.name ?? value.label ?? JSON.stringify(value);
  }
  return String(value);
};

/** Hide internal Chowdeck IDs/prices on the human-facing tool card. */
const CHOWDECK_HIDDEN_PARAMS = new Set([
  "vendor_id",
  "menu_id",
  "unit_price_ngn",
  "delivery_price_ngn",
  "minimum_order_ngn",
  "modifiers",
  "image",
  "place_id",
  "choice_number",
]);

const ToolItem = (props: ItemProps) => {
  const { item, isSystem, aiName } = props;
  const { sessionManager } = useAi();
  const { setToast } = AppSettings();
  const rawParams =
    (item?.tool?.arguments?.parameter &&
      Object.keys(item.tool?.arguments?.parameter)) ||
    (item.tool?.arguments && Object.keys(item.tool?.arguments)) ||
    [];
  const isChowdeckTool = item?.tool?.action?.includes("chowdeck");
  const params = isChowdeckTool
    ? rawParams.filter((p: string) => !CHOWDECK_HIDDEN_PARAMS.has(p))
    : rawParams;
  const chowdeckCartSummary = item?.chowdeckCartSummary;
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
                  : item?.tool?.action?.includes("chowdeck")
                    ? "Chowdeck"
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
                  {formatParamValue(
                    item?.tool?.arguments?.parameter
                      ? item.tool.arguments?.parameter[param]
                      : item.tool.arguments?.[param]
                  )}
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

      {chowdeckCartSummary && (
        <View className="w-full bg-[#F6ECFA] dark:bg-accent2 border border-[#971BB2]/20 rounded-2xl p-4 gap-y-2">
          <CText className="text-[0.85rem] uppercase text-[#971BB2]" style={{ fontFamily: "bold" }}>
            Cart total
          </CText>
          <CText className="text-[1rem]" style={{ fontFamily: "bold" }}>
            {chowdeckCartSummary.product_name}
            {chowdeckCartSummary.quantity > 1 ? ` × ${chowdeckCartSummary.quantity}` : ""}
          </CText>
          <CText className="text-[0.9rem] text-black/70 dark:text-grey/80">
            {chowdeckCartSummary.vendor_name}
            {chowdeckCartSummary.options_label
              ? ` · ${chowdeckCartSummary.options_label}`
              : ""}
          </CText>
          <View className="gap-y-1 mt-1">
            <CText className="text-[0.95rem]">
              Subtotal: ₦{Number(chowdeckCartSummary.subtotal_ngn).toFixed(0)}
            </CText>
            <CText className="text-[0.95rem]">
              Delivery: ₦{Number(chowdeckCartSummary.delivery_fee_ngn).toFixed(0)}
            </CText>
            <CText className="text-[1.05rem]" style={{ fontFamily: "bold" }}>
              Total: ₦{Number(chowdeckCartSummary.total_ngn).toFixed(0)} (Naira)
            </CText>
          </View>
          <View className="mt-2 bg-white dark:bg-accent rounded-xl px-3 py-2 gap-y-1">
            <CText className="text-[0.85rem] uppercase text-gray-500">Pay with</CText>
            <CText className="text-[1.1rem]" style={{ fontFamily: "bold" }}>
              {chowdeckCartSummary.amount_usdc != null
                ? `${chowdeckCartSummary.amount_usdc} USDC`
                : "USDC (rate unavailable)"}
              {chowdeckCartSummary.payment_token === "USDC" ? " · default" : ""}
            </CText>
            {chowdeckCartSummary.amount_sol != null && (
              <CText className="text-[0.9rem] text-black/70 dark:text-grey/80">
                Or about {chowdeckCartSummary.amount_sol} SOL if you prefer
              </CText>
            )}
          </View>
        </View>
      )}

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

      {item?.dataPlanPicker && (
        <DataPlanPicker
          phoneNumber={item.dataPlanPicker.phoneNumber}
          networkName={item.dataPlanPicker.networkName}
          stage={item.dataPlanPicker.stage}
          category={item.dataPlanPicker.category}
          plans={item.dataPlanPicker.plans}
        />
      )}

      {item?.chowdeckAddressPicker &&
        Array.isArray(item.chowdeckAddressPicker.options) &&
        item.chowdeckAddressPicker.options.length > 0 && (
          <ChowdeckAddressPicker
            query={item.chowdeckAddressPicker.query}
            options={item.chowdeckAddressPicker.options}
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
          source={
            item?.source ??
            (item?.tool?.action?.includes("chowdeck")
              ? "chowdeck"
              : item?.tool?.action?.includes("jumia")
                ? "jumia"
                : "crossmint")
          }
        />
      )}
    </View>
  );
};

export default ToolItem
