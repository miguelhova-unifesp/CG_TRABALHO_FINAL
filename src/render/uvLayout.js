// Layout UV no navegador (modo debug): desenha os triangulos de cada malha no espaco UV, sobre a
// propria textura, num <canvas> que pode ser baixado como PNG. So le geometrias e texturas.
// (scripts/export-uv-layouts.js faz o equivalente em Node, gravando em docs/img/.)
import { RepeatWrapping } from 'three';
import { TRACK_GEN } from '../config/tuning.js';

const PX_PER_UV = 1024; // px por unidade de UV no canvas exportado
const MAX_SIDE = 2048; // px - limite de cada lado do canvas

/**
 * @typedef {object} UvPart
 * @property {import('three').BufferGeometry} geometry
 * @property {string} color cor do wireframe (CSS)
 * @property {(a: number, b: number, c: number) => boolean} [filter] triangulo entra no desenho?
 * @property {(a: number, b: number, c: number) => number} [vShift] deslocamento em v do triangulo
 *
 * @typedef {object} UvLayoutSpec
 * @property {string} name nome do arquivo (sem extensao)
 * @property {string} title titulo no painel e no PNG
 * @property {string[]} notes linhas de explicacao gravadas no PNG
 * @property {UvPart[]} parts
 * @property {[number, number, number, number]} [window] [u0, u1, v0, v1]; sem ele, ajusta aos UVs das partes
 * @property {[number, number]} [meters] metros cobertos por 1 unidade de u e de v: o canvas usa essa
 *   proporcao, para o layout nao aparecer esticado (padrao [1, 1] = quadrado)
 * @property {import('three').Texture} [texture] fundo (usa texture.repeat e o wrap da textura)
 * @property {Array<{ v: number, color: string, label: string }>} [marks] linhas horizontais em v
 */

/** Itera os triangulos (indexados ou nao). */
function forEachTriangle(geometry, fn) {
  const index = geometry.index;
  const n = index ? index.count : geometry.attributes.position.count;
  for (let j = 0; j < n; j += 3) {
    if (index) fn(index.getX(j), index.getX(j + 1), index.getX(j + 2));
    else fn(j, j + 1, j + 2);
  }
}

/** Caixa [u0, u1, v0, v1] dos UVs das partes, com 3% de folga. */
function fitWindow(parts) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const { geometry, filter } of parts) {
    const uv = geometry.attributes.uv;
    forEachTriangle(geometry, (a, b, c) => {
      if (filter && !filter(a, b, c)) return;
      for (const k of [a, b, c]) {
        u0 = Math.min(u0, uv.getX(k));
        u1 = Math.max(u1, uv.getX(k));
        v0 = Math.min(v0, uv.getY(k));
        v1 = Math.max(v1, uv.getY(k));
      }
    });
  }
  const pu = (u1 - u0) * 0.03, pv = (v1 - v0) * 0.03;
  return [u0 - pu, u1 + pu, v0 - pv, v1 + pv];
}

/**
 * Fundo: a textura colocada no espaco UV com o mesmo repeat do material. A imagem e carregada com
 * flipY, entao a linha 0 da imagem e v = 1/repeat.v (topo do tile).
 */
function drawBackground(g, texture, [u0, u1, v0, v1], W, H) {
  const image = texture?.image;
  if (!image || !image.width) return false; // ainda carregando
  const clamp = texture.wrapS !== RepeatWrapping;
  const [ru, rv] = [texture.repeat.x, texture.repeat.y];
  const pattern = g.createPattern(image, clamp ? 'no-repeat' : 'repeat');
  const du = u1 - u0, dv = v1 - v0;
  const sx = W / (image.width * ru * du);
  const sy = H / (image.height * rv * dv);
  const tx = (-u0 * W) / du;
  const ty = ((v1 - 1 / rv) * H) / dv;
  pattern.setTransform(new DOMMatrix([sx, 0, 0, sy, tx, ty]));
  g.fillStyle = pattern;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0, 0, 0, 0.25)'; // escurece para o wireframe aparecer
  g.fillRect(0, 0, W, H);
  return true;
}

/**
 * @param {UvLayoutSpec} spec
 * @returns {HTMLCanvasElement}
 */
export function drawUvLayout(spec) {
  const win = spec.window ?? fitWindow(spec.parts);
  const [u0, u1, v0, v1] = win;
  const [mu, mv] = spec.meters ?? [1, 1];
  const k = Math.min(PX_PER_UV / Math.max(mu, mv), MAX_SIDE / ((u1 - u0) * mu), MAX_SIDE / ((v1 - v0) * mv));
  const W = Math.round((u1 - u0) * mu * k);
  const H = Math.round((v1 - v0) * mv * k);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const X = (u) => ((u - u0) / (u1 - u0)) * W;
  const Y = (v) => (1 - (v - v0) / (v1 - v0)) * H;

  g.fillStyle = '#303438';
  g.fillRect(0, 0, W, H);
  drawBackground(g, spec.texture, win, W, H);

  // Grade de UV inteiro (bordas dos tiles)
  g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  g.setLineDash([6, 6]);
  g.beginPath();
  for (let u = Math.ceil(u0); u <= u1; u++) {
    g.moveTo(X(u), 0);
    g.lineTo(X(u), H);
  }
  for (let v = Math.ceil(v0); v <= v1; v++) {
    g.moveTo(0, Y(v));
    g.lineTo(W, Y(v));
  }
  g.stroke();
  g.setLineDash([]);

  g.lineWidth = 1;
  for (const { geometry, color, filter, vShift } of spec.parts) {
    const uv = geometry.attributes.uv;
    g.strokeStyle = color;
    g.beginPath();
    forEachTriangle(geometry, (a, b, c) => {
      if (filter && !filter(a, b, c)) return;
      const s = vShift ? vShift(a, b, c) : 0;
      g.moveTo(X(uv.getX(a)), Y(uv.getY(a) + s));
      g.lineTo(X(uv.getX(b)), Y(uv.getY(b) + s));
      g.lineTo(X(uv.getX(c)), Y(uv.getY(c) + s));
      g.closePath();
    });
    g.stroke();
  }

  for (const mark of spec.marks ?? []) {
    g.strokeStyle = mark.color;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, Y(mark.v));
    g.lineTo(W, Y(mark.v));
    g.stroke();
    g.fillStyle = mark.color;
    g.font = 'bold 16px sans-serif';
    g.fillText(mark.label, 8, Y(mark.v) - 6);
  }

  // Legenda
  const lines = [spec.title, ...spec.notes, `janela: u ${u0.toFixed(2)}..${u1.toFixed(2)}, v ${v0.toFixed(2)}..${v1.toFixed(2)}`];
  g.font = '15px sans-serif';
  const boxW = Math.min(W - 16, Math.max(...lines.map((l) => g.measureText(l).width)) + 16);
  g.fillStyle = 'rgba(10, 14, 20, 0.78)';
  g.fillRect(8, 8, boxW, lines.length * 20 + 10);
  g.fillStyle = '#f2f4f7';
  lines.forEach((l, i) => {
    g.font = i === 0 ? 'bold 15px sans-serif' : '15px sans-serif';
    g.fillText(l, 16, 28 + i * 20, boxW - 16);
  });
  return canvas;
}

/**
 * Specs dos layouts do jogo: pista (asfalto com a emenda, zebras, guard rail), kart (atlas dos
 * 2 tipos), pneu (banda + tampa) e capacete (CanvasTexture do jogador).
 * As texturas de fundo sao as originais (nao o material.map, que o modo debug troca).
 * @param {{
 *   track: { asphalt: import('three').BufferGeometry, curbs: import('three').BufferGeometry,
 *     rails: import('three').BufferGeometry },
 *   karts: Record<'sport' | 'sedan', Record<string, import('three').BufferGeometry>>,
 *   textures: Record<string, import('three').Texture>,
 *   helmetTexture: import('three').Texture,
 *   trackWidth: number,
 *   helmetMeters: [number, number],
 * }} options
 * @returns {UvLayoutSpec[]}
 */
export function createUvLayoutSpecs({ track, karts, textures, helmetTexture, trackWidth, helmetMeters }) {
  const asphalt = track.asphalt;
  const uvA = asphalt.attributes.uv;
  let vMax = 0;
  for (let i = 0; i < uvA.count; i++) vMax = Math.max(vMax, uvA.getY(i));
  const vEnd = Math.round(vMax); // inteiro: emenda (tile ajustado, ver docs/TRACK.md)
  const tiles = TRACK_GEN.uvTile;
  const atlas = textures.kartAtlas;
  const firstTiles = (geometry, n) => {
    const uv = geometry.attributes.uv;
    return (a, b, c) => Math.min(uv.getY(a), uv.getY(b), uv.getY(c)) < n;
  };
  const kartParts = (geo) => [
    { geometry: geo.body, color: 'rgba(255, 60, 60, 0.9)' },
    { geometry: geo.tire, color: 'rgba(255, 210, 0, 0.9)' },
    { geometry: geo.torso, color: 'rgba(0, 200, 255, 0.9)' },
    { geometry: geo.head, color: 'rgba(0, 255, 120, 0.9)' },
  ];

  return [
    {
      name: 'uv_asfalto_emenda',
      title: 'Pista - asfalto (ultimo tile + primeiro tile)',
      notes: [
        'u: 0 = borda esquerda, 1 = borda direita (12 m)',
        `v = arco da linha central / ~${tiles.asphalt} m (${vEnd} tiles inteiros na volta)`,
        'textura repete 3x3 dentro de 1 tile de UV',
      ],
      parts: [
        {
          geometry: asphalt,
          color: 'rgba(255, 255, 0, 0.9)',
          filter: (a, b, c) => {
            const vs = [uvA.getY(a), uvA.getY(b), uvA.getY(c)];
            return Math.min(...vs) < 1 || Math.max(...vs) > vEnd - 1;
          },
          vShift: (a) => (uvA.getY(a) > vEnd / 2 ? -vEnd : 0),
        },
      ],
      window: [0, 1, -1, 1],
      meters: [trackWidth, tiles.asphalt],
      texture: textures.asphaltColor,
      marks: [{ v: 0, color: '#ff4040', label: `emenda da volta (v = ${vEnd} = 0)` }],
    },
    {
      name: 'uv_zebras',
      title: 'Pista - zebras (2 primeiros tiles)',
      notes: ['u: 0..1 = largura da zebra (1 m)', `v = arco do meio da zebra / ~${tiles.curb} m`],
      parts: [{ geometry: track.curbs, color: 'rgba(0, 120, 255, 0.95)', filter: firstTiles(track.curbs, 2) }],
      window: [0, 1, 0, 2],
      meters: [TRACK_GEN.curbWidth, tiles.curb],
      texture: textures.curbColor,
    },
    {
      name: 'uv_guard_rail',
      title: 'Pista - guard rail (2 primeiros tiles)',
      notes: ['u: perfil frente -> topo -> tras', `v = arco do meio do rail / ~${tiles.rail} m`],
      parts: [{ geometry: track.rails, color: 'rgba(255, 0, 200, 0.95)', filter: firstTiles(track.rails, 2) }],
      window: [0, 1, 0, 2],
      meters: [2 * TRACK_GEN.railHeight + TRACK_GEN.railThickness, tiles.rail],
      texture: textures.railColor,
    },
    ...['sport', 'sedan'].map((type) => ({
      name: `uv_kart_${type}`,
      title: `Kart ${type} - atlas compartilhado`,
      notes: ['vermelho: carcaca (caixa, 256 px/m)', 'amarelo: pneu  azul: torso  verde: cabeca'],
      parts: kartParts(karts[type]),
      window: [0, 1, 0, 1],
      texture: atlas,
    })),
    {
      name: 'uv_pneu',
      title: 'Pneu - banda de rodagem e tampas',
      notes: ['banda: u = volta inteira (16 garras), v = largura', 'tampas: UV radial do cilindro'],
      parts: [{ geometry: karts.sport.tire, color: 'rgba(255, 210, 0, 0.95)' }],
      texture: atlas,
    },
    {
      name: 'uv_capacete',
      title: 'Capacete - UV da esfera + CanvasTexture por kart',
      notes: ['u = longitude (0.25 frente/viseira, 0.5 esq., 0.75 nuca)', 'v = 1 no topo, 0 na borda de baixo'],
      parts: [{ geometry: karts.sport.helmet, color: 'rgba(255, 255, 255, 0.9)' }],
      window: [0, 1, 0, 1],
      meters: helmetMeters,
      texture: helmetTexture,
    },
  ];
}
