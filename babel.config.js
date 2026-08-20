module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Preset otomatik eklerse plugin iki kez uygulanır; biz en sonda açıkça ekliyoruz.
          reanimated: false,
          worklets: false,
        },
      ],
    ],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
