import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import IconLibrary from "@/misc/helpers/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";

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


]

const recommended = [
]

const freeTools = [

]

/**
  * What should be done here
  * Show AppStore
  */
function AppItems() {


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
                <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4">
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
                                    <Pressable key={index} className="flex bg-white dark:bg-accent p-3 rounded-lg  flex-row justify-start items-center gap-x-2">
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

                </View>
            </ScrollView>

        </View>
    );
}

export default AppItems;

