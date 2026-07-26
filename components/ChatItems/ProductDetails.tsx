import { Image } from "expo-image";
import React, { useState } from "react";
import { Modal, ScrollView } from "react-native";
import { Pressable, View } from "react-native";
import { v4 as uuidv4 } from "uuid";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import Buttons from "../ButtonComp";
import DragableSheetModal from "@/components/CustomItems/DragableSheetModal";
import { useAi } from "@/context/AiContext";
import Convo from "@/utils/store/conversation.store";

interface ProductDetailsProps {
  productDetails: any;
  sessionManager: any;
  /** "jumia" | "crossmint" | "chowdeck" - used to send the correct order command */
  source?: string;
}
const ProductDetails = (props: ProductDetailsProps) => {
  const { productDetails, sessionManager, source = "crossmint" } = props;
  const { sendChatMessage, conversationId } = useAi();
  const [showModal, setShowModal] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const isChowdeck = source === "chowdeck";
  const isNgn = source === "jumia" || isChowdeck;

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
  const displayPrice = isChowdeck ? basePrice : basePrice + deliveryFee;
  const displayCurrency =
    typeof priceObj === "object" && priceObj?.currency
      ? priceObj.currency
      : productDetails?.currency ?? (isNgn ? "NGN" : "USD");
  const rating = Number(productDetails?.rating) || 0;
  const modifierGroups = Array.isArray(productDetails?.modifiers)
    ? productDetails.modifiers
    : [];

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
                    className={`w-[100px] h-[100px] rounded-xl overflow-hidden ${
                      isChowdeck ? "bg-black/5" : "p-3 bg-white"
                    }`}
                    onPress={() => {
                      setSelectedImage(image);
                      setShowModal(true);
                    }}
                  >
                    <Image
                      source={{ uri: image }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit={isChowdeck ? "cover" : "contain"}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Pressable
                className={`w-[100px] h-[100px] rounded-xl overflow-hidden ${
                  isChowdeck ? "bg-black/5" : "p-3 bg-white"
                }`}
                onPress={() => {
                  setSelectedImage(productDetails?.images?.[0]);
                  setShowModal(true);
                }}
              >
                <Image
                  source={{ uri: productDetails?.images?.[0] }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit={isChowdeck ? "cover" : "contain"}
                />
              </Pressable>
            )}
            <View className="flex-1  p-2 gap-y-2">
              <CText className="text-[16px]">
                {productDetails?.name?.slice(0, 70)}...
              </CText>
              <View className="flex flex-row justify-between items-center">
                <CText className="text-[10px]" style={{ fontFamily: "bold" }}>
                  {isNgn ? `₦${displayPrice}` : `${displayCurrency} ${displayPrice}`}
                  {isChowdeck ? " (Naira)" : ""}
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

              {modifierGroups.length > 0 && (
                <View className="gap-y-1 mt-1">
                  <CText className="text-[11px]" style={{ fontFamily: "bold" }}>
                    Sides & options
                  </CText>
                  {modifierGroups.slice(0, 5).map((group: any) => (
                    <CText key={String(group?.id)} className="text-[10px] text-gray-600 dark:text-gray-400">
                      {group?.name}
                      {Number(group?.minimum_selection) > 0 ? " (required)" : " (optional)"}:{" "}
                      {(group?.items ?? [])
                        .slice(0, 5)
                        .map((opt: any) =>
                          opt?.price_ngn > 0
                            ? `${opt?.name} (+₦${opt.price_ngn})`
                            : opt?.name
                        )
                        .filter(Boolean)
                        .join(", ")}
                      {(group?.items?.length ?? 0) > 5 ? "…" : ""}
                    </CText>
                  ))}
                </View>
              )}

              <Buttons
                text={isChowdeck ? "Add to cart" : "Purchase"}
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
          snapPoints={isChowdeck ? ["50%", "65%"] : ["45%", "55%"]}
          child={
            <View className="py-2 w-full gap-y-4">
              <CText style={{ fontFamily: "bold" }} className="text-lg">
                {isChowdeck ? "Add to cart" : "Confirm payment"}
              </CText>
              <CText className="text-sm text-gray-600 dark:text-gray-400">
                {isChowdeck
                  ? "Tell the assistant any required options, then add this item to your cart."
                  : "Do you want to proceed with this payment?"}
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
                {!isChowdeck && (
                  <View className="flex-row justify-between mb-2">
                    <CText className="text-sm">Delivery fee</CText>
                    <CText className="text-sm">{displayCurrency} {deliveryFee.toLocaleString()}</CText>
                  </View>
                )}
                {isChowdeck && deliveryFee > 0 && (
                  <View className="flex-row justify-between mb-2">
                    <CText className="text-sm">Est. delivery (cart)</CText>
                    <CText className="text-sm">{displayCurrency} {deliveryFee.toLocaleString()}</CText>
                  </View>
                )}
                <View className="flex-row justify-between pt-2 border-t border-grey/20 dark:border-white/10">
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>
                    {isChowdeck ? "Item" : "Total"}
                  </CText>
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>
                    {displayCurrency} {displayPrice.toLocaleString()}
                  </CText>
                </View>
              </View>
              <View className="flex-row gap-2 mt-2">
                <Buttons
                  text="Cancel"
                  onPress={() => setSummarySheetOpen(false)}
                  className="flex-1 py-3 rounded-full"
                />
                <Buttons
                  text={isChowdeck ? "Add with assistant" : "Proceed with payment"}
                  className="flex-grow py-3 rounded-full"
                  onPress={() => {
                    setSummarySheetOpen(false);
                    if (source === "jumia") {
                      const name = productDetails?.name ?? "Product";
                      sendChatMessage(
                        `Please place my Jumia order for ${name}, quantity 1.`
                      );
                    } else if (isChowdeck) {
                      const name = productDetails?.name ?? "Item";
                      const vendorName = productDetails?.vendor_name || productDetails?.brand || "";
                      const menuId = productDetails?.menu_id ?? productDetails?.link ?? productDetails?.url;
                      const vendorId = productDetails?.vendor_id;
                      const required = modifierGroups
                        .filter((g: any) => Number(g?.minimum_selection) > 0)
                        .map((g: any) => g?.name)
                        .filter(Boolean);
                      const friendly = `Please add ${name}${vendorName ? ` from ${vendorName}` : ""} to my cart.`;
                      const activeId = conversationId || "";
                      if (activeId) {
                        Convo.getState().setMessages({
                          id: uuidv4(),
                          role: "user",
                          content: friendly,
                          timestamp: Date.now(),
                          conversation_id: activeId,
                          source: "chat",
                        });
                      }
                      const modelHint = `vendor_id=${vendorId}, menu_id=${menuId}, unit_price_ngn=${basePrice}, delivery_price_ngn=${deliveryFee}, product_name=${JSON.stringify(name)}, vendor_name=${JSON.stringify(vendorName)}${
                        required.length
                          ? `. Ask for: ${required.join(", ")}, then add-chowdeck-to-cart.`
                          : `. Call add-chowdeck-to-cart.`
                      } Never mention ids.`;
                      if (sessionManager?.sendTextMessage) {
                        sessionManager.sendTextMessage(
                          `${friendly}\n\n(For tools only — never read aloud: ${modelHint})`
                        );
                      } else {
                        sendChatMessage(friendly);
                      }
                    } else {
                      sessionManager?.sendTextMessage?.(
                        `Create Amazon order for product ${productDetails?.asin}`
                      );
                    }
                  }}
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
