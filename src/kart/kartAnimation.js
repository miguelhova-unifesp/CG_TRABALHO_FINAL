// Animacao procedural do kart.

import { MathUtils } from 'three';

/**
 * @param {ReturnType<import('./kartModel.js').createKartModel>} model
 * @param {import('../physics/kartState.js').KartState} state
 * @param {number} alpha interpolacao entre o passo anterior e o atual [0, 1)
 * @param {number} frameTime duracao do frame de render (s)
 */

export function updateKartVisual(model, state, alpha, frameTime) {
  const { nodes, root } = model;
  root.position.lerpVectors(state.prevPosition, state.position, alpha);
  root.rotation.y = MathUtils.lerp(state.prevHeading, state.heading, alpha);

  const steer = MathUtils.lerp(state.prevSteerAngle, state.steerAngle, alpha);
  nodes.steerFL.rotation.y = steer;
  nodes.steerFR.rotation.y = steer;

  // lembrete: Rotacao positiva em X leva o topo da roda para +Z.
  model.anim.wheelSpin = (model.anim.wheelSpin + (state.forwardSpeed / model.wheelRadius) * frameTime) % (Math.PI * 2);
  const spin = model.anim.wheelSpin;
  nodes.wheelFL.rotation.x = spin;
  nodes.wheelFR.rotation.x = spin;
  nodes.wheelRL.rotation.x = spin;
  nodes.wheelRR.rotation.x = spin;
}
