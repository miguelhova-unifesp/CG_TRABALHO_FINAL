// Modelo fisico proprio do kart 
import { Vector3 } from 'three';
import { DT, KART_TYPES, OFFROAD, PHYSICS, STEERING } from '../config/tuning.js';
import { savePrevious } from './kartState.js';

// Temporarios reutilizados 
const _forward = new Vector3();
const _left = new Vector3();
const _surface = { onAsphalt: true, index: 0, lateral: 0 };

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 Avanca o kart um passo de DT segundos.
 @param {import('./kartState.js').KartState} state modificado no lugar
 @param {import('./kartState.js').KartInput} input
 @param {{ surfaceAt: Function }} track consulta de superficie (track/trackQuery.js)
 */

export function stepKart(state, input, track) {
  savePrevious(state);
  const kart = KART_TYPES[state.type];

  // Base local: frente (+Z) e esquerda (+X) no mundo
  const sinH = Math.sin(state.heading);
  const cosH = Math.cos(state.heading);
  _forward.set(sinH, 0, cosH);
  _left.set(cosH, 0, -sinH);
  let vF = state.velocity.dot(_forward);
  let vL = state.velocity.dot(_left);

  // Superficie: na grama, menos motor, menos aderencia, mais resistencia
  track.surfaceAt(state.position.x, state.position.z, state.trackIndex, _surface);
  state.trackIndex = _surface.index;
  state.onAsphalt = _surface.onAsphalt;
  const off = !_surface.onAsphalt;
  const engineAccel = kart.engineAccel * (off ? OFFROAD.accelFactor : 1);
  const grip = kart.lateralGrip * (off ? OFFROAD.gripFactor : 1);
  const rolling = PHYSICS.rollingResistance + (off ? OFFROAD.extraDrag : 0);

  // Longitudinal: motor com queda quadratica ate maxSpeed, freio, re
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  let accel = 0;
  if (throttle > 0) {
    const ratio = vF > 0 ? vF / kart.maxSpeed : 0;
    accel += engineAccel * throttle * Math.max(0, 1 - ratio * ratio);
  }
  if (brake > 0) {
    if (vF > PHYSICS.reverseThreshold) accel -= PHYSICS.brakeDecel * brake;
    else if (vF > -PHYSICS.reverseMaxSpeed) accel -= PHYSICS.reverseAccel * brake;
  }
  vF += accel * DT;

  // Arrasto + rolagem: so freiam, nunca invertem o sentido dentro do passo
  const resist = (PHYSICS.dragCoef * vF * vF + rolling) * DT;
  if (vF > 0) vF = Math.max(0, vF - resist);
  else if (vF < 0) vF = Math.min(0, vF + resist);

  // Aderencia lateral: UM parametro. O drift vai baixar "grip" aqui.
  vL *= Math.exp(-grip * DT);


  // Velocidade no mundo na base ATUAL; o giro do heading abaixo cria a velocidade
  // lateral do proximo passo, que a aderencia vai comendo (o kart "escorrega" um pouco).
  state.velocity.copy(_forward).multiplyScalar(vF).addScaledVector(_left, vL);
  state.position.addScaledVector(state.velocity, DT);
  state.forwardSpeed = vF;

  // Esterco: cai com a velocidade e as rodas viram a uma taxa limitada
  const s = Math.abs(vF) / STEERING.steerFalloffSpeed;
  const target = -clamp(input.steer, -1, 1) * (STEERING.maxSteer / (1 + s * s));
  const maxDelta = STEERING.steerRate * DT;
  state.steerAngle += clamp(target - state.steerAngle, -maxDelta, maxDelta);

  // Yaw por bicicleta cinematica: sem velocidade, nao vira
  state.heading += ((vF * Math.tan(state.steerAngle)) / kart.wheelBase) * DT;
}
