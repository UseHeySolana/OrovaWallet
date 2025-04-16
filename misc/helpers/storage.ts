import AsyncStorage from "@react-native-async-storage/async-storage";


export const storage = {

    get: async (name: string) => {
        const storageItem = await AsyncStorage.getItem(name)
        return storageItem;
    },
    set: async (name: string, item: string) => {
        try {
            const saved = await AsyncStorage.setItem(name, item)


            return true

        } catch (e) {
            return false
        };
    },
    remove: async (name: string) => {
        try {
            const saved = await AsyncStorage.removeItem(name)


            return true

        } catch (e) {
            return false
        };
    }
}