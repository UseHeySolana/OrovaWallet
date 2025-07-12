import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

interface ProductProps {
  products: any;
  sessionManager: any;
}

const Products = (props: ProductProps) => {
  const { products, sessionManager } = props;

  return (
    <>
      {products && (
        <ScrollView
          horizontal
          className="w-screen h-fit bg-white dark:bg-accent2 p-2 rounded-xl"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 50 }}
        >
          {Object.values(products)
            .slice(0, 5)
            .map((product: any, index: number) => (
              <View
                key={index}
                className="flex flex-col items-center justify-start gap-x-4 bg-white dark:bg-accent shadow-lg p-2 w-[200px] rounded-xl  "
              >
                <View className="w-full h-[100px] rounded overflow-hidden bg-white">
                  <Image
                    source={{ uri: product?.image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="contain"
                  />
                </View>
                <View className="flex-1  p-2 gap-y-2">
                  <CText className="text-[10px]">
                    {product?.name?.slice(0, 70)}...
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
                        `Select product ${product?.asin} and fetch the details`
                      );
                    }}
                  />
                </View>
              </View>
            ))}
        </ScrollView>
      )}
    </>
  );
};

export default Products;
