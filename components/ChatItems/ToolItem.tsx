import { Image } from "expo-image";
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
} from "react-native";
import { CText } from "../TextComp";
import { openURL } from "@/utils/functions/extrafunctions";
import IconLibrary from "@/utils/icons";
import { useAi } from "@/context/AiContext";
import Products from "./Products";
import ProductDetails from "./ProductDetails";
import KalshiMarkets from "./KalshiMarkets";
import MagicBlockTransfer from "./MagicBlockTransfer";

interface ItemProps {
  item: any;
  isSystem: boolean;
  aiName: string;
}
const ToolItem = (props: ItemProps) => {
  const { item, isSystem, aiName } = props;
  const { sessionManager } = useAi();
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
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });


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
          ) : item?.tool?.action?.includes("airtime") ? (
            <View className="w-10 h-10 rounded-full overflow-hidden">
              <Image
                source={require("@/assets/apps/airbillslogo.jpg")}
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
          ) : item?.tool?.action?.includes("pajit") ||
            item?.tool?.action?.includes("naira-rate") ? (
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
                    : item?.tool?.action?.includes("airtime")
                      ? "AirBills"
                      : item?.tool?.action?.includes("swap") ||
                        item?.tool?.action?.includes("price")
                        ? "Jupiter"
                        : item?.tool?.action?.includes("private_") ||
                          item?.tool?.action?.includes("magicblock") ||
                          item?.tool?.action === "check_private_balance"
                          ? "MagicBlock"
                          : item.tool?.arguments?.owner
                            ? item?.tool?.arguments?.owner
                            : item?.tool?.action?.includes("pajit") ||
                              item?.tool?.action?.includes("naira-rate")
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

      {item?.product && (
        <Products products={item?.product} sessionManager={sessionManager} source={item?.source} />
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
