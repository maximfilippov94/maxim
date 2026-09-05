module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 вынес воркеты в отдельный пакет; плагин обязан быть последним
    plugins: ['react-native-worklets/plugin'],
  };
};
