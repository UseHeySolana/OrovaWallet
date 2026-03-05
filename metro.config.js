const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

// Add polyfill resolvers
// config.resolver.extraNodeModules.crypto = require.resolve("expo-crypto");

config.resolver.extraNodeModules.crypto = require.resolve("crypto-browserify");

// Use create-hmac browser build so ed25519-hd-key works in RN (Node createHmac not available from expo-crypto)
// config.resolver.extraNodeModules["create-hmac"] = require.resolve("create-hmac/browser.js");
config.resolver.extraNodeModules.buffer = require.resolve("buffer");
config.resolver.extraNodeModules.assert = require.resolve("assert");
config.resolver.extraNodeModules.zlib = require.resolve("zlib");
config.resolver.extraNodeModules.stream = require.resolve("stream-browserify");
config.resolver.extraNodeModules["readable-stream"] = require.resolve("readable-stream");


config.resolver.assetExts.push("lottie");
//     assetExts: [...defaultConfig.resolver.assetExts, "lottie"],
//   },



module.exports = withNativeWind(config, { input: './global.css' })




