import WalletItem from "@/utils/store/wallet.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { BASE_URL, HELIUS } from "@/utils/constant";

/** Helius enhanced transactions API (cluster-specific; api.helius.xyz is mainnet-only). */
function heliusEnhancedApiBaseForCluster(
  cluster: "devnet" | "mainnet"
): string {
  return cluster === "devnet"
    ? "https://api-devnet.helius-rpc.com"
    : "https://api-mainnet.helius-rpc.com";
}

export type MessageData = {
  id: string;
  userName: string;
  mobileNumber: string;
  walletAddress: string;
  addPin: string;
};

const request = {
  get: async (url: string) => {
    console.log("called" + " " + BASE_URL + url);

    const response = await fetch(BASE_URL + url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response;
  },

  post: async (data: FormData, url: string) => {
    console.log("called" + url);
    const response = await fetch(BASE_URL + url, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: data,
    });

    return response;
  },

  postJson: async (data: any, url: string) => {
    const response = await fetch(BASE_URL + url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        // "User-Agent": "Thunder Client (https://www.thunderclient.com)",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return response;
  },

  getRan: async (url: string, headers?: object) => {
    console.log("called" + url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
    console.log("response", response);
    return response;
  },

  postRan: async (data: FormData, url: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: data,
    });

    return response;
  },

  postJsonRan: async (data: any, url: string, headers?: object) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });

    return response;
  },
};

const fetchUser = async (userId: string) => {
  try {
    const response = await request.get(`/fetch-user/${userId}`);
    // const docRef = doc(db, "message", userId);
    if (response) {
      const data = await response.json();
      return data;
    } else {
      console.log("No Such Document!");
      return false;
    }
  } catch (e) {
    console.error("Error fetching Data", e);
    return false;
  }
};

const addDataToFirestore = async (
  userName: string,
  mobileNumber: string,
  walletAddress: string,
  addPin: string
): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append("username", userName);
    formData.append("phone_number", mobileNumber);
    formData.append("wallet_address", walletAddress);
    formData.append("pin", addPin);

    const response = await request.post(formData, "/create-user");
    const data = await response.json();
    console.log("Document written with ID: ", data.id);
    return true;
  } catch (error) {
    console.log("Error adding document ", error);
    return false;
  }
};
const fetchData = async () => {
  try {
    const response = await request.get("/fetch-users");
    const result = await response.json();
    return result; // Initialize filteredMessages with all data
  } catch (error) {
    console.error("Error fetching data: ", error);
    return [];
  }
};

const handleSearch = (query: string, searchedItem: any[]) => {
  const lowerCaseQuery = query.toLowerCase();
  const filtered = searchedItem.filter(
    (msg) =>
      msg.username.toLowerCase().includes(lowerCaseQuery) ||
      msg.phone_number.includes(query) ||
      msg.wallet_address.includes(query)
  );
  return filtered;
};

/**
 *
 * @param username
 * @param phone_number
 * @returns
 */

const registerUser = async (payload: {
  username: string;
  phone_number?: string;
  email?: string;
  country?: string;
  google_id_token?: string;
  google_id?: string;
}) => {
  const item: Record<string, string> = {
    username: payload.username,
  };
  if (payload.phone_number) item.phone_number = payload.phone_number;
  if (payload.email) item.email = payload.email;
  if (payload.country) item.country = payload.country;
  if (payload.google_id_token) item.google_id_token = payload.google_id_token;
  if (payload.google_id) item.google_id = payload.google_id;

  const response = await request.postJson(item, "/v2/register-users");
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false,
      message: result.message,
    };
  }
  return { status: true, data: await response.json() };
};

const checkUsernameAvailability = async (username: string) => {
  const url = "/v2/check-username";
  try {
    const response = await request.postJson({ username: username.trim() }, url);
    if (!response.ok) {
      let message = response.statusText || "Could not check username";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      return { status: false, message };
    }
    const data = await response.json();
    return { status: true, available: Boolean(data.available) };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check your connection."
        : err instanceof Error
          ? err.message
          : "Request failed";
    return { status: false, message };
  }
};

const verifyCode = async (otp: string, username: string) => {
  const item = {
    verification_code: String(otp ?? "").trim(),
    username: String(username ?? "").trim(),
  };
  const url = "/v2/verify-code";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Verification failed";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      console.warn("[verifyCode] failed", BASE_URL + url, response.status, message);
      return { status: false, message };
    }
    return { status: true, data: await response.json() };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check EXPO_PUBLIC_API_URL and that the backend is running."
        : (err instanceof Error ? err.message : "Request failed");
    console.warn("[verifyCode] error", BASE_URL + url, err);
    return { status: false, message };
  }
}


/**
 *
 * @param walletAddress
 * @param username
 * @returns
 */
const saveWalletAddress = async (walletAddress: string, username: string) => {
  const item = {
    wallet_address: walletAddress,
    username: username,
  };

  const response = await request.postJson(item, "/v2/add-walletaddress");
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false,
      message: result.message,
    };
  }
  return { status: true, data: await response.json() };
};

const addEmail = async (username: string, email: string) => {
  const item = {
    username: username.trim(),
    email: email.trim().toLowerCase(),
  };
  const url = "/v2/add-email";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Could not add email";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      return { status: false, message };
    }
    const data = await response.json();
    return { status: true, data };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check your connection."
        : err instanceof Error
          ? err.message
          : "Request failed";
    return { status: false, message };
  }
};

const addPhone = async (payload: {
  username: string;
  phone_number: string;
  country?: string;
}) => {
  const item: Record<string, string> = {
    username: payload.username.trim(),
    phone_number: payload.phone_number.trim(),
  };
  if (payload.country) item.country = payload.country;

  const url = "/v2/add-phone";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Could not add mobile number";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      return { status: false, message };
    }
    const data = await response.json();
    return { status: true, data };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check your connection."
        : err instanceof Error
          ? err.message
          : "Request failed";
    return { status: false, message };
  }
};

/**
 *
 * @param phone_number
 * @returns
 */
const getCode = async (payload: {
  phone_number?: string;
  email?: string;
  country?: string;
}) => {
  const item: Record<string, string> = {};
  if (payload.phone_number) item.phone_number = payload.phone_number;
  if (payload.email) item.email = payload.email;
  if (payload.country) item.country = payload.country;
  const url = "/v2/get-code";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Request failed";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response (e.g. 500 HTML)
      }
      console.warn("[getCode] failed", BASE_URL + url, response.status, message);
      return { status: false, message };
    }
    const result = await response.json();
    return { status: true, data: result };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check EXPO_PUBLIC_API_URL and that the backend is running."
        : (err instanceof Error ? err.message : "Request failed");
    console.warn("[getCode] error", BASE_URL + url, err);
    return { status: false, message };
  }
};

/**
 * @param publicKey wallet address
 * @param cluster optional; when set, fetches that cluster regardless of app network setting
 */
const getTransactionHistory = async (
  publicKey: string,
  cluster?: "devnet" | "mainnet"
) => {
  const resolved: "devnet" | "mainnet" =
    cluster ??
    (AppSettings.getState().networkShort === "devnet" ? "devnet" : "mainnet");
  const base = heliusEnhancedApiBaseForCluster(resolved);
  const response = await request.getRan(
    `${base}/v0/addresses/${publicKey}/transactions?api-key=${HELIUS}`
  );

  if (!response.ok) {
    const result = await response.json();
    return {
      status: false,
      message: result.message,
    };
  }
  //set Transaction History
  return { status: true, data: await response.json() };
};

const getContacts = async (id: string) => {
  const response = await request.get(`/v2/get-contacts/${id}`);
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message };
  }
  return { status: true, data: await response.json() };
};

const addContact = async (
  username: string,
  phone_number: string,
  wallet_address: string
) => {
  const userId = WalletItem.getState().publicKey?.toString();
  if (!userId) {
    return { status: false, message: "User not found" };
  }
  const item = {
    username: username,
    phone_number: phone_number,
    wallet_address: wallet_address,
    user_id: userId,
  };

  const response = await request.postJson(item, "/v2/add-contact");
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message };
  }
  return { status: true, data: await response.json() };
};

const deletePersonalContact = async (id: string) => {
  const response = await request.get(`/v2/delete-contact/${id}`);
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message };
  }
  return { status: true, data: await response.json() };
};

const updateContact = async (
  id: string,
  username: string,
  phone_number: string,
  wallet_address: string
) => {
  const item = {
    username: username,
    phone_number: phone_number,
    wallet_address: wallet_address,
    contact_id: id,
  };

  const response = await request.postJson(item, "/v2/update-contact");
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message };
  }
  return { status: true, data: await response.json() };
};

const loginWithGoogle = async (payload: {
  google_id_token: string;
  google_id?: string;
}) => {
  const item: Record<string, string> = {
    google_id_token: payload.google_id_token,
  };
  if (payload.google_id) item.google_id = payload.google_id;

  const url = "/v2/google-login";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Google sign-in failed";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      console.warn("[loginWithGoogle] failed", BASE_URL + url, response.status, message);
      return {
        status: false,
        message,
        notFound: response.status === 404,
      };
    }
    return { status: true, data: await response.json() };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check EXPO_PUBLIC_API_URL and that the backend is running."
        : err instanceof Error
          ? err.message
          : "Request failed";
    console.warn("[loginWithGoogle] error", BASE_URL + url, err);
    return { status: false, message };
  }
};

const loginWithGoogleBackup = async (payload: {
  google_id_token: string;
  google_id?: string;
  username: string;
  wallet_address: string;
}) => {
  const item: Record<string, string> = {
    google_id_token: payload.google_id_token,
    username: payload.username,
    wallet_address: payload.wallet_address,
  };
  if (payload.google_id) item.google_id = payload.google_id;

  const url = "/v2/google-restore-login";
  try {
    const response = await request.postJson(item, url);
    if (!response.ok) {
      let message = response.statusText || "Could not sign in with backup";
      try {
        const result = await response.json();
        if (result?.message) message = result.message;
      } catch {
        // non-JSON response
      }
      console.warn("[loginWithGoogleBackup] failed", BASE_URL + url, response.status, message);
      return { status: false, message };
    }
    return { status: true, data: await response.json() };
  } catch (err) {
    const message =
      err instanceof TypeError && err.message?.includes("fetch")
        ? "Cannot reach server. Check EXPO_PUBLIC_API_URL and that the backend is running."
        : err instanceof Error
          ? err.message
          : "Request failed";
    console.warn("[loginWithGoogleBackup] error", BASE_URL + url, err);
    return { status: false, message };
  }
};

export {
  addContact,
  addEmail,
  addPhone,
  deletePersonalContact,
  getContacts,
  verifyCode,
  getCode,
  loginWithGoogle,
  loginWithGoogleBackup,
  saveWalletAddress,
  getTransactionHistory,
  registerUser,
  checkUsernameAvailability,
  fetchData,
  addDataToFirestore,
  handleSearch,
  fetchUser,
  request,
  updateContact,
};
