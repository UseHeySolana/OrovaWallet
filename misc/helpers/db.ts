import { cache } from "./storage/cache";

export type MessageData = {
  id: string;
  userName: string;
  mobileNumber: string;
  walletAddress: string;
  addPin: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
const AIRBILLS = process.env.EXPO_PUBLIC_AIR_BILLS || "";
const HELIUS = process.env.EXPO_PUBLIC_HELIUS_API || "";


const request = {
  get: async (url: string) => {
    console.log("called" + url)

    const response = await fetch(BASE_URL + url, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  },
  post: async (data: FormData, url: string) => {
    console.log("called" + url)
    const response = await fetch(BASE_URL + url, {
      method: "POST",
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: data,
    });

    return response;
  },

  postJson: async (data: any, url: string) => {

    const response = await fetch(BASE_URL + url, {
      method: "POST",
      headers: {
        "Accept": "*/*",
        // "User-Agent": "Thunder Client (https://www.thunderclient.com)",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data),
    });

    return response;
  },


  getRan: async (url: string) => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  },
  postRan: async (data: FormData, url: string) => {

    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: data,
    });

    return response;
  },

  postJsonRan: async (data: any, url: string, headers?: object) => {

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "*/*",
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

const registerUser = async (username: string, phone_number: string) => {
  const item = {
    "username": username,
    "phone_number": phone_number,
  }
  console.log(item);

  const response = await request.postJson(item, "/v2/register-users");
  if (!response.ok) {

    const result = await response.json();
    return {
      status: false, message: result.message
    }
  }
  return { status: true, data: await response.json() };
}

const verifyCode = async (otp: string, username: string) => {
  const item = {
    "verification_code": otp,
    "username": username,
  }
  console.log(item);

  const response = await request.postJson(item, "/v2/verify-code");
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false, message: result.message
    }
  }
  return { status: true, data: await response.json() };
}

/**
 * 
 * @param walletAddress 
 * @param username 
 * @returns 
 */
const saveWalletAddress = async (walletAddress: string, username: string) => {
  const item = {
    "wallet_address": walletAddress,
    "username": username,
  }
  console.log(item);

  const response = await request.postJson(item, "/v2/add-walletaddress");
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false, message: result.message
    }
  }
  return { status: true, data: await response.json() };
}

/**
 * 
 * @param phone_number 
 * @param amount 
 * @param token 
 * @param userWalletAddress 
 * @returns 
 */
const purchaseAirtime = async (phone_number: string, amount: number, userWalletAddress: string) => {

  const url = 'https://vendor.airbillspay.com/bills/airtime/paypoint'
  const data = {
    "phoneNumber": phone_number,
    "amount": amount,
    "token": 'USDC',
    "user_address": userWalletAddress,
  }

  try {
    const response = await request.postJsonRan(data, url, { "secretkey": AIRBILLS });

    if (!response.ok) {
      const result = await response.json();
      return {
        status: false, message: result.message
      }
    }
    return { status: true, data: await response.json() };
  } catch (error) {
    console.log(error)
    return { status: false, message: error };
  }
}

/**
 * 
 * @param id 
 * @returns 
 */
const completePurchase = async (id: string) => {
  const url = "https://vendor.airbillspay.com/bills/airtime/paypoint/complete"

  const data = {
    "id": id,
  }

  try {
    const response = await request.postJsonRan(data, url, { "secretkey": AIRBILLS });

    const result = await response.json();
    if (!result.success) {
      return {
        status: false, message: result.message
      }
    }
    return { status: true, data: result };
  } catch (error) {
    console.log(error)
    return { status: false, message: error };
  }

}



/**
 * 
 * @param phone_number 
 * @returns 
 */
const getCode = async (phone_number: string) => {
  const item = {
    "phone_number": phone_number
  }
  console.log(item);

  const response = await request.postJson(item, "/v2/get-code");

  console.log(response);
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false, message: result.message
    }
  } else {
    const result = await response.json();
    return { status: true, data: result };
  }
}


/**
 * @param publicKey
 * @returns 
 */
const getTransactionHistory = async (publicKey: string) => {
  const response = await request.getRan(`https://api.helius.xyz/v0/addresses/${publicKey}/transactions?api-key=${HELIUS}`)
  if (!response.ok) {
    const result = await response.json();
    return {
      status: false, message: result.message
    }
  }
  //set Transaction History
  return { status: true, data: await response.json() };
}

const getContacts = async (id: string) => {
  const response = await request.get(`/v2/get-contacts/${id}`);
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message }
  }
  return { status: true, data: await response.json() };
}


const addContact = async (username: string, phone_number: string, wallet_address: string) => {
  const item = {
    "username": username,
    "phone_number": phone_number,
    "wallet_address": wallet_address,
  }

  const response = await request.postJson(item, "/v2/add-contact");
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message }
  }
  return { status: true, data: await response.json() };
}


const deleteContact = async (id: string) => {
  const response = await request.get(`/v2/delete-contact/${id}`);
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message }
  }
}

const updateContact = async (id: string, username: string, phone_number: string, wallet_address: string) => {
  const item = {
    "username": username,
    "phone_number": phone_number,
    "wallet_address": wallet_address,
  }

  const response = await request.postJson(item, "/v2/update-contact");
  if (!response.ok) {
    const result = await response.json();
    return { status: false, message: result.message }
  }
  return { status: true, data: await response.json() }; 
}



export {
  addContact,
  deleteContact,
  getContacts,
  purchaseAirtime,
  verifyCode,
  getCode,
  saveWalletAddress,
  getTransactionHistory,
  registerUser, fetchData, addDataToFirestore, handleSearch, fetchUser, request, completePurchase, updateContact      
};

