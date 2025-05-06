import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheItem = {
    value: string;
    expiry: number; // timestamp in ms
};

const DEFAULT_TTL = 60 * 1000; // 30 seconds

export const cache = {
    get: async (key: string): Promise<string | null> => {
        try {
            const item = await AsyncStorage.getItem(key);
            if (!item) return null;

            const parsed: CacheItem = JSON.parse(item);
            if (Date.now() > parsed.expiry) {
                await AsyncStorage.removeItem(key); // Auto-expire
                return null;
            }

            return parsed.value;
        } catch (e) {
            return null;
        }
    },

    set: async (key: string, value: string, ttl: number = DEFAULT_TTL): Promise<boolean> => {
        try {
            const data: CacheItem = {
                value,
                expiry: Date.now() + ttl,
            };
            await AsyncStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    },

    remove: async (key: string): Promise<boolean> => {
        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }
};
