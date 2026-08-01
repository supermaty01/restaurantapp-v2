export type RecentKind = 'visit' | 'dish' | 'restaurant';

export interface RecentEntry {
  kind: RecentKind;
  id: number;
  /** Cuándo se registró, que no es cuándo se comió. */
  createdAt: string;
  title: string;
  /** La línea de debajo: lo que la entrada añade sobre su título. */
  detail: string | null;
  imagePath: string | null;
  /** Clave en R2 de esa foto, si ya está subida: la reserva de `Photo`. */
  imageRemoteKey: string | null;
  /** Para poder absorber: de qué restaurante cuelga, si cuelga de alguno. */
  restaurantId: number | null;
  /** Solo en visitas: los platos que quedaron anotados en ella. */
  dishIds: number[];
}

/** Cuánta información lleva cada clase. Una visita ya menciona las otras dos. */
const WEIGHT: Record<RecentKind, number> = { visit: 3, dish: 2, restaurant: 1 };

/**
 * Una entrada por sesión de registro.
 *
 * Registrar una comida crea varias cosas de golpe: la visita, los platos que
 * pediste y, si el sitio era nuevo, el restaurante. Enseñarlas como tres
 * entradas separadas llena la pantalla de inicio con lo mismo contado tres
 * veces, y deja fuera lo que registraste antes.
 *
 * Así que de cada sesión se queda **la que más información lleva**: una visita
 * ya dice dónde fue y qué se comió, y un plato ya dice de qué restaurante es.
 *
 * **Lo que agrupa son las relaciones, no el reloj.** Una ventana de tiempo
 * («lo creado en los últimos diez minutos va junto») haría falso lo que agrupa:
 * dos comidas registradas seguidas del tirón se fundirían en una, y una sesión
 * lenta se partiría en dos. Los enlaces que ya existen —`dish_visit` y el
 * restaurante de cada fila— dicen exactamente qué se creó como parte de qué, y
 * no dependen de a qué velocidad escribas.
 *
 * Solo absorbe dentro de lo reciente. Una visita de hoy a un sitio de hace un
 * año no esconde nada: ese restaurante ya no estaba en la lista.
 */
export function collapseRegistrationSessions(entries: RecentEntry[], limit: number): RecentEntry[] {
  const ordered = [...entries].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    // A igual instante manda quien más cuenta, que es lo que decide la sesión.
    return WEIGHT[b.kind] - WEIGHT[a.kind];
  });

  const absorbed = new Set<string>();
  for (const entry of ordered) {
    if (entry.kind === 'visit') {
      for (const dishId of entry.dishIds) absorbed.add(`dish:${dishId}`);
    }
    // Tanto una visita como un plato ya nombran su restaurante.
    if (entry.restaurantId !== null) absorbed.add(`restaurant:${entry.restaurantId}`);
  }

  const kept: RecentEntry[] = [];
  for (const entry of ordered) {
    if (absorbed.has(`${entry.kind}:${entry.id}`)) continue;
    kept.push(entry);
    if (kept.length >= limit) break;
  }
  return kept;
}
