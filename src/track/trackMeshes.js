// Malhas da pista geradas a partir das amostras da spline (regra 5): asfalto, zebras, guard rails
// e grama. Os UVs tambem saem daqui, nunca sao editados a mao (ver docs/TRACK.md).
import { BufferAttribute, BufferGeometry, Group, Mesh, PlaneGeometry } from 'three';
import { TRACK_GEN } from '../config/tuning.js';

/**
 Comprimento de arco acumulado da linha deslocada `offset` metros para a esquerda da central.
 Tem count + 1 entradas: a ultima e a linha de fechamento (= comprimento total dessa linha).
 @param {import('./trackGeometry.js').TrackSamples} samples
 @param {number} offset (m, + = esquerda)
 @returns {Float64Array}
 */
export function offsetArcLength(samples, offset) {
  const { count, px, pz, lx, lz } = samples;
  const s = new Float64Array(count + 1);
  for (let r = 1; r <= count; r++) {
    const a = r - 1;
    const b = r % count;
    const dx = px[b] + lx[b] * offset - (px[a] + lx[a] * offset);
    const dz = pz[b] + lz[b] * offset - (pz[a] + lz[a] * offset);
    s[r] = s[r - 1] + Math.hypot(dx, dz);
  }
  return s;
}

/**
 Tile ajustado para caber um numero inteiro de vezes na volta: assim a linha de fechamento
 tem v inteiro e emenda com v = 0 sem salto.
 @param {number} total comprimento da volta (m)
 @param {number} nominal tile desejado (m)
 */
export function fitTileLength(total, nominal) {
  return total / Math.max(1, Math.round(total / nominal));
}

/**
 Acumula faixas (strips) numa geometria so. Cada faixa tem `rows` linhas (count + 1, com a de
 fechamento) e `k` vertices por linha; os triangulos sao orientados pela normal pedida.
 */
function createStripBuilder() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  /**
   @param {number} rows
   @param {number} across vertices por linha
   @param {(r: number, k: number, p: number[], n: number[]) => void} vertex posicao/normal do vertice
   @param {(k: number) => number} u
   @param {(r: number) => number} v
   */
  function addStrip(rows, across, vertex, u, v) {
    const first = positions.length / 3;
    const p = [0, 0, 0];
    const n = [0, 0, 0];
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < across; k++) {
        vertex(r, k, p, n);
        positions.push(p[0], p[1], p[2]);
        normals.push(n[0], n[1], n[2]);
        uvs.push(u(k), v(r));
      }
    }
    // Ordem (r,k) (r,k+1) (r+1,k): confere com a normal no 1o quad e inverte se preciso
    const at = (r, k) => (first + r * across + k) * 3;
    const a = at(0, 0), b = at(0, 1), c = at(1, 0);
    const ab = [0, 1, 2].map((j) => positions[b + j] - positions[a + j]);
    const ac = [0, 1, 2].map((j) => positions[c + j] - positions[a + j]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const flip = cross[0] * normals[a] + cross[1] * normals[a + 1] + cross[2] * normals[a + 2] < 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let k = 0; k < across - 1; k++) {
        const l0 = first + r * across + k;
        const r0 = l0 + 1;
        const l1 = l0 + across;
        const r1 = l1 + 1;
        if (flip) indices.push(l0, l1, r0, r0, l1, r1);
        else indices.push(l0, r0, l1, r0, r1, l1);
      }
    }
  }

  function build() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  return { addStrip, build };
}

/**
 Faixa horizontal entre os deslocamentos `left` e `right` (m, + = esquerda), com `columns` colunas.
 u = 0 na borda esquerda e 1 na direita; v = arco da linha media da faixa / tile ajustado.
 */
function addFlatBand(builder, samples, left, right, columns, tileNominal) {
  const { count, px, pz, lx, lz } = samples;
  const s = offsetArcLength(samples, (left + right) / 2);
  const tile = fitTileLength(s[count], tileNominal);
  builder.addStrip(
    count + 1,
    columns + 1,
    (r, k, p, n) => {
      const i = r % count;
      const d = left + ((right - left) * k) / columns;
      p[0] = px[i] + lx[i] * d;
      p[1] = TRACK_GEN.asphaltY;
      p[2] = pz[i] + lz[i] * d;
      n[0] = 0;
      n[1] = 1;
      n[2] = 0;
    },
    (k) => k / columns,
    (r) => s[r] / tile,
  );
}

/**
 Asfalto: (count + 1) linhas de (asphaltColumns + 1) vertices; a ultima linha repete a primeira
 com v = numero inteiro de tiles (emenda continua).
 @param {import('./trackGeometry.js').TrackSamples} samples
 @returns {BufferGeometry}
 */
export function createAsphaltGeometry(samples) {
  const half = samples.width / 2;
  const builder = createStripBuilder();
  addFlatBand(builder, samples, half, -half, TRACK_GEN.asphaltColumns, TRACK_GEN.uvTile.asphalt);
  return builder.build();
}

/**
 Zebras: uma faixa de curbWidth colada em cada borda do asfalto, com o mesmo esquema de UV
 (v pelo arco da linha media de cada zebra).
 @param {import('./trackGeometry.js').TrackSamples} samples
 */
export function createCurbGeometry(samples) {
  const half = samples.width / 2;
  const w = TRACK_GEN.curbWidth;
  const builder = createStripBuilder();
  addFlatBand(builder, samples, half + w, half, 1, TRACK_GEN.uvTile.curb);
  addFlatBand(builder, samples, -half, -half - w, 1, TRACK_GEN.uvTile.curb);
  return builder.build();
}

/**
 Guard rails: em cada lado, uma fita com 3 faces (frente virada para a pista, topo, tras).
 u = comprimento no perfil / perimetro (frente sobe de 0, topo, tras desce ate 1);
 v = arco da linha media do rail / tile ajustado. Faces separadas = arestas vivas na luz.
 @param {import('./trackGeometry.js').TrackSamples} samples
 */
export function createRailGeometry(samples) {
  const { count, px, pz, lx, lz } = samples;
  const { railOffset, railHeight: h, railThickness: t } = TRACK_GEN;
  const perimeter = 2 * h + t;
  const builder = createStripBuilder();

  for (const side of [1, -1]) {
    const near = side * railOffset;
    const far = side * (railOffset + t);
    const s = offsetArcLength(samples, (near + far) / 2);
    const tile = fitTileLength(s[count], TRACK_GEN.uvTile.rail);
    const v = (r) => s[r] / tile;
    // [deslocamento, altura] dos 2 vertices de cada face, normal lateral (-1 = para a pista) e u
    const faces = [
      { a: [near, 0], b: [near, h], lateral: -side, up: 0, u0: 0, u1: h / perimeter },
      { a: [near, h], b: [far, h], lateral: 0, up: 1, u0: h / perimeter, u1: (h + t) / perimeter },
      { a: [far, h], b: [far, 0], lateral: side, up: 0, u0: (h + t) / perimeter, u1: 1 },
    ];
    for (const f of faces) {
      builder.addStrip(
        count + 1,
        2,
        (r, k, p, n) => {
          const i = r % count;
          const [d, y] = k === 0 ? f.a : f.b;
          p[0] = px[i] + lx[i] * d;
          p[1] = y;
          p[2] = pz[i] + lz[i] * d;
          n[0] = lx[i] * f.lateral;
          n[1] = f.up;
          n[2] = lz[i] * f.lateral;
        },
        (k) => (k === 0 ? f.u0 : f.u1),
        v,
      );
    }
  }
  return builder.build();
}

/**
 Plano de grama cobrindo a caixa da pista + margem. UV planar no mundo (u = x / tile,
 v = -z / tile): num plano isso e exato, sem distorcao.
 @param {import('./trackGeometry.js').TrackSamples} samples
 */

export function createGrassGeometry(samples) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < samples.count; i++) {
    minX = Math.min(minX, samples.px[i]);
    maxX = Math.max(maxX, samples.px[i]);
    minZ = Math.min(minZ, samples.pz[i]);
    maxZ = Math.max(maxZ, samples.pz[i]);
  }

  const m = TRACK_GEN.grassMargin;
  const geometry = new PlaneGeometry(maxX - minX + 2 * m, maxZ - minZ + 2 * m);

  geometry.rotateX(-Math.PI / 2);
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / TRACK_GEN.grassTile, -pos.getZ(i) / TRACK_GEN.grassTile);
  }

  return geometry;
}

/**
 @param {import('./trackGeometry.js').TrackSamples} samples
 @param {{ asphalt: import('three').Material, grass: import('three').Material,
   curb: import('three').Material, rail: import('three').Material }} materials
 @returns {{ group: Group, dispose: () => void }}
 */

export function createTrackMeshes(samples, materials) {
  const asphalt = new Mesh(createAsphaltGeometry(samples), materials.asphalt);

  asphalt.name = 'asphalt';
  asphalt.receiveShadow = true;

  const grass = new Mesh(createGrassGeometry(samples), materials.grass);

  grass.name = 'grass';
  grass.receiveShadow = true;

  const curbs = new Mesh(createCurbGeometry(samples), materials.curb);

  curbs.name = 'curbs';
  curbs.receiveShadow = true;

  const rails = new Mesh(createRailGeometry(samples), materials.rail);

  rails.name = 'guardRails';
  rails.castShadow = true;
  rails.receiveShadow = true;

  const group = new Group();

  group.name = 'track';
  group.add(grass, asphalt, curbs, rails);

  return {

    group,

    dispose() {
      for (const mesh of [asphalt, grass, curbs, rails]) mesh.geometry.dispose();
      group.removeFromParent();
    },
  };
}
