/**
 * babel-preset-expo handles JSX, the `@/*` path alias (via the bundled module
 * resolver) and — because `react-native-worklets` is installed — automatically
 * appends the Reanimated 4 worklets plugin (which must run last). No extra
 * plugins needed.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
