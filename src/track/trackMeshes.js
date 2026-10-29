// Malhas da pista geradas a partir das amostras da spline (regra 5): asfalto + grama.
import { BufferAttribute, BufferGeometry, Group, Mesh, PlaneGeometry } from 'three';
import { TRACK_GEN } from '../config/tuning.js';

/**
 Faixa de asfalto: 2 vertices por amostra (esquerda, direita) e uma linha extra no fim,
 copia da primeira, para o loop fechar com UV continuo.
 @param {import('./trackGeometry.js').TrackSamples} samples
 @returns {BufferGeometry}
 */

export function createAsphaltGeometry(samples) {
  const { count, width, px, pz, lx, lz, dist, length } = samples;
  const rows = count + 1;
  const half = width / 2;
  const positions = new Float32Array(rows * 2 * 3);
  const normals = new Float32Array(rows * 2 * 3);
  const uvs = new Float32Array(rows * 2 * 2);

  for (let r = 0; r < rows; r++) {
    const i = r % count;
    const d = r === count ? length : dist[i];
    const v = d / width; // textura repete a cada "width" metros
    const base = r * 2;
    positions.set([px[i] + lx[i] * half, TRACK_GEN.asphaltY, pz[i] + lz[i] * half], base * 3);
    positions.set([px[i] - lx[i] * half, TRACK_GEN.asphaltY, pz[i] - lz[i] * half], (base + 1) * 3);
    normals.set([0, 1, 0, 0, 1, 0], base * 3);
    uvs.set([0, v, 1, v], base * 2);
  }

  const indices = new Uint32Array(count * 6);
  for (let s = 0; s < count; s++) {
    const l0 = s * 2;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    // Anti-horario visto de cima -> normal +Y
    indices.set([l0, r0, l1, r0, r1, l1], s * 6);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 Plano de grama cobrindo a caixa da pista + margem.
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
  
  return geometry;
}

/**
 @param {import('./trackGeometry.js').TrackSamples} samples
 @param {{ asphalt: import('three').Material, grass: import('three').Material }} materials
 @returns {{ group: Group, dispose: () => void }}
 */

export function createTrackMeshes(samples, materials) {
  const asphalt = new Mesh(createAsphaltGeometry(samples), materials.asphalt);
  
  asphalt.name = 'asphalt';
  asphalt.receiveShadow = true;
  
  const grass = new Mesh(createGrassGeometry(samples), materials.grass);
  
  grass.name = 'grass';
  grass.receiveShadow = true;

  const group = new Group();
  
  group.name = 'track';
  group.add(grass, asphalt);

  return {
  
    group,
  
    dispose() {
      asphalt.geometry.dispose();
      grass.geometry.dispose();
      group.removeFromParent();
    },
  };
}
