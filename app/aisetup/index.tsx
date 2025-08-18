import { Pressable, View } from "react-native";
import CText from "@/components/TextComp";
import Buttons from "@/components/ButtonComp";
import { useEffect, useState } from "react";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import { Switch } from "react-native";
import { TextInput } from "react-native";
import IconLibrary from "@/misc/helpers/icons";

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
    title: "Assistant Language",
    description: "",
    subItems: [
      {
        id: 1,
        title: "English",
        description: "",
      },
      {
        id: 2,
        title: "Yoruba",
        description: "",
      },
      {
        id: 3,
        title: "Igbo",
        description: "",
      },
      {
        id: 4,
        title: "Hausa",
        description: "",
      }
    ],
    type: "dropdown",
  },
  // {
  //   id: 3,
  //   title: "Assistant Voice",
  //   description: "",
  //   subItems: [{
  //     id: 1,
  //     title: "Kira",
  //     description: "",
  //   }],
  //   type: "dropdown",
  // },
  {
    id: 4,
    title: "Assistant Name",
    description: "",
    subItems: [{
      id: 1,
      title: "User Input",
      description: "",
    }],
    type: "input",
  }
]
export default function SetUpAi() {
  const { markedSkipped, skippedAiSettings, aiName, aiLanguage, setToast } = AppSettings()
  const [toggleDropdown, setToggleDropdown] = useState(false);
  const [settings, setSettings] = useState({
    aiActive: true,
    language: aiLanguage,
    assistantName: aiName,
  })
  useEffect(() => {
    if (skippedAiSettings) {
      router.replace('/voicereg')
    }
  }, [skippedAiSettings])

  const handleSave = () => {
    AppSettings.getState().setAiName(settings.assistantName)
    AppSettings.getState().setAiLanguage(settings.language)
    AppSettings.getState().setAiActive(settings.aiActive)
    setToast("Settings saved", "success")

  }
  return (
    <View
      className=" py-5 bg-grey dark:bg-dark flex-1"
    >
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">AI Settings</CText>
      </View>
      <View className="w-11/12  m-auto p-2 gap-y-3 flex-1">
        {
          Items.map((item) => (
            <View
              key={item.id}
              className={`flex flex-col rounded-2xl bg-white dark:bg-accent py-4`}
            >
              <View className="flex flex-row justify-between items-center py-2 px-4">

                <CText
                  style={{ fontFamily: "bold" }}
                  className="text-[18px]"
                >
                  {item.title}
                </CText>
                {item.type === 'toogle' &&
                  <Switch
                    trackColor={{ false: 'red', true: 'green' }}
                    thumbColor={'white'}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => {
                      setSettings({ ...settings, aiActive: !settings.aiActive });
                    }}
                    value={settings.aiActive}
                  />
                }
              </View>
              {item.subItems.length <= 0 ? null :
                <View className="border-b border-gray-200 dark:border-accent2">
                </View>
              }
              {item.type === 'dropdown' &&
                <View>
                  <Pressable onPress={() => setToggleDropdown(true)} className="p-4">
                    <CText>
                      {settings.language}
                    </CText>
                  </Pressable>
                  {toggleDropdown &&
                    <View className="absolute z-50 bg-white dark:bg-accent w-full rounded-2xl">
                      {item.subItems.map((subItem) => <Pressable key={subItem.title} onPress={() => {
                        setSettings({ ...settings, language: subItem.title });
                        setToggleDropdown(false);
                      }} className="p-4">
                        <CText style={{ fontFamily: 'bold' }}>
                          {subItem.title}
                        </CText>
                      </Pressable>
                      )}
                    </View>

                  }
                </View>
              }
              {item.type === 'input' &&
                <TextInput
                  style={{ fontFamily: 'reg' }}
                  value={settings.assistantName}
                  className=" text-start  w-full py-3 px-5 text-black dark:text-white "
                  onChangeText={(text) => {
                    setSettings({ ...settings, assistantName: text });
                  }}
                />
              }
            </View>
          ))
        }
      </View>

      <View className="w-11/12 m-auto p-2 gap-y-3">
        <Buttons onPress={() => handleSave()} text="Save" type="primary" />
        {/* <Buttons onPress={() => {
          markedSkipped();
          router.replace('/voicereg')
        }} text="Skip" buttonType="feedback" type="secondary" /> */}
      </View>

    </View>
  );
}
