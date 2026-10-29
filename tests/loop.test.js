import { describe, expect, it } from 'vitest';
import { DT, LOOP } from '../src/config/tuning.js';
import { advanceAccumulator } from '../src/core/loop.js';

describe('acumulador de passo fixo', () => {
  it('roda o numero certo de passos e guarda o resto', () => {
    let steps = 0;
    const acc = advanceAccumulator(0, DT * 3.5, () => steps++);
    expect(steps).toBe(3);
    expect(acc / DT).toBeCloseTo(0.5, 6);
  });

  it('frames de 144 Hz somam o mesmo numero de passos que 1 s de tempo', () => {
    let steps = 0;
    let acc = 0;
    for (let i = 0; i < 144; i++) acc = advanceAccumulator(acc, 1 / 144, () => steps++);
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
    expect(acc).toBeGreaterThanOrEqual(0);
    expect(acc).toBeLessThan(DT);
  });

  it('corta frames longos (aba em segundo plano)', () => {
    let steps = 0;
    advanceAccumulator(0, 10, () => steps++);
    expect(steps).toBe(Math.floor(LOOP.maxFrameTime / DT));
  });
});
