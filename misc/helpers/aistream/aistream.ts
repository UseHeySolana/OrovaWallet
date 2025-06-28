import { Connection } from "@solana/web3.js";
import {
    RTCPeerConnection,
    RTCSessionDescription,
    mediaDevices,
    MediaStream
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import 'react-native-get-random-values'; // Required for crypto operations
import { v4 as uuidv4 } from 'uuid'; // Import UUID v4 generator
import AudioManager from './AudioManager';
import UserItem, { userWalletType } from "@/misc/store/userstore";
import { toolFunctions } from "../tools";
import { Audio } from "expo-av";
import AppSettings from "@/misc/store/settingsstore";
import Convo from "@/misc/store/conversation";
import { toolRouter } from "../toolsregistry";
import { FunctionParams } from "../types";


import { summarizeConversation } from "../miscfunctions.ts/extrafunctions";
import { AgentContacts, supportedTokens } from "../miscfunctions.ts";
import setUserItems from "@/app/requests/dashboard";
import WalletItem from "@/misc/store/wallet";
import tracker from "../db/tracker";

class SessionManager {
    private isSessionActive: boolean;
    private events: any[];
    private dataChannel: any | null; // RTCDataChannel equivalent
    private peerConnection: RTCPeerConnection | null;
    private audioManager: AudioManager;
    private memory: any[];
    private memoryLimit: number = 7;
    private storageKey: string = "ai_session_memory";
    private systemInstructions: string = "";
    private availableFunctions: FunctionParams[] = [];
    private connectionEstablished: boolean = false;
    private conversation_id: string | null = null;
    public functionMessageId: string | null = null;
    public activeMessageId: string | null = null;
    // public mode: 'loading' | 'human' | 'aispeaking' = 'loading'
    public callbacks: {
        setMode: (mode: "loading" | "human" | "aispeaking") => void;
        setConversationId: (id: string) => void;
    };


    constructor(public userDetails: userWalletType, public connection: Connection,
        callbacks: {
            setMode: (mode: "loading" | "human" | "aispeaking") => void,
            setConversationId: (id: string) => void

        }) {
        this.isSessionActive = false;
        this.events = [];
        this.memory = [];
        this.dataChannel = null;
        this.peerConnection = null;
        this.callbacks = callbacks;

        // Initialize audio manager
        this.audioManager = new AudioManager();

        // Load memory asynchronously
        this.loadMemory().then(memory => {
            this.memory = memory;
        });
        // Pre-register functions but don't send them yet
        this.availableFunctions = toolRouter(this);
    }

    async startSession(systemInstructions?: string): Promise<void> {
        AppSettings.getState().setLoading(true);
        // Set system instructions if provided
        if (systemInstructions) {
            const sysIns = `
            These are the list of contacts I have on the App,
                ${JSON.stringify(AgentContacts())}
            \n
            These are the list of supported tokens for swaps,
                ${JSON.stringify(supportedTokens)} always map the token to the correct symbol, correct with right spelling always if the token doesn't fall you can use as provided.

                \n 
                to swap first get the quote of the tokens and then respond to the user with the quote and then ask for confirmation to swap.
                \n

            always map the username i am interacting to any of these, correct with right spelling always if the username doesn't fall you can use as provided.
                \n
                 these are the list of sub tools supported and parameters,
                ${JSON.stringify(toolRouter(this).map(item => ({
                "toolName": item.name,
                "toolParameters": item.parameters,
            })))}.
                `;

            this.systemInstructions = systemInstructions + sysIns;
        }

        if (this.isSessionActive || this.peerConnection || this.dataChannel) {
            console.warn("Previous session detected – cleaning up before starting a new one.");
            this.cleanupResources();
        }


        try {
          // Request permissions first (important for React Native)
          if (Platform.OS === "android") {
            const granted = await this.requestAudioPermission();
            if (!granted) {
              throw new Error("Audio permission denied");
            }
          }

          //check if token is available then create
          // const ek = AppSettings.getState().ek;

          // let EPHEMERAL_KEY: string;

          // function isTokenExpired(expiry: number) {
          //     const now = new Date();
          //     const expiryDate = new Date(expiry * 1000);
          //     return now >= expiryDate;
          // }

          // if (ek.value === "" || !isTokenExpired(ek.expiry)) {
          const tokenResponse = await fetch(
            "https://speeh-to-text-service.vercel.app/api/open-token"
          );

          const data = await tokenResponse.json();
          const EPHEMERAL_KEY = data.client_secret.value;
          AppSettings.getState().setEk(
            data.client_secret.value,
            data.client_secret.expires_at
          );

          // } else {
          //     EPHEMERAL_KEY = AppSettings.getState().ek.value;
          // }

          this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Add STUN server for better connection
          });

          // if (audio) {
          // Get media stream (different in React Native)
          const stream = await mediaDevices.getUserMedia({ audio: true });

          this.peerConnection.addTrack(stream.getTracks()[0], stream);

          // Add tracks to peer connection
          // stream.getTracks().forEach(track => {
          //     this.peerConnection!.addTrack(track, stream);
          // });
          // }
          // Setup connection state tracking
          //@ts-ignore
          this.peerConnection.addEventListener("connectionstatechange", () => {
            console.log(
              `Connection state changed: ${this.peerConnection?.connectionState}`
            );
            if (this.peerConnection?.connectionState === "connected") {
              this.connectionEstablished = true;
            }
          });

          // Create data channel with more reliable options
          this.dataChannel = this.peerConnection.createDataChannel(
            "oai-events",
            {
              ordered: true,
              maxRetransmits: 3,
            }
          );

          // Setup event handlers before creating offer
          this.setupDataChannelEventHandlers();

          // Create offer with required options parameter
          const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
            voiceActivityDetection: true,
          });

          await this.peerConnection.setLocalDescription(offer);

          // Send offer to API
          const baseUrl = "https://api.openai.com/v1/realtime";
          const model = "gpt-4o-mini-realtime-preview-2024-12-17";
          const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: `Bearer ${EPHEMERAL_KEY}`,
              "Content-Type": "application/sdp",
            },
          });

          if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text();
            throw new Error(`Failed to establish session: ${errorText}`);
          }

          // Set remote description
          const answerSdp = await sdpResponse.text();
          const answer = new RTCSessionDescription({
            type: "answer",
            sdp: answerSdp,
          });
          await this.peerConnection.setRemoteDescription(answer);

          // Handle audio tracks with our AudioManager
          // @ts-ignore
          this.peerConnection.addEventListener("track", (event) => {
            console.log("Track event received:", event.track?.kind);
            if (event.streams && event.streams[0]) {
              // Only handle audio tracks
              if (event.track && event.track.kind === "audio") {
                console.log(
                  "Audio track received - handling with AudioManager"
                );
                this.audioManager.handleRemoteStream(event.streams[0]);
              }
            }
          });
          this.conversation_id = new Date().getTime().toString();
          this.callbacks.setConversationId(this.conversation_id);
          Convo.getState().createConversation({
            id: this.conversation_id,
            summary: "",
          });
        } catch (error) {
            console.error("Error starting session:", error);
            this.cleanupResources();
            AppSettings.getState().setLoading(false);
            throw error;
        }
    }

    private setupDataChannelEventHandlers(): void {
        if (!this.dataChannel) return;

        // Handle data channel messages
        this.dataChannel.addEventListener('message', (e: MessageEvent) => {
            try {
                const message = JSON.parse(e.data);
                this.events.unshift(message);

                // if (message.type.includes('conversation')) {
                //     console.log(message.type)
                // }

                if (message.type === "input_audio_buffer.speech_started") {
                    this.callbacks.setMode('human');
                    this.updateMemory(message);
                }

                if (message.type === "response.created") {
                    this.callbacks.setMode('aispeaking');
                }


                if (message.type == "conversation.item.input_audio_transcription.completed") {

                    const finalTranscript = !message.transcript || message.transcript === "\n"
                        ? "[inaudible]"
                        : message.transcript;
                    if (this.conversation_id !== null) {
                        Convo.getState().setMessages({
                            id: message.response_id,
                            role: 'user',
                            content: finalTranscript,
                            timestamp: new Date().getTime(),
                            conversation_id: this.conversation_id,
                        })
                    }
                }



                if (message.type === "response.audio_transcript.done") {
                    this.updateMemory(message);

                    if (this.conversation_id !== null) {
                        Convo.getState().setMessages({
                            id: message.response_id,
                            role: 'system',
                            content: message.transcript,
                            timestamp: new Date().getTime(),
                            conversation_id: this.conversation_id,
                        })
                    }
                }


                // Handle function calls from the model
                if (message.type === "response.done" &&
                    message.response?.output &&
                    message.response.output.length > 0) {

                    const output = message.response.output;
                    for (const item of output) {
                        if (item.type === "function_call") {
                            console.log("Function call detected:", item.name);
                            this.handleFunctionCall(item);
                        }
                    }


                }
            } catch (error) {
                console.error("Error processing data channel message:", error);
            }
        });

        // Handle data channel open - this is the critical point for initialization
        this.dataChannel.addEventListener('open', () => {
            console.log("Data channel opened - setting session active");
            this.isSessionActive = true;
            this.events = [];

            // Enable speaker mode by default when starting session
            this.toggleSpeaker(true);
            // Sequential initialization with delays
            this.initializeSession();
        });

        // Add error handling
        this.dataChannel.addEventListener('error', (error: any) => {
            console.error("Data channel error:", error);
        });

        // Handle closing
        this.dataChannel.addEventListener('close', () => {
            console.log("Data channel closed");
            this.isSessionActive = false;
        });
    }

    private async initializeSession(): Promise<void> {
        try {
            // Step 1: Send system instructions first
            if (this.systemInstructions) {
                console.log("Sending system instructions");
                await this.sendWithDelay({
                    type: "session.update",
                    session: {
                        instructions: this.systemInstructions
                    }
                }, 0);
            }

            //Step 2: set vad mode

            this.setVadMode();

            // Step 2: Register functions after system instructions
            if (this.availableFunctions.length > 0) {
                this.registerFunctions(this.availableFunctions);
            }

            // Step 3: Send an initial greeting to establish context
            await this.sendWithDelay({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "system",
                    content: [{
                        type: "input_text",
                        text: "Session initialized. System is ready for interaction."
                    }],
                },

            }, 1000);

            this.sendClientEvent({ type: "response.create" })

            console.log("Session fully initialized");
            AppSettings.getState().setLoading(false);

        } catch (error) {
            console.error("Error during session initialization:", error);
            AppSettings.getState().setLoading(false);

        }
    }

    private async sendWithDelay(event: any, delayMs: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.sendClientEvent(event);
                resolve();
            }, delayMs);
        });
    }

    private async setVadMode(): Promise<void> {
        const eventServer = {
            "type": "session.update",
            "session": {
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                    "create_response": true, // only in conversation mode
                    "interrupt_response": true, // only in conversation mode
                }
            }
        }

        const eventSemantic = {
            "type": "session.update",
            "session": {
                "turn_detection": {
                    "type": "semantic_vad",
                    "eagerness": "auto", // optional
                    "create_response": true, // only in conversation mode
                    "interrupt_response": true, // only in conversation mode
                }

            }
        }

        await this.sendWithDelay(eventSemantic, 200);
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

    async stopSession(): Promise<void> {
        this.cleanupResources();
        this.callbacks.setMode('loading');
        if (this.conversation_id !== null) {
            const messages = Convo.getState().getConversationMessages(this.conversation_id)?.map((message) => message.content).join("\n")
            const summary = await summarizeConversation(messages || "")
            Convo.getState().updateConversation(this.conversation_id, summary || "")
        }
        console.log("Session stopped and resources cleaned up.");
    }

    private cleanupResources(): void {
        try {
            if (this.dataChannel) {
                if (this.dataChannel.readyState === 'open') {
                    this.dataChannel.close();
                }
                this.dataChannel = null;
            }

            if (this.peerConnection) {
                this.peerConnection.getSenders().forEach((sender) => {
                    if (sender.track) {
                        sender.track.stop();
                    }
                });
                this.peerConnection.close();
                this.peerConnection = null;
            }

            this.audioManager.cleanup();
            this.isSessionActive = false;
            this.connectionEstablished = false;

            console.log("Cleaned up previous session resources.");
        } catch (error) {
            console.error("Error during cleanup:", error);
        }
    }

    // Toggle speaker mode
    toggleSpeaker(speakerOn: boolean): void {
        console.log(`Toggling speaker mode to: ${speakerOn ? 'ON' : 'OFF'}`);
        this.audioManager.toggleSpeaker(speakerOn);
    }

    // Generate a UUID using the uuid package
    private generateUUID(): string {
        return uuidv4();
    }



    sendClientEvent(message: any): void {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                // Use our UUID generator instead of crypto.randomUUID()
                message.event_id = message.event_id || this.generateUUID();
                console.log("Sending client event:", message.type);

                // Stringify once to ensure valid JSON
                const jsonString = JSON.stringify(message);
                this.dataChannel.send(jsonString);

                this.events.unshift(message);
                this.updateMemory(message);
            } catch (error) {
                console.error("Error sending client event:", error);
            }
        } else {
            console.error("Data channel not available or not open",
                this.dataChannel ? `State: ${this.dataChannel.readyState}` : "No channel");
        }
    }

    sendTextMessage(message: string): void {
        // Check if session is active
        if (!this.isSessionActive) {
            console.error("Cannot send message - session not active");
            return;
        }

        try {
            const event = {
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: message }],
                },
                // memory: this.memory,
            };

            this.sendClientEvent(event);

            // Wait briefly before requesting a response
            setTimeout(() => {
                this.sendClientEvent({ type: "response.create" });
            }, 200);
        } catch (error) {
            console.error("Error sending text message:", error);
        }
    }

    updateSystemInstructions(instructions: string): void {
        console.log("Updating system instructions:", instructions);
        this.systemInstructions = instructions;

        if (this.isSessionActive) {
            // Unified approach for system instructions
            const event = {
                type: "session.update",
                session: {
                    instructions: instructions,
                    // Include both formats to ensure compatibility
                    system_message: {
                        content: instructions
                    }
                }
            };

            console.log("Sending system instructions event");
            this.sendClientEvent(event);

        } else {
            console.log("Session not active, instructions will be sent when session starts");
        }
    }

    registerFunctions(functions: FunctionParams[]): void {
        console.log("Registering functions:", functions.map(fn => fn.name).join(", "));
        this.availableFunctions = functions;

        if (this.isSessionActive) {

            const event = {
                type: "session.update",
                session: {
                    tools: functions.map(fn => ({
                        type: "function",
                        name: fn.name,
                        description: fn.description,
                        parameters: fn.parameters
                    })),
                    tool_choice: "auto"
                }
            };
            console.log("Sending function registration event");
            this.sendClientEvent(event);


        }
    }

    private async handleFunctionCall(functionCall: any): Promise<void> {
        console.log("Handling function call", functionCall.name)

        const { name, arguments: argsJson, call_id } = functionCall;
        try {
            // Find the registered function handler
            const functionDef = this.availableFunctions.find(fn => fn.name === name);

            if (!functionDef || !functionDef.handler) {
                throw new Error(`No handler found for function: ${name}`);
            }

            // Parse arguments - handle both string and object formats
            let args;
            if (typeof argsJson === 'string') {
                args = JSON.parse(argsJson);
            } else {
                args = argsJson;
            }

            console.log(`Executing function ${name} with args:`, args);

            if (this.conversation_id !== null) {
                Convo.getState().setMessages({
                    id: call_id,
                    role: 'tool',
                    content: "",
                    timestamp: new Date().getTime(),
                    conversation_id: this.conversation_id,
                    tool: {
                        owner: functionDef.owner,
                        status: "pending",
                        action: functionDef.name,
                        arguments: args,
                    }
                })
                this.functionMessageId = call_id;
            }

            // Execute the function
            const result = await functionDef.handler(args);
            console.log(`Function ${name} result:`, result);

            tracker.tool_calls(name, 1);
            // Send the result back to the model
            const resultEvent = {
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify(result)
                }
            };

            this.sendClientEvent(resultEvent);

            // Trigger a new response after a short delay
            setTimeout(() => {
                this.sendClientEvent({ type: "response.create" });
            }, 300);

        } catch (error: any) {
            console.error(`Error executing function ${name}:`, error);

            AppSettings.getState().setLoading(false);
            // Send error back to the model
            const errorEvent = {
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify({ error: `Error executing function: ${error.message}` })
                }
            };

            this.sendClientEvent(errorEvent);

            setTimeout(() => {
                this.sendClientEvent({ type: "response.create" });
            }, 300);
        }

        const userItem = UserItem.getState()
        const publicKey = WalletItem.getState().publicKey
        if (userItem.user && publicKey) {
            console.log("Updating user items")
            await setUserItems(userItem.user, userItem.updateUserWallet, publicKey, AppSettings.getState().network);
        }
    }

    addFunction(name: string, owner: any, description: string, parameters: any, handler: () => Promise<any>): void {
        const functionDef = {
            name,
            description,
            owner,
            parameters,
            handler
        };

        // Check for duplicate function names
        const existingIndex = this.availableFunctions.findIndex(fn => fn.name === name);
        if (existingIndex >= 0) {
            // Replace existing function
            this.availableFunctions[existingIndex] = functionDef;
        } else {
            // Add new function
            this.availableFunctions.push(functionDef);
        }

        // If session is active, update the available tools
        if (this.isSessionActive) {
            this.registerFunctions(this.availableFunctions);
        }
    }

    private async updateMemory(message: any): Promise<void> {
        this.memory.unshift(message);
        if (this.memory.length > this.memoryLimit) {
            this.memory.pop();
        }
        // Use AsyncStorage instead of localStorage
        try {
            await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.memory));
        } catch (error) {
            console.error("Error saving memory:", error);
        }
    }

    private async loadMemory(): Promise<any[]> {
        try {
            const storedMemory = await AsyncStorage.getItem(this.storageKey);
            return storedMemory ? JSON.parse(storedMemory) : [];
        } catch (error) {
            console.error("Error loading memory:", error);
            return [];
        }
    }

    // Check session state
    isActive(): boolean {
        return this.isSessionActive &&
            this.dataChannel &&
            this.dataChannel.readyState === 'open';
    }
}

export default SessionManager;