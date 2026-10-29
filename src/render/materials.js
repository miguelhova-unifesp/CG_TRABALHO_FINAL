// Materiais e texturas. Compartilhados entre os 4 karts; so cor e numero sao por instancia.
import { CanvasTexture, DoubleSide, MeshStandardMaterial, SRGBColorSpace } from 'three';

let shared = null;

/** Textura da tampa do pneu: raios claros para o giro da roda ficar visivel. */
function createWheelCapTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const c = size / 2;
  g.fillStyle = '#151515';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#9a9ea6';
  g.beginPath();
  g.arc(c, c, size * 0.3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a2a2a';
  g.lineWidth = size * 0.06;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + Math.cos(a) * size * 0.3, c + Math.sin(a) * size * 0.3);
    g.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Materiais compartilhados */
export function getMaterials() {
  if (shared) return shared;
  const wheelCap = createWheelCapTexture();
  shared = {
    asphalt: new MeshStandardMaterial({ color: 0x3b3c40, roughness: 0.92 }),
    grass: new MeshStandardMaterial({ color: 0x4d8a3c, roughness: 1 }),
    glass: new MeshStandardMaterial({
      color: 0x16202b,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    tireTread: new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }),
    tireCap: new MeshStandardMaterial({ map: wheelCap, roughness: 0.7 }),
    suit: new MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.8 }),
    skin: new MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.7 }),
    visor: new MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.1, metalness: 0.5, side: DoubleSide }),
    textures: { wheelCap },
  };
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
