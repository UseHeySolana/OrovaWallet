import Constants from 'expo-constants';

export const env = {
    GA_KEY: Constants.expoConfig?.extra?.EXPO_PUBLIC_GA_KEY,
    API_URL: Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL,
    PUBLIC_NETWORK: Constants.expoConfig?.extra?.EXPO_PUBLIC_NETWORK,
    DEEPGRAM: Constants.expoConfig?.extra?.EXPO_PUBLIC_DEEPGRAM,
    HELIUS_API: Constants.expoConfig?.extra?.EXPO_PUBLIC_HELIUS_API,
    FIREBASE: Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE,
    APIFY_KEY: Constants.expoConfig?.extra?.EXPO_PUBLIC_APIFY_KEY,
};