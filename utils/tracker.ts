import { request } from "./request/db";
import { storage } from "./storage/storage";
import WalletItem from "./store/wallet.store";
import { v4 as uuidv4 } from "uuid";

const DEVICE_USER_KEY_STORAGE_KEY = "analytics_device_user_key";

let deviceUserKeyPromise: Promise<string> | null = null;

const getDeviceUserKey = async () => {
  if (!deviceUserKeyPromise) {
    deviceUserKeyPromise = (async () => {
      try {
        const existing = await storage.get(DEVICE_USER_KEY_STORAGE_KEY);
        if (existing) {
          return existing;
        }

        const generated = `device:${uuidv4()}`;
        await storage.set(DEVICE_USER_KEY_STORAGE_KEY, generated);
        return generated;
      } catch {
        return `device:${uuidv4()}`;
      }
    })();
  }

  return deviceUserKeyPromise;
};

export const getTrackingUserKey = async () => {
  const wallet = WalletItem.getState();
  const walletKey = wallet.publicKeyBase58 ?? wallet.publicKey?.toBase58();

  if (walletKey) {
    return `wallet:${walletKey}`;
  }

  return getDeviceUserKey();
};

const tracker = {
  buttons: async (button_name: string, clicks: number) => {
    const response = await request.postJson(
      { button_name, clicks },
      `/track/button-clicks`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  tool_calls: async (tool_name: string, calls: number) => {
    const response = await request.postJson(
      { tool_name, calls },
      `/track/tool-calls`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  app_open_count: async () => {
    const response = await request.postJson(
      { user_key: await getTrackingUserKey() },
      `/track/app-open-count`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  page_open_count: async (page_name: string, open_count: number) => {
    const response = await request.postJson(
      { page_name, open_count, user_key: await getTrackingUserKey() },
      `/track/page-open-count`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },

  token_usage: async (token_name: string, usage_count: number) => {
    const response = await request.postJson(
      { token_name, usage_count },
      `/track/token-usage`
    );
    if (!response.ok) {
      const result = await response.json();
      return {
        status: false,
        message: result.message,
      };
    }
    return { status: true, data: await response.json() };
  },
};

export default tracker;
