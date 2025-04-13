import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { getCode, verifyCode } from "@/misc/helpers/db";
import WalletItem from "@/misc/store/wallet";
import { CountryPickerModal } from 'react-native-country-code-select';
import { TouchableOpacity } from "react-native";
import { useThemeContext } from "@/misc/context/ThemeContext";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import { cleanNumber } from "@/misc/helpers/extrafunctions";
import { delay } from "@/misc/helpers/functions";
import { BiometricAuth } from "@/app/requests/dashboard";

/**
  * What should be done here
 Login Page
  */
function Login() {

  const [userDetails, setUserDetails] = useState({
    username: "",
    mobileNumber: "",
    wallet_address: "",
  })

  const [otpValue, setOtpValue] = useState('')
  const { setUser, user, session } = UserItem();
  const { keypair, updateKeypair, publicKey } = WalletItem()
  const { setLoading, isLoading, setToast, openWithAuth } = AppSettings()
  const [currentState, setCurrentState] = useState<'verify-phrase' | "start-wallet" | "sign-up" | "set-pin" | "">('')

  const [selectedValue, setSelectedValue] = useState(
    { "callingCode": ["234"], "countryInitials": "NG", "name": "Nigeria", "region": "Africa", "subregion": "Western Africa" }
  );

  const [fingerPrintSigning, setFingerPrintSigning] = useState(false)
  const [isVisible, setIsVisible] = useState(false);
  const { isDarkMode } = useThemeContext()


  useEffect(() => {
    (async () => {
      if (user && !session) {
        setUserDetails({
          ...userDetails,
          mobileNumber: user.mobileNumber
        })

        if (openWithAuth) {
          setFingerPrintSigning(true)
          // setTimeout(() => {
          //   BiometricAuth()
          // }, 1000)
        } else {
          setCurrentState('start-wallet')
        }
      }
    })()

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
    delay(1000)
    const data = {
      phone_number: "+" + selectedValue.callingCode + cleanNumber(userDetails.mobileNumber)
    }
    const response = await getCode(data.phone_number)
    if (response.status !== false) {

      setUserDetails({ ...userDetails, username: response.data.username, wallet_address: response.data.wallet_address })
      setCurrentState('set-pin')
      setLoading(false)
    } else {
      setToast(response.message, 'error')
      setLoading(false)
    }
  }

  console.log(userDetails);

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast('Invalid Otp', 'error')
      return;
    }
    setLoading(true)
    const response = await verifyCode(otpValue, userDetails.username)
    if (response.status !== false) {
      setToast("Verification Successfull", 'success')

      //check if the publick key stored is the same as the address coming, route to dashboard
      if (publicKey !== null && (publicKey.toString() === userDetails.wallet_address)) {
        setUser({
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          pin: "",
        })
        router.replace('/dashboard')
        return;
      } else {
        setUser({
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          pin: "",
        })
        setCurrentState('start-wallet')
        setLoading(false)
        return;
      }

      // if (publicKey && userDetails.wallet_address !== null) {
      //   setUser({
      //     username: userDetails.username,
      //     mobileNumber: userDetails.mobileNumber,
      //     pin: "",
      //   })
      //   router.replace('/dashboard')
      //   return;
      // }


    } else {
      setToast(response.message, 'error')
      setLoading(false)
    }
  }

  return (
    <View
      className="relative bg-grey dark:bg-dark h-full w-100 flex justify-center items-center"
    >
      <View className=" py-5 w-full px-4 gap-y-10 flex-col justify-center ">
        <View className="flex flex-col justify-center items-center gap-y-2">

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
        </View>

        {!fingerPrintSigning ?
          <>
            <KeyboardAvoidingView className="bg-grey dark:bg-accent  rounded-3xl gap-y-3">
              <View className="bg-white  dark:bg-accent h-fit py-3 rounded-2xl" >
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
                    className="p-4 py-5 flex-1 text-dark dark:text-white"
                    value={userDetails.mobileNumber}
                    keyboardType="phone-pad"
                    placeholderTextColor={isDarkMode ? "white" : "black"}
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
                ><CText style={{ fontFamily: 'bold' }} textColor="text-purple">Sign up</CText></TouchableOpacity>
              </View>


            </View>
          </>
          :
          <View className="w-full flex justify-center gap-y-10 items-center">
            <TouchableOpacity onPress={BiometricAuth} className="h-[50px] w-[50px]  rounded-full overflow-hidden">
              <Image source={require('@/assets/images/biometric.png')} style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </TouchableOpacity>
            <View className="">
              <CText style={{ fontFamily: "bold" }} className="text-[16px] text-center">Tap to login with your biometrics</CText>
              <TouchableOpacity onPress={() => setFingerPrintSigning(false)}>
                <CText textColor="text-purple" className="text-[16px] text-center">or login with mobile number</CText>
              </TouchableOpacity>
            </View>
          </View>

        }
      </View >




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

export default Login

