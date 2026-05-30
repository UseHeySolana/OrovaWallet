import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import SessionManager from "../libs/voiceinfra/SessionManager";
import { Audio } from "expo-av";
import { Connection } from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { api_key } from "@/utils/dashboard";
import { getAssistantPromptBase } from "../libs/tool-implemetation/prompt";
import Convo from "@/utils/store/conversation.store";
import { v4 as uuidv4 } from "uuid";
import WalletItem from "@/utils/store/wallet.store";
import {
    VerifiedVoiceStream,
    type VoiceVerificationDebugInfo,
} from "@/libs/voiceinfra/VerifiedVoiceStream";
import { fetchVoiceStatus } from "@/services/voiceAuthApi";
import { VOICE_VERIFICATION_ENABLED } from "@/utils/constant";

/** Extra tail after WebRTC reports assistant playback stopped (echo guard). */
const VOICE_RESUME_AFTER_PLAYBACK_MS = 450;

export type AiInputMode = 'audio' | 'chat';

interface AIService {
    connection: Connection | null;
    sessionManager: SessionManager | null,
    isSessionActive: boolean,
    startSession: () => Promise<void>,
    stopSession: () => void,
    currentMode: 'loading' | 'aispeaking' | 'human',
    conversationId: string,
    inputMode: AiInputMode,
    setInputMode: (mode: AiInputMode) => void,
    sendChatMessage: (text: string) => void,
    isVoiceCommandRecording: boolean,
    voiceEnrolled: boolean | null,
    voiceGateStatus: "idle" | "listening" | "hearing" | "verifying" | "verified",
    voiceVerificationDebug: VoiceVerificationDebugInfo | null,
    refreshVoiceEnrollment: () => Promise<void>,
    startVoiceCommand: () => Promise<void>,
    stopVoiceCommand: (options?: { silentFailure?: boolean }) => Promise<{ ok: boolean; message?: string }>,
}
const AiService = createContext<AIService | null>(null);

export const AiServiceProvider = ({ children }: { children: ReactNode }) => {
    const { user, userWallet } = UserItem()
    const { network, setLoading } = AppSettings()

    const [sessionManager, setSessionManager] = useState<SessionManager | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [prompt, setPrompt] = useState("")

    const [currentMode, setCurrentMode] = useState<'loading' | 'aispeaking' | 'human'>("loading");
    const [inputMode, setInputMode] = useState<AiInputMode>('audio');
    const [isVoiceCommandRecording, setIsVoiceCommandRecording] = useState(false);
    const [voiceEnrolled, setVoiceEnrolled] = useState<boolean | null>(null);
    const [voiceGateStatus, setVoiceGateStatus] = useState<"idle" | "listening" | "hearing" | "verifying" | "verified">("idle");
    const [voiceVerificationDebug, setVoiceVerificationDebug] = useState<VoiceVerificationDebugInfo | null>(null);
    const startSessionPromiseRef = useRef<Promise<void> | null>(null);
    const voiceCommandRecordingRef = useRef(false);
    const voiceStreamRef = useRef<VerifiedVoiceStream | null>(null);
    const voiceResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const assistantPlaybackActiveRef = useRef(false);
    const awaitingAssistantResponseRef = useRef(false);
    const currentModeRef = useRef(currentMode);

    const [conversationId, setConversationId] = useState('');
    const conversationIdRef = useRef("");
    const [connection, setConnection] = useState<Connection | null>(null)

    useEffect(() => {
        voiceCommandRecordingRef.current = isVoiceCommandRecording;
    }, [isVoiceCommandRecording]);

    useEffect(() => {
        currentModeRef.current = currentMode;
    }, [currentMode]);

    const syncVoiceStreamSuppression = useCallback(() => {
        const stream = voiceStreamRef.current;
        if (!voiceCommandRecordingRef.current || !stream) {
            return;
        }

        if (voiceResumeTimerRef.current) {
            clearTimeout(voiceResumeTimerRef.current);
            voiceResumeTimerRef.current = null;
        }

        const shouldSuppress =
            currentModeRef.current === "aispeaking" ||
            assistantPlaybackActiveRef.current ||
            awaitingAssistantResponseRef.current;

        if (shouldSuppress) {
            stream.setSuppressed(true);
            return;
        }

        voiceResumeTimerRef.current = setTimeout(() => {
            if (
                currentModeRef.current === "aispeaking" ||
                assistantPlaybackActiveRef.current ||
                awaitingAssistantResponseRef.current
            ) {
                return;
            }
            voiceStreamRef.current?.setSuppressed(false);
            voiceResumeTimerRef.current = null;
        }, VOICE_RESUME_AFTER_PLAYBACK_MS);
    }, []);

    useEffect(() => {
        syncVoiceStreamSuppression();

        return () => {
            if (voiceResumeTimerRef.current) {
                clearTimeout(voiceResumeTimerRef.current);
                voiceResumeTimerRef.current = null;
            }
        };
    }, [currentMode, syncVoiceStreamSuppression]);

    const setActiveConversationId = useCallback((id: string) => {
        conversationIdRef.current = id;
        setConversationId(id);
    }, []);

    useEffect(() => {
        const checkPermissions = async () => {
            try {
                const { status } = await Audio.getPermissionsAsync();
                setPermissionGranted(status === 'granted');
                if (status !== 'granted') {
                    await Audio.requestPermissionsAsync()
                }

            } catch (error) {
                console.error("Error checking permissions:", error);
            }
        };

        checkPermissions();
    }, []);

    useEffect(() => {
        if (permissionGranted) {
            const connection = new Connection(`${network}${api_key}`)
            if (!connection) return;
            setConnection(connection);
            if (isSessionActive || sessionManager) return;

            const manager = new SessionManager(userWallet, connection,
                {
                    setMode: (mode) => setCurrentMode(mode),
                    setConversationId: setActiveConversationId,
                    onAssistantPlaybackActive: (active) => {
                        assistantPlaybackActiveRef.current = active;
                        syncVoiceStreamSuppression();
                    },
                    onAssistantResponseEnded: () => {
                        awaitingAssistantResponseRef.current = false;
                        syncVoiceStreamSuppression();
                    },
                }
            );
            setSessionManager(manager);
            const tokenDetails = userWallet?.tokenAccounts.map((token: any) => ({
                name: token.name,
                image: token.image,
                symbol: token.symbol,
                balance:
                    Number(token.balance) > 0
                        ? Number(token.balance).toFixed(2)
                        : token.balance,
                decimals: token.decimals,
                usdc_price: token.usdc_price,
                mint: token.mint,
            }));
            if (user) {
                const newPrompt = getAssistantPromptBase() + "" +
                    `this is the list of tokens in the user wallet ${JSON.stringify(
                        tokenDetails,
                        null,
                        2
                    )} ` +
                    `this is the user details ${"UserName: " +
                    user?.username +
                    "," +
                    "Total Balance in SOL : " + "\n" +
                    userWallet?.balance +
                    ", Total Balance in USD/Dollars:" +
                    userWallet?.totalUsdBalance + "\n" +
                    ", Sol token balance alone " + "\n" +
                    userWallet?.solBalance
                    }
                    `
                    ;
                setPrompt(newPrompt)
            } else {
                const newPrompt = 'You are a text-to-speech assistant. Any text I provide should be converted into speech and played back. Always respond in English unless explicitly instructed otherwise.';
                setPrompt(newPrompt)
            }
        }
        return () => {
            if (sessionManager && isSessionActive) {
                sessionManager.stopSession();
            }
        };
    }, [permissionGranted, refresh, user, userWallet, setActiveConversationId]);

    const refreshVoiceEnrollment = useCallback(async () => {
        if (!VOICE_VERIFICATION_ENABLED) {
            return;
        }

        const walletAddress =
            WalletItem.getState().publicKeyBase58 ??
            WalletItem.getState().publicKey?.toBase58() ??
            "";

        if (!walletAddress) {
            setVoiceEnrolled(false);
            return;
        }

        try {
            const status = await fetchVoiceStatus(walletAddress);
            setVoiceEnrolled(status.enrolled);
        } catch {
            setVoiceEnrolled(false);
        }
    }, []);

    useEffect(() => {
        if (!VOICE_VERIFICATION_ENABLED) {
            return;
        }
        void refreshVoiceEnrollment();
    }, [refreshVoiceEnrollment, user?.username, refresh]);

    const startSession = useCallback(async () => {
        if (startSessionPromiseRef.current) {
            return startSessionPromiseRef.current;
        }
        if (!sessionManager) return;
        if (sessionManager.isActive()) {
            setIsSessionActive(true);
            return;
        }
        if (prompt === "") return;
        console.log('starting session');
        const startPromise = sessionManager.startSession(prompt, {
            useAudio: VOICE_VERIFICATION_ENABLED ? false : inputMode === "audio",
        }).then(() => {
            setIsSessionActive(true);
        }).finally(() => {
            startSessionPromiseRef.current = null;
        });
        startSessionPromiseRef.current = startPromise;
        return startPromise;
    }, [inputMode, sessionManager, prompt]);

    const stopSession = useCallback(() => {
        setLoading(true);
        setActiveConversationId("");
        setTimeout(() => {
            if (sessionManager) {
                if (voiceResumeTimerRef.current) {
                    clearTimeout(voiceResumeTimerRef.current);
                    voiceResumeTimerRef.current = null;
                }
                void voiceStreamRef.current?.stop();
                voiceStreamRef.current = null;
                voiceCommandRecordingRef.current = false;
                sessionManager.stopSession();
                setIsSessionActive(false);
                setIsVoiceCommandRecording(false);
                setVoiceGateStatus("idle");
                setVoiceVerificationDebug(null);
                setSessionManager(null);
            }
            setRefresh(Math.random());
            setLoading(false);
        }, 500);


    }, [sessionManager, setActiveConversationId, setLoading]);

    const sendChatMessage = useCallback((text: string) => {
        const trimmed = text?.trim();
        const activeConversationId = conversationIdRef.current || conversationId;
        if (!trimmed || !sessionManager || !activeConversationId) return;
        const messageId = uuidv4();
        Convo.getState().setMessages({
            id: messageId,
            role: "user",
            content: trimmed,
            timestamp: new Date().getTime(),
            conversation_id: activeConversationId,
            source: "chat",
        });
        sessionManager.sendTextMessage(trimmed);
    }, [sessionManager, conversationId]);

    const sendVerifiedVoiceMessage = useCallback((text: string) => {
        const trimmed = text?.trim();
        const activeConversationId = conversationIdRef.current || conversationId;
        if (!trimmed || !sessionManager || !activeConversationId) return;
        const messageId = uuidv4();
        Convo.getState().setMessages({
            id: messageId,
            role: "user",
            content: trimmed,
            timestamp: new Date().getTime(),
            conversation_id: activeConversationId,
            source: "voice",
        });
        sessionManager.sendTextMessage(trimmed);
    }, [sessionManager, conversationId, syncVoiceStreamSuppression]);

    const addLocalAssistantMessage = useCallback((content: string) => {
        const activeConversationId = conversationIdRef.current || conversationId;
        if (!activeConversationId) return;
        Convo.getState().setMessages({
            id: uuidv4(),
            role: "system",
            content,
            timestamp: new Date().getTime(),
            conversation_id: activeConversationId,
            source: "voice",
        });
    }, [conversationId]);

    const startVoiceCommand = useCallback(async () => {
        if (!VOICE_VERIFICATION_ENABLED) {
            return;
        }

        if (voiceCommandRecordingRef.current) {
            return;
        }
        if (!sessionManager) {
            throw new Error("AI session is still loading. Please try again.");
        }
        if (!sessionManager.isActive()) {
            throw new Error("Start the AI session before recording a voice command.");
        }

        const walletAddress =
            WalletItem.getState().publicKeyBase58 ??
            WalletItem.getState().publicKey?.toBase58() ??
            "";
        if (!walletAddress) {
            throw new Error("Create or restore a wallet before using verified voice commands.");
        }

        const enrollment = await fetchVoiceStatus(walletAddress);
        setVoiceEnrolled(enrollment.enrolled);
        if (!enrollment.enrolled) {
            throw new Error("Enroll your voice first from the voice registration screen.");
        }

        const stream = new VerifiedVoiceStream({
            walletAddress,
            onVerifiedCommand: (transcript, audioBase64) => {
                if (!sessionManager.isActive()) return;

                awaitingAssistantResponseRef.current = true;
                syncVoiceStreamSuppression();

                if (transcript.trim()) {
                    sendVerifiedVoiceMessage(transcript);
                    return;
                }

                // Speaker was verified, but Laravel transcription returned empty.
                // Fall back to the realtime session's manual audio buffer path.
                addLocalAssistantMessage("Voice verified. Transcribing your command...");
                sessionManager.sendVerifiedAudioChunk(audioBase64);
            },
            onStateChange: (state) => {
                setVoiceGateStatus(state);
                if (state === "hearing") {
                    setCurrentMode("human");
                }
            },
            onVerificationDebug: (info) => {
                setVoiceVerificationDebug(info);
            },
            onError: (error) => {
                setVoiceVerificationDebug({
                    utteranceId: 0,
                    phase: "error",
                    error: error.message,
                    message: error.message,
                });
                console.warn("[VoiceAuth] stream error", error.message);
            },
        });

        try {
            await stream.start();
            voiceStreamRef.current = stream;
            voiceCommandRecordingRef.current = true;
            if (currentMode === "aispeaking") {
                stream.setSuppressed(true);
            } else {
                setCurrentMode("human");
            }
            setIsVoiceCommandRecording(true);
            setVoiceGateStatus("listening");
            setVoiceVerificationDebug(null);
        } catch (error) {
            voiceStreamRef.current = null;
            voiceCommandRecordingRef.current = false;
            setIsVoiceCommandRecording(false);
            setVoiceGateStatus("idle");
            setVoiceVerificationDebug(null);
            setCurrentMode("loading");
            throw error;
        }
    }, [addLocalAssistantMessage, currentMode, sendVerifiedVoiceMessage, sessionManager, syncVoiceStreamSuppression]);

    const stopVoiceCommand = useCallback(async (
        options: { silentFailure?: boolean } = {}
    ): Promise<{ ok: boolean; message?: string }> => {
        if (!VOICE_VERIFICATION_ENABLED) {
            return { ok: true };
        }

        try {
            if (!voiceCommandRecordingRef.current && !voiceStreamRef.current) {
                return { ok: false, message: "No active voice stream." };
            }

            await voiceStreamRef.current?.stop();
            voiceStreamRef.current = null;
            if (voiceResumeTimerRef.current) {
                clearTimeout(voiceResumeTimerRef.current);
                voiceResumeTimerRef.current = null;
            }
            awaitingAssistantResponseRef.current = false;
            assistantPlaybackActiveRef.current = false;
            voiceCommandRecordingRef.current = false;
            setIsVoiceCommandRecording(false);
            setVoiceGateStatus("idle");
            setVoiceVerificationDebug(null);
            setCurrentMode("loading");
            return { ok: true };
        } catch (error: any) {
            voiceStreamRef.current = null;
            if (voiceResumeTimerRef.current) {
                clearTimeout(voiceResumeTimerRef.current);
                voiceResumeTimerRef.current = null;
            }
            voiceCommandRecordingRef.current = false;
            setIsVoiceCommandRecording(false);
            setVoiceGateStatus("idle");
            setVoiceVerificationDebug(null);
            setCurrentMode("loading");
            const message = error?.message ?? "Voice stream failed to stop.";
            if (!options.silentFailure) {
                addLocalAssistantMessage(message);
            }
            return { ok: false, message };
        }
    }, [addLocalAssistantMessage]);

    return (
        <AiService.Provider value={{ sessionManager, isSessionActive, startSession, stopSession, currentMode, conversationId, connection, inputMode, setInputMode, sendChatMessage, isVoiceCommandRecording, voiceEnrolled, voiceGateStatus, voiceVerificationDebug, refreshVoiceEnrollment, startVoiceCommand, stopVoiceCommand }}>
            {children}
        </AiService.Provider>
    );

}


export const useAi = () => {
    const context = useContext(AiService);
    if (!context) {
        throw new Error("AiService must be use within a Ai service provider context");
    }
    return context;
};