import { useCallback, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import CText, { CNumber } from "@/components/TextComp";
import { Image } from "expo-image";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import IconLibrary from "@/utils/icons";
import { useThemeContext } from "@/context/ThemeContext";
import { scale } from "react-native-size-matters";

export default function ManageTokens() {
  const { userWallet, visibleTokenMints, setVisibleTokenMints } = UserItem();
  const { isDarkMode } = useThemeContext();

  const tokens = userWallet?.tokenAccounts ?? [];

  const selectedSet = useMemo(() => {
    if (visibleTokenMints === null) {
      return new Set(tokens.map((t: any) => t.mint));
    }
    return new Set(visibleTokenMints);
  }, [visibleTokenMints, tokens]);

  const isVisible = useCallback(
    (mint: string) => selectedSet.has(mint),
    [selectedSet]
  );

  const toggleToken = useCallback(
    (mint: string, show: boolean) => {
      const allMints = tokens.map((t: any) => t.mint);
      if (show) {
        const next = [...selectedSet, mint];
        setVisibleTokenMints(next.length === allMints.length ? null : next);
      } else {
        const next = [...selectedSet].filter((m) => m !== mint);
        setVisibleTokenMints(next.length === 0 ? [] : next);
      }
    },
    [selectedSet, tokens, setVisibleTokenMints]
  );

  return (
    <View className="relative w-full bg-grey pt-4 dark:bg-dark flex-1">
      <View className="w-full px-4 flex flex-row justify-start items-center gap-x-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText style={{ fontFamily: "bold" }} className="text-[1.4rem]">
          Manage tokens
        </CText>
      </View>

      <CText className="px-4 pt-2 pb-4 text-[0.95rem] text-gray-600 dark:text-gray-400">
        Choose which tokens to show on your wallet screen.
      </CText>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white dark:bg-accent rounded-2xl overflow-hidden shadow-sm">
          {tokens.length === 0 ? (
            <View className="py-8 px-4 items-center">
              <CText className="text-center">No tokens in your wallet yet.</CText>
            </View>
          ) : (
            tokens.map((token: any, index: number) => {
              const visible = isVisible(token.mint);
              return (
                <View key={token.mint}>
                  {index > 0 && (
                    <View className="bg-grey dark:bg-dark w-full h-[0.6px]" />
                  )}
                  <View className="flex flex-row items-center justify-between px-4 py-4">
                    <View className="flex-1 flex-row items-center gap-x-3">
                      <View
                        style={{
                          width: scale(40),
                          height: scale(40),
                        }}
                        className="overflow-hidden rounded-full"
                      >
                        <Image
                          source={
                            token?.image ?? require("@/assets/images/icon.png")
                          }
                          alt={token?.name}
                          style={{ height: "100%", width: "100%" }}
                          contentFit="cover"
                        />
                      </View>
                      <View>
                        <CText
                          style={{ fontFamily: "bold" }}
                          className="text-[1rem]"
                        >
                          {token?.name || "?"}
                        </CText>
                        <CText className="text-[0.9rem]">
                          {token?.balance < 1
                            ? token?.balance?.toFixed(
                                Math.min(token?.decimals, 5)
                              )
                            : token?.balance?.toFixed(
                                Math.min(token?.decimals, 3)
                              )}{" "}
                          {token?.symbol || "?"}
                        </CText>
                        {token?.usdc_price != null && (
                          <CText className="text-[0.85rem] text-gray-500 dark:text-gray-400">
                            $
                            <CNumber
                              value={Number(token.usdc_price.toFixed(2))}
                              className="text-[0.85rem]"
                            />
                          </CText>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={visible}
                      onValueChange={(value) => toggleToken(token.mint, value)}
                      trackColor={{
                        false: isDarkMode ? "#374151" : "#d1d5db",
                        true: "#971BB2",
                      }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
