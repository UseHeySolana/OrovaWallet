

import IconLibrary from '@/misc/helpers/icons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Image } from 'expo-image'
import React from 'react'
import { Pressable, TouchableOpacity, View } from 'react-native'

interface BASENAV {
  isSessionActive: boolean,
  startSession: () => void,
  stopSession: () => void,
  isAiActive?: boolean,
  showWallet?: boolean,
  setShowWallet?: (showWallet: boolean) => void

}
export const Base = ({ isSessionActive, startSession, stopSession, isAiActive, setShowWallet, showWallet }: BASENAV) => {
  return (
    <View className="absolute w-screen flex flex-row justify-center items-center bottom-5 px-2">

      <View className="w-fit gap-x-4 bg-[#E1E1E1]/60 dark:bg-accent2 p-2 h-[75] rounded-full flex flex-row justify-between items-center ">

        {/* <View className="h-[56] w-[56] border border-purple flex items-center justify-center rounded-full">
            <Ionicons name="wallet-outline" size={24} color="#971BB2" />
          </View> */}
        <TouchableOpacity onPress={() => setShowWallet && setShowWallet(true)} className="h-[56] w-[56] border bg-[#666666] dark:bg-accent border-white dark:border-dark flex items-center justify-center rounded-full">
          <IconLibrary.wallet />
          {/* <Ionicons name="color-palette-outline" size={24} color="white" /> */}

        </TouchableOpacity>
        <TouchableOpacity onPress={() => isSessionActive ? stopSession() : startSession()} className="h-[100]  w-[100] bg-grey dark:bg-accent  rounded-full">
          <Image source={require('@/assets/images/ai.png')} style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </TouchableOpacity>
        {isSessionActive ?
          <TouchableOpacity onPress={() => stopSession()} className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <IconLibrary.cancel color='red' size={30} />

          </TouchableOpacity>
          :
          <TouchableOpacity className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <IconLibrary.arrow_rotate />

          </TouchableOpacity>

        }
        {/* <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <MaterialCommunityIcons name="web" size={24} color="black" />
          </View> */}

      </View>
    </View>

  )
}
