
import { Connection } from "@solana/web3.js";
import {
    mediaDevices,
    MediaStream
} from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import GeminiAudioManager from './GeminiAudioManager';
import { userWalletType } from "@/misc/store/userstore";
import { Audio } from "expo-av";
import { toolFunctions } from "../tools";

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
    private isSessionActive: boolean;
    private events: any[];
    private ws: WebSocket | null;
    private memory: any[];
    private memoryLimit: number = 7;
    private storageKey: string = "gemini_session_memory";
    private systemInstructions: string = "";
    private availableFunctions: GeminiToolFunction[] = [];
    private connectionEstablished: boolean = false;
    private apiKey: string = "";
    private clientId: string;
    private audioStream: MediaStream | null = null;
    private audioEnabled: boolean = true;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(public userDetails: userWalletType, public connection: Connection) {
        this.isSessionActive = false;
        this.events = [];
        this.memory = [];
        this.ws = null;
        this.clientId = uuidv4();


        // Load memory asynchronously
        this.loadMemory().then(memory => {
            this.memory = memory || [];
        });

        // Pre-register functions but don't send them yet
        // this.availableFunctions = toolFunctions(this);
    }

    async startSession(systemInstructions?: string): Promise<void> {
        // Reset connection state
        this.reconnectAttempts = 0;

        // Set system instructions if provided
        if (systemInstructions) {
            this.systemInstructions = systemInstructions;
        }

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

           

            // Get audio stream for sending
            const stream = await mediaDevices.getUserMedia({ audio: true });
            this.audioStream = stream;

            // Establish WebSocket connection
            await this.connectWebSocket();

            console.log("Session started and ready for interaction.");
        } catch (error) {
            console.error("Error starting session:", error);
            this.cleanupResources();
            throw error;
        }
    }

    private _sendDirect (request: object) {
        if (!this.ws) {
            throw new Error("WebSocket is not connected");
        }
        const str = JSON.stringify(request);
        console.log(str);
        this.ws.send(str);
    }


    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Close existing connection if any
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }

                const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
                this.ws = new WebSocket(wsUrl);

                // Establish WebSocket connection


                // Setup connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                        this.ws.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000); // 10 seconds timeout

                // Setup WebSocket event handlers
                this.ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log("WebSocket connection opened");
                    this.connectionEstablished = true;
                    this.isSessionActive = true;
                    this.reconnectAttempts = 0;

                    // Send setup message
                    // this.sendSetupMessage();
                    resolve();
                };

                this.setupWebSocketHandlers();

                this.ws.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    console.error("WebSocket error:", error);
                    this.attemptReconnect();
                    reject(error);
                };
            } catch (error) {
                console.error("Error establishing WebSocket connection:", error);
                reject(error);
            }
        });
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log("Max reconnect attempts reached, giving up");
            this.cleanupResources();
            return;
        }

        this.reconnectAttempts++;
        const backoffTime = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

        console.log(`Attempting to reconnect in ${backoffTime / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket().catch(error => {
                console.error("Reconnection failed:", error);
            });
        }, backoffTime);
    }

    private async getApiKey(): Promise<string> {
        // Try to get from environment first
        const envKey = process.env.EXPO_PUBLIC_GA_KEY;
        return envKey || "";
    }

    private setupWebSocketHandlers(): void {
        if (!this.ws) return;

        this.ws.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                this.events.unshift(response);
                this.updateMemory(response);

                // Handle different types of messages
                if (response.serverContent && response.serverContent.modelTurn) {
                    this.handleModelTurnMessage(response.serverContent.modelTurn);
                } else if (response.toolCall) {
                    this.handleToolCallMessage(response.toolCall);
                } else if (response.setupComplete) {
                    console.log("Setup complete");
                    // Register functions after setup is complete
                    if (this.availableFunctions.length > 0) {
                        this.registerFunctions(this.availableFunctions);
                    }
                    // Send system instructions after setup
                    if (this.systemInstructions) {
                        this.sendSystemInstructions();
                    }
                } else if (response.serverContent && response.serverContent.interrupted) {
                    console.log("Response interrupted");
                } else if (response.serverContent && response.serverContent.turnComplete) {
                    console.log("Turn complete");
                } else if (response.error) {
                    console.error("Gemini API error:", response.error);
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket closed: ${event.code} ${event.reason}`);
            this.isSessionActive = false;
            this.connectionEstablished = false;

            // Don't attempt to reconnect if this was a clean close
            if (event.code !== 1000) {
                this.attemptReconnect();
            }
        };
    }

    private sendSetupMessage(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Create and send setup message
        const setupMessage = {
            setup: {
                model: "models/gemini-2.0-flash-exp",
                // generationConfig: {
                //     temperature: 0.7,
                //     topP: 0.95,
                //     topK: 40,
                // },
                tools: this.availableFunctions.map(fn => ({
                    functionDeclarations: [{
                        name: fn.name,
                        description: fn.description,
                        parameters: fn.parameters
                    }]
                }))
            }
        };

        this._sendDirect(setupMessage);
    }

    private sendSystemInstructions(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const systemMessage = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{
                        text: `System Instructions: ${this.systemInstructions}`
                    }],
                }],
                turnComplete: true
            }
        };

        this.ws.send(JSON.stringify(systemMessage));
    }

    private async handleModelTurnMessage(modelTurn: any): Promise<void> {
        if (!modelTurn.parts || !modelTurn.parts.length) return;

        // Process text responses
        const textParts = modelTurn.parts.filter((part: any) => part.text);
        if (textParts.length > 0) {
            const textResponse = textParts.map((part: any) => part.text).join("");
            console.log("Text response:", textResponse);

            // Emit an event for the UI to update
            // You might want to implement an event emitter to handle this
            // this.emitter.emit('textResponse', textResponse);
        }

        // Process audio responses
        const audioParts = modelTurn.parts.filter(
            (part: any) => part.inlineData && part.inlineData.mimeType.startsWith("audio/")
        );

        for (const part of audioParts) {
            if (part.inlineData && part.inlineData.data) {
                try {
                    // Convert base64 to ArrayBuffer and play audio
                    const audioBuffer = this.base64ToArrayBuffer(part.inlineData.data);
                    // await this.audioManager.playAudioFromArrayBuffer(audioBuffer);
                } catch (error) {
                    console.error("Error playing audio:", error);
                }
            }
        }
    }

    private handleToolCallMessage(toolCall: any): void {
        if (!toolCall || !toolCall.functionCall) {
            console.error("Invalid tool call format:", toolCall);
            return;
        }

        const { name, args } = toolCall.functionCall;
        const id = toolCall.callId || uuidv4(); // Ensure we have an ID for the response

        console.log(`Tool call received: ${name}`, args);

        // Find the registered function handler
        const functionDef = this.availableFunctions.find(fn => fn.name === name);
        if (!functionDef || !functionDef.handler) {
            console.error(`No handler found for function: ${name}`);
            this.sendToolResponse(id, { error: `Function ${name} not found` });
            return;
        }

        // Parse arguments if they're a string
        let parsedArgs = args;
        if (typeof args === 'string') {
            try {
                parsedArgs = JSON.parse(args);
            } catch (e) {
                console.warn("Could not parse args as JSON, using as is:", args);
            }
        }

        // Execute the function
        Promise.resolve()
            .then(() => functionDef.handler(parsedArgs))
            .then(result => {
                this.sendToolResponse(id, result);
            })
            .catch(error => {
                console.error(`Error executing function ${name}:`, error);
                this.sendToolResponse(id, { error: error.message || "Unknown error" });
            });
    }

    private sendToolResponse(callId: string, result: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        let responseObj = result;

        // If result is not an object, wrap it
        if (typeof result !== 'object' || result === null) {
            responseObj = { result };
        }

        // Format for Gemini API
        const response = {
            functionResponse: {
                callId: callId,
                response: {
                    name: "functionResponse",
                    content: JSON.stringify(responseObj)
                }
            }
        };

        this.ws.send(JSON.stringify(response));
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
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
        // Clear reconnect timeout if any
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Close WebSocket
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close(1000, "Session closed by user");
            }
            this.ws = null;
        }

        // Stop audio tracks
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Clean up audio resources
        // this.audioManager.cleanup();

        this.isSessionActive = false;
        this.connectionEstablished = false;
    }

    // Toggle speaker mode
    toggleSpeaker(speakerOn: boolean): void {
        console.log(`Toggling speaker mode to: ${speakerOn ? 'ON' : 'OFF'}`);
        // this.audioManager.toggleSpeaker(speakerOn);
    }

    // Toggle audio input
    toggleAudio(enabled: boolean): void {
        if (this.audioStream) {
            this.audioStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
            this.audioEnabled = enabled;
            console.log(`Audio input ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    sendTextMessage(message: string): void {
        // Check if session is active
        if (!this.isSessionActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("Cannot send message - session not active");
            return;
        }

        try {
            const clientMessage = {
                clientContent: {
                    turns: [{
                        role: "user",
                        parts: [{ text: message }]
                    }
                    ],
                    turnComplete: true
                }
            };

            this.ws.send(JSON.stringify(clientMessage));
            this.events.unshift(clientMessage);
            this.updateMemory(clientMessage);
        } catch (error) {
            console.error("Error sending text message:", error);
        }
    }

    sendRealtimeInput(chunks: Array<{ data: string, mimeType: string }>): void {
        if (!this.isSessionActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("Cannot send realtime input - session not active");
            return;
        }

        try {
            const realtimeMessage = {
                realtimeInput: {
                    mediaChunks: chunks.map(chunk => ({
                        data: chunk.data,
                        mimeType: chunk.mimeType
                    }))
                }
            };

            this.ws.send(JSON.stringify(realtimeMessage));
        } catch (error) {
            console.error("Error sending realtime input:", error);
        }
    }

    updateSystemInstructions(instructions: string): void {
        console.log("Updating system instructions:", instructions);
        this.systemInstructions = instructions;

        if (this.isSessionActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendSystemInstructions();
        } else {
            console.log("Session not active, instructions will be sent when session starts");
        }
    }

    registerFunctions(functions: GeminiToolFunction[]): void {
        console.log("Registering functions:", functions.map(fn => fn.name).join(", "));
        this.availableFunctions = [...functions];

        if (this.isSessionActive && this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send function declarations message
            const toolsMessage = {
                toolConfig: {
                    tools: functions.map(fn => ({
                        functionDeclarations: [{
                            name: fn.name,
                            description: fn.description,
                            parameters: fn.parameters
                        }]
                    }))
                }
            };

            this.ws.send(JSON.stringify(toolsMessage));
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
        // Only store important messages
        if (this.shouldStoreInMemory(message)) {
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
    }

    private shouldStoreInMemory(message: any): boolean {
        // Only store substantial messages (user inputs and model outputs)
        return (
            (message.clientContent && (message.clientContent.parts || message.clientContent.turns)) ||
            (message.serverContent && message.serverContent.modelTurn)
        );
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

    clearMemory(): Promise<void> {
        this.memory = [];
        return AsyncStorage.removeItem(this.storageKey);
    }

    // Check session state
    isActive(): boolean {
        return this.isSessionActive &&
            this.ws !== null &&
            this.ws.readyState === WebSocket.OPEN;
    }
}

export default GeminiSessionManager;



