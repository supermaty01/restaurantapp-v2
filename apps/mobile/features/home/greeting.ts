/**
 * El saludo de Inicio y la pregunta que lo acompaña.
 *
 * Fuera de la pantalla porque son reglas con franjas horarias, y una regla con
 * franjas se equivoca en los bordes — que es justo lo que pasó. Aquí se pueden
 * mirar las veinticuatro horas de un tirón (`greeting.node.test.ts`) en vez de
 * esperar a que den las cinco de la tarde para descubrir qué dice.
 *
 * ## Qué estaba mal
 *
 * Eran tres franjas —hasta las 11 desayuno, hasta las 17 comida, y a partir de
 * ahí cena— y las tres preguntaban **en pasado**. Así que a las 11:30 la app
 * preguntaba «¿qué comiste hoy?» dos horas antes de que nadie hubiera comido, y
 * a las 17:00 preguntaba «¿dónde has cenado?» con tres o cuatro horas de
 * adelanto. Una pregunta en pasado sobre algo que aún no ha pasado no es un
 * detalle de redacción: es la app pidiendo que registres una comida inexistente.
 *
 * Ahora hay dos cosas distintas:
 *
 * 1. **Las franjas se ajustan a cuándo se come de verdad** —comida de 13 a 17,
 *    cena de 20 en adelante—, con las horas de en medio como lo que son: huecos
 *    entre comidas.
 * 2. **El tiempo verbal sigue a la franja.** Durante y después de una comida se
 *    pregunta en pasado («¿qué comiste hoy?»); antes, la pregunta mira adelante
 *    («¿comes fuera hoy?»). El hueco de la tarde no inventa una comida: pregunta
 *    por el café o la merienda, que es lo que ocurre a esa hora.
 *
 * La madrugada tiene franja propia y no se cuelga de «buenas noches» a secas: a
 * las dos de la mañana la cena ya ha pasado, y preguntar «¿dónde vas a cenar?»
 * es lo mismo que se arregla arriba, con el reloj al otro lado.
 */

/** Una franja del día, con lo que se dice en ella. */
interface Band {
  /** Hora en la que empieza, inclusive. La siguiente franja la cierra. */
  from: number;
  greeting: string;
  /** La pregunta, ya partida en dos líneas: es un titular, no un párrafo. */
  prompt: string;
}

/**
 * El día, en orden. Cada franja va desde su `from` hasta el `from` de la
 * siguiente; la última envuelve hasta medianoche.
 *
 * Las horas están elegidas para un horario español o colombiano, que es donde
 * se usa la app: se come a partir de la una o las dos, y se cena a partir de las
 * ocho o las nueve. No es universal y no pretende serlo — una franja que intente
 * valer para todos los husos acaba sin decir nada en ninguno.
 */
const BANDS: readonly Band[] = [
  // Madrugada: lo de anoche todavía cuenta como anoche.
  { from: 0, greeting: 'Buenas noches', prompt: '¿Saliste\na cenar anoche?' },
  { from: 6, greeting: 'Buenos días', prompt: '¿Desayunaste\nen algún sitio?' },
  // El hueco antes de comer. Mirando adelante, que es lo único honesto a esta
  // hora: nadie ha comido todavía.
  { from: 12, greeting: 'Buenos días', prompt: '¿Comes fuera\nhoy?' },
  { from: 13, greeting: 'Buenas tardes', prompt: '¿Qué comiste\nhoy?' },
  // Ni comida ni cena. Un café o una merienda es lo que de verdad pasa aquí, y
  // también se apunta.
  { from: 17, greeting: 'Buenas tardes', prompt: '¿Un café\no una merienda?' },
  { from: 20, greeting: 'Buenas noches', prompt: '¿Dónde has\ncenado?' },
] as const;

/** La franja a la que pertenece una hora del reloj (0–23). */
function bandFor(hour: number): Band {
  const clamped = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : 0;
  // De atrás hacia delante: la primera cuyo comienzo ya ha pasado es la suya.
  // `BANDS[0]` empieza a las 0, así que siempre hay una.
  let found = BANDS[0] as Band;
  for (const band of BANDS) {
    if (clamped >= band.from) found = band;
  }
  return found;
}

/** El saludo, que sigue al reloj del dispositivo. */
export function greeting(hour: number): string {
  return bandFor(hour).greeting;
}

/** Una pregunta y no un titular, para que la pantalla invite en vez de informar. */
export function prompt(hour: number): string {
  return bandFor(hour).prompt;
}
