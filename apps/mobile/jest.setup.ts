import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
}));

// El módulo nativo del teclado no existe en jest. La propia librería trae el
// doble, así que no hay que inventarse uno que se desactualice.
jest.mock('react-native-keyboard-controller', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-keyboard-controller/jest'),
);
