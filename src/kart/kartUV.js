// UVs do kart no atlas compartilhado (public/textures/kart_atlas.png)
import { BufferAttribute } from 'three';

export const ATLAS_SIZE = 1024; // px
export const KART_TEXEL_DENSITY = 256; // px/m - carcaca

/** Caixa (m, espaco do kart) coberta pela projecao da carcaca - contem sport e sedan. */
export const BODY_FRAME = { xMin: -0.68, xMax: 0.68, yMin: 0, yMax: 1, zMin: -1.8, zMax: 1.8 };

const D = KART_TEXEL_DENSITY;
const F = BODY_FRAME;
const sideW = Math.round((F.zMax - F.zMin) * D); // 922
const sideH = Math.round((F.yMax - F.yMin) * D); // 256
const topH = Math.round((F.xMax - F.xMin) * D); // 348

/**
 Retangulos [x, y, largura, altura] em pixels da imagem (y para baixo), com 8 px de margem
 entre pecas para o mipmap nao misturar regioes vizinhas.
 */
export const ATLAS_RECTS = {
  bodySide: [8, 8, sideW, sideH], // projecao lateral (z, y)
  bodyTop: [8, 280, sideW, topH], // projecao de cima (z, x)
  bodyFront: [8, 644, topH, sideH], // projecao frontal (x, y)
  bodyBack: [372, 644, topH, sideH], // projecao traseira (x, y)
  hub: [776, 644, 160, 160], // tampas do pneu (UV radial do cilindro)
  skin: [776, 820, 160, 80], // cabeca
  tread: [8, 916, 512, 80], // banda de rodagem: u = volta inteira, v = largura
  // (o capacete nao esta no atlas: usa o UV da esfera com uma CanvasTexture por kart, ver HELMET_*)
  suit: [776, 916, 240, 100], // torso
};

/**
 Capacete: esfera aberta embaixo. O UV e o parametrico da SphereGeometry (u = longitude 0..1,
 v = 1 no topo e 0 na borda de baixo), sem remapear para o atlas.
 */
export const HELMET_SPHERE = { widthSegments: 20, heightSegments: 14, thetaLength: Math.PI * 0.78 };

/**
 Onde fica cada lado do capacete no UV. Na SphereGeometry x = -cos(2*pi*u), z = sin(2*pi*u):
 +Z (frente, viseira) em u = 0.25, +X (esquerda) em 0.5, -Z (nuca) em 0.75, -X (direita) em 0 = 1.
 equatorV: v da linha do equador (theta = pi/2).
 */
export const HELMET_LAYOUT = {
  front: 0.25,
  left: 0.5,
  back: 0.75,
  right: 0,
  equatorV: 1 - Math.PI / 2 / HELMET_SPHERE.thetaLength,
};

/**
 Tamanho da CanvasTexture do capacete: proporcao = (volta no equador) / (arco do topo a borda), para
 o texel ser quadrado no equador (2*pi*R / (thetaLength*R)); o raio cancela.
 */
export const HELMET_TEXTURE_SIZE = {
  width: 512,
  height: Math.round((512 * HELMET_SPHERE.thetaLength) / (2 * Math.PI)), // 200
};

/** Numero inteiro de garras na banda: o desenho repete exatamente na volta (emenda continua). */
export const TREAD_LUGS = 16;

/**
 (s, t) locais do retangulo [0,1]^2 (t = 1 no topo) -> UV do atlas. A imagem e carregada com
 flipY, entao a linha 0 da imagem e v = 1.
 @param {number[]} rect
 @param {number} s
 @param {number} t
 @param {number[]} out
 */
export function rectToAtlas(rect, s, t, out) {
  const [x, y, w, h] = rect;
  out[0] = (x + s * w) / ATLAS_SIZE;
  out[1] = 1 - (y + (1 - t) * h) / ATLAS_SIZE;
  return out;
}

/**
 Carcaca (ExtrudeGeometry, nao indexada): para cada triangulo escolhe a projecao pelo eixo
 dominante da normal da face. Mesma escala (px/m) nas 3 projecoes = densidade uniforme.
 @param {import('three').BufferGeometry} geometry
 */
export function applyBodyBoxUV(geometry) {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const out = [0, 0];
  const R = ATLAS_RECTS;
  const sz = (z) => (z - F.zMin) / (F.zMax - F.zMin);
  const sx = (x) => (x - F.xMin) / (F.xMax - F.xMin);
  const sy = (y) => (y - F.yMin) / (F.yMax - F.yMin);

  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i + 1) - pos.getX(i), ay = pos.getY(i + 1) - pos.getY(i), az = pos.getZ(i + 1) - pos.getZ(i);
    const bx = pos.getX(i + 2) - pos.getX(i), by = pos.getY(i + 2) - pos.getY(i), bz = pos.getZ(i + 2) - pos.getZ(i);
    const nx = Math.abs(ay * bz - az * by);
    const ny = Math.abs(az * bx - ax * bz);
    const nzSigned = ax * by - ay * bx;
    const nz = Math.abs(nzSigned);
    for (let k = i; k < i + 3; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      if (nx >= ny && nx >= nz) rectToAtlas(R.bodySide, sz(z), sy(y), out);
      else if (ny >= nz) rectToAtlas(R.bodyTop, sz(z), sx(x), out);
      else rectToAtlas(nzSigned > 0 ? R.bodyFront : R.bodyBack, sx(x), sy(y), out);
      uv[k * 2] = out[0];
      uv[k * 2 + 1] = out[1];
    }
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  return geometry;
}

/**
 Remapeia o UV parametrico (0..1) dos vertices de cada grupo para um retangulo do atlas.
 Sem grupos, todos os vertices vao para rects[0].
 @param {import('three').BufferGeometry} geometry
 @param {number[][]} rects um retangulo por grupo
 */

export function remapToAtlas(geometry, rects) {
  const uv = geometry.attributes.uv;
  const index = geometry.index;
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: index ? index.count : uv.count }];
  const done = new Uint8Array(uv.count);
  const out = [0, 0];
  const clamp = (x) => Math.min(1, Math.max(0, x));
  // clamp: a SphereGeometry desloca o u dos vertices do polo em +-0.5/segmentos (sai de [0,1]);
  // no polo o u nao tem significado, entao limitar nao distorce nada
  const remap = (v, rect) => {
    rectToAtlas(rect, clamp(uv.getX(v)), clamp(uv.getY(v)), out);
    uv.setXY(v, out[0], out[1]);
    done[v] = 1;
  };

  groups.forEach((group, g) => {
    const rect = rects[Math.min(g, rects.length - 1)];
    for (let j = group.start; j < group.start + group.count; j++) {
      const v = index ? index.getX(j) : j;
      if (!done[v]) remap(v, rect);
    }
  });
  
  // vertices fora de qualquer triangulo (ex.: 1 no polo da esfera) tambem vao para o atlas
  for (let v = 0; v < uv.count; v++) if (!done[v]) remap(v, rects[0]);
  uv.needsUpdate = true;
  return geometry;
}
