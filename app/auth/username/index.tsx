import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from "@expo/vector-icons/AntDesign";
import AppSettings from "@/utils/store/settingsstore.store";
import { router } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { registerUser, verifyCode } from "@/utils/request/db";
import { OtpInput } from "react-native-otp-entry";
import WalletItem from "@/utils/store/wallet.store";
import { CountryPickerModal } from "react-native-country-code-select";
import { useThemeContext } from "@/context/ThemeContext";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import { cleanNumber } from "@/utils/functions/extrafunctions";
import { delay } from "@/utils/functions";
import { useKeyboard } from "@/context/KeyboardContext";
/**
  * What should be done here
  * 1. Register User Voice for Authentication 
  * 2. Save User Voice and ask if to create wallet with their voice
  */
function Voicereg() {
  const { isKeyboardVisible } = useKeyboard()

  const [userDetails, setUserDetails] = useState({
    username: "",
    mobileNumber: "",
  })

  const [otpValue, setOtpValue] = useState('')
  const { setUser, user } = UserItem();
  const { keypair, updateKeypair, publicKey } = WalletItem()
  const { setLoading, isLoading, setToast } = AppSettings()
  const [currentState, setCurrentState] = useState<'verify-phrase' | "start-wallet" | "sign-up" | "set-pin" | "">('')

  const [selectedValue, setSelectedValue] = useState(
    { "callingCode": ["234"], "countryInitials": "NG", "name": "Nigeria", "region": "Africa", "subregion": "Western Africa" }
  );

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (user) {
      setUserDetails({
        username: user.username,
        mobileNumber: user.mobileNumber
      })
      setCurrentState('start-wallet')
    }
  }, [user])



  const saveUserToDB = async () => {
    const fields = [];
    if (userDetails.username === "") {
      fields.push("Username");
    }
    if (userDetails.mobileNumber === "") {
      fields.push("Mobile Number");
    }
    if (fields.length > 0) {
      setToast(`${fields.join(',')} required`, 'error')
      return
    }
    setLoading(true)
    delay(1000)

    const data = {
      username: userDetails.username,
      phone_number: "+" + selectedValue.callingCode + cleanNumber(userDetails.mobileNumber)
    }
    const response = await registerUser(data.username, data.phone_number)
    if (response.status !== false) {
      setCurrentState('set-pin')
      setLoading(false)
    } else {
      setToast(response.message, 'error')
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast('Invalid Otp', 'error')
      return;
    }
    setLoading(true)
    const response = await verifyCode(otpValue, userDetails.username)
    if (response.status !== false) {
      setToast("Verification Successfull", 'success')
      setUser({
        username: userDetails.username,
        mobileNumber: userDetails.mobileNumber,
        pin: "",
      })
      setCurrentState('start-wallet')
      setLoading(false)
    } else {
      setToast(response.message, 'error')
      setLoading(false)
    }
  }
  const { isDarkMode } = useThemeContext()


  return (
    <View
      className="bg-grey dark:bg-dark  h-full w-100 flex-1 items-center"
    >
      <View className=" py-5 w-full  px-4 gap-y-10 flex flex-col justify-start ">
        <View className="w-10/12 m-auto">
          <CText style={{ fontFamily: "bold" }} className="text-[1.25em] text-center">Let's get you started</CText>
          <CText className="text-[1rem] text-center">Your username will be unique and can be used to make transactions.</CText>
        </View>

        <KeyboardAvoidingView className="bg-grey dark:bg-accent rounded-3xl gap-y-3">
          <View className="bg-white dark:bg-accent h-fit py-3 rounded-2xl" >
            <TextInput
              className=" p-4 py-5 text-dark dark:text-white"
              value={userDetails.username}
              placeholderTextColor={isDarkMode ? "white" : "black"}
              onChangeText={(text) => {
                setUserDetails({ ...userDetails, username: text })
              }}
              placeholder={`enter a username`}
            />
            <View className="border-b border-gray-200" />
            <View className="flex flex-row px-4 justify-between items-center">
              <TouchableOpacity onPress={() => {
                setIsVisible(true);
              }}>
                <CText style={{ fontFamily: 'bold' }}>+{selectedValue.callingCode}</CText>
              </TouchableOpacity>
              <TextInput
                className="p-4 py-5 flex-1 text-dark dark:text-white"
                value={userDetails.mobileNumber}
                placeholderTextColor={isDarkMode ? "white" : "black"}
                onChangeText={(text) => {
                  setUserDetails({ ...userDetails, mobileNumber: text })
                }}
                placeholder={`enter your phone number`}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
        <View>

          <Buttons buttonType="pressable" onPress={() => saveUserToDB()} className="" text={isLoading ? "loading" : "Sign up"} type="primary" />
          <View className="px-4 my-3">
            <CText className="text-[1rem] text-center">
              I have read, understood and agreed to the <CText style={{ fontFamily: 'bold' }} textColor="text-purple">Terms&Conditions </CText>and
              <CText style={{ fontFamily: 'bold' }} textColor="text-purple"> Privacy Policy</CText>

            </CText>
          </View>


        </View>


      </View >
      {!isKeyboardVisible &&
        <View className="absolute bottom-10 flex w-full flex-row justify-center items-center gap-x-2">
          <CText className="text-[1.125em] flex items-center flex-row">Already have an Account?</CText>
          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
          >
            <CText style={{ fontFamily: 'bold' }} textColor="text-purple" className="text-[1.125em]">Log in</CText></TouchableOpacity>
        </View>
      }


      <CountryPickerModal
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        //@ts-ignore
        onSelect={(e) => setSelectedValue(e)}
      />

      <Otpsheet
        open={currentState === 'set-pin'}
        verifyOtp={verifyOtp}
        setOtpValue={(text) => setOtpValue(text)}
      />

      <WalletSheet open={currentState === 'start-wallet'} />


    </View >
  );
}

export default Voicereg

