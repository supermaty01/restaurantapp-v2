import { mapWithLimit } from '@/services/sync/pool';

describe('mapWithLimit', () => {
  it('no pasa del tope de tareas a la vez', async () => {
    let running = 0;
    let peak = 0;

    await mapWithLimit(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
      },
    );

    expect(peak).toBe(4);
  });

  it('las hace todas', async () => {
    const seen: number[] = [];
    await mapWithLimit(
      Array.from({ length: 50 }, (_, i) => i),
      6,
      async (item) => {
        seen.push(item);
      },
    );
    expect(seen).toHaveLength(50);
    expect(new Set(seen).size).toBe(50);
  });

  it('devuelve los resultados en el orden de entrada, no en el de terminación', async () => {
    const results = await mapWithLimit([30, 10, 20], 3, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });

    expect(results).toEqual([30, 10, 20]);
  });

  it('con la lista vacía no llama a nadie', async () => {
    const worker = jest.fn();
    const results = await mapWithLimit([], 4, worker);
    expect(worker).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('un tope mayor que la lista no crea tareas de más', async () => {
    let peak = 0;
    let running = 0;
    await mapWithLimit([1, 2], 10, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });
    expect(peak).toBe(2);
  });
});
