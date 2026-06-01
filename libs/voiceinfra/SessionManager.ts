import { Connection } from "@solana/web3.js";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
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
import { AgentContacts } from "../../utils/functions";
import setUserItems from "@/utils/dashboard";
import WalletItem from "@/utils/store/wallet.store";
import tracker from "../../utils/tracker";
import { request } from "../../utils/request/db";
import { pushDevNetworkLog } from "@/utils/store/devNetworkLog.store";

import InCallManager from "react-native-incall-manager";
import AudioManager from "./AudioManager";

class SessionManager {
  private static readonly REALTIME_MODEL = "gpt-realtime-mini";
  private static readonly SESSION_UPDATE_TIMEOUT_MS = 10_000;

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
  /** When false (chat mode): text input only, no VAD; audio output still enabled. */
  private useVoiceInputThisSession: boolean = true;
  private sessionReadyResolve: (() => void) | null = null;
  private sessionReadyReject: ((err: Error) => void) | null = null;
  private sessionReadyPromise: Promise<void> | null = null;
  private startSessionPromise: Promise<void> | null = null;
  private sessionGeneration = 0;
  /** Batched transcript deltas to avoid "Maximum update depth" from rapid store updates */
  private pendingHumanDeltas: string = "";
  private pendingAiDeltas: string = "";
  private flushHumanTimer: ReturnType<typeof setTimeout> | null = null;
  private flushAiTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly FLUSH_MS = 80;
  /** Current in-flight response id; used to cancel and stop audio when user sends a new message */
  private currentResponseId: string | null = null;
  /** Enhanced response state tracking */
  private responseState: {
    id: string | null;
    status: 'creating' | 'in_progress' | 'completed' | 'cancelled' | null;
    audioItemId: string | null;
  } = { id: null, status: null, audioItemId: null };
  /** Function call state for streaming arguments */
  private functionCallState: {
    itemId: string | null;
    name: string | null;
    arguments: string;
  } = { itemId: null, name: null, arguments: "" };
  /** Push-to-talk mode state */
  private pushToTalkMode: boolean = false;
  private isRecording: boolean = false;
  /** VAD configuration */
  private vadConfig = {
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500,
  };
  private sessionUpdateWaiters: {
    resolve: () => void;
    reject: (err: Error) => void;
  }[] = [];
  /** Ignore session.updated until we have sent a session.update (avoids early server ack). */
  private awaitingSessionUpdateAck = false;
  /** WebRTC: assistant audio may still be playing after response.done. */
  private assistantOutputAudioActive = false;
  private pendingIdleModeAfterAssistant = false;
  // public mode: 'loading' | 'human' | 'aispeaking' = 'loading'
  public callbacks: {
    setMode: (mode: "loading" | "human" | "aispeaking") => void;
    setConversationId: (id: string) => void;
    onAssistantPlaybackActive?: (active: boolean) => void;
    onAssistantResponseEnded?: () => void;
  };

  constructor(
    public userDetails: userWalletType,
    public connection: Connection,
    callbacks: {
      setMode: (mode: "loading" | "human" | "aispeaking") => void;
      setConversationId: (id: string) => void;
      onAssistantPlaybackActive?: (active: boolean) => void;
      onAssistantResponseEnded?: () => void;
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
    const aiName = AppSettings.getState().aiName || "Orova";
    const transcriptionPrompt =
      `Transcribe speech for ${aiName}, Orova crypto wallet assistant. ` +
      "Expect token symbols (SOL, USDC), amounts, mint addresses, swap, transfer, send, and usernames.";

    const item = {
      prompt: instructions,
      transcription_prompt: transcriptionPrompt,
      voice: AppSettings.getState().aiVoice || "alloy",
    };
    const tokenResponse = await request.postJson(item, url);
    const data = await tokenResponse.json();

    if (data?.error) {
      const msg =
        data.error?.message ??
        data.error?.code ??
        "OpenAI client secret request failed";
      throw new Error(msg);
    }

    this.token =
      data?.value ?? data?.client_secret?.value ?? data?.client_secret ?? null;
    if (!this.token) {
      throw new Error("Open token response missing client secret value");
    }
    return this.token;
  }

  async startSession(
    systemInstructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void> {
    if (this.startSessionPromise) {
      return this.startSessionPromise;
    }

    if (this.isSessionActive && this.dataChannel?.readyState === "open") {
      return;
    }

    this.startSessionPromise = this.startSessionInternal(
      systemInstructions,
      options
    ).finally(() => {
      this.startSessionPromise = null;
    });

    return this.startSessionPromise;
  }

  private async startSessionInternal(
    systemInstructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void> {
    const useVoiceInput = options?.useAudio !== false;
    this.useVoiceInputThisSession = useVoiceInput;
    this.sessionReadyPromise = new Promise((resolve, reject) => {
      this.sessionReadyResolve = resolve;
      this.sessionReadyReject = reject;
    });
    AppSettings.getState().setLoading(true);
    // Set system instructions if provided
    if (systemInstructions) {
      const sysIns = `
            These are the list of contacts I have on the App,
                ${JSON.stringify(AgentContacts())}
            \n
            Token resolution: users may name **any SPL token** by symbol or mint address.
            Swaps and prices use **Jupiter** on the backend. There is **no fixed "allowed swap list"** in this prompt—never tell the user a token is unsupported because it is not named here.

                \n
                When the user asks to **find a token**, **search for a mint**, **look up a ticker**, or **which address is token X**, call **search_spl_tokens** with their query first if they did not give a mint.
                \n
                When the user wants to **swap**, **trade**, or **exchange** tokens, you MUST call **swap_tokens** with their \`fromToken\`, \`toToken\`, and \`amount\` (see tool schema for what \`amount\` means). The app resolves symbols/mints via Jupiter token search—do not refuse before calling the tool. If a symbol is ambiguous, **swap_tokens** shows a token picker on the swap tool card (verified first); tell the user to tap a row there—do not ask them to paste a mint unless they prefer to. You may still call **search_spl_tokens** if they only want to explore tokens without swapping.
                \n
                Optional: call **check_price** before **swap_tokens** if the user wants a quote first.
                \n
            always map the username i am interacting to any of these, correct with right spelling always if the username doesn't fall you can use as provided.
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
      instructions: this.systemInstructions,
    });

    if (this.isSessionActive || this.peerConnection || this.dataChannel) {
      console.warn(
        "Previous session detected – cleaning up before starting a new one."
      );
      this.cleanupResources();
    }

    try {
      const sessionGeneration = ++this.sessionGeneration;
      // API requires offer to include an audio media section. In verified-gated mode
      // do not grab the mic here; the voice gate owns the microphone and forwards
      // only verified PCM chunks over the data channel.
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

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // Add STUN server for better connection
      });
      this.peerConnection = peerConnection;

      if (useVoiceInput) {
        const stream = await mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });
      } else if (typeof (peerConnection as any).addTransceiver === "function") {
        (peerConnection as any).addTransceiver("audio", {
          direction: "recvonly",
        });
      }

      // Setup connection state tracking
      //@ts-ignore
      peerConnection.addEventListener("connectionstatechange", () => {
        if (
          this.sessionGeneration !== sessionGeneration ||
          this.peerConnection !== peerConnection
        ) {
          return;
        }
        console.log(
          `Connection state changed: ${peerConnection.connectionState}`
        );
        if (peerConnection.connectionState === "connected") {
          this.connectionEstablished = true;
        }
      });

      // Create data channel with more reliable options
      this.dataChannel = peerConnection.createDataChannel("oai-events", {
        ordered: true,
        maxRetransmits: 3,
      });

      // Setup event handlers before creating offer
      this.setupDataChannelEventHandlers(sessionGeneration);

      // API requires an audio media section in the offer; we always include it
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: useVoiceInput, // only listen for voice in audio mode
      });

      await peerConnection.setLocalDescription(offer);

      // Send offer to API
      const baseUrl = "https://api.openai.com/v1/realtime/calls";
      const model = SessionManager.REALTIME_MODEL;
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
      if (
        this.sessionGeneration !== sessionGeneration ||
        this.peerConnection !== peerConnection ||
        peerConnection.signalingState !== "have-local-offer"
      ) {
        throw new Error("Session start superseded");
      }
      await peerConnection.setRemoteDescription(answer);

      // Handle audio tracks with our AudioManager
      // @ts-ignore
      peerConnection.addEventListener("track", (event) => {
        if (
          this.sessionGeneration !== sessionGeneration ||
          this.peerConnection !== peerConnection
        ) {
          return;
        }
        if (event.streams && event.streams[0]) {
          // Only handle audio tracks
          if (event.track && event.track.kind === "audio") {
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

      const ready = this.sessionReadyPromise;
      if (ready) {
        await Promise.race([
          ready,
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error("Session ready timeout")),
              30_000
            )
          ),
        ]);
      }
    } catch (error) {
      console.error("Error starting session:", error);
      this.rejectSessionReady(error instanceof Error ? error : new Error(String(error)));
      if (this.startSessionPromise) {
        this.cleanupResources();
      }
      AppSettings.getState().setLoading(false);
      throw error;
    }
  }

  private rejectSessionReady(err: Error): void {
    this.sessionReadyReject?.(err);
    this.sessionReadyResolve = null;
    this.sessionReadyReject = null;
    this.sessionReadyPromise = null;
  }

  private resolveSessionReady(): void {
    this.sessionReadyResolve?.();
    this.sessionReadyResolve = null;
    this.sessionReadyReject = null;
    this.sessionReadyPromise = null;
  }

  private getMessageSource(): "voice" | "chat" {
    return this.useVoiceInputThisSession ? "voice" : "chat";
  }

  isChatInputSession(): boolean {
    return !this.useVoiceInputThisSession;
  }

  private setModeAfterAssistantPlayback(): void {
    this.callbacks.setMode(this.useVoiceInputThisSession ? "human" : "loading");
  }

  private clearAssistantPlaybackState(): void {
    this.assistantOutputAudioActive = false;
    this.pendingIdleModeAfterAssistant = false;
    this.callbacks.onAssistantPlaybackActive?.(false);
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
      source: "voice",
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
      source: this.getMessageSource(),
    });
  }

  private formatTools(functions: FunctionParams[]) {
    return functions.map((fn) => {
      if (!fn.name) console.warn(`[Functions] Function missing name:`, fn);
      if (!fn.description) {
        console.warn(`[Functions] Function ${fn.name} missing description`);
      }
      if (!fn.parameters) {
        console.warn(`[Functions] Function ${fn.name} missing parameters`);
      }
      return {
        type: "function" as const,
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      };
    });
  }

  private getTurnDetectionConfig():
    | {
      type: "server_vad";
      threshold: number;
      prefix_padding_ms: number;
      silence_duration_ms: number;
      create_response: boolean;
      interrupt_response: boolean;
    }
    | null {
    if (!this.useVoiceInputThisSession || this.pushToTalkMode) {
      return null;
    }
    return {
      type: "server_vad",
      threshold: this.vadConfig.threshold,
      prefix_padding_ms: this.vadConfig.prefix_padding_ms,
      silence_duration_ms: this.vadConfig.silence_duration_ms,
      create_response: true,
      interrupt_response: true,
    };
  }

  private buildGaSessionPayload(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const {
      turn_detection: turnDetectionOverride,
      audio: audioOverride,
      ...restOverrides
    } = overrides;

    const session: Record<string, unknown> = {
      type: "realtime",
      model: SessionManager.REALTIME_MODEL,
      // Always use audio output so chat mode gets spoken replies + transcript events.
      output_modalities: ["audio"],
      ...restOverrides,
    };

    if (
      overrides.instructions === undefined &&
      this.systemInstructions.length > 0
    ) {
      session.instructions = this.systemInstructions;
    }

    if (overrides.tools === undefined && this.availableFunctions.length > 0) {
      session.tools = this.formatTools(this.availableFunctions);
      session.tool_choice = "auto";
    } else if (overrides.tools !== undefined) {
      session.tool_choice = overrides.tool_choice ?? "auto";
    }

    // GA Realtime: turn_detection lives under session.audio.input, not session root.
    const audioFromOverride =
      audioOverride && typeof audioOverride === "object"
        ? (audioOverride as Record<string, unknown>)
        : {};
    const inputFromOverride =
      audioFromOverride.input && typeof audioFromOverride.input === "object"
        ? (audioFromOverride.input as Record<string, unknown>)
        : {};

    const turnDetection =
      turnDetectionOverride !== undefined
        ? turnDetectionOverride
        : this.getTurnDetectionConfig();

    session.audio = {
      ...audioFromOverride,
      input: {
        ...inputFromOverride,
        transcription: inputFromOverride.transcription ?? {
          model: "gpt-4o-mini-transcribe",
          prompt:
            "Transcribe speech for Orova, a Solana crypto wallet assistant. Expect token symbols (SOL, USDC), amounts, mint addresses, swap, transfer, send, and usernames.",
        },
        turn_detection: turnDetection,
      },
    };

    return session;
  }

  private onSessionUpdated(serverSession: Record<string, unknown> | undefined) {
    if (!this.awaitingSessionUpdateAck) {
      return;
    }
    this.awaitingSessionUpdateAck = false;

    const tools = serverSession?.tools;
    const toolCount = Array.isArray(tools) ? tools.length : 0;
    const instructionsLen =
      typeof serverSession?.instructions === "string"
        ? serverSession.instructions.length
        : 0;
    console.log(
      `[Session] session.updated — tools: ${toolCount}, instructions chars: ${instructionsLen}`
    );
    const waiters = this.sessionUpdateWaiters.splice(0);
    waiters.forEach((w) => w.resolve());
  }

  private rejectSessionUpdateWaiters(reason: string) {
    this.awaitingSessionUpdateAck = false;
    const err = new Error(reason);
    const waiters = this.sessionUpdateWaiters.splice(0);
    waiters.forEach((w) => w.reject(err));
  }

  private waitForSessionUpdated(): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      this.sessionUpdateWaiters.push(waiter);
      setTimeout(() => {
        const idx = this.sessionUpdateWaiters.indexOf(waiter);
        if (idx >= 0) {
          this.sessionUpdateWaiters.splice(idx, 1);
          this.awaitingSessionUpdateAck = false;
          reject(new Error("session.updated timeout"));
        }
      }, SessionManager.SESSION_UPDATE_TIMEOUT_MS);
    });
  }

  private async sendSessionUpdate(
    overrides: Record<string, unknown> = {},
    waitForAck = true
  ): Promise<void> {
    const session = this.buildGaSessionPayload(overrides);
    const event = { type: "session.update", session };

    if (__DEV__) {
      const tools = session.tools;
      const toolCount = Array.isArray(tools) ? tools.length : 0;
      console.log(
        `[Session] session.update — tools: ${toolCount}, instructions chars: ${typeof session.instructions === "string"
          ? session.instructions.length
          : 0
        }`
      );
    }

    if (!waitForAck) {
      this.sendClientEvent(event);
      return;
    }

    this.awaitingSessionUpdateAck = true;
    const ack = this.waitForSessionUpdated();
    this.sendClientEvent(event);
    try {
      await ack;
    } catch (e) {
      this.awaitingSessionUpdateAck = false;
      console.warn("[Session] session.updated not received, continuing:", e);
    }
  }

  private setupDataChannelEventHandlers(sessionGeneration: number): void {
    if (!this.dataChannel) return;
    const dataChannel = this.dataChannel;

    // Handle data channel messages
    dataChannel.addEventListener("message", (e: MessageEvent) => {
      if (
        this.sessionGeneration !== sessionGeneration ||
        this.dataChannel !== dataChannel
      ) {
        return;
      }
      try {
        const message = JSON.parse(e.data);
        this.events.unshift(message);

        if (message.type === "session.updated") {
          this.onSessionUpdated(message.session);
        }

        if (message.type === "error") {
          console.error("[Realtime error]", message);
          if (message.event_id) {
            this.rejectSessionUpdateWaiters(
              message.message ?? "Realtime API error"
            );
          }
        }

        if (this.conversation_id === null) {
          throw new Error("Conversation has not been set");
        }

        if (message.type === "output_audio_buffer.started") {
          this.assistantOutputAudioActive = true;
          this.pendingIdleModeAfterAssistant = false;
          this.callbacks.onAssistantPlaybackActive?.(true);
          this.callbacks.setMode("aispeaking");
        }

        if (message.type === "output_audio_buffer.stopped") {
          this.assistantOutputAudioActive = false;
          this.callbacks.onAssistantPlaybackActive?.(false);
          if (this.pendingIdleModeAfterAssistant) {
            this.pendingIdleModeAfterAssistant = false;
            this.setModeAfterAssistantPlayback();
          }
          this.callbacks.onAssistantResponseEnded?.();
        }

        if (message.type === "input_audio_buffer.speech_started") {
          // Handle user interruption properly
          // 1. Cancel any in-flight response
          if (this.currentResponseId) {
            this.sendClientEvent({
              type: "response.cancel",
              response_id: this.currentResponseId,
            });
            this.currentResponseId = null;
          }

          this.assistantOutputAudioActive = false;
          this.pendingIdleModeAfterAssistant = false;
          this.callbacks.onAssistantPlaybackActive?.(false);

          // 2. Stop audio playback immediately
          this.audioManager.stopPlayback();

          // 3. Clear output buffer (WebRTC auto-truncates conversation)
          this.sendClientEvent({ type: "output_audio_buffer.clear" });

          // 4. Cancel pending AI transcript updates
          this.cancelFlushAi();
          this.pendingAiDeltas = "";

          // 5. Set mode and create user message placeholder
          this.callbacks.setMode("human");
          this.updateMemory(message);

          this.activeHumanMessageId =
            "temp" + new Date().getTime().toString();
          Convo.getState().setMessages({
            id: this.activeHumanMessageId,
            role: "user",
            content: "",
            timestamp: new Date().getTime(),
            conversation_id: this.conversation_id,
            source: "voice",
          });
        }

        if (message.type === "response.created") {
          this.currentResponseId = message.response?.id ?? null;
          this.responseState = {
            id: message.response?.id ?? null,
            status: 'creating',
            audioItemId: null,
          };
          // Reset function call state for new response
          this.functionCallState = { itemId: null, name: null, arguments: "" };
          this.callbacks.setMode("aispeaking");
        }

        if (message.type === "response.cancelled") {
          console.log("Response cancelled by server");
          this.currentResponseId = null;
          this.responseState = { id: null, status: 'cancelled', audioItemId: null };
          // Reset function call state on cancellation
          this.functionCallState = { itemId: null, name: null, arguments: "" };
          this.cancelFlushAi();
          this.pendingAiDeltas = "";
          this.clearAssistantPlaybackState();
          this.callbacks.onAssistantResponseEnded?.();
        }

        if (message.type === "response.output_item.added") {
          if (message.item?.type === "audio") {
            this.responseState.audioItemId = message.item.id;
            this.responseState.status = 'in_progress';
          }
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
              source: "voice",
            });
          }
        }

        if (
          message.type ===
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
              source: "voice",
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
              source: this.getMessageSource(),
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
              source: this.getMessageSource(),
            });
            setTimeout(() => {
              this.activeAiMessageId = null;
            }, 200);
          }
        }

        if (message.type === "response.output_text.delta") {
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
              source: this.getMessageSource(),
            });
          }
        }

        if (message.type === "response.output_text.done") {
          this.cancelFlushAi();
          this.flushAiNow();
          const finalText = message.text ?? "";
          if (this.activeAiMessageId) {
            Convo.getState().updateMessage({
              messageId: this.activeAiMessageId,
              content: { content: finalText },
              source: this.getMessageSource(),
            });
            setTimeout(() => {
              this.activeAiMessageId = null;
            }, 200);
          } else if (finalText) {
            this.activeAiMessageId = "temp" + new Date().getTime().toString();
            Convo.getState().setMessages({
              id: this.activeAiMessageId,
              role: "system",
              content: finalText,
              timestamp: new Date().getTime(),
              conversation_id: this.conversation_id,
              source: this.getMessageSource(),
            });
            setTimeout(() => {
              this.activeAiMessageId = null;
            }, 200);
          }
        }

        // Handle streaming function call arguments (delta events)
        if (message.type === "response.function_call_arguments.delta") {
          console.log("[Function Call] Arguments delta:", message);

          // Initialize or accumulate function call arguments
          if (!this.functionCallState.itemId) {
            this.functionCallState.itemId = message.item_id;
            this.functionCallState.name = message.name || null;
            this.functionCallState.arguments = message.delta || "";
          } else {
            this.functionCallState.arguments += message.delta || "";
          }

          console.log(`[Function Call] Building arguments for ${this.functionCallState.name}:`,
            this.functionCallState.arguments
          );
        }

        // Handle completed function call arguments
        if (message.type === "response.function_call_arguments.done") {
          console.log("[Function Call] Arguments completed:", message);

          // Update the final accumulated arguments
          if (message.arguments) {
            this.functionCallState.arguments = message.arguments;
          }

          console.log(`[Function Call] Final arguments for ${message.name}:`,
            this.functionCallState.arguments
          );

          // Note: The actual function execution will happen in response.done
          // when we receive the complete function_call item
        }

        if (message.type === "response.done") {
          this.currentResponseId = null;
          this.responseState = { id: null, status: 'completed', audioItemId: null };

          let hasPendingFunctionCall = false;

          // Process response output items according to OpenAI Realtime API spec
          if (message.response?.output && message.response.output.length > 0) {
            const output = message.response.output;

            for (const item of output) {
              // Handle function calls (as per OpenAI docs)
              // When type is "function_call", indicates this response contains arguments for a named function call
              if (item.type === "function_call" && item.status === "completed") {
                hasPendingFunctionCall = true;
                console.log("Function call detected:", {
                  name: item.name,
                  call_id: item.call_id,
                  arguments: item.arguments
                });

                // Handle the function call asynchronously
                this.handleFunctionCall(item);

                // Don't process further items if we have a function call
                // The model will continue after we provide the function result
                continue;
              }

              // Handle AI message with transcript or text
              if (item.type === "message" && item.role === "assistant" && item.content) {
                for (const contentItem of item.content) {
                  const transcript =
                    contentItem.type === "output_audio"
                      ? contentItem.transcript
                      : contentItem.type === "output_text"
                        ? contentItem.text
                        : null;

                  if (!transcript) continue;

                  this.cancelFlushAi();
                  this.flushAiNow();

                  if (this.activeAiMessageId) {
                    Convo.getState().updateMessage({
                      messageId: this.activeAiMessageId,
                      content: { content: transcript },
                      source: this.getMessageSource(),
                    });
                  } else {
                    this.activeAiMessageId = "temp" + new Date().getTime().toString();
                    Convo.getState().setMessages({
                      id: this.activeAiMessageId,
                      role: "system",
                      content: transcript,
                      timestamp: new Date().getTime(),
                      conversation_id: this.conversation_id!,
                      source: this.getMessageSource(),
                    });
                  }

                  setTimeout(() => {
                    this.activeAiMessageId = null;
                  }, 200);

                  this.updateMemory({ type: "ai_transcript_completed", transcript });
                  break;
                }
              }
            }
          }

          if (!hasPendingFunctionCall) {
            if (this.assistantOutputAudioActive) {
              // response.done arrives before WebRTC playback finishes; wait for output_audio_buffer.stopped.
              this.pendingIdleModeAfterAssistant = true;
            } else {
              this.setModeAfterAssistantPlayback();
              this.callbacks.onAssistantResponseEnded?.();
            }
          }

          // Reset function call state after processing response
          this.functionCallState = { itemId: null, name: null, arguments: "" };
        }
      } catch (error) {
        console.error("Error processing data channel message:", error);
      }
    });

    // Handle data channel open - this is the critical point for initialization
    dataChannel.addEventListener("open", () => {
      if (
        this.sessionGeneration !== sessionGeneration ||
        this.dataChannel !== dataChannel
      ) {
        return;
      }
      console.log("Data channel opened - setting session active");
      this.isSessionActive = true;
      this.events = [];

      // Match the mobile app's default routing while verification is disabled.
      this.toggleSpeaker(true);
      // Sequential initialization with delays
      this.initializeSession(sessionGeneration);
    });

    // Add error handling
    dataChannel.addEventListener("error", (error: any) => {
      if (
        this.sessionGeneration !== sessionGeneration ||
        this.dataChannel !== dataChannel
      ) {
        return;
      }
      console.error("Data channel error:", error);
    });

    // Handle closing
    dataChannel.addEventListener("close", () => {
      if (
        this.sessionGeneration !== sessionGeneration ||
        this.dataChannel !== dataChannel
      ) {
        return;
      }
      console.log("Data channel closed");
      this.isSessionActive = false;
    });
  }

  private async initializeSession(sessionGeneration: number): Promise<void> {
    try {
      if (this.sessionGeneration !== sessionGeneration) return;
      console.log(
        "[Session] Applying GA session (instructions + tools + VAD in one update)"
      );
      await this.sendSessionUpdate({}, true);

      if (this.sessionGeneration !== sessionGeneration) return;

      if (!this.useVoiceInputThisSession) {
        this.muteMic(true);
      }

      this.triggerInitialWelcome(sessionGeneration);

      console.log("Session fully initialized");
      AppSettings.getState().setLoading(false);
      this.resolveSessionReady();
    } catch (error) {
      console.error("Error during session initialization:", error);
      AppSettings.getState().setLoading(false);
      this.rejectSessionReady(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private triggerInitialWelcome(sessionGeneration: number): void {
    const aiName = AppSettings.getState().aiName || "Orova";
    const username = UserItem.getState().user?.username?.trim();
    const nameHint = username ? ` The user's name is ${username}.` : "";

    setTimeout(() => {
      if (this.sessionGeneration !== sessionGeneration || !this.isSessionActive) {
        return;
      }
      this.sendClientEvent({
        type: "response.create",
        response: {
          instructions:
            `You are ${aiName}, the Orova wallet assistant.${nameHint} ` +
            "The user just started a new session. Greet them warmly in one short sentence and ask how you can help. " +
            "Do not call any tools for this greeting.",
        },
      });
    }, 150);
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
      this.sessionGeneration += 1;
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

      this.rejectSessionUpdateWaiters("Session stopped");
      this.rejectSessionReady(new Error("Session stopped"));
      this.clearAssistantPlaybackState();

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

  private createShortVoiceResponse(overrides: Record<string, unknown> = {}): void {
    this.sendClientEvent({
      type: "response.create",
      response: {
        instructions:
          "Reply for voice. Be brief, direct, and brisk. Use one short sentence unless a second sentence is necessary.",
        ...overrides,
      },
    });
  }

  sendTextMessage(message: string): void {
    if (!this.isSessionActive) {
      console.error("Cannot send message - session not active");
      return;
    }

    if (
      !this.dataChannel ||
      this.dataChannel.readyState !== "open"
    ) {
      console.error("Cannot send message - data channel not open");
      return;
    }

    try {
      this.callbacks.setMode("loading");
      // When user sends a new message: stop current AI audio and cancel in-flight response
      // so we move to the new item and the new response's audio plays instead.
      if (this.currentResponseId) {
        // Stop audio playback immediately
        this.audioManager.stopPlayback();

        // Cancel response
        this.sendClientEvent({
          type: "response.cancel",
          response_id: this.currentResponseId,
        });

        // Clear output buffer
        this.sendClientEvent({ type: "output_audio_buffer.clear" });

        this.currentResponseId = null;

        // Cancel AI transcript updates
        this.cancelFlushAi();
        this.pendingAiDeltas = "";
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
        this.createShortVoiceResponse();
      }, 200);
    } catch (error) {
      console.error("Error sending text message:", error);
    }
  }

  sendVerifiedAudioChunk(audioBase64: string): void {
    if (!this.isSessionActive) {
      console.error("Cannot send verified audio - session not active");
      return;
    }

    if (
      !this.dataChannel ||
      this.dataChannel.readyState !== "open"
    ) {
      console.error("Cannot send verified audio - data channel not open");
      return;
    }

    try {
      this.callbacks.setMode("loading");
      if (this.currentResponseId) {
        this.audioManager.stopPlayback();
        this.sendClientEvent({
          type: "response.cancel",
          response_id: this.currentResponseId,
        });
        this.sendClientEvent({ type: "output_audio_buffer.clear" });
        this.currentResponseId = null;
        this.cancelFlushAi();
        this.pendingAiDeltas = "";
      }

      this.sendClientEvent({
        type: "input_audio_buffer.append",
        audio: audioBase64,
      });
      this.sendClientEvent({ type: "input_audio_buffer.commit" });
      setTimeout(() => {
        this.createShortVoiceResponse();
      }, 100);
    } catch (error) {
      console.error("Error sending verified audio chunk:", error);
    }
  }

  updateSystemInstructions(instructions: string): void {
    this.systemInstructions = instructions;

    if (this.isSessionActive) {
      void this.sendSessionUpdate({ instructions }, true);
    } else {
      console.log(
        "Session not active, instructions will be sent when session starts"
      );
    }
  }

  /**
   * Enable or disable push-to-talk mode
   * Push-to-talk gives users control over when to speak and avoids VAD failures
   */
  async setPushToTalkMode(enabled: boolean): Promise<void> {
    this.pushToTalkMode = enabled;

    if (!this.isSessionActive) {
      console.log("Push-to-talk mode will be applied when session starts");
      return;
    }

    await this.sendSessionUpdate(
      { turn_detection: enabled ? null : this.getTurnDetectionConfig() },
      true
    );

    console.log(`Push-to-talk mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Start recording in push-to-talk mode
   * Call this when user presses/holds the talk button
   */
  async startPushToTalk(): Promise<void> {
    if (!this.pushToTalkMode || this.isRecording) {
      console.warn("Cannot start push-to-talk: mode not enabled or already recording");
      return;
    }

    this.isRecording = true;

    // Clear input buffer for fresh recording (WebRTC requirement)
    this.sendClientEvent({ type: "input_audio_buffer.clear" });

    // Cancel any in-flight response
    if (this.currentResponseId) {
      this.sendClientEvent({
        type: "response.cancel",
        response_id: this.currentResponseId,
      });
      this.currentResponseId = null;
    }

    // Stop playback and clear output buffer
    this.audioManager.stopPlayback();
    this.sendClientEvent({ type: "output_audio_buffer.clear" });

    this.callbacks.setMode("human");

    // Create user message placeholder
    this.activeHumanMessageId = "temp" + new Date().getTime().toString();
    Convo.getState().setMessages({
      id: this.activeHumanMessageId,
      role: "user",
      content: "",
      timestamp: new Date().getTime(),
      conversation_id: this.conversation_id!,
      source: "voice",
    });

    console.log("Push-to-talk recording started");
  }

  /**
   * Stop recording in push-to-talk mode
   * Call this when user releases the talk button
   */
  async stopPushToTalk(): Promise<void> {
    if (!this.pushToTalkMode || !this.isRecording) {
      console.warn("Cannot stop push-to-talk: mode not enabled or not recording");
      return;
    }

    this.isRecording = false;

    // Commit the audio buffer (triggers transcription if enabled)
    this.sendClientEvent({ type: "input_audio_buffer.commit" });

    // Trigger response after brief delay
    setTimeout(() => {
      this.createShortVoiceResponse();
    }, 100);

    console.log("Push-to-talk recording stopped, triggering response");
  }

  /**
   * Check if currently in push-to-talk mode
   */
  isPushToTalkMode(): boolean {
    return this.pushToTalkMode;
  }

  /**
   * Check if currently recording in push-to-talk mode
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Update VAD settings for different environments
   * @param settings - VAD configuration options
   * 
   * Recommended presets:
   * - Quiet environment: { threshold: 0.4, silenceDurationMs: 400 }
   * - Normal environment: { threshold: 0.5, silenceDurationMs: 500 } (default)
   * - Noisy environment: { threshold: 0.6, silenceDurationMs: 700 }
   */
  async updateVadSettings(settings: {
    threshold?: number;
    prefixPaddingMs?: number;
    silenceDurationMs?: number;
  }): Promise<void> {
    if (!this.useVoiceInputThisSession) {
      console.warn("Cannot update VAD settings in chat (text input) mode");
      return;
    }

    if (this.pushToTalkMode) {
      console.warn("Cannot update VAD settings in push-to-talk mode");
      return;
    }

    // Update config
    if (settings.threshold !== undefined) {
      this.vadConfig.threshold = settings.threshold;
    }
    if (settings.prefixPaddingMs !== undefined) {
      this.vadConfig.prefix_padding_ms = settings.prefixPaddingMs;
    }
    if (settings.silenceDurationMs !== undefined) {
      this.vadConfig.silence_duration_ms = settings.silenceDurationMs;
    }

    if (this.isSessionActive) {
      await this.sendSessionUpdate(
        { turn_detection: this.getTurnDetectionConfig() },
        true
      );
      console.log("VAD settings updated:", this.vadConfig);
    }
  }

  /**
   * Get current VAD configuration
   */
  getVadConfig(): { threshold: number; prefix_padding_ms: number; silence_duration_ms: number } {
    return { ...this.vadConfig };
  }

  /**
   * Register callable functions with the model
   * Based on OpenAI Realtime API function calling specification
   * @param functions - Array of function definitions with handlers
   */
  registerFunctions(functions: FunctionParams[]): void {
    this.availableFunctions = functions;

    if (this.isSessionActive) {
      void this.sendSessionUpdate(
        {
          tools: this.formatTools(functions),
          tool_choice: "auto",
        },
        true
      );
    } else {
      console.log(
        "[Functions] Session not active, functions will be registered on session start"
      );
    }
  }

  /**
   * Handle function call from the model
   * Based on OpenAI Realtime API function calling specification
   * @param functionCall - The function call item from response.done output
   */
  private async handleFunctionCall(functionCall: any): Promise<void> {
    const { name, arguments: argsJson, call_id } = functionCall;

    console.log(`[Function Call] Received:`, {
      name,
      call_id,
      arguments: argsJson,
      status: functionCall.status
    });

    // Validate required fields
    if (!name || !call_id) {
      console.error("[Function Call] Missing required fields (name or call_id)");
      return;
    }

    try {
      // Find the registered function handler
      const functionDef = this.availableFunctions.find(
        (fn) => fn.name === name
      );

      if (!functionDef || !functionDef.handler) {
        throw new Error(`No handler found for function: ${name}`);
      }

      // Parse arguments - OpenAI sends them as a JSON string
      let args;
      if (typeof argsJson === "string") {
        try {
          args = JSON.parse(argsJson);
        } catch (parseError) {
          if (__DEV__) {
            pushDevNetworkLog({
              label: `Realtime tool args JSON.parse failed: ${name}`,
              method: "INTERNAL",
              url: `function:${name}`,
              status: 0,
              durationMs: 0,
              requestSummary:
                typeof argsJson === "string"
                  ? argsJson.slice(0, 12_000)
                  : String(argsJson).slice(0, 12_000),
              responseBody: String(parseError),
            });
          }
          throw new Error(`Failed to parse function arguments: ${parseError}`);
        }
      } else {
        args = argsJson;
      }

      console.log(`[Function Call] Executing ${name} with parsed args:`, args);

      // Create a pending message in the conversation UI
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
          source: this.getMessageSource(),
        });
        this.functionMessageId = call_id;
      }

      // Execute the function handler
      const result = await functionDef.handler(args);
      // Track tool usage
      tracker.tool_calls(name, 1);

      // Update conversation message with success status (use toolUpdates so we do not wipe tool.arguments or extra fields)
      if (this.conversation_id !== null && this.functionMessageId) {
        const toolMsg = Convo.getState().messages.find(
          (m) => m.id === this.functionMessageId
        );
        Convo.getState().updateMessage({
          messageId: this.functionMessageId,
          source: toolMsg?.source ?? "voice",
          toolUpdates: {
            status: "complete",
            action: functionDef.name,
            owner: functionDef.owner,
          },
        });
      }

      // Send the result back to the model as per OpenAI spec
      // The output must be a JSON string
      const resultEvent = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,
          output: JSON.stringify(result),
        },
      };

      console.log(`[Function Call] Sending result back to model:`, resultEvent);
      this.sendClientEvent(resultEvent);

      // Trigger a new response to process the function result
      // As per OpenAI docs: "ask the model to respond"
      setTimeout(() => {
        console.log(`[Function Call] Requesting model response with function result`);
        this.createShortVoiceResponse({
          instructions:
            "Summarize the tool result for voice in one short sentence. If the tool result includes an assistant_instruction or message field, follow it closely. Do not enumerate arrays, product names, prices, or links unless the tool explicitly asks you to.",
        });
      }, 300);
    } catch (error: any) {
      console.error(`[Function Call] Error executing ${name}:`, error);

      if (__DEV__) {
        let argsSummary = "";
        try {
          argsSummary =
            typeof argsJson === "string"
              ? argsJson.slice(0, 4000)
              : JSON.stringify(argsJson).slice(0, 4000);
        } catch {
          argsSummary = "«args unavailable»";
        }
        pushDevNetworkLog({
          label: `Tool handler error: ${name}`,
          method: "INTERNAL",
          url: `handler:${name}`,
          status: 0,
          durationMs: 0,
          requestSummary: argsSummary,
          responseBody: [error?.name, error?.message, error?.stack]
            .filter(Boolean)
            .join("\n")
            .slice(0, 12_000),
        });
      }

      AppSettings.getState().setLoading(false);

      // Update conversation message with error status
      if (this.conversation_id !== null && this.functionMessageId) {
        const functionDef = this.availableFunctions.find(
          (fn) => fn.name === name
        );

        Convo.getState().updateMessage({
          messageId: this.functionMessageId,
          source:
            Convo.getState().messages.find((m) => m.id === this.functionMessageId)
              ?.source ?? "voice",
          toolUpdates: {
            status: "failed",
            action: functionDef?.name || name,
            owner: functionDef?.owner,
          },
        });
      }

      // Send error back to the model as per OpenAI spec
      // The output should be a JSON string containing error information
      const errorEvent = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,
          output: JSON.stringify({
            error: error.message || "Unknown error",
            type: error.name || "FunctionExecutionError",
          }),
        },
      };

      console.log(`[Function Call] Sending error to model:`, errorEvent);
      this.sendClientEvent(errorEvent);

      // Still trigger a response so the model can handle the error gracefully
      setTimeout(() => {
        this.createShortVoiceResponse({
          instructions:
            "Explain the tool error briefly for voice in one short sentence and say what the user can try next.",
        });
      }, 300);
    }

    // Update user wallet state after function execution
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

  /**
   * Dynamically add or update a single function
   * @param name - Function name (must be unique)
   * @param owner - Owner identifier for the function
   * @param description - Human-readable description to help the model decide when to call this function
   * @param parameters - JSON Schema object describing the function parameters
   * @param handler - Async function that executes the function logic
   */
  addFunction(
    name: string,
    owner: any,
    description: string,
    parameters: any,
    handler: (args: any) => Promise<any>
  ): void {
    console.log(`[Functions] Adding/updating function: ${name}`);

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
      console.log(`[Functions] Replacing existing function: ${name}`);
      this.availableFunctions[existingIndex] = functionDef;
    } else {
      console.log(`[Functions] Adding new function: ${name}`);
      this.availableFunctions.push(functionDef);
    }

    // If session is active, update the available tools
    if (this.isSessionActive) {
      console.log(`[Functions] Session active, registering updated function list`);
      this.registerFunctions(this.availableFunctions);
    }
  }

  /**
   * Remove a function by name
   * @param name - Function name to remove
   */
  removeFunction(name: string): void {
    const index = this.availableFunctions.findIndex((fn) => fn.name === name);
    if (index >= 0) {
      this.availableFunctions.splice(index, 1);

      // Update session if active
      if (this.isSessionActive) {
        this.registerFunctions(this.availableFunctions);
      }
    } else {
      console.warn(`[Functions] Function ${name} not found`);
    }
  }

  /**
   * Get list of registered function names
   */
  getRegisteredFunctions(): string[] {
    return this.availableFunctions.map(fn => fn.name);
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
