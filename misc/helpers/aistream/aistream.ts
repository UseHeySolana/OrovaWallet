// import { Connection } from "@solana/web3.js";
// import {
//     RTCPeerConnection,
//     RTCSessionDescription,
//     mediaDevices,
//     MediaStream
// } from 'react-native-webrtc';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Platform } from 'react-native';
// import 'react-native-get-random-values'; // Required for crypto.randomUUID()
// import AudioManager from './AudioManager';
// import { userWalletType } from "@/misc/store/userstore";
// import { toolFunctions } from "../tools";
// import { Audio } from "expo-av";

// class SessionManager {
//     private isSessionActive: boolean;
//     private events: any[];
//     private dataChannel: any | null; // RTCDataChannel equivalent
//     private peerConnection: RTCPeerConnection | null;
//     private audioManager: AudioManager;
//     private memory: any[];
//     private memoryLimit: number = 7;
//     private storageKey: string = "ai_session_memory";
//     private systemInstructions: string = "";
//     private availableFunctions: any[] = [];

//     constructor(public userDetails: userWalletType, public connection: Connection) {
//         this.isSessionActive = false;
//         this.events = [];
//         this.memory = [];
//         this.dataChannel = null;
//         this.peerConnection = null;

//         // Initialize audio manager
//         this.audioManager = new AudioManager();

//         // Load memory asynchronously
//         this.loadMemory().then(memory => {
//             this.memory = memory;
//         });

//         this.registerFunctions(toolFunctions(this));
//     }

//     async startSession(systemInstructions?: string): Promise<void> {
//         // Set system instructions if provided
//         if (systemInstructions) {
//             this.systemInstructions = systemInstructions;
//         }

//         try {
//             // Request permissions first (important for React Native)
//             if (Platform.OS === 'android') {
//                 const granted = await this.requestAudioPermission();
//                 if (!granted) {
//                     throw new Error('Audio permission denied');
//                 }
//             }
//             // 192.168.128.141
//             const tokenResponse = await fetch("http://192.168.128.141:3001/api/open-token");
//             const data = await tokenResponse.json();
//             const EPHEMERAL_KEY: string = data.client_secret.value;

//             this.peerConnection = new RTCPeerConnection();

//             // Get media stream (different in React Native)
//             const stream = await mediaDevices.getUserMedia({ audio: true });

//             // Add tracks to peer connection
//             stream.getTracks().forEach(track => {
//                 this.peerConnection!.addTrack(track, stream);
//             });

//             // Create data channel
//             this.dataChannel = this.peerConnection.createDataChannel("oai-events");

//             // Create offer with required options parameter
//             const offer = await this.peerConnection.createOffer({
//                 offerToReceiveAudio: true,
//                 offerToReceiveVideo: false,
//                 voiceActivityDetection: true
//             });
//             await this.peerConnection.setLocalDescription(offer);

//             // Send offer to API
//             const baseUrl = "https://api.openai.com/v1/realtime";
//             const model = "gpt-4o-realtime-preview-2024-12-17";
//             const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
//                 method: "POST",
//                 body: offer.sdp,
//                 headers: {
//                     Authorization: `Bearer ${EPHEMERAL_KEY}`,
//                     "Content-Type": "application/sdp",
//                 },
//             });

//             // Set remote description
//             const answerSdp = await sdpResponse.text();
//             const answer = new RTCSessionDescription({ type: "answer", sdp: answerSdp });
//             await this.peerConnection.setRemoteDescription(answer);

//             // Handle data channel messages
//             this.dataChannel.addEventListener('message', (e: any) => {
//                 const message = JSON.parse(e.data);
//                 this.events.unshift(message);
//                 this.updateMemory(message);

//                 if (message.type === "response.audio_transcript.done") {
//                     console.log(message.transcript);
//                 }

//                 // Handle function calls from the model
//                 if (message.type === "response.done" &&
//                     message.response?.output &&
//                     message.response.output.length > 0 &&
//                     message.response.output[0].type === "function_call") {
//                     console.log("function call");
//                     this.handleFunctionCall(message.response.output[0]);
//                 }
//             });

//             // Handle data channel open
//             this.dataChannel.addEventListener('open', () => {
//                 console.log("Data channel opened - setting session active");
//                 this.isSessionActive = true;
//                 this.events = [];

//                 // Send system instructions when connection opens with a small delay
//                 if (this.systemInstructions) {
//                     console.log("Will send system instructions after delay");
//                     setTimeout(() => {
//                         console.log("Sending delayed system instructions");
//                         this.updateSystemInstructions(this.systemInstructions);
//                     }, 500);
//                 } else {
//                     console.log("No system instructions to send");
//                 }

//                 // Register available functions if any
//                 if (this.availableFunctions.length > 0) {
//                     console.log("Registering available functions");
//                     this.registerFunctions(this.availableFunctions);
//                 }

//                 // Enable speaker mode by default when starting session
//                 this.toggleSpeaker(true);
//             });

//             // Handle audio tracks with our AudioManager
//             this.peerConnection.addEventListener('track', (event) => {
//                 console.log("Track event received:", event.track?.kind);
//                 if (event.streams && event.streams[0]) {
//                     // Only handle audio tracks
//                     if (event.track && event.track.kind === 'audio') {
//                         console.log("Audio track received - handling with AudioManager");
//                         this.audioManager.handleRemoteStream(event.streams[0]);
//                     }
//                 }
//             });

//             console.log("Session started and ready for audio streaming.");
//         } catch (error) {
//             console.error("Error starting session:", error);
//             throw error;
//         }
//     }

//     private async requestAudioPermission(): Promise<boolean> {
//         try {
//             // Using Expo's permission API
//             const { status } = await Audio.getPermissionsAsync();
//             if (status !== "granted") {
//                 await Audio.requestPermissionsAsync();
//             }
//             return true;
//         } catch (error) {
//             console.error("Error requesting audio permission:", error);
//             return false;
//         }
//     }

//     stopSession(): void {
//         if (this.dataChannel) this.dataChannel.close();
//         if (this.peerConnection) {
//             this.peerConnection.getSenders().forEach((sender) => {
//                 if (sender.track) sender.track.stop();
//             });
//             this.peerConnection.close();
//         }

//         // Clean up audio resources
//         this.audioManager.cleanup();

//         this.isSessionActive = false;
//         this.dataChannel = null;
//         this.peerConnection = null;
//     }

//     // Toggle speaker mode
//     toggleSpeaker(speakerOn: boolean): void {
//         console.log(`Toggling speaker mode to: ${speakerOn ? 'ON' : 'OFF'}`);
//         this.audioManager.toggleSpeaker(speakerOn);
//     }

//     // Rest of SessionManager methods remain the same...
//     sendClientEvent(message: any): void {
//         if (this.dataChannel && this.dataChannel.readyState === 'open') {
//             message.event_id = message.event_id || crypto.randomUUID();
//             console.log("Sending client event:", message.type);
//             this.dataChannel.send(JSON.stringify(message));
//             this.events.unshift(message);
//             this.updateMemory(message);
//         } else {
//             console.error("No data channel available or not open", message);
//         }
//     }

//     sendTextMessage(message: string): void {
//         const event = {
//             type: "conversation.item.create",
//             item: {
//                 type: "message",
//                 role: "user",
//                 content: [{ type: "input_text", text: message }],
//             },
//             memory: this.memory,
//         };
//         this.sendClientEvent(event);
//         this.sendClientEvent({ type: "response.create" });
//     }

//     updateSystemInstructions(instructions: string): void {
//         console.log("Updating system instructions:", instructions);
//         this.systemInstructions = instructions;

//         if (this.isSessionActive) {
//             // Try both formats for system instructions
//             console.log("Session is active, sending system instructions");

//             // Format 1: Using the 'instructions' field
//             const event1 = {
//                 type: "session.update",
//                 session: {
//                     instructions: instructions
//                 }
//             };
//             console.log("Sending system instructions event (format 1):", event1);
//             this.sendClientEvent(event1);

//             // Format 2: Using the 'system_message' field (alternative format)
//             setTimeout(() => {
//                 const event2 = {
//                     type: "session.update",
//                     session: {
//                         system_message: {
//                             content: instructions
//                         }
//                     }
//                 };
//                 console.log("Sending system instructions event (format 2):", event2);
//                 this.sendClientEvent(event2);
//             }, 500);
//         } else {
//             console.log("Session not active, instructions will be sent when session starts");
//         }
//     }

//     registerFunctions(functions: any[]): void {
//         console.log("Registering functions:", functions.map(fn => fn.name).join(", "));
//         this.availableFunctions = functions;

//         if (this.isSessionActive) {
//             const event = {
//                 type: "session.update",
//                 session: {
//                     tools: functions.map(fn => ({
//                         type: "function",
//                         name: fn.name,
//                         description: fn.description,
//                         parameters: fn.parameters
//                     })),
//                     tool_choice: "auto"
//                 }
//             };
//             console.log("Sending function registration event");
//             this.sendClientEvent(event);
//         }
//     }

//     private async handleFunctionCall(functionCall: any): Promise<void> {
//         const { name, arguments: argsJson, call_id } = functionCall;
//         console.log(`Function call received: ${name}`, argsJson);

//         try {
//             // Find the registered function handler
//             const functionDef = this.availableFunctions.find(fn => fn.name === name);

//             if (!functionDef || !functionDef.handler) {
//                 throw new Error(`No handler found for function: ${name}`);
//             }

//             // Parse arguments
//             const args = JSON.parse(argsJson);

//             // Execute the function
//             const result = await functionDef.handler(args);

//             // Send the result back to the model
//             const resultEvent = {
//                 type: "conversation.item.create",
//                 item: {
//                     type: "function_call_output",
//                     call_id: call_id,
//                     output: JSON.stringify(result)
//                 }
//             };

//             this.sendClientEvent(resultEvent);

//             // Trigger a new response
//             this.sendClientEvent({ type: "response.create" });

//         } catch (error: any) {
//             console.error(`Error executing function ${name}:`, error);

//             // Send error back to the model
//             const errorEvent = {
//                 type: "conversation.item.create",
//                 item: {
//                     type: "function_call_output",
//                     call_id: call_id,
//                     output: JSON.stringify({ error: `Error executing function: ${error.message}` })
//                 }
//             };

//             this.sendClientEvent(errorEvent);
//             this.sendClientEvent({ type: "response.create" });
//         }
//     }

//     addFunction(name: string, description: string, parameters: any, handler: Function): void {
//         const functionDef = {
//             name,
//             description,
//             parameters,
//             handler
//         };

//         this.availableFunctions.push(functionDef);

//         // If session is active, update the available tools
//         if (this.isSessionActive) {
//             this.registerFunctions(this.availableFunctions);
//         }
//     }

//     private async updateMemory(message: any): Promise<void> {
//         this.memory.unshift(message);
//         if (this.memory.length > this.memoryLimit) {
//             this.memory.pop();
//         }
//         // Use AsyncStorage instead of localStorage
//         try {
//             await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.memory));
//         } catch (error) {
//             console.error("Error saving memory:", error);
//         }
//     }

//     private async loadMemory(): Promise<any[]> {
//         try {
//             const storedMemory = await AsyncStorage.getItem(this.storageKey);
//             return storedMemory ? JSON.parse(storedMemory) : [];
//         } catch (error) {
//             console.error("Error loading memory:", error);
//             return [];
//         }
//     }
// }

// export default SessionManager;

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
import { userWalletType } from "@/misc/store/userstore";
import { toolFunctions } from "../tools";
import { Audio } from "expo-av";
import AppSettings from "@/misc/store/settingsstore";

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
    private availableFunctions: any[] = [];
    private connectionEstablished: boolean = false;

    constructor(public userDetails: userWalletType, public connection: Connection) {
        this.isSessionActive = false;
        this.events = [];
        this.memory = [];
        this.dataChannel = null;
        this.peerConnection = null;

        // Initialize audio manager
        this.audioManager = new AudioManager();

        // Load memory asynchronously
        this.loadMemory().then(memory => {
            this.memory = memory;
        });

        // Pre-register functions but don't send them yet
        this.availableFunctions = toolFunctions(this);
    }

    async startSession(systemInstructions?: string): Promise<void> {
        // Set system instructions if provided
        if (systemInstructions) {
            this.systemInstructions = systemInstructions;
        }

        try {
            // Request permissions first (important for React Native)
            if (Platform.OS === 'android') {
                const granted = await this.requestAudioPermission();
                if (!granted) {
                    throw new Error('Audio permission denied');
                }
            }

            //check if token is available then create
            const ek = AppSettings.getState().ek;

            let EPHEMERAL_KEY:string;
            function isClientSecretExpired(date:number) {
                const currentTime = Math.floor(Date.now() / 1000); // Get current time in seconds
                return date <= currentTime;
            }

            console.log(new Date().getSeconds())
            if(ek.value === "" || isClientSecretExpired(ek.expiry)){
                const tokenResponse = await fetch("http://192.168.128.141:3001/api/open-token");
                const data = await tokenResponse.json();
                EPHEMERAL_KEY = data.client_secret.value;
                AppSettings.setState({ek:{value:data.client_secret.value, expiry:data.client_secret.expires_at}})
            }else{
                EPHEMERAL_KEY = AppSettings.getState().ek.value;
            }

        
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Add STUN server for better connection
            });

            // Get media stream (different in React Native)
            const stream = await mediaDevices.getUserMedia({ audio: true });

            // Add tracks to peer connection
            stream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, stream);
            });

            // Setup connection state tracking
            this.peerConnection.addEventListener('connectionstatechange', () => {
                console.log(`Connection state changed: ${this.peerConnection?.connectionState}`);
                if (this.peerConnection?.connectionState === 'connected') {
                    this.connectionEstablished = true;
                }
            });

            // Create data channel with more reliable options
            this.dataChannel = this.peerConnection.createDataChannel("oai-events", {
                ordered: true,
                maxRetransmits: 3
            });

            // Setup event handlers before creating offer
            this.setupDataChannelEventHandlers();

            // Create offer with required options parameter
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
                voiceActivityDetection: true
            });
            await this.peerConnection.setLocalDescription(offer);

            // Send offer to API
            const baseUrl = "https://api.openai.com/v1/realtime";
            const model = "gpt-4o-realtime-preview-2024-12-17";
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
            const answer = new RTCSessionDescription({ type: "answer", sdp: answerSdp });
            await this.peerConnection.setRemoteDescription(answer);

            // Handle audio tracks with our AudioManager
            this.peerConnection.addEventListener('track', (event) => {
                console.log("Track event received:", event.track?.kind);
                if (event.streams && event.streams[0]) {
                    // Only handle audio tracks
                    if (event.track && event.track.kind === 'audio') {
                        console.log("Audio track received - handling with AudioManager");
                        this.audioManager.handleRemoteStream(event.streams[0]);
                    }
                }
            });

            console.log("Session started and ready for audio streaming.");
        } catch (error) {
            console.error("Error starting session:", error);
            this.cleanupResources();
            throw error;
        }
    }

    private setupDataChannelEventHandlers(): void {
        if (!this.dataChannel) return;

        // Handle data channel messages
        this.dataChannel.addEventListener('message', (e: any) => {
            try {
                const message = JSON.parse(e.data);
                this.events.unshift(message);
                this.updateMemory(message);

                if (message.type === "response.audio_transcript.done") {
                    console.log("Transcript:", message.transcript);
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

            // Step 2: Register functions after system instructions
            if (this.availableFunctions.length > 0) {
                console.log("Registering available functions");
                await this.sendWithDelay({
                    type: "session.update",
                    session: {
                        tools: this.availableFunctions.map(fn => ({
                            type: "function",
                            name: fn.name,
                            description: fn.description,
                            parameters: fn.parameters
                        })),
                        tool_choice: "auto"
                    }
                }, 500);
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
                }
            }, 1000);

            console.log("Session fully initialized");
        } catch (error) {
            console.error("Error during session initialization:", error);
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

    stopSession(): void {
        this.cleanupResources();
    }

    private cleanupResources(): void {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        if (this.peerConnection) {
            this.peerConnection.getSenders().forEach((sender) => {
                if (sender.track) sender.track.stop();
            });
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Clean up audio resources
        this.audioManager.cleanup();

        this.isSessionActive = false;
        this.connectionEstablished = false;
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
                memory: this.memory,
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

            // Send a trigger for the model to acknowledge the new instructions
            setTimeout(() => {
                this.sendClientEvent({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: "system",
                        content: [{
                            type: "input_text",
                            text: "System instructions have been updated."
                        }],
                    }
                });

                this.sendClientEvent({ type: "response.create" });
            }, 500);
        } else {
            console.log("Session not active, instructions will be sent when session starts");
        }
    }

    registerFunctions(functions: any[]): void {
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

            // Confirm function registration
            setTimeout(() => {
                this.sendClientEvent({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: "system",
                        content: [{
                            type: "input_text",
                            text: `${functions.length} functions have been registered.`
                        }],
                    }
                });

                this.sendClientEvent({ type: "response.create" });
            }, 500);
        }
    }

    private async handleFunctionCall(functionCall: any): Promise<void> {
        const { name, arguments: argsJson, call_id } = functionCall;
        console.log(`Function call received: ${name}`, argsJson);

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

            // Execute the function
            const result = await functionDef.handler(args);
            console.log(`Function ${name} result:`, result);

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
    }

    addFunction(name: string, description: string, parameters: any, handler: Function): void {
        const functionDef = {
            name,
            description,
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