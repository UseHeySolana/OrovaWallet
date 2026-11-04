import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import ToolsItem from "@/utils/store/toolsitems.store";
import CText from "../TextComp";
import {
  autocompleteChowdeckPlace,
  getChowdeckPlaceDetails,
  type ChowdeckPlacePrediction,
} from "@/services/chowdeckApi";
import { getLiveDeliveryLocation } from "@/services/locationService";
import AppSettings from "@/utils/store/settingsstore.store";
import ChowdeckCart from "@/utils/store/chowdeck.cart.store";

interface ChowdeckAddressParamProps {
  appData: any;
  item: any;
  param: any;
}

const CONFIG_TYPE = "food_delivery";

function persistResolvedPlace(
  appName: string,
  configType: string,
  place: {
    place_id: string;
    formatted_address: string;
    latitude?: number | null;
    longitude?: number | null;
  }
) {
  const update = ToolsItem.getState().updateToolParameter;
  update(appName, configType, { type: "delivery_address", value: place.formatted_address });
  update(appName, configType, { type: "place_id", value: place.place_id });
  update(appName, configType, {
    type: "formatted_address",
    value: place.formatted_address,
  });
  if (place.latitude != null) {
    update(appName, configType, { type: "latitude", value: String(place.latitude) });
  }
  if (place.longitude != null) {
    update(appName, configType, { type: "longitude", value: String(place.longitude) });
  }
  ChowdeckCart.getState().setLocation({
    place_id: place.place_id,
    formatted_address: place.formatted_address,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
  });
}

/**
 * Type-to-search Chowdeck delivery address using place autocomplete.
 * Saves place_id / lat / lng under the hood; user only sees the address text.
 */
const ChowdeckAddressParam = ({ appData, item, param }: ChowdeckAddressParamProps) => {
  const appName = appData?.slug || appData?.name;
  const configType = item?.name || CONFIG_TYPE;
  const { setToast } = AppSettings();
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [predictions, setPredictions] = useState<ChowdeckPlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [detectingLive, setDetectingLive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const handleUseLiveLocation = async () => {
    if (detectingLive || resolving) return;
    setDetectingLive(true);
    try {
      const res = await getLiveDeliveryLocation();
      if (!res.success) {
        setToast(res.message, "error");
        return;
      }
      const formatted = res.place.formatted_address || "Current Location";
      persistResolvedPlace(appName, configType, {
        place_id: res.place.place_id,
        formatted_address: formatted,
        latitude: res.coords.latitude,
        longitude: res.coords.longitude,
      });
      setSelectedLabel(formatted);
      setQuery(formatted);
      setToast("Delivery address set to live GPS position", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to obtain live location";
      setToast(msg, "error");
    } finally {
      setDetectingLive(false);
    }
  };

  useEffect(() => {
    const saved =
      ToolsItem.getState().getParameterValue(appName, configType, "delivery_address") ||
      ToolsItem.getState().getParameterValue(appName, configType, "formatted_address") ||
      "";
    setSelectedLabel(saved);
    setQuery(saved);
  }, [appName, configType]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runAutocomplete = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const reqId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await autocompleteChowdeckPlace(trimmed);
        if (reqId !== requestIdRef.current) return;
        setPredictions(results.slice(0, 8));
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        setPredictions([]);
        const msg = e instanceof Error ? e.message : "Address lookup failed";
        setToast(msg, "error");
      } finally {
        if (reqId === requestIdRef.current) setSearching(false);
      }
    }, 350);
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    setSelectedLabel("");
    // Clear resolved place until they pick a suggestion
    ToolsItem.getState().updateToolParameter(appName, configType, {
      type: "delivery_address",
      value: "",
    });
    ToolsItem.getState().updateToolParameter(appName, configType, {
      type: "place_id",
      value: "",
    });
    runAutocomplete(text);
  };

  const selectPrediction = async (prediction: ChowdeckPlacePrediction) => {
    setResolving(true);
    setPredictions([]);
    try {
      const details = await getChowdeckPlaceDetails(prediction.place_id);
      const formatted =
        details.formatted_address ||
        prediction.description ||
        prediction.structured_formatting?.main_text ||
        "";
      if (!details.place_id || !formatted) {
        setToast("Could not resolve that address. Try another.", "error");
        return;
      }
      persistResolvedPlace(appName, configType, {
        place_id: details.place_id,
        formatted_address: formatted,
        latitude: details.latitude,
        longitude: details.longitude,
      });
      setSelectedLabel(formatted);
      setQuery(formatted);
      setToast("Delivery address saved", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save address";
      setToast(msg, "error");
    } finally {
      setResolving(false);
    }
  };

  const label = param?.label || "Delivery address";
  const placeholder =
    param?.placeholder || "Street + area (e.g. 12 Ademola Cres, Mpape)";
  const helper =
    param?.helper ||
    "Include a street or landmark — short area names often return one generic match.";

  return (
    <View className="w-full">
      <CText className="text-[0.95rem] mb-1" style={{ fontFamily: "reg" }}>
        {label}
      </CText>
      <CText className="text-[0.85rem] mb-2 text-black/70 dark:text-grey/70" style={{ fontFamily: "reg" }}>
        {helper} Tap a suggestion to save it.
      </CText>
      <Pressable
        onPress={handleUseLiveLocation}
        disabled={detectingLive || resolving}
        className="mb-2.5 py-2.5 px-3 bg-[#971BB2]/10 dark:bg-[#971BB2]/20 rounded-xl border border-[#971BB2]/25 flex-row items-center justify-between active:opacity-75"
      >
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="navigate-circle" size={18} color="#971BB2" />
          <CText style={{ fontFamily: "bold" }} className="text-[13px] text-[#971BB2]">
            Use current GPS location
          </CText>
        </View>
        {detectingLive ? (
          <ActivityIndicator size="small" color="#971BB2" />
        ) : (
          <Ionicons name="chevron-forward" size={14} color="#971BB2" />
        )}
      </Pressable>
      <View className="w-full relative">
        <TextInput
          className="w-full h-[44px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-2 pr-10"
          value={query}
          placeholder={placeholder}
          placeholderTextColor="grey"
          onChangeText={handleChangeText}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {(searching || resolving) && (
          <View className="absolute right-3 top-3">
            <ActivityIndicator size="small" />
          </View>
        )}
      </View>

      {selectedLabel ? (
        <CText className="text-[0.85rem] mt-2 text-green-700 dark:text-green-400" style={{ fontFamily: "reg" }}>
          Saved: {selectedLabel}
        </CText>
      ) : null}

      {predictions.length > 0 && (
        <View className="w-full mt-2 rounded-xl border border-grey dark:border-accent2 overflow-hidden bg-white dark:bg-black">
          {predictions.map((p) => {
            // Prefer full description — Chowdeck main_text is often just the area name.
            const main =
              p.description ||
              p.structured_formatting?.main_text ||
              "Address";
            const secondary =
              p.description && p.structured_formatting?.main_text
                ? p.structured_formatting?.secondary_text &&
                  !p.description.includes(p.structured_formatting.secondary_text)
                  ? p.structured_formatting.secondary_text
                  : ""
                : p.structured_formatting?.secondary_text || "";
            return (
              <Pressable
                key={p.place_id}
                onPress={() => selectPrediction(p)}
                className="px-3 py-3 border-b border-grey/40 dark:border-accent2"
              >
                <CText className="text-[0.95rem]" style={{ fontFamily: "bold" }}>
                  {main}
                </CText>
                {!!secondary && (
                  <CText className="text-[0.8rem] text-black/60 dark:text-grey/70 mt-0.5">
                    {secondary}
                  </CText>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default ChowdeckAddressParam;
