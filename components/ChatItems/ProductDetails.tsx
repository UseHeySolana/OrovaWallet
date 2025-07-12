import { Image } from "expo-image";
import React, { useState } from "react";
import { Modal, ScrollView } from "react-native";
import { Pressable, View } from "react-native";
import CText from "../TextComp";
import IconLibrary from "@/misc/helpers/icons";
import Buttons from "../ButtonComp";

interface ProductDetailsProps {
  productDetails: any;
  sessionManager: any;
}
const ProductDetails = (props: ProductDetailsProps) => {
  const { productDetails, sessionManager } = props;
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <>
      {productDetails && (
        <View className="w-full">
          <CText>Product Details</CText>

          <View className="flex flex-col items-center justify-start gap-x-4 bg-white dark:bg-accent shadow-lg p-2  rounded-xl  ">
          {productDetails?.images.length > 0 ? (

            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 10, paddingRight: 10 }}
            >
                {productDetails?.images.map(
                  (image: any, index: number) => (
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

              ):(
                <Image
                  source={{ uri: productDetails?.images[0] }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              )
            }
            <View className="flex-1  p-2 gap-y-2">
              <CText className="text-[16px]">
                {productDetails?.name?.slice(0, 70)}...
              </CText>
              <View className="flex flex-row justify-between items-center">
                <CText className="text-[10px]" style={{ fontFamily: "bold" }}>
                  {productDetails?.currency}
                  <CText style={{ fontFamily: "bold" }}>
                    {productDetails?.price}
                  </CText>
                </CText>

                <View className="flex flex-row justify-start items-center ">
                  {Array.from({
                    length: productDetails?.rating?.toFixed(0),
                  }).map((_, index) => (
                    <IconLibrary.star color="#FFD700" size={12} key={index} />
                  ))}
                  {Array.from({
                    length: 5 - productDetails?.rating?.toFixed(0),
                  }).map((_, index) => (
                    <IconLibrary.star color="grey" size={12} key={index} />
                  ))}

                  <CText
                    style={{ fontFamily: "reg" }}
                    className="text-[1.2rem]"
                  >
                    {productDetails?.rating?.toFixed(1)}
                  </CText>
                </View>
              </View>

              <Buttons
                text="Purchase"
                onPress={() => {
                  sessionManager?.sendTextMessage(
                    `Create order for product ${productDetails?.asin}`
                  );
                }}
              />
            </View>
          </View>
        </View>
      )}

      {showModal && (
        <Modal className="px-4" visible={showModal} onRequestClose={() => setShowModal(false)} transparent={true} animationType="fade">
          <Pressable onPress={() => setShowModal(false)} className="flex flex-col items-center justify-center bg-black/50 w-full h-full">
              <Image source={{ uri: selectedImage }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          </Pressable>
        </Modal>
      )}
    </>
  );
};

export default ProductDetails;
