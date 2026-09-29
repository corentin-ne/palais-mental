// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three's CommonJS entry (picked by require('three') in @react-three/fiber) calls
// process.emitWarning, which React Native does not have: the app crashed at launch.
// Every import of 'three' resolves to the ES module build instead (one shared instance).
const THREE_ESM = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: THREE_ESM };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
