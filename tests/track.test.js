import { describe, expect, it } from 'vitest';
import { TRACK_GEN } from '../src/config/tuning.js';
import { TEST_TRACK } from '../src/track/trackData.js';
import { buildTrackSamples } from '../src/track/trackGeometry.js';
import { createAsphaltGeometry, createGrassGeometry } from '../src/track/trackMeshes.js';
import { createTrackQuery } from '../src/track/trackQuery.js';

const samples = buildTrackSamples(TEST_TRACK, TRACK_GEN.samples);
const asphalt = createAsphaltGeometry(samples);

function allFinite(array) {
  return array.every((v) => Number.isFinite(v));
}

describe('amostras da spline', () => {
  it('nao tem NaN e as tangentes/esquerdas sao unitarias e perpendiculares', () => {
    for (const key of ['px', 'pz', 'tx', 'tz', 'lx', 'lz', 'dist']) {
      expect(allFinite(Array.from(samples[key])), key).toBe(true);
    }
    for (let i = 0; i < samples.count; i++) {
      expect(Math.hypot(samples.tx[i], samples.tz[i])).toBeCloseTo(1, 6);
      expect(samples.tx[i] * samples.lx[i] + samples.tz[i] * samples.lz[i]).toBeCloseTo(0, 6);
    }
  });

  it('fecha o loop: a ultima amostra encosta na primeira com o espacamento normal', () => {
    const spacing = samples.length / samples.count;
    const last = samples.count - 1;
    const gap = Math.hypot(samples.px[0] - samples.px[last], samples.pz[0] - samples.pz[last]);
    expect(gap).toBeGreaterThan(spacing * 0.9);
    expect(gap).toBeLessThan(spacing * 1.1);
    expect(samples.length).toBeGreaterThan(300);
  });
});

describe('malha do asfalto', () => {
  const pos = asphalt.attributes.position;
  const cols = TRACK_GEN.asphaltColumns;
  const across = cols + 1; // vertices por linha
  const rows = pos.count / across;

  it('tem uma linha por amostra + a linha de fechamento', () => {
    expect(rows).toBe(samples.count + 1);
    expect(asphalt.index.count).toBe(samples.count * cols * 6);
  });

  it('fecha o loop: a ultima linha coincide com a primeira', () => {
    for (let v = 0; v < across; v++) {
      const first = v;
      const last = (rows - 1) * across + v;
      expect(pos.getX(last)).toBeCloseTo(pos.getX(first), 5);
      expect(pos.getY(last)).toBeCloseTo(pos.getY(first), 5);
      expect(pos.getZ(last)).toBeCloseTo(pos.getZ(first), 5);
    }
  });

  it('tem a largura de TrackData em todas as linhas', () => {
    for (let r = 0; r < rows; r++) {
      const l = r * across;
      const d = Math.hypot(pos.getX(l) - pos.getX(l + cols), pos.getZ(l) - pos.getZ(l + cols));
      expect(d).toBeCloseTo(TEST_TRACK.width, 4);
    }
  });

  it('nao tem NaN em position/normal/uv', () => {
    for (const name of ['position', 'normal', 'uv']) {
      expect(allFinite(Array.from(asphalt.attributes[name].array)), name).toBe(true);
    }
    expect(allFinite(Array.from(createGrassGeometry(samples).attributes.position.array))).toBe(true);
  });

  it('todos os triangulos olham para cima (+Y)', () => {
    const idx = asphalt.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
      const abx = pos.getX(b) - pos.getX(a), abz = pos.getZ(b) - pos.getZ(a);
      const acx = pos.getX(c) - pos.getX(a), acz = pos.getZ(c) - pos.getZ(a);
      const ny = abz * acx - abx * acz; // componente y de ab x ac
      expect(ny).toBeGreaterThan(0);
    }
  });
});

describe('consulta de superficie', () => {
  const query = createTrackQuery(samples);
  const out = { onAsphalt: false, index: 0, lateral: 0 };

  it('linha central e bordas internas = asfalto; fora da largura = grama', () => {
    const half = TEST_TRACK.width / 2;
    for (let i = 0; i < samples.count; i += 7) {
      const { px, pz, lx, lz } = samples;
      expect(query.surfaceAt(px[i], pz[i], -1, out).onAsphalt).toBe(true);
      expect(query.surfaceAt(px[i] + lx[i] * (half - 0.3), pz[i] + lz[i] * (half - 0.3), i, out).onAsphalt).toBe(true);
      expect(query.surfaceAt(px[i] + lx[i] * (half + 0.5), pz[i] + lz[i] * (half + 0.5), i, out).onAsphalt).toBe(false);
    }
    expect(query.surfaceAt(500, 500, -1, out).onAsphalt).toBe(false);
  });

  it('hint errado nao engana a busca', () => {
    const i = 100;
    const wrongHint = (i + samples.count / 2) % samples.count;
    expect(query.surfaceAt(samples.px[i], samples.pz[i], wrongHint, out).onAsphalt).toBe(true);
    expect(Math.abs(out.index - i)).toBeLessThanOrEqual(1);
  });
});
