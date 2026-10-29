// Camera em 3a pessoa
import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../config/tuning.js';

/** @param {number} aspect */
export function createChaseCamera(aspect) {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 1000);
  const desired = new Vector3();
  const lookAt = new Vector3();
  let snapped = false;

  /**
   * @param {Vector3} target posicao (interpolada) do kart
   * @param {number} heading (rad)
   * @param {number} frameTime (s)
   */
  function update(target, heading, frameTime) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    desired.set(target.x - fx * CAMERA.distance, target.y + CAMERA.height, target.z - fz * CAMERA.distance);
    if (snapped) {
      camera.position.lerp(desired, 1 - Math.exp(-CAMERA.smoothing * frameTime));
    } else {
      camera.position.copy(desired);
      snapped = true;
    }
    lookAt.set(target.x + fx * CAMERA.lookAhead, target.y + CAMERA.lookHeight, target.z + fz * CAMERA.lookAhead);
    camera.lookAt(lookAt);
  }

  return {
    camera,
    update,
    /** Proximo update vai direto para a posicao desejada (ex.: reset do kart). */
    snap() {
      snapped = false;
    },
  };
}
