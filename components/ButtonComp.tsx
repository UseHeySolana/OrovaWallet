import { Pressable, Text, TouchableNativeFeedback, View } from "react-native";
import CText from "./TextComp";

interface Buttons {
  loading?: boolean
  text: string;
  type?: "primary" | "secondary";
  className?: string;
  textClass?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  buttonType?: "feedback" | "pressable"
}

/**
 * 
 * @param props interface Buttons {
  loading?: boolean
text:string;
type?: "primary" | "secondary" ;
className?:string;
textClass?:string;
onPress:() => void;
  icon?: React.ReactNode;
  buttonType?: "feedback" | "pressable"
}
 * @returns 
 */
export default function Buttons(props: Buttons) {
  const { loading, textClass, text, className, type = "primary", onPress, buttonType } = props;

  const buttonColor = type == "primary" ? "bg-[#971BB2]  " : "bg-gray-200  dark:bg-accent2"

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
              <View className={`${buttonColor} ${className ? className : "py-5 rounded-full"} flex flex-row justify-center items-center gap-x-2`}>
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
          <View className={`${buttonColor} ${className ? className : "py-5 rounded-full"}  flex flex-row justify-center items-center gap-x-2`}>
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
