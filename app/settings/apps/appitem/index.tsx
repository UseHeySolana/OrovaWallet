import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import { apps, reviews } from "@/libs/app/apps";
import Buttons from "@/components/ButtonComp";
import { InlinePillSkeleton } from "@/components/skeletons";
import { useThemeContext } from "@/context/ThemeContext";
import ToolsItem from "@/utils/store/toolsitems.store";
import { delay, delayPromise } from "@/utils/functions";
import AppSettings from "@/utils/store/settingsstore.store";
import { confirm } from "@/services/confirmation";
import UserItem from "@/utils/store/userstore.store";
import ParamsComponent from "@/components/AppItemsParam/Params";
import WalletItem from "@/utils/store/wallet.store";
import { activateKalshiWallet, backupKalshiApiKey } from "@/services/kalshiApi";
import { activateBayseWallet } from "@/services/bayseApi";

/**
 * What should be done here
 * Show AppStore
 */
export default function AppItems() {
  const { isDarkMode } = useThemeContext();
  const { app } = useLocalSearchParams();
  const { user } = UserItem();
  const walletAddress = WalletItem((state) => state.publicKey?.toString() || "");
  const phoneNumber = user?.mobileNumber?.trim() || "";
  const [appData, setAppData] = useState<any>(null);
  const [ratings, setRatings] = useState<any>(null);
  const {
    tools,
    addTool,
    removeTool,
    addToolConfig,
    removeToolConfig,
    clearTools,
    updateToolParameter,
  } = ToolsItem();
  const [activated, setActivated] = useState(false);
  const { isLoading, setToast, setLoading } = AppSettings();
  const [activeParams, setActiveParams] = useState<any>(null);
  const [setUpParams, setSetUpParams] = useState<boolean | null>(null);

  const [activatedConfigs, setActivatedConfigs] = useState<any>(null);
  const [toolConfig, setToolConfig] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [inputValue, setInputValue] = useState<any>({});
  const [param, setParam] = useState<any>(null);

  const maskSensitiveValue = (paramName: string, value: string) => {
    const v = String(value || "");
    if (!v) return "";
    const name = String(paramName || "").toLowerCase();
    if (name.includes("private_key") || name.includes("secret") || name.includes("api_key") || name.includes("access_key")) {
      const tail = v.replace(/\s+/g, "").slice(-6);
      return `••••••••••••${tail ? `…${tail}` : ""}`;
    }
    if (v.length > 60) return `${v.slice(0, 20)}…${v.slice(-8)}`;
    return v;
  };

  useEffect(() => {
    if (app) {
      const data = apps.find((item: any) => item.name === app);
      setAppData(data);

      const appRatings = reviews.filter((item: any) => item.app_name === app);
      setRatings(appRatings);
    }
  }, [app]);

  useEffect(() => {
    const tool = tools.find(
      (tool: any) => tool.name === appData?.name && tool.value === "active"
    );
    const configs = tool?.config || [];
    setToolConfig(configs.map((item: any) => item.parameters).flat());

    appData?.tools?.forEach((configItem: any) => {
      const config = configs?.find(
        (item: any) => item.name === configItem.name
      );
      if (config) {
        // add config to activatedConfigs and make sure you don't add it if it already exists
        if (!activatedConfigs[configItem.name]) {
          setActivatedConfigs((prev: any) => ({
            ...prev,
            [configItem.name]: config,
          }));
        }
      }
    });

    const allParamsSet = appData?.tools?.every((tool: any) => {
      // Find the corresponding config by tool name
      const config = configs?.find((item: any) => item?.type === tool.name);

      // If no config or no parameters, consider it incomplete
      if (!config || !config.parameters) return false;

      // Check that every param in the tool has a matching param with a value in the config
      return tool.params?.every((param: any) => {
        if (param?.optional) return true;
        const matchingParam = config?.parameters?.find(
          (p: any) => p?.type === param.name
        );
        return matchingParam && matchingParam.value?.trim();
      });
    });

    if (appData?.tools?.length) {
      if (appData?.tools?.length > 0 && !allParamsSet && tool) {
        setSetUpParams(true);
      }
    } else {
      setSetUpParams(false);
    }

    if (tool) {
      setActivated(true);
    } else {
      setActivated(false);
    }
  }, [tools, appData]);

  useEffect(() => {
    const configValue =
      toolConfig?.find((item: any) => item?.type === param?.name)?.value || "";
    setInputValue(configValue);
  }, [toolConfig, param]);

  const activateTool = async () => {
    if (appData?.tools?.length > 0) {
      const toolDescriptions = appData.tools
        .map((tool: any) => {
          const paramList = tool.params
            .map((param: any) => `- ${param.name.split("_").join(" ")}`)
            .join("\n");
          return `${tool.name.toUpperCase()}:\n${paramList}`;
        })
        .join("\n\n");
      // ask for confrimation to set up tools
      const result = await confirm({
        message: `To use the following tools, you’ll need to save the required information:`,
        subtitle: `${toolDescriptions} \n\nWould you like to set them up now?`,
      });
      if (result) {
        setSetUpParams(true);
        addTool({
          name: appData?.name,
          value: "active",
        });

        appData?.tools?.forEach((tool: any) => {
          addToolConfig(appData?.name, {
            type: tool.name,
          });
        });

        if ((appData?.name === "Kalshi Prediction Markets" || appData?.name === "Kalshi") && (walletAddress || phoneNumber)) {
          setToast("Paste your Kalshi private key and key id to complete setup", "info");
        }
        if (appData?.name === "Bayse Prediction Markets" && (walletAddress || phoneNumber)) {
          setToast("Paste your Bayse public and secret keys to complete setup", "info");
        }
      }

      // setToast("", )
    } else {
      await delayPromise(2000);
      addTool({
        name: appData?.name,
        value: "active",
      });
      setToast("Tool installed successfully", "success");
    }
  };

  const deactivateTool = async () => {
    if (appData.name === "HeySolana" || appData.name === "Jupiter" || appData.name === "Orova") {
      setToast(
        `You cannot uninstall ${appData.name} it is a core tool`,
        "error"
      );
      return;
    }
    const result = await confirm({
      message: "Are you sure you want to uninstall this tool?",
      subtitle: `if you uninstall this tool, you will not be able to use ${appData.name} to ${appData.short_des} again`,
    });

    if (result) {
      await delayPromise(2000);
      removeTool(appData?.name);
      setToast("Tool uninstalled successfully", "success");
    } else {
      setToast("Tool uninstallation cancelled", "error");
    }
  };

  const handleChangeText = (
    text: string,
    item: any,
    paramItem: any,
    appData: any
  ) => {
    // add the param and value to the input value so it can be updated
    setInputValue({
      ...param,
      name: paramItem.name,
      value: text,
    });
    setParam(param);
    updateToolParameter(appData?.name, item.name, {
      type: paramItem.name,
      value: text,
    });

    if ((appData?.name === "Kalshi Prediction Markets" || appData?.name === "Kalshi") && item?.name === "credentials" && (walletAddress || phoneNumber)) {
      const currentPrivateKey =
        (paramItem?.name === "private_key" ? text : ToolsItem.getState().getParameterValue(appData?.name, "credentials", "private_key"))?.trim?.() || "";
      const currentKeyId =
        (paramItem?.name === "kalshi_access_key_id" ? text : ToolsItem.getState().getParameterValue(appData?.name, "credentials", "kalshi_access_key_id"))?.trim?.() || "";
      const currentKeyLabel = ToolsItem.getState().getParameterValue(appData?.name, "credentials", "key_label") || appData?.name;
      const currentEnv = (ToolsItem.getState().getParameterValue(appData?.name, "credentials", "environment") || "production") as "production" | "staging";

      if (currentPrivateKey && currentKeyId) {
        activateKalshiWallet({
          wallet_address: walletAddress || undefined,
          phone_number: phoneNumber || undefined,
          private_key: currentPrivateKey,
          kalshi_access_key_id: currentKeyId,
          key_label: currentKeyLabel,
          environment: currentEnv,
        }).then(() => {
          setToast("Kalshi credentials imported successfully", "success");
        }).catch((error) => {
          const message = error instanceof Error ? error.message : "Failed to import Kalshi credentials";
          setToast(message, "error");
        });
      }
    }
    if (appData?.name === "Bayse Prediction Markets" && item?.name === "credentials" && (walletAddress || phoneNumber)) {
      const currentPublicKey =
        (paramItem?.name === "public_key" ? text : ToolsItem.getState().getParameterValue(appData?.name, "credentials", "public_key"))?.trim?.() || "";
      const currentSecretKey =
        (paramItem?.name === "secret_key" ? text : ToolsItem.getState().getParameterValue(appData?.name, "credentials", "secret_key"))?.trim?.() || "";
      const currentKeyLabel = ToolsItem.getState().getParameterValue(appData?.name, "credentials", "key_label") || appData?.name;
      const currentCurrency =
        (ToolsItem.getState().getParameterValue(appData?.name, "credentials", "default_currency") || "NGN") as "USD" | "NGN";

      if (currentPublicKey && currentSecretKey) {
        activateBayseWallet({
          wallet_address: walletAddress || undefined,
          phone_number: phoneNumber || undefined,
          public_key: currentPublicKey,
          secret_key: currentSecretKey,
          key_label: currentKeyLabel,
          default_currency: currentCurrency,
        }).then(() => {
          setToast("Bayse credentials imported successfully", "success");
        }).catch((error) => {
          const message = error instanceof Error ? error.message : "Failed to import Bayse credentials";
          setToast(message, "error");
        });
      }
    }
  };

  return (
    <View className="relative w-full bg-grey dark:bg-dark flex-1 items-center">
      <View className="w-full z-10 px-4 py-2 flex flex-row justify-start items-center gap-x-5">
        <Pressable
          onPress={() => router.back()}
          className="p-3 rounded-full bg-white dark:bg-accent"
        >
          <IconLibrary.back />
        </Pressable>
        <CText textColor={"text-white"} className="text-[1.4rem]">
          {appData?.name}
        </CText>
      </View>
      <View className="absolute rounded-b-3xl  top-0 left-0 w-full">
        {appData?.is_active ? (
          <Image
            source={
              appData?.banner instanceof String
                ? { uri: appData?.banner }
                : appData?.banner
            }
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
        ) : (
          <Image
            source={require("@/assets/soon/soon.jpg")}
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        className="w-full px-4 top-[10%] bg-grey dark:bg-black py-5 rounded-t-3xl flex-1"
      >
        <View className="w-full  h-fit p-4 rounded-3xl dark:shadow-none shadow bg-white dark:bg-accent">
          <View className="flex-1 gap-x-2 flex-row justify-start items-center">
            <View className="flex flex-row justify-start items-center gap-x-2 bg-white dark:bg-dark  rounded-3xl w-[75px] h-[75px] overflow-hidden">
              <Image
                source={
                  appData?.icon instanceof String
                    ? { uri: appData?.icon }
                    : appData?.icon
                }
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
            <View className="flex-1 flex-col justify-start items-start gap-y-2  ">
              <CText style={{ fontFamily: "bold" }} className="text-[1.81rem]">
                {appData?.name}
                {appData?.is_active ? "" : " (Coming Soon)"}
              </CText>
              <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">
                {appData?.short_des}
              </CText>
              <View className="flex flex-row justify-start items-center gap-x-2">
                <CText style={{ fontFamily: "reg" }} className="text-[0.8rem]">
                  {appData?.tags.join(", ")}
                </CText>
              </View>
            </View>

            {appData?.is_active && (
              <View className="absolute top-0 right-0 flex-1 h-full">
                {isLoading ? (
                  <InlinePillSkeleton width={88} height={36} />
                ) : (
                  <Buttons
                    type={activated ? "primary" : "secondary"}
                    className="py-2 px-5 rounded-3xl"
                    text={activated ? "Uninstall" : "Install"}
                    onPress={activated ? deactivateTool : activateTool}
                  />
                )}
              </View>
            )}
          </View>
        </View>

        {activated && appData?.tools?.length > 0 && (
          <View className="w-full flex-1 flex-col justify-start items-start shadow gap-y-2 mt-4 bg-white dark:bg-accent p-3 py-3 rounded-2xl">
            <Pressable
              onPress={() => {
                setSetUpParams(true);
              }}
              className="absolute top-5 right-5"
            >
              <IconLibrary.edit />
            </Pressable>
            <View className="w-full flex-1 flex flex-col gap-x-2 justify-start items-start gap-y-2">
              {appData?.tools?.map((item: any, index: number) => {
                const brandColors = appData?.brand_colors?.primary
                  ? `bg-[${appData?.brand_colors?.primary}]`
                  : "bg-purple";
                return (
                  <View key={index} className="gap-y-2">
                    <View
                      className={`bg-purple p-2 px-3 rounded-full justify-center items-center`}
                    >
                      <CText
                        style={{ fontFamily: "reg" }}
                        className="capitalize text-[1rem]"
                        textColor={"text-white"}
                      >
                        {item.name}
                      </CText>
                    </View>

                    <View className="ps-4">
                      {item?.params?.map((param: any, index: number) => {
                        return (
                          <CText
                            key={index}
                            style={{ fontFamily: "reg" }}
                            className="text-[1.2rem] capitalize"
                          >
                            {param?.name?.split("_").join(" ")} -{" "}
                            {param?.options?.find(
                              (item: any) =>
                                item?.value ===
                                toolConfig?.find(
                                  (item: any) => item?.type === param?.name
                                )?.value
                            )?.name ||
                              toolConfig?.find(
                                (item: any) => item?.type === param?.name
                              )?.value
                              ? maskSensitiveValue(
                                param?.name,
                                toolConfig?.find((item: any) => item?.type === param?.name)?.value
                              )
                              : "" ||
                              "Not set"}
                          </CText>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="w-full flex flex-row justify-start items-start  mt-4 gap-x-2">
          <View className="flex-1 py-4 bg-white dark:bg-accent p-3 rounded-3xl">
            <View className="flex flex-row justify-start items-center gap-x-2">
              <Image
                source={require("@/assets/users.png")}
                style={{ width: 40, height: 40 }}
                contentFit="contain"
              />
              <CText style={{ fontFamily: "reg" }} className="text-[1.3rem]">
                100+ users
              </CText>
            </View>
          </View>

          <View className="flex-1 py-4 bg-white dark:bg-accent p-3 rounded-3xl ">
            <View className="flex flex-row justify-start items-center gap-x-2">
              <Image
                source={require("@/assets/star.png")}
                style={{ width: 40, height: 40 }}
                contentFit="contain"
              />
              <CText style={{ fontFamily: "reg" }} className="text-[1.3rem]">
                4.5 rating
              </CText>
            </View>
          </View>
        </View>

        <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4">
          <ScrollView
            className="w-full"
            contentContainerStyle={{ gap: 10, paddingRight: 10 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View className="flex flex-row justify-start items-start gap-x-2">
              {appData?.descriptionImages.map((item: any, index: number) => {
                return (
                  <View
                    className="h-[323px]  w-[200px]  rounded-3xl overflow-hidden"
                    key={index}
                  >
                    <Image
                      source={item instanceof String ? { uri: item } : item}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View className="w-full flex-1 flex-col justify-start items-start gap-y-2 mt-4 bg-white dark:bg-accent p-3 py-4 rounded-2xl">
          <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">
            Description
          </CText>
          <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">
            {appData?.description}
          </CText>
        </View>

        <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4 bg-white dark:bg-accent p-3 py-4 rounded-2xl">
          <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">
            Ratings & Reviews
          </CText>
          {ratings?.length > 0 ? (
            ratings?.map((item: any, index: number) => {
              return (
                <View
                  key={`${item.user_name}-${index}`}
                  className="w-full flex flex-row justify-start items-center gap-x-4"
                >
                  <View className="w-10 h-10 rounded-full bg-white dark:bg-accent2 flex items-center justify-center">
                    <Image
                      source={item.user_image}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                  <View className="flex-1 flex-col justify-start items-start gap-y-2">
                    <CText
                      style={{ fontFamily: "bold" }}
                      className="text-[1.2rem]"
                    >
                      {item.user_name}
                    </CText>
                    <CText
                      style={{ fontFamily: "reg" }}
                      className="text-[1.2rem]"
                    >
                      {item.review}
                    </CText>
                    <View className="flex flex-row justify-start items-center gap-x-2">
                      {Array.from({ length: item.rating.toFixed(0) }).map(
                        (_, index) => (
                          <IconLibrary.star
                            color="#FFD700"
                            size={12}
                            key={index}
                          />
                        )
                      )}
                      {Array.from({ length: 5 - item.rating.toFixed(0) }).map(
                        (_, index) => (
                          <IconLibrary.star
                            color="grey"
                            size={12}
                            key={index}
                          />
                        )
                      )}

                      <CText
                        style={{ fontFamily: "reg" }}
                        className="text-[1.2rem]"
                      >
                        {item.rating.toFixed(1)}
                      </CText>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">
              No ratings yet
            </CText>
          )}
        </View>
      </ScrollView>

      {setUpParams && (
        <ParamsComponent
          appData={appData}
          result={result}
          setResult={setResult}
          setActiveParams={setActiveParams}
          activeParams={activeParams}
          toolConfig={toolConfig}
          setSetUpParams={setSetUpParams}
          tutorial={appData?.tutorial}
        />
      )}
    </View>
  );
}

