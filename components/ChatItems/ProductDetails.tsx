import { Image } from "expo-image";
import React, { useState } from "react";
import { Modal, ScrollView } from "react-native";
import { Pressable, View } from "react-native";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import Buttons from "../ButtonComp";
import DragableSheetModal from "@/components/CustomItems/DragableSheetModal";

interface ProductDetailsProps {
  productDetails: any;
  sessionManager: any;
  /** "jumia" | "crossmint" - used to send the correct order command */
  source?: string;
}
const ProductDetails = (props: ProductDetailsProps) => {
  const { productDetails, sessionManager, source = "crossmint" } = props;
  const [showModal, setShowModal] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Price: support object { current }, or numeric total; ensure item price is never 0 when we have a total
  const priceObj = productDetails?.price;
  const numericTotal =
    typeof priceObj === "number" && !Number.isNaN(priceObj)
      ? priceObj
      : typeof priceObj === "object" && priceObj?.current != null
        ? Number(priceObj.current)
        : Number(priceObj) || 0;
  const deliveryFee = productDetails?.delivery_fee != null ? Number(productDetails.delivery_fee) : 0;
  const explicitBase = productDetails?.base_price != null ? Number(productDetails.base_price) : NaN;
  const basePrice =
    !Number.isNaN(explicitBase) && explicitBase > 0
      ? explicitBase
      : numericTotal >= deliveryFee
        ? numericTotal - deliveryFee
        : numericTotal;
  const displayPrice = basePrice + deliveryFee;
  const displayCurrency =
    typeof priceObj === "object" && priceObj?.currency
      ? priceObj.currency
      : productDetails?.currency ?? (source === "jumia" ? "NGN" : "USD");
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
                onPress={() => setSummarySheetOpen(true)}
              />
            </View>
          </View>
        </View>
      )}

      {summarySheetOpen && (
        <DragableSheetModal
          close={() => setSummarySheetOpen(false)}
          panClose
          snapPoints={["45%", "55%"]}
          child={
            <View className="py-2 w-full gap-y-4">
              <CText style={{ fontFamily: "bold" }} className="text-lg">
                Confirm payment
              </CText>
              <CText className="text-sm text-gray-600 dark:text-gray-400">
                Do you want to proceed with this payment?
              </CText>
              <CText className="text-sm" numberOfLines={2}>
                {productDetails?.name?.slice(0, 60)}
                {(productDetails?.name?.length ?? 0) > 60 ? "…" : ""}
              </CText>
              <View className="border-t border-grey/20 dark:border-white/10 pt-3 mt-1">
                <View className="flex-row justify-between mb-2">
                  <CText className="text-sm">Item price</CText>
                  <CText className="text-sm">{displayCurrency} {basePrice.toLocaleString()}</CText>
                </View>
                <View className="flex-row justify-between mb-2">
                  <CText className="text-sm">Delivery fee</CText>
                  <CText className="text-sm">{displayCurrency} {deliveryFee.toLocaleString()}</CText>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-grey/20 dark:border-white/10">
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>Total</CText>
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>{displayCurrency} {displayPrice.toLocaleString()}</CText>
                </View>
              </View>
              <View className="flex-row gap-2 mt-2">
                <Buttons
                  type="secondary"
                  text="Cancel"
                  onPress={() => setSummarySheetOpen(false)}
                  className="flex-1 py-3"
                />
                <Buttons
                  text="Proceed with payment"
                  type="secondary"
                  onPress={() => {
                    setSummarySheetOpen(false);
                    if (source === "jumia") {
                      const link = productDetails?.link ?? productDetails?.asin ?? productDetails?.url;
                      const name = productDetails?.name ?? "Product";
                      sessionManager?.sendTextMessage(
                        `Place Jumia order for this product: link ${link}, name ${name}, quantity 1, unit price ${basePrice} NGN.`
                      );
                    } else {
                      sessionManager?.sendTextMessage(
                        `Create Amazon order for product ${productDetails?.asin}`
                      );
                    }
                  }}
                  className="flex-1 py-3"
                />
              </View>
            </View>
          }
        />
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
