// Consulta de superficie: dado (x, z), o kart esta no asfalto ou na grama?
// Usado pela fisica a cada passo - nao aloca nada.
import { TRACK_GEN } from '../config/tuning.js';

/**
 @typedef {object} SurfaceInfo
 @property {boolean} onAsphalt
 @property {number} index segmento mais proximo (amostra inicial)
 @property {number} lateral distancia ate a linha central (m)
 */

/**
 @param {import('./trackGeometry.js').TrackSamples} samples
 @returns {{ surfaceAt: (x: number, z: number, hint: number, out: SurfaceInfo) => SurfaceInfo }}
 */

export function createTrackQuery(samples) {
  const { count, px, pz } = samples;
  const half = samples.width / 2;
  const window = TRACK_GEN.surfaceSearchWindow;

  // Distancia^2 de (x, z) ao segmento s -> s+1
  function segmentDist2(s, x, z) {
    const n = (s + 1) % count;
    const ax = px[s], az = pz[s];
    const dx = px[n] - ax, dz = pz[n] - az;
    const len2 = dx * dx + dz * dz;
    
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    
    const ex = ax + dx * t - x;
    const ez = az + dz * t - z;
    return ex * ex + ez * ez;
  }

  function search(x, z, from, span, best) {
    for (let k = -span; k <= span; k++) {
      
      const s = (((from + k) % count) + count) % count;
      const d2 = segmentDist2(s, x, z);
      
      if (d2 < best.d2) {
        best.d2 = d2;
        best.index = s;
      }

    }
  }

  const best = { d2: Infinity, index: 0 };

  function surfaceAt(x, z, hint, out) {
    best.d2 = Infinity;
    
    best.index = 0;
    
    if (hint >= 0) search(x, z, hint, window, best);
    // Sem hint, ou fora do asfalto pela busca local: busca completa (evita minimo local errado)
    
    if (hint < 0 || best.d2 > half * half) search(x, z, 0, count >> 1, best);
    
    out.index = best.index;
    out.lateral = Math.sqrt(best.d2);
    out.onAsphalt = out.lateral <= half;
    
    return out;
  }

  return { surfaceAt };
}
