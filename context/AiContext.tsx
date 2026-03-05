import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import SessionManager from "../libs/voiceinfra/SessionManager";
import { Audio } from "expo-av";
import { Connection } from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { api_key } from "@/utils/dashboard";
import { prompB } from "../libs/tool-implemetation/prompt";
import Convo from "@/utils/store/conversation.store";
import { v4 as uuidv4 } from "uuid";

export type AiInputMode = 'audio' | 'chat';

interface AIService {
    connection: Connection | null;
    sessionManager: SessionManager | null,
    isSessionActive: boolean,
    startSession: (audio?: boolean) => void,
    stopSession: () => void,
    currentMode: 'loading' | 'aispeaking' | 'human',
    conversationId: string,
    inputMode: AiInputMode,
    setInputMode: (mode: AiInputMode) => void,
    sendChatMessage: (text: string) => void,
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

    const [conversationId, setConversationId] = useState('');
    const [connection, setConnection] = useState<Connection | null>(null)

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
                    setConversationId: (id) => setConversationId(id),
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
                const newPrompt = prompB + "" +
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
    }, [permissionGranted, refresh, user, userWallet,]);

    const startSession = async () => {
        console.log('starting session');
        if (!sessionManager || isSessionActive) return;
        if (prompt == "") return;
        // Chat mode = text-only session (no mic). Audio mode = full voice session.
        await sessionManager.startSession(prompt, {
            useAudio: inputMode === 'audio',
        });
        setIsSessionActive(true);
    }

    const stopSession = useCallback(() => {
        setLoading(true);
        setConversationId("");
        setTimeout(() => {
            if (sessionManager) {
                sessionManager.stopSession();
                setIsSessionActive(false);
                setSessionManager(null);
            }
            setRefresh(Math.random());
            setLoading(false);
        }, 500);


    }, [sessionManager]);

    const sendChatMessage = useCallback((text: string) => {
        const trimmed = text?.trim();
        if (!trimmed || !sessionManager || !isSessionActive || !conversationId) return;
        const messageId = uuidv4();
        Convo.getState().setMessages({
            id: messageId,
            role: "user",
            content: trimmed,
            timestamp: new Date().getTime(),
            conversation_id: conversationId,
        });
        sessionManager.sendTextMessage(trimmed);
    }, [sessionManager, isSessionActive, conversationId]);

    return (
        <AiService.Provider value={{ sessionManager, isSessionActive, startSession, stopSession, currentMode, conversationId, connection, inputMode, setInputMode, sendChatMessage }}>
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