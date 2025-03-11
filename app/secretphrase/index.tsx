import { useEffect, useRef, useState } from "react";
import OTPTextInput from 'react-native-otp-textinput';
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import Buttons from "@/components/ButtonComp";
import { generateMnemonic, getKeypairFromMnemonic } from "@/misc/helpers/wallet";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Clipboard from 'expo-clipboard';
import AppSettings from "@/misc/store/settingsstore";
// import { Connection, Keypair } from "@solana/web3.js";
import WalletItem from "@/misc/store/wallet";
import { addDataToFirestore, fetchData, handleSearch, MessageData } from "@/misc/helpers/db";
import OTPTextView from "react-native-otp-textinput";
import { UserType } from "@/misc/types/usertypes";
import UserItem from "@/misc/store/userstore";
import { Keypair } from "@solana/web3.js";
import { router } from "expo-router";


const actions = [
  "Hey Solana does not keep a copy of your secret phrase.",
  "Saving it digitally in text is NOT advisable. Examples include screenshots, text files or emailing yourself.",
  "Write down your secret phrase and store in a secure offline location"
]

const positionVal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seven', 'eight', 'ninth', 'tenth', 'eleventh', 'twelveth'];


/**
  * What should be done here
  * 1. Notify what the secret phrase is for.
  * 2. Generate Secre Phrase
  * 3. Verify that they have saved phrase
  */
function getThreeRandomStrings(array: string[]) {
  // Make a copy to avoid modifying the original array
  const shuffled = [...array];

  // Shuffle array using Fisher-Yates algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return first three elements
  return shuffled.slice(0, 3).map((i, index) => {
    return {
      position: array.indexOf(i) + 1,
      word: i
    }
  });

}
export default function SecretPhrase({ navigation }: any) {
  const [currentState, setCurrentState] = useState<'verify-phrase' | "start-wallet" | "sign-up" | "set-pin" | "">('')
  const [startWalletCreation, setStartWalletCreation] = useState(false);
  const [verifyPhrase, setVerifyPhrase] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [verifiedWords, setVerifiedWords] = useState<{ position: number, word: string }[]>([]);
  const [walletSigning, setWalletSigning] = useState(false)
  const [userWords, setUserWords] = useState(
    [
      {
        position: 0,
        word: "",
      },
      {
        position: 0,
        word: "",
      },
      {
        position: 0,
        word: "",
      }
    ]
  )
  const [users, setUsers] = useState<MessageData[]>([]);
  const [showOtp, setShowOtp] = useState(true)
  let otpInput = useRef<OTPTextView>(null)
  const [userDetails, setUserDetails] = useState({
    username: "maskyray2",
    mobileNumber: "08132532431",
    walletAddress: "",
    addPin: "",
  })

  const { keypair, updateKeypair, publicKey } = WalletItem()
  const { setUser } = UserItem();
  const { setLoading, isLoading } = AppSettings()

  useEffect(() => {
    (async () => {
      const data = await fetchData();
      setUsers(data);
    })()
  }, [])

  const generateKeyPhrase = async () => {
    setLoading(true)
    const phrase = await generateMnemonic();
    if (phrase) {

      setMnemonic(phrase);
      setStartWalletCreation(true)
      setLoading(false)

    } else {
      setLoading(false)
    }
  }

  const copyKeyPhrase = async () => {
    setLoading(true)
    await Clipboard.setStringAsync(mnemonic);
    setVerifiedWords(getThreeRandomStrings(mnemonic.split(' ') as string[]))
    setTimeout(() => {
      setCurrentState("verify-phrase");
    }, 500);
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }
  const validatePhrase = async () => {

    // if (userWords.some(word => !word.word.trim())) {
    //   Alert.alert("Error", "Please fill in all the words");
    //   return;
    // }
    setLoading(true)
    // Check if each entered word matches the corresponding verified word
    // const isCorrect = userWords.every((userWord, index) => {
    //   const verifiedWord = verifiedWords[index];
    //   // Compare the words case-insensitively
    //   return userWord.word.toLowerCase().trim() === verifiedWord.word.toLowerCase();
    // });

   

    // if (!isCorrect) {
    //   Alert.alert("Error", "Some words don't match. Please check and try again.");
    //   setLoading(false)
    //   return;
    // } else {

    try {
      setCurrentState('sign-up')
      const keyPair = await getKeypairFromMnemonic(mnemonic);
      updateKeypair(keyPair)
      setLoading(false)
    } catch (error) {
      setLoading(false)
      console.error("Error generating keypair:", error);
    }
    // }
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

      setCurrentState('set-pin');
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
      className="py-10 relative  h-[100%]"
    >
      {!startWalletCreation ?
        <View className="gap-y-5 ">
          <View className="w-11/12 m-auto bg-white rounded-3xl p-10">
            <View className="gap-x-5">
              <CText style={{ fontFamily: "bold" }} className="text-[24px] text-center">Your secret phrase is the master key to your wallet</CText>
              <CText className="text-[16px] text-center">Read the context below carefully in order to be able to properly safeguard your wallet.</CText>
            </View>

            <View className="w-100 m-auto">

              <Image source={require('@/assets/items/secret.png')} alt="Security image" style={{ height: 221, width: 221 }} contentFit="contain" />

            </View>

          </View>

          <View className="w-11/12 m-auto bg-white gap-y-3 rounded-3xl p-3">
            {actions.map((action, index) => {
              return (
                <View key={index} className="bg-grey rounded-3xl p-4 flex flex-row  gap-x-2 justify-start items-start">
                  <View className="h-5 w-5 border-4 border-purple rounded-full"></View>
                  <View className="w-[288px] ">

                    <CText className="text-[16px] text-start text-wrap">{action}</CText>
                  </View>

                </View>
              )
            })}
          </View>
        </View>
        :
        <View className="gap-y-5">
          <View className="w-11/12 m-auto bg-white rounded-3xl gap-y-4 px-4 py-3">
            <View className="gap-y-4 mb-2">
              <CText style={{ fontFamily: "bold" }} className="text-[24px] text-start">Secret Phrase</CText>
              <CText className="text-[16px] text-start">Write this down</CText>
            </View>
            <View className="w-full m-auto bg-grey rounded-3xl">
              <View className="p-7 flex flex-row flex-wrap gap-2 justify-between items-center">
                {mnemonic.split(" ").map((word, index) => {
                  return (
                    <CText key={index} style={{ fontFamily: 'bold' }} className="text-[16px] basis-1/4 ">
                      {verifiedWords.length > 0 ? "*****" : `${index + 1}. ${word}`}</CText>
                  )
                })}
              </View>
            </View>
            <Buttons buttonType="feedback" onPress={() => copyKeyPhrase()} className="" icon={<FontAwesome6 name="copy" size={20} color="black" />} text="Copy secret phrase" type="secondary" />
          </View>
        </View>
      }
      <View className="w-full px-4 m-auto p-2 gap-y-3 bottom-10 absolute">
        {
          !startWalletCreation &&
          <Buttons onPress={() => { generateKeyPhrase() }} text="Continue" />
        }
      </View>

      {currentState == "verify-phrase" && (
        <DragableSheet
          close={() => setVerifyPhrase(false)}
          snapPoints={["70%", "100%"]}
          child={
            <View className=" py-1 w-full px-4 gap-y-5 flex flex-col justify-between ">
              <View className="w-8/12 m-auto">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">Confirm secret phrase</CText>
                <CText className="text-[16px] text-center">Please enter the correct answer below from your secret phrase</CText>
              </View>

              <View className="bg-grey rounded-3xl gap-y-3 p-2">

                {verifiedWords.length > 0 && verifiedWords.map((word, index) => (

                  <View key={index} className="bg-white p-3 rounded-2xl">

                    <View className="py-4">
                      <CText className="text-[16px]" style={{ fontFamily: "bold" }} >Word #{word.position}</CText>
                    </View>
                    <View className="border-b border-gray-200">
                    </View>

                    <KeyboardAvoidingView
                      behavior="height"
                    >

                      <TextInput
                        style={{ fontFamily: "bold" }}
                        className="py-5"
                        onChangeText={(text) => {
                          const newUserWords = [...userWords];
                          newUserWords[index].word = text;
                          newUserWords[index].position = word.position;
                          setUserWords(newUserWords);
                        }}
                        placeholder={`enter ${positionVal[word.position - 1]} word...`}
                      />
                    </KeyboardAvoidingView>



                  </View>
                ))}



              </View>

              <Buttons buttonType="pressable" onPress={() => currentState === 'verify-phrase' ? validatePhrase() : copyKeyPhrase()} className="" text="Confirm" type="primary" />
            </View>
          }
        />
      )}

      {currentState == "sign-up" && (
        <DragableSheet
          snapPoints={["50%"]}
          close={() => setWalletSigning(false)}
          child={
            <View className=" py-1 w-full px-4 gap-y-10 flex flex-col justify-between ">
              <View className="w-8/12 m-auto">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">One last thing</CText>
                <CText className="text-[16px] text-center">Your username will be unique and can be used to make transactions.</CText>
              </View>

              <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3 px-4 py-5">
                <View className="bg-white h-fit py-3 rounded-2xl" >
                  <TextInput
                    style={{ fontFamily: "bold" }}
                    className=" p-4 py-5"
                    defaultValue="maskyray2"

                    onChangeText={(text) => {
                      setUserDetails({ ...userDetails, username: text })
                    }}
                    placeholder={`enter a username`}
                  />
                  <View className="border-b border-gray-200" />
                  <TextInput
                    style={{ fontFamily: "bold" }}
                    className="p-4 py-5"
                    defaultValue="08132532431"
                    onChangeText={(text) => {
                      setUserDetails({ ...userDetails, mobileNumber: text })

                    }}
                    placeholder={`enter a phone number`}
                  />
                </View>
              </KeyboardAvoidingView>

              <Buttons buttonType="pressable" onPress={() => saveUserToDB()} className="" text="Done" type="primary" />
            </View>
          }
        />
      )}


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

    </View>
  );
}


