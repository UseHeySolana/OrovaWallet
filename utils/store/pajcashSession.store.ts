import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage, persist } from "zustand/middleware";

interface PajCashSessionState {
  recipient: string | null;
  token: string | null;
  expiresAt: string | null;
  deviceUuid: string | null;
  setSession: (payload: {
    recipient: string;
    token: string;
    expiresAt: string;
  }) => void;
  setDeviceUuid: (uuid: string) => void;
  clearSession: () => void;
  isSessionValid: () => boolean;
}

const PajCashSession = create<PajCashSessionState>()(
  persist(
    (set, get) => ({
      recipient: null,
      token: null,
      expiresAt: null,
      deviceUuid: null,
      setSession: ({ recipient, token, expiresAt }) =>
        set({ recipient, token, expiresAt }),
      setDeviceUuid: (uuid) => set({ deviceUuid: uuid }),
      clearSession: () =>
        set({ recipient: null, token: null, expiresAt: null }),
      isSessionValid: () => {
        const { token, expiresAt } = get();
        if (!token) return false;
        if (!expiresAt) return true;
        const exp = new Date(expiresAt).getTime();
        if (Number.isNaN(exp)) return true;
        return exp > Date.now();
      },
    }),
    {
      name: "pajcash-session",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default PajCashSession;
