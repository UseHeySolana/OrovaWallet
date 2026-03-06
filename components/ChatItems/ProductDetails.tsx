import { Image } from "expo-image";
import React, { useState } from "react";
import { Modal, ScrollView } from "react-native";
import { Pressable, View } from "react-native";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import Buttons from "../ButtonComp";

interface ProductDetailsProps {
  productDetails: any;
  sessionManager: any;
  /** "jumia" | "crossmint" - used to send the correct order command */
  source?: string;
}
const ProductDetails = (props: ProductDetailsProps) => {
  const { productDetails, sessionManager, source = "crossmint" } = props;
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const displayPrice =
    typeof productDetails?.price === "object" && productDetails?.price?.current != null
      ? productDetails.price.current
      : productDetails?.price ?? 0;
  const displayCurrency =
    typeof productDetails?.price === "object" && productDetails?.price?.currency
      ? productDetails.price.currency
      : productDetails?.currency ?? "";
  const rating = Number(productDetails?.rating) || 0;

  return (
    <>
      {productDetails && (
        <View className="w-full">
          <View className="flex flex-col items-center justify-start gap-x-4 bg-white dark:bg-accent shadow-lg p-2  rounded-xl  ">
            {productDetails?.images?.length > 0 ? (
              <ScrollView
                horizontal
                contentContainerStyle={{ gap: 10, paddingRight: 10 }}
              >
                {productDetails?.images?.map((image: any, index: number) => (
                  <Pressable
                    key={index}
                    className="w-[100px]  h-[100px] p-3 bg-white rounded-xl overflow-hidden"
                    onPress={() => {
                      setSelectedImage(image);
                      setShowModal(true);
                    }}
                  >
                    <Image
                      source={{ uri: image }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Pressable
                className="w-[100px]  h-[100px] p-3 bg-white rounded-xl overflow-hidden"
                onPress={() => {
                  setSelectedImage(productDetails?.images?.[0]);
                  setShowModal(true);
                }}
              >
                <Image
                  source={{ uri: productDetails?.images?.[0] }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              </Pressable>
            )}
            <View className="flex-1  p-2 gap-y-2">
              <CText className="text-[16px]">
                {productDetails?.name?.slice(0, 70)}...
              </CText>
              <View className="flex flex-row justify-between items-center">
                <CText className="text-[10px]" style={{ fontFamily: "bold" }}>
                  {displayCurrency}
                  <CText style={{ fontFamily: "bold" }}>
                    {displayPrice}
                  </CText>
                </CText>

                <View className="flex flex-row justify-start items-center ">
                  {Array.from({ length: Math.min(5, Math.round(rating)) }).map(
                    (_, index) => (
                      <IconLibrary.star color="#FFD700" size={12} key={index} />
                    )
                  )}
                  {Array.from({
                    length: 5 - Math.min(5, Math.round(rating)),
                  }).map((_, index) => (
                    <IconLibrary.star color="grey" size={12} key={index} />
                  ))}

                  <CText
                    style={{ fontFamily: "reg" }}
                    className="text-[1.2rem]"
                  >
                    {rating.toFixed(1)}
                  </CText>
                </View>
              </View>

              <Buttons
                text="Purchase"
                onPress={() => {
                  if (source === "jumia") {
                    const link = productDetails?.link ?? productDetails?.asin ?? productDetails?.url;
                    const name = productDetails?.name ?? "Product";
                    const price = productDetails?.price?.current ?? productDetails?.price ?? 0;
                    sessionManager?.sendTextMessage(
                      `Place Jumia order for this product: link ${link}, name ${name}, quantity 1, unit price ${price} NGN.`
                    );
                  } else {
                    sessionManager?.sendTextMessage(
                      `Create Amazon order for product ${productDetails?.asin}`
                    );
                  }
                }}
              />
            </View>
          </View>
        </View>
      )}

      {showModal && (
        <Modal
          className="px-4"
          visible={showModal}
          onRequestClose={() => setShowModal(false)}
          transparent={true}
          animationType="fade"
        >
          <Pressable
            onPress={() => setShowModal(false)}
            className="flex flex-col items-center justify-center bg-black/50 w-full h-full"
          >
            <Image
              source={{ uri: selectedImage || "" }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </Pressable>
        </Modal>
      )}
    </>
  );
};

export default ProductDetails;
