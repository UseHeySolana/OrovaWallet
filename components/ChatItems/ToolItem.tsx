import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { Pressable, View } from "react-native";
import CText from "../TextComp";
import { openURL } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import IconLibrary from "@/misc/helpers/icons";
import Buttons from "../ButtonComp";
import { useAi } from "@/misc/context/AiContext";

interface ItemProps {
  item: any;
  isSystem: boolean;
  aiName: string;
}
const ToolItem = (props: ItemProps) => {
  const { item, isSystem, aiName } = props;
  const isUser = item.role === "user";
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

  console.log(item?.product_details);

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
                {item?.tool?.action?.includes("amazon")
                  ? "Crossmint"
                  : item?.tool?.action?.includes("airtime")
                  ? "AirBills"
                  : item?.tool?.action?.includes("swap") ||
                    item?.tool?.action?.includes("price")
                  ? "Jupiter"
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
                item?.tool?.status == "pending" && {
                  transform: [{ rotate: spin }],
                },
              ]}
              contentFit="contain"
              className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
            />

            {/* <Image
                            source={
                                item.tool?.status == 'pending'
                                    ? require('@/assets/toolstatus/pending.png')
                                    : item.tool?.status == 'complete'
                                        ? require('@/assets/toolstatus/complete.png')
                                        : require('@/assets/toolstatus/failed.png')
                            }
                            style={{ width: '100%', height: '100%' }}
                            contentFit="contain"
                            className={`rounded-full ${isSystem ? "ml-2" : "mr-2"}`}
                        /> */}
          </View>
        </View>
      </View>

      <View className="bg-white z- dark:bg-accent2 p-3 rounded-xl w-full">
        <CText
          className="uppercase text-[1.23rem]"
          style={{ fontFamily: "bold" }}
        >
          {item?.tool?.arguments?.tool
            ? item?.tool?.arguments?.tool?.replace("_", " ").replace("-", " ")
            : item?.tool?.action?.replace("_", " ").replace("-", " ")}
        </CText>
        <View className="p-2 flex-1 flex-row justify-between">
          <View>
            {params?.map((param: any, index: number) => (
              <View
                key={index}
                className="flex flex-row items-center justify-start gap-x-4"
              >
                <CText className="text-[1rem] uppercase">
                  {param.replace("_", " ").replace("-", " ")}
                </CText>
                <CText className="text-[1rem]">
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
        <ScrollView
          horizontal
          className="w-screen h-fit bg-white dark:bg-accent2 p-2 rounded-xl"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 50 }}
        >
          {Object.values(item?.product)
            .slice(0, 5)
            .map((product: any, index: number) => (
              <View
                key={index}
                className="flex flex-col items-center justify-start gap-x-4 bg-white dark:bg-accent shadow-lg p-2 w-[200px] rounded-xl  "
              >
                <View className="w-full h-[100px] rounded overflow-hidden bg-white">
                  <Image
                    source={{ uri: product.image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-1  p-2 gap-y-2">
                  <CText className="text-[10px]">
                    {product.name.slice(0, 70)}...
                  </CText>
                  <View className="flex flex-row justify-between items-center">
                    <CText
                      className="text-[10px]"
                      style={{ fontFamily: "bold" }}
                    >
                      {product.currency}
                      <CText style={{ fontFamily: "bold" }}>
                        {product.price}
                      </CText>
                    </CText>

                    <View className="flex flex-row justify-start items-center ">
                      {Array.from({ length: product?.rating?.toFixed(0) }).map(
                        (_, index) => (
                          <IconLibrary.star
                            color="#FFD700"
                            size={12}
                            key={index}
                          />
                        )
                      )}
                      {Array.from({
                        length: 5 - product?.rating?.toFixed(0),
                      }).map((_, index) => (
                        <IconLibrary.star color="grey" size={12} key={index} />
                      ))}

                      <CText
                        style={{ fontFamily: "reg" }}
                        className="text-[1.2rem]"
                      >
                        {product?.rating?.toFixed(1)}
                      </CText>
                    </View>
                  </View>

                  <Buttons
                    text="Select"
                    onPress={() => {
                      sessionManager?.sendTextMessage(
                        `Select product ${product.asin} and fetch the details`
                      );
                    }}
                  />
                </View>
              </View>
            ))}
        </ScrollView>
      )}

      {item?.product_details && (
        <View>
          <CText>Product Details</CText>
        </View>
      )}
    </View>
  );
};

export default ToolItem
