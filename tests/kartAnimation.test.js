import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { STEERING } from '../src/config/tuning.js';
import { updateKartVisual, visualSteerAngle } from '../src/kart/kartAnimation.js';
import { stepKart } from '../src/physics/kartPhysics.js';
import { createKartState } from '../src/physics/kartState.js';

const asphalt = { surfaceAt: (_x, _z, _h, out) => Object.assign(out, { onAsphalt: true, index: 0 }) };
const DT_RENDER = 1 / 60;

/** Modelo minimo com os nos que a animacao usa (o real precisa de DOM para as texturas). */
function fakeModel() {
  const nodes = {};
  for (const name of ['root', 'steerFL', 'steerFR', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) nodes[name] = new Object3D();
  return { root: nodes.root, nodes, wheelRadius: 0.3, anim: { frontSpin: 0, rearSpin: 0 } };
}

/** Sport acelerado em reta e depois `n` passos com o input dado. */
function drive(steer, drift, n) {
  const s = createKartState({ type: 'sport', x: 0, z: 0, heading: 0 });
  for (let i = 0; i < 300; i++) stepKart(s, { throttle: 1, brake: 0, steer: 0, drift: false }, asphalt);
  for (let i = 0; i < n; i++) stepKart(s, { throttle: 1, brake: 0, steer, drift }, asphalt);
  return s;
}

/** Copia so os campos simples + vetores, para conferir que a animacao nao escreve no estado. */
const snapshot = (s) => JSON.stringify(s);

describe('rodas no drift', () => {
  it('fora do drift: rodas da frente = esterco fisico e as 4 rodas giram igual (como antes)', () => {
    const s = drive(1, false, 60);
    const m = fakeModel();
    updateKartVisual(m, s, 1, DT_RENDER);
    expect(m.nodes.steerFL.rotation.y).toBe(s.steerAngle);
    expect(m.nodes.steerFR.rotation.y).toBe(s.steerAngle);
    expect(m.anim.frontSpin).toBeCloseTo((s.forwardSpeed / m.wheelRadius) * DT_RENDER, 12);
    expect(m.anim.rearSpin).toBe(m.anim.frontSpin);
  });

  it.each([[1, 'direita'], [-1, 'esquerda']])('drift para a %s: contra-esterco (rodas para fora da curva)', (steer) => {
    const s = drive(steer, true, 90);
    expect(s.drifting).toBe(true);
    const m = fakeModel();
    updateKartVisual(m, s, 1, DT_RENDER);
    const wheels = m.nodes.steerFL.rotation.y;
    // fisica esterça para dentro (sinal oposto a steer: steer +1 = yaw negativo)...
    expect(Math.sign(s.steerAngle)).toBe(-steer);
    // ...o visual aponta para o outro lado, para onde o kart esta indo
    expect(Math.sign(wheels)).toBe(steer);
    expect(Math.abs(wheels)).toBeLessThanOrEqual(STEERING.maxSteer + 1e-12);
    expect(m.nodes.steerFR.rotation.y).toBe(wheels);
  });

  it('rodas da frente alinhadas com a velocidade (deriva abaixo do limite)', () => {
    // driftAmount = 1, deriva de 20 graus: a roda aponta exatamente para a velocidade
    const slip = (20 * Math.PI) / 180;
    expect(visualSteerAngle(-0.1, Math.cos(slip), Math.sin(slip), 1)).toBeCloseTo(slip, 12);
  });

  it('transicao suave: driftAmount mistura esterco fisico e contra-esterco', () => {
    const slip = 0.3;
    const vF = Math.cos(slip), vL = Math.sin(slip);
    expect(visualSteerAngle(-0.1, vF, vL, 0)).toBe(-0.1);
    expect(visualSteerAngle(-0.1, vF, vL, 0.5)).toBeCloseTo((-0.1 + slip) / 2, 12);
    expect(visualSteerAngle(-0.1, 0.1, 0.5, 1)).toBe(-0.1); // quase parado: sem deriva
  });

  it('no drift as rodas de tras giram mais rapido que a velocidade de avanco (patinando)', () => {
    const s = drive(1, true, 90);
    const m = fakeModel();
    updateKartVisual(m, s, 1, DT_RENDER);
    expect(m.anim.rearSpin).toBeGreaterThan((s.forwardSpeed / m.wheelRadius) * DT_RENDER);
    // a frente rola com a velocidade na direcao da roda: mais que vF (a roda aponta para a velocidade)
    expect(m.anim.frontSpin).toBeGreaterThan((s.forwardSpeed / m.wheelRadius) * DT_RENDER);
  });

  it('a animacao so le o estado fisico (regra 3)', () => {
    const s = drive(1, true, 90);
    const before = snapshot(s);
    const m = fakeModel();
    for (let i = 0; i < 10; i++) updateKartVisual(m, s, i / 10, DT_RENDER);
    expect(snapshot(s)).toBe(before);
  });
});
