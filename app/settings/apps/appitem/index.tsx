import React, { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import IconLibrary from "@/utils/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import { getCapability, toImageSource } from "@/libs/app/apps";
import Buttons from "@/components/ButtonComp";
import { InlinePillSkeleton } from "@/components/skeletons";
import { useThemeContext } from "@/context/ThemeContext";
import ToolsItem from "@/utils/store/toolsitems.store";
import AppCatalog from "@/utils/store/appCatalog.store";
import { delayPromise } from "@/utils/functions";
import AppSettings from "@/utils/store/settingsstore.store";
import { confirm } from "@/services/confirmation";
import UserItem from "@/utils/store/userstore.store";
import ParamsComponent from "@/components/AppItemsParam/Params";
import WalletItem from "@/utils/store/wallet.store";
import { activateKalshiWallet } from "@/services/kalshiApi";
import { activateBayseWallet } from "@/services/bayseApi";
import {
  fetchAppReviews,
  formatRating,
  formatUserCount,
  recordAppInstall,
  recordAppUninstall,
  submitAppReview,
  type AppEngagementStats,
  type AppReviewItem,
} from "@/services/appEngagementApi";

/**
 * What should be done here
 * Show AppStore
 */
export default function AppItems() {
  const { isDarkMode } = useThemeContext();
  const { app } = useLocalSearchParams();
  const { user } = UserItem();
  const walletAddress = WalletItem((state) => state.publicKey?.toString() || "");
  const phoneNumber =
    user?.phoneE164?.trim() || user?.mobileNumber?.trim() || "";
  const [appData, setAppData] = useState<any>(null);
  const [ratings, setRatings] = useState<AppReviewItem[]>([]);
  const [myReview, setMyReview] = useState<AppReviewItem | null>(null);
  const [engagement, setEngagement] = useState<AppEngagementStats | null>(null);
  const [draftRating, setDraftRating] = useState(0);
  const [draftReview, setDraftReview] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const {
    tools,
    addTool,
    removeTool,
    addToolConfig,
    updateToolParameter,
  } = ToolsItem();
  const [activated, setActivated] = useState(false);
  const { isLoading, setToast } = AppSettings();
  const [activeParams, setActiveParams] = useState<any>(null);
  const [setUpParams, setSetUpParams] = useState<boolean | null>(null);

  const [activatedConfigs, setActivatedConfigs] = useState<any>(null);
  const [toolConfig, setToolConfig] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [inputValue, setInputValue] = useState<any>({});
  const [param, setParam] = useState<any>(null);

  const buildIdentity = useCallback(
    () => ({
      wallet_address: walletAddress || undefined,
      phone_number: phoneNumber || undefined,
      user_name: user?.username || undefined,
      user_image: user?.profileImageUri || undefined,
    }),
    [walletAddress, phoneNumber, user?.username, user?.profileImageUri]
  );

  const applyEngagement = useCallback((stats: AppEngagementStats | null) => {
    if (!stats) return;
    setEngagement(stats);
    setAppData((prev: any) =>
      prev
        ? {
            ...prev,
            ratings: stats.ratings,
            user_count: stats.user_count,
            review_count: stats.review_count,
          }
        : prev
    );
  }, []);

  const loadReviews = useCallback(
    async (slug: string) => {
      const identity = buildIdentity();
      const hasIdentity = !!(identity.wallet_address || identity.phone_number);
      const result = await fetchAppReviews(
        slug,
        hasIdentity ? identity : undefined
      );
      setRatings(result.reviews);
      setMyReview(result.mine);
      if (result.mine) {
        setDraftRating(result.mine.rating || 0);
        setDraftReview(result.mine.review || "");
      }
      applyEngagement(result.engagement);
    },
    [buildIdentity, applyEngagement]
  );

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

  const catalogApps = AppCatalog((s) => s.apps);

  useEffect(() => {
    if (app) {
      const key = Array.isArray(app) ? app[0] : String(app);
      const data = AppCatalog.getState().getAppBySlugOrName(key);
      setAppData(data);
      if (data?.slug) {
        setEngagement({
          ratings: Number(data.ratings ?? 0),
          user_count: Number(data.user_count ?? 0),
          review_count: Number(data.review_count ?? 0),
        });
        void loadReviews(data.slug);
      } else {
        setRatings([]);
        setMyReview(null);
      }
    }
  }, [app, catalogApps, loadReviews]);

  const appStoreKey = appData?.slug || appData?.name;

  useEffect(() => {
    const tool = tools.find(
      (tool: any) =>
        (tool.name === appStoreKey || tool.name === appData?.name) &&
        tool.value === "active"
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
        if (!(matchingParam && matchingParam.value?.trim())) return false;
        // Chowdeck address must be resolved via autocomplete (place_id saved under the hood)
        if (
          (appData?.slug === "chowdeck" || appData?.name === "Chowdeck") &&
          (param?.type === "chowdeck_address" || param?.name === "delivery_address")
        ) {
          const placeId = config?.parameters?.find((p: any) => p?.type === "place_id")?.value?.trim();
          return !!placeId;
        }
        return true;
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

  // Backfill install for apps already activated locally before engagement tracking existed
  useEffect(() => {
    if (!activated || !appData?.slug) return;
    const identity = buildIdentity();
    if (!identity.wallet_address && !identity.phone_number) return;
    void recordAppInstall(appData.slug, identity).then(applyEngagement);
  }, [activated, appData?.slug, buildIdentity, applyEngagement]);

  useEffect(() => {
    const configValue =
      toolConfig?.find((item: any) => item?.type === param?.name)?.value || "";
    setInputValue(configValue);
  }, [toolConfig, param]);

  const syncInstallRemote = async () => {
    const identity = buildIdentity();
    if (!appData?.slug || (!identity.wallet_address && !identity.phone_number)) {
      return;
    }
    const stats = await recordAppInstall(appData.slug, identity);
    applyEngagement(stats);
  };

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
          name: appStoreKey,
          value: "active",
        });

        appData?.tools?.forEach((tool: any) => {
          addToolConfig(appStoreKey, {
            type: tool.name,
          });
        });

        void syncInstallRemote();

        if ((appData?.slug === "kalshi" || appData?.name === "Kalshi Prediction Markets" || appData?.name === "Kalshi") && (walletAddress || phoneNumber)) {
          setToast("Paste your Kalshi private key and key id to complete setup", "info");
        }
        if ((appData?.slug === "bayse" || appData?.name === "Bayse Prediction Markets") && (walletAddress || phoneNumber)) {
          setToast("Paste your Bayse public and secret keys to complete setup", "info");
        }
      }

      // setToast("", )
    } else {
      await delayPromise(2000);
      addTool({
        name: appStoreKey,
        value: "active",
      });
      void syncInstallRemote();
      setToast("Tool installed successfully", "success");
    }
  };

  const deactivateTool = async () => {
    const capability = getCapability(appStoreKey);
    if (capability?.core || appData.name === "HeySolana" || appData.name === "Jupiter" || appData.name === "Orova") {
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
      removeTool(appStoreKey);
      const identity = buildIdentity();
      if (appData?.slug && (identity.wallet_address || identity.phone_number)) {
        const stats = await recordAppUninstall(appData.slug, identity);
        applyEngagement(stats);
      }
      setToast("Tool uninstalled successfully", "success");
    } else {
      setToast("Tool uninstallation cancelled", "error");
    }
  };

  const handleSubmitReview = async () => {
    if (!activated) {
      setToast("Install the app before leaving a rating", "error");
      return;
    }
    if (!draftRating || draftRating < 1) {
      setToast("Pick a star rating first", "error");
      return;
    }
    const identity = buildIdentity();
    if (!identity.wallet_address && !identity.phone_number) {
      setToast("Connect a wallet or phone number to leave a review", "error");
      return;
    }
    if (!appData?.slug) return;

    setSubmittingReview(true);
    const result = await submitAppReview(appData.slug, {
      ...identity,
      rating: draftRating,
      review: draftReview.trim() || undefined,
    });
    setSubmittingReview(false);

    if (result.error) {
      setToast(result.error, "error");
      return;
    }

    if (result.review) {
      setMyReview(result.review);
      setRatings((prev) => {
        const withoutMine = prev.filter((r) => r.id !== result.review!.id);
        return [result.review!, ...withoutMine];
      });
    }
    applyEngagement(result.engagement);
    setToast(myReview ? "Review updated" : "Thanks for your rating!", "success");
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
    const storeKey = appData?.slug || appData?.name || appStoreKey;
    updateToolParameter(storeKey, item.name, {
      type: paramItem.name,
      value: text,
    });

    if ((appData?.slug === "kalshi" || appData?.name === "Kalshi Prediction Markets" || appData?.name === "Kalshi") && item?.name === "credentials" && (walletAddress || phoneNumber)) {
      const currentPrivateKey =
        (paramItem?.name === "private_key" ? text : ToolsItem.getState().getParameterValue(storeKey, "credentials", "private_key"))?.trim?.() || "";
      const currentKeyId =
        (paramItem?.name === "kalshi_access_key_id" ? text : ToolsItem.getState().getParameterValue(storeKey, "credentials", "kalshi_access_key_id"))?.trim?.() || "";
      const currentKeyLabel = ToolsItem.getState().getParameterValue(storeKey, "credentials", "key_label") || appData?.name;
      const currentEnv = (ToolsItem.getState().getParameterValue(storeKey, "credentials", "environment") || "production") as "production" | "staging";

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
    if ((appData?.slug === "bayse" || appData?.name === "Bayse Prediction Markets") && item?.name === "credentials" && (walletAddress || phoneNumber)) {
      const currentPublicKey =
        (paramItem?.name === "public_key" ? text : ToolsItem.getState().getParameterValue(appStoreKey, "credentials", "public_key"))?.trim?.() || "";
      const currentSecretKey =
        (paramItem?.name === "secret_key" ? text : ToolsItem.getState().getParameterValue(appStoreKey, "credentials", "secret_key"))?.trim?.() || "";
      const currentKeyLabel = ToolsItem.getState().getParameterValue(appStoreKey, "credentials", "key_label") || appData?.name;
      const currentCurrency =
        (ToolsItem.getState().getParameterValue(appStoreKey, "credentials", "default_currency") || "NGN") as "USD" | "NGN";

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
            source={toImageSource(appData?.banner)}
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
                source={toImageSource(appData?.icon)}
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

        {activated && appData?.dashboardRoute && (
          <View className="w-full mt-4">
            <Buttons
              type="primary"
              className="w-full py-4 rounded-3xl"
              text="Open Airbills"
              onPress={() => router.push(appData.dashboardRoute as any)}
            />
          </View>
        )}

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
                              (toolConfig?.find(
                                (item: any) => item?.type === param?.name
                              )?.value
                                ? maskSensitiveValue(
                                    param?.name,
                                    toolConfig?.find(
                                      (item: any) => item?.type === param?.name
                                    )?.value
                                  )
                                : "Not set")}
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
                {formatUserCount(
                  engagement?.user_count ?? appData?.user_count ?? 0
                )}
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
                {formatRating(engagement?.ratings ?? appData?.ratings ?? 0)}
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
          <View className="w-full flex-row justify-between items-center">
            <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">
              Ratings & Reviews
            </CText>
            {(engagement?.review_count ?? appData?.review_count ?? 0) > 0 && (
              <CText style={{ fontFamily: "reg" }} className="text-[1rem]">
                {engagement?.review_count ?? appData?.review_count} reviews
              </CText>
            )}
          </View>

          {activated && (
            <View className="w-full gap-y-3 border-b border-grey/30 dark:border-white/10 pb-4">
              <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
                {myReview ? "Update your rating" : "Rate this app"}
              </CText>
              <View className="flex flex-row items-center gap-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setDraftRating(star)}>
                    <IconLibrary.star
                      color={star <= draftRating ? "#FFD700" : "grey"}
                      size={28}
                    />
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={draftReview}
                onChangeText={setDraftReview}
                placeholder="Write a review (optional)"
                placeholderTextColor={isDarkMode ? "#888" : "#999"}
                multiline
                className="w-full min-h-[80px] p-3 rounded-2xl bg-grey dark:bg-dark text-[1.1rem] text-black dark:text-white"
                style={{ fontFamily: "reg", textAlignVertical: "top" }}
              />
              <Buttons
                type="primary"
                className="py-3 px-5 rounded-3xl self-start"
                text={
                  submittingReview
                    ? "Submitting…"
                    : myReview
                      ? "Update review"
                      : "Submit rating"
                }
                onPress={handleSubmitReview}
              />
            </View>
          )}

          {ratings?.length > 0 ? (
            ratings?.map((item: AppReviewItem, index: number) => {
              const stars = Math.max(0, Math.min(5, Math.round(item.rating || 0)));
              const avatarSource =
                typeof item.user_image === "string" && item.user_image
                  ? { uri: item.user_image }
                  : require("@/assets/users.png");
              return (
                <View
                  key={`${item.id ?? item.user_name}-${index}`}
                  className="w-full flex flex-row justify-start items-center gap-x-4"
                >
                  <View className="w-10 h-10 rounded-full bg-white dark:bg-accent2 flex items-center justify-center overflow-hidden">
                    <Image
                      source={avatarSource}
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
                    {!!item.review && (
                      <CText
                        style={{ fontFamily: "reg" }}
                        className="text-[1.2rem]"
                      >
                        {item.review}
                      </CText>
                    )}
                    <View className="flex flex-row justify-start items-center gap-x-2">
                      {Array.from({ length: stars }).map((_, i) => (
                        <IconLibrary.star
                          color="#FFD700"
                          size={12}
                          key={`filled-${i}`}
                        />
                      ))}
                      {Array.from({ length: 5 - stars }).map((_, i) => (
                        <IconLibrary.star
                          color="grey"
                          size={12}
                          key={`empty-${i}`}
                        />
                      ))}

                      <CText
                        style={{ fontFamily: "reg" }}
                        className="text-[1.2rem]"
                      >
                        {Number(item.rating).toFixed(1)}
                      </CText>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">
              {activated
                ? "No reviews yet — be the first to rate this app"
                : "No ratings yet"}
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

