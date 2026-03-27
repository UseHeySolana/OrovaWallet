import { View, ScrollView } from "react-native";
import { Pressable } from "react-native";
import CText from "../TextComp";
import IconLibrary from "@/utils/icons";
import ParamsInput from "./ParamsInput";
import Buttons from "../ButtonComp";
import AppSettings from "@/utils/store/settingsstore.store";
import { TouchableNativeFeedback } from "react-native";
import ToolsItem from "@/utils/store/toolsitems.store";
import { delayPromise } from "@/utils/functions";
import { openURL } from "@/utils/functions/extrafunctions";

interface ParamsComponentProps {
  appData: any;
  result: any;
  setResult: (result: any) => void;
  setActiveParams: (activeParams: any) => void;
  activeParams: any;
  toolConfig: any;
  setSetUpParams: (setSetUpParams: boolean | null) => void;
  tutorial?: string;
}

const ParamsComponent = ({
  appData,
  result,
  setResult,
  setActiveParams,
  activeParams,
  toolConfig,
  setSetUpParams,
  tutorial,
}: ParamsComponentProps) => {
  const { updateToolParameter } = ToolsItem();
  const { setToast, setLoading } = AppSettings();

  return (
    <View className="absolute top-0 py-5 left-0 right-0 z-50 px-4 bg-black/90 h-[100%] flex-1 flex flex-col justify-center items-center gap-y-2">
      {/* close button */}

      {/* this is a popup that will allow users to set up toools and fill the fields that they want to setup */}
      <View className="w-full max-h-[88%] bg-white dark:bg-accent p-4 rounded-2xl py-8 flex flex-col justify-start items-start">
        <Pressable
          className="absolute top-0 right-0 p-2"
          onPress={() => setSetUpParams(null)}
        >
          <IconLibrary.cancel size={20} />
        </Pressable>
        <ScrollView
          className="w-full"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {tutorial && (
            <View className="w-full h-fit bg-white dark:bg-accent p-4 rounded-2xl py-4 flex flex-col justify-center items-center">
              <CText
                style={{ fontFamily: "reg" }}
                className="text-[1.2rem] text-center"
              >
                {tutorial}
              </CText>
              <Pressable
                onPress={async () => await openURL(appData?.url)}
                className="w-full flex flex-row justify-center py-3 items-center gap-x-2"
              >
                <IconLibrary.external size={20} />
              </Pressable>
            </View>
          )}
          {result && (
            <View className="w-full h-fit bg-white dark:bg-accent p-4 rounded-2xl py-4 flex flex-col justify-start items-start">
              <CText style={{ fontFamily: "reg" }} className="text-[1.2rem]">
                {JSON.stringify(result)}
              </CText>
            </View>
          )}
          <View className="w-full h-fit flex flex-col justify-start items-start gap-y-10">
            {appData?.tools?.map((item: any, index: number) => {
              return (
                <View
                  key={index}
                  className="w-full flex flex-col justify-start items-start gap-x-2 border-b border-grey dark:border-accent2 "
                >
                  <CText
                    style={{ fontFamily: "reg" }}
                    className="text-[1rem] mb-3"
                  >
                    {item.name.toUpperCase()}
                  </CText>

                {appData?.name === "Kalshi Prediction Markets" && item?.name === "credentials" && (
                  <View className="w-full mb-4 p-3 rounded-2xl bg-grey/30 dark:bg-black/30">
                    <CText style={{ fontFamily: "bold" }} className="text-[1.1rem] mb-2">
                      Connect your Kalshi account
                    </CText>
                    <CText style={{ fontFamily: "reg" }} className="text-[0.95rem]">
                      1) Open Kalshi → Profile → API Keys → Create New API Key.
                    </CText>
                    <CText style={{ fontFamily: "reg" }} className="text-[0.95rem] mt-1">
                      2) Copy the Key ID and the Private Key (you can only see the private key once).
                    </CText>
                    <Pressable
                      onPress={async () => await openURL("https://kalshi.com/account/profile")}
                      className="w-full flex flex-row justify-start items-center gap-x-2 mt-2"
                    >
                      <IconLibrary.external size={18} />
                      <CText style={{ fontFamily: "reg" }} className="text-[0.95rem]">
                        Open Kalshi profile
                      </CText>
                    </Pressable>
                  </View>
                )}

                  <View className="flex flex-col gap-y-3 justify-start items-center gap-x-2">
                    {item.params.map((param: any, index: number) => {
                      return (
                        <View
                          key={index}
                          className="w-full h-fit flex flex-row justify-start items-center  "
                        >
                          {param?.type === "select" ? (
                            <View className="relative w-full">
                              <Pressable
                                onPress={() =>
                                  setActiveParams(
                                    activeParams === param.name
                                      ? null
                                      : param.name
                                  )
                                }
                                className="w-full h-[40px] rounded-xl border border-grey dark:border-accent2 p-2 flex flex-row justify-between items-center"
                              >
                                <CText className="text-[1rem] text-black dark:text-grey">
                                  {param?.options?.find(
                                    (item: any) =>
                                      item.value ===
                                      toolConfig?.find(
                                        (item: any) => item?.type === param.name
                                      )?.value
                                  )?.name || param.name.split("_").join(" ")}
                                </CText>
                                <IconLibrary.arrowdown size={12} />
                              </Pressable>
                              {activeParams === param.name &&
                                param?.options?.length > 0 && (
                                  <ScrollView
                                    contentContainerStyle={{
                                      justifyContent: "flex-start",
                                      alignItems: "flex-start",
                                      gap: 10,
                                      padding: 10,
                                      paddingBottom: 40,
                                    }}
                                    showsVerticalScrollIndicator={false}
                                    className="absolute left-0 bg-white shadow dark:bg-black rounded-2xl w-[70%] min-h-[100px] max-h-[200px] overflow-y-auto z-50"
                                  >
                                    <View className="">
                                      {param?.options?.length > 0 && (
                                        <View className="w-full h-fit flex-1 flex-col justify-start items-start">
                                          {param.options.map(
                                            (option: any, index: number) => {
                                              return (
                                                <TouchableNativeFeedback
                                                  key={index}
                                                  onPress={() => {
                                                    updateToolParameter(
                                                      appData?.name,
                                                      item.name,
                                                      {
                                                        type: param.name,
                                                        value: option.value,
                                                      }
                                                    );
                                                    setActiveParams(null);
                                                  }}
                                                >
                                                  <CText
                                                    key={index}
                                                    className="text-[1rem] text-black dark:text-grey py-5 flex-1 w-screen"
                                                  >
                                                    {option.name}
                                                  </CText>
                                                </TouchableNativeFeedback>
                                              );
                                            }
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </ScrollView>
                                )}
                            </View>
                          ) : (
                            <ParamsInput
                              param={param}
                              appData={appData}
                              item={item}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {item?.action ? (
                    <View className="w-full flex flex-row justify-center py-3 items-center gap-x-2">
                      <Buttons
                        type="primary"
                        className="w-full py-4 px-4 rounded-3xl"
                        text={item?.action?.type}
                        onPress={async () => {
                          const params = item.action.params.map((param: any) => {
                            return toolConfig?.find(
                              (item: any) => item?.type === param.name
                            )?.value;
                          });
                          setLoading(true);

                          const result = await item.action.url(...params);
                          const res = result.data;

                          if (res.status) {
                            setResult(res.data);
                            setToast(res.message, "success");
                            setSetUpParams(null);
                          } else {
                            setToast(res.message, "error");
                            setSetUpParams(null);
                          }
                          setLoading(false);
                          setSetUpParams(null);
                        }}
                      />
                    </View>
                  ) : (
                    <View className="w-full flex flex-row justify-center py-3 items-center gap-x-2">
                      <Buttons
                        type="primary"
                        className="w-full py-4 px-4 rounded-3xl"
                        text={"Save"}
                        onPress={async () => {
                          setLoading(true);
                          await delayPromise(1000);
                          setToast("Tool saved", "success");
                          setSetUpParams(null);
                          setLoading(false);
                        }}
                      />
                    </View>
                  )}
              </View>
            );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default ParamsComponent;
