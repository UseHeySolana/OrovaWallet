import { GoogleGenerativeAI } from "@google/generative-ai";
import AppSettings from "../store/settingsstore";

const cleanNumber = (input: any) => {
    // Remove non-digit characters
    let cleaned = input.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    console.log(cleaned)
    return cleaned

}

const showToast = (message: string) => {

    AppSettings.getState().setToast(message, 'info')
}


const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GA_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });



export const convertSpeech = async (sentence: any) => {
    const result = await model.generateContent([
        `"${sentence} "Can you rewrite this sentence in a more conversational tone, I want to use it for a text to speech api, make it friendly
        
        Don't return any extra text just the re construct the sentence in a more conversational tone.
        `,
    ]);
    return result.response.text();
};


export {
    showToast,
    cleanNumber
}