// ThemeContext.js
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

import { useColorScheme } from "nativewind";
import { storage } from '../helpers/storage/storage';
import AppSettings from '../store/settingsstore';

interface ColorScheme {
    isDarkMode: boolean,
    toggleTheme: (mode: "light" | "dark" | "system") => void,
}
const ThemeContext = createContext<ColorScheme | null>(null);



export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const { setColorScheme, toggleColorScheme, colorScheme } = useColorScheme();

    const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
    const { setLoading } = AppSettings()

    useEffect(() => {
        (() => {

        })
        setIsDarkMode(colorScheme === 'dark');
    }, [colorScheme]);

    const toggleTheme = async (mode: "light" | "dark" | "system") => {
        setLoading(true)
        setColorScheme(mode)
    };


    return (

        <ThemeContext.Provider
            value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};


export const useThemeContext = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("ThemeContext must be use within a Ai service provider context");
    }
    return context;
};