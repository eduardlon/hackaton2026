module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // SDK 54 (Expo Go publicado en stores) trae un Hermes que NO soporta
      // todavía `#privateField` ni `#privateMethod`. Forzamos el perfil
      // `hermes-v0` para que babel-preset-expo los transpile a equivalentes ES5 vía:
      //   - @babel/plugin-transform-class-properties
      //   - @babel/plugin-transform-private-methods
      //   - @babel/plugin-transform-private-property-in-object
      // Sin esto, react-native-reanimated@4 (usa `#workletsModule`) hace que
      // Hermes lance:  SyntaxError: private properties are not supported
      ['babel-preset-expo', { unstable_transformProfile: 'hermes-v0' }],
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
