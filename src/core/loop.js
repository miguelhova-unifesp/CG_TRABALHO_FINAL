// Game loop com passo fixo DT = 1/60 via acumulador; render interpola entre estados (regra 1).
import { DT, LOOP } from '../config/tuning.js';

/**
 * Soma o tempo do frame ao acumulador e roda quantos passos fixos couberem.
 * Pura (sem relogio) para poder ser testada.
 * @param {number} accumulator tempo pendente (s)
 * @param {number} frameTime duracao do frame (s)
 * @param {() => void} step um passo de simulacao de DT
 * @returns {number} novo acumulador, sempre em [0, DT)
 */

export function advanceAccumulator(accumulator, frameTime, step) {
  accumulator += Math.min(Math.max(frameTime, 0), LOOP.maxFrameTime);
  while (accumulator >= DT) {
    step();
    accumulator -= DT;
  }
  return accumulator;
}

/**
 * @param {{ step: () => void, render: (alpha: number, frameTime: number) => void }} callbacks
 *   step: avanca a simulacao DT; render: alpha em [0, 1) entre estado anterior e atual
 */

export function createLoop({ step, render }) {
  let accumulator = 0;
  let last = 0;
  let rafId = 0;

  function frame(now) {
    const frameTime = (now - last) / 1000;
    last = now;
    accumulator = advanceAccumulator(accumulator, frameTime, step);
    render(accumulator / DT, Math.min(frameTime, LOOP.maxFrameTime));
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(rafId);
    },
  };
}
