import { Pressable, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import Buttons from "../ButtonComp";
import IconLibrary from "@/utils/icons";
import React, { useEffect, useState } from "react";
import AppSettings from "@/utils/store/settingsstore.store";
import * as LocalAuthentication from 'expo-local-authentication';
import { ConfirmationOptions, setConfirmFn } from "@/services/confirmation";



let resolver: ((value: boolean) => void) | null = null;
const ConfirmActionSheetGlobal = () => {

    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [type, setType] = useState<string | undefined | null>("");
    const [subtitle, setSubtitle] = useState<string | undefined>("");

    const askConfirmation = ({ message, subtitle, type }: ConfirmationOptions): Promise<boolean> => {
        setMessage(message);
        setSubtitle(subtitle);
        setType(type);
        setVisible(true);
        return new Promise<boolean>((resolve) => {
            resolver = resolve;
        });
    };

    const handleResponse = async (response: boolean) => {
        if (!response) {
            setVisible(false);
            resolver?.(false);
            resolver = null;
            return;
        }

        if (type === "fingerprint") {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (AppSettings.getState().openWithAuth && hasHardware) {
                try {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: message,
                    });
                    setVisible(false);
                    resolver?.(result.success);
                    resolver = null;
                    return;
                } catch {
                    setVisible(false);
                    resolver?.(false);
                    resolver = null;
                    return;
                }
            }
        }

        setVisible(false);
        resolver?.(true);
        resolver = null;
    };

    useEffect(() => {
        setConfirmFn(askConfirmation);
    }, []);

    return (
        visible &&
        <DragableSheet
            close={() => setVisible(false)}
            panClose={true}
            snapPoints={["50%", "70%"]}
            child={
                <View className=" py-5 w-full gap-y-5 flex flex-col justify-end ">
                    <View className="w-10/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">{message}</CText>
                    </View>

                    {subtitle && (
                        <CText style={{ fontFamily: "regular" }} className="text-[16px] text-center">{subtitle}</CText>
                    )}

                    <Buttons buttonType="pressable" onPress={() => handleResponse(false)} className="" text="No" type="secondary" />
                    <Buttons buttonType="pressable" onPress={() => handleResponse(true)} className="" text="Yes" type="primary" />

                </View>
            }
        />
    )
}

export default ConfirmActionSheetGlobal;