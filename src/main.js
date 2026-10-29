// Bootstrap: cria renderer, cena e inicia o game loop.
import { ACESFilmicToneMapping, Color, Fog, PCFSoftShadowMap, Scene, WebGLRenderer } from 'three';
import { GRID, TRACK_GEN } from './config/tuning.js';
import { createKeyboardInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createKartModel } from './kart/kartModel.js';
import { updateKartVisual } from './kart/kartAnimation.js';
import { stepKart } from './physics/kartPhysics.js';
import { createKartInput, createKartState, resetKartState } from './physics/kartState.js';
import { createChaseCamera } from './render/camera.js';
import { createLights } from './render/lights.js';
import { getMaterials } from './render/materials.js';
import { TEST_TRACK } from './track/trackData.js';
import { buildTrackSamples } from './track/trackGeometry.js';
import { createTrackMeshes } from './track/trackMeshes.js';
import { createTrackQuery } from './track/trackQuery.js';

const SKY = 0x8fbbe3;

const canvas = document.getElementById('game');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;

const scene = new Scene();
scene.background = new Color(SKY);
scene.fog = new Fog(SKY, 90, 340);

// Pista: dados -> amostras -> malhas + consulta de superficie
const samples = buildTrackSamples(TEST_TRACK, TRACK_GEN.samples);
const track = createTrackQuery(samples);
scene.add(createTrackMeshes(samples, getMaterials()).group);

// Grid: jogador (sport) a direita; sedan parado a esquerda e a frente, visivel na largada
function gridPose(slot) {
  const [x, z] = TEST_TRACK.start.position;
  const h = TEST_TRACK.start.heading;
  const side = slot === 0 ? -1 : 1; // +X local = esquerda
  const ahead = slot * GRID.rowGap;
  return {
    x: x + Math.cos(h) * side * GRID.lateralOffset + Math.sin(h) * ahead,
    z: z - Math.sin(h) * side * GRID.lateralOffset + Math.cos(h) * ahead,
    heading: h,
  };
}

const karts = [
  { type: 'sport', color: 0xd7262e, number: 7 },
  { type: 'sedan', color: 0x2f6fd6, number: 12 },
].map((opts, slot) => {
  const state = createKartState({ type: opts.type, ...gridPose(slot) });
  const model = createKartModel(opts);
  scene.add(model.root);
  return { state, model, input: createKartInput() };
});
const player = karts[0];

const keyboard = createKeyboardInput(window);
const chase = createChaseCamera(window.innerWidth / window.innerHeight);
const lights = createLights(scene);

function step() {
  keyboard.read(player.input);
  // R volta o jogador para o grid (ainda nao ha respawn)
  if (keyboard.isDown('KeyR')) {
    const pose = gridPose(0);
    resetKartState(player.state, pose.x, pose.z, pose.heading);
    chase.snap();
  }
  for (const kart of karts) stepKart(kart.state, kart.input, track);
}

function render(alpha, frameTime) {
  for (const kart of karts) updateKartVisual(kart.model, kart.state, alpha, frameTime);
  const root = player.model.root;
  chase.update(root.position, root.rotation.y, frameTime);
  lights.follow(root.position);
  renderer.render(scene, chase.camera);
}

window.addEventListener('resize', () => {
  chase.camera.aspect = window.innerWidth / window.innerHeight;
  chase.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createLoop({ step, render }).start();
