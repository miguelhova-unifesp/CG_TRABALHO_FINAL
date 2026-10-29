// Pontos de controle da CatmullRomCurve3 que define a pista.
// Pista de TESTE provisoria (11 pontos): possui reta principal, curva ampla e um grampo.

/**
 * @typedef {object} TrackData
 * @property {string} name
 * @property {number} width largura do asfalto (m)
 * @property {Array<[number, number]>} controlPoints pontos [x, z] no plano y = 0 (m), curva fechada
 * @property {{ position: [number, number], heading: number }} start pose de largada (m, rad)
 */

/** @type {TrackData} */
export const TEST_TRACK = {
  name: 'teste',
  width: 12,
  controlPoints: [
    [0, -40], // inicio da reta principal (sentido +Z)
    [0, 20],
    [0, 70],
    [-20, 110], // curva ampla a direita
    [-60, 125],
    [-100, 105],
    [-108, 60],
    [-38, -40], // fim da reta diagonal de volta
    [-33, -70], // grampo (raio ~11 m na linha central)
    [-17, -80],
    [-1, -68],
  ],
  start: { position: [0, 0], heading: 0 },
};
