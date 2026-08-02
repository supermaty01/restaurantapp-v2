import type { AppNotification, NotificationKind } from './api';

/**
 * Cómo se lee cada clase de aviso en la lista de Novedades.
 *
 * Una función y no cinco componentes: lo único que cambia entre ellas es la
 * frase. El avatar, la foto, la hora y el punto de no leído son los mismos, y
 * duplicar la fila cinco veces para cambiar seis palabras es donde se acaban
 * yendo cada una por su lado.
 *
 * Fuera de la pantalla porque **la frase se afirma dos veces**: la compuesta,
 * con el nombre en negrita, y la plana para el lector de pantalla, que no puede
 * leer la primera —lo que ve es una lista de trozos con formato—. Dos textos
 * que dicen lo mismo y se escriben por separado es exactamente lo que se separa
 * sin que nadie se entere, así que aquí salen del mismo sitio y el test los
 * compara.
 *
 * ## La frase se compone así
 *
 *     prefix + **actor** + verb + place
 *
 * `prefix` está vacío en cuatro de las cinco clases, porque empiezan por el
 * nombre de quien las provocó. La quinta —el me gusta— no: «Caro le gustó tu
 * plato» le falta la preposición, y es justo la que más se va a leer.
 */
export interface NotificationSentence {
  /** Lo que va **antes** del nombre. Casi siempre vacío. */
  prefix: string;
  /** El nombre va en negrita, así que la frase llega partida. */
  verb: string;
  /** Lo que se nombra al final, resaltado. Nulo cuando no hay nada que nombrar. */
  place: string | null;
  /** La misma frase, de corrido, para quien la escucha en vez de verla. */
  plain: string;
}

/** Cómo se nombra cada clase de entrada dentro de «le gustó …». */
const LIKED_NOUN: Record<string, string> = {
  visit: 'tu visita a ',
  dish: 'tu plato ',
  restaurant: 'tu sitio ',
};

export function describeNotification(
  notification: Pick<AppNotification, 'title' | 'entityKind'> & { kind: NotificationKind },
  actor: string,
): NotificationSentence {
  const place = notification.title;

  switch (notification.kind) {
    case 'tagged_in_visit': {
      // El servidor ya descarta los avisos de visitas borradas, así que aquí
      // siempre hay sitio; el respaldo es para que un fallo suyo no acabe
      // pintando "te etiquetó en null".
      const where = place ?? 'una comida';
      return {
        prefix: '',
        verb: ' te etiquetó en ',
        place: where,
        plain: `${actor} te etiquetó en ${where}`,
      };
    }

    case 'friend_published':
      // Sin decir qué, a propósito: el aviso resume el sitio, la visita y los
      // platos de una misma comida, y nombrar solo uno de los tres sería
      // nombrar el que ganó la carrera del sync.
      return {
        prefix: '',
        verb: ' ha añadido algo nuevo',
        place: null,
        plain: `${actor} ha añadido algo nuevo`,
      };

    case 'friend_request':
      return {
        prefix: '',
        verb: ' quiere ser tu amigo',
        place: null,
        plain: `${actor} quiere ser tu amigo`,
      };

    case 'friend_accepted':
      return {
        prefix: '',
        verb: ' aceptó tu solicitud de amistad',
        place: null,
        plain: `${actor} aceptó tu solicitud de amistad`,
      };

    case 'entry_liked': {
      /*
       * «A Caro le gustó tu plato Tonkotsu».
       *
       * Con el nombre de la entrada cuando lo hay, porque es lo que distingue
       * este aviso del siguiente: quien tiene cuarenta platos compartidos y lee
       * «le gustó tu plato» cuatro veces no sabe de cuáles hablan. Y sin él
       * cuando la entrada se borró —ahí `title` llega nulo—, porque «le gustó tu
       * plato null» no dice nada.
       */
      const noun = LIKED_NOUN[notification.entityKind ?? ''] ?? 'algo tuyo';
      const verb = place ? ` le gustó ${noun}` : ` le gustó ${noun.trimEnd()}`;
      return {
        prefix: 'A ',
        verb,
        place,
        plain: `A ${actor}${verb}${place ?? ''}`,
      };
    }
  }
}
