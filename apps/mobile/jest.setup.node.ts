/**
 * Lo que la app da por hecho del entorno, para los tests de node.
 *
 * `babel-preset-expo` convierte cada `process.env.EXPO_PUBLIC_*` en una lectura
 * hecha **al cargar el módulo**, así que ponerla dentro de un test llega tarde.
 * Y sin ella, un módulo como `services/sync/photos` se comporta como una app sin
 * configurar: se rinde antes de hacer nada y los tests fallan diciendo que no
 * subió ninguna foto, que es cierto pero por el motivo equivocado.
 *
 * `??=`, no `=`: si alguien exporta la variable de verdad para depurar contra un
 * Worker real, gana la suya.
 */
process.env.EXPO_PUBLIC_API_URL ??= 'https://api.test';
