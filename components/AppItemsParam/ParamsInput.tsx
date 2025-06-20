import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import ToolsItem from "@/misc/store/toolsitems";

interface ParamsInputProps {
  param: any;
  appData: any;
  item: any;
}

const ParamsInput = ({ param, appData, item }: ParamsInputProps) => {
  const [inputValue, setInputValue] = useState<string>("");
  const { updateToolParameter } = ToolsItem();



  useEffect(() => {
    if (param?.name?.includes("phone_number")) {
      return;
    }
    updateToolParameter(appData?.name, item?.name, {
      type: param?.name,
      value: inputValue,
    });
  }, [param, appData, item]);

  return (
    <TextInput
      className="w-full h-[40px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-2"
      editable={!param?.name?.includes("phone_number")}
      value={inputValue}
      placeholder={param?.name?.split("_").join(" ")}
      placeholderTextColor="grey"
      onChangeText={(text) => {
        setInputValue(text);
      }}
    />
  );
};

export default ParamsInput;
