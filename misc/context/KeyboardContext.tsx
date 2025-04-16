// ThemeContext.js
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Keyboard } from "react-native";

interface ColorScheme {
    isKeyboardVisible: boolean,
}
const KeyboardContext = createContext<ColorScheme | null>(null);



export const KeyboardProvider = ({ children }: { children: ReactNode }) => {
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });

        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);



    return (

        <KeyboardContext.Provider
            value={{ isKeyboardVisible }}>
            {children}
        </KeyboardContext.Provider>
    );
};


export const useKeyboard = () => {
    const context = useContext(KeyboardContext);
    if (!context) {
        throw new Error("KeyboardContext must be use within a Keyboard service provider context");
    }
    return context;
};