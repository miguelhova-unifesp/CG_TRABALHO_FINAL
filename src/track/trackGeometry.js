// Amostragem da spline da pista: TrackData -> amostras igualmente espacadas (sem malha, sem cena).
import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * @typedef {object} TrackSamples
 * @property {number} count numero de amostras (o loop fecha da ultima para a primeira)
 * @property {number} width largura do asfalto (m)
 * @property {number} length comprimento da linha central (m)
 * @property {Float64Array} px posicao x de cada amostra (m)
 * @property {Float64Array} pz posicao z de cada amostra (m)
 * @property {Float64Array} tx tangente x (unitaria, sentido da corrida)
 * @property {Float64Array} tz tangente z
 * @property {Float64Array} lx vetor "esquerda" x (unitario) = tangente girada +90 graus em Y
 * @property {Float64Array} lz vetor "esquerda" z
 * @property {Float64Array} dist distancia acumulada ate a amostra (m)
 * @property {CatmullRomCurve3} curve curva original
 */

/**
 * @param {import('./trackData.js').TrackData} data
 * @param {number} count numero de amostras
 * @returns {TrackSamples}
 */
export function buildTrackSamples(data, count) {
  const curve = new CatmullRomCurve3(
    data.controlPoints.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  curve.arcLengthDivisions = count * 8;

  const px = new Float64Array(count);
  const pz = new Float64Array(count);
  const tx = new Float64Array(count);
  const tz = new Float64Array(count);
  const lx = new Float64Array(count);
  const lz = new Float64Array(count);
  const dist = new Float64Array(count);

  const points = curve.getSpacedPoints(count);
  const tangent = new Vector3();
  for (let i = 0; i < count; i++) {
    px[i] = points[i].x;
    pz[i] = points[i].z;
    curve.getTangentAt(i / count, tangent);
    tangent.y = 0;
    tangent.normalize();
    tx[i] = tangent.x;
    tz[i] = tangent.z;
    // Esquerda de quem anda em +Z e +X (ver docs/DECISIONS.md): (tz, -tx)
    lx[i] = tangent.z;
    lz[i] = -tangent.x;
    if (i > 0) dist[i] = dist[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  }
  const length = dist[count - 1] + Math.hypot(px[0] - px[count - 1], pz[0] - pz[count - 1]);

  return { count, width: data.width, length, px, pz, tx, tz, lx, lz, dist, curve };
}

/**
 * Amostra de maior curvatura (o grampo). Usada so pela camera de inspecao e pelo export de UV.
 * @param {TrackSamples} samples
 * @returns {number} indice da amostra
 */
export function tightestSampleIndex(samples) {
  let best = 0;
  let bestTurn = 0;
  for (let i = 0; i < samples.count; i++) {
    const n = (i + 1) % samples.count;
    // |t_i x t_(i+1)| = seno do angulo girado entre amostras
    const turn = Math.abs(samples.tx[i] * samples.tz[n] - samples.tz[i] * samples.tx[n]);
    if (turn > bestTurn) {
      bestTurn = turn;
      best = i;
    }
  }
  return best;
}
