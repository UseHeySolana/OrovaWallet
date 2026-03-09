import React, { useEffect, useState } from "react";
import { View } from "react-native";
import CText from "../TextComp";
import Buttons from "../ButtonComp";
import DragableSheetModal from "@/components/CustomItems/DragableSheetModal";
import {
  PurchaseConfirmationOptions,
  setPurchaseConfirmFn,
} from "@/services/purchaseConfirmation";

let resolver: ((value: boolean) => void) | null = null;

const PurchaseConfirmationSheet = () => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<PurchaseConfirmationOptions | null>(
    null
  );

  const askConfirmation = (
    opts: PurchaseConfirmationOptions
  ): Promise<boolean> => {
    setOptions(opts);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  };

  useEffect(() => {
    setPurchaseConfirmFn(askConfirmation);
  }, []);

  if (!visible || !options) return null;

  const { productDetails, source } = options;
  const basePrice = Number(productDetails.base_price) || 0;
  const deliveryFee = Number(productDetails.delivery_fee) || 0;
  const displayPrice = basePrice + deliveryFee;
  const displayCurrency =
    productDetails.currency ?? (source === "jumia" ? "NGN" : "USD");
  const hasPriceBreakdown = basePrice > 0 || deliveryFee > 0;
  const productName = productDetails.name ?? "Product";

  const handleClose = (confirmed: boolean) => {
    setVisible(false);
    setOptions(null);
    resolver?.(confirmed);
    resolver = null;
  };

  return (
    <DragableSheetModal
      close={() => handleClose(false)}
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
            {productName.slice(0, 60)}
            {productName.length > 60 ? "…" : ""}
          </CText>
          <View className="border-t border-grey/20 dark:border-white/10 pt-3 mt-1">
            {hasPriceBreakdown ? (
              <>
                <View className="flex-row justify-between mb-2">
                  <CText className="text-sm">Item price</CText>
                  <CText className="text-sm">
                    {displayCurrency} {basePrice.toLocaleString()}
                  </CText>
                </View>
                <View className="flex-row justify-between mb-2">
                  <CText className="text-sm">Delivery fee</CText>
                  <CText className="text-sm">
                    {displayCurrency} {deliveryFee.toLocaleString()}
                  </CText>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-grey/20 dark:border-white/10">
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>
                    Total
                  </CText>
                  <CText className="text-sm" style={{ fontFamily: "bold" }}>
                    {displayCurrency} {displayPrice.toLocaleString()}
                  </CText>
                </View>
              </>
            ) : (
              <CText className="text-sm text-gray-600 dark:text-gray-400">
                Final total will be confirmed when the order is placed.
              </CText>
            )}
          </View>
          <View className="flex-row gap-2 mt-2">
            <Buttons
              // type="secondary"
              text="Cancel"
              onPress={() => handleClose(false)}
              className="flex-1 py-3 rounded-full"
            />
            <Buttons
              text="Proceed with payment"
              // type="secondary"
              onPress={() => handleClose(true)}
              className="flex-grow py-3 rounded-full"
            />
          </View>
        </View>
      }
    />
  );
};

export default PurchaseConfirmationSheet;
