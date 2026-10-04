// Линтер для мобильного клиента: правила Expo плюс игнор сборочных папок.
const expo = require('eslint-config-expo/flat');
module.exports = [
  ...expo,
  { ignores: ['dist/*', 'node_modules/*', '.expo/*'] },
];
