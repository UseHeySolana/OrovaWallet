module.exports = function (api) {
    api.cache(true);
    return {
      presets: [
        ["babel-preset-expo", { jsxImportSource: "nativewind" }],
        "nativewind/babel",
      ],
      plugins: [
        "react-native-reanimated/plugin",
        "react-native-worklets/plugin",
      ],

      // plugins: [
      //     //     ['module:react-native-dotenv', {
      //     //         "moduleName": "@env",
      //     //         "path": ".env",
      //     //         "safe": false,
      //     //         "allowUndefined": true
      //     //     }]
      // ]
    };
};