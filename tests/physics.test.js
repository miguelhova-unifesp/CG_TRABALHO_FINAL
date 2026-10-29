import { describe, expect, it } from 'vitest';
import { TRACK_GEN } from '../src/config/tuning.js';
import { createRng } from '../src/core/rng.js';
import { stepKart } from '../src/physics/kartPhysics.js';
import { createKartInput, createKartState } from '../src/physics/kartState.js';
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
        drift: false,
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
