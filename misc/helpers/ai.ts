import { GoogleGenerativeAI } from "@google/generative-ai";
// import { getBalance, getKeyPair } from "./wallet";
// // import { playText } from "./deepgram";
// import { fetchData, fetchUser } from "./db";
// import { aiCheckBalance, aiTransfer } from "./ai-helpers";
// // import OpenAI from "openai";
// // import { AudioManager } from "../classes/audioManagerClass";
// import { prompA } from "./prompt";

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
// export const processAudio = async (audioClass: AudioManager, text: any) => {
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
//     `this is the users details ${
//       "UserName: " +
//     userDetails?.userName +
//       "," +
//       "Total Balance : " +
//     userDetails?.balance +
//       ", Total Balance in USD/Dollars:" +
//     userDetails?.totalUsdBalance +
//       ", Sol " +
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
//   //
//   const openai = new OpenAI({
//     apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
//     dangerouslyAllowBrowser: true,
//   });

//   const userMessage = { role: "user", content: text };
//   addMessageToHistory(userMessage);

//   const completion = await openai.chat.completions.create({
//     model: "gpt-4o",
//     temperature: 0.7,
//     messages: history,
//   });

//   const assistantMessage = {
//     role: "assistant",
//     content: completion?.choices[0]?.message?.content,
//   };
//   console.log(assistantMessage.content);
//   addMessageToHistory(assistantMessage);
//   let saveHistory = localStorage.setItem(
//     "messageHistory",
//     JSON.stringify(history)
//   );

//   const jsonMatch =
//     completion?.choices[0]?.message?.content?.match(/\{[\s\S]*\}/) || null;

//   if (isJson(jsonMatch)) {
//     if (jsonMatch === null)
//       return (
//         completion?.choices[0]?.message?.content ||
//         "Sorry, I couldn't process your request. Please try again."
//       );
//     let keypair = await getKeyPair();
//     if (!keypair) return "No wallet address, found";

//     try {
//       const object = JSON.parse(jsonMatch[0]);

//       let actiontext =
//         object.action == "end-stream"
//           ? "Please wait, while I end the conversation"
//           : object.action == "transfer"
//           ? `Please wait while I check for the user ${object.details.recipient}.`
//           : object.action == "check-balance"
//           ? "Please wait, while I check your balance"
//           : "Please Wait! while I complete your request";
//       let actionPlayBack = await convertSpeech(actiontext);
//       await delay(500);
//       const starter = await playText(audioClass, actionPlayBack, false);
//       await delay(500);

//       if (!starter) {
//         return "Sorry, I couldn't carry out the transaction.";
//       }
//       switch (object.action) {
//         case "end-stream":
//           await delay(1000);
//           audioClass.stopListening();
//           location.reload();
//           break;
//         case "transfer":
//           const response = await aiTransfer(audioClass, object);
//           return response;
//         case "check-balance": {
//           const keypair = await getKeyPair();
//           if (!keypair) {
//             return "Sorry, I couldn't get your balance. Please try again.";
//           }
//           if (!userDetails) return "sorry"
//           const response = await aiCheckBalance(keypair, userDetails, object);
//           return response;
//         }
//         case "swap":
//           const token = object.details.token;
//           return "Sorry, I couldn't process your swap. Please try again.";

//         default:
//           return "Unrecognized action.";
//       }
//     } catch (error) {
//       console.error("Error handling JSON or action:", error);
//       return "An error occurred while processing your request.";
//     }
//   }

//   return (
//     completion?.choices[0]?.message?.content ||
//     "Sorry, I couldn't process your request. Please try again."
//   );
// };

export const isJson = (str: any) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}



// export const interpreteAudio = async (text: string) => {
//     try {
//         const response = await fetch('/api/tts', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ text }),
//         });

//         if (!response.ok) {
//             throw new Error('Failed to generate speech');
//         }

//         // Create a blob from the audio data
//         const audioBlob = await response.blob();
//         const audioUrl = URL.createObjectURL(audioBlob);

//         // Play the audio
//         const audio = new Audio(audioUrl);
//         audio.play();


//         // Clean up
//         audio.onended = () => {
//             URL.revokeObjectURL(audioUrl)
//             return true;
//         };

//     } catch (error) {
//         console.error('Error:', error);
//         return false;
//     }
// };








