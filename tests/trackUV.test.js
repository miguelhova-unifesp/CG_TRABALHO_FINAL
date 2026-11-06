import { describe, expect, it } from 'vitest';
import { TRACK_GEN } from '../src/config/tuning.js';
import { TEST_TRACK } from '../src/track/trackData.js';
import { buildTrackSamples } from '../src/track/trackGeometry.js';
import {
  createAsphaltGeometry,
  createCurbGeometry,
  createGrassGeometry,
  createRailGeometry,
  fitTileLength,
  offsetArcLength,
} from '../src/track/trackMeshes.js';

const samples = buildTrackSamples(TEST_TRACK, TRACK_GEN.samples);
const rows = samples.count + 1;
const half = TEST_TRACK.width / 2;

/** Divide a geometria nas faixas que o gerador emitiu, na ordem: [{ first, across }]. */
function strips(geometry, across, n) {
  const list = [];
  for (let k = 0; k < n; k++) list.push({ first: k * rows * across, across });
  expect(geometry.attributes.position.count).toBe(n * rows * across);
  return list;
}

const meshes = {
  asfalto: { geometry: createAsphaltGeometry(samples), across: TRACK_GEN.asphaltColumns + 1, n: 1 },
  zebras: { geometry: createCurbGeometry(samples), across: 2, n: 2 },
  'guard rails': { geometry: createRailGeometry(samples), across: 2, n: 6 },
};

for (const [name, { geometry, across, n }] of Object.entries(meshes)) {
  describe(`UV gerado: ${name}`, () => {
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    const list = strips(geometry, across, n);

    it('nao tem NaN e u fica em [0, 1]', () => {
      expect(Array.from(uv.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < uv.count; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getX(i)).toBeLessThanOrEqual(1);
      }
    });

    it('v comeca em 0 e cresce estritamente ao longo do tracado', () => {
      for (const { first, across: a } of list) {
        for (let k = 0; k < a; k++) {
          expect(uv.getY(first + k)).toBe(0);
          for (let r = 1; r < rows; r++) {
            expect(uv.getY(first + r * a + k)).toBeGreaterThan(uv.getY(first + (r - 1) * a + k));
          }
        }
      }
    });

    it('emenda: a linha de fechamento repete a 1a em posicao e tem v inteiro', () => {
      for (const { first, across: a } of list) {
        for (let k = 0; k < a; k++) {
          const i0 = first + k;
          const iN = first + (rows - 1) * a + k;
          expect(pos.getX(iN)).toBeCloseTo(pos.getX(i0), 4);
          expect(pos.getY(iN)).toBeCloseTo(pos.getY(i0), 4);
          expect(pos.getZ(iN)).toBeCloseTo(pos.getZ(i0), 4);
          // com texture.repeat inteiro, v inteiro no fim = mesma fase de v = 0 no comeco
          const vEnd = uv.getY(iN);
          expect(Math.abs(vEnd - Math.round(vEnd))).toBeLessThan(1e-4);
          expect(uv.getX(iN)).toBe(uv.getX(i0));
        }
      }
    });
  });
}

describe('UV sem esticar ao longo do tracado', () => {
  it('na linha central do asfalto, dv * tile = distancia percorrida (retas e curvas)', () => {
    const g = meshes.asfalto.geometry;
    const a = meshes.asfalto.across;
    const mid = TRACK_GEN.asphaltColumns / 2;
    const tile = fitTileLength(samples.length, TRACK_GEN.uvTile.asphalt);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let r = 1; r < rows; r++) {
      const i = r * a + mid, j = (r - 1) * a + mid;
      const ds = Math.hypot(pos.getX(i) - pos.getX(j), pos.getZ(i) - pos.getZ(j));
      expect((uv.getY(i) - uv.getY(j)) * tile).toBeCloseTo(ds, 3);
    }
  });

  it('o tile ajustado fica perto do nominal e cabe um numero inteiro de vezes', () => {
    for (const [key, offset] of [['asphalt', 0], ['curb', half + 0.5], ['rail', TRACK_GEN.railOffset]]) {
      const total = offsetArcLength(samples, offset)[samples.count];
      const tile = fitTileLength(total, TRACK_GEN.uvTile[key]);
      expect(Math.abs(tile / TRACK_GEN.uvTile[key] - 1)).toBeLessThan(0.1);
      expect(Math.abs(total / tile - Math.round(total / tile))).toBeLessThan(1e-9);
    }
  });

  it('nas bordas do asfalto o fator de escala e 1 nas retas e 1 - k*d nas curvas', () => {
    // Limitacao documentada (docs/TRACK.md): faixa de largura constante numa curva nao desenrola
    // sem distorcao. Aqui so confirmamos que o erro e o geometrico esperado, nada alem disso.
    const g = meshes.asfalto.geometry;
    const a = meshes.asfalto.across;
    const pos = g.attributes.position;
    const tile = fitTileLength(samples.length, TRACK_GEN.uvTile.asphalt);
    let straight = 0;
    for (let r = 1; r < rows; r++) {
      const i = (r - 1) % samples.count, j = r % samples.count;
      const cross = samples.tx[i] * samples.tz[j] - samples.tz[i] * samples.tx[j];
      const ds = samples.length / samples.count;
      const kappa = -Math.asin(Math.max(-1, Math.min(1, cross))) / ds; // + = curva a esquerda (heading cresce)
      const dv = g.attributes.uv.getY(r * a) - g.attributes.uv.getY((r - 1) * a);
      // vertice 0 = borda esquerda (d = +half)
      const edge = Math.hypot(pos.getX(r * a) - pos.getX((r - 1) * a), pos.getZ(r * a) - pos.getZ((r - 1) * a));
      const scale = edge / (dv * tile);
      expect(scale).toBeCloseTo(1 - kappa * half, 1);
      if (Math.abs(kappa) < 2e-3) {
        // reta (raio > 500 m): sem esticar, erro < 1.5%
        expect(Math.abs(scale - 1)).toBeLessThan(0.015);
        straight++;
      }
    }
    expect(straight).toBeGreaterThan(20); // a pista tem retas de verdade
  });
});

describe('guard rails', () => {
  it('a fita nao dobra: cada segmento anda no sentido da pista (inclusive no grampo)', () => {
    const g = meshes['guard rails'].geometry;
    const pos = g.attributes.position;
    for (let face = 0; face < 6; face++) {
      const first = face * rows * 2;
      for (let r = 1; r < rows; r++) {
        const i = first + r * 2, j = first + (r - 1) * 2;
        const s = (r - 1) % samples.count;
        const dot = (pos.getX(i) - pos.getX(j)) * samples.tx[s] + (pos.getZ(i) - pos.getZ(j)) * samples.tz[s];
        expect(dot).toBeGreaterThan(0);
      }
    }
  });
});

describe('grama', () => {
  it('UV planar no mundo: uv * grassTile = (x, -z)', () => {
    const g = createGrassGeometry(samples);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      expect(uv.getX(i) * TRACK_GEN.grassTile).toBeCloseTo(pos.getX(i), 4);
      expect(uv.getY(i) * TRACK_GEN.grassTile).toBeCloseTo(-pos.getZ(i), 4);
    }
  });
});
