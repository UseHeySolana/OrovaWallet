import { Pressable, View } from "react-native";
import DragableSheet from "../commons/CustomItems/DragableSheet";
import CText from "../TextComp";
import Buttons from "../ButtonComp";
import IconLibrary from "@/misc/helpers/icons";

interface ConfirmationSheetTypes {
    open: boolean;
    close: (open: boolean) => void;
    actionYes: () => void;
    actionNo: () => void;
    title: any;
    subtitle?: string;
}
const ConfirmActionSheet = ({
    open,
    close,
    actionYes,
    actionNo,
    title,
    subtitle,
}: ConfirmationSheetTypes) => {
    if (!open) return null;

    return (
        <DragableSheet
            close={() => close(false)}
            panClose={true}
            snapPoints={["40%", "50%"]}
            child={
                <View className=" py-5 w-full gap-y-5 flex flex-col justify-end ">
                    <View className="w-10/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">{title}</CText>
                    </View>

                    {subtitle && (
                        <CText style={{ fontFamily: "regular" }} className="text-[16px] text-center">{subtitle}</CText>
                    )}

                    <Buttons buttonType="pressable" onPress={actionNo} className="" text="No" type="secondary" />
                    <Buttons buttonType="pressable" onPress={actionYes} className="" text="Yes" type="primary" />

                </View>
            }
        />
    )
}

export default ConfirmActionSheet;