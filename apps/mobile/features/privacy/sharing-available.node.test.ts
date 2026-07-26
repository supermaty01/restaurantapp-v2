import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { globSync } from '../../components/__support__/glob';

/**
 * Los controles de privacidad no salen sin cuenta.
 *
 * Sin cuenta nada sale del dispositivo, así que «quién lo ve» tiene una sola
 * respuesta posible. Ofrecer el control igualmente es peor que inútil: sugiere
 * que hay algo que decidir, y un control de privacidad que no cambia nada es
 * justo el que enseña a la gente a dejar de leer los controles de privacidad.
 *
 * La regla es fácil de romper por la mitad — se añade una pantalla nueva y se
 * olvida —, así que se comprueba en los dos sitios: que los componentes se
 * defiendan solos y que ningún sitio de uso los pinte sin preguntar.
 */

const ROOT = join(__dirname, '..', '..');

function sources(): string[] {
  return [...globSync(join(ROOT, 'app'), /\.tsx$/), ...globSync(join(ROOT, 'features'), /\.tsx$/)];
}

describe('privacidad sin cuenta', () => {
  it.each(['VisibilityControl.tsx', 'PrivacyCard.tsx'])('%s se defiende sola', (file) => {
    const source = readFileSync(join(ROOT, 'features', 'privacy', file), 'utf-8');
    expect(source).toMatch(/useSharingAvailable\(\)/);
    expect(source).toMatch(/if \(!sharing\) return null;/);
  });

  it('ninguna pantalla pinta un control de privacidad sin comprobarlo', () => {
    const offenders = sources().filter((file) => {
      if (file.includes(join('features', 'privacy'))) return false;
      const source = readFileSync(file, 'utf-8');
      const usesControl = /<(VisibilityControl|PrivacyCard|VisibilityField)\b/.test(source);
      if (!usesControl) return false;
      // Basta con que la pantalla consulte la regla: envolver la sección entera
      // es cosa suya, pero no puede ignorarla.
      return !source.includes('useSharingAvailable');
    });

    expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([]);
  });

  it('el filtro por visibilidad tampoco aparece', () => {
    // Filtrar por algo que no se puede elegir es responder a una pregunta que
    // nadie tiene.
    const sheet = readFileSync(join(ROOT, 'components', 'filters', 'FilterSheet.tsx'), 'utf-8');
    expect(sheet).toMatch(/useSharingAvailable/);
    expect(sheet).toMatch(/\{sharing \? \(/);
  });
});
