import { KeyboardAvoidingView, Pressable, TextInput, TouchableNativeFeedback, TouchableOpacity, View } from "react-native";
import DragableSheet from "../CustomItems/DragableSheet";
import CText from "../TextComp";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Buttons from "../ButtonComp";
import { useEffect, useState } from "react";
import { addContact, updateContact } from "@/misc/helpers/db";
import AppSettings from "@/misc/store/settingsstore";
import ConfirmActionSheet from "./ConfirmationSheet";
import { cleanNumber, shortenPub } from "@/misc/helpers/miscfunctions.ts/extrafunctions";
import PhoneBook from "@/misc/store/phonebook";
import { CountryPickerModal } from "react-native-country-code-select";
import PersonalContacts from "@/misc/store/personalcontacts";

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
    if (!open) return null;


    const [importContactModal, setImportContactModal] = useState(false);
    const [importContactData, setImportContactData] = useState<any>(null);


    const [contact, setContact] = useState({
        username: '',
        phoneNumber: '',
        walletAddress: '',
    })

    const [selectedValue, setSelectedValue] = useState(
        { "callingCode": ["234"], "countryInitials": "NG", "name": "Nigeria", "region": "Africa", "subregion": "Western Africa" }
    );

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (data) {
            setContact({
                username: data.name,
                phoneNumber: cleanNumber(data.phoneNumber),
                walletAddress: data.walletAddress,
            })
        }
    }, [data])

    const saveContact = async () => {
        if (contact.username === '' || contact.phoneNumber === '' || contact.walletAddress === ''){
            setToast("Please fill in all the fields", "error")
            return
        }
        const phoneNumber = "+" + selectedValue.callingCode + cleanNumber(contact.phoneNumber)
        AppSettings.getState().setLoading(true)
        if (data) {
           
            const response = await updateContact(data.id, contact.username, phoneNumber, contact.walletAddress)
            if (response?.status) {
                setToast("Contact updated successfully", "success")
                PersonalContacts.getState().editPersonalContact(data.id, contact.username, phoneNumber, contact.walletAddress)
                setOpen(false)
                AppSettings.getState().setLoading(false)
            } else {
                setToast(response?.message, "error")
                AppSettings.getState().setLoading(false)
            }

        } else {
            const response = await addContact(contact.username, phoneNumber, contact.walletAddress)
            if (response?.status) {
                if (response.data.status === "existed") {
                    setToast("Contact already exists", "error")
                    setImportContactModal(true);
                    setImportContactData(response.data.user)
                    AppSettings.getState().setLoading(false)
                    return
                }
                setToast("Contact added successfully", "success")
                setOpen(false)
                AppSettings.getState().setLoading(false)
            } else {
                setToast(response?.message, "error")
                AppSettings.getState().setLoading(false)
            }
        }

        AppSettings.getState().setRefresher(Math.random())
    }

    return (
        <>
            <DragableSheet
                close={() => setOpen(false)}
                panClose={true}
                snapPoints={["50%", "60%"]}
                child={
                    <View className=" py-10 w-full gap-y-5 flex flex-col justify-between ">
                        <View className="w-8/12 m-auto">
                            <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">{data ? "Edit Contact" : "Add New Contact"}</CText>
                        </View>
                        <View className="bg-grey dark:bg-accent2 p-3 gap-y-3 rounded-2xl">
                            <KeyboardAvoidingView
                                behavior="height"
                            >
                                <TextInput
                                    style={{ fontFamily: "bold" }}
                                    className="py-5 text-black dark:text-white border-b border-accent"
                                    value={contact.username}
                                    // placeholderClassName="text-black dark:text-white"
                                    placeholderTextColor={isDarkMode ? "white" : "black"}
                                    onChangeText={(text) => {
                                        setContact({ ...contact, username: text })
                                    }}
                                    placeholder={`enter username`}
                                />

                                <TextInput
                                    style={{ fontFamily: "bold" }}
                                    className="py-5 text-black dark:text-white border-b border-accent"
                                    value={contact.walletAddress}
                                    placeholderTextColor={isDarkMode ? "white" : "black"}
                                    onChangeText={(text) => {
                                        setContact({ ...contact, walletAddress: text })
                                    }}
                                    placeholder={`enter wallet address`}
                                />

                                <View className="flex flex-row justify-between items-center">
                                    <TouchableOpacity onPress={() => {
                                        setIsVisible(true);
                                    }}>
                                        <CText style={{ fontFamily: 'bold' }}>+{selectedValue.callingCode}</CText>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={{ fontFamily: "bold" }}
                                        className="p-4 py-5 flex-1 text-dark dark:text-white"
                                        value={contact.phoneNumber}
                                        keyboardType="phone-pad"
                                        placeholderTextColor={isDarkMode ? "white" : "black"}
                                        onChangeText={(text) => {
                                            setContact({ ...contact, phoneNumber: text })
                                        }}
                                        placeholder={`enter mobile number`}
                                    />
                                </View>
                            </KeyboardAvoidingView>



                        </View>
                        <Buttons buttonType="pressable" onPress={saveContact} className="" text={data ? "Update" : "Save"} type="primary" />
                    </View>
                }


            />
            <ConfirmActionSheet
                title={`This contact already exists. Would you like to import it?`}
                subtitle={`${importContactData?.username} - ${importContactData?.phone_number} \n ${shortenPub(importContactData?.wallet_address)}`}
                open={importContactModal}
                close={setImportContactModal}
                actionNo={() => {
                    setImportContactModal(false);
                    setOpen(false);
                }}
                actionYes={async () => {
                    // Import contact logic here
                    PhoneBook.getState().addContact({
                        name: importContactData?.username,
                        phoneNumber: importContactData?.phone_number,
                        walletAddress: importContactData?.wallet_address,
                    })
                    setImportContactModal(false);
                    setOpen(false);
                    setToast("Contact imported successfully", "success");
                }}
            />



            <CountryPickerModal
                isVisible={isVisible}
                onClose={() => setIsVisible(false)}
                //@ts-ignore
                onSelect={(e) => setSelectedValue(e)}
            />

        </>

    )
}

export default AddContactSheet;