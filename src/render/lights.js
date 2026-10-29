// Luz basica: ceu/chao hemisferico + sol direcional com sombra que acompanha o jogador.
import { DirectionalLight, HemisphereLight } from 'three';

const SUN_OFFSET = [30, 50, -20]; // m - posicao do sol relativa ao alvo
const SHADOW_HALF_SIZE = 25; // m - meia largura da caixa de sombra em torno do jogador

/** @param {import('three').Scene} scene */
export function createLights(scene) {
  const hemi = new HemisphereLight(0xcfe4ff, 0x4f6b3a, 1.1);
  const sun = new DirectionalLight(0xfff2dd, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -SHADOW_HALF_SIZE;
  cam.right = cam.top = SHADOW_HALF_SIZE;
  cam.near = 1;
  cam.far = 150;
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);

  return {
    /** @param {import('three').Vector3} target */
    follow(target) {
      sun.target.position.copy(target);
      sun.position.set(target.x + SUN_OFFSET[0], target.y + SUN_OFFSET[1], target.z + SUN_OFFSET[2]);
    },
  };
}
