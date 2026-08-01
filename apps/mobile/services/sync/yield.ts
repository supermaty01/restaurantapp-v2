/**
 * Devuelve el hilo de JavaScript al pintado, un instante.
 *
 * ## Por qué hace falta, si todo el sync está lleno de `await`
 *
 * Porque **el driver de SQLite es síncrono**. `drizzle-orm/expo-sqlite` usa
 * `prepareSync` / `executeSync` / `getAllSync` (ver su `session.js`), así que un
 * `await this.db.select()…` no espera a nada: la consulta ya se ha ejecutado
 * cuando se crea la promesa, y el `await` solo cede una **microtarea**.
 *
 * Las microtareas se vacían enteras antes de volver al bucle de eventos, así que
 * React no llega a pintar entre una y la siguiente. Un pull de un diario
 * importado —miles de filas, cada una con sus claves ajenas— es por tanto un
 * bloque de trabajo síncrono en el mismo hilo que dibuja: la app se queda
 * congelada hasta que termina, sin un frame.
 *
 * `setTimeout(…, 0)` sí es una **macrotarea**: cierra el turno actual y deja que
 * React procese lo que tuviera pendiente antes de seguir. Convierte el bloqueo
 * en lentitud con la interfaz viva, que es lo que se puede acompañar de un
 * indicador de avance.
 *
 * Se descartó mover el sync a un hilo aparte (`react-native-worklets`): es lo
 * correcto y es caro, porque `expo-sqlite` no es accesible desde un worklet y
 * habría que mover todo el acceso a datos. No compensa para algo que ocurre una
 * vez por instalación.
 *
 * Y se descartó ceder **por fila**: el turno del bucle de eventos cuesta más que
 * aplicar una fila, así que ceder en cada una multiplicaría la duración total
 * del sync para ganar una fluidez que ya se consigue cediendo por lotes.
 */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Cada cuántas filas se cede el hilo.
 *
 * Un lote de este tamaño es trabajo de sobra por debajo de un frame, así que la
 * interfaz responde; y es lo bastante grande como para que el coste del turno
 * de bucle no se note en el total.
 */
export const YIELD_EVERY = 50;
