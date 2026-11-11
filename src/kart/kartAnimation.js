// Animacao procedural do kart. So LE o estado fisico (regra 3); o que acumula fica em model.anim.

import { MathUtils } from 'three';
import { KART_ANIM, STEERING } from '../config/tuning.js';

const TWO_PI = Math.PI * 2;
const MIN_SLIP_SPEED = 0.5; // m/s - abaixo disso o angulo de deriva nao tem significado

/**
 Angulo visual das rodas da frente. Fora do drift = esterco fisico. No drift as rodas apontam para
 onde o kart esta indo (contra-esterco): o angulo de deriva entre o nariz e a velocidade, misturado
 por driftAmount (mesma rampa da aderencia) e limitado ao esterco maximo (o pneu nao entra na carcaca).
 Convencao de yaw: + = esquerda. Drift para a direita -> velocidade a esquerda do nariz -> + .
 @param {number} steer esterco fisico interpolado (rad)
 @param {number} vF velocidade ao longo do nariz (m/s)
 @param {number} vL velocidade para a esquerda (m/s)
 @param {number} driftAmount [0, 1]
 */
export function visualSteerAngle(steer, vF, vL, driftAmount) {
  if (driftAmount <= 0 || vF < MIN_SLIP_SPEED) return steer;
  const max = STEERING.maxSteer;
  const slip = MathUtils.clamp(Math.atan2(vL, vF), -max, max);
  return steer + (slip - steer) * driftAmount;
}

/**
 * @param {ReturnType<import('./kartModel.js').createKartModel>} model
 * @param {import('../physics/kartState.js').KartState} state
 * @param {number} alpha interpolacao entre o passo anterior e o atual [0, 1)
 * @param {number} frameTime duracao do frame de render (s)
 */
export function updateKartVisual(model, state, alpha, frameTime) {
  const { nodes, root, anim } = model;
  root.position.lerpVectors(state.prevPosition, state.position, alpha);
  const heading = MathUtils.lerp(state.prevHeading, state.heading, alpha);
  root.rotation.y = heading;

  // Velocidade na base do kart (escalares, sem alocar): frente = (sin h, cos h), esquerda = (cos h, -sin h)
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const vF = state.velocity.x * sinH + state.velocity.z * cosH;
  const vL = state.velocity.x * cosH - state.velocity.z * sinH;
  const drift = state.driftAmount;

  const physicalSteer = MathUtils.lerp(state.prevSteerAngle, state.steerAngle, alpha);
  const steer = visualSteerAngle(physicalSteer, vF, vL, drift);
  nodes.steerFL.rotation.y = steer;
  nodes.steerFR.rotation.y = steer;

  // Giro (lembrete: rotacao positiva em X leva o topo da roda para +Z = rolar para frente).
  // Frente: rola com a velocidade na direcao em que a roda aponta (no drift ela aponta para a
  // velocidade, entao rola com quase todo |v|). Tras: rola com vF e, no drift, patina um pouco mais.
  // Fora do drift (vL ~ 0, sem patinar) as duas dao forwardSpeed, como antes.
  const frontSpeed = drift > 0 ? vF * Math.cos(steer) + vL * Math.sin(steer) : state.forwardSpeed;
  const rearSpeed = state.forwardSpeed * (1 + KART_ANIM.driftWheelspin * drift);
  anim.frontSpin = (anim.frontSpin + (frontSpeed / model.wheelRadius) * frameTime) % TWO_PI;
  anim.rearSpin = (anim.rearSpin + (rearSpeed / model.wheelRadius) * frameTime) % TWO_PI;
  nodes.wheelFL.rotation.x = anim.frontSpin;
  nodes.wheelFR.rotation.x = anim.frontSpin;
  nodes.wheelRL.rotation.x = anim.rearSpin;
  nodes.wheelRR.rotation.x = anim.rearSpin;
}
