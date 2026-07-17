module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Lets Drizzle migrations be imported as modules from .sql files.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
