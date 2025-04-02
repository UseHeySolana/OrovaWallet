import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { addDataToFirestore, fetchData, getCode, handleSearch, MessageData, registerUser, verifyCode } from "@/misc/helpers/db";
import { OtpInput } from "react-native-otp-entry";
import WalletItem from "@/misc/store/wallet";
import { UserType } from "@/misc/types/usertypes";
import { CountryPickerModal } from 'react-native-country-code-select';
import { TouchableOpacity } from "react-native";
/**
  * What should be done here
 Login Page
  */
function Login() {

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
        ...userDetails,
        mobileNumber: user.mobileNumber
      })
      setCurrentState('start-wallet')
    }
  }, [user])

  const Login = async () => {
    const fields = [];
    if (userDetails.mobileNumber === "") {
      fields.push("Mobile Number");
    }
    if (fields.length > 0) {
      setToast(`${fields.join(',')} required`, 'error')
      return
    }
    setLoading(true)
    const data = {
      phone_number: "+" + selectedValue.callingCode + userDetails.mobileNumber
    }
    const response = await getCode(data.phone_number)
    if (response.status !== false) {
      setUserDetails({ ...userDetails, username: response.data.username })
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

      if (publicKey) {
        router.replace('/dashboard')
      }
      setCurrentState('start-wallet')
      setLoading(false)
    } else {
      setToast(response.message, 'error')
      setLoading(false)
    }
  }

  return (
    <View
      className="relative h-full w-100 flex justify-center items-center"
    >
      <View className=" py-5 w-full  px-4 gap-y-5 flex-col justify-start ">
        <View className="w-full flex justify-center items-center">
          <View className="h-[50px] w-[50px]  rounded-full">
            <Image source={require('@/assets/images/icon.png')} style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
        </View>
        <View className="w-8/12 m-auto">
          <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Welcome back!</CText>
          <CText className="text-[16px] text-center">Let's make handsfreee transactions</CText>
        </View>

        <KeyboardAvoidingView className="bg-grey  rounded-3xl gap-y-3">
          <View className="bg-white h-fit py-3 rounded-2xl" >
            {/* <TextInput
              style={{ fontFamily: "bold" }}
              className=" p-4 py-5"
              value={userDetails.username}
              onChangeText={(text) => {
                setUserDetails({ ...userDetails, username: text })
              }}
              placeholder={`enter a username`}
            />
            <View className="border-b border-gray-200" /> */}
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

          <Buttons buttonType="pressable" onPress={() => Login()} className="" text={isLoading ? "loading" : "Login"} type="primary" />
          <View className="py-2 flex flex-row justify-center items-center gap-x-2">
            <CText className="text-center">Don't have an Account?</CText>
            <TouchableOpacity
              onPress={() => router.replace('/auth/username')}
            ><CText style={{ fontFamily: 'bold' }} className="text-purple">Sign up</CText></TouchableOpacity>
          </View>


        </View>
      </View >




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

export default Login

