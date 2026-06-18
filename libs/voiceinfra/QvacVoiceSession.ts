import { Buffer } from "buffer";
import { Connection } from "@solana/web3.js";
import AudioRecord from "react-native-audio-record";
import { Audio } from "expo-av";
import { v4 as uuidv4 } from "uuid";
import {
  startQVACProvider,
  textToSpeech,
  transcribeStream,
  unloadModel,
} from "@qvac/sdk";

import { toolRouter } from "@/libs/tool-implemetation/toolsregistry";
import { ensureQvacHyperswarmSeed } from "@/libs/qvac/qvacSeed";
import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { summarizeConversation } from "@/utils/functions/extrafunctions";
import tracker from "@/utils/tracker";
import type { FunctionParams } from "@/utils/types/types";
import {
  cleanAssistantReply,
  completeChatTurn,
  completeVoiceTurn,
  formatQvacTools,
  selectRelevantTools,
  shouldUseToolModel,
  type QvacChatMessage,
  type QvacToolCall,
} from "./qvacVoiceCompletion";
import {
  createWavHeader,
  int16ArrayToBuffer,
  int16Base64ToF32Buffer,
  isMeaningfulTranscript,
  MIC_SAMPLE_RATE,
  playWavBuffer,
  scrubForSupertonic,
  sleep,
  TTS_SAMPLE_RATE,
} from "./qvacVoiceAudio";
import { loadQvacVoiceModels } from "./qvacVoiceModels";
import { formatQvacDelegateError } from "./qvacDelegateErrors";
import { QvacLanVoiceClient } from "./qvacLanClient";
import { normalizeLaptopHostAddress } from "./qvacLanUrls";
import type { VoiceAssistantSession, VoiceSessionCallbacks } from "./types";

const POST_PLAYBACK_COOLDOWN_MS = 300;

async function safeAudioRecordStop(): Promise<void> {
  try {
    await Promise.resolve(AudioRecord.stop());
  } catch {
    // ignore stop errors when mic is already idle
  }
}

async function safeAudioRecordStart(): Promise<void> {
  try {
    await Promise.resolve(AudioRecord.start());
  } catch {
    // ignore start errors when session is closing
  }
}

const VOICE_SYSTEM_SUFFIX =
  " Reply with only the short spoken answer — never output thinking tags, reasoning, or repeat these instructions.";

let audioRecordInitialized = false;

/**
 * QVAC voice loop: Whisper → Llama (chat) or Qwen (tools) → Supertonic TTS.
 * Models can run on-device or delegate to a laptop provider (see qvacHostMode).
 */
export class QvacVoiceSession implements VoiceAssistantSession {
  functionMessageId: string | null = null;

  private active = false;
  private shuttingDown = false;
  private isSpeaking = false;
  private useVoiceInput = true;
  private providerStarted = false;

  private asrModelId: string | null = null;
  private chatModelId: string | null = null;
  private toolModelId: string | null = null;
  private ttsModelId: string | null = null;
  private embedModelId: string | null = null;
  private availableFunctions: FunctionParams[] = [];

  private conversationId: string | null = null;
  private history: QvacChatMessage[] = [];
  private systemInstructions = "";

  private transcribeSession: {
    write: (chunk: Buffer) => void;
    end: () => void;
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  } | null = null;
  private utteranceLoopPromise: Promise<void> | null = null;
  private turnInFlight = false;
  private lanClient: QvacLanVoiceClient | null = null;
  private lanTranscribe:
    | ReturnType<QvacLanVoiceClient["connectTranscribe"]>
    | null = null;

  constructor(
    public readonly connection: Connection,
    private callbacks: VoiceSessionCallbacks
  ) {}

  async startSession(
    instructions?: string,
    options?: { useAudio?: boolean }
  ): Promise<void> {
    this.useVoiceInput = options?.useAudio !== false;
    this.systemInstructions = (instructions ?? "") + VOICE_SYSTEM_SUFFIX;
    this.history = [{ role: "system", content: this.systemInstructions }];
    this.availableFunctions = toolRouter(this);
    this.shuttingDown = false;

    AppSettings.getState().setLoading(true);

    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status !== "granted") {
        const { status: next } = await Audio.requestPermissionsAsync();
        if (next !== "granted") {
          throw new Error("Microphone permission is required for the voice assistant");
        }
      }

      const { qvacHostMode, laptopProviderPublicKey, laptopHostAddress } =
        AppSettings.getState();
      const useLaptopHost = qvacHostMode === "laptop";
      const lanAddress = normalizeLaptopHostAddress(laptopHostAddress);
      const useLanBridge = useLaptopHost && !!lanAddress;

      if (useLanBridge) {
        AppSettings.getState().setToast(
          "Connecting to your laptop on the local network…",
          "info"
        );
        this.lanClient = new QvacLanVoiceClient(lanAddress);
        await this.lanClient.checkHealth();
      } else if (useLaptopHost) {
        AppSettings.getState().setToast(
          "Connecting over P2P… add your laptop IP in AI Settings if this fails.",
          "info"
        );
        await ensureQvacHyperswarmSeed();
      } else if (!this.providerStarted) {
        await startQVACProvider();
        this.providerStarted = true;
      }

      if (!useLanBridge) {
        const models = await loadQvacVoiceModels({
          hostMode: qvacHostMode,
          laptopProviderPublicKey,
        });
        this.asrModelId = models.asrModelId;
        this.chatModelId = models.chatModelId;
        this.toolModelId = models.toolModelId;
        this.ttsModelId = models.ttsModelId;
        this.embedModelId = models.embedModelId;
      }

      this.conversationId = new Date().getTime().toString();
      this.callbacks.setConversationId(this.conversationId);
      Convo.getState().createConversation({
        id: this.conversationId,
        summary: "",
      });

      if (this.useVoiceInput) {
        if (useLanBridge) {
          await this.startLanMicPipeline();
        } else {
          await this.startMicPipeline();
        }
      }

      this.active = true;
      this.callbacks.setMode("human");
    } catch (error) {
      console.error("[QvacVoiceSession] startSession failed:", error);
      AppSettings.getState().setToast(formatQvacDelegateError(error), "error");
      this.callbacks.setMode("loading");
      throw error;
    } finally {
      AppSettings.getState().setLoading(false);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  isChatInputSession(): boolean {
    return !this.useVoiceInput;
  }

  sendTextMessage(message: string): void {
    void this.handleTurn(message.trim(), "chat");
  }

  async setVoiceInputEnabled(enabled: boolean): Promise<void> {
    if (this.useVoiceInput === enabled) return;
    this.useVoiceInput = enabled;
    if (!this.active || this.shuttingDown) return;

    if (!enabled) {
      await this.stopMicPipeline();
      return;
    }

    if (this.lanClient) {
      await this.startLanMicPipeline();
    } else if (this.asrModelId) {
      await this.startMicPipeline();
    }
  }

  sendVerifiedAudioChunk(audioBase64: string): void {
    void this.transcribeVerifiedChunk(audioBase64);
  }

  async stopSession(): Promise<void> {
    this.shuttingDown = true;
    this.active = false;

    await safeAudioRecordStop();

    try {
      this.transcribeSession?.end();
    } catch {
      // session may already be closed
    }
    this.transcribeSession = null;
    this.lanTranscribe?.close();
    this.lanTranscribe = null;
    this.lanClient = null;

    const ids = [
      this.ttsModelId,
      this.embedModelId,
      this.toolModelId,
      this.chatModelId,
      this.asrModelId,
    ];
    this.ttsModelId = null;
    this.embedModelId = null;
    this.toolModelId = null;
    this.chatModelId = null;
    this.asrModelId = null;
    this.availableFunctions = [];

    for (const modelId of ids) {
      if (!modelId) continue;
      try {
        await unloadModel({ modelId, clearStorage: false });
      } catch {
        // ignore unload errors on shutdown
      }
    }

    if (this.conversationId) {
      const messages = Convo.getState()
        .getConversationMessages(this.conversationId)
        ?.map((message) => message.content)
        .join("\n");
      const summary = await summarizeConversation(messages || "");
      Convo.getState().updateConversation(this.conversationId, summary || "");
    }

    this.callbacks.setMode("loading");
  }

  private async stopMicPipeline(): Promise<void> {
    await safeAudioRecordStop();

    try {
      this.transcribeSession?.end();
    } catch {
      // session may already be closed
    }
    this.transcribeSession = null;
    this.lanTranscribe?.close();
    this.lanTranscribe = null;
  }

  private async startLanMicPipeline(): Promise<void> {
    if (!this.lanClient) {
      throw new Error("Laptop voice client is not configured");
    }

    if (this.lanTranscribe) {
      await safeAudioRecordStart();
      return;
    }

    this.lanTranscribe = this.lanClient.connectTranscribe(
      (rawText) => {
        if (this.shuttingDown || !this.active || this.turnInFlight) return;
        if (!isMeaningfulTranscript(rawText)) return;
        void this.handleTurn(rawText.trim(), "voice");
      },
      (message) => {
        console.warn("[QvacVoiceSession] LAN transcribe:", message);
      }
    );

    if (!audioRecordInitialized) {
      AudioRecord.init({
        sampleRate: MIC_SAMPLE_RATE,
        channels: 1,
        bitsPerSample: 16,
        wavFile: "qvac_voice_assistant.wav",
      });
      AudioRecord.on("data", (data: string) => {
        if (!this.active || this.shuttingDown || this.isSpeaking) return;
        if (!this.lanTranscribe) return;
        try {
          this.lanTranscribe.sendAudio(int16Base64ToF32Buffer(data));
        } catch {
          // ignore write errors when stream is closing
        }
      });
      audioRecordInitialized = true;
    }

    await AudioRecord.start();
  }

  private async startMicPipeline(): Promise<void> {
    if (!this.asrModelId) {
      throw new Error("ASR model not loaded");
    }

    if (this.transcribeSession) {
      await safeAudioRecordStart();
      return;
    }

    this.transcribeSession = await transcribeStream({ modelId: this.asrModelId });

    if (!audioRecordInitialized) {
      AudioRecord.init({
        sampleRate: MIC_SAMPLE_RATE,
        channels: 1,
        bitsPerSample: 16,
        wavFile: "qvac_voice_assistant.wav",
      });
      AudioRecord.on("data", (data: string) => {
        if (!this.active || this.shuttingDown || this.isSpeaking) return;
        if (!this.transcribeSession) return;
        try {
          this.transcribeSession.write(int16Base64ToF32Buffer(data));
        } catch {
          // ignore write errors when session is closing
        }
      });
      audioRecordInitialized = true;
    }

    await AudioRecord.start();

    this.utteranceLoopPromise = this.runUtteranceLoop().catch((error) => {
      console.warn("[QvacVoiceSession] utterance loop ended:", error);
    });
  }

  private async runUtteranceLoop(): Promise<void> {
    const session = this.transcribeSession;
    if (!session) return;

    for await (const rawText of session) {
      if (this.shuttingDown || !this.active) break;
      if (!isMeaningfulTranscript(rawText)) continue;
      if (this.turnInFlight) continue;
      await this.handleTurn(rawText.trim(), "voice");
    }
  }

  private async transcribeVerifiedChunk(audioBase64: string): Promise<void> {
    if (!this.asrModelId || this.turnInFlight) return;

    try {
      const pcm = Buffer.from(audioBase64, "base64");
      const sampleCount = Math.floor(pcm.length / 2);
      const f32 = Buffer.alloc(sampleCount * 4);
      for (let i = 0; i < sampleCount; i += 1) {
        f32.writeFloatLE(pcm.readInt16LE(i * 2) / 32_768, i * 4);
      }

      const session = await transcribeStream({ modelId: this.asrModelId });
      session.write(f32);
      session.end();

      for await (const rawText of session) {
        const trimmed = rawText.trim();
        if (trimmed && isMeaningfulTranscript(trimmed)) {
          await this.handleTurn(trimmed, "voice");
        }
        break;
      }
    } catch (error) {
      console.warn("[QvacVoiceSession] verified audio transcribe failed:", error);
    }
  }

  private async executeToolCall(
    call: QvacToolCall,
    messageSource: string
  ): Promise<string> {
    const functionDef = this.availableFunctions.find((fn) => fn.name === call.name);
    const callId = uuidv4();

    if (this.conversationId) {
      Convo.getState().setMessages({
        id: callId,
        role: "tool",
        content: "",
        timestamp: Date.now(),
        conversation_id: this.conversationId,
        tool: {
          owner: functionDef?.owner,
          status: "pending",
          action: call.name,
          arguments: call.arguments,
        },
        source: messageSource,
      });
      this.functionMessageId = callId;
    }

    if (!functionDef?.handler) {
      const errorText = JSON.stringify({ error: `Unknown tool: ${call.name}` });
      if (this.conversationId && this.functionMessageId) {
        Convo.getState().updateMessage({
          messageId: this.functionMessageId,
          source: messageSource,
          toolUpdates: {
            status: "failed",
            action: call.name,
            owner: functionDef?.owner,
          },
        });
      }
      return errorText;
    }

    try {
      const result = await functionDef.handler(call.arguments);
      tracker.tool_calls(call.name, 1);
      if (this.conversationId && this.functionMessageId) {
        Convo.getState().updateMessage({
          messageId: this.functionMessageId,
          source: messageSource,
          toolUpdates: {
            status: "complete",
            action: call.name,
            owner: functionDef.owner,
          },
        });
      }
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed";
      if (this.conversationId && this.functionMessageId) {
        Convo.getState().updateMessage({
          messageId: this.functionMessageId,
          source: messageSource,
          toolUpdates: {
            status: "failed",
            action: call.name,
            owner: functionDef.owner,
          },
        });
      }
      return JSON.stringify({ error: message });
    }
  }

  private async resolveToolsForTurn(userText: string): Promise<FunctionParams[]> {
    if (this.availableFunctions.length <= 12) {
      return this.availableFunctions;
    }

    if (this.lanClient) {
      try {
        return await selectRelevantTools({
          userText,
          tools: this.availableFunctions,
          embedTextFn: (text) => this.lanClient!.embedText(text),
        });
      } catch {
        return this.availableFunctions.slice(0, 12);
      }
    }

    if (!this.embedModelId) {
      return this.availableFunctions.slice(0, 12);
    }

    return selectRelevantTools({
      embedModelId: this.embedModelId,
      userText,
      tools: this.availableFunctions,
    });
  }

  private async handleTurn(
    userText: string,
    source: "voice" | "chat"
  ): Promise<void> {
    if (!userText || !this.conversationId) {
      return;
    }
    if (!this.lanClient && (!this.chatModelId || !this.toolModelId || !this.ttsModelId)) {
      return;
    }
    if (this.turnInFlight) return;

    this.turnInFlight = true;
    this.isSpeaking = true;
    this.callbacks.setMode("loading");
    this.callbacks.onAssistantPlaybackActive?.(true);

    const userMessageId = uuidv4();
    if (source === "voice") {
      Convo.getState().setMessages({
        id: userMessageId,
        role: "user",
        content: userText,
        timestamp: Date.now(),
        conversation_id: this.conversationId,
        source: "voice",
      });
    }

    this.history.push({ role: "user", content: userText });

    const assistantMessageId = uuidv4();
    Convo.getState().setMessages({
      id: assistantMessageId,
      role: "system",
      content: "",
      timestamp: Date.now(),
      conversation_id: this.conversationId,
      source: source === "chat" ? "chat" : "voice",
    });

    const messageSource = source === "chat" ? "chat" : "voice";
    const updateAssistantMessage = (text: string) => {
      Convo.getState().updateMessage({
        messageId: assistantMessageId,
        content: { content: text },
        source: messageSource,
      });
    };

    try {
      let assistantText = "";
      const useTools = await shouldUseToolModel({
        userText,
        tools: this.availableFunctions,
        embedModelId: this.embedModelId ?? undefined,
        embedTextFn: this.lanClient
          ? (text) => this.lanClient!.embedText(text)
          : undefined,
      });
      const relevantTools = useTools
        ? await this.resolveToolsForTurn(userText)
        : [];
      const qvacTools = formatQvacTools(relevantTools);

      if (this.lanClient) {
        assistantText = cleanAssistantReply(
          await this.lanClient.completeTurn({
            history: this.history,
            useTools,
            tools: qvacTools,
            executeToolCall: (call) => this.executeToolCall(call, messageSource),
            onContentDelta: updateAssistantMessage,
          })
        );
      } else if (useTools) {
        const result = await completeVoiceTurn({
          modelId: this.toolModelId!,
          history: this.history,
          tools: qvacTools,
          onContentDelta: updateAssistantMessage,
          executeToolCall: (call) => this.executeToolCall(call, messageSource),
        });
        assistantText = cleanAssistantReply(result.contentText);
      } else {
        assistantText = await completeChatTurn({
          modelId: this.chatModelId!,
          history: this.history,
          onContentDelta: updateAssistantMessage,
        });
      }

      if (!assistantText) {
        assistantText = "Hey, how can I help you today?";
      }

      this.history.push({ role: "assistant", content: assistantText });

      updateAssistantMessage(assistantText);

      if (assistantText.length > 0) {
        this.callbacks.setMode("aispeaking");

        let spokenText = scrubForSupertonic(assistantText);
        if (!spokenText) {
          throw new Error("Nothing to speak after removing unsupported characters");
        }

        const shouldResumeMic =
          this.useVoiceInput && this.active && !this.shuttingDown;
        if (shouldResumeMic) {
          await safeAudioRecordStop();
        }

        try {
          let wavBuffer: Buffer;
          if (this.lanClient) {
            wavBuffer = await this.lanClient.speak(spokenText);
          } else {
            const ttsResult = textToSpeech({
              modelId: this.ttsModelId!,
              text: scrubForSupertonic(spokenText),
              inputType: "text",
              stream: false,
            });

            const samples = await ttsResult.buffer;
            if (!samples?.length) {
              throw new Error("Speech synthesis produced no audio");
            }
            const audioData = int16ArrayToBuffer(samples);
            wavBuffer = Buffer.concat([
              createWavHeader(audioData.length, TTS_SAMPLE_RATE),
              audioData,
            ]);
          }

          await playWavBuffer(wavBuffer);
          await sleep(POST_PLAYBACK_COOLDOWN_MS);
        } finally {
          if (shouldResumeMic) {
            await safeAudioRecordStart();
          }
        }
      }
    } catch (error) {
      console.warn("[QvacVoiceSession] turn failed:", error);
      const message =
        error instanceof Error ? error.message : "Voice assistant turn failed";
      updateAssistantMessage(message);
    } finally {
      this.isSpeaking = false;
      this.turnInFlight = false;
      this.callbacks.onAssistantPlaybackActive?.(false);
      this.callbacks.onAssistantResponseEnded?.();
      this.callbacks.setMode(this.useVoiceInput ? "human" : "loading");
    }
  }
}
