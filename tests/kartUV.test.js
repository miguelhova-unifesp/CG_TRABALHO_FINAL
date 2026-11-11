import { describe, expect, it } from 'vitest';
import { getKartGeometries } from '../src/kart/kartModel.js';
import {
  ATLAS_RECTS,
  ATLAS_SIZE,
  HELMET_LAYOUT,
  HELMET_SPHERE,
  HELMET_TEXTURE_SIZE,
  KART_TEXEL_DENSITY,
  TREAD_LUGS,
} from '../src/kart/kartUV.js';

/** Retangulo do atlas em UV: [u0, v0, u1, v1]. */
function uvRect([x, y, w, h]) {
  return [x / ATLAS_SIZE, 1 - (y + h) / ATLAS_SIZE, (x + w) / ATLAS_SIZE, 1 - y / ATLAS_SIZE];
}

const EPS = 1e-6;
const inside = (u, v, [u0, v0, u1, v1]) => u >= u0 - EPS && u <= u1 + EPS && v >= v0 - EPS && v <= v1 + EPS;

function rectsDisjoint() {
  const rects = Object.values(ATLAS_RECTS);
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const [ax, ay, aw, ah] = rects[a];
      const [bx, by, bw, bh] = rects[b];
      // com 8 px de margem de cada lado
      const sep = ax + aw + 16 <= bx || bx + bw + 16 <= ax || ay + ah + 16 <= by || by + bh + 16 <= ay;
      if (!sep) return false;
    }
  }
  return true;
}

describe('atlas do kart', () => {
  it('retangulos cabem no atlas e nao se sobrepoem (com margem para o mipmap)', () => {
    for (const [x, y, w, h] of Object.values(ATLAS_RECTS)) {
      expect(x).toBeGreaterThanOrEqual(8);
      expect(y).toBeGreaterThanOrEqual(8);
      expect(x + w).toBeLessThanOrEqual(ATLAS_SIZE - 8);
      expect(y + h).toBeLessThanOrEqual(ATLAS_SIZE - 8);
    }
    expect(rectsDisjoint()).toBe(true);
  });
});

for (const type of ['sport', 'sedan']) {
  describe(`UVs do kart ${type}`, () => {
    const g = getKartGeometries(type);
    const bodyRects = ['bodySide', 'bodyTop', 'bodyFront', 'bodyBack'].map((k) => uvRect(ATLAS_RECTS[k]));

    it('carcaca: todo UV cai num dos 4 retangulos da projecao em caixa, sem NaN', () => {
      const uv = g.body.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        expect(Number.isFinite(u) && Number.isFinite(v)).toBe(true);
        expect(bodyRects.some((r) => inside(u, v, r))).toBe(true);
      }
    });

    it('carcaca: densidade uniforme (px por metro) em todas as projecoes', () => {
      const pos = g.body.attributes.position;
      const uv = g.body.attributes.uv;
      let measured = 0;
      for (let i = 0; i < pos.count; i += 3) {
        const [a, b] = [i, i + 1];
        const du = (uv.getX(b) - uv.getX(a)) * ATLAS_SIZE;
        const dv = (uv.getY(b) - uv.getY(a)) * ATLAS_SIZE;
        const px = Math.hypot(du, dv);
        if (px < 4) continue; // aresta curta demais para medir
        // a projecao descarta 1 eixo: a distancia no plano projetado deve dar D px/m
        const dx = pos.getX(b) - pos.getX(a), dy = pos.getY(b) - pos.getY(a), dz = pos.getZ(b) - pos.getZ(a);
        const rect = bodyRects.findIndex((r) => inside(uv.getX(a), uv.getY(a), r));
        const meters = [Math.hypot(dz, dy), Math.hypot(dz, dx), Math.hypot(dx, dy), Math.hypot(dx, dy)][rect];
        expect(px / meters / KART_TEXEL_DENSITY).toBeCloseTo(1, 1);
        measured++;
      }
      expect(measured).toBeGreaterThan(100);
    });

    it('pneu: banda no retangulo da banda, tampas no do cubo', () => {
      const uv = g.tire.attributes.uv;
      const idx = g.tire.index;
      const [lateral, cap1, cap2] = g.tire.groups;
      const check = (group, rect) => {
        for (let j = group.start; j < group.start + group.count; j++) {
          const v = idx.getX(j);
          expect(inside(uv.getX(v), uv.getY(v), uvRect(rect))).toBe(true);
        }
      };
      check(lateral, ATLAS_RECTS.tread);
      check(cap1, ATLAS_RECTS.hub);
      check(cap2, ATLAS_RECTS.hub);
    });

    it('pneu: a emenda da banda e continua (mesma posicao, u nas 2 bordas, garras inteiras)', () => {
      const pos = g.tire.attributes.position;
      const uv = g.tire.attributes.uv;
      const radial = g.tire.parameters.radialSegments;
      const [u0, , u1] = uvRect(ATLAS_RECTS.tread);
      // CylinderGeometry: (radial + 1) colunas por anel; a coluna 0 e a ultima sao a emenda
      for (const ring of [0, 1]) {
        const a = ring * (radial + 1), b = a + radial;
        expect(pos.getX(a)).toBeCloseTo(pos.getX(b), 6);
        expect(pos.getY(a)).toBeCloseTo(pos.getY(b), 6);
        expect(pos.getZ(a)).toBeCloseTo(pos.getZ(b), 6);
        expect(uv.getX(a)).toBeCloseTo(u0, 6);
        expect(uv.getX(b)).toBeCloseTo(u1, 6);
      }
      expect(Number.isInteger(TREAD_LUGS)).toBe(true);
      // densidade da banda perto da carcaca (volta inteira = largura do retangulo)
      const circumference = 2 * Math.PI * g.tire.parameters.radiusTop;
      const density = ATLAS_RECTS.tread[2] / circumference;
      expect(Math.abs(density / KART_TEXEL_DENSITY - 1)).toBeLessThan(0.1);
    });

    it('toda geometria texturizada tem 1 UV por vertice, sem NaN', () => {
      for (const name of ['body', 'tire', 'torso', 'head', 'helmet']) {
        const geo = g[name];
        expect(geo.attributes.uv.count).toBe(geo.attributes.position.count);
        expect(Array.from(geo.attributes.uv.array).every(Number.isFinite)).toBe(true);
      }
    });

    it('torso e cabeca ficam nos seus retangulos', () => {
      for (const [name, rect] of [['torso', 'suit'], ['head', 'skin']]) {
        const uv = g[name].attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          expect(inside(uv.getX(i), uv.getY(i), uvRect(ATLAS_RECTS[rect]))).toBe(true);
        }
      }
    });
  });
}

describe('capacete (UV proprio + CanvasTexture por kart)', () => {
  const geo = getKartGeometries('sport').helmet;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const radius = Math.hypot(pos.getX(0), pos.getY(0), pos.getZ(0));

  it('v = 1 no topo, 0 na borda de baixo, proporcional a latitude', () => {
    for (let i = 0; i < pos.count; i++) {
      const theta = Math.acos(Math.max(-1, Math.min(1, pos.getY(i) / radius)));
      expect(uv.getY(i)).toBeCloseTo(1 - theta / HELMET_SPHERE.thetaLength, 4);
    }
  });

  it('HELMET_LAYOUT aponta para o lado certo (frente = +Z, esquerda = +X)', () => {
    const expected = { front: [0, 1], left: [1, 0], back: [0, -1], right: [-1, 0] };
    for (const [side, [ex, ez]] of Object.entries(expected)) {
      let found = 0;
      for (let i = 0; i < pos.count; i++) {
        const h = Math.hypot(pos.getX(i), pos.getZ(i));
        if (h < radius * 0.5) continue; // perto do polo a longitude nao tem significado
        const du = Math.abs(uv.getX(i) - HELMET_LAYOUT[side]);
        if (Math.min(du, 1 - du) > 1e-6) continue;
        expect((pos.getX(i) * ex + pos.getZ(i) * ez) / h).toBeGreaterThan(0.999);
        found++;
      }
      expect(found).toBeGreaterThan(0);
    }
  });

  it('textura com texel quadrado no equador (largura/altura = 2*pi / thetaLength)', () => {
    const ratio = HELMET_TEXTURE_SIZE.width / HELMET_TEXTURE_SIZE.height;
    expect(ratio / ((2 * Math.PI) / HELMET_SPHERE.thetaLength)).toBeCloseTo(1, 2);
  });
});
