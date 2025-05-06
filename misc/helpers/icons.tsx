import React from 'react';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Entypo from '@expo/vector-icons/Entypo';
import EvilIcons from '@expo/vector-icons/EvilIcons';
import { useThemeContext } from '../context/ThemeContext';
import { storage } from './storage/storage';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

type IconProps = {
    size?: number;
    color?: string;
}

// Create a context wrapper component that provides themed icons
const IconLibrary = {
    delete: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <EvilIcons
                name="trash"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    lock: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <EvilIcons
                name="lock"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    cancel: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <EvilIcons
                name="close"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    question: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <EvilIcons
                name="question"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    pluscircle: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                name="pluscircleo"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    arrowdown: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                name="arrowdown"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    copy: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <FontAwesome6
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="copy"
            />
        );
    },
    arrow_rotate: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <FontAwesome6
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="arrows-rotate"
            />
        );
    },
    angle_right: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <FontAwesome
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="angle-right"
            />
        );
    },
    error: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <MaterialIcons
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="error-outline"
            />
        );
    },
    check: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="check"
            />
        );
    },
    info: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="infocirlceo"
            />
        );
    },
    logout: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="logout"
            />
        );
    },
    search: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <EvilIcons
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
                name="search"
            />
        );
    },
    wallet: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <Ionicons
                name="wallet-outline"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    linechart: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign
                name="linechart"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    currency: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <Feather
                name="dollar-sign"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    security: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <MaterialIcons
                name="security"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    language: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <FontAwesome
                name="language"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    notebook: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <SimpleLineIcons
                name="notebook"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    connection: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <MaterialCommunityIcons
                name="connection"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    commenting: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <FontAwesome
                name="commenting-o"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    tools: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <Entypo
                name="tools"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    moon: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <Entypo
                name="moon"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    network: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <Entypo
                name="network"
                size={props.size || 18}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    },
    back: (props: IconProps = {}) => {
        const { isDarkMode } = useThemeContext();
        return (
            <AntDesign name="back"
                size={props.size || 14}
                color={props.color || (isDarkMode ? "white" : "black")}
            />
        );
    }
};

export default IconLibrary;