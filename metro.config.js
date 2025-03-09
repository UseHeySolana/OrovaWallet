const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];


config.resolver.extraNodeModules = {
    // "text-encoding": require.resolve("fast-text-encoding"),
    // "react-native-url-polyfill": require.resolve("react-native-url-polyfill"),
    // "stream": require.resolve("stream-browserify"), // 👈 Add this line
    // 'events': require.resolve('events/'),
    // 'path': require.resolve('path-browserify'),
    // 'util': require.resolve('util/'),
    // 'buffer': require.resolve('buffer'),
    // 'process': require.resolve('process/browser'),
    // 'http': require.resolve('stream-http'),
    // 'https': require.resolve('https-browserify'),
    // 'os': require.resolve('os-browserify/browser'),
    // 'url': require.resolve('url/'),
    // 'assert': require.resolve('assert/'),
    // 'crypto': require.resolve('crypto-browserify'),
};

config.resolver.assetExts = [...config.resolver.assetExts, "cjs"];

config.transformer.babelTransformerPath = require.resolve('metro-react-native-babel-transformer');
config.transformer.minifierConfig = {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
        keep_classnames: true,
        keep_fnames: true
    }
};


// Apply NativeWind configuration
module.exports = withNativeWind(config, { input: './global.css' });






