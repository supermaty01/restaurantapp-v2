import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VISIT_FIELD, visitFromNotification } from '@/services/push/payload';

/**
 * Tocar un aviso tiene que abrir la comida de la que habla.
 *
 * Es un contrato entre dos repos del monorepo que nada comprueba: el Worker
 * mete el uuid de la visita en `data` y la app lo saca. Si uno de los dos
 * cambia el nombre del campo no falla nada — el aviso llega, se toca, y la app
 * abre la pantalla de inicio, que desde fuera es exactamente igual que un aviso
 * que no lleva a ningún sitio.
 */
describe('lo que viaja en un aviso', () => {
  it('saca la visita', () => {
    expect(visitFromNotification({ visitUuid: 'abc' })).toBe('abc');
  });

  it('aguanta lo que llegue', () => {
    // `data` viene de la red: es lo que haya puesto el remitente, no lo que
    // esperamos. Un aviso viejo, uno de otra versión o uno mal formado no puede
    // tumbar la pantalla al tocarlo.
    expect(visitFromNotification(null)).toBeNull();
    expect(visitFromNotification(undefined)).toBeNull();
    expect(visitFromNotification('abc')).toBeNull();
    expect(visitFromNotification({})).toBeNull();
    expect(visitFromNotification({ visitUuid: '' })).toBeNull();
    expect(visitFromNotification({ visitUuid: 42 })).toBeNull();
  });

  it('el Worker escribe el mismo campo que la app lee', () => {
    const worker = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'api', 'src', 'push.ts'),
      'utf8',
    );

    // `composeMessage` es quien redacta el `data`. Buscarlo en el fichero
    // entero pasaría con el nombre suelto en un comentario.
    const compose = worker.slice(worker.indexOf('export function composeMessage'));
    expect(compose).toContain(`${VISIT_FIELD}:`);
  });
});
