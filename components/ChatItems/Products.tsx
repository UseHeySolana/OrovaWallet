import { Image } from "expo-image";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { v4 as uuidv4 } from "uuid";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import Buttons from "../ButtonComp";
import { useAi } from "@/context/AiContext";
import { getChowdeckMenuItem } from "@/services/chowdeckApi";
import { upsertCommercePendingIntent } from "@/services/commerceIntents";
import ChowdeckCart from "@/utils/store/chowdeck.cart.store";
import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { getPublicSettings } from "@/services/settingsApi";
import tracker from "@/utils/tracker";

interface ProductProps {
  products: any;
  sessionManager: any;
  source: string;
}

function starCount(rating: unknown): number {
  const n = Number(rating);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.max(0, Math.round(n)));
}

const Products = (props: ProductProps) => {
  const { products, source } = props;
  const { sendChatMessage, conversationId, sessionManager } = useAi();
  const { setToast } = AppSettings();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  /** Show a clean user line in chat; send tool refs only to the model. */
  const sendFriendlyChowdeckSelect = (
    friendly: string,
    modelContext: string
  ) => {
    const activeConversationId = conversationId || "";
    if (activeConversationId) {
      Convo.getState().setMessages({
        id: uuidv4(),
        role: "user",
        content: friendly,
        timestamp: Date.now(),
        conversation_id: activeConversationId,
        source: "chat",
      });
    }
    if (sessionManager?.sendTextMessage) {
      sessionManager.sendTextMessage(
        `${friendly}\n\n(For tools only — never read aloud or show to the user: ${modelContext})`
      );
    } else {
      sendChatMessage(friendly);
    }
  };

  const selectChowdeck = async (product: any) => {
    if (product?.is_vendor_open === false) return;
    const menuId = Number(product?.menu_id ?? product?.asin);
    const vendorId = Number(product?.vendor_id);
    const vendorName = String(product?.vendor_name ?? "").trim();
    const delivery = Number(product?.delivery_fee ?? 0) || 0;
    const minOrder = Number(product?.minimum_order_ngn ?? 0) || 0;
    const key = `${vendorId}:${menuId}`;

    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(vendorId) || vendorId <= 0) {
      sendChatMessage(
        `I'd like to order "${product?.name ?? "this dish"}" from Chowdeck. Please show options and add it to my cart.`
      );
      return;
    }

    if (loadingKey) return;
    setLoadingKey(key);

    try {
      const cart = ChowdeckCart.getState();
      const cartVendor = cart.vendor;
      const cartLocked =
        !!cartVendor && cart.lines.length > 0 && cartVendor.id !== vendorId;

      if (cartLocked) {
        setToast(
          `Your cart is at ${cartVendor!.name}. Clear it first to order from another restaurant.`,
          "error"
        );
        sendFriendlyChowdeckSelect(
          `I tried to pick ${product?.name ?? "an item"} from ${vendorName || "another restaurant"}, but my cart already has food from ${cartVendor!.name}.`,
          `Cart locked to vendor_id=${cartVendor!.id} (${cartVendor!.name}). Other selection was vendor_id=${vendorId}, menu_id=${menuId}. Ask if they want to clear-chowdeck-cart or keep shopping at ${cartVendor!.name}.`
        );
        return;
      }

      void tracker.activity("commerce", "chowdeck_product_select", {
        provider: "chowdeck",
        menu_id: menuId,
        vendor_id: vendorId,
        vendor_name: vendorName,
        product_name: product?.name,
      });

      const item = await getChowdeckMenuItem(vendorId, menuId);
      let deliveryFee = delivery;
      if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
        try {
          const settings = await getPublicSettings();
          deliveryFee = settings.delivery_fee_chowdeck_ngn ?? 0;
        } catch {
          deliveryFee = 0;
        }
      }

      // Only set vendor when cart is empty or already this restaurant — never wipe lines.
      if (!cartVendor || cart.lines.length === 0 || cartVendor.id === vendorId) {
        ChowdeckCart.getState().setVendor({
          id: vendorId,
          name: vendorName || cartVendor?.name || "Restaurant",
          delivery_price_ngn: deliveryFee,
          minimum_order_ngn: minOrder,
        });
      }

      const details = {
        name: item.name,
        brand: vendorName || "",
        price: { current: item.price_ngn, original: item.price_ngn, currency: "NGN" },
        images: item.image ? [item.image] : (item.images ?? []).map((i) => i.path),
        rating: Number(product?.rating) || 0,
        link: String(item.menu_id),
        url: String(item.menu_id),
        availability: item.in_stock,
        description: item.description,
        modifiers: item.modifiers,
        menu_id: item.menu_id,
        vendor_id: vendorId,
        vendor_name: vendorName,
        delivery_fee: deliveryFee,
        base_price: item.price_ngn,
      };

      const activeConversationId = conversationId || "";
      if (activeConversationId) {
        Convo.getState().setMessages({
          id: uuidv4(),
          role: "system",
          content: `Loaded ${item.name}.`,
          timestamp: Date.now(),
          conversation_id: activeConversationId,
          product_details: details,
          source: "chowdeck",
        });
      }

      void upsertCommercePendingIntent({
        provider: "chowdeck",
        intent_type: "product_selected",
        title: "Finish your Chowdeck order",
        body: `You were looking at ${item.name}${vendorName ? ` from ${vendorName}` : ""}. Open HeySolana to continue.`,
        metadata: {
          menu_id: menuId,
          vendor_id: vendorId,
          vendor_name: vendorName,
          product_name: item.name,
          price_ngn: item.price_ngn,
        },
        remind_after_minutes: 30,
      });

      const requiredMods = (item.modifiers || []).filter((g) => Number(g.minimum_selection) > 0);
      const requiredNames = requiredMods.map((g) => g.name).filter(Boolean);
      const friendly =
        requiredNames.length > 0
          ? `I selected ${item.name}${vendorName ? ` from ${vendorName}` : ""}.`
          : `I selected ${item.name}${vendorName ? ` from ${vendorName}` : ""}. Please add it to my cart.`;
      sendFriendlyChowdeckSelect(
        friendly,
        `vendor_id=${vendorId}, menu_id=${menuId}, vendor_name=${JSON.stringify(vendorName)}, product_name=${JSON.stringify(item.name)}, unit_price_ngn=${item.price_ngn}, delivery_price_ngn=${deliveryFee}, minimum_order_ngn=${minOrder}${
          requiredNames.length
            ? `. Ask for required options by name (${requiredNames.join(", ")}), then add-chowdeck-to-cart.`
            : `. Call add-chowdeck-to-cart with these values.`
        }`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load that dish";
      setToast(msg, "error");
      sendFriendlyChowdeckSelect(
        `I selected ${product?.name ?? "a dish"}${vendorName ? ` from ${vendorName}` : ""}.`,
        `vendor_id=${vendorId}, menu_id=${menuId}. Load get-chowdeck-menu-item then add-chowdeck-to-cart. Never mention ids.`
      );
    } finally {
      setLoadingKey(null);
    }
  };

  const selectGeneric = (product: any) => {
    void tracker.activity("commerce", `${source || "commerce"}_product_select`, {
      provider: source,
      asin: product?.asin,
      product_name: product?.name,
    });
    void upsertCommercePendingIntent({
      provider: source || "commerce",
      intent_type: "product_selected",
      title: "Finish browsing in HeySolana",
      body: `You were looking at ${product?.name ?? "an item"}. Open the app to continue.`,
      metadata: {
        asin: product?.asin,
        product_name: product?.name,
        price: product?.price,
      },
      remind_after_minutes: 60,
    });
    sendChatMessage(
      `Select product ${product?.asin} and fetch the details from ${source}`
    );
  };

  return (
    <>
      {products && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 50 }}
          keyboardShouldPersistTaps="handled"
        >
          {Object.values(products)
            .slice(0, source === "chowdeck" ? 12 : 5)
            .map((product: any, index: number) => {
              const filled = starCount(product?.rating);
              const key = `${product?.vendor_id ?? "x"}:${product?.menu_id ?? product?.asin ?? index}`;
              const busy = loadingKey === key;
              const closed =
                source === "chowdeck" && product?.is_vendor_open === false;

              return (
                <View
                  key={key}
                  className="flex flex-col items-center justify-start gap-x-4 bg-white dark:bg-accent shadow-lg p-2 w-[200px] rounded-xl"
                >
                  <View className="w-full h-[100px] rounded overflow-hidden bg-black/5 dark:bg-black/20">
                    <Image
                      source={{ uri: product?.image }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                  <View className="flex-1 p-2 gap-y-2 w-full">
                    <CText className="text-[10px]" numberOfLines={3}>
                      {product?.name}
                    </CText>
                    <View className="flex flex-row justify-between items-center">
                      <CText
                        className="text-[10px]"
                        style={{ fontFamily: "bold" }}
                      >
                        {source === "chowdeck" ||
                        product.currency === "₦" ||
                        product.currency === "NGN"
                          ? `₦${product.price}`
                          : `${product.currency}${product.price}`}
                      </CText>

                      <View className="flex flex-row justify-start items-center">
                        {Array.from({ length: filled }).map((_, i) => (
                          <IconLibrary.star
                            color="#FFD700"
                            size={12}
                            key={`f-${i}`}
                          />
                        ))}
                        {Array.from({ length: 5 - filled }).map((_, i) => (
                          <IconLibrary.star
                            color="grey"
                            size={12}
                            key={`e-${i}`}
                          />
                        ))}
                        <CText
                          style={{ fontFamily: "reg" }}
                          className="text-[1.2rem]"
                        >
                          {Number(product?.rating || 0).toFixed(1)}
                        </CText>
                      </View>
                    </View>

                    {closed && (
                      <CText
                        className="text-[10px] text-red-600 dark:text-red-400"
                        style={{ fontFamily: "bold" }}
                      >
                        Restaurant closed
                      </CText>
                    )}

                    {busy ? (
                      <View className="py-3 items-center justify-center">
                        <ActivityIndicator size="small" color="#971BB2" />
                      </View>
                    ) : (
                      <Buttons
                        compact
                        text={closed ? "Closed" : "Select"}
                        onPress={() => {
                          if (source === "chowdeck") {
                            void selectChowdeck(product);
                            return;
                          }
                          selectGeneric(product);
                        }}
                      />
                    )}
                  </View>
                </View>
              );
            })}
        </ScrollView>
      )}
    </>
  );
};

export default Products;
