import { useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    View,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";

import CText from "@/components/TextComp";
import IconLibrary from "@/utils/icons";
import AppSettings from "@/utils/store/settingsstore.store";
import {
    runDevSampleSwapV2Quote,
    runDevSampleTokenSearch,
} from "@/libs/dev/runDevNetworkSamples";
import {
    useDevNetworkLogStore,
    type DevNetworkLogEntry,
} from "@/utils/store/devNetworkLog.store";

function formatTime(at: number) {
    try {
        return new Date(at).toLocaleString();
    } catch {
        return String(at);
    }
}

async function copyToClipboard(toastLabel: string, text: string) {
    try {
        await Clipboard.setStringAsync(text);
        AppSettings.getState().setToast(`${toastLabel} copied`, "success");
    } catch {
        AppSettings.getState().setToast("Copy failed", "error");
    }
}

export default function DevNetworkScreen() {
    const entries = useDevNetworkLogStore((s) => s.entries);
    const clear = useDevNetworkLogStore((s) => s.clear);
    const [detail, setDetail] = useState<DevNetworkLogEntry | null>(null);

    if (!__DEV__) {
        return (
            <View className="flex-1 bg-grey dark:bg-dark justify-center items-center px-6">
                <CText className="text-center">This screen is only available in development builds.</CText>
                <Pressable
                    onPress={() => router.back()}
                    className="mt-6 px-5 py-3 rounded-full bg-purple"
                >
                    <CText className="text-white">Go back</CText>
                </Pressable>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-grey dark:bg-dark px-4 pt-3">
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-x-2">
                    <Pressable
                        onPress={() => router.back()}
                        className="p-3 rounded-full bg-white dark:bg-accent"
                    >
                        <IconLibrary.back />
                    </Pressable>
                    <CText style={{ fontFamily: "bold" }} className="text-[1.2rem]">
                        Dev — Network log
                    </CText>
                </View>
                {entries.length > 0 && (
                    <Pressable
                        onPress={() => {
                            clear();
                            setDetail(null);
                        }}
                        className="px-3 py-2 rounded-full bg-white dark:bg-accent"
                    >
                        <CText>Clear</CText>
                    </Pressable>
                )}
            </View>

            <CText className="text-[0.85rem] opacity-70 mb-3">
                In-app Jupiter swap (/order and /execute), token search, and tool traces are logged here.
                Use the samples below to verify connectivity without running a voice session.
            </CText>

            <View className="gap-y-2 mb-4">
                <Pressable
                    onPress={() => {
                        void runDevSampleSwapV2Quote().then((msg) => Alert.alert("Dev network", msg));
                    }}
                    className="py-3 px-4 rounded-xl bg-purple"
                >
                    <CText className="text-white text-center">
                        Sample: Jupiter swap v2 /order (quote only)
                    </CText>
                </Pressable>
                <Pressable
                    onPress={() => {
                        void runDevSampleTokenSearch().then((msg) => Alert.alert("Dev network", msg));
                    }}
                    className="py-3 px-4 rounded-xl bg-white dark:bg-accent border border-grey/15"
                >
                    <CText className="text-center">Sample: Jupiter tokens v2 /search</CText>
                </Pressable>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {entries.length === 0 ? (
                    <View className="py-10 items-center">
                        <CText className="opacity-70 text-center">
                            No requests logged yet. Trigger a swap or token search, or run a sample above.
                        </CText>
                    </View>
                ) : (
                    <View className="gap-y-2">
                        {entries.map((e) => (
                            <Pressable
                                key={e.id}
                                onPress={() => setDetail(e)}
                                className="p-4 rounded-2xl bg-white dark:bg-accent border border-grey/10"
                            >
                                <CText style={{ fontFamily: "bold" }} className="text-[1rem]">
                                    {e.label}
                                </CText>
                                <CText className="text-[0.85rem] opacity-70 mt-1" numberOfLines={2}>
                                    {e.method} {e.status} · {e.durationMs}ms
                                </CText>
                                <CText className="text-[0.8rem] opacity-60 mt-1" numberOfLines={2}>
                                    {e.url}
                                </CText>
                                <CText className="text-[0.75rem] opacity-50 mt-2">
                                    {formatTime(e.at)}
                                </CText>
                            </Pressable>
                        ))}
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={detail !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setDetail(null)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="max-h-[88%] rounded-t-3xl bg-white dark:bg-dark px-4 pt-4 pb-8">
                        <View className="flex-row justify-between items-center mb-3">
                            <CText style={{ fontFamily: "bold" }} className="text-[1.1rem] flex-1 pr-2">
                                {detail?.label}
                            </CText>
                            <Pressable
                                onPress={() => setDetail(null)}
                                className="p-2 rounded-full bg-grey dark:bg-accent"
                            >
                                <CText>Close</CText>
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator>
                            {detail ? (
                                <>
                                    <CText className="text-[0.85rem] opacity-80 mb-2">
                                        {detail.method} · HTTP {detail.status} · {detail.durationMs}ms ·{" "}
                                        {formatTime(detail.at)}
                                    </CText>
                                    <CText
                                        style={{ fontFamily: "bold" }}
                                        className="text-[0.9rem] mb-1"
                                    >
                                        URL
                                    </CText>
                                    <CText className="text-[0.8rem] mb-3" selectable>
                                        {detail.url}
                                    </CText>
                                    {detail.requestSummary ? (
                                        <>
                                            <CText
                                                style={{ fontFamily: "bold" }}
                                                className="text-[0.9rem] mb-1"
                                            >
                                                Request summary
                                            </CText>
                                            <CText className="text-[0.8rem] mb-3" selectable>
                                                {detail.requestSummary}
                                            </CText>
                                        </>
                                    ) : null}
                                    <CText
                                        style={{ fontFamily: "bold" }}
                                        className="text-[0.9rem] mb-2"
                                    >
                                        Response body
                                    </CText>
                                    <View className="flex-row flex-wrap gap-2 mb-3">
                                        <Pressable
                                            onPress={() =>
                                                void copyToClipboard(
                                                    "Response",
                                                    detail.responseBody
                                                )
                                            }
                                            className="px-3 py-2 rounded-full bg-purple"
                                        >
                                            <CText className="text-white text-[0.85rem]">
                                                Copy response
                                            </CText>
                                        </Pressable>
                                        <Pressable
                                            onPress={() =>
                                                void copyToClipboard("URL", detail.url)
                                            }
                                            className="px-3 py-2 rounded-full bg-white dark:bg-accent border border-grey/15"
                                        >
                                            <CText className="text-[0.85rem]">Copy URL</CText>
                                        </Pressable>
                                        {detail.requestSummary ? (
                                            <Pressable
                                                onPress={() =>
                                                    void copyToClipboard(
                                                        "Request",
                                                        detail.requestSummary ?? ""
                                                    )
                                                }
                                                className="px-3 py-2 rounded-full bg-white dark:bg-accent border border-grey/15"
                                            >
                                                <CText className="text-[0.85rem]">
                                                    Copy request
                                                </CText>
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            onPress={() =>
                                                void copyToClipboard(
                                                    "Full log",
                                                    [
                                                        `${detail.method} ${detail.status} ${detail.durationMs}ms`,
                                                        detail.url,
                                                        detail.requestSummary
                                                            ? `--- request ---\n${detail.requestSummary}`
                                                            : "",
                                                        `--- body ---\n${detail.responseBody}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join("\n\n")
                                                )
                                            }
                                            className="px-3 py-2 rounded-full bg-white dark:bg-accent border border-grey/15"
                                        >
                                            <CText className="text-[0.85rem]">Copy all</CText>
                                        </Pressable>
                                    </View>
                                    <CText
                                        className="text-[0.75rem] mb-6"
                                        style={{ fontFamily: "monospace" }}
                                        selectable
                                    >
                                        {detail.responseBody}
                                    </CText>
                                </>
                            ) : null}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
