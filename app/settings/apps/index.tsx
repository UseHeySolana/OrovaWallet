import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import Buttons from "@/components/ButtonComp";
import SearchInput from "@/components/SearchInput/SearchInput";
import { apps, categories } from "@/libs/app/apps";
import ToolsItem from "@/utils/store/toolsitems.store";
/**
  * What should be done here
  * Show AppStore
  */
export default function ConnectedApps() {

  const [search, setSearch] = useState("")
  const [filteredApps, setFilteredApps] = useState(apps)

  useEffect(() => {
    if (search.length > 0) {
      setFilteredApps(apps.filter((item: any) => item.name.toLowerCase().includes(search.toLowerCase())))
    } else {
      setFilteredApps(apps)
    }
  }, [search])

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
            contentContainerStyle={{ paddingEnd: 10 }}
            className="py-2"
          >
            <View className="flex flex-row justify-start items-center gap-x-2">
              {categories.map((item, index) => {
                return (
                  <Pressable key={index} className="flex bg-white dark:bg-accent py-3 px-2 w-[10rem] rounded-xl  flex-row justify-start items-center gap-x-3">
                    <View className="h-10 w-10 rounded-lg bg-white dark:bg-accent2 flex items-center  justify-center">
                      {item.icon &&
                        <Image source={item?.icon instanceof String ? { uri: item.icon } : item.icon} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                      }
                    </View>
                    <CText style={{ fontFamily: "bold" }}>{item.name}</CText>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <View className="flex flex-row justify-start items-center ps-3">
            <CText style={{ fontFamily: "bold" }}>Top Apps</CText>
          </View>
          <ScrollView
            nestedScrollEnabled={true}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingEnd: 10, }}
            className="py-2"
          >
            <View className="flex flex-row  justify-start items-center gap-x-2">
              {apps.filter((item: any) => item.is_featured).map((item, index) => {
                const tools = ToolsItem.getState().tools
                const tool = tools.find((tool: any) => tool.name === item.name)
                return (
                  <Pressable
                    onPress={() => {
                      router.push({
                        pathname: '/settings/apps/appitem',
                        params: { app: item.name },
                      });
                    }}
                    key={index} className="flex h-[10rem] min-w-[16rem] max-w-[20rem] shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent">
                    <Image source={item.banner instanceof String ? { uri: item.banner as string } : item.banner} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <View className="absolute bottom-0 w-full px-3 py-2 bg-white/90 dark:bg-accent/90 flex flex-row items-center justify-between gap-x-2">
                      <View className="flex flex-row items-center gap-x-2 flex-1 pr-2">

                        <View className="h-11 w-11 overflow-hidden rounded-2xl bg-white dark:bg-accent2 ">
                          {item.icon ? <Image source={item?.icon instanceof String ? { uri: item.icon as string } : item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" /> :
                            //@ts-ignore
                            <Image source={item?.icon instanceof String ? { uri: item.icon as string } : item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                          }
                        </View>

                        <View className="flex-1">
                          <CText numberOfLines={1} style={{ fontFamily: "bold" }} className="text-[1.1rem]">
                            {item.name}
                          </CText>
                          <CText numberOfLines={1} style={{ fontFamily: "reg" }} className="text-[0.9rem] text-black/70 dark:text-grey/70">
                            {item.category}
                          </CText>
                        </View>
                      </View>

                      <Buttons
                        type={tool ? "secondary" : "primary"}
                        className="py-2 rounded-full"
                        style={{ width: 104 }}
                        text={tool ? "Activated" : "Activate"}
                        onPress={() => {
                        router.push({
                          pathname: '/settings/apps/appitem',
                          params: { app: item.name },
                        })
                      }
                      } />
                    </View>


                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <SearchInput onSearch={(text) => setSearch(text)} value={search} />


          <CText className="text-[1.7rem]" style={{ fontFamily: "bold" }}>Recomended</CText>
          {filteredApps.length > 0 ? (
            <ScrollView
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingEnd: 10, }}
              className="py-2"
            >
              <View className="flex flex-col justify-start items-center gap-y-3">
                {filteredApps.map((item, index) => {
                  return (
                    <View key={index} className="flex w-full shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent">
                      <View className="rounded-2xl w-full p-3  bg-white dark:bg-accent  flex-row items-center  justify-between gap-x-2">
                        <View className="flex-1 flex-row items-center gap-x-3 pr-2">
                          <View className="h-12 w-12 overflow-hidden rounded-lg bg-white dark:bg-accent2 ">
                            {item.icon ? <Image source={item?.icon instanceof String ? { uri: item.icon as string } : item.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" /> :
                              <Image source={item?.banner instanceof String ? { uri: item.banner as string } : item.banner} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                            }
                          </View>
                          <View className="flex-1">
                            <CText numberOfLines={1} style={{ fontFamily: "bold" }} className="text-[1.23rem]">
                              {item.name}
                            </CText>
                            <CText numberOfLines={2} style={{ fontFamily: "reg" }} className="text-[0.95rem] text-black/70 dark:text-grey/70">
                              {item.description}
                            </CText>
                          </View>
                        </View>

                        <Buttons
                          type="primary"
                          className="py-2 rounded-full"
                          style={{ width: 96 }}
                          text="View"
                          onPress={() =>
                          router.push({
                            pathname: '/settings/apps/appitem',
                            params: { app: item.name },
                          })
                        } />
                      </View>


                    </View>
                  )
                })}
              </View>
            </ScrollView>
          ) : (
            <View className="flex flex-row justify-center w-full h-[200px] items-center gap-y-3 items-center">
              <CText>No apps found</CText>
            </View>
          )}



          {/* <CText className="text-[1.7rem]" style={{ fontFamily: "bold" }}>Free Tools</CText>
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
          </ScrollView> */}





        </View>
      </ScrollView>

    </View>
  );
}


