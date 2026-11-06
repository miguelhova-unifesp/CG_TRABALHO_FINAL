// Exporta imagens do layout UV (wireframe dos UVs sobre a textura) para docs/img/.
// Uso: npm run uv-layouts  (depois de npm run textures)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { TRACK_GEN } from '../src/config/tuning.js';
import { getKartGeometries } from '../src/kart/kartModel.js';
import { TEST_TRACK } from '../src/track/trackData.js';
import { buildTrackSamples, tightestSampleIndex } from '../src/track/trackGeometry.js';
import { createAsphaltGeometry, createCurbGeometry, createRailGeometry } from '../src/track/trackMeshes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEX = join(ROOT, 'public', 'textures');
const OUT = join(ROOT, 'docs', 'img');

const fract = (x) => x - Math.floor(x);

function readTexture(name) {
  return PNG.sync.read(readFileSync(join(TEX, `${name}.png`)));
}

function createCanvas(w, h) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4).fill(255) };
}

function save(name, c) {
  const png = new PNG({ width: c.w, height: c.h });
  png.data.set(c.data);
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`docs/img/${name}.png  ${c.w}x${c.h}`);
}

/** Amostra a textura em (u, v) com repeat (flipY: linha 0 da imagem = v = 1). */
function sample(tex, u, v, repeat = [1, 1], clamp = false) {
  let s = u * repeat[0], t = v * repeat[1];
  if (clamp) {
    s = Math.min(Math.max(s, 0), 0.999999);
    t = Math.min(Math.max(t, 0), 0.999999);
  } else {
    s = fract(s);
    t = fract(t);
  }
  const x = Math.floor(s * tex.width);
  const y = Math.floor((1 - t) * tex.height) % tex.height;
  const i = (y * tex.width + x) * 4;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2]];
}

function plot(c, x, y, rgb, alpha = 1) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  for (let k = 0; k < 3; k++) c.data[i + k] = c.data[i + k] * (1 - alpha) + rgb[k] * alpha;
}

function line(c, x0, y0, x1, y1, rgb, alpha = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
  for (let k = 0; k <= n; k++) plot(c, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, rgb, alpha);
}

/** Itera os triangulos de uma geometria indexada ou nao: fn(ia, ib, ic). */
function triangles(geometry, fn, filter = () => true) {
  const index = geometry.index;
  const n = index ? index.count : geometry.attributes.position.count;
  for (let j = 0; j < n; j += 3) {
    const [a, b, c] = index ? [index.getX(j), index.getX(j + 1), index.getX(j + 2)] : [j, j + 1, j + 2];
    if (filter(a, b, c)) fn(a, b, c);
  }
}

/** Fundo = textura no espaco UV [u0,u1] x [v0,v1]. */
function uvBackground(c, tex, [u0, u1, v0, v1], repeat, clamp) {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const u = u0 + ((x + 0.5) / c.w) * (u1 - u0);
      const v = v1 - ((y + 0.5) / c.h) * (v1 - v0);
      const rgb = sample(tex, u, v, repeat, clamp);
      const i = (y * c.w + x) * 4;
      c.data[i] = rgb[0] * 0.8; // escurece um pouco para o wireframe aparecer
      c.data[i + 1] = rgb[1] * 0.8;
      c.data[i + 2] = rgb[2] * 0.8;
    }
  }
}

/** Wireframe dos UVs; vShift permite trazer o fim da volta para perto de v = 0. */
function uvWireframe(c, geometry, [u0, u1, v0, v1], rgb, { vShift = () => 0, filter } = {}) {
  const uv = geometry.attributes.uv;
  const X = (u) => ((u - u0) / (u1 - u0)) * c.w;
  const Y = (v) => (1 - (v - v0) / (v1 - v0)) * c.h;
  triangles(geometry, (a, b, d) => {
    const s = vShift(a, b, d);
    const p = [a, b, d].map((k) => [X(uv.getX(k)), Y(uv.getY(k) + s)]);
    for (let e = 0; e < 3; e++) line(c, ...p[e], ...p[(e + 1) % 3], rgb, 0.9);
  }, filter);
}

// kart

function kartLayouts() {
  const atlas = readTexture('kart_atlas');
  const parts = [
    ['body', [255, 40, 40]],
    ['tire', [255, 210, 0]],
    ['torso', [0, 200, 255]],
    ['head', [0, 255, 120]],
    ['helmet', [255, 0, 255]],
  ];
  for (const type of ['sport', 'sedan']) {
    const g = getKartGeometries(type);
    const c = createCanvas(atlas.width, atlas.height);
    uvBackground(c, atlas, [0, 1, 0, 1], [1, 1], true);
    for (const [name, rgb] of parts) uvWireframe(c, g[name], [0, 1, 0, 1], rgb);
    save(`uv_kart_${type}`, c);
  }
}

// pista

const samples = buildTrackSamples(TEST_TRACK, TRACK_GEN.samples);
const asphalt = createAsphaltGeometry(samples);
const curbs = createCurbGeometry(samples);
const rails = createRailGeometry(samples);

function trackUvLayouts() {
  const across = TRACK_GEN.asphaltColumns + 1;
  const rows = samples.count + 1;
  const uv = asphalt.attributes.uv;
  const vEnd = uv.getY((rows - 1) * across); // inteiro (emenda)

  // Emenda: ultimo tile deslocado de -vEnd fica em [-1, 0]; primeiro tile em [0, 1]
  const win = [0, 1, -1, 1];
  const c = createCanvas(512, 1024);
  uvBackground(c, readTexture('asphalt_color'), win, [3, 3]);
  uvWireframe(c, asphalt, win, [255, 255, 0], {
    vShift: (a) => (uv.getY(a) > vEnd / 2 ? -vEnd : 0),
    filter: (a) => uv.getY(a) < 1.01 || uv.getY(a) > vEnd - 1.01,
  });
  line(c, 0, c.h / 2, c.w, c.h / 2, [255, 60, 60]); // v = 0 = linha de largada/emenda
  save('uv_asphalt_seam', c);

  const curbWin = [0, 1, 0, 2];
  const cc = createCanvas(256, 1024);
  uvBackground(cc, readTexture('curb_color'), curbWin);
  uvWireframe(cc, curbs, curbWin, [0, 120, 255], { filter: (a) => curbs.attributes.uv.getY(a) < 2.01 });
  save('uv_curb', cc);

  const railWin = [0, 1, 0, 2];
  const rc = createCanvas(512, 1024);
  uvBackground(rc, readTexture('guardrail_color'), railWin);
  uvWireframe(rc, rails, railWin, [255, 0, 200], { filter: (a) => rails.attributes.uv.getY(a) < 2.01 });
  save('uv_guardrail', rc);
}

/** Vista de cima (mundo) com o checker interpolado de forma afim em cada triangulo. */
function worldChecker(name, cx, cz, half) {
  const checker = readTexture('uv_checker');
  const curbTex = readTexture('curb_color');
  const S = 1024;
  const c = createCanvas(S, S);
  for (let i = 0; i < S * S; i++) c.data.set([70, 120, 60, 255], i * 4); // grama
  const X = (x) => ((x - cx) / (2 * half) + 0.5) * S;
  const Y = (z) => ((z - cz) / (2 * half) + 0.5) * S; // +Z para baixo: vista de cima sem espelhar

  for (const [geometry, tex] of [[asphalt, checker], [curbs, curbTex]]) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    triangles(geometry, (a, b, d) => {
      const P = [a, b, d].map((k) => [X(pos.getX(k)), Y(pos.getZ(k)), uv.getX(k), uv.getY(k)]);
      const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])));
      const maxX = Math.min(S - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])));
      const maxY = Math.min(S - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      if (minX > maxX || minY > maxY) return;
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(area) < 1e-9) return;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w1 = ((px - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (py - P[0][1])) / area;
          const w2 = ((P[1][0] - P[0][0]) * (py - P[0][1]) - (px - P[0][0]) * (P[1][1] - P[0][1])) / area;
          const w0 = 1 - w1 - w2;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const u = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
          const v = w0 * P[0][3] + w1 * P[1][3] + w2 * P[2][3];
          const rgb = sample(tex, u, v);
          c.data.set([rgb[0], rgb[1], rgb[2], 255], (y * S + x) * 4);
        }
      }
    });
    triangles(geometry, (a, b, d) => {
      const p = [a, b, d].map((k) => [X(pos.getX(k)), Y(pos.getZ(k))]);
      for (let e = 0; e < 3; e++) line(c, ...p[e], ...p[(e + 1) % 3], [20, 20, 20], 0.35);
    });
  }
  save(name, c);
}

mkdirSync(OUT, { recursive: true });
kartLayouts();
trackUvLayouts();
worldChecker('world_checker_seam', samples.px[0], samples.pz[0], 16);
const h = tightestSampleIndex(samples);
worldChecker('world_checker_hairpin', samples.px[h], samples.pz[h], 18);
