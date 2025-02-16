import { AudioManager } from "@/misc/processors/audioClassManager";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
export default function RegUserVoice() {
  const [recording, setRecording] = useState(false);
   const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
    const audioManager = useRef<AudioManager | null>(null);
      useEffect(() => {
        if (!audioManager.current) {
          audioManager.current = new AudioManager({
            onSpeechStart: () => setIsSpeaking(true),
            onSpeechEnd: () => setIsSpeaking(false),
            onProcessingStart: () => setIsProcessing(true),
            onProcessingEnd: () => setIsProcessing(false),
            onAiSpeakingStart: () => setIsAiSpeaking(true),
            onAiSpeakingEnd: () => setIsAiSpeaking(false),
          });
        } else {
  
        }
        return () => {
          audioManager.current?.cleanup();
        };
      }, [])

  const startRecording = () =>  {
    setRecording(true);
    audioManager.current?.startRecording();
    
  }

  const stopRecording = () => {
    setRecording(false);
    audioManager.current?.stopRecording();
  }
  return (
    <View
      className=" h-full m-auto flex-1 justify-start items-start"
    >
      <View className="w-11/12 m-auto p-2">
        <View className="">
          <Text className="text-[75px] text-purple font-bold">"</Text>
          <Text className="text-[90px]">Hey Solana, send 5 SOL to Alex</Text>
          <Text className="text-[75px]  text-purple font-bold self-end rotate-180">"</Text>
        </View>
        <View>
          <Text className="text-[32px] text-gray-400">Let’s register your voice! say the big text you see on your screen, LFG</Text>
        </View>
      </View>


      <View className="w-11/12 m-auto p-2 gap-y-3 bottom-10 absolute">
        <Pressable onPress={()=>{startRecording()}} >
          <View className={`${!recording ? "bg-[#971BB2]" : "bg-red-600" } py-5 rounded-full `}>
            <Text className="text-white text-center">Record</Text>
          </View>
        </Pressable>
      </View>

    </View>
  );
}
