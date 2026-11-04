import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAi } from "@/context/AiContext";
import type { ChowdeckAddressPickRow } from "@/utils/store/conversation.store";
import { CText } from "@/components/TextComp";
import {
  getChowdeckPlaceDetails,
} from "@/services/chowdeckApi";
import { getLiveDeliveryLocation } from "@/services/locationService";
import ToolsItem from "@/utils/store/toolsitems.store";
import ChowdeckCart, { type ChowdeckCartLocation } from "@/utils/store/chowdeck.cart.store";
import AppSettings from "@/utils/store/settingsstore.store";

const CHOWDECK_APP_NAME = "chowdeck";
const CHOWDECK_CONFIG_TYPE = "food_delivery";

type Props = {
  query: string;
  options: ChowdeckAddressPickRow[];
};

function persistResolvedPlace(place: {
  place_id: string;
  formatted_address: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const update = ToolsItem.getState().updateToolParameter;
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
    type: "delivery_address",
    value: place.formatted_address,
  });
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
    type: "place_id",
    value: place.place_id,
  });
  update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
    type: "formatted_address",
    value: place.formatted_address,
  });
  if (place.latitude != null) {
    update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
      type: "latitude",
      value: String(place.latitude),
    });
  }
  if (place.longitude != null) {
    update(CHOWDECK_APP_NAME, CHOWDECK_CONFIG_TYPE, {
      type: "longitude",
      value: String(place.longitude),
    });
  }
  ChowdeckCart.getState().setLocation({
    place_id: place.place_id,
    formatted_address: place.formatted_address,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
  });
}

/**
 * Tappable Chowdeck address suggestions on the set-chowdeck-location tool card.
 * Tap resolves and saves the address, then continues the chat.
 */
export default function ChowdeckAddressPicker({ query, options }: Props) {
  const { sendChatMessage } = useAi();
  const { setToast } = AppSettings();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [detectingLiveLocation, setDetectingLiveLocation] = useState(false);

  const savedAddresses = ChowdeckCart((s) => s.savedAddresses);

  const onUseLiveLocation = async () => {
    if (detectingLiveLocation || savingId || savedLabel) return;
    setDetectingLiveLocation(true);
    try {
      const res = await getLiveDeliveryLocation();
      if (!res.success) {
        setToast(res.message, "error");
        return;
      }
      const formatted = res.place.formatted_address || "Current Location";
      persistResolvedPlace({
        place_id: res.place.place_id,
        formatted_address: formatted,
        latitude: res.coords.latitude,
        longitude: res.coords.longitude,
      });
      setSavedLabel(formatted);
      setToast("Delivery address set to live GPS location", "success");
      sendChatMessage(
        `I set my Chowdeck delivery address to my live location: ${formatted}. Continue with my food request.`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to obtain live location";
      setToast(msg, "error");
    } finally {
      setDetectingLiveLocation(false);
    }
  };

  const onSelectSaved = async (saved: ChowdeckCartLocation) => {
    if (savingId || savedLabel || detectingLiveLocation) return;
    persistResolvedPlace(saved);
    setSavedLabel(saved.formatted_address);
    setToast("Saved address selected", "success");
    sendChatMessage(
      `I selected my Chowdeck delivery address: ${saved.formatted_address}. Continue with my food request.`
    );
  };

  const onPick = async (row: ChowdeckAddressPickRow) => {
    if (savingId || savedLabel || detectingLiveLocation) return;
    setSavingId(row.place_id);
    try {
      const details = await getChowdeckPlaceDetails(row.place_id);
      const formatted =
        details.formatted_address ||
        row.description ||
        row.label ||
        query;
      if (!details.place_id || !formatted) {
        setToast("Could not save that address. Try another.", "error");
        return;
      }
      persistResolvedPlace({
        place_id: details.place_id,
        formatted_address: formatted,
        latitude: details.latitude,
        longitude: details.longitude,
      });
      setSavedLabel(formatted);
      setToast("Delivery address saved", "success");
      sendChatMessage(
        `I selected my Chowdeck delivery address: ${formatted}. Continue with my food request.`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save address";
      setToast(msg, "error");
    } finally {
      setSavingId(null);
    }
  };

  if (savedLabel) {
    return (
      <View className="mt-3 w-full rounded-xl border border-green-600/30 dark:border-green-400/25 bg-grey/40 dark:bg-accent/50 overflow-hidden px-3 py-3">
        <CText
          style={{ fontFamily: "bold" }}
          className="text-[15px] text-green-700 dark:text-green-400"
        >
          Delivery address confirmed
        </CText>
        <CText className="text-[13px] mt-1 text-dark dark:text-white">
          {savedLabel}
        </CText>
      </View>
    );
  }

  return (
    <View className="mt-3 w-full rounded-xl border border-[#971BB2]/25 dark:border-white/15 bg-grey/40 dark:bg-accent/50 overflow-hidden">
      <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
        <CText
          style={{ fontFamily: "bold" }}
          className="text-[15px] text-dark dark:text-white"
        >
          Choose delivery location
        </CText>
        <CText className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
          Select live GPS, saved address, or a search result below
        </CText>
      </View>

      {/* Live GPS button */}
      <Pressable
        onPress={onUseLiveLocation}
        disabled={detectingLiveLocation || !!savingId}
        className="px-3 py-2.5 bg-[#971BB2]/10 dark:bg-[#971BB2]/20 border-b border-[#971BB2]/15 dark:border-white/10 flex-row items-center justify-between active:opacity-75"
      >
        <View className="flex-row items-center gap-x-2 flex-1 mr-2">
          <Ionicons name="navigate-circle" size={20} color="#971BB2" />
          <View className="flex-1">
            <CText style={{ fontFamily: "bold" }} className="text-[14px] text-[#971BB2]">
              Use my live location
            </CText>
            <CText className="text-[11px] text-gray-600 dark:text-gray-400">
              Detect GPS position automatically
            </CText>
          </View>
        </View>
        {detectingLiveLocation ? (
          <ActivityIndicator size="small" color="#971BB2" />
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#971BB2" />
        )}
      </Pressable>

      {/* Quick saved addresses */}
      {savedAddresses.length > 0 && (
        <View className="px-3 py-2 border-b border-[#971BB2]/15 dark:border-white/10">
          <CText className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5 uppercase">
            Recent / Saved
          </CText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {savedAddresses.map((addr) => (
              <Pressable
                key={addr.place_id}
                onPress={() => onSelectSaved(addr)}
                className="bg-white/80 dark:bg-accent2 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 flex-row items-center gap-x-1"
              >
                <Ionicons name="location-sharp" size={12} color="#971BB2" />
                <CText numberOfLines={1} className="text-[12px] max-w-[160px] text-dark dark:text-white">
                  {addr.formatted_address}
                </CText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Autocomplete matches */}
      {options.length > 0 && (
        <View className="w-full">
          <View className="px-3 pt-2 pb-1">
            <CText className="text-[11px] text-gray-500 dark:text-gray-400 uppercase">
              Matches for “{query}”
            </CText>
          </View>
          {options.map((row) => {
            const busy = savingId === row.place_id;
            return (
              <Pressable
                key={row.place_id}
                onPress={() => onPick(row)}
                disabled={!!savingId || detectingLiveLocation}
                className="px-3 py-2.5 border-b border-[#971BB2]/10 dark:border-white/10 active:opacity-70"
              >
                <View className="flex-row items-center justify-between gap-x-2">
                  <View className="flex-1 min-w-0">
                    <CText
                      style={{ fontFamily: "bold" }}
                      className="text-[0.92rem] text-dark dark:text-white"
                      numberOfLines={1}
                    >
                      {row.label}
                    </CText>
                    {!!row.description && (
                      <CText
                        className="text-[0.78rem] text-black/60 dark:text-grey/70 mt-0.5"
                        numberOfLines={2}
                      >
                        {row.description}
                      </CText>
                    )}
                  </View>
                  {busy ? <ActivityIndicator size="small" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
