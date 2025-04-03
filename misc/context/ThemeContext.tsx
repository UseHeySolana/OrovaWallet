// ThemeContext.js
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

import { useColorScheme } from "nativewind";
import { storage } from '../helpers/storage';

interface ColorScheme {
    isDarkMode: boolean,
    toggleTheme: () => void,
}
const ThemeContext = createContext<ColorScheme | null>(null);



export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const { setColorScheme, toggleColorScheme, colorScheme } = useColorScheme();

    const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
    console.log(colorScheme);

    useEffect(() => {
        (() => {

        })
        setIsDarkMode(colorScheme === 'dark');
    }, [colorScheme]);

    const toggleTheme = () => {
        toggleColorScheme
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