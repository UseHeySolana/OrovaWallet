import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import Buttons from "@/components/ButtonComp";
import { generateMnemonic } from "@/misc/helpers/wallet";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Clipboard from 'expo-clipboard';
import AppSettings from "@/misc/store/settingsstore";
import { Connection } from "@solana/web3.js";


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
export default function Dashboard({ navigation }: any) {
  const [startWalletCreation, setStartWalletCreation] = useState(false);
  const { setDefault } = AppSettings()
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


  const generateKeyPhrase = async () => {
    const phrase = await generateMnemonic();
    setMnemonic(phrase);
    setStartWalletCreation(true);
    console.log(mnemonic)
  }
  const copyKeyPhrase = async () => {
    // setDefault()
    await Clipboard.setStringAsync(mnemonic);
    setVerifiedWords(getThreeRandomStrings(mnemonic.split(' ') as string[]))
    setTimeout(() => {
      setVerifyPhrase(true);
    }, 500);
  }
  const validatePhrase = () => {
    setWalletSigning(true);
    setVerifyPhrase(false);

    //     if (userWords.some(word => !word.word.trim())) {
    //       Alert.alert("Error", "Please fill in all the words");
    //       return;
    //     }

    //     // Check if each entered word matches the corresponding verified word
    //     const isCorrect = userWords.every((userWord, index) => {
    //       const verifiedWord = verifiedWords[index];
    //       // Compare the words case-insensitively
    //       return userWord.word.toLowerCase().trim() === verifiedWord.word.toLowerCase();
    //     });


    //     if (!isCorrect) {
    //       Alert.alert("Error", "Some words don't match. Please check and try again.");
    //       return;
    //     }else{
    // setWalletSigning(true);
    //     }
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

      {verifyPhrase && (
        <DragableSheet
          close={() => setVerifyPhrase(false)}
          snapPoints={["80%", "100%"]}
          child={
            <View className=" py-1 w-full  gap-y-5 flex flex-col justify-between ">
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

              <Buttons buttonType="pressable" onPress={() => verifyPhrase ? validatePhrase() : copyKeyPhrase()} className="" text="Confirm" type="primary" />
            </View>
          }
        />
      )}

      {walletSigning && (
        <DragableSheet
          snapPoints={["100%"]}
          close={()=>setWalletSigning(false)}
          child={
            <View className=" py-1 w-full  gap-y-10 flex flex-col justify-between ">
              <View className="w-8/12 m-auto">
                <CText style={{ fontFamily: "bold" }} className="text-[20px] text-center">One last thing</CText>
                <CText className="text-[16px] text-center">Your username will be unique and can be used to make transactions.</CText>
              </View>

              <KeyboardAvoidingView className="bg-grey rounded-3xl gap-y-3 px-4 py-5">
                <View className="bg-white h-fit py-3 rounded-2xl" >
                      <TextInput
                        style={{ fontFamily: "bold" }}
                    className=" p-4 py-5"
                        onChangeText={(text) => {
                          const newUserWords = [...userWords];
                          // newUserWords[index].word = text;
                          // newUserWords[index].position = word.position;
                          setUserWords(newUserWords);
                        }}
                        placeholder={`enter a username`}
                      />
                  <View className="border-b border-gray-200"/>
                      <TextInput
                        style={{ fontFamily: "bold" }}
                    className="p-4 py-5"
                        onChangeText={(text) => {
                          // const newUserWords = [...userWords];
                          // // newUserWords[index].word = text;
                          // // newUserWords[index].position = word.position;
                          // setUserWords(newUserWords);
                        }}
                        placeholder={`enter a phone number`}
                      />
                </View>
              </KeyboardAvoidingView>

              <Buttons buttonType="pressable" onPress={() =>{}} className="" text="Done" type="primary" />
            </View>
          }
        />
      )}



    </View>
  );
}


