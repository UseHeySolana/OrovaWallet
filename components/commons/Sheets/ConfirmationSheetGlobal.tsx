import { Pressable, View } from "react-native";
import DragableSheet from "../commons/CustomItems/DragableSheet";
import CText from "../TextComp";
import Buttons from "../ButtonComp";
import IconLibrary from "@/misc/helpers/icons";
import React, { useEffect, useState } from "react";
import { ConfirmationOptions, setConfirmFn } from "@/misc/helpers/service/confirmation";
import AppSettings from "@/misc/store/settingsstore";
import * as LocalAuthentication from 'expo-local-authentication';



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
        if (type === 'fingerprint' && response) {
            const res = await LocalAuthentication.hasHardwareAsync()
            if (AppSettings.getState().openWithAuth && res) {
                try {
                    const result = await LocalAuthentication.authenticateAsync({
                        promptMessage: message,
                    });
                    if (!result.success) {
                        setVisible(false);
                        resolver?.(false);
                        resolver = null;
                        return;
                    }else{
                        setVisible(false);
                        resolver?.(true);
                        resolver = null;
                        return;
                    }
                } catch (error) {
                    setVisible(false);
                    resolver?.(false);
                    resolver = null;
                    return;
                }
            }
        } else {
            setVisible(false);
            resolver?.(response);
            resolver = null;
        }
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