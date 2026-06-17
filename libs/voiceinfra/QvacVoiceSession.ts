import { Buffer } from "buffer";
import { Connection } from "@solana/web3.js";
import AudioRecord from "react-native-audio-record";
import { Audio } from "expo-av";
import { v4 as uuidv4 } from "uuid";
import {
  completion,
  loadModel,
  startQVACProvider,
  textToSpeech,
  transcribeStream,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_EN_SUPERTONIC_Q8_0,
  VAD_SILERO_5_1_2,
  WHISPER_TINY,
} from "@qvac/sdk";

import Convo from "@/utils/store/conversation.store";
import AppSettings from "@/utils/store/settingsstore.store";
import { summarizeConversation } from "@/utils/functions/extrafunctions";
import {
  createWavHeader,
  int16ArrayToBuffer,
  int16Base64ToF32Buffer,
  isMeaningfulTranscript,
  MIC_SAMPLE_RATE,
  playWavBuffer,
  sleep,
  TTS_SAMPLE_RATE,
} from "./qvacVoiceAudio";
import type { VoiceAssistantSession, VoiceSessionCallbacks } from "./types";

const VAD_PARAMS = {
  threshold: 0.6,
  min_speech_duration_ms: 300,
  min_silence_duration_ms: 700,
  max_speech_duration_s: 15.0,
  speech_pad_ms: 200,
};

const POST_PLAYBACK_COOLDOWN_MS = 300;

const VOICE_SYSTEM_SUFFIX =
  " You are a concise, friendly voice assistant. Keep responses under two sentences. " +
  "Never use markdown, lists, or code blocks — your output will be spoken aloud.";

type ChatRole = "system" | "user" | "assistant";

let audioRecordInitialized = false;

/**
 * On-device QVAC voice loop: Whisper+VAD → Llama → Supertonic TTS.
 * See docs/Voiceassistant.md for tuning notes.
 */
export class QvacVoiceSession implements VoiceAssistantSession {
  functionMessageId: string | null = null;

  private active = false;
  private shuttingDown = false;
  private isSpeaking = false;
  private useVoiceInput = true;
  private providerStarted = false;

  private asrModelId: string | null = null;
  private llmModelId: string | null = null;
  private ttsModelId: string | null = null;

  private conversationId: string | null = null;
  private history: Array<{ role: ChatRole; content: string }> = [];
  private systemInstructions = "";

  private transcribeSession: {
    write: (chunk: Buffer) => void;
    end: () => void;
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  } | null = null;
  private utteranceLoopPromise: Promise<void> | null = null;
  private turnInFlight = false;

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

      if (!this.providerStarted) {
        await startQVACProvider();
        this.providerStarted = true;
      }

      this.asrModelId = await loadModel({
        modelSrc: WHISPER_TINY,
        modelType: "whispercpp-transcription",
        modelConfig: {
          vadModelSrc: VAD_SILERO_5_1_2,
          audio_format: "f32le",
          strategy: "greedy",
          n_threads: 4,
          language: "en",
          no_timestamps: true,
          suppress_blank: true,
          suppress_nst: true,
          temperature: 0.0,
          vad_params: VAD_PARAMS,
        },
      });

      this.llmModelId = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
      });

      this.ttsModelId = await loadModel({
        modelSrc: TTS_EN_SUPERTONIC_Q8_0,
        modelType: "tts-ggml",
        modelConfig: {
          ttsEngine: "supertonic",
          language: "en",
          voice: "F1",
          ttsSpeed: 1.05,
          ttsNumInferenceSteps: 5,
        },
      });

      this.conversationId = new Date().getTime().toString();
      this.callbacks.setConversationId(this.conversationId);
      Convo.getState().createConversation({
        id: this.conversationId,
        summary: "",
      });

      if (this.useVoiceInput) {
        await this.startMicPipeline();
      }

      this.active = true;
      this.callbacks.setMode("human");
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

  sendVerifiedAudioChunk(audioBase64: string): void {
    void this.transcribeVerifiedChunk(audioBase64);
  }

  async stopSession(): Promise<void> {
    this.shuttingDown = true;
    this.active = false;

    await AudioRecord.stop().catch(() => undefined);

    try {
      this.transcribeSession?.end();
    } catch {
      // session may already be closed
    }
    this.transcribeSession = null;

    const ids = [this.ttsModelId, this.llmModelId, this.asrModelId];
    this.ttsModelId = null;
    this.llmModelId = null;
    this.asrModelId = null;

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

  private async startMicPipeline(): Promise<void> {
    if (!this.asrModelId) {
      throw new Error("ASR model not loaded");
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

  private async handleTurn(
    userText: string,
    source: "voice" | "chat"
  ): Promise<void> {
    if (!userText || !this.llmModelId || !this.ttsModelId || !this.conversationId) {
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

    try {
      const run = completion({
        modelId: this.llmModelId,
        history: this.history,
        stream: true,
      });

      let assistantText = "";
      for await (const event of run.events) {
        if (event.type === "contentDelta") {
          assistantText += event.text;
          Convo.getState().updateMessage({
            messageId: assistantMessageId,
            content: assistantText,
          });
        }
      }

      const final = await run.final;
      assistantText = (final.contentText || assistantText).trim();
      this.history.push({ role: "assistant", content: assistantText });

      Convo.getState().updateMessage({
        messageId: assistantMessageId,
        content: assistantText,
      });

      if (assistantText.length > 0) {
        this.callbacks.setMode("aispeaking");

        const ttsResult = textToSpeech({
          modelId: this.ttsModelId,
          text: assistantText,
          inputType: "text",
          stream: false,
        });

        const samples = await ttsResult.buffer;
        const audioData = int16ArrayToBuffer(samples);
        const wavBuffer = Buffer.concat([
          createWavHeader(audioData.length, TTS_SAMPLE_RATE),
          audioData,
        ]);

        await playWavBuffer(wavBuffer);
        await sleep(POST_PLAYBACK_COOLDOWN_MS);
      }
    } catch (error) {
      console.warn("[QvacVoiceSession] turn failed:", error);
      const message =
        error instanceof Error ? error.message : "Voice assistant turn failed";
      Convo.getState().updateMessage({
        messageId: assistantMessageId,
        content: message,
      });
    } finally {
      this.isSpeaking = false;
      this.turnInFlight = false;
      this.callbacks.onAssistantPlaybackActive?.(false);
      this.callbacks.onAssistantResponseEnded?.();
      this.callbacks.setMode(this.useVoiceInput ? "human" : "loading");
    }
  }
}
