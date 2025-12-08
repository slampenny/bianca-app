module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "@babel/plugin-proposal-export-namespace-from",
      "babel-plugin-react-native-web",
      "react-native-reanimated/plugin" // must be last
    ],
  };
};
