// KeyboardContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Keyboard, Platform, Pressable } from "react-native";

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

    const content = (
        <KeyboardContext.Provider value={{ isKeyboardVisible }}>
            {children}
        </KeyboardContext.Provider>
    );

    if (Platform.OS !== "ios") {
        return content;
    }

    return (
        <Pressable
            style={{ flex: 1 }}
            onPress={Keyboard.dismiss}
            accessible={false}
        >
            {content}
        </Pressable>
    );
};


export const useKeyboard = () => {
    const context = useContext(KeyboardContext);
    if (!context) {
        throw new Error("KeyboardContext must be use within a Keyboard service provider context");
    }
    return context;
};