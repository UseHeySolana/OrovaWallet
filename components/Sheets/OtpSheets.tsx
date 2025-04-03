import { KeyboardAvoidingView, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { OtpInput } from "react-native-otp-entry";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Buttons from "../ButtonComp";

interface OTPSheet {
    open: boolean
    verifyOtp: () => void;
    setOtpValue: (text: string) => void;
}
const Otpsheet = ({ open, verifyOtp, setOtpValue, }: OTPSheet) => {
    const { isDarkMode } = useThemeContext();
    if (!open) return null;
    return (

        <DragableSheet
            snapPoints={["50%"]}
            child={
                <View className=" py-4 w-full gap-y-10 flex-1 flex-col justify-between ">
                    <View className="w-8/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Enter Verification Code</CText>
                        <CText style={{ fontFamily: "md" }} textColor="text-purple" className="text-[12px] text-center">Your one time password has been sent to your whatsapp number</CText>
                    </View>
                    <View className="flex-1 ">

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

                                    numberOfDigits={6} onFilled={(text) => setOtpValue(text)} />
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                    <Buttons buttonType="pressable" onPress={() => verifyOtp()} className="" text="Verify" type="primary" />
                </View>
            }
        />

    )
}

export default Otpsheet;