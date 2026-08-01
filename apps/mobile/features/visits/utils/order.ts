/**
 * De la visita más reciente a la más antigua.
 *
 * Las visitas de un restaurante salían en el orden que devolviera SQLite, que es
 * el de inserción: en un sitio al que vuelves, lo primero de la lista era la
 * primera vez que fuiste —hace años— y la de anoche quedaba al final. El
 * historial de un lugar se lee siempre desde la última vez.
 *
 * Las que no tienen fecha —las importadas de la v1 (docs/09), donde la fecha era
 * opcional— van al final y no al principio: «sin fecha» no es «hace un momento»,
 * y colarlas arriba haría que lo primero que se ve de un sitio sea lo que menos
 * se sabe de él. Entre dos sin fecha decide el id, que al menos es el orden en
 * que se escribieron.
 *
 * El `visited_at` del DTO es `''` cuando no hay fecha (`mapVisitListRows`), no
 * `null`; se contemplan los dos por si el mapeador cambia de idea.
 */
export function byNewestFirst<T extends { id: number; visited_at: string | null }>(
  a: T,
  b: T,
): number {
  const left = a.visited_at ?? '';
  const right = b.visited_at ?? '';
  if (left === right) return b.id - a.id;
  if (!left) return 1;
  if (!right) return -1;
  // ISO-8601 ordena igual como texto que como fecha, y comparar cadenas evita
  // construir dos `Date` por comparación en una lista que se reordena a cada
  // cambio de la tabla.
  return right.localeCompare(left);
}
