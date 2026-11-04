import * as Location from "expo-location";
import {
  reverseGeocodeChowdeckPlace,
  type ChowdeckPlaceDetails,
} from "./chowdeckApi";

export type LocationResult =
  | {
      success: true;
      place: ChowdeckPlaceDetails;
      coords: { latitude: number; longitude: number };
    }
  | {
      success: false;
      error: "PERMISSION_DENIED" | "SERVICES_DISABLED" | "UNAVAILABLE" | "API_ERROR";
      message: string;
    };

/**
 * Format native reverse-geocoded address into a clean Nigerian street address string.
 */
function formatReverseGeocodedAddress(geo: Location.LocationGeocodedAddress): string {
  const parts = [
    geo.streetNumber,
    geo.street || geo.name,
    geo.district || geo.subregion,
    geo.city,
    geo.region,
    geo.country,
  ].filter((p): p is string => Boolean(p && p.trim()));

  // Deduplicate consecutive parts
  const unique = parts.filter((part, idx) => parts.indexOf(part) === idx);
  return unique.join(", ");
}

/**
 * Capture live device GPS coordinates and resolve them to a Chowdeck-compatible address.
 */
export async function getLiveDeliveryLocation(options?: {
  timeoutMs?: number;
}): Promise<LocationResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;

  try {
    const isServiceEnabled = await Location.hasServicesEnabledAsync();
    if (!isServiceEnabled) {
      return {
        success: false,
        error: "SERVICES_DISABLED",
        message: "Device location services are turned off. Please enable GPS in your device settings.",
      };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return {
        success: false,
        error: "PERMISSION_DENIED",
        message: "Location permission was denied. You can still type your delivery address manually.",
      };
    }

    // Race position acquisition against timeout
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    let location = await Promise.race([positionPromise, timeoutPromise]);

    // Fallback to last known position if balanced current position timed out
    if (!location) {
      location = await Location.getLastKnownPositionAsync({});
    }

    if (!location || !location.coords) {
      return {
        success: false,
        error: "UNAVAILABLE",
        message: "Unable to detect current GPS coordinates. Please try again or type an address.",
      };
    }

    const { latitude, longitude } = location.coords;

    // Attempt device-level reverse geocoding to build a descriptive street hint
    let addressHint: string | undefined;
    try {
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocoded && geocoded.length > 0) {
        addressHint = formatReverseGeocodedAddress(geocoded[0]);
      }
    } catch {
      // Non-fatal: backend can still resolve with lat/lng
    }

    // Call backend to resolve into Chowdeck numeric place_id
    const resolvedPlace = await reverseGeocodeChowdeckPlace(latitude, longitude, addressHint);

    if (!resolvedPlace || (!resolvedPlace.place_id && !resolvedPlace.formatted_address)) {
      return {
        success: false,
        error: "API_ERROR",
        message: "Chowdeck could not map this location to a delivery area. Please enter a nearby street or landmark.",
      };
    }

    return {
      success: true,
      place: {
        ...resolvedPlace,
        latitude: resolvedPlace.latitude ?? latitude,
        longitude: resolvedPlace.longitude ?? longitude,
        formatted_address:
          resolvedPlace.formatted_address || addressHint || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      },
      coords: { latitude, longitude },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to obtain live location";
    return {
      success: false,
      error: "UNAVAILABLE",
      message: msg,
    };
  }
}

