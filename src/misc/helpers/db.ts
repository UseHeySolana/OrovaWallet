import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  DocumentReference,
} from "firebase/firestore";
import { storage } from "./storage";

export type MessageData = {
  id: string;
  userName: string;
  mobileNumber: string;
  walletAddress: string;
  addPin: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
const request = {
  get: async (url: string) => {
    const response = await fetch(BASE_URL + url, {
      method: "GET",
    });

    return response;
  },
  post: async (data: FormData, url: string) => {
    // Upload to your API endpoint

    const response = await fetch(BASE_URL + url, {
      method: "POST",
      body: data,
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
    storage.set("user_id", data.id);
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

export { fetchData, addDataToFirestore, handleSearch, fetchUser };
