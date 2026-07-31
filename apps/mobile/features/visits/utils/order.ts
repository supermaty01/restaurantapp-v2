/**
 * De la visita más reciente a la más antigua.
 *
 * Las que no tienen fecha —las importadas de la v1 (docs/09)— van al final y no
 * al principio: «sin fecha» no es «hace un momento», y colarlas arriba haría que
 * lo primero que se ve de un sitio sea lo que menos se sabe de él. Entre dos sin
 * fecha decide el id, que al menos es el orden en que se escribieron.
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
  return right.localeCompare(left);
}
