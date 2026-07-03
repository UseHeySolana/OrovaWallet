import { ReactNode } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { useThemeContext } from "@/context/ThemeContext";
import IconLibrary from "@/utils/icons";
import { authUi } from "@/components/auth/authUi";

type AuthTextFieldIcon = "user";

interface AuthTextFieldProps extends TextInputProps {
  containerClassName?: string;
  leadingIcon?: AuthTextFieldIcon;
  trailingAdornment?: ReactNode;
}

export default function AuthTextField({
  containerClassName = "",
  className = "",
  leadingIcon,
  trailingAdornment,
  style,
  ...props
}: AuthTextFieldProps) {
  const { isDarkMode } = useThemeContext();
  const iconColor = isDarkMode ? "#9ca3af" : "#6b7280";

  return (
    <View className={`${authUi.inputShell} ${containerClassName}`}>
      <View
        className={`flex-row items-center ${authUi.inputPadding} ${authUi.inputMinHeight}`}
      >
        {leadingIcon === "user" && (
          <View className="pr-3">
            <IconLibrary.user size={20} color={iconColor} />
          </View>
        )}
        <TextInput
          {...props}
          style={[{ fontFamily: "reg", fontSize: 16, flex: 1 }, style]}
          className={`flex-1 text-dark dark:text-white ${className}`}
          placeholderTextColor={isDarkMode ? "#9ca3af" : "#6b7280"}
        />
        {trailingAdornment ? (
          <View className="pl-2">{trailingAdornment}</View>
        ) : null}
      </View>
    </View>
  );
}
