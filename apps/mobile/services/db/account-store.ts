/**
 * La cuenta con la que se está escribiendo ahora mismo, fuera de React.
 *
 * Existe por el mismo motivo que `defaultsStore`: quien necesita este dato no
 * es un componente. `newSyncValues()` lo usa para sellar cada fila nueva, y lo
 * llaman los repositorios, que son funciones normales llamadas desde
 * formularios, desde el importador y desde el motor de sync.
 *
 * La alternativa era pasar la cuenta como argumento a cada `create*` y a cada
 * `import*` — unas veinte firmas, la mayoría de las cuales no tienen ni idea de
 * que existen las cuentas ni deberían tenerla. Y con una firma nueva es
 * facilísimo olvidarse en un sitio; con esto, sellar es lo que pasa por
 * defecto.
 *
 * Lo pone `AuthContext` al cambiar la sesión, y `null` es un valor perfectamente
 * válido: significa «sin cuenta», que es el modo normal de la app.
 *
 * ## Y ahora además se puede escuchar
 *
 * Sellar filas solo necesitaba leerlo una vez, al escribir. **Leer** es otra
 * cosa: desde que las consultas filtran por cuenta (`account-scope.ts`), un
 * módulo que no avisa de sus cambios significa que cerrar sesión no repinta
 * nada — la pantalla se queda enseñando el diario de la cuenta que acaba de
 * salir hasta que algo la obligue a consultar otra vez. Que es exactamente el
 * fallo que se reportó al probar dos cuentas en el mismo móvil.
 *
 * Por eso hay suscriptores. `useSyncExternalStore` es lo que los consume, y
 * necesita que `getCurrentAccount` devuelva **el mismo valor** mientras nada
 * cambie: por eso la cuenta es una cadena o `null` y no un objeto — un objeto
 * nuevo en cada lectura haría que React se creyera que cambió siempre, y
 * repintaría en bucle.
 */
let accountUuid: string | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Lo llama `AuthContext` cuando la sesión aparece, cambia o se va. */
export function setCurrentAccount(uuid: string | null): void {
  // Sin cambio, sin aviso: `AuthContext` lo llama en cada render de su efecto,
  // y avisar de lo mismo repintaría todas las listas por nada.
  if (accountUuid === uuid) return;
  accountUuid = uuid;
  for (const listener of listeners) listener();
}

/**
 * De quién es lo que se escriba a partir de ahora.
 *
 * Devuelve `null` mientras la sesión se está recuperando al arrancar, y eso es
 * correcto: una fila escrita en ese hueco queda huérfana, y `linkLocalData` la
 * reclama en el siguiente push. Es preferible a bloquear la escritura mientras
 * se resuelve una promesa de red — la app tiene que funcionar sin ella.
 */
export function getCurrentAccount(): string | null {
  return accountUuid;
}

/** Avisa cuando la cuenta cambia. Devuelve cómo dejar de escuchar. */
export function subscribeToCurrentAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Solo para tests: devuelve el módulo a como estaba al arrancar. */
export function resetCurrentAccountForTests(): void {
  accountUuid = null;
  listeners.clear();
}
