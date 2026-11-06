// Modo de demonstracao da entrega de texturas. So renderizacao: nao toca em physics/, ai/, race/
// nem no KartInput. Teclas (event.code, so na borda de descida):
//   T  textura real <-> UV checker        L  textura + luz <-> so textura (MeshBasicMaterial)
//   C  camera de perseguicao <-> inspecao  V  proximo alvo da inspecao       H  mostra/esconde HUD
import { MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA } from '../config/tuning.js';
import { loadTexture } from './textures.js';

const INSPECT_OFFSET = [5, 3, 5]; // m - posicao inicial da camera de inspecao relativa ao alvo

/**
 * @typedef {object} DemoState
 * @property {boolean} checker
 * @property {boolean} unlit
 * @property {boolean} inspect
 * @property {number} target indice em targets
 * @property {boolean} hud
 */

/**
 * @param {{
 *   scene: import('three').Scene,
 *   domElement: HTMLElement,
 *   aspect: number,
 *   targets: Array<{ name: string, get: (out: Vector3) => Vector3 }>,
 *   onChange?: (state: DemoState, targetName: string) => void,
 * }} options
 */
export function createDemoMode({ scene, domElement, aspect, targets, onChange }) {
  /** @type {DemoState} */
  const state = { checker: false, unlit: false, inspect: false, target: 0, hud: true };
  const checkerClones = [];
  // Clones feitos antes do PNG carregar precisam de upload quando ele chegar
  const checker = loadTexture('uv_checker', {
    color: true,
    onLoad: () => checkerClones.forEach((t) => (t.needsUpdate = true)),
  });

  // Por material original: mapas reais, o clone do checker e o espelho MeshBasicMaterial
  const entries = new Map();
  // Por mesh: material(is) original(is) e espelho(s) sem luz
  const meshes = new Map();

  function entryFor(material) {
    if (entries.has(material)) return entries.get(material);
    let checkerMap = null;
    if (material.map) {
      checkerMap = checker.clone();
      const [ru, rv] = material.userData.checkerRepeat ?? [1, 1];
      checkerMap.repeat.set(ru, rv);
      if (checker.image) checkerMap.needsUpdate = true;
      checkerClones.push(checkerMap);
    }
    const basic = new MeshBasicMaterial({
      name: `${material.name || material.type}-basic`,
      color: material.color,
      map: material.map,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
      side: material.side,
    });
    const entry = {
      material,
      basic,
      map: material.map,
      normalMap: material.normalMap,
      roughnessMap: material.roughnessMap,
      checkerMap,
    };
    entries.set(material, entry);
    return entry;
  }

  /** Registra os meshes da cena (chamar de novo se karts/pista forem recriados). */
  function collect() {
    scene.traverse((obj) => {
      if (!obj.isMesh || meshes.has(obj)) return;
      const lit = obj.material;
      const unlit = Array.isArray(lit) ? lit.map((m) => entryFor(m).basic) : entryFor(lit).basic;
      meshes.set(obj, { lit, unlit });
    });
    apply();
  }

  function apply() {
    for (const e of entries.values()) {
      if (!e.map) continue;
      const map = state.checker ? e.checkerMap : e.map;
      e.material.map = map;
      // No checker, so o mapeamento importa: relevo e rugosidade desligados
      e.material.normalMap = state.checker ? null : e.normalMap;
      e.material.roughnessMap = state.checker ? null : e.roughnessMap;
      e.material.needsUpdate = true;
      e.basic.map = map;
      e.basic.needsUpdate = true;
    }
    for (const [mesh, m] of meshes) mesh.material = state.unlit ? m.unlit : m.lit;
    onChange?.(state, targets[state.target].name);
  }

  // Camera de inspecao: orbita (arrastar), zoom (roda), pan (botao direito) em torno do alvo
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.05, 1000);
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.enabled = false;
  const targetPos = new Vector3();
  const delta = new Vector3();

  function jumpToTarget() {
    targets[state.target].get(targetPos);
    controls.target.copy(targetPos);
    camera.position.set(targetPos.x + INSPECT_OFFSET[0], targetPos.y + INSPECT_OFFSET[1], targetPos.z + INSPECT_OFFSET[2]);
    controls.update();
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyT': state.checker = !state.checker; break;
      case 'KeyL': state.unlit = !state.unlit; break;
      case 'KeyC':
        state.inspect = !state.inspect;
        controls.enabled = state.inspect;
        if (state.inspect) jumpToTarget();
        break;
      case 'KeyV':
        state.target = (state.target + 1) % targets.length;
        if (state.inspect) jumpToTarget();
        break;
      case 'KeyH': state.hud = !state.hud; break;
      default: return;
    }
    apply();
  }
  window.addEventListener('keydown', onKeyDown);

  return {
    state,
    collect,
    /** Chamar a cada frame de render: a inspecao acompanha o alvo (ex.: kart andando). */
    update() {
      if (!state.inspect) return;
      targets[state.target].get(targetPos);
      delta.subVectors(targetPos, controls.target);
      camera.position.add(delta);
      controls.target.copy(targetPos);
      controls.update();
    },
    /** @param {import('three').Camera} chaseCamera */
    camera(chaseCamera) {
      return state.inspect ? camera : chaseCamera;
    },
    /** @param {number} aspectRatio */
    resize(aspectRatio) {
      camera.aspect = aspectRatio;
      camera.updateProjectionMatrix();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      state.checker = state.unlit = false;
      apply();
      controls.dispose();
      for (const e of entries.values()) e.basic.dispose();
      checkerClones.forEach((t) => t.dispose());
      checker.dispose();
      entries.clear();
      meshes.clear();
    },
  };
}
