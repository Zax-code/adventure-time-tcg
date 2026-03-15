module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo is hoisted to the root node_modules while expo-router lives in
  // apps/mobile/node_modules. babel-preset-expo's hasModule('expo-router') check fails
  // in this monorepo layout, so expoRouterBabelPlugin is never added automatically.
  // We add it explicitly here where expo-router IS resolvable.
  const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin");
  return {
    presets: ["babel-preset-expo", "nativewind/babel"],
    plugins: [expoRouterBabelPlugin],
  };
};
