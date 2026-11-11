// Modo debug de texturas e iluminacao (desligado por padrao). So renderizacao: troca mapas e cores
// dos materiais, liga/desliga luzes (light.visible) e escolhe a camera; nao toca em physics/, ai/,
// race/ nem no KartInput. Teclas em DEBUG_VIEW.keys (config/tuning.js), so na borda de descida.
import { Color, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA, DEBUG_VIEW } from '../config/tuning.js';
import { loadTexture } from './textures.js';

const INSPECT_OFFSET = [5, 3, 5]; // m - posicao inicial da camera de inspecao relativa ao alvo
const KEYS = DEBUG_VIEW.keys;
const WHITE = new Color(0xffffff);

/**
 * @typedef {object} DemoState
 * @property {boolean} enabled modo debug ligado (sem ele, nenhuma outra tecla faz efeito)
 * @property {boolean} checker textura xadrez de UV no lugar de todas as texturas
 * @property {boolean} untextured sem texturas (cor lisa), mantendo a luz
 * @property {boolean} unlit so textura, sem luz (MeshBasicMaterial)
 * @property {boolean} hemiLight luz hemisferica ligada
 * @property {boolean} sunLight sol (direcional + sombra) ligado
 * @property {boolean} uvLayouts painel de layouts UV aberto
 * @property {boolean} inspect camera de inspecao
 * @property {number} target indice em targets
 * @property {boolean} hud painel de teclas visivel
 */

/** @returns {DemoState} */
function defaultState(enabled) {
  return {
    enabled,
    checker: false,
    untextured: false,
    unlit: false,
    hemiLight: true,
    sunLight: true,
    uvLayouts: false,
    inspect: false,
    target: 0,
    hud: true,
  };
}

/**
 * @param {{
 *   scene: import('three').Scene,
 *   domElement: HTMLElement,
 *   aspect: number,
 *   lights: { hemi: import('three').Light, sun: import('three').Light },
 *   targets: Array<{ name: string, get: (out: Vector3) => Vector3 }>,
 *   onChange?: (state: DemoState, targetName: string) => void,
 * }} options
 */
export function createDemoMode({ scene, domElement, aspect, lights, targets, onChange }) {
  const startEnabled = DEBUG_VIEW.enabledByDefault || new URLSearchParams(window.location.search).has('debug');
  const state = defaultState(startEnabled);
  const checkerClones = [];
  // Clones feitos antes do PNG carregar precisam de upload quando ele chegar
  const checker = loadTexture('uv_checker', {
    color: true,
    onLoad: () => checkerClones.forEach((t) => (t.needsUpdate = true)),
  });

  // Por material original: mapas e cor reais, o clone do checker e o espelho MeshBasicMaterial
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
    const flat = material.userData.untexturedColor;
    const entry = {
      material,
      basic,
      map: material.map,
      normalMap: material.normalMap,
      roughnessMap: material.roughnessMap,
      color: material.color.clone(),
      untexturedColor: flat === undefined ? material.color.clone() : new Color(flat),
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
      let map = e.map, normalMap = e.normalMap, roughnessMap = e.roughnessMap, color = e.color;
      if (state.untextured) {
        // Sem textura: cor lisa (media aproximada da textura), mesma luz e mesma rugosidade base
        map = normalMap = roughnessMap = null;
        color = e.untexturedColor;
      } else if (state.checker) {
        // No checker so o mapeamento importa: relevo, rugosidade e tinta do kart desligados
        map = e.checkerMap;
        normalMap = roughnessMap = null;
        color = WHITE;
      }
      const m = e.material;
      if (m.map !== map || m.normalMap !== normalMap || m.roughnessMap !== roughnessMap) {
        m.map = map;
        m.normalMap = normalMap;
        m.roughnessMap = roughnessMap;
        m.needsUpdate = true; // muda os defines do shader
        e.basic.map = map;
        e.basic.needsUpdate = true;
      }
      m.color.copy(color);
      e.basic.color.copy(color);
    }
    for (const [mesh, m] of meshes) mesh.material = state.unlit ? m.unlit : m.lit;
    lights.hemi.visible = state.hemiLight;
    lights.sun.visible = state.sunLight; // luz invisivel sai do calculo e da sombra
    controls.enabled = state.inspect;
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

  /** Booleanos que alternam direto com a tecla de mesmo nome em DEBUG_VIEW.keys. */
  const TOGGLES = ['checker', 'untextured', 'unlit', 'hemiLight', 'sunLight', 'uvLayouts', 'hud'];
  const keyToToggle = new Map(TOGGLES.map((name) => [KEYS[name === 'untextured' ? 'textures' : name], name]));

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === KEYS.toggle) {
      // Desligar o modo volta tudo ao normal (texturas, luzes, camera)
      Object.assign(state, defaultState(!state.enabled));
      apply();
      return;
    }
    if (!state.enabled) return;
    if (keyToToggle.has(e.code)) {
      const name = keyToToggle.get(e.code);
      state[name] = !state[name];
    } else if (e.code === KEYS.inspect) {
      state.inspect = !state.inspect;
      if (state.inspect) jumpToTarget();
    } else if (e.code === KEYS.nextTarget) {
      state.target = (state.target + 1) % targets.length;
      if (state.inspect) jumpToTarget();
    } else {
      return;
    }
    apply();
  }
  window.addEventListener('keydown', onKeyDown);

  return {
    state,
    collect,
    /**
     * Altera um campo do estado fora do teclado (ex.: botao de fechar o painel de UV).
     * @param {keyof DemoState} key
     * @param {boolean} value
     */
    set(key, value) {
      state[key] = value;
      apply();
    },
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
      Object.assign(state, defaultState(false));
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
