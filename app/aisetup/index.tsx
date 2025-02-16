import { Pressable, Text, View } from "react-native";
import  {useEffect, useRef, useState} from 'react';
import { AudioManager } from "@/misc/processors/audioClassManager";
import { router } from "expo-router";

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
export default function SetUpAi() {
 
  /**
   * What should be done here
   * 1. Welcome User to the application, 
   * 2. Set up their AI settings
   * 3. Set up their Assitant Name
   */
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
              <Text
                className="font-bold py-4 px-4"
              >
                {item.title}
              </Text>
              {item.subItems.length <= 0 ? null :
                <View className="border-b border-gray-200">
                </View>
              }
              <View>
                {item.subItems.map((subItem) => {
                  return <View key={item.id} className="p-4">
                    <Text>
                      {subItem.title}
                    </Text>
                  </View>

                })}
              </View>



            </View>
          ))
        }
      </View>

      <View className="w-11/12 m-auto p-2 gap-y-3">
        <Pressable >
          <View className="bg-[#971BB2] py-5 rounded-full ">
            <Text className="text-white text-center">Next</Text>
          </View>
        </Pressable>
        <Pressable onPress={()=>router.push('/voicereg')} >
          <View className="bg-white py-5 rounded-full ">
            <Text className="text-black text-center">Skip</Text>
          </View>
        </Pressable>
      </View>

    </View>
  );
}
