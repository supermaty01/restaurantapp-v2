const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the workspace root so packages/shared resolves and hoisted
// modules are picked up. Expo's default resolver already handles the rest.
config.watchFolders = [workspaceRoot];

// Lets Drizzle migration .sql files be imported as modules.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
