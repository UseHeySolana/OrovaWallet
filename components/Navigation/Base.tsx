

import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Image } from 'expo-image'
import React from 'react'
import {Pressable, View } from 'react-native'

interface BASENAV {
    isSessionActive: boolean,
    startSession: () => void,
    stopSession: () => void,
    isAiActive?: boolean,
  
}
export const Base = ({isSessionActive, startSession, stopSession, isAiActive}: BASENAV) => {
  return (
      <View className="absolute w-screen bottom-5 px-2">

        <View className="w-full bg-[#E1E1E1] p-2 h-[75] rounded-full flex flex-row justify-between items-center ">

          <View className="h-[56] w-[56] border border-purple flex items-center justify-center rounded-full">
            <Ionicons name="wallet-outline" size={24} color="#971BB2" />
          </View>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <Ionicons name="color-palette-outline" size={24} color="black" />

          </View>
          <Pressable onPress={() => isSessionActive ? stopSession() : startSession()} className="h-[100]  w-[100] bg-grey  p-3 rounded-full">
            <Image source={require('@/assets/images/ai.png')} style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          </Pressable>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <FontAwesome6 name="arrows-rotate" size={16} color="black" />
          </View>
          <View className="h-[56] w-[56] flex items-center justify-center rounded-full">
            <MaterialCommunityIcons name="web" size={24} color="black" />
          </View>

        </View>
      </View>

  )
}
