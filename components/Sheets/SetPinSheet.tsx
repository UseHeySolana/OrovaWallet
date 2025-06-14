import { KeyboardAvoidingView, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { OtpInput } from "react-native-otp-entry";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Buttons from "../ButtonComp";
import { useEffect, useState } from "react";
import AppSettings from "@/misc/store/settingsstore";

interface SetPinSheet {
    open: boolean
    setOpen: (open: boolean) => void
}
const SetPin = ({ open, setOpen }: SetPinSheet) => {
    const { isDarkMode } = useThemeContext();
    if (!open) return null;

    const [stage, setStage] = useState(0);
    const { setToast, } = AppSettings.getState();
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");

    useEffect(() => {
        if (pin.length == 4) {
            setStage(1)
        }
    }, [])

    const handlePinChange = () => {
        if (confirmPin == pin) {
            AppSettings.getState().setPin(pin)
            setToast("PIN set successfully", "success")
            setOpen(false)
        } else {
            setPin("")
            setConfirmPin("")
            setToast("PINs do not match", "error")
        }
    }

    return (

        <DragableSheet
            close={() => setOpen(false)}
            snapPoints={["60%"]}
            child={
                <View className=" py-4 w-full h-fit gap-y-10 flex-1 flex-col justify-between ">
                    <View className="w-8/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">
                            {stage === 0 ? "Enter PIN" : "Confirm PIN"}</CText>
                        <CText style={{ fontFamily: "md" }} textColor="text-purple" className="text-[12px] text-center">
                            {stage === 0 ? "Create a PIN to secure your account" : "Confirm your PIN to secure your account"}
                        </CText>
                    </View>

                    <View className="flex-1">
                        <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3 px-4 py-5">
                            <View className="bg-white dark:bg-accent2 h-fit py-3 px-2 rounded-2xl" >
                                <OtpInput
                                    focusColor={'purple'}
                                    textProps={{
                                        style: {
                                            fontFamily: "bold",
                                            color: isDarkMode ? 'white' : 'black'
                                        },
                                    }}
                                    blurOnFilled={true}
                                    numberOfDigits={4} onFilled={(text) =>
                                        stage === 0 ? setPin(text) : setConfirmPin(text)} />
                            </View>
                        </KeyboardAvoidingView>
                    </View>

                    <Buttons buttonType="pressable" onPress={() => {
                        if (stage === 0) {
                            setStage(1);
                        } else {
                            handlePinChange()
                        }
                    }} className="" text={stage === 0 ? "Next" : "Saved"} type="primary" />
                </View>
            }
        />

    )

}

export default SetPin;