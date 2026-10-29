// Estado fisico de um kart. E a unica coisa que a animacao, a camera e (no futuro) o HUD leem.
import { Vector3 } from 'three';

/**
 Entrada de controle
 @typedef {object} KartInput
 @property {number} throttle [0, 1]
 @property {number} brake [0, 1] - freio andando para frente, re quase parado
 @property {number} steer [-1, 1] - +1 = direita
 @property {boolean} drift reservado (Espaco), ainda sem efeito
 */

/**
 Convencoes: frente = +Z local, +X local = esquerda, Y para cima.
 heading = rotacao em +Y (rad, positivo vira a esquerda), sem wrap.
 @typedef {object} KartState
 @property {'sport' | 'sedan'} type chave de KART_TYPES
 @property {Vector3} position centro do kart no chao (m)
 @property {Vector3} prevPosition posicao no passo anterior (interpolacao)
 @property {number} heading (rad)
 @property {number} prevHeading (rad)
 @property {Vector3} velocity velocidade no mundo (m/s), y sempre 0
 @property {number} forwardSpeed velocidade ao longo da frente (m/s), negativa em re
 @property {number} steerAngle angulo das rodas dianteiras (rad, + = esquerda, convencao de yaw)
 @property {number} prevSteerAngle (rad)
 @property {boolean} onAsphalt
 @property {number} trackIndex segmento da pista mais proximo (-1 = desconhecido)
 */

/** @returns {KartInput} */
export function createKartInput() {
  return { throttle: 0, brake: 0, steer: 0, drift: false };
}

/**
 * @param {{ type: 'sport' | 'sedan', x: number, z: number, heading: number }} pose
 * @returns {KartState}
 */
export function createKartState({ type, x, z, heading }) {
  const state = {
    type,
    position: new Vector3(),
    prevPosition: new Vector3(),
    heading: 0,
    prevHeading: 0,
    velocity: new Vector3(),
    forwardSpeed: 0,
    steerAngle: 0,
    prevSteerAngle: 0,
    onAsphalt: true,
    trackIndex: -1,
  };
  resetKartState(state, x, z, heading);
  return state;
}

/** Coloca o kart parado numa pose (largada ou reset). */
export function resetKartState(state, x, z, heading) {
  state.position.set(x, 0, z);
  state.prevPosition.copy(state.position);
  state.heading = heading;
  state.prevHeading = heading;
  state.velocity.set(0, 0, 0);
  state.forwardSpeed = 0;
  state.steerAngle = 0;
  state.prevSteerAngle = 0;
  state.onAsphalt = true;
  state.trackIndex = -1;
}

/** Guarda o estado atual como "anterior" antes de avancar um passo. */
export function savePrevious(state) {
  state.prevPosition.copy(state.position);
  state.prevHeading = state.heading;
  state.prevSteerAngle = state.steerAngle;
}
