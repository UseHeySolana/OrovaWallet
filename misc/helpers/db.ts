export type MessageData = {
  id: string;
  userName: string;
  mobileNumber: string;
  walletAddress: string;
  addPin: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";


const request = {
  get: async (url: string) => {
    console.log(BASE_URL + url)

    const response = await fetch(BASE_URL + url, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  },
  post: async (data: FormData, url: string) => {
    console.log(BASE_URL + url)
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
    console.log(BASE_URL + url)

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


const getCode = async (phone_number: string) => {
  const item = {
    "phone_number": phone_number
  }
  console.log(item);

  const response = await request.postJson(item, "/v2/get-code");
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
export {
  verifyCode,
  getCode,
  saveWalletAddress,
  registerUser, fetchData, addDataToFirestore, handleSearch, fetchUser, request
};

