import { useMemo } from "react";
import { Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";

import { CText } from "@/components/TextComp";
import type { App } from "@/libs/app/apps";
import { getFeaturedApps } from "@/utils/integrations";

function imageSource(source: string | App["icon"]) {
  return typeof source === "string" ? { uri: source } : source;
}

function openApp(appName: string) {
  router.push({
    pathname: "/settings/apps/appitem",
    params: { app: appName },
  });
}

export default function WalletToolsSection() {
  const featuredApps = useMemo(() => getFeaturedApps(), []);

  return (
    <View className="w-full gap-y-3">
      <View className="flex-row justify-between items-center px-1">
        <CText style={{ fontFamily: "bold" }} className="text-[1.1rem]">
          Discover
        </CText>
        <TouchableOpacity onPress={() => router.push("/settings/apps")}>
          <CText className="text-purple text-[0.95rem]">See all</CText>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}
      >
        {featuredApps.map((item) => (
          <Pressable
            key={item.name}
            onPress={() => openApp(item.name)}
            className="h-[9rem] min-w-[15rem] max-w-[18rem] shadow-sm relative rounded-3xl overflow-hidden bg-white dark:bg-accent"
          >
            <Image
              source={imageSource(item.banner)}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
            <View className="absolute bottom-0 w-full px-3 py-2 bg-white/90 dark:bg-accent/90 flex-row items-center gap-x-2">
              <View className="h-10 w-10 overflow-hidden rounded-xl bg-white dark:bg-accent2">
                <Image
                  source={imageSource(item.icon)}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
              <View className="flex-1 min-w-0">
                <CText
                  numberOfLines={1}
                  style={{ fontFamily: "bold" }}
                  className="text-[1rem]"
                >
                  {item.name}
                </CText>
                <CText
                  numberOfLines={1}
                  className="text-[0.85rem] text-black/70 dark:text-grey/70"
                >
                  {item.short_des || item.category}
                </CText>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
