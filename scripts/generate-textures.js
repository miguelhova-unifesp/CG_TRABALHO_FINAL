// Gera as texturas PNG do jogo em public/textures/ de forma deterministica (seed fixa).
// Uso: npm run textures

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createRng } from '../src/core/rng.js';
import { ATLAS_RECTS, ATLAS_SIZE, BODY_FRAME, TREAD_LUGS } from '../src/kart/kartUV.js';
import { TRACK_GEN } from '../src/config/tuning.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'textures');
const SEED = 20261105;

// utilitarios

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mod = (a, n) => ((a % n) + n) % n;
const fract = (x) => x - Math.floor(x);

/** Imagem RGB em float [0,1]. */
function createImage(w, h) {
  return { w, h, data: new Float32Array(w * h * 3) };
}

function setPixel(img, x, y, r, g, b) {
  const i = (y * img.w + x) * 3;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
}

function fillImage(img, fn) {
  const c = [0, 0, 0];
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      fn(x, y, c);
      setPixel(img, x, y, c[0], c[1], c[2]);
    }
  }
}

function writePng(name, img) {
  const png = new PNG({ width: img.w, height: img.h });
  for (let i = 0, j = 0; i < img.w * img.h; i++, j += 3) {
    png.data[i * 4] = Math.round(clamp01(img.data[j]) * 255);
    png.data[i * 4 + 1] = Math.round(clamp01(img.data[j + 1]) * 255);
    png.data[i * 4 + 2] = Math.round(clamp01(img.data[j + 2]) * 255);
    png.data[i * 4 + 3] = 255;
  }
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, PNG.sync.write(png));
  console.log(`${name}.png  ${img.w}x${img.h}`);
}

/** Ruido de valor periodico (periodo px x py celulas), interpolacao quintica. */
function valueNoise(rng, px, py) {
  const lattice = new Float32Array(px * py);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
  const at = (i, j) => lattice[mod(j, py) * px + mod(i, px)];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const sx = fade(x - xi), sy = fade(y - yi);
    const a = mix(at(xi, yi), at(xi + 1, yi), sx);
    const b = mix(at(xi, yi + 1), at(xi + 1, yi + 1), sx);
    return mix(a, b, sy);
  };
}

/**
 Soma de oitavas (fbm) amostrada na imagem inteira; periodica porque cada oitava tem um numero
 inteiro de celulas na largura e na altura. Saida em [0,1].
 */
function fbm(rng, w, h, cellsX, cellsY, octaves, gain = 0.5) {
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = cellsX << o, cy = cellsY << o;
    const n = valueNoise(rng, cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) out[y * w + x] += amp * n((x / w) * cx, (y / h) * cy);
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/**
 Normal map (espaco tangente, convencao OpenGL: verde = +V) a partir de uma altura.
 A imagem e carregada com flipY, entao a linha de cima e v = 1: dh/dv = h(y-1) - h(y+1).
 */
function normalFromHeight(height, w, h, strength, { wrapX = true, wrapY = true } = {}) {
  const img = createImage(w, h);
  const H = (x, y) => {
    x = wrapX ? mod(x, w) : Math.min(w - 1, Math.max(0, x));
    y = wrapY ? mod(y, h) : Math.min(h - 1, Math.max(0, y));
    return height[y * w + x];
  };
  fillImage(img, (x, y, c) => {
    const du = (H(x + 1, y) - H(x - 1, y)) / 2;
    const dv = (H(x, y - 1) - H(x, y + 1)) / 2;
    let nx = -du * strength, ny = -dv * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    c[0] = nx * 0.5 + 0.5;
    c[1] = ny * 0.5 + 0.5;
    c[2] = nz * 0.5 + 0.5;
  });
  return img;
}

/** Espalha "pedras" (discos) periodicos: chama fn(x, y, k, peso) para cada pixel coberto. */
function scatterDiscs(rng, w, h, count, rMin, rMax, fn) {
  for (let k = 0; k < count; k++) {
    const cx = rng() * w, cy = rng() * h, r = mix(rMin, rMax, rng()), kind = rng();
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d < 1) fn(mod(x, w), mod(y, h), kind, 1 - d * d);
      }
    }
  }
}

// fonte bitmap 3x5 (checker) 

const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', U: '101101101101111', V: '101101101101010',
};

function drawText(img, text, x0, y0, scale, rgb) {
  [...text].forEach((ch, n) => {
    const g = GLYPHS[ch];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy * 3 + gx] !== '1') continue;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            setPixel(img, x0 + (n * 4 + gx) * scale + x, y0 + gy * scale + y, ...rgb);
          }
        }
      }
    }
  });
}

function drawRect(img, x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(img, x, y, ...rgb);
}

function hsl(hue, s, l) {
  const k = (n) => mod(n + hue * 12, 12);
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

// pista 

function asphalt(rng) {
  const S = 1024;
  const base = fbm(rng, S, S, 8, 8, 6);
  const patches = fbm(rng, S, S, 4, 4, 3);
  const height = new Float32Array(S * S);
  const stone = new Float32Array(S * S); // -1 escura, +1 clara, 0 nenhuma
  for (let i = 0; i < height.length; i++) height[i] = base[i] * 0.6;
  scatterDiscs(rng, S, S, 14000, 1.2, 3.2, (x, y, kind, wgt) => {
    const i = y * S + x;
    height[i] = Math.max(height[i], 0.6 + wgt * 0.8);
    stone[i] = kind < 0.6 ? 1 : -1;
  });

  const color = createImage(S, S);
  const rough = createImage(S, S);

  fillImage(color, (x, y, c) => {
    const i = y * S + x;
    const tar = smooth(0.64, 0.7, patches[i]); // remendos de piche mais escuros/lisos
    let l = 0.37 + (base[i] - 0.5) * 0.12 - tar * 0.04;
    if (stone[i] > 0) l = mix(l, 0.55, 0.45);
    else if (stone[i] < 0) l = mix(l, 0.25, 0.45);
    c[0] = l * 0.97; c[1] = l * 0.99; c[2] = l * 1.06; // cinza levemente azulado (estilizado)
  });

  fillImage(rough, (x, y, c) => {
    const i = y * S + x;
    const tar = smooth(0.64, 0.7, patches[i]);
    let r = 0.9 + (base[i] - 0.5) * 0.1 - tar * 0.2;
    if (stone[i] !== 0) r -= 0.15;
    c[0] = c[1] = c[2] = r;
  });

  writePng('asphalt_color', color);
  writePng('asphalt_normal', normalFromHeight(height, S, S, 2.2));
  writePng('asphalt_roughness', rough);
}

function grass(rng) {
  const S = 512;
  const base = fbm(rng, S, S, 6, 6, 5);
  const blades = new Float32Array(S * S);

  // tufos: tracos curtos verticais, claros ou escuros
  
  for (let k = 0; k < 9000; k++) {
    const x0 = Math.floor(rng() * S), y0 = Math.floor(rng() * S), len = 3 + Math.floor(rng() * 6);
    const tone = rng() < 0.5 ? 1 : -1;
    for (let j = 0; j < len; j++) blades[mod(y0 - j, S) * S + mod(x0 + (j >> 2), S)] = tone;
  }
  
  const img = createImage(S, S);
  
  fillImage(img, (x, y, c) => {
    const i = y * S + x;
    // faixas de corte (2 por tile = faixas de grassTile/2 m no mundo), bordas suaves e periodicas
    const stripe = 0.5 + 0.5 * Math.cos((y / S) * Math.PI * 2);
    let k = 0.9 + (base[i] - 0.5) * 0.35 + (stripe - 0.5) * 0.16 + blades[i] * 0.07;
    c[0] = 0.33 * k; c[1] = 0.63 * k; c[2] = 0.2 * k;
  });

  writePng('grass_color', img);
}

function curb(rng) {
  const W = 256, H = 512; // u = 1 m na largura, v = 2 m ao longo (1 bloco vermelho + 1 branco)
  const n = fbm(rng, W, H, 4, 8, 4);
  const img = createImage(W, H);
  
  fillImage(img, (x, y, c) => {
    const i = y * W + x;
    const t = y / H;
    // bordas entre blocos levemente suavizadas (sem serrilhado no mipmap)
    const red = smooth(0.0, 0.01, t) * (1 - smooth(0.49, 0.5, t));
    const edge = Math.min(x, W - 1 - x) < 8 ? 0.8 : 1; // filete escuro nas 2 bordas
    const wear = 0.94 + (n[i] - 0.5) * 0.16;
    const k = edge * wear;
    c[0] = mix(0.93, 0.86, red) * k;
    c[1] = mix(0.93, 0.13, red) * k;
    c[2] = mix(0.9, 0.12, red) * k;
  });
  
  writePng('curb_color', img);
}

function guardrail(rng) {
  const W = 512, H = 256; // x = u (perfil: frente, topo, tras), y = v (rail.uvTile m ao longo)
  const { railHeight: rh, railThickness: rt, uvTile } = TRACK_GEN;
  const P = 2 * rh + rt; // perimetro do perfil (m)
  const tileM = uvTile.rail;
  const n = fbm(rng, W, H, 8, 4, 5);
  const rust = fbm(rng, W, H, 8, 4, 3);
  const BAND = [0.38, 0.74]; // m - faixa da lamina ondulada (W-beam) na face da frente
  const height = new Float32Array(W * H);
  const color = createImage(W, H);
  const rough = createImage(W, H);

  for (let y = 0; y < H; y++) {
    const along = (y / H) * tileM; // m ao longo do tile
    const fromPost = Math.abs(along - tileM / 2); // poste e parafuso no meio do tile
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p = ((x + 0.5) / W) * P;
      const rustK = smooth(0.78, 0.82, rust[i]) * 0.5;
      let col, r, hgt = 0.5 + (n[i] - 0.5) * 0.15;
      if (p < rh) {
        const yy = p; // altura na face da frente
        if (yy >= BAND[0] && yy <= BAND[1]) {
          const t = (yy - BAND[0]) / (BAND[1] - BAND[0]);
          const wave = 0.5 - 0.5 * Math.cos(t * Math.PI * 4); // 2 ondas
          hgt = 0.3 + wave * 0.7 + (n[i] - 0.5) * 0.1;
          const bolt = Math.hypot(fromPost, yy - (BAND[0] + BAND[1]) / 2) / 0.03;
          if (bolt < 1) hgt += (1 - bolt * bolt) * 0.6;
          const l = 0.66 + wave * 0.12 + (n[i] - 0.5) * 0.1 - (bolt < 1.3 && bolt > 1 ? 0.25 : 0);
          col = [l * 0.98, l, l * 1.03];
          r = 0.32 + (n[i] - 0.5) * 0.2;
        } else if (yy < BAND[0] && fromPost < 0.06) {
          const l = 0.45 + (n[i] - 0.5) * 0.08; // poste
          col = [l, l, l * 1.02];
          r = 0.5;
          hgt = 0.6;
          if (yy > BAND[0] - 0.06) col = [0.85, 0.1, 0.1]; // refletor vermelho no topo do poste
        } else if (yy < BAND[0]) {
          col = [0.16, 0.17, 0.16]; // vao atras da lamina (sombra pintada)
          r = 0.95;
          hgt = 0.2;
        } else {
          const l = 0.7 + (n[i] - 0.5) * 0.08; // aba superior
          col = [l, l, l * 1.03];
          r = 0.35;
        }
      } else {
        // topo e face de tras: aco liso
        const l = (p < rh + rt ? 0.72 : 0.6) + (n[i] - 0.5) * 0.1;
        col = [l, l, l * 1.03];
        r = 0.4 + (n[i] - 0.5) * 0.15;
      }
      col = [mix(col[0], 0.45, rustK), mix(col[1], 0.27, rustK), mix(col[2], 0.16, rustK)];
      r = mix(r, 0.85, rustK);
      height[i] = hgt;
      setPixel(color, x, y, ...col);
      setPixel(rough, x, y, r, r, r);
    }
  }
  writePng('guardrail_color', color);
  // u nao e periodico (perfil aberto): normal sem wrap em x
  writePng('guardrail_normal', normalFromHeight(height, W, H, 8, { wrapX: false }));
  writePng('guardrail_roughness', rough);
}

// kart (atlas)

// Regioes "tingiveis" (pintura e capacete) usam base clara: o material multiplica pela cor do kart.
const WHITE = 0.95;
const ACCENT = 0.55; // faixa: sai num tom mais escuro da cor do kart
const DARK = 0.2;

function g(l) {
  return [l, l, l];
}

/** Funcoes (s, t) -> cor, com s, t em [0,1] (t = 1 no topo do retangulo). */
const PAINTERS = {
  bodySide(s, t) {
    const z = mix(BODY_FRAME.zMin, BODY_FRAME.zMax, s);
    const y = mix(BODY_FRAME.yMin, BODY_FRAME.yMax, t);
    if (y < 0.27) return g(DARK + 0.05 * ((Math.floor(z * 40) + Math.floor(y * 40)) & 1)); // saia "carbono"
    const swoosh = 0.37 + 0.06 * Math.sin(z * 1.6);
    if (y > swoosh && y < swoosh + 0.07) return g(ACCENT);
    if (Math.abs(z - 0.32) < 0.006 || Math.abs(z + 0.62) < 0.006) return g(0.35); // linhas de porta
    return g(WHITE * (0.92 + 0.08 * t));
  },
  bodyTop(s, t) {
    const z = mix(BODY_FRAME.zMin, BODY_FRAME.zMax, s);
    const ax = Math.abs(mix(BODY_FRAME.xMin, BODY_FRAME.xMax, t));
    if (ax > 0.05 && ax < 0.14) return g(ACCENT); // faixas duplas no capo/teto
    if (Math.abs(z - 0.45) < 0.006) return g(0.35); // emenda do capo
    return g(WHITE);
  },
  bodyFront(s, t) {
    const x = mix(BODY_FRAME.xMin, BODY_FRAME.xMax, s);
    const y = mix(BODY_FRAME.yMin, BODY_FRAME.yMax, t);
    if (y < 0.2) return g(0.25); // para-choque
    if (Math.abs(x) < 0.3 && y < 0.3) return g(Math.floor(y * 60) & 1 ? 0.08 : 0.18); // grade
    // farois baixos: a frente do sport so tem ~17 cm de altura (y 0.17..0.34)
    const lamp = Math.hypot(Math.abs(x) - 0.45, y - 0.27) / 0.06;
    if (lamp < 1) return g(lamp > 0.8 ? 0.3 : 1);
    return g(WHITE);
  },
  bodyBack(s, t) {
    const x = mix(BODY_FRAME.xMin, BODY_FRAME.xMax, s);
    const y = mix(BODY_FRAME.yMin, BODY_FRAME.yMax, t);
    if (Math.hypot(x - 0.25, y - 0.22) < 0.045) return g(0.06); // escapamento
    if (y < 0.24) return g(0.25);
    if (Math.abs(Math.abs(x) - 0.45) < 0.1 && Math.abs(y - 0.33) < 0.035) return g(0.32); // lanternas
    return g(WHITE);
  },
  hub(s, t) {
    const dx = s - 0.5, dy = t - 0.5;
    const r = Math.hypot(dx, dy) * 2; // 0 no centro, 1 na borda do disco
    const a = Math.atan2(dy, dx);
    if (r > 0.62) return g(r > 0.78 && r < 0.84 ? 0.2 : 0.1); // flanco de borracha
    if (r > 0.58) return g(0.25); // borda do aro
    if (r > 0.22) {
      const spoke = Math.abs(fract((a / (Math.PI * 2)) * 5) - 0.5) < 0.07; // 5 raios
      return spoke ? g(0.22) : g(0.7);
    }
    return g(r < 0.08 ? 0.3 : 0.55); // cubo e porca
  },
  tread(s, t) {
    const off = Math.abs(t - 0.5);
    if (off > 0.42) return g(0.13); // ombros
    if (off < 0.025) return g(0.05); // sulco central
    const lug = fract(s * TREAD_LUGS + off * 0.9); // garras em "V": periodo inteiro na volta
    return g(lug < 0.2 ? 0.04 : 0.1);
  },
  helmet(s, t) {
    if (t < 0.12) return g(DARK); // borda inferior
    if (t > 0.34 && t < 0.44) return g(ACCENT); // faixa horizontal
    const meridian = Math.min(Math.abs(s - 0.25), Math.abs(s - 0.75)); // frente e tras
    if (t > 0.44 && meridian < 0.025) return g(ACCENT); // faixa central por cima
    return g(WHITE);
  },
  suit(s, t) {
    if (t < 0.15) return g(0.08); // cinto
    const zip = Math.min(s, 1 - s) < 0.008; // ziper na frente (u = 0 = +Z)
    if (zip) return g(0.55);
    if (Math.min(Math.abs(s - 0.25), Math.abs(s - 0.75)) < 0.02) return g(0.85); // faixas laterais
    return [0.17, 0.19, 0.26];
  },
  skin() {
    return [0.88, 0.71, 0.55];
  },
};

// Pecas cujo UV da a volta (u = 0 e u = 1 no mesmo meridiano): a margem repete o outro lado
const WRAP_S = new Set(['tread', 'helmet', 'suit', 'skin']);
const GUTTER = 8;

function kartAtlas(rng) {
  const S = ATLAS_SIZE;
  const img = createImage(S, S);
  const grain = fbm(rng, S, S, 32, 32, 2);
  fillImage(img, (_x, _y, c) => c.fill(0.5));
  for (const [name, [x0, y0, w, h]] of Object.entries(ATLAS_RECTS)) {
    const paint = PAINTERS[name];
    for (let y = y0 - GUTTER; y < y0 + h + GUTTER; y++) {
      for (let x = x0 - GUTTER; x < x0 + w + GUTTER; x++) {
        let s = (x + 0.5 - x0) / w;
        s = WRAP_S.has(name) ? fract(s) : clamp01(s);
        const t = clamp01(1 - (y + 0.5 - y0) / h);
        const k = 0.97 + grain[y * S + x] * 0.06; // granulado leve da pintura
        const [r, gg, b] = paint(s, t);
        setPixel(img, x, y, r * k, gg * k, b * k);
      }
    }
  }
  writePng('kart_atlas', img);
}

// UV checker

function uvChecker() {
  const S = 1024, N = 8, C = S / N;
  const img = createImage(S, S);
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const r = N - 1 - row; // linha a partir de baixo = v crescente
      const light = (col + r) % 2 === 0;
      const rgb = hsl(col / N, 0.65, light ? 0.72 : 0.42);
      const x0 = col * C, y0 = row * C;
      drawRect(img, x0, y0, C, C, rgb);
      drawRect(img, x0, y0, C, 2, g(0.05));
      drawRect(img, x0, y0, 2, C, g(0.05));
      const label = String(r * N + col).padStart(2, '0');
      const ink = light ? g(0.08) : g(0.97);
      drawText(img, label, x0 + 34, y0 + 22, 9, ink); // 2 digitos de 27x45 px
      // setas: +U para a direita, +V para cima
      drawRect(img, x0 + 14, y0 + C - 16, 40, 3, ink);
      for (let k = 0; k < 6; k++) drawRect(img, x0 + 48 + k, y0 + C - 22 + k, 1, 15 - 2 * k, ink);
      drawText(img, 'U', x0 + 58, y0 + C - 24, 3, ink);
      drawRect(img, x0 + 14, y0 + C - 56, 3, 40, ink);
      for (let k = 0; k < 7; k++) drawRect(img, x0 + 15 - k, y0 + C - 62 + k, 2 * k + 1, 1, ink);
      drawText(img, 'V', x0 + 22, y0 + C - 64, 3, ink);
    }
  }
  drawRect(img, 0, S - 2, S, 2, g(0.05));
  drawRect(img, S - 2, 0, 2, S, g(0.05));
  writePng('uv_checker', img);
}

// main

mkdirSync(OUT, { recursive: true });
// Cada textura com seu proprio RNG: mudar uma nao altera as outras
asphalt(createRng(SEED + 1));
grass(createRng(SEED + 2));
curb(createRng(SEED + 3));
guardrail(createRng(SEED + 4));
kartAtlas(createRng(SEED + 5));
uvChecker();
