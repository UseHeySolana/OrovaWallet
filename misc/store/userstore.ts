import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, PersistStorage } from 'zustand/middleware';
import { UserType } from '../types/usertypes';


interface Userstore {
  user: UserType | null;
  setUser: (user: UserType) => void;
  logout: () => void;

}

const UserItem = create(
  persist<Userstore>(
    (set, get) => ({
      user: null ,
      setUser: (user: UserType) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'user', // Storage key
      storage: AsyncStorage as any // Use AsyncStorage for React Native
    }
  )
);

export default UserItem;
