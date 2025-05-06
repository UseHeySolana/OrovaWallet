import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import IconLibrary from "@/misc/helpers/icons";
import CText from "@/components/TextComp";
import { Image, ImageBackground } from "expo-image";
import Buttons from "@/components/ButtonComp";
import SearchInput from "@/components/SearchInput/SearchInput";

const category = [
  {
    title: 'Devtools',
    image: require('@/assets/apps/devtools.png'),
  },
  {
    title: 'Finance',
    image: require('@/assets/apps/financial.png'),
  },
  {
    title: "Sports",
    image: require('@/assets/apps/sports.png'),
  },
  {
    title: 'Utilities',
    icon: <IconLibrary.tools />,

  }

]

const sponsored = [

  {
    name: "Airbills",
    title: 'Utilities',
    image: require('@/assets/apps/airbillsbg.jpeg'),
    icon: require('@/assets/apps/airbillslogo.jpg'),
  },
  {
    name: "PajCash",
    title: 'Finance',
    image: require('@/assets/apps/pajbg.jpeg'),
    icon: require('@/assets/apps/pajcas.jpg'),

  },
  {
    name: "Airbills",
    title: "Sports",
    image: require('@/assets/apps/sports.png'),
  },
  {
    name: "Airbills",
    title: 'Utilities',
    image: require('@/assets/apps/sports.png'),
    // icon: <IconLibrary.tools />,
  }
]

const recommended = [


  {
    name: "Airbills",
    title: 'Utilities',
    image: require('@/assets/apps/airbillsbg.jpeg'),
    icon: require('@/assets/apps/airbillslogo.jpg'),
    description: " Airbills is a logistics platform that allows you to send and receive packages globally. It provides a user-friendly interface for tracking shipments, managing orders, and accessing shipping rates.",
  },
  {
    name: "PajCash",
    title: 'Finance',
    image: require('@/assets/apps/pajbg.jpeg'),
    icon: require('@/assets/apps/pajcas.jpg'),
    description: " PajCash is a financial management app that helps users track their expenses, manage budgets, and make informed financial decisions. It offers features like expense categorization, budgeting tools, and financial insights.",

  },
  {
    name: "Airbills",
    title: "Sports",
    image: require('@/assets/apps/sports.png'),
    description: " Sports app that provides live scores, news, and updates on various sports events. It offers features like personalized notifications, team tracking, and in-depth statistics.",
  },
  {
    name: "Airbills",
    title: 'Utilities',
    image: require('@/assets/apps/sports.png'),
    description: " Utility app that offers various tools and features to enhance productivity. It includes features like task management, note-taking, and reminders.",
    // icon: <IconLibrary.tools />,
  }
]

const freeTools = [

]

/**
  * What should be done here
  * Show AppStore
  */
function ConnectedApps() {


  return (
    <View
      className="relative w-full bg-grey dark:bg-dark flex-1 items-center"
    >
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Apps</CText>
      </View>

      <ScrollView
        className="w-full px-4 flex-1"
      >
        <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-3">
          <ScrollView
            // style={{ height: 150 }}
            nestedScrollEnabled={true}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingEnd: 10, }}
            className="py-2"
          >
            <View className="flex flex-row justify-start items-center gap-x-2">
              {category.map((item, index) => {
                return (
                  <Pressable key={index} className="flex bg-white dark:bg-accent py-3 px-2 w-[10rem] rounded-xl  flex-row justify-start items-center gap-x-3">
                    <View className="h-10 w-10 rounded-lg bg-white dark:bg-accent2 flex items-center  justify-center">
                      {item.icon ? item.icon :
                        <Image source={item.image} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                      }
                    </View>
                    <CText style={{ fontFamily: "bold" }}>{item.title}</CText>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
          <ScrollView
            nestedScrollEnabled={true}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingEnd: 10, }}
            className="py-2"
          >
            <View className="flex flex-row  justify-start items-center gap-x-2">
              {sponsored.map((item, index) => {
                return (
                  <Pressable key={index} className="flex h-[10rem] w-[16rem] shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent">
                    <Image source={item.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <View className="absolute bottom-[-2] rounded-2xl w-full p-3  bg-white dark:bg-accent flex flex-row items-center  justify-between gap-x-2">
                      <View className="flex flex-row items-center gap-x-2">

                        <View className="h-12 w-12 overflow-hidden rounded-full bg-white dark:bg-accent2 ">
                          {item.icon ? <Image source={item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" /> :
                            <Image source={item.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          }
                        </View>
                        <View className="">
                          <CText style={{ fontFamily: "bold" }}>{item.name}</CText>
                          <CText style={{ fontFamily: "reg" }} textColor="text-white/50">{item.title}</CText>
                        </View>
                      </View>

                      <Buttons type="primary" className="p-2 px-4 bg-accent2 rounded-3xl" text="Install" onPress={() => { }} />
                    </View>


                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <SearchInput />


          <CText className="text-[1.7rem]" style={{ fontFamily: "bold" }}>Recomended</CText>
          <ScrollView
            nestedScrollEnabled={true}
            contentContainerStyle={{ paddingEnd: 10, }}
            className="py-2"
          >
            <View className="flex flex-col justify-start items-center gap-y-3">
              {recommended.map((item, index) => {
                return (
                  <View key={index} className="flex w-full shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent">

                    <View className="rounded-2xl w-full p-3  bg-white dark:bg-accent  flex-row items-center  justify-between gap-x-2">
                      <View className="flex-1  flex-row items-center gap-x-2">
                        <View className="h-12 w-12 overflow-hidden rounded-lg bg-white dark:bg-accent2 ">
                          {item.icon ? <Image source={item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" /> :
                            <Image source={item.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          }
                        </View>
                        <View className="w-[80%]">
                          <CText style={{ fontFamily: "bold" }} className="text-[1.23rem]">{item.name}</CText>
                          <CText style={{ fontFamily: "reg" }} textColor="text-white/50 text-start">{item.description.slice(0, 50) + "..."}</CText>
                        </View>
                      </View>

                      <Buttons type="primary" className="p-2 px-4 bg-accent2 rounded-3xl" text="Update" onPress={() => { }} />
                    </View>


                  </View>
                )
              })}
            </View>
          </ScrollView>



          <CText className="text-[1.7rem]" style={{ fontFamily: "bold" }}>Free Tools</CText>
          <ScrollView
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingEnd: 10, }}
            className="py-2"
          >
            <View className="flex flex-col justify-start items-center gap-y-3">
              {recommended.map((item, index) => {
                return (
                  <View key={index} className="flex w-full shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent">

                    <View className="rounded-2xl w-full p-3  bg-white dark:bg-accent  flex-row items-center  justify-between gap-x-2">
                      <View className="flex-1  flex-row items-center gap-x-2">
                        <View className="h-12 w-12 overflow-hidden rounded-lg bg-white dark:bg-accent2 ">
                          {item.icon ? <Image source={item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" /> :
                            <Image source={item.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          }
                        </View>
                        <View className="w-[80%]">
                          <CText style={{ fontFamily: "bold" }} className="text-[1.23rem]">{item.name}</CText>
                          <CText style={{ fontFamily: "reg" }} textColor="text-white/50 text-start">{item.description.slice(0, 50) + "..."}</CText>
                        </View>
                      </View>

                      <Buttons type="primary" className="p-2 px-4 bg-accent2 rounded-3xl" text="Update" onPress={() => { }} />
                    </View>


                  </View>
                )
              })}
            </View>
          </ScrollView>





        </View>
      </ScrollView>

    </View>
  );
}

export default ConnectedApps;

