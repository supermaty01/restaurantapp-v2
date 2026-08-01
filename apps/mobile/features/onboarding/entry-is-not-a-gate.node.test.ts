import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La entrada de la app **no** es una puerta de login.
 *
 * Es el principio de docs/00 y docs/04 —la cuenta es una capa opcional, nunca
 * una barrera— y hasta ahora se cumplía solo porque `app/index.tsx` era un
 * `Redirect` de una línea: no había dónde meter una condición. Al añadir la
 * bienvenida sí lo hay, y la forma de romperlo es pequeñísima: un `if (!session)`
 * delante del redirect, o quitar el botón de continuar sin cuenta.
 *
 * Nadie lo haría a propósito. Se hace pidiendo «que al abrir pida la cuenta si
 * no la ha puesto», que suena razonable y convierte un diario local en una app
 * que no arranca sin conexión.
 */
const ONBOARDING = __dirname;
const ENTRY = join(ONBOARDING, '..', '..', 'app', 'index.tsx');

describe('la entrada de la app', () => {
  it('no mira la sesión para decidir a dónde va', () => {
    const source = readFileSync(ENTRY, 'utf8');

    // Ni el hook ni el objeto: cualquiera de los dos ahí dentro solo puede
    // servir para condicionar la entrada.
    expect(source).not.toMatch(/\buseAuth\b/);
    expect(source).not.toMatch(/\bsession\b/);
  });

  it('la bienvenida ofrece entrar sin cuenta, y con el mismo peso', () => {
    const welcome = readFileSync(join(ONBOARDING, 'WelcomeScreen.tsx'), 'utf8');

    const buttons = [...welcome.matchAll(/<Button\b[\s\S]*?\/>/g)].map((match) => match[0]);
    expect(buttons).toHaveLength(2);

    const [first, second] = buttons as [string, string];
    // El de seguir sin cuenta va primero: es lo que la app hace por defecto, y
    // ponerlo debajo lo convertiría en la salida de emergencia.
    expect(first).toMatch(/sin cuenta/i);
    // Y del mismo tamaño los dos. Un enlace pequeño debajo de un botón grande
    // es una puerta de login con buenos modales.
    for (const button of [first, second]) {
      expect(button).toMatch(/size="lg"/);
      expect(button).toMatch(/\bblock\b/);
    }
  });
});
