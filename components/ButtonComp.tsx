import { Pressable, Text, View } from "react-native";

interface Buttons {
text:string;
type?: "primary" | "secondary" ;
className?:string;
textClass?:string;
onPress:() => void;
}
export default function Buttons(props:Buttons) {
    const {textClass, text, className, type = "primary", onPress} = props;

    const buttonColor = type == "primary" ? "bg-[#971BB2] py-5 rounded-full" : "bg-gray-200 py-5 rounded-full"
  return (
    <>
        <Pressable onPress={onPress}>
          <View className={buttonColor}>
        <Text className={`${textClass ? textClass : "font-bold text-[16px]  text-center text-white"}`}>{text}</Text>
          </View>
        </Pressable>
    </>
  );
}
