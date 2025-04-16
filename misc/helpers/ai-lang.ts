import { GoogleGenerativeAI } from "@google/generative-ai";
// import { getKeyPair } from "./wallet";
// import { playText, processAi } from "./deepgram";
// // import { AudioManager } from "../classes/audioManagerClass";
// import { prompA } from "./prompt";
// // import bs58 from "bs58";

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GA_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// export async function runGenAi(message: any) {
//   // For text-only input, use the gemini-pro model

//   const json_history = [
//     {
//       role: "user",
//       parts: [{ text: "Hello" }],
//     },
//     {
//       role: "model",
//       parts: [{ text: `Great to meet you!` }],
//     },
//   ];

//   const chat = model.startChat({
//     history: json_history,
//     generationConfig: {
//       maxOutputTokens: 10000,
//     },
//   });

//   const msg = message;
//   const result = await chat.sendMessage(msg);
//   const response = await result.response;
//   const text = response.text();
//   return {
//     text: text,
//   };
// }

export const convertSpeech = async (sentence: any) => {
  const result = await model.generateContent([
    `"${sentence} "Can you rewrite this sentence in a more conversational tone, I want to use it for a text to speech api, make it friendly
        
        Don't return any extra text just the re construct the sentence in a more conversational tone.
        `,
  ]);
  console.log(result.response.text());
  return result.response.text();
};


// export function delay(ms: any) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }


// export const processAudioLang = async (audioClass: AudioManager, text: any) => {
//   const userDetails = audioClass.settings.userDetails;
//   const tokenDetails = userDetails?.tokenAccounts.map((token) => ({
//     name: token.name,
//     image: token.image,
//     symbol: token.symbol,
//     balance:
//       Number(token.balance) > 0
//         ? Number(token.balance).toFixed(2)
//         : token.balance,
//     decimals: token.decimals,
//     usdc_price: token.usdc_price,
//     mint: token.mint,
//   }));

//   const updatedPrompt =
//     prompA +
//     "" +
//     `this is the list of tokens in the users wallet ${JSON.stringify(
//       tokenDetails,
//       null,
//       2
//     )} ` +
//     `this is the users details ${"UserName: " +
//     userDetails?.userName +
//     "," +
//     "Total Balance : " +
//     userDetails?.balance +
//     ", Total Balance in USD/Dollars:" +
//     userDetails?.totalUsdBalance +
//     ", Sol " +
//     userDetails?.solBalance
//     }`;

//   const systemMessage = {
//     role: "system",
//     content: updatedPrompt,
//   };
//   let history = JSON.parse(
//     localStorage.getItem("messageHistory") || JSON.stringify([systemMessage])
//   );
//   const addMessageToHistory = (newMessage: {
//     role: string;
//     content: string | null;
//   }) => {
//     // Add the new message to history
//     history.push(newMessage);
//     const nonPromptMessages = history.slice(1); // Exclude the prompt
//     if (nonPromptMessages.length > 5) {
//       history = [systemMessage, ...nonPromptMessages.slice(-5)]; // Keep prompt and last 5 messages
//     }
//   };
//   let keypair = await getKeyPair();
//   if (!keypair) return "No wallet address, found";

//   const userMessage = { role: "user", content: text };
//   addMessageToHistory(userMessage);

//   const privatekey = bs58.encode(keypair.secretKey)
//   const langAi = await processAi(text, privatekey, audioClass)
//   const assistantMessage = {
//     role: "assistant",
//     content: langAi,
//   };
//   console.log(langAi);
//   addMessageToHistory(assistantMessage);
//   let saveHistory = localStorage.setItem(
//     "messageHistory",
//     JSON.stringify(history)
//   );
//   return langAi as string;
// };

// export const interpreteAudio = async (text: string) => {
//   try {
//     const response = await fetch('/api/tts', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ text }),
//     });

//     if (!response.ok) {
//       throw new Error('Failed to generate speech');
//     }

//     // Create a blob from the audio data
//     const audioBlob = await response.blob();
//     const audioUrl = URL.createObjectURL(audioBlob);

//     // Play the audio
//     const audio = new Audio(audioUrl);
//     audio.play();

//     // Clean up
//     audio.onended = () => {
//       URL.revokeObjectURL(audioUrl)
//       return true;
//     };

//   } catch (error) {
//     console.error('Error:', error);
//     return false;
//   }
// };








