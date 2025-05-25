import { KeyboardAvoidingView, Pressable, TextInput, TouchableNativeFeedback, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Buttons from "../ButtonComp";
import { useEffect, useState } from "react";
import AppSettings from "@/misc/store/settingsstore";
import IconLibrary from "@/misc/helpers/icons";

interface AddContactSheetTypes {
    open: boolean;
    setOpen: (open: boolean) => void;
    setToast: (message: string, type: 'error' | 'success' | 'info') => void;
    data: any;
}
const AddContactSheet = ({
    open,
    setOpen,
    setToast,
    data,
}: AddContactSheetTypes) => {
    const { isDarkMode } = useThemeContext();
    console.log(isDarkMode)
    if (!open) return null;


    const [contact, setContact] = useState({
        username: '',
        phoneNumber: '',
        walletAddress: '',
    })

    useEffect(() => {
        if (data) {
            setContact({
                username: data.name,
                phoneNumber: data.phoneNumber,
                walletAddress: data.walletAddress,
            })
        }
    }, [data])

    const saveContact = async () => {
        console.log("saveContact")

        if (contact.username === '' || contact.phoneNumber === '' || contact.walletAddress === '') {
            setToast("Please fill in all the fields", "error")
            return
        }


    }

    return (
        <DragableSheet
            // close={() => setVerifyPhrase(false)}
            snapPoints={["50%", "60%"]}
            child={
                <View className=" py-10 w-full gap-y-5 flex flex-col justify-between ">
                    <View className="w-full flex flex-row  justify-end absolute top-0 right-0">
                        <Pressable onPress={() => setOpen(false)} className="p-3 rounded-full bg-white dark:bg-accent">
                            <IconLibrary.cancel />
                        </Pressable>
                    </View>
                    <View className="w-8/12 m-auto">
                        <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Add New Contact</CText>
                    </View>
                        <View className="bg-grey dark:bg-accent2 p-3 gap-y-3 rounded-2xl">
                            <KeyboardAvoidingView
                                behavior="height"
                            >
                                <TextInput
                                    style={{ fontFamily: "bold" }}
                                    className="py-5"
                                    value={contact.username}
                                    // placeholderClassName="text-black dark:text-white"
                                    placeholderTextColor={isDarkMode ? "white" : "black"}
                                    onChangeText={(text) => {
                                        setContact({...contact, username: text})
                                    }}
                                    placeholder={`enter username`}
                                />

                                <TextInput
                                    style={{ fontFamily: "bold" }}
                                    className="py-5"
                                    value={contact.walletAddress}
                                    placeholderTextColor={isDarkMode ? "white" : "black"}
                                    onChangeText={(text) => {
                                        setContact({...contact, walletAddress: text})
                                    }}
                                    placeholder={`enter wallet address`}
                                />

                                <TextInput
                                    style={{ fontFamily: "bold" }}
                                    className="py-5"
                                    value={contact.phoneNumber}
                                    placeholderTextColor={isDarkMode ? "white" : "black"}
                                    onChangeText={(text) => {   
                                        setContact({...contact, phoneNumber: text})
                                    }}
                                    placeholder={`enter mobile number`}
                                />
                            </KeyboardAvoidingView>



                        </View>
                    <Buttons buttonType="pressable" onPress={saveContact} className="" text="Save" type="primary" />
                </View>
            }
        />
    )
}

export default AddContactSheet;