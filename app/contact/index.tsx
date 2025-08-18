import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import CText from "@/components/TextComp";
import DragableSheet from "@/components/commons/CustomItems/DragableSheet";
import { Image } from "expo-image";
import AntDesign from '@expo/vector-icons/AntDesign'
import AppSettings from "@/misc/store/settingsstore";
import { router } from "expo-router";
import { Keypair } from "@solana/web3.js";
import UserItem from "@/misc/store/userstore";

const Items = [
  {
    id: 1,
    title: "Voice Assistant",
    description: "",
    subItems: [],
    type: "toogle",
  },
  {
    id: 2,
    title: "Language",
    description: "",
    subItems: [{
      id: 1,
      title: "English",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 3,
    title: "Assistant Voice",
    description: "",
    subItems: [{
      id: 1,
      title: "Kira",
      description: "",
    }],
    type: "dropdown",
  },
  {
    id: 4,
    title: "Assistant Name",
    description: "",
    subItems: [{
      id: 1,
      title: "User Input",
      description: "",
    }],
    type: "dropdown",
  }
]
/**
  * What should be done here
  * 1. Register User Voice for Authentication 
  * 2. Save User Voice and ask if to create wallet with their voice
  */
function Voicereg() {
  const [recording, setRecording] = useState(false);

  const { setDefault } = AppSettings()
  const { user } = UserItem()


  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);

  const [startWalletReg, setStartWalletReg] = useState<boolean>(false);

  //   const audioManager = useRef<AudioManager | null>(null);
  //     useEffect(() => {
  //       if (!audioManager.current) {
  //         audioManager.current = new AudioManager({
  //           onSpeechStart: () => setIsSpeaking(true),
  //           onSpeechEnd: () => setIsSpeaking(false),
  //           onProcessingStart: () => setIsProcessing(true),
  //           onProcessingEnd: () => setIsProcessing(false),
  //           onAiSpeakingStart: () => setIsAiSpeaking(true),
  //           onAiSpeakingEnd: () => setIsAiSpeaking(false),
  //         });
  //       } else {

  //       }
  //       return () => {
  //         // audioManager.current?.cleanup();
  //       };
  //     }, [])

  // const startRecording = async () => {
  //   setRecording(true);
  //   await audioManager.current?.startRecording();
  // }

  // const stopRecording = async () => {
  //   setRecording(false);
  //   await audioManager.current?.stopRecording();

  // }
  return (
    <View
      className="relative h-full w-100 flex items-center"
    >
      <View className="h-full  w-100 m-auto flex justify-center items-start">
        <View className="w-11/12 m-auto p-2">
          <View className="">
            <CText className="text-[75px] text-purple font-bold">"</CText>
            <CText style={{ fontFamily: "bold" }} className="text-[80px] text-wrap">Hey Solana, send 5 SOL to Alex</CText>
            <CText className="text-[75px] text-purple font-bold self-end rotate-180">"</CText>
          </View>
          <View>
            <CText className="text-[32px] text-gray-400">Let’s register your voice! say the big text you see on your screen, LFG</CText>
          </View>
        </View>

      </View>



      <View className="w-11/12 m-auto p-2 gap-y-3 bottom-10 absolute">
        {/* <Pressable onPress={() => { recording ? stopRecording() : startRecording() }} > */}
        <Pressable onPress={() => {
          setStartWalletReg(true)
        }} >
          <View style={{ padding: 5 }} className={`${!recording ? "bg-[#971BB2]" : "bg-red-600"} py-5 rounded-full `}>
            <CText className="text-white text-center">Record</CText>
          </View>
        </Pressable>
      </View>

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
                  router.push('/auth/secretphrase')
                }} >
                  <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent py-5 rounded-full   gap-x-3">
                    <View className="">
                      <AntDesign name="pluscircleo" size={24} color="black" />
                    </View>

                    <View className="">
                      <CText style={{ fontFamily: "bold" }} className="text-primary text-[16px] font-dmBold text-start">Create new Wallet</CText>
                      <CText className="text-primary text-[14px]  text-start">Create a new Solana Wallet</CText>

                    </View>
                  </View>

                </Pressable>
                <Pressable onPress={() => router.push('/')} >
                  <View className="flex flex-row justify-start items-center px-5  bg-grey dark:bg-accent py-5 rounded-full   gap-x-3">
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

