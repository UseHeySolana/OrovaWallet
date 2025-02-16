import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '@/misc/types/usertypes';


const userStore = create(
  persist(
    (set, get) => ({
      // User Info
      user: null ,
      token: null,
      setUser: (user:UserType) => set({ user }),
      setToken: (token:string) => set({ token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'userinfo', // Storage key
      storage: AsyncStorage as any // Use AsyncStorage for React Native
    }
  )
);

export default userStore;
