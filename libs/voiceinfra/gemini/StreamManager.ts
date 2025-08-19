import { Connection } from "@solana/web3.js";
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import GeminiAudioManager from './GeminiAudioManager';
import { userWalletType } from "@/misc/store/userstore";
import { Audio } from "expo-av";
import { toolFunctions } from "../../tool-implemetation/tools";
import { LiveConfig } from "@/utils/types/multimodal-live-types.types";
import { MultimodalLiveClient } from "./MultiModal";

interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface GeminiToolFunction {
    name: string;
    description: string;
    parameters: any;
    handler: Function;
}

class GeminiSessionManager {
    private apiKey: string = "";
    private config: LiveConfig;
    private streamer: GeminiAudioManager;
    private multimodal: MultimodalLiveClient;
    private isSessionActive: boolean;



    constructor(public userDetails: userWalletType, public connection: Connection) {

        this.config = {
            model: "models/gemini-2.0-flash-exp",
        }
        this.streamer = new GeminiAudioManager()
        this.getApiKey();
        const envKey = process.env.EXPO_PUBLIC_GA_KEY || "";
        this.multimodal = new MultimodalLiveClient({ apiKey: envKey })

        this.isSessionActive = false;

    }

    async startSession(systemInstructions?: string): Promise<void> {
        try {

            // Request permissions first (important for React Native)
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
                const granted = await this.requestAudioPermission();
                if (!granted) {
                    throw new Error('Audio permission denied');
                }
            }

            // Get API key from settings
            this.apiKey = await this.getApiKey();
            if (!this.apiKey) {
                throw new Error('No API key available');
            }

            this.multimodal.on('open', () => {
                this.isSessionActive = true;
            })
                .on('close', this.stopSession)
                .on('interrupted', () => { })
                .on('audio', async (audio) => {
                    await this.streamer.enqueueAudioChunk(audio);

                })
                .on('setupcomplete', () => {
                })
                .on('content', (data) => {
                    console.log(data);
                })
            // .on('log', (log) => { console.log(log) })

            this.multimodal.connect(this.config)
            console.log("Session started and ready for interaction.");
        } catch (error) {
            console.error("Error starting session:", error);
            throw error;
        }
    }


    sendTextMessage(message: string): void {
        // Check if session is active
        if (!this.isSessionActive) {
            console.error("Cannot send message - session not active");
            return;
        }

        try {
            this.multimodal.send({ text: message });

        } catch (error) {
            console.error("Error sending text message:", error);
        }
    }


    private async getApiKey(): Promise<string> {
        // Try to get from environment first
        const envKey = process.env.EXPO_PUBLIC_GA_KEY;
        return envKey || "";
    }
    private async requestAudioPermission(): Promise<boolean> {
        try {
            // Using Expo's permission API
            const { status } = await Audio.getPermissionsAsync();
            if (status !== "granted") {
                const { status: newStatus } = await Audio.requestPermissionsAsync();
                return newStatus === "granted";
            }
            return true;
        } catch (error) {
            console.error("Error requesting audio permission:", error);
            return false;
        }
    }
    public stopSession() {
        this.multimodal.disconnect();
        this.isSessionActive = false;
        // this.streamer.stopStream();
    }

}

export default GeminiSessionManager;



