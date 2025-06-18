import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ImageBackground, Linking, Pressable, ScrollView, TextInput, TouchableNativeFeedback, View } from "react-native";
import IconLibrary from "@/misc/helpers/icons";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import { apps, reviews } from "@/misc/apptest/apps";
import Buttons from "@/components/ButtonComp";
import { useThemeContext } from "@/misc/context/ThemeContext";
import ToolsItem from "@/misc/store/toolsitems";
import { delay, delayPromise } from "@/misc/helpers/miscfunctions.ts";
import AppSettings from "@/misc/store/settingsstore";
import { confirm } from "@/misc/helpers/service/confirmation";
import UserItem from "@/misc/store/userstore";

/**
  * What should be done here
  * Show AppStore
  */
function AppItems() {

    const { isDarkMode } = useThemeContext()
    const { app } = useLocalSearchParams();
    const { user } = UserItem()
    const [appData, setAppData] = useState<any>(null);
    const [ratings, setRatings] = useState<any>(null);
    const { tools, addTool, removeTool, addToolConfig, removeToolConfig, clearTools, updateToolParameter } = ToolsItem()
    const [activated, setActivated] = useState(false)
    const { isLoading, setToast, setLoading } = AppSettings();
    const [activeParams, setActiveParams] = useState<any>(null)
    const [setUpParams, setSetUpParams] = useState<boolean>(false)

    const [activatedConfigs, setActivatedConfigs] = useState<any>(null)
    const [toolConfig, setToolConfig] = useState<any>(null)
    const [result, setResult] = useState<any>(null)


    useEffect(() => {
        if (app) {
            const appData = apps.find((item: any) => item.name === app);
            setAppData(appData);

            const appRatings = reviews.filter((item: any) => item.app_name === app);
            setRatings(appRatings);

        }
    }, [app])

    useEffect(() => {
        const tool = tools.find((tool: any) => tool.name === appData?.name && tool.value === "active")
        const configs = tool?.config || []
        setToolConfig(configs.map((item: any) => item.parameters).flat())

        appData?.tools?.forEach((configItem: any) => {
            const config = configs?.find((item: any) => item.name === configItem.name)
            if (config) {
                // add config to activatedConfigs and make sure you don't add it if it already exists
                if (!activatedConfigs[configItem.name]) {
                    setActivatedConfigs((prev: any) => ({ ...prev, [configItem.name]: config }))
                }
            }
        })


        const allParamsSet = appData?.tools?.every((tool: any) => {
            // Find the corresponding config by tool name
            const config = configs?.find((item: any) => item?.type === tool.name);

            // If no config or no parameters, consider it incomplete
            if (!config || !config.parameters) return false;

            // Check that every param in the tool has a matching param with a value in the config
            return tool.params?.every((param: any) => {
                const matchingParam = config?.parameters?.find(
                    (p: any) => p?.type === param.name
                );
                return matchingParam && matchingParam.value?.trim();
            });
        });


        if (appData?.tools?.length) {
            if (appData?.tools?.length > 0 && !allParamsSet && tool) {
                setSetUpParams(true)
            }
        } else {
            setSetUpParams(false)
        }

        if (tool) {
            setActivated(true)
        } else {
            setActivated(false)
        }
    }, [tools, appData])


    const activateTool = async () => {
        if (appData?.tools?.length > 0) {

            const toolDescriptions = appData.tools
                .map((tool: any) => {
                    const paramList = tool.params.map((param: any) => `- ${param.name.split("_").join(" ")}`).join('\n');
                    return `${tool.name.toUpperCase()}:\n${paramList}`;
                })
                .join('\n\n');
            // ask for confrimation to set up tools
            const result = await confirm({
                message: `To use the following tools, you’ll need to save the required information:`,
                subtitle: `${toolDescriptions} \n\nWould you like to set them up now?`
            });
            if (result) {
                setSetUpParams(true)
                addTool({
                    name: appData?.name,
                    value: "active",
                })

                appData?.tools?.forEach((tool: any) => {
                    addToolConfig(
                        appData?.name,
                        {
                            type: tool.name,
                        }
                    )
                })
            }

            // setToast("", )

        } else {
            await delayPromise(2000)
            addTool({
                name: appData?.name,
                value: "active",
            })
            setToast("Tool installed successfully", "success")

        }
    }

    const deactivateTool = async () => {


        if (appData.name === "HeySolana" || appData.name === "Jupiter") {
            setToast(`You cannot uninstall ${appData.name} it is a core tool`, "error");
            return;
        }
        const result = await confirm({
            message: "Are you sure you want to uninstall this tool?",
            subtitle: `if you uninstall this tool, you will not be able to use ${appData.name} to ${appData.short_des} again`
        })

        if (result) {
            await delayPromise(2000)
            removeTool(appData?.name)
            setToast("Tool uninstalled successfully", "success");
        } else {
            setToast("Tool uninstallation cancelled", "error");
        }

    }


    return (
        <View
            className="relative w-full bg-grey dark:bg-dark flex-1 items-center"
        >
            <View className="w-full z-10 px-4 py-2 flex flex-row justify-start items-center gap-x-5">
                <Pressable onPress={() => router.back()} className="p-3 rounded-full bg-white dark:bg-accent">
                    <IconLibrary.back />
                </Pressable>
                <CText textColor={"text-white"} className="text-[1.4rem]">{appData?.name}</CText>
            </View>
            <View className="absolute rounded-b-3xl  top-0 left-0 w-full">
                {appData?.is_active ?
                    <Image source={appData?.banner instanceof String ? { uri: appData?.banner } : appData?.banner} style={{ width: "100%", height: 200 }} contentFit="cover" />
                    :
                    <Image source={require('@/assets/soon/soon.jpg')} style={{ width: "100%", height: 200 }} contentFit="cover" />
                }
            </View>
            {/* <View className="w-full  px-4 h-[40px] rounded-t-3xl dark:shadow-none shadow bg-white dark:bg-accent">
                <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4">
                    <CText className="text-[1.4rem]">{appData?.name}</CText>
                    <CText className="text-[1.2rem]">{appData?.description}</CText>
                </View>
            </View> */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                className="w-full px-4 top-[10%] bg-black py-5 rounded-t-3xl flex-1"
            >
                <View className="w-full h-fit p-4 rounded-3xl dark:shadow-none shadow bg-white dark:bg-accent">
                    <View className="flex-1 gap-x-2 flex-row justify-start items-center">
                        <View className="flex flex-row justify-start items-center gap-x-2 bg-white dark:bg-dark  rounded-3xl w-[75px] h-[75px] overflow-hidden">
                            <Image source={appData?.icon instanceof String ? { uri: appData?.icon } : appData?.icon} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              

                        </View>
                        <View className="flex flex-col justify-start items-start gap-y-1 ">
                            <CText style={{ fontFamily: "bold" }} className="text-[1.81rem]">{appData?.name}{appData?.is_active ? "" : " (Coming Soon)"}</CText>
                            <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">{appData?.short_des}</CText>
                            <View className="flex flex-row justify-start items-center gap-x-2">
                                <CText style={{ fontFamily: "reg" }} className="text-[0.8rem]">{appData?.tags.join(", ")}</CText>
                            </View>



                        </View>

                        <View className="absolute top-0 right-0 flex-1 h-full">

                            {isLoading ? <ActivityIndicator size="small" color="#0000ff" /> :
                                <Buttons type={activated ? "primary" : "secondary"} className="py-2 px-12 rounded-3xl" text={activated ? "Uninstall" : "Install"} onPress={activated ? deactivateTool : activateTool} />
                            }

                        </View>

                    </View>
                </View>

                {appData?.tools?.length > 0 &&
                    <View className="w-full flex-1 flex-col justify-start items-start gap-y-2 mt-4 bg-white dark:bg-accent p-3 py-3 rounded-2xl">
                        <View className="w-full flex flex-row gap-x-2 justify-start items-start gap-y-2">
                            {appData?.tools?.map((item: any, index: number) => {
                                return <View key={index} className="gap-y-2">
                                    <View className="bg-purple p-2 px-3 rounded-full">
                                    <CText style={{ fontFamily: "reg" }} className="capitalize text-[1.2rem]">{item.name}</CText>
                                    </View>
                                   
                                   <View>
                                    {item?.params?.map((param: any, index: number) => {
                                        return <CText key={index} style={{ fontFamily: "reg" }} className="text-[1.2rem] capitalize">{param?.name?.split("_").join(" ")} - {param?.options?.find((item: any) => item?.value === toolConfig?.find((item: any) => item?.type === param?.name)?.value)?.name || toolConfig?.find((item: any) => item?.type === param?.name)?.value || "Not set"}</CText>
                                    })}
                                    </View>

                                </View>
                            })}
                        </View>
                    </View>
                }

                <View className="w-full flex flex-row justify-start items-start  mt-4 gap-x-2">
                    <View className="flex-1 py-4 bg-white dark:bg-accent p-3 rounded-3xl">
                        <View className="flex flex-row justify-start items-center gap-x-2">
                            <Image source={require('@/assets/users.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
                            <CText style={{ fontFamily: "reg" }} className="text-[1.3rem]">100+ users</CText>
                        </View>

                    </View>

                    <View className="flex-1 py-4 bg-white dark:bg-accent p-3 rounded-3xl ">
                        <View className="flex flex-row justify-start items-center gap-x-2">
                            <Image source={require('@/assets/star.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
                            <CText style={{ fontFamily: "reg" }} className="text-[1.3rem]">4.5 rating</CText>
                        </View>
                    </View>

                </View>

                <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4">
                    <ScrollView
                        className="w-full"
                        contentContainerStyle={{ gap: 10, paddingRight: 10 }}
                        horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex flex-row justify-start items-start gap-x-2">
                            {appData?.descriptionImages.map((item: any, index: number) => {
                                return (
                                    <View className="h-[323px]  w-[200px]  rounded-3xl overflow-hidden" key={index}>
                                        <Image source={item instanceof String ? { uri: item } : item} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                    </View>
                                )

                            })}
                        </View>

                    </ScrollView>
                </View>

                <View className="w-full flex-1 flex-col justify-start items-start gap-y-2 mt-4 bg-white dark:bg-accent p-3 py-4 rounded-2xl">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">Description</CText>
                    <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">{appData?.description}</CText>
                </View>

                <View className="w-full flex flex-col justify-start items-start gap-y-4 mt-4 bg-white dark:bg-accent p-3 py-4 rounded-2xl">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.8rem]">Ratings & Reviews</CText>
                    {ratings?.length > 0 ? ratings?.map((item: any, index: number) => {
                        return (
                            <View key={`${item.user_name}-${index}`} className="w-full flex flex-row justify-start items-center gap-x-4">
                                <View className="w-10 h-10 rounded-full bg-white dark:bg-accent2 flex items-center justify-center">
                                    <Image source={item.user_image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                </View>
                                <View className="flex-1 flex-col justify-start items-start gap-y-2">
                                    <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">{item.user_name}</CText>
                                    <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">{item.review}</CText>
                                    <View className="flex flex-row justify-start items-center gap-x-2">
                                        {Array.from({ length: item.rating.toFixed(0) }).map((_, index) => (
                                            <IconLibrary.star color="#FFD700" size={12} key={index} />
                                        ))}
                                        {Array.from({ length: 5 - item.rating.toFixed(0) }).map((_, index) => (
                                            <IconLibrary.star color="grey" size={12} key={index} />
                                        ))}

                                        <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">{item.rating.toFixed(1)}</CText>
                                    </View>
                                </View>
                            </View>
                        )
                    }) : <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">No ratings yet</CText>}
                </View>
            </ScrollView>

            {setUpParams &&
                <View className="absolute top-0 py-5 left-0 right-0 z-50 px-4 bg-black/90 h-[100%] flex-1 flex flex-col justify-center items-center gap-y-2">
                    {/* this is a popup that will allow users to set up toools and fill the fields that they want to setup */}

                    <View className="w-full h-fit bg-white dark:bg-accent p-4 rounded-2xl py-8 flex flex-col justify-start items-start">
                        {result &&
                            <View className="w-full h-fit bg-white dark:bg-accent p-4 rounded-2xl py-8 flex flex-col justify-start items-start">
                                <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">{JSON.stringify(result)}</CText>
                            </View>
                        }
                        <View className="w-full h-fit flex flex-col justify-start items-start gap-y-10">
                            {appData?.tools?.map((item: any, index: number) => {
                                return <View key={index} className="w-full flex flex-col justify-start items-start gap-x-2 border-b border-grey dark:border-accent2 pb-4">
                                    <CText style={{ fontFamily: "reg" }} className="text-[1rem] mb-3">{item.name.toUpperCase()}</CText>

                                    <View className="flex flex-col gap-y-3 justify-start items-center gap-x-2">
                                        {item.params.map((param: any, index: number) => {
                                            return <View key={index} className="w-full h-fit flex flex-row justify-start items-center  ">
                                                {param?.type === "select" ?
                                                    <View className="relative">
                                                        <Pressable
                                                            onPress={() => setActiveParams(activeParams === param.name ? null : param.name)}
                                                            className="w-full h-[40px] rounded-xl border border-grey dark:border-accent2 p-2 flex flex-row justify-between items-center"

                                                        >
                                                            <CText className="text-[1rem] text-black dark:text-grey">
                                                                {param?.options?.find((item: any) => item.value === toolConfig?.find((item: any) => item?.type === param.name)?.value)?.name || param.name.split("_").join(" ")}
                                                            </CText>
                                                            <IconLibrary.arrowdown size={12} />
                                                        </Pressable>
                                                        {activeParams === param.name && param?.options?.length > 0 &&
                                                            <ScrollView
                                                                contentContainerStyle={{
                                                                    justifyContent: "flex-start",
                                                                    alignItems: "flex-start",
                                                                    gap: 10,
                                                                    padding: 10,
                                                                    paddingBottom: 40
                                                                }}
                                                                showsVerticalScrollIndicator={false}
                                                                className="absolute left-0 bg-white shadow dark:bg-black rounded-2xl w-[50%] min-h-[100px] max-h-[200px] overflow-y-auto z-50">

                                                                <View className="">
                                                                    {param?.options?.length > 0 &&
                                                                        <View className="w-full h-fit flex-1 flex-col justify-start items-start">
                                                                            {param.options.map((option: any, index: number) => {
                                                                                return (
                                                                                    <TouchableNativeFeedback
                                                                                        key={index}
                                                                                        onPress={() => {
                                                                                            updateToolParameter(
                                                                                                appData?.name,
                                                                                                item.name,
                                                                                                {
                                                                                                    type: param.name,
                                                                                                    value: option.value
                                                                                                }
                                                                                            )
                                                                                            setActiveParams(null)
                                                                                        }}
                                                                                    >
                                                                                        <CText key={index} className="text-[1rem] text-black dark:text-grey py-5 flex-1 w-screen
                                                                                        ">{option.name}</CText>
                                                                                    </TouchableNativeFeedback>
                                                                                )
                                                                            })}
                                                                        </View>
                                                                    }
                                                                </View>
                                                            </ScrollView>
                                                        }
                                                    </View>
                                                    :
                                                    <TextInput
                                                        className="w-full h-[40px] text-black dark:text-grey rounded-xl border border-grey dark:border-accent2 p-2"
                                                        editable={!param?.name?.includes("phone_number")}
                                                        value={
                                                            toolConfig?.find((item: any) => item?.type === param.name)?.value || ""}
                                                        placeholder={param?.name?.split("_").join(" ")}
                                                        placeholderTextColor="grey"
                                                        onChangeText={(text) => {
                                                            updateToolParameter(
                                                                appData?.name,
                                                                item.name,
                                                                {
                                                                    type: param.name,
                                                                    value: text
                                                                }
                                                            )
                                                        }}
                                                    />
                                                }
                                            </View>
                                        })}
                                    </View>

                                    {item?.action &&
                                        <View className="w-full flex flex-row justify-start items-center gap-x-2">
                                            <Buttons type="primary"
                                                text={item?.action?.type} onPress={async () => {
                                                    const params = item.action.params.map((param: any) => {
                                                        return toolConfig?.find((item: any) => item?.type === param.name)?.value
                                                    })
                                                    setLoading(true)
                                                    const result = await item.action.url(...params)
                                                    const res = result.data
                                                    if (res.status) {
                                                        setResult(res.data)
                                                        setToast(res.message + " " + res.name, "success")
                                                        setSetUpParams(false)
                                                    } else {
                                                        setToast(res.message, "error")
                                                    }
                                                    setLoading(false)
                                                }} />
                                        </View>
                                    }
                                </View>
                            })}
                        </View>
                    </View>
                </View>
            }
        </View>
    );
}

export default AppItems;

