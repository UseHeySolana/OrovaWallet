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

type IconProps = {
    size?: number;
    color?: string;
}

// Export components directly instead of functions that return components
export const IconLibrary = {
    error: (props: IconProps = {}) => (
        <MaterialIcons
            size={props.size || 18}
            color={props.color || "black"}
            name="error-outline"
        />
    ),
    check: (props: IconProps = {}) => (
        <AntDesign
            size={props.size || 18}
            color={props.color || "black"}
            name="check"
        />
    ),
    info: (props: IconProps = {}) => (
        <AntDesign
            size={props.size || 18}
            color={props.color || "black"}
            name="infocirlceo"
        />
    ),
    logout: (props: IconProps = {}) => (
        <AntDesign
            size={props.size || 18}
            color={props.color || "black"}
            name="logout"
        />

    ),
    search: (props: IconProps = {}) => (
        <EvilIcons
            size={props.size || 18}
            color={props.color || "black"}
            name="search"
        />

    ),

    wallet: (props: IconProps = {}) => (
        <Ionicons
            name="wallet-outline"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    linechart: (props: IconProps = {}) => (
        <AntDesign
            name="linechart"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    currency: (props: IconProps = {}) => (
        <Feather
            name="dollar-sign"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    security: (props: IconProps = {}) => (
        <MaterialIcons
            name="security"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    language: (props: IconProps = {}) => (
        <FontAwesome
            name="language"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    notebook: (props: IconProps = {}) => (
        <SimpleLineIcons
            name="notebook"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    connection: (props: IconProps = {}) => (
        <MaterialCommunityIcons
            name="connection"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    commenting: (props: IconProps = {}) => (
        <FontAwesome
            name="commenting-o"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    moon: (props: IconProps = {}) => (
        <Entypo
            name="moon"
            size={props.size || 18}
            color={props.color || "black"}
        />
    ),
    back: (props: IconProps = {}) => (
        <AntDesign name="back"
            size={props.size || 14}
            color={props.color || "black"}
        />
    )
};

export default IconLibrary;