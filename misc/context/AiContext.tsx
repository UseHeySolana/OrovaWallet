import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import SessionManager from "../helpers/aistream/aistream";
import { Audio } from "expo-av";
import { Connection } from "@solana/web3.js";
import AppSettings from "../store/settingsstore";
import UserItem from "../store/userstore";
import { api_key } from "@/app/requests/dashboard";
import { Alert } from "react-native";
import { prompB } from "../helpers/prompt";

interface AIService {
    sessionManager: SessionManager | null,
    isSessionActive: boolean,
    startSession: () => void,
    stopSession: () => void
}
const AiService = createContext<AIService | null>(null);

export const AiServiceProvider = ({ children }: { children: ReactNode }) => {
    const { user, userWallet, updateUserWallet, logout } = UserItem()
    const { network, setLoading } = AppSettings()
    const [sessionManager, setSessionManager] = useState<SessionManager | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [speakerEnabled, setSpeakerEnabled] = useState(true);
    const [permissionGranted, setPermissionGranted] = useState(false);

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
            if (isSessionActive) return;
            const manager = new SessionManager(userWallet, connection);
            setSessionManager(manager);
        }

        return () => {
            if (sessionManager && isSessionActive) {
                sessionManager.stopSession();
            }
        };
    }, [permissionGranted]);

    const startSession = async () => {
        let updatedPrompt = prompB

        if (!sessionManager) return;
        if (!user) {
            updatedPrompt + "User is not logged in, perform only limited actions like settings and voice changing and also routing actions. You should not perform swaps that would require user to be logged in. any action that would need user details, such as balance,swaps, token details respond with you are currently not logged in."
        } else {
            try {
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

                updatedPrompt + "" +
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
                    }`;
            } catch (error) {
                console.error('Failed to start session:', error);
                Alert.alert(
                    "Connection Error",
                    "Failed to connect to the AI assistant. Please try again." + error,
                    [{ text: "OK" }]
                );
            }
        }
        console.log(updatedPrompt)
        await sessionManager.startSession(updatedPrompt);
        setIsSessionActive(true);
    }
    // , [user, sessionManager]);

    const stopSession = useCallback(() => {
        setLoading(true);
        setTimeout(() => {

            if (sessionManager) {
                sessionManager.stopSession();
                setIsSessionActive(false);
            }

            setLoading(false);
        }, 1000)

    }, [sessionManager]);

    return (
        <AiService.Provider value={{ sessionManager, isSessionActive, startSession, stopSession }}>
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