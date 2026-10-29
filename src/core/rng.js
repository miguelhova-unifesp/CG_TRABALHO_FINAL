// RNG com seed para a simulacao 

/**
 * Gerador mulberry32: rapido, 32 bits, mesma sequencia para a mesma seed.
 * @param {number} seed inteiro de 32 bits
 * @returns {() => number} funcao que devolve um numero em [0, 1)
 */

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
