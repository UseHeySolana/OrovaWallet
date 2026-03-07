import { Connection } from "@solana/web3.js";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import "react-native-get-random-values"; // Required for crypto operations
import { v4 as uuidv4 } from "uuid"; // Import UUID v4 generator

import UserItem, { userWalletType } from "@/utils/store/userstore.store";
import { Audio } from "expo-av";
import AppSettings from "@/utils/store/settingsstore.store";
import Convo from "@/utils/store/conversation.store";
import { toolRouter } from "../tool-implemetation/toolsregistry";
import { FunctionParams } from "../../utils/types/types";

import { summarizeConversation } from "../../utils/functions/extrafunctions";
import { AgentContacts, delay, supportedTokens } from "../../utils/functions";
import setUserItems from "@/utils/dashboard";
import WalletItem from "@/utils/store/wallet.store";
import tracker from "../../utils/tracker";
import { request } from "../../utils/request/db";

import InCallManager from "react-native-incall-manager";
import AudioManager from "./AudioManager";

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
  public activeAiMessageId: string | null = null;
  public activeHumanMessageId: string | null = null;
  public token: string | null = null;
  private useAudioThisSession: boolean = true;
  /** Batched transcript deltas to avoid "Maximum update depth" from rapid store updates */
  private pendingHumanDeltas: string = "";
  private pendingAiDeltas: string = "";
  private flushHumanTimer: ReturnType<typeof setTimeout> | null = null;
  private flushAiTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FLUSH_MS = 80;
  /** Current in-flight response id; used to cancel and stop audio when user sends a new message */
  private currentResponseId: string | null = null;
  // public mode: 'loading' | 'human' | 'aispeaking' = 'loading'
  public callbacks: {
    setMode: (mode: "loading" | "human" | "aispeaking") => void;
    setConversationId: (id: string) => void;
  };

  constructor(
    public userDetails: userWalletType,
    public connection: Connection,
    callbacks: {
      setMode: (mode: "loading" | "human" | "aispeaking") => void;
      setConversationId: (id: string) => void;
    }
  ) {
    this.isSessionActive = false;
    this.events = [];
    this.memory = [];
    this.dataChannel = null;
    this.peerConnection = null;
    this.callbacks = callbacks;

    // Initialize audio manager
    this.audioManager = new AudioManager();

    // Load memory asynchronously
    this.loadMemory().then((memory) => {
      this.memory = memory;
    });
    // Pre-register functions but don't send them yet
    this.availableFunctions = toolRouter(this);
  }

  async getToken({ instructions }: { instructions: string }) {
    const url = "/open-token";
    const item = {
      prompt: instructions,
    };
    const tokenResponse = await request.postJson(item, url);
    const data = await tokenResponse.json();
    this.token = data.client_secret.value;
    return this.token;
  }

  async startSession(
    systemInstructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void> {
    const useAudio = options?.useAudio !== false;
    this.useAudioThisSession = useAudio;
    AppSettings.getState().setLoading(true);
    // Set system instructions if provided
    if (systemInstructions) {
      const sysIns = `
            These are the list of contacts I have on the App,
                ${JSON.stringify(AgentContacts())}
            \n
            These are the list of supported tokens for swaps,
                ${JSON.stringify(
                  supportedTokens
                )} always map the token to the correct symbol, correct with right spelling always if the token doesn't fall you can use as provided.

                \n 
                to swap first get the quote of the tokens and then respond to the user with the quote and then ask for confirmation to swap.
                \n
            always map the username i am interacting to any of these, correct with right spelling always if the username doesn't fall you can use as provided.
                \n
                Todo Items are always identified by the slug of the title of the todo item. if the user provides the id, you should use the slug of the title of the todo item as the id.
                \n
                 these are the list of sub tools supported and parameters,
                ${JSON.stringify(
                  toolRouter(this).map((item) => ({
                    toolName: item.name,
                    toolParameters: item.parameters,
                  }))
                )}.
                `;

      this.systemInstructions = systemInstructions + sysIns;
    }

    const EPHEMERAL_KEY = await this.getToken({
      instructions: "",
    });

    if (this.isSessionActive || this.peerConnection || this.dataChannel) {
      console.warn(
        "Previous session detected – cleaning up before starting a new one."
      );
      this.cleanupResources();
    }

    try {
      // API requires offer to include an audio media section, so we always request mic and add track.
      // In chat mode we still add the track (so the offer is valid) but disable VAD so the server only responds to text.
      if (Platform.OS === "android") {
        const granted = await this.requestAudioPermission();
        if (!granted) {
          throw new Error("Audio permission denied");
        }
      } else {
        const granted = await this.requestAudioPermission();
        if (!granted) {
          throw new Error("Audio permission denied");
        }
      }

      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Add STUN server for better connection
      });

      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, stream);
      });

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
      this.dataChannel = this.peerConnection.createDataChannel("oai-events", {
        ordered: true,
        maxRetransmits: 3,
      });

      // Setup event handlers before creating offer
      this.setupDataChannelEventHandlers();

      // API requires an audio media section in the offer; we always include it
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: useAudio, // only listen for voice in audio mode
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
            console.log("Audio track received - handling with AudioManager");
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

  private scheduleFlushHuman(): void {
    if (this.flushHumanTimer != null) return;
    this.flushHumanTimer = setTimeout(() => {
      this.flushHumanTimer = null;
      this.flushHumanNow();
    }, SessionManager.FLUSH_MS);
  }

  private cancelFlushHuman(): void {
    if (this.flushHumanTimer != null) {
      clearTimeout(this.flushHumanTimer);
      this.flushHumanTimer = null;
    }
  }

  private flushHumanNow(): void {
    if (!this.activeHumanMessageId || !this.pendingHumanDeltas) return;
    const toApply = this.pendingHumanDeltas;
    this.pendingHumanDeltas = "";
    const currentContent =
      Convo.getState()
        .getConversationMessages(this.conversation_id!)
        ?.find((item) => item.id === this.activeHumanMessageId)?.content ?? "";
    Convo.getState().updateMessage({
      messageId: this.activeHumanMessageId,
      content: { content: currentContent + toApply },
    });
  }

  private scheduleFlushAi(): void {
    if (this.flushAiTimer != null) return;
    this.flushAiTimer = setTimeout(() => {
      this.flushAiTimer = null;
      this.flushAiNow();
    }, SessionManager.FLUSH_MS);
  }

  private cancelFlushAi(): void {
    if (this.flushAiTimer != null) {
      clearTimeout(this.flushAiTimer);
      this.flushAiTimer = null;
    }
  }

  private flushAiNow(): void {
    if (!this.activeAiMessageId || !this.pendingAiDeltas) return;
    const toApply = this.pendingAiDeltas;
    this.pendingAiDeltas = "";
    const currentContent =
      Convo.getState()
        .getConversationMessages(this.conversation_id!)
        ?.find((item) => item.id === this.activeAiMessageId)?.content ?? "";
    Convo.getState().updateMessage({
      messageId: this.activeAiMessageId,
      content: { content: currentContent + toApply },
    });
  }

  private setupDataChannelEventHandlers(): void {
    if (!this.dataChannel) return;

    // Handle data channel messages
    this.dataChannel.addEventListener("message", (e: MessageEvent) => {
      try {
        const message = JSON.parse(e.data);
        this.events.unshift(message);

        if (this.conversation_id === null) {
          throw new Error("Conversation has not been set");
        }

        if (message.type === "input_audio_buffer.speech_started") {
          this.callbacks.setMode("human");
          this.updateMemory(message);
          // Create user message placeholder so it always appears before the AI response
          this.activeHumanMessageId =
            "temp" + new Date().getTime().toString();
          Convo.getState().setMessages({
            id: this.activeHumanMessageId,
            role: "user",
            content: "",
            timestamp: new Date().getTime(),
            conversation_id: this.conversation_id,
          });
        }

        if (message.type === "response.created") {
          this.currentResponseId = message.response?.id ?? null;
          this.callbacks.setMode("aispeaking");
        }

        if (
          message.type === "conversation.item.input_audio_transcription.delta"
        ) {
          if (this.activeHumanMessageId) {
            this.pendingHumanDeltas += message.delta ?? "";
            this.scheduleFlushHuman();
          } else {
            this.activeHumanMessageId =
              "temp" + new Date().getTime().toString();
            Convo.getState().setMessages({
              id: this.activeHumanMessageId,
              role: "user",
              content: message.delta ?? "",
              timestamp: new Date().getTime(),
              conversation_id: this.conversation_id,
            });
          }
        }

        if (
          message.type ==
          "conversation.item.input_audio_transcription.completed"
        ) {
          const finalTranscript =
            !message.transcript || message.transcript === "\n"
              ? "[inaudible]"
              : message.transcript;

          this.cancelFlushHuman();
          this.flushHumanNow();
          if (this.activeHumanMessageId) {
            Convo.getState().updateMessage({
              messageId: this.activeHumanMessageId,
              content: {
                content: finalTranscript,
              },
            });
            setTimeout(() => {
              this.activeHumanMessageId = null;
            }, 200);
          }
        }

        if (message.type === "response.audio_transcript.delta") {
          if (this.activeAiMessageId) {
            this.pendingAiDeltas += message.delta ?? "";
            this.scheduleFlushAi();
          } else {
            this.activeAiMessageId = "temp" + new Date().getTime().toString();
            Convo.getState().setMessages({
              id: this.activeAiMessageId,
              role: "system",
              content: message.delta ?? "",
              timestamp: new Date().getTime(),
              conversation_id: this.conversation_id,
            });
          }
        }

        if (message.type === "response.audio_transcript.done") {
          this.updateMemory(message);

          this.cancelFlushAi();
          this.flushAiNow();
          if (this.activeAiMessageId) {
            Convo.getState().updateMessage({
              messageId: this.activeAiMessageId,
              content: {
                content: message.transcript ?? "",
              },
            });
            setTimeout(() => {
              this.activeAiMessageId = null;
            }, 200);
          }
        }

        if (message.type === "response.done") {
          this.currentResponseId = null;
        }

        // Handle function calls from the model
        if (
          message.type === "response.done" &&
          message.response?.output &&
          message.response.output.length > 0
        ) {
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
    this.dataChannel.addEventListener("open", () => {
      console.log("Data channel opened - setting session active");
      this.isSessionActive = true;
      this.events = [];

      // Enable speaker mode by default when starting session
      this.toggleSpeaker(true);
      // Sequential initialization with delays
      this.initializeSession();
    });

    // Add error handling
    this.dataChannel.addEventListener("error", (error: any) => {
      console.error("Data channel error:", error);
    });

    // Handle closing
    this.dataChannel.addEventListener("close", () => {
      console.log("Data channel closed");
      this.isSessionActive = false;
    });
  }

  private async initializeSession(): Promise<void> {
    try {
      // Step 1: Send system instructions first
      if (this.systemInstructions) {
        console.log("Sending system instructions");
        await this.sendWithDelay(
          {
            type: "session.update",
            session: {
              instructions: this.systemInstructions,
            },
          },
          0
        );
      }

      // Step 2: set vad mode (only for voice sessions; chat uses text-only)
      this.setVadMode();

      // Step 2: Register functions after system instructions
      if (this.availableFunctions.length > 0) {
        this.registerFunctions(this.availableFunctions);
      }

      // Step 3: Send an initial greeting to establish context
      await this.sendWithDelay(
        {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Session initialized. System is ready for interaction.",
              },
            ],
          },
        },
        3000
      );

      this.sendClientEvent({ type: "response.create" });

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
    // Chat-only sessions: no voice activity detection; responses only via response.create
    if (!this.useAudioThisSession) {
      await this.sendWithDelay(
        {
          type: "session.update",
          session: {
            turn_detection: null as any, // disable VAD for text-only
          },
        },
        200
      );
      return;
    }
    const eventServer = {
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
          interrupt_response: true,
        },
      },
    };
    await this.sendWithDelay(eventServer, 200);
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
    this.callbacks.setMode("loading");
    if (this.conversation_id !== null) {
      const messages = Convo.getState()
        .getConversationMessages(this.conversation_id)
        ?.map((message) => message.content)
        .join("\n");
      const summary = await summarizeConversation(messages || "");
      Convo.getState().updateConversation(this.conversation_id, summary || "");
    }
    console.log("Session stopped and resources cleaned up.");
  }

  private cleanupResources(): void {
    try {
      if (this.dataChannel) {
        if (this.dataChannel.readyState === "open") {
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

      // Stop InCallManager
      InCallManager.stop();

      this.cancelFlushHuman();
      this.cancelFlushAi();
      this.pendingHumanDeltas = "";
      this.pendingAiDeltas = "";

      this.isSessionActive = false;
      this.connectionEstablished = false;
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  // Toggle speaker mode
  toggleSpeaker(speakerOn: boolean): void {
    this.audioManager.toggleSpeaker(speakerOn);
  }

  // Mute/unmute remote audio (speaker / what you hear)
  muteSpeaker(muted: boolean): void {
    this.audioManager.muteAudio(muted);
    if (!this.peerConnection) return;
    // Use receiver tracks so native playback is muted; prefer volume=0 (more reliable than track.enabled on some devices)
    this.peerConnection.getReceivers().forEach((receiver) => {
      const track = receiver.track;
      if (!track || track.kind !== "audio") return;
      if (typeof (track as any)._setVolume === "function") {
        (track as any)._setVolume(muted ? 0 : 1);
      } else {
        track.enabled = !muted;
      }
    });
  }

  // Mute/unmute local microphone
  muteMic(muted: boolean): void {
    if (!this.peerConnection) return;
    this.peerConnection.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === "audio") {
        sender.track.enabled = !muted;
      }
    });
  }

  // Generate a UUID using the uuid package
  private generateUUID(): string {
    return uuidv4();
  }

  sendClientEvent(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
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
      console.error(
        "Data channel not available or not open",
        this.dataChannel
          ? `State: ${this.dataChannel.readyState}`
          : "No channel"
      );
    }
  }

  sendTextMessage(message: string): void {
    // Check if session is active
    if (!this.isSessionActive) {
      console.error("Cannot send message - session not active");
      return;
    }

    try {
      // When user sends a new message: stop current AI audio and cancel in-flight response
      // so we move to the new item and the new response's audio plays instead.
      if (this.currentResponseId) {
        this.sendClientEvent({
          type: "response.cancel",
          response_id: this.currentResponseId,
        });
        this.sendClientEvent({ type: "output_audio_buffer.clear" });
        this.currentResponseId = null;
      }

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
    this.systemInstructions = instructions;

    if (this.isSessionActive) {
      // Unified approach for system instructions
      const event = {
        type: "session.update",
        session: {
          instructions: instructions,
          // Include both formats to ensure compatibility
          system_message: {
            content: instructions,
          },
        },
      };

      console.log("Sending system instructions event", instructions);
      this.sendClientEvent(event);
    } else {
      console.error(
        "Session not active, instructions will be sent when session starts"
      );
    }
  }

  registerFunctions(functions: FunctionParams[]): void {
    this.availableFunctions = functions;

    if (this.isSessionActive) {
      const event = {
        type: "session.update",
        session: {
          tools: functions.map((fn) => ({
            type: "function",
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          })),
          tool_choice: "auto",
        },
      };
      this.sendClientEvent(event);
    }
  }

  private async handleFunctionCall(functionCall: any): Promise<void> {
    const { name, arguments: argsJson, call_id } = functionCall;
    try {
      // Find the registered function handler
      const functionDef = this.availableFunctions.find(
        (fn) => fn.name === name
      );

      if (!functionDef || !functionDef.handler) {
        throw new Error(`No handler found for function: ${name}`);
      }

      // Parse arguments - handle both string and object formats
      let args;
      if (typeof argsJson === "string") {
        args = JSON.parse(argsJson);
      } else {
        args = argsJson;
      }

      console.log(`Executing function ${name} with args:`, args, functionCall);

      if (this.conversation_id !== null) {
        Convo.getState().setMessages({
          id: call_id,
          role: "tool",
          content: "",
          timestamp: new Date().getTime(),
          conversation_id: this.conversation_id,
          tool: {
            owner: functionDef.owner,
            status: "pending",
            action: functionDef.name,
            arguments: args,
          },
        });
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
          output: JSON.stringify(result),
        },
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
          output: JSON.stringify({
            error: `Error executing function: ${error.message}`,
          }),
        },
      };

      this.sendClientEvent(errorEvent);

      setTimeout(() => {
        this.sendClientEvent({ type: "response.create" });
      }, 300);
    }

    const userItem = UserItem.getState();
    const publicKey = WalletItem.getState().publicKey;
    if (userItem.user && publicKey) {
      await setUserItems(
        userItem.user,
        userItem.updateUserWallet,
        publicKey,
        AppSettings.getState().network
      );
    }
  }

  addFunction(
    name: string,
    owner: any,
    description: string,
    parameters: any,
    handler: () => Promise<any>
  ): void {
    const functionDef = {
      name,
      description,
      owner,
      parameters,
      handler,
    };

    // Check for duplicate function names
    const existingIndex = this.availableFunctions.findIndex(
      (fn) => fn.name === name
    );
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
    return (
      this.isSessionActive &&
      this.dataChannel &&
      this.dataChannel.readyState === "open"
    );
  }
}

export default SessionManager;
