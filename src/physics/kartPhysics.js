// Modelo fisico proprio do kart 
import { Vector3 } from 'three';
import { DRIFT, DT, KART_TYPES, OFFROAD, PHYSICS, STEERING } from '../config/tuning.js';
import { savePrevious } from './kartState.js';

// Temporarios reutilizados 
const _forward = new Vector3();
const _left = new Vector3();
const _surface = { onAsphalt: true, index: 0, lateral: 0 };

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 Maquina de estados do drift, no inicio do passo (antes de mexer em velocidade).
 Entra: botao segurado e ainda nao usado (driftLatch), |steer| >= minSteer, vF >= minSpeed, no
 asfalto, sem freio. O lado fica travado (driftDir). Sai: soltou o botao, freou, saiu do asfalto
 ou vF < exitSpeed. driftAmount faz a rampa da aderencia nos dois sentidos.
 */
function updateDrift(state, input, steer, brake, vF, offroad) {
  if (!input.drift) state.driftLatch = false;
  if (state.drifting) {
    if (!input.drift || brake > 0 || offroad || vF < DRIFT.exitSpeed) {
      state.drifting = false;
      state.driftDir = 0;
      state.driftTime = 0;
    }
  } else if (
    input.drift &&
    !state.driftLatch &&
    Math.abs(steer) >= DRIFT.minSteer &&
    vF >= DRIFT.minSpeed &&
    !offroad &&
    brake === 0
  ) {
    state.drifting = true;
    state.driftDir = steer > 0 ? 1 : -1;
    state.driftTime = 0;
    state.driftLatch = true;
  }
  if (state.drifting) {
    state.driftTime += DT;
    state.driftAmount = Math.min(1, state.driftAmount + DT / DRIFT.enterTime);
  } else {
    state.driftAmount = Math.max(0, state.driftAmount - DT / DRIFT.exitTime);
  }
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
  const steer = clamp(input.steer, -1, 1);
  const brakeIn = clamp(input.brake, 0, 1);
  updateDrift(state, input, steer, brakeIn, vF, off);
  const drift = state.driftAmount;

  const engineAccel = kart.engineAccel * (off ? OFFROAD.accelFactor : 1);
  // Drift = aderencia lateral menor (rampa por driftAmount); sem drift, drift = 0 e nada muda
  const grip = kart.lateralGrip * (off ? OFFROAD.gripFactor : 1) * (1 + (DRIFT.gripFactor - 1) * drift);
  const rolling = PHYSICS.rollingResistance + (off ? OFFROAD.extraDrag : 0);

  // Longitudinal: motor com queda quadratica ate maxSpeed, freio, re
  const throttle = clamp(input.throttle, 0, 1);
  const brake = brakeIn;
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

  // Aderencia lateral: UM parametro (o drift ja baixou "grip" acima).
  const speedBefore = Math.hypot(vF, vL);
  vL *= Math.exp(-grip * DT);
  // No drift, parte da velocidade que a aderencia "comeu" volta para a frente: o kart gira o vetor
  // velocidade em vez de frear. Nunca passa da velocidade de antes (retention <= 1).
  if (drift > 0 && vF > 0) {
    const after = Math.hypot(vF, vL);
    const target = after + (speedBefore - after) * DRIFT.speedRetention * drift;
    vF = Math.sqrt(Math.max(0, target * target - vL * vL));
  }


  // Velocidade no mundo na base ATUAL; o giro do heading abaixo cria a velocidade
  // lateral do proximo passo, que a aderencia vai comendo (o kart "escorrega" um pouco).
  state.velocity.copy(_forward).multiplyScalar(vF).addScaledVector(_left, vL);
  state.position.addScaledVector(state.velocity, DT);
  state.forwardSpeed = vF;

  // Esterco: cai com a velocidade e as rodas viram a uma taxa limitada.
  // No drift o lado e fixo: o direcional so escolhe entre fechar (inner) e abrir (outer) a curva.
  let target;
  if (state.drifting) {
    const into = steer * state.driftDir; // +1 = para dentro, -1 = contra-esterco
    const angle = into >= 0
      ? DRIFT.steerNeutral + (DRIFT.steerInner - DRIFT.steerNeutral) * into
      : DRIFT.steerNeutral + (DRIFT.steerOuter - DRIFT.steerNeutral) * -into;
    target = -state.driftDir * angle; // steer +1 (direita) = yaw negativo
  } else {
    const s = Math.abs(vF) / STEERING.steerFalloffSpeed;
    target = -steer * (STEERING.maxSteer / (1 + s * s));
  }
  const maxDelta = STEERING.steerRate * DT;
  state.steerAngle += clamp(target - state.steerAngle, -maxDelta, maxDelta);

  // Yaw por bicicleta cinematica: sem velocidade, nao vira
  state.heading += ((vF * Math.tan(state.steerAngle)) / kart.wheelBase) * DT;
}
