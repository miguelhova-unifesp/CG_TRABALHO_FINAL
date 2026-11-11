// Materiais e texturas. Compartilhados entre os 4 karts; so cor e numero sao por instancia.
import { CanvasTexture, DoubleSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three';
import { loadTexture } from './textures.js';

// Quantas vezes cada textura repete dentro de 1 unidade de UV da malha (inteiro: emenda continua).
// Asfalto: UV = 12 m x ~12 m -> tile de 4 m. Grama, zebra e rail ja tem UV em tiles.
const ASPHALT_REPEAT = [3, 3];

// Repeat do UV checker na zebra (u = 1 m, v = 2 m): celulas quadradas no mundo. Os outros
// materiais usam (1, 1). Lido por render/demoMode.js.
const CURB_CHECKER_REPEAT = [1, 2];

// Modo debug "sem textura" (render/demoMode.js): cor lisa aproximando a media de cada textura, para
// comparar so a contribuicao da textura com a mesma luz. Materiais sem entrada mantem a propria cor.
const UNTEXTURED_COLOR = {
  asphalt: 0x5b5d63,
  grass: 0x4f8f34,
  curb: 0xd8d4d0,
  rail: 0x9da1a6,
  tireTread: 0x1b1b1b,
  tireCap: 0x6e6e6e,
  suit: 0x2c3244,
  skin: 0xe0b48c,
};

let shared = null;

/** Materiais compartilhados. Chamar configureTextures(renderer) antes (anisotropia). */
export function getMaterials() {
  if (shared) return shared;
  const textures = {
    asphaltColor: loadTexture('asphalt_color', { color: true, repeat: ASPHALT_REPEAT }),
    asphaltNormal: loadTexture('asphalt_normal', { repeat: ASPHALT_REPEAT }),
    asphaltRoughness: loadTexture('asphalt_roughness', { repeat: ASPHALT_REPEAT }),
    grassColor: loadTexture('grass_color', { color: true }),
    curbColor: loadTexture('curb_color', { color: true }),
    railColor: loadTexture('guardrail_color', { color: true }),
    railNormal: loadTexture('guardrail_normal'),
    railRoughness: loadTexture('guardrail_roughness'),
    kartAtlas: loadTexture('kart_atlas', { color: true, clamp: true }),
    // Mesmo layout do atlas, com relevo/rugosidade so na banda e na tampa do pneu (resto neutro)
    kartAtlasNormal: loadTexture('kart_atlas_normal', { clamp: true }),
    kartAtlasRoughness: loadTexture('kart_atlas_roughness', { clamp: true }),
  };
  const atlas = textures.kartAtlas;
  shared = {
    asphalt: new MeshStandardMaterial({
      map: textures.asphaltColor,
      normalMap: textures.asphaltNormal,
      normalScale: new Vector2(0.9, 0.9),
      roughnessMap: textures.asphaltRoughness,
      roughness: 1, // multiplica o roughnessMap
    }),
    grass: new MeshStandardMaterial({ map: textures.grassColor, roughness: 1 }),
    curb: new MeshStandardMaterial({ map: textures.curbColor, roughness: 0.7 }),
    rail: new MeshStandardMaterial({
      map: textures.railColor,
      normalMap: textures.railNormal,
      roughnessMap: textures.railRoughness,
      roughness: 1,
      metalness: 0.35, // sem envMap, metal alto fica escuro: so o especular do sol
    }),
    glass: new MeshStandardMaterial({
      color: 0x16202b,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    // roughness = 1 multiplica o roughnessMap (borracha ~0.9, sulcos 1, aro metalico ~0.45)
    tireTread: new MeshStandardMaterial({
      map: atlas,
      normalMap: textures.kartAtlasNormal,
      roughnessMap: textures.kartAtlasRoughness,
      roughness: 1,
    }),
    tireCap: new MeshStandardMaterial({
      map: atlas,
      normalMap: textures.kartAtlasNormal,
      roughnessMap: textures.kartAtlasRoughness,
      roughness: 1,
    }),
    suit: new MeshStandardMaterial({ map: atlas, roughness: 0.8 }),
    skin: new MeshStandardMaterial({ map: atlas, roughness: 0.7 }),
    visor: new MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.1, metalness: 0.5, side: DoubleSide }),
    textures,
  };
  shared.curb.userData.checkerRepeat = CURB_CHECKER_REPEAT;
  for (const [name, color] of Object.entries(UNTEXTURED_COLOR)) shared[name].userData.untexturedColor = color;
  return shared;
}

export function disposeMaterials() {
  if (!shared) return;
  const { textures, ...materials } = shared;
  Object.values(materials).forEach((m) => m.dispose());
  Object.values(textures).forEach((t) => t.dispose());
  shared = null;
}

/**
 * Placa de numero desenhada em canvas (por instancia)
 * @param {number} number
 */
export function createNumberTexture(number) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f4f4f0';
  g.beginPath();
  g.roundRect(4, 4, size - 8, size - 8, 18);
  g.fill();
  g.fillStyle = '#111';
  g.font = `bold ${size * 0.7}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(number), size / 2, size / 2 + size * 0.05);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Cor hex (0xRRGGBB) escalada por k, como string CSS. */
function cssColor(hex, k = 1) {
  const c = [16, 8, 0].map((sh) => Math.round(((hex >> sh) & 255) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * Capacete desenhado em canvas (por instancia): base na cor do kart, faixa de corrida do topo ate a
 * nuca, faixa escura no equador, borda escura embaixo e o numero nos 2 lados e na nuca.
 * Coordenadas: x = u * width (longitude), y = (1 - v) * height (topo do canvas = topo do capacete).
 * @param {{ color: number, number: number, size: { width: number, height: number },
 *   layout: typeof import('../kart/kartUV.js').HELMET_LAYOUT }} options
 */
export function createHelmetTexture({ color, number, size, layout }) {
  const { width: W, height: H } = size;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const yOf = (v) => (1 - v) * H;
  const equatorY = yOf(layout.equatorV);

  // Disco do numero (~5 cm de raio): centro um pouco acima do equador
  const r = H * 0.17;
  const cy = equatorY - r * 0.95;

  g.fillStyle = cssColor(color);
  g.fillRect(0, 0, W, H);

  // Faixa escura (tom da cor do kart) logo abaixo do equador, dando a volta inteira
  g.fillStyle = cssColor(color, 0.45);
  g.fillRect(0, equatorY + H * 0.04, W, H * 0.08);

  // Faixa de corrida branca com filetes escuros: do topo da viseira ate a nuca, por cima
  const stripe = W * 0.05;
  const stripeEnd = cy - r - 4; // termina antes do numero da nuca
  for (const u of [layout.front, layout.back]) {
    const x = u * W;
    g.fillStyle = cssColor(color, 0.45);
    g.fillRect(x - stripe / 2 - 3, 0, stripe + 6, stripeEnd);
    g.fillStyle = '#f4f4f0';
    g.fillRect(x - stripe / 2, 0, stripe, stripeEnd);
  }

  // Borda inferior (acabamento de borracha)
  g.fillStyle = '#16161a';
  g.fillRect(0, H * 0.9, W, H * 0.1);

  // Numero: disco branco centrado acima do equador; nos lados e na nuca (a viseira fica na frente)
  const label = String(number);
  g.font = `bold ${Math.round(r * (label.length > 1 ? 1.15 : 1.4))}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const u of [layout.left, layout.back, layout.right, layout.right + 1]) {
    const cx = u * W; // right = 0 e 1: as 2 metades do disco se encontram na emenda do UV
    g.fillStyle = '#f4f4f0';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = cssColor(color, 0.45);
    g.stroke();
    g.fillStyle = '#111';
    g.fillText(label, cx, cy + r * 0.06);
  }

  const texture = new CanvasTexture(canvas);
  texture.name = `helmet-${number}`;
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping; // u da a volta: os vertices do polo passam um pouco de 1
  return texture;
}
