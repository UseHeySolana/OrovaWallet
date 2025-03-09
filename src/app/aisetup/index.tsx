import { Pressable, View } from "react-native";
import CText from "@/src/components/TextComp";
import Buttons from "@/src/components/ButtonComp";
import { useEffect } from "react";
import AppSettings from "@/src/misc/store/settingsstore";

const Items = [
  {
    id: 1,
    title: "Voice Assistant",
    description: "",
    subItems: [],
    type: "toogle",
  },
  {
    id: 2,
    title: "Language",
    description: "",
    subItems: [{
      id: 1,
      title: "English",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 3,
    title: "Assistant Voice",
    description: "",
    subItems: [{
      id: 1,
      title: "Kira",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 4,
    title: "Assistant Name",
    description: "",
    subItems: [{
      id: 1,
      title: "User Input",
      description: "",
    }],
    type: "dropdown",
  }
]
export default function SetUpAi({ navigation }: any) {
  const { markedSkipped, skippedAiSettings } = AppSettings()
  /**
   * What should be done here
   * 1. Welcome User to the application, 
   * 2. Set up their AI settings
   * 3. Set up their Assitant Name
   */
  useEffect(() => {
    if (skippedAiSettings) {
      navigation.replace('VoiceReg')
    }
  }, [skippedAiSettings])
  return (
    <View
      className=" py-5"
    >
      <View className="w-11/12 m-auto p-2 gap-y-3">
        {
          Items.map((item) => (
            <View
              key={item.id}
              className={`flex flex-col rounded-2xl bg-white border-b border-gray-200  py-4`}
            >
              <CText
                className="py-4 px-4"
              >
                {item.title}
              </CText>
              {item.subItems.length <= 0 ? null :
                <View className="border-b border-gray-200">
                </View>
              }
              <View>
                {item.subItems.map((subItem) => {
                  return <View key={item.id} className="p-4">
                    <CText>
                      {subItem.title}
                    </CText>
                  </View>

                })}
              </View>
            </View>
          ))
        }
      </View>

      <View className="w-11/12 m-auto p-2 gap-y-3">
        <Buttons onPress={() => { }} text="Next" type="primary" />
        <Buttons onPress={() => { markedSkipped(); navigation.navigate('VoiceReg') }} text="Skip" buttonType="feedback" type="secondary" />
      </View>

    </View>
  );
}
