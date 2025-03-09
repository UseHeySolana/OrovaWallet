import { Pressable, Text, TouchableNativeFeedback, View } from "react-native";
import CText from "./TextComp";

interface Buttons {
text:string;
type?: "primary" | "secondary" ;
className?:string;
textClass?:string;
onPress:() => void;
  icon?: React.ReactNode;
  buttonType?: "feedback" | "pressable"
}
export default function Buttons(props:Buttons) {
  const { textClass, text, className, type = "primary", onPress, buttonType } = props;

  const buttonColor = type == "primary" ? "bg-[#971BB2] py-5 rounded-full " : "bg-gray-200 py-5 rounded-full"
  return (
    <>
      {buttonType === "feedback" ? (

        <>
          <View style={{
            borderRadius: 50,  // Match this with your desired border radius
            overflow: 'hidden',  // This is the key style that contains the ripple
          }}>
            <TouchableNativeFeedback
              background={TouchableNativeFeedback.Ripple('#971BB2', false)}
              onPress={onPress}>
              <View className={`${buttonColor} flex flex-row justify-center items-center gap-x-2`}>
                {props.icon}
                <CText style={{ fontFamily: "bold" }} className={`${textClass ? textClass : "text-[16px]  text-center"} ${type === "primary" ?
                  "text-white" : "text-black"
                  }`}>{text}</CText>
              </View>
            </TouchableNativeFeedback>
          </View>
        </>
      ) :
        <Pressable onPress={onPress}>
          <View className={`${buttonColor} flex flex-row justify-center items-center gap-x-2`}>
            {props.icon}
            <CText style={{ fontFamily: "bold" }} className={`${textClass ? textClass : "text-[16px]  text-center"} ${type === "primary" ?
              "text-white" : "text-black"
              }`}>{text}</CText>
          </View>
        </Pressable>
      }
    </>
  );
}
