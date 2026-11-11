// Bootstrap: cria renderer, cena e inicia o game loop.
import { ACESFilmicToneMapping, Color, Fog, PCFSoftShadowMap, Scene, WebGLRenderer } from 'three';
import { DEBUG_VIEW, GRID, TRACK_GEN } from './config/tuning.js';
import { createKeyboardInput } from './core/input.js';
import { createLoop } from './core/loop.js';
import { createKartModel, getKartGeometries } from './kart/kartModel.js';
import { HELMET_TEXTURE_SIZE } from './kart/kartUV.js';
import { updateKartVisual } from './kart/kartAnimation.js';
import { stepKart } from './physics/kartPhysics.js';
import { createKartInput, createKartState, resetKartState } from './physics/kartState.js';
import { createChaseCamera } from './render/camera.js';
import { createDemoMode } from './render/demoMode.js';
import { createLights } from './render/lights.js';
import { getMaterials } from './render/materials.js';
import { configureTextures } from './render/textures.js';
import { createUvLayoutSpecs, drawUvLayout } from './render/uvLayout.js';
import { TEST_TRACK } from './track/trackData.js';
import { buildTrackSamples, tightestSampleIndex } from './track/trackGeometry.js';
import { createTrackMeshes } from './track/trackMeshes.js';
import { createTrackQuery } from './track/trackQuery.js';
import { createDemoHud, keyLabel } from './ui/demoHud.js';
import { createUvLayoutPanel } from './ui/uvLayoutPanel.js';

const SKY = 0x8fbbe3;

const canvas = document.getElementById('game');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
configureTextures(renderer); // anisotropia maxima; antes de getMaterials()

const scene = new Scene();
scene.background = new Color(SKY);
scene.fog = new Fog(SKY, 90, 340);

// Pista: dados -> amostras -> malhas + consulta de superficie
const samples = buildTrackSamples(TEST_TRACK, TRACK_GEN.samples);
const track = createTrackQuery(samples);
const trackMeshes = createTrackMeshes(samples, getMaterials());
scene.add(trackMeshes.group);

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

const hairpin = tightestSampleIndex(samples); // alvo da inspecao para ver a distorcao no grampo

// Modo debug de texturas/luz (so render, desligado por padrao - ver docs/TEXTURES.md)
const hud = createDemoHud();
const trackGeometry = (name) => trackMeshes.group.getObjectByName(name).geometry;
const uvPanel = createUvLayoutPanel({
  // Desenhado so na 1a abertura; le geometrias/texturas, nao altera nada
  build: () =>
    createUvLayoutSpecs({
      track: { asphalt: trackGeometry('asphalt'), curbs: trackGeometry('curbs'), rails: trackGeometry('guardRails') },
      karts: { sport: getKartGeometries('sport'), sedan: getKartGeometries('sedan') },
      textures: getMaterials().textures,
      helmetTexture: player.model.helmetTexture,
      trackWidth: TEST_TRACK.width,
      // proporcao da textura do capacete = (volta no equador) / (arco do topo a borda)
      helmetMeters: [HELMET_TEXTURE_SIZE.width, HELMET_TEXTURE_SIZE.height],
    }).map((spec) => ({ name: spec.name, title: spec.title, canvas: drawUvLayout(spec) })),
  closeHint: keyLabel(DEBUG_VIEW.keys.uvLayouts),
  onClose: () => demo.set('uvLayouts', false),
});
const demo = createDemoMode({
  scene,
  domElement: canvas,
  aspect: window.innerWidth / window.innerHeight,
  lights,
  targets: [
    { name: 'kart do jogador', get: (out) => out.copy(player.model.root.position).setY(0.6) },
    { name: 'kart sedan', get: (out) => out.copy(karts[1].model.root.position).setY(0.6) },
    { name: 'emenda da volta (largada)', get: (out) => out.set(samples.px[0], 0, samples.pz[0]) },
    { name: 'grampo', get: (out) => out.set(samples.px[hairpin], 0, samples.pz[hairpin]) },
  ],
  onChange: (state, targetName) => {
    hud.update(state, targetName);
    uvPanel.setOpen(state.enabled && state.uvLayouts);
  },
});
demo.collect();

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
  demo.update();
  renderer.render(scene, demo.camera(chase.camera));
}

window.addEventListener('resize', () => {
  chase.camera.aspect = window.innerWidth / window.innerHeight;
  chase.camera.updateProjectionMatrix();
  demo.resize(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createLoop({ step, render }).start();
