import { useEffect, useMemo, useState } from "react";
import { TextInput, TouchableOpacity, View, type KeyboardTypeOptions } from "react-native";
import { CountryPickerModal } from "react-native-country-code-select";
import CText from "@/components/TextComp";
import { useThemeContext } from "@/context/ThemeContext";
import IconLibrary from "@/utils/icons";
import { authUi } from "@/components/auth/authUi";
import {
  CountrySelection,
  detectSmartContactMode,
} from "@/utils/contact/smartContact";
import { tabletSize } from "@/utils/layout/tablet";

const DEFAULT_COUNTRY: CountrySelection = {
  callingCode: ["234"],
  countryInitials: "NG",
  name: "Nigeria",
  region: "Africa",
  subregion: "Western Africa",
};

interface SmartContactInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  selectedValue?: CountrySelection;
  onCountryChange?: (country: CountrySelection) => void;
  /** Force phone UI (country code + phone icon) instead of smart email/phone detection. */
  variant?: "smart" | "phone";
}

export default function SmartContactInput({
  value,
  onChangeText,
  placeholder = "Email or phone number",
  selectedValue: selectedValueProp,
  onCountryChange,
  variant = "smart",
}: SmartContactInputProps) {
  const { isDarkMode } = useThemeContext();
  const [isVisible, setIsVisible] = useState(false);
  const [internalCountry, setInternalCountry] =
    useState<CountrySelection>(DEFAULT_COUNTRY);

  const selectedValue = selectedValueProp ?? internalCountry;
  const contactMode = useMemo(() => detectSmartContactMode(value), [value]);
  const displayMode = variant === "phone" ? "phone" : contactMode;
  const showCountryCode = displayMode === "phone";
  const iconColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const [focused, setFocused] = useState(false);
  const nextKeyboardType: KeyboardTypeOptions =
    displayMode === "phone"
      ? "phone-pad"
      : displayMode === "email"
        ? "email-address"
        : "default";
  const [keyboardType, setKeyboardType] =
    useState<KeyboardTypeOptions>(nextKeyboardType);

  // Changing keyboardType while focused dismisses the soft keyboard on iPad.
  useEffect(() => {
    if (!focused) {
      setKeyboardType(nextKeyboardType);
    }
  }, [focused, nextKeyboardType]);

  const handleCountrySelect = (country: CountrySelection) => {
    if (onCountryChange) {
      onCountryChange(country);
    } else {
      setInternalCountry(country);
    }
  };

  return (
    <>
      <View className={authUi.inputShell}>
        <View
          className={`flex-row items-center ${authUi.inputPadding} ${authUi.inputMinHeight}`}
        >
          <View className="pr-3">
            {displayMode === "phone" ? (
              <IconLibrary.phone size={20} color={iconColor} />
            ) : (
              <IconLibrary.mail size={20} color={iconColor} />
            )}
          </View>
          {showCountryCode && (
            <TouchableOpacity
              onPress={() => setIsVisible(true)}
              className="pr-3"
            >
              <CText style={{ fontFamily: "bold" }}>
                +{Array.isArray(selectedValue.callingCode)
                  ? selectedValue.callingCode[0]
                  : selectedValue.callingCode}
              </CText>
            </TouchableOpacity>
          )}
          <TextInput
            style={{
              fontFamily: showCountryCode ? "bold" : "reg",
              fontSize: tabletSize(16),
            }}
            className="flex-1 text-dark dark:text-white"
            value={value}
            showSoftInputOnFocus
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setKeyboardType(nextKeyboardType);
            }}
            onChangeText={onChangeText}
            placeholder={placeholder}
          />
        </View>
      </View>

      <CountryPickerModal
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        //@ts-ignore
        onSelect={(country) => handleCountrySelect(country)}
      />
    </>
  );
}

export { DEFAULT_COUNTRY };
