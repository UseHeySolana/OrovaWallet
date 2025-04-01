import { useEffect, useRef, useState } from "react";
import OTPTextInput from 'react-native-otp-textinput';
import { Alert, KeyboardAvoidingView, Pressable, StyleSheet, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import UserItem from "@/misc/store/userstore";
import { useAi } from "@/misc/context/AiContext";
import { TextInput } from "react-native";
import Buttons from "@/components/ButtonComp";
import { addDataToFirestore, fetchData, handleSearch, MessageData } from "@/misc/helpers/db";
import OTPTextView from "react-native-otp-textinput";
import WalletItem from "@/misc/store/wallet";
import { UserType } from "@/misc/types/usertypes";
 /**
   * What should be done here
   * 1. Register User Voice for Authentication 
   * 2. Save User Voice and ask if to create wallet with their voice
   */
function Voicereg() {
  const [recording, setRecording] = useState(false);
  const [showOtp, setShowOtp] = useState(true)
  let otpInput = useRef<OTPTextView>(null)
  const { sessionManager, isSessionActive, startSession, stopSession } = useAi()
  const { setDefault } = AppSettings()
  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);
 const [users, setUsers] = useState<MessageData[]>([]);
  const [userDetails,setUserDetails] = useState({
    username: "",
    mobileNumber: "",
    addPin: "",
  })
  const { setUser } = UserItem();
  const {keypair, updateKeypair, publicKey} = WalletItem()
  const { setLoading, isLoading } = AppSettings()
  const [currentState, setCurrentState] = useState<'verify-phrase' | "start-wallet" | "sign-up" | "set-pin" | "">('')
  const [startWalletCreation, setStartWalletCreation] = useState(false);
  const [verifyPhrase, setVerifyPhrase] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [verifiedWords, setVerifiedWords] = useState<{ position: number, word: string }[]>([]);
  const [walletSigning, setWalletSigning] = useState(false)

  useEffect(() => {
    (async () => {
      const data = await fetchData();
      setUsers(data);
    })()
  }, [])


  const sendMessage = () => {
    console.log('pressed')
    sessionManager?.sendTextMessage("Repeat this text with enthusiasm becuase you are onboarding a new user, {Let's register your voice! say the big text you see on your screen.}")
  }


  const saveUserToDB = async () => {
    if (userDetails.username == "" || userDetails.mobileNumber == "") {
      Alert.alert("Error", "Field Required")
      return
    }

    setLoading(true)

    const name = handleSearch(userDetails.username, users)
    const number = handleSearch(userDetails.mobileNumber, users)
    if (name.length > 0 || number.length > 0) {
      name.length ? Alert.alert("UserName already Exists", "error")
        : Alert.alert("Mobile Number already Exists", "error");
      setLoading(false)
    } else {

      // setCurrentState('set-pin');
      setLoading(false)
    }


  }



    const saveUser = async () => {
      //save to DB
      setLoading(true)
      if (userDetails.addPin == "") {
        Alert.alert('error', 'Pin cannot be empty 😔')
        setLoading(false)
        return;
      }
  
      if (!publicKey) {
        setLoading(false)
        // setCurrentState('start-wallet')
        return
      };
  
      setLoading(false)
  
  
      // let status = false
      let walletAddress = keypair?.publicKey.toBase58() || ""
  
      const status = await addDataToFirestore(userDetails.username, userDetails.mobileNumber,walletAddress , userDetails.addPin)
      if (status) {
        const user: UserType = {
          username: userDetails.username,
          mobileNumber: userDetails.mobileNumber,
          walletAddress: keypair?.publicKey.toBase58() || "",
          pin: userDetails.addPin,
        }
        setUser(user);
        Alert.alert("Welcome to Hey Solana, Your Wallet has been created!")
        router.replace('/dashboard')
        setLoading(false)
      } else {
        Alert.alert("An unknown error occured");
        // location.reload()
        setLoading(false)
      }
    }
  return (
    <View
      className="relative h-full w-100 flex items-center"
    >
      <View className=" py-5 w-full px-4 gap-y-10 flex flex-col justify-between ">
        <View className="w-8/12 m-auto">
          <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Let's get you started</CText>
          <CText className="text-[16px] text-center">Your username will be unique and can be used to make transactions.</CText>
        </View>

        <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3">
          <View className="bg-white h-fit py-3 rounded-2xl" >
            <TextInput
              style={{ fontFamily: "bold" }}
              className=" p-4 py-5"

              onChangeText={(text) => {
                setUserDetails({ ...userDetails, username: text })
              }}
              placeholder={`enter a username`}
            />
            <View className="border-b border-gray-200" />
            <TextInput
              style={{ fontFamily: "bold" }}
              className="p-4 py-5"
              onChangeText={(text) => {
                setUserDetails({ ...userDetails, mobileNumber: text })
              }}
              placeholder={`enter a phone number`}
            />
          </View>
        </KeyboardAvoidingView>

        <Buttons buttonType="pressable" onPress={() =>saveUserToDB()} className="" text="Sign up" type="primary" />
      </View>

  {currentState === 'set-pin' && (
        <DragableSheet
          snapPoints={["40%"]}
          close={() => setWalletSigning(false)}
          child={
            <View className=" py-1 w-full gap-y-10 flex flex-col justify-between ">
              <View className="w-8/12 m-auto">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Create Your Pin</CText>
              </View>

              <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3 px-4 py-5">
                <View className="bg-white h-fit py-3 rounded-2xl" >
                  <OTPTextInput
                    tintColor={"#e5e7eb"}
                    containerStyle={{
                      padding: 5,
                    }}
                    textInputStyle={{
                    }}
                    handleTextChange={(text) => { setUserDetails({ ...userDetails, addPin: text }) }}
                    ref={otpInput} />
                </View>
              </KeyboardAvoidingView>

              <Buttons buttonType="pressable" onPress={() => saveUser()} className="" text="Done" type="primary" />
            </View>
          }
        />
      )}


      {
        startWalletReg && (
          <DragableSheet
            close={() => setStartWalletReg(false)}
            snapPoints={["55%"]}
            child={
              <View className="w-full  gap-y-5 flex flex-col justify-between ">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Wallet</CText>
                <View className="flex w-100 justify-center items-center py-">
                  <Image style={{ height: 185, width: 300 }} source={require('@/assets/items/wallet.png')} alt="Wallet" contentFit="contain" />
                </View>

                <Pressable onPress={() => {
                  router.push('/secretphrase')
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



    </View>
  );
}

export default Voicereg

