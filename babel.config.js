// module.exports = function (api) {
//     api.cache(true);
//     return {
//         presets: [
//             ["babel-preset-expo", { jsxImportSource: "nativewind" }],
//         ],
//         plugins: [
//             "nativewind/babel",  // ✅ Moved here
//             ["module:react-native-dotenv", {
//                 moduleName: "@env",
//                 path: ".env",
//                 allowUndefined: true
//             }],
//             "react-native-reanimated/plugin",
//             [
//                 "module-resolver",
//                 {
//                     root: ["."],
//                     alias: {
//                         "@": ".",
//                         "@/app": "./app",
//                         "@/components": "./components",
//                         "@/assets": "./assets",
//                         "@/misc": "./misc",
//                     },
//                 },
//             ],
//         ],
//     };
// };


module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
            "nativewind/babel",
        ],
    };
};