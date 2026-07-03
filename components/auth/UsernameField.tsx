import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import CText from "@/components/TextComp";
import AuthTextField from "@/components/auth/AuthTextField";
import IconLibrary from "@/utils/icons";
import { checkUsernameAvailability } from "@/utils/request/db";
import { authUi } from "@/components/auth/authUi";

const MIN_USERNAME_LENGTH = 3;
const DEBOUNCE_MS = 500;

export type UsernameAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "error";

interface UsernameFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onStatusChange?: (status: UsernameAvailabilityStatus) => void;
}

export default function UsernameField({
  value,
  onChangeText,
  onStatusChange,
}: UsernameFieldProps) {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length < MIN_USERNAME_LENGTH) {
      setStatus("idle");
      setStatusMessage("");
      onStatusChange?.("idle");
      return;
    }

    setStatus("checking");
    setStatusMessage("");
    onStatusChange?.("checking");

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(trimmed);
      if (cancelled) return;

      if (!result.status) {
        setStatus("error");
        setStatusMessage(result.message || "Could not check username");
        onStatusChange?.("error");
        return;
      }

      if (result.available) {
        setStatus("available");
        setStatusMessage("Username is available");
        onStatusChange?.("available");
        return;
      }

      setStatus("taken");
      setStatusMessage("Username is already taken");
      onStatusChange?.("taken");
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, onStatusChange]);

  const trailingAdornment =
    status === "checking" ? (
      <ActivityIndicator size="small" color="#971BB2" />
    ) : status === "available" ? (
      <IconLibrary.verifiedCheck size={24} color="#16A34A" />
    ) : status === "taken" ? (
      <IconLibrary.verifiedAlert size={24} color="#EF4444" />
    ) : null;

  const showBanner =
    status === "available" || status === "taken" || status === "error";

  const bannerStyles =
    status === "available"
      ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900"
      : status === "taken"
        ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900"
        : "bg-white dark:bg-accent border-grey/80 dark:border-line";

  const bannerTextStyles =
    status === "available"
      ? "text-green-700 dark:text-green-400"
      : status === "taken"
        ? "text-red-700 dark:text-red-400"
        : "text-dark/70 dark:text-white/70";

  return (
    <View className="gap-y-2">
      <AuthTextField
        leadingIcon="user"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Enter a username"
        trailingAdornment={trailingAdornment}
      />

      {showBanner ? (
        <View
          className={`rounded-full border px-4 py-3 ${bannerStyles}`}
        >
          <CText className={`text-center text-[0.875rem] ${bannerTextStyles}`}>
            {statusMessage}
          </CText>
        </View>
      ) : status === "idle" && value.trim().length > 0 &&
        value.trim().length < MIN_USERNAME_LENGTH ? (
        <View className={`${authUi.inputShell} px-4 py-3`}>
          <CText className={`text-center ${authUi.caption}`}>
            Username must be at least {MIN_USERNAME_LENGTH} characters
          </CText>
        </View>
      ) : null}
    </View>
  );
}
