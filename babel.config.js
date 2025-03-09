module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      'react-native-reanimated/plugin',
      // '@babel/plugin-proposal-export-namespace-from',
      // '@babel/plugin-transform-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '@/components': './components',
            '@/assets': './assets',
            '@/misc': './misc',
            'stream': 'stream-browserify',
            'buffer': 'buffer'
          },
        },
      ],
    ]
  };
};