import { describe, expect, it } from 'vitest';
import { DRIFT, TRACK_GEN } from '../src/config/tuning.js';
import { createRng } from '../src/core/rng.js';
import { stepKart } from '../src/physics/kartPhysics.js';
import { createKartInput, createKartState, resetKartState } from '../src/physics/kartState.js';
import { TEST_TRACK } from '../src/track/trackData.js';
import { buildTrackSamples } from '../src/track/trackGeometry.js';
import { createTrackQuery } from '../src/track/trackQuery.js';

const track = createTrackQuery(buildTrackSamples(TEST_TRACK, TRACK_GEN.samples));
const asphaltEverywhere = { surfaceAt: (_x, _z, _h, out) => Object.assign(out, { onAsphalt: true, index: 0 }) };
const grassEverywhere = { surfaceAt: (_x, _z, _h, out) => Object.assign(out, { onAsphalt: false, index: 0 }) };

/** Sequencia de inputs pseudoaleatoria, mas fixa pela seed. */
function scriptedInputs(seed, steps) {
  const rng = createRng(seed);
  const inputs = [];
  let current = createKartInput();
  for (let i = 0; i < steps; i++) {
    if (i % 20 === 0) {
      current = {
        throttle: rng() < 0.75 ? 1 : 0,
        brake: rng() < 0.15 ? 1 : 0,
        steer: Math.round(rng() * 2 - 1),
        drift: rng() < 0.4,
      };
    }
    inputs.push(current);
  }
  return inputs;
}

function simulate(type, inputs) {
  const state = createKartState({ type, x: 0, z: 0, heading: 0 });
  for (const input of inputs) stepKart(state, input, track);
  return state;
}

function run(type, input, steps, surface) {
  const state = createKartState({ type, x: 0, z: 0, heading: 0 });
  for (let i = 0; i < steps; i++) stepKart(state, input, surface);
  return state;
}

describe('determinismo', () => {
  it.each(['sport', 'sedan'])('mesma sequencia de inputs = mesmo estado final (%s, 1200 passos)', (type) => {
    const inputs = scriptedInputs(1234, 1200);
    const a = simulate(type, inputs);
    const b = simulate(type, inputs);
    expect(a).toEqual(b);
    expect(a.position.x).toBe(b.position.x); // igualdade exata, nao "proximo"
    expect(a.heading).toBe(b.heading);
    expect(a.position.length()).toBeGreaterThan(10); // a corrida realmente andou
  });
});

describe('comportamento basico', () => {
  it('parado sem input continua parado e finito', () => {
    const s = run('sport', createKartInput(), 600, track);
    expect(s.position.x).toBe(0);
    expect(s.position.z).toBe(0);
    expect(s.forwardSpeed).toBe(0);
    expect(Number.isFinite(s.heading)).toBe(true);
  });

  it('acelerar anda para +Z (frente do kart)', () => {
    const s = run('sport', { ...createKartInput(), throttle: 1 }, 120, asphaltEverywhere);
    expect(s.position.z).toBeGreaterThan(10);
    expect(Math.abs(s.position.x)).toBeLessThan(1e-9);
  });

  it('acelerar + direita vira para -X (+X local e a esquerda)', () => {
    const s = run('sport', { ...createKartInput(), throttle: 1, steer: 1 }, 90, asphaltEverywhere);
    expect(s.position.x).toBeLessThan(-1);
    expect(s.heading).toBeLessThan(0);
  });

  it('freio parado vira re', () => {
    const s = run('sport', { ...createKartInput(), brake: 1 }, 120, asphaltEverywhere);
    expect(s.forwardSpeed).toBeLessThan(0);
    expect(s.position.z).toBeLessThan(0);
  });

  it('sport e mais rapido que sedan; grama limita a velocidade', () => {
    const throttle = { ...createKartInput(), throttle: 1 };
    const sport = run('sport', throttle, 1800, asphaltEverywhere).forwardSpeed;
    const sedan = run('sedan', throttle, 1800, asphaltEverywhere).forwardSpeed;
    const sportGrass = run('sport', throttle, 1800, grassEverywhere).forwardSpeed;
    expect(sport).toBeGreaterThan(sedan);
    expect(sportGrass).toBeLessThan(sport * 0.7);
  });
});

// --- drift ---

const input = (throttle, steer, drift, brake = 0) => ({ throttle, brake, steer, drift });

/** Kart em reta, acelerado por `steps` passos (sport a ~27 m/s com 300). */
function atSpeed(type = 'sport', steps = 300, surface = asphaltEverywhere) {
  const s = createKartState({ type, x: 0, z: 0, heading: 0 });
  for (let i = 0; i < steps; i++) stepKart(s, input(1, 0, false), surface);
  return s;
}

function steps(state, inp, n, surface = asphaltEverywhere) {
  for (let i = 0; i < n; i++) stepKart(state, inp, surface);
  return state;
}

/** Angulo de deriva: entre o nariz e o vetor velocidade (rad, valor absoluto). */
function slip(s) {
  const vL = s.velocity.x * Math.cos(s.heading) - s.velocity.z * Math.sin(s.heading);
  return Math.abs(Math.atan2(vL, s.forwardSpeed));
}

describe('drift', () => {
  it('determinismo com drift: a sequencia de inputs com Espaco realmente entra em drift', () => {
    const inputs = scriptedInputs(99, 1200);
    const state = createKartState({ type: 'sport', x: 0, z: 0, heading: 0 });
    let drifted = 0;
    for (const inp of inputs) {
      stepKart(state, inp, asphaltEverywhere);
      if (state.drifting) drifted++;
    }
    expect(drifted).toBeGreaterThan(30);
    expect(simulate('sport', inputs)).toEqual(simulate('sport', inputs));
  });

  it('sem o botao, o drift nunca liga (dirigir normal nao mudou)', () => {
    const s = atSpeed();
    for (let i = 0; i < 240; i++) {
      stepKart(s, input(1, i < 120 ? 1 : -1, false), asphaltEverywhere);
      expect(s.drifting).toBe(false);
      expect(s.driftAmount).toBe(0);
    }
  });

  it('entra com botao + esterco acima da velocidade minima; o lado vem do esterco', () => {
    const right = steps(atSpeed(), input(1, 1, true), 1);
    expect(right.drifting).toBe(true);
    expect(right.driftDir).toBe(1);
    const left = steps(atSpeed(), input(1, -1, true), 1);
    expect(left.driftDir).toBe(-1);
  });

  it('nao entra: sem esterco, devagar, freando ou na grama', () => {
    expect(steps(atSpeed(), input(1, 0, true), 30).drifting).toBe(false);
    expect(steps(atSpeed('sport', 15), input(1, 1, true), 1).drifting).toBe(false); // ~3 m/s
    expect(steps(atSpeed(), input(1, 1, true, 1), 1).drifting).toBe(false);
    expect(steps(atSpeed('sport', 300, grassEverywhere), input(1, 1, true), 1, grassEverywhere).drifting).toBe(false);
  });

  it('o lado fica travado: contra-esterco so abre a curva, nao inverte', () => {
    const s = steps(atSpeed(), input(1, 1, true), 60); // drift para a direita
    const h0 = s.heading;
    steps(s, input(1, -1, true), 120); // direcional todo para a esquerda
    expect(s.drifting).toBe(true);
    expect(s.driftDir).toBe(1);
    expect(s.heading).toBeLessThan(h0); // continua virando para a direita (yaw negativo)
  });

  it('direcional para dentro fecha a curva, contra-esterco abre', () => {
    const turn = (steer) => {
      const s = steps(atSpeed(), input(1, 1, true), 30);
      const h0 = s.heading;
      steps(s, input(1, steer, true), 120);
      return Math.abs(s.heading - h0);
    };
    expect(turn(1)).toBeGreaterThan(turn(0));
    expect(turn(0)).toBeGreaterThan(turn(-1));
  });

  it('derrapa bem mais que a curva normal e quase nao perde velocidade', () => {
    for (const type of ['sport', 'sedan']) {
      const normal = steps(atSpeed(type), input(1, 1, false), 180);
      const start = atSpeed(type);
      const v0 = start.velocity.length();
      const drift = steps(start, input(1, 1, true), 180);
      expect(slip(drift)).toBeGreaterThan(3 * slip(normal));
      expect(drift.velocity.length()).toBeGreaterThan(0.95 * v0);
    }
  });

  it('a velocidade nunca aumenta por causa do drift (sem acelerar)', () => {
    const s = steps(atSpeed(), input(1, 1, true), 30);
    let v = s.velocity.length();
    for (let i = 0; i < 120; i++) {
      stepKart(s, input(0, 1, true), asphaltEverywhere);
      const now = s.velocity.length();
      expect(now).toBeLessThanOrEqual(v + 1e-9);
      v = now;
    }
  });

  it('soltar o botao: sai do drift e a aderencia volta em exitTime, sem tranco', () => {
    const s = steps(atSpeed(), input(1, 1, true), 120);
    expect(s.driftAmount).toBe(1);
    stepKart(s, input(1, 0, false), asphaltEverywhere);
    expect(s.drifting).toBe(false);
    expect(s.driftAmount).toBeGreaterThan(0.9); // rampa, nao degrau
    steps(s, input(1, 0, false), Math.ceil(DRIFT.exitTime * 60));
    expect(s.driftAmount).toBe(0);
    steps(s, input(1, 0, false), 20);
    expect(slip(s)).toBeLessThan((3 * Math.PI) / 180);
  });

  it('frear ou sair do asfalto cancela; para outro drift precisa soltar e apertar de novo', () => {
    const s = steps(atSpeed(), input(1, 1, true), 30);
    stepKart(s, input(0, 1, true, 1), asphaltEverywhere); // freou
    expect(s.drifting).toBe(false);
    steps(s, input(1, 1, true), 30); // botao ainda segurado: nao volta sozinho
    expect(s.drifting).toBe(false);
    stepKart(s, input(1, 1, false), asphaltEverywhere); // soltou
    stepKart(s, input(1, 1, true), asphaltEverywhere); // apertou de novo
    expect(s.drifting).toBe(true);

    stepKart(s, input(1, 1, true), grassEverywhere);
    expect(s.drifting).toBe(false);
  });

  it('cai do drift abaixo de exitSpeed e conta driftTime enquanto dura', () => {
    const s = steps(atSpeed(), input(1, 1, true), 60);
    expect(s.driftTime).toBeCloseTo(60 / 60, 6);
    for (let i = 0; i < 1200 && s.drifting; i++) stepKart(s, input(0, 1, true), asphaltEverywhere);
    expect(s.drifting).toBe(false);
    expect(s.forwardSpeed).toBeLessThan(DRIFT.exitSpeed);
    expect(s.driftTime).toBe(0);
  });

  it('reset limpa o drift', () => {
    const s = steps(atSpeed(), input(1, 1, true), 30);
    resetKartState(s, 0, 0, 0);
    expect(s.drifting).toBe(false);
    expect(s.driftDir).toBe(0);
    expect(s.driftAmount).toBe(0);
    expect(s.driftLatch).toBe(false);
  });
});
