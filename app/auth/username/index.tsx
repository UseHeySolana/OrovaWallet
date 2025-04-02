import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { addDataToFirestore, fetchData, handleSearch, MessageData, registerUser, verifyCode } from "@/misc/helpers/db";
import { OtpInput } from "react-native-otp-entry";
import WalletItem from "@/misc/store/wallet";
import { UserType } from "@/misc/types/usertypes";
import { CountryPickerModal } from 'react-native-country-code-select';
/**
  * What should be done here
  * 1. Register User Voice for Authentication 
  * 2. Save User Voice and ask if to create wallet with their voice
  */
function Voicereg() {

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
    const data = {
      username: userDetails.username,
      phone_number: "+" + selectedValue.callingCode + userDetails.mobileNumber
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

  return (
    <View
      className="relative h-full w-100 flex items-center"
    >
      <View className=" py-5 w-full px-4 gap-y-10 flex flex-col justify-start ">
        <View className="w-8/12 m-auto">
          <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Let's get you started</CText>
          <CText className="text-[16px] text-center">Your username will be unique and can be used to make transactions.</CText>
        </View>

        <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3">
          <View className="bg-white h-fit py-3 rounded-2xl" >
            <TextInput
              style={{ fontFamily: "bold" }}
              className=" p-4 py-5"
              value={userDetails.username}
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
                style={{ fontFamily: "bold" }}
                className="p-4 py-5 flex-1"
                value={userDetails.mobileNumber}
                onChangeText={(text) => {
                  setUserDetails({ ...userDetails, mobileNumber: text })
                }}
                placeholder={`enter a phone number`}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
        <View>

          <Buttons buttonType="pressable" onPress={() => saveUserToDB()} className="" text={isLoading ? "loading" : "Sign up"} type="primary" />
          <View className="px-4 my-3">
            <CText className="text-[16px] text-center">
              I have read, understood and agreed to the <CText style={{ fontFamily: 'bold' }} className="text-purple">Terms&Conditions </CText>and
              <CText style={{ fontFamily: 'bold' }} className="text-purple"> Privacy Policy</CText>

            </CText>
          </View>


        </View>
      </View >

      <View className="absolute bottom-10 flex flex-row justify-center items-center gap-x-2">
        <CText className="text-[18px] flex items-center flex-row">Already have an Account?</CText>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
        >
          <CText style={{ fontFamily: 'bold' }} className="text-purple text-[18px]">Log in</CText></TouchableOpacity>
      </View>


      <CountryPickerModal
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
        //@ts-ignore
        onSelect={(e) => setSelectedValue(e)}
      />


      {
        currentState === 'set-pin' && (
          <DragableSheet
            snapPoints={["50%"]}
            child={
              <View className=" py-4 w-full gap-y-10 flex-1 flex-col justify-between ">
                <View className="w-8/12 m-auto">
                  <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Enter Verification Code</CText>
                  <CText style={{ fontFamily: "md" }} className="text-[12px] text-purple text-center">Your one time password has been sent to your whatsapp number</CText>
                </View>
                <View className="flex-1 ">

                  <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3 px-4 py-5">
                    <View className="bg-white h-fit py-3 px-2 rounded-2xl" >
                      <OtpInput
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


      {
        currentState == 'start-wallet' && (
          <DragableSheet
            snapPoints={["55%"]}
            child={
              <View className="w-full  gap-y-5 flex flex-col justify-between ">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Wallet</CText>
                <View className="flex w-100 justify-center items-center py-">
                  <Image style={{ height: 185, width: 300 }} source={require('@/assets/items/wallet.png')} alt="Wallet" contentFit="contain" />
                </View>

                <Pressable onPress={() => {
                  router.push('/auth/secretphrase')
                }} >
                  <View className="flex flex-row justify-start items-center px-5  bg-grey py-5 rounded-full   gap-x-3">
                    <View className="">
                      <AntDesign name="pluscircleo" size={24} color="black" />
                    </View>

                    <View className="">
                      <CText style={{ fontFamily: "bold" }} className="text-primary text-[16px] font-dmBold text-start">Create new Wallet</CText>
                      <CText className="text-primary text-[14px]  text-start">Create a new Solana Wallet</CText>

                    </View>
                  </View>

                </Pressable>
                <Pressable onPress={() => router.replace('/importphrase')} >
                  <View className="flex flex-row justify-start items-center px-5  bg-grey py-5 rounded-full   gap-x-3">
                    <View className="bg-white rounded-full p-1">
                      <AntDesign name="arrowdown" size={24} color="black" />
                    </View>

                    <View className="">
                      <CText style={{ fontFamily: "bold" }} className="text-primary text-[16px] font-dmBold text-start">Import existing wallet</CText>
                      <CText className="text-primary text-[14px]  text-start">Import a previously existing wallet</CText>

                    </View>
                  </View>

                </Pressable>
              </View>
            }
          />
        )
      }



    </View >
  );
}

export default Voicereg

