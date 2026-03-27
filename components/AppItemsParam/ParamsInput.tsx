import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import ToolsItem from "@/utils/store/toolsitems.store";
import CText from "../TextComp";

interface ParamsInputProps {
  param: any;
  appData: any;
  item: any;
}

const ParamsInput = ({ param, appData, item }: ParamsInputProps) => {

  const [inputValue, setInputValue] = useState<string>("");
  const { updateToolParameter } = ToolsItem();

  useEffect(() => {
    const saved =
      ToolsItem.getState().getParameterValue(appData?.name, item?.name, param?.name) ?? "";
    setInputValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData?.name, item?.name, param?.name]);

  const handleChangeText = (text: string) => {
    setInputValue(text);
    updateToolParameter(appData?.name, item?.name, {
      type: param?.name,
      value: text,
    });
  };

  const label = param?.label || param?.name?.split("_").join(" ");
  const placeholder = param?.placeholder || label;
  const helper = param?.helper;
  const isMultiline = !!param?.multiline;
  const isSecure = !!param?.secure;

  return (
    <View className="w-full">
      {!!label && (
        <CText className="text-[0.95rem] mb-1" style={{ fontFamily: "reg" }}>
          {label}
        </CText>
      )}
      <TextInput
        className={`w-full ${isMultiline ? "h-[110px]" : "h-[40px]"} text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-2`}
        editable={!param?.name?.includes("phone_number")}
        value={inputValue}
        placeholder={placeholder}
        placeholderTextColor="grey"
        onChangeText={handleChangeText}
        multiline={isMultiline}
        textAlignVertical={isMultiline ? "top" : "center"}
        secureTextEntry={isSecure}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!!helper && (
        <CText className="text-[0.85rem] mt-1 text-black/70 dark:text-grey/70" style={{ fontFamily: "reg" }}>
          {helper}
        </CText>
      )}
    </View>
  );
};

export default ParamsInput;
