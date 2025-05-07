import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import SessionManager from "../helpers/aistream/aistream";
import { Audio } from "expo-av";
import { Connection } from "@solana/web3.js";
import AppSettings from "../store/settingsstore";
import UserItem from "../store/userstore";
import { api_key } from "@/app/requests/dashboard";
import { prompB } from "../helpers/prompt";
import { toolRouter } from "../helpers/toolsregistry";
import WalletItem from "../store/wallet";

interface AIService {
    connection: Connection | null;
    sessionManager: SessionManager | null,
    isSessionActive: boolean,
    startSession: (audio?: boolean) => void,
    stopSession: () => void,
    currentMode: 'loading' | 'aispeaking' | 'human',
    conversationId: string,
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
                    "Total Balance : " +
                    userWallet?.balance +
                    ", Total Balance in USD/Dollars:" +
                    userWallet?.totalUsdBalance +
                    ", Sol Balance " +
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
        if (!sessionManager || isSessionActive) return;
        if (prompt == "") return;

        await sessionManager.startSession(prompt);
        setIsSessionActive(true);
    }

    const stopSession = useCallback(() => {
        setLoading(true);
        setTimeout(() => {

            if (sessionManager) {
                sessionManager.stopSession();
                setIsSessionActive(false);
                setSessionManager(null);
            }
            setRefresh(Math.random());
            setLoading(false);
        }, 500)

    }, [sessionManager]);

    return (
        <AiService.Provider value={{ sessionManager, isSessionActive, startSession, stopSession, currentMode, conversationId, connection }}>
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