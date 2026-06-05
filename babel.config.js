module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
     alias: {
  '@features':       './src/features',
  '@shared':         './src/shared',
  '@infrastructure': './src/infrastructure',
  '@core':           './src/core',
  '@assets':         './assets',
},
      }],
      'react-native-reanimated/plugin',
    ],
  };
};
