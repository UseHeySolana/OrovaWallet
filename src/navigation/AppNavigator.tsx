import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


import SetUpAi from '@/src/app/aisetup';
import RegUserVoice from '@/src/app/voicereg';
import SecretPhrase from '@/src/app/secretphrase';
import ImportPhrase from '@/src/app/importphrase';
import Dashboard from '@/src/app/dashboard';
import Home from '@/src/app/home/Home';
import AppSettings from '../misc/store/settingsstore';
import { Image } from 'expo-image';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
    <View className='h-full absolute w-full bg-white/55 flex justify-center items-center '>
        <Image source={require('@/src/assets/images/splaash.gif')} alt="Security image" style={{ height: 70, width: 70 }} contentFit="contain" />
    </View>
);

const AppNavigator = () => {
    const { isLoading } = AppSettings();
// const isLoading = false;

    return (
        <View style={{ flex: 1 }}>
            <Stack.Navigator
                initialRouteName="AiSetup"
                screenOptions={{
                    headerShown: false,
                    statusBarStyle: "dark",
                    statusBarBackgroundColor: "#f3f3f3",
                }}
            >
                <Stack.Screen name="Home" component={Home} />
                <Stack.Screen name="AiSetup" component={SetUpAi} />
                <Stack.Screen name="VoiceReg" component={RegUserVoice} />
                <Stack.Screen name="SecretPhrase" component={SecretPhrase} />
                <Stack.Screen name="ImportPhrase" component={ImportPhrase} />
                <Stack.Screen name="Dashboard" component={Dashboard} />
            </Stack.Navigator>
            {isLoading && <LoadingScreen />}
        </View>
    );
};


export default AppNavigator;
