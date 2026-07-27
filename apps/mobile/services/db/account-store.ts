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
 */
let accountUuid: string | null = null;

/** Lo llama `AuthContext` cuando la sesión aparece, cambia o se va. */
export function setCurrentAccount(uuid: string | null): void {
  accountUuid = uuid;
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

/** Solo para tests: devuelve el módulo a como estaba al arrancar. */
export function resetCurrentAccountForTests(): void {
  accountUuid = null;
}
