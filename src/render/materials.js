// Materiais e texturas. Compartilhados entre os 4 karts; so cor e numero sao por instancia.
import { CanvasTexture, DoubleSide, MeshStandardMaterial, SRGBColorSpace, Vector2 } from 'three';
import { loadTexture } from './textures.js';

// Quantas vezes cada textura repete dentro de 1 unidade de UV da malha (inteiro: emenda continua).
// Asfalto: UV = 12 m x ~12 m -> tile de 4 m. Grama, zebra e rail ja tem UV em tiles.
const ASPHALT_REPEAT = [3, 3];

// Repeat do UV checker na zebra (u = 1 m, v = 2 m): celulas quadradas no mundo. Os outros
// materiais usam (1, 1). Lido por render/demoMode.js.
const CURB_CHECKER_REPEAT = [1, 2];

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
    tireTread: new MeshStandardMaterial({ map: atlas, roughness: 0.95 }),
    tireCap: new MeshStandardMaterial({ map: atlas, roughness: 0.7 }),
    suit: new MeshStandardMaterial({ map: atlas, roughness: 0.8 }),
    skin: new MeshStandardMaterial({ map: atlas, roughness: 0.7 }),
    visor: new MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.1, metalness: 0.5, side: DoubleSide }),
    textures,
  };
  shared.curb.userData.checkerRepeat = CURB_CHECKER_REPEAT;
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
