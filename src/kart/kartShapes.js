/* Forma da carcaca por tipo de kart. A HIERARQUIA e a mesma para os dois (ver kartModel.js);
aqui so muda o perfil lateral da carcaca/cabine e algumas medidas.

Perfis desenhados no plano lateral: x da Shape = z do kart (frente +Z), y = altura.
Origem: no chao, no meio do entre-eixos. Medidas em metros.
*/

/**
 * @typedef {object} KartShape
 * @property {(s: import('three').Shape) => void} body perfil lateral da carcaca
 * @property {(s: import('three').Shape) => void} cabin perfil lateral da cabine (vidros)
 * @property {number} bodyWidth largura da carcaca, sem as rodas (m)
 * @property {number} cabinWidth largura da cabine (m)
 * @property {number} wheelRadius (m)
 * @property {number} wheelWidth (m)
 * @property {{ z: number, y: number }} seat base do piloto (m)
 * @property {number} plateY altura da placa de numero na traseira (m)
 */

/** @type {Record<'sport' | 'sedan', KartShape>} */

export const KART_SHAPES = {
  // Inspirado num esportivo pequeno: baixo, traseira arredondada, cabine recuada
  sport: {
    body(s) {
      s.moveTo(-1.42, 0.17);
      s.lineTo(1.38, 0.17);
      s.quadraticCurveTo(1.52, 0.18, 1.5, 0.34); // bico
      s.lineTo(0.45, 0.56); // capo subindo ate o para-brisa
      s.lineTo(-0.75, 0.6);
      s.bezierCurveTo(-1.4, 0.6, -1.56, 0.42, -1.5, 0.26); // traseira arredondada
      s.quadraticCurveTo(-1.48, 0.17, -1.42, 0.17);
    },
    cabin(s) {
      s.moveTo(0.42, 0.52);
      s.lineTo(-0.08, 0.98); // para-brisa inclinado
      s.lineTo(-0.5, 0.99);
      s.bezierCurveTo(-0.85, 0.98, -1.1, 0.8, -1.22, 0.55); // vidro traseiro "fastback"
      s.lineTo(0.42, 0.52);
    },
    bodyWidth: 1.3,
    cabinWidth: 1.06,
    wheelRadius: 0.3,
    wheelWidth: 0.28,
    seat: { z: -0.45, y: 0.3 },
    plateY: 0.4,
  },

  // Inspirado num sedan compacto: mais alto, quadrado, cabine centralizada
  sedan: {
    body(s) {
      s.moveTo(-1.6, 0.2);
      s.lineTo(1.6, 0.2);
      s.lineTo(1.66, 0.44);
      s.lineTo(1.6, 0.7); // frente quase vertical
      s.lineTo(0.72, 0.78); // capo reto
      s.lineTo(-1.25, 0.8);
      s.lineTo(-1.62, 0.76); // porta-malas
      s.lineTo(-1.66, 0.42);
      s.lineTo(-1.6, 0.2);
    },
    cabin(s) {
      s.moveTo(0.74, 0.74);
      s.lineTo(0.3, 1.3);
      s.lineTo(-0.6, 1.3); // teto reto
      s.lineTo(-1.04, 0.78);
      s.lineTo(-1.04, 0.74);
      s.lineTo(0.74, 0.74);
    },
    bodyWidth: 1.36,
    cabinWidth: 1.2,
    wheelRadius: 0.32,
    wheelWidth: 0.3,
    seat: { z: -0.12, y: 0.4 },
    plateY: 0.55,
  },
};
