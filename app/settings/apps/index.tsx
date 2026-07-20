import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import Buttons from "@/components/ButtonComp";
import SearchInput from "@/components/SearchInput/SearchInput";
import { categories, toImageSource } from "@/libs/app/apps";
import ToolsItem from "@/utils/store/toolsitems.store";
import AppCatalog from "@/utils/store/appCatalog.store";

/**
 * What should be done here
 * Show AppStore
 */
export default function ConnectedApps() {
  const [search, setSearch] = useState("");
  const apps = AppCatalog((s) => s.apps);
  const refreshCatalog = AppCatalog((s) => s.refreshCatalog);
  const tools = ToolsItem((s) => s.tools);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const filteredApps = useMemo(() => {
    if (search.length > 0) {
      return apps.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return apps;
  }, [apps, search]);

  const openApp = (item: { slug: string; name: string }) => {
    router.push({
      pathname: "/settings/apps/appitem",
      params: { app: item.slug || item.name },
    });
  };

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 items-center">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText className="text-[1.4rem]">Apps</CText>
      </View>

      <ScrollView className="w-full px-4 flex-1">
        <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-3">
          <ScrollView
            nestedScrollEnabled={true}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingEnd: 10 }}
            className="py-2"
          >
            <View className="flex flex-row justify-start items-center gap-x-2">
              {categories.map((item, index) => {
                return (
                  <Pressable
                    key={index}
                    className="flex bg-white dark:bg-accent py-3 px-2 w-[10rem] rounded-xl  flex-row justify-start items-center gap-x-3"
                  >
                    <View className="h-10 w-10 rounded-lg bg-white dark:bg-accent2 flex items-center  justify-center">
                      {item.icon && (
                        <Image
                          source={toImageSource(item.icon)}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="contain"
                        />
                      )}
                    </View>
                    <CText style={{ fontFamily: "bold" }}>{item.name}</CText>
                  </Pressable>
                );
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
            contentContainerStyle={{ paddingEnd: 10 }}
            className="py-2"
          >
            <View className="flex flex-row  justify-start items-center gap-x-2">
              {apps
                .filter((item) => item.is_featured)
                .map((item, index) => {
                  const tool = tools.find(
                    (t) =>
                      (t.name === item.slug || t.name === item.name) &&
                      t.value === "active"
                  );
                  return (
                    <Pressable
                      onPress={() => openApp(item)}
                      key={item.slug || index}
                      className="flex h-[10rem] min-w-[16rem] max-w-[20rem] shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent"
                    >
                      <Image
                        source={toImageSource(item.banner)}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                      <View className="absolute bottom-0 w-full px-3 py-2 bg-white/90 dark:bg-accent/90 flex flex-row items-center justify-between gap-x-2">
                        <View className="flex flex-row items-center gap-x-2 flex-1 pr-2">
                          <View className="h-11 w-11 overflow-hidden rounded-2xl bg-white dark:bg-accent2 ">
                            <Image
                              source={toImageSource(item.icon)}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          </View>

                          <View className="flex-1">
                            <CText
                              numberOfLines={1}
                              style={{ fontFamily: "bold" }}
                              className="text-[1.1rem]"
                            >
                              {item.name}
                            </CText>
                            <CText
                              numberOfLines={1}
                              style={{ fontFamily: "reg" }}
                              className="text-[0.9rem] text-black/70 dark:text-grey/70"
                            >
                              {item.category}
                            </CText>
                          </View>
                        </View>

                        <Buttons
                          type={tool ? "secondary" : "primary"}
                          className="py-2 rounded-full"
                          style={{ width: 104 }}
                          text={tool ? "Activated" : "Activate"}
                          onPress={() => openApp(item)}
                        />
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          </ScrollView>

          <SearchInput onSearch={(text) => setSearch(text)} value={search} />

          <CText className="text-[1.7rem]" style={{ fontFamily: "bold" }}>
            Recomended
          </CText>
          {filteredApps.length > 0 ? (
            <ScrollView
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingEnd: 10 }}
              className="py-2"
            >
              <View className="flex flex-col justify-start items-center gap-y-3">
                {filteredApps.map((item, index) => {
                  return (
                    <View
                      key={item.slug || index}
                      className="flex w-full shadow relative  rounded-3xl overflow-hidden flex-row justify-start items-center gap-x-2 bg-white dark:bg-accent"
                    >
                      <View className="rounded-2xl w-full p-3  bg-white dark:bg-accent  flex-row items-center  justify-between gap-x-2">
                        <View className="flex-1 flex-row items-center gap-x-3 pr-2">
                          <View className="h-12 w-12 overflow-hidden rounded-lg bg-white dark:bg-accent2 ">
                            <Image
                              source={toImageSource(item.icon || item.banner)}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          </View>
                          <View className="flex-1">
                            <CText
                              numberOfLines={1}
                              style={{ fontFamily: "bold" }}
                              className="text-[1.23rem]"
                            >
                              {item.name}
                            </CText>
                            <CText
                              numberOfLines={2}
                              style={{ fontFamily: "reg" }}
                              className="text-[0.95rem] text-black/70 dark:text-grey/70"
                            >
                              {item.description}
                            </CText>
                          </View>
                        </View>

                        <Buttons
                          type="primary"
                          className="py-2 rounded-full"
                          style={{ width: 96 }}
                          text="View"
                          onPress={() => openApp(item)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View className="w-full py-8 items-center">
              <CText className="text-black/60 dark:text-grey/60">
                No apps found
              </CText>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
