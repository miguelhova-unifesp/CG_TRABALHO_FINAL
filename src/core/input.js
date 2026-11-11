// Teclado/gamepad -> KartInput { throttle, brake, steer, drift }.
// Por enquanto so teclado. Usa event.code (posicao fisica da tecla, independe do layout).

const THROTTLE = ['KeyW', 'ArrowUp'];
const BRAKE = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const DRIFT = ['Space']; // segurar = drift (ver physics/kartPhysics.js)
const CAPTURED = new Set([...THROTTLE, ...BRAKE, ...LEFT, ...RIGHT, ...DRIFT]);

/**
 * @param {Window | HTMLElement} target onde escutar o teclado
 * @returns {{
 *   read: (out: import('../physics/kartState.js').KartInput) => import('../physics/kartState.js').KartInput,
 *   isDown: (code: string) => boolean,
 *   dispose: () => void,
 * }}
 */

export function createKeyboardInput(target = window) {
  const down = new Set();

  function onKeyDown(e) {
    if (CAPTURED.has(e.code)) e.preventDefault(); // setas/Espaco nao rolam a pagina
    down.add(e.code);
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onBlur() {
    down.clear(); // evita tecla "presa" ao trocar de janela
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const any = (codes) => codes.some((c) => down.has(c));

  return {
    read(out) {
      out.throttle = any(THROTTLE) ? 1 : 0;
      out.brake = any(BRAKE) ? 1 : 0;
      out.steer = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      out.drift = any(DRIFT);
      return out;
    },
    isDown: (code) => down.has(code),
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
