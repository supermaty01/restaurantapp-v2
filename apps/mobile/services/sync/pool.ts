/**
 * Corre `worker` sobre `items` con como mucho `limit` a la vez.
 *
 * Las fotos iban de una en una, y una foto es casi toda espera: se abre la
 * conexión, se manda, se espera al servidor. Con un diario importado de v1 eso
 * son miles de esperas puestas en fila, cada una sin usar la anterior para
 * nada. Con varias en vuelo el tiempo total lo marca el ancho de banda y no la
 * latencia, que es la diferencia entre minutos y decenas de minutos.
 *
 * El tope existe porque lo contrario tampoco funciona: mil peticiones a la vez
 * las tumba el sistema operativo antes que el servidor, y en un móvil con datos
 * la primera víctima es el resto de la app.
 *
 * Los resultados salen en el orden de entrada, no en el de terminación.
 *
 * **`worker` no debe lanzar.** Si lo hace, la excepción sale de aquí y las
 * tareas en vuelo se quedan a medias, que es justo lo contrario de lo que hace
 * falta: una foto rota no puede parar a las demás. Quien llama es quien sabe
 * qué es un fallo aceptable, así que es quien lo captura — `photos.ts` envuelve
 * cada transferencia en su propio `try`.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  const width = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  const runners = Array.from({ length: width }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      // `item` existe: el índice viene del contador, no de fuera.
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}
