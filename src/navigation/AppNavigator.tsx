// src/navigation/AppNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SetUpAi from '@/app/aisetup';
import Home from '../screens/Home';
import RegUserVoice from '@/app/voicereg';
import SecretPhrase from '@/app/secretphrase';
import ImportPhrase from '@/app/importphrase';
const Stack = createNativeStackNavigator();

const AppNavigator = () => (

    <Stack.Navigator initialRouteName="AiSetup"
        screenOptions={{
            headerShown: false, 
            statusBarStyle: "dark",
            statusBarBackgroundColor: "#f3f3f3",
        }}>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="AiSetup" component={SetUpAi} />
        <Stack.Screen name="VoiceReg" component={RegUserVoice} />
        <Stack.Screen name="SecretPhrase" component={SecretPhrase} />
        <Stack.Screen name="ImportPhrase" component={ImportPhrase} />


    </Stack.Navigator>
);

export default AppNavigator;
