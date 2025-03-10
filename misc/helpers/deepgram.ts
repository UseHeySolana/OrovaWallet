import { AudioManager } from "../processors/audioClassManager";





export const blobToFile = (blob: Blob): File => {
    return new File([blob], `audio_${Date.now()}.mp3`, { type: blob.type });
};

export const saveFileToCloud = async (audioBlob: Blob) => {
    try {
        // Convert blob to File
        const audioFile = blobToFile(audioBlob);

        // Create FormData
        const formData = new FormData();
        formData.append('audio', audioFile);

        // Upload to your API endpoint
        const response = await fetch('/api/google-ai', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error processing audio:', error);
        throw error;
    }
};

export const transcribeAudio = async (audioBlob: Blob) => {
    try {
        // Convert blob to File
        const audioFile = blobToFile(audioBlob);

        // Create FormData
        const formData = new FormData();
        formData.append('audio', audioFile);

        // Upload to your API endpoint
        const response = await fetch('/api/open-ai', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        console.log(result);
        return result;
    } catch (error) {
        console.error('Error processing audio:', error);
        throw error;
    }
};

// export const playText = async (
//   audioClass: AudioManager,
//   text: string,
//   end: boolean
// ) => {
//   try {
//     const response = await fetch("/api/tts", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ text }),
//     });

//     if (!response.ok || !response.body) {
//       throw new Error("Failed to generate speech");
//     }

//     const mediaSource = new MediaSource();
//     const audio = new Audio();
//     audio.src = URL.createObjectURL(mediaSource);
//     audio.playbackRate = 1.1;

//     audioClass.callbacks.onProcessingEnd();
//     audioClass.callbacks.onAiSpeakingStart();

//     return new Promise<boolean>((resolve, reject) => {
//       mediaSource.addEventListener("sourceopen", async () => {
//         const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
//         const reader = response.body!.getReader();

//         let isStreamEnded = false;
//         let pendingChunks: Uint8Array[] = [];
//         let isFirstChunk = true;

//         const processNextChunk = () => {
//           if (pendingChunks.length > 0 && !sourceBuffer.updating) {
//             const chunk = pendingChunks.shift();
//             if (chunk) {
//               sourceBuffer.appendBuffer(chunk);
//             }
//           }

//           if (
//             isStreamEnded &&
//             pendingChunks.length === 0 &&
//             !sourceBuffer.updating
//           ) {
//             mediaSource.endOfStream();
//             resolve(true);
//           }
//         };

//         sourceBuffer.addEventListener("updateend", processNextChunk);

//         const streamAudio = async () => {
//           try {
//             const { done, value } = await reader.read();

//             if (done) {
//               isStreamEnded = true;
//               processNextChunk();
//               return;
//             }

//             if (sourceBuffer.updating) {
//               pendingChunks.push(value);
//             } else {
//               sourceBuffer.appendBuffer(value);
//             }

//             if (isFirstChunk) {
//               audio.play();
//               isFirstChunk = false;
//             }

//             await streamAudio();
//           } catch (error) {
//             reject(error);
//           }
//         };

//         await streamAudio();
//       });

//       audio.onended = async () => {
//         if (end) {
//           await audioClass.afterAudio();
//         }
//         resolve(true);
//       };

//       audio.onerror = () => {
//         console.error("Audio playback error");
//         reject(new Error("Audio playback failed"));
//       };
//     });
//   } catch (error) {
//     console.error("Error playing audio:", error);
//     return false;
//   }
// };





// export const processAi = async (
//   text: string,
//   privatekey: string,
//   audioClass:AudioManager
// ) => {
//   try {
//     const api_key = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";
//     const rpc = "https://mainnet.helius-rpc.com/?api-key=" + process.env.NEXT_PUBLIC_HELIUS_API || "";

//     const agent = new AgentKit(api_key, rpc, privatekey)

//     const executor = await agent.setupAgent(audioClass);
//     const response = await agent.runAgent(
//       executor,
//       text
//     )
//     return response;

//   } catch (error) {
//     console.error("Error generating text:", error);
//     return null;
//   }
// };