/* Modelo hierarquico do kart. 

 root                      posicao/heading (interpolados do KartState)
 ├─ chassis                reservado p/ roll/pitch procedural
 │  ├─ body                carcaca
 │  ├─ windows             cabine (vidro)
 │  ├─ number              placa traseira
 │  └─ driver
 │     ├─ torso
 │     └─ head
 │        └─ helmet
 ├─ steerFL -> wheelFL     pivo de esterco -> no de giro
 ├─ steerFR -> wheelFR
 ├─ wheelRL
 └─ wheelRR
*/ 

import {
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
} from 'three';
import { KART_TYPES } from '../config/tuning.js';
import { createHelmetTexture, createNumberTexture, getMaterials } from '../render/materials.js';
import { KART_SHAPES } from './kartShapes.js';
import { ATLAS_RECTS, HELMET_SPHERE, HELMET_TEXTURE_SIZE, HELMET_LAYOUT, applyBodyBoxUV, remapToAtlas } from './kartUV.js';

const BEVEL = 0.05; // m - arredondamento das arestas da carcaca/cabine
const HELMET_RADIUS = 0.14; // m
const HEAD_RADIUS = 0.1; // m
const TORSO_HEIGHT = 0.4; // m

// Geometrias compartilhadas por tipo 
const geometryCache = new Map();

/** Extruda um perfil lateral na largura do kart, centrado em x. */
function extrudeProfile(draw, width) {
  const shape = new Shape();
  draw(shape);
  const depth = width - 2 * BEVEL;
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    curveSegments: 16,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
  });

  // Shape x -> kart z (frente), extrusao -> kart x
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(depth / 2, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Capacete: esfera aberta embaixo, com a faixa da frente num 2o grupo de material (viseira). */

function createHelmetGeometry() {
  const { widthSegments, heightSegments, thetaLength } = HELMET_SPHERE;
  const geometry = new SphereGeometry(HELMET_RADIUS, widthSegments, heightSegments, 0, Math.PI * 2, 0, thetaLength);
  const index = geometry.index.array;
  const pos = geometry.attributes.position;
  const shell = [];
  const visor = [];
  for (let i = 0; i < index.length; i += 3) {
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      y += pos.getY(index[i + k]) / 3;
      z += pos.getZ(index[i + k]) / 3;
    }
    const isVisor = z > HELMET_RADIUS * 0.45 && y > -HELMET_RADIUS * 0.35 && y < HELMET_RADIUS * 0.35;
    (isVisor ? visor : shell).push(index[i], index[i + 1], index[i + 2]);
  }
  geometry.setIndex([...shell, ...visor]);
  geometry.clearGroups();
  geometry.addGroup(0, shell.length, 0);
  geometry.addGroup(shell.length, visor.length, 1);
  return geometry;
}

/**
 * Geometrias de um tipo de kart (cacheadas), ja com os UVs do atlas (ver kartUV.js).
 * Exportada para os testes e para scripts/export-uv-layouts.js.
 * @param {'sport' | 'sedan'} type
 */
export function getKartGeometries(type) {
  if (geometryCache.has(type)) return geometryCache.get(type);
  const shape = KART_SHAPES[type];
  const R = ATLAS_RECTS;
  const tire = new CylinderGeometry(shape.wheelRadius, shape.wheelRadius, shape.wheelWidth, 24);
  tire.rotateZ(Math.PI / 2); // eixo da roda = X local: o proprio Mesh e o no de giro
  // grupos do cilindro: 0 = banda (u da a volta inteira), 1 e 2 = tampas (UV radial)
  remapToAtlas(tire, [R.tread, R.hub, R.hub]);
  const geometries = {
    body: applyBodyBoxUV(extrudeProfile(shape.body, shape.bodyWidth)),
    cabin: extrudeProfile(shape.cabin, shape.cabinWidth), // vidro, sem textura
    plate: new PlaneGeometry(0.3, 0.3),
    tire,
    torso: remapToAtlas(new CylinderGeometry(0.15, 0.19, TORSO_HEIGHT, 12), [R.suit]),
    head: remapToAtlas(new SphereGeometry(HEAD_RADIUS, 14, 10), [R.skin]),
    helmet: createHelmetGeometry(), // UV parametrico da esfera (CanvasTexture por kart)
  };
  geometries.body.computeBoundingBox();
  geometryCache.set(type, geometries);
  return geometries;
}

export function disposeKartGeometries() {
  for (const geometries of geometryCache.values()) {
    Object.values(geometries).forEach((g) => g instanceof BufferGeometry && g.dispose());
  }
  geometryCache.clear();
}

function mesh(name, geometry, material) {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.castShadow = true;
  return m;
}

/**
 * @param {{ type: 'sport' | 'sedan', color: number, number: number }} options
 * @returns {{
 *   root: Group,
 *   nodes: Record<string, import('three').Object3D>,
 *   helmetTexture: import('three').CanvasTexture,
 *   wheelRadius: number,
 *   anim: { frontSpin: number, rearSpin: number },
 *   dispose: () => void,
 * }}
 */
export function createKartModel({ type, color, number }) {
  const shape = KART_SHAPES[type];
  const g = getKartGeometries(type);
  const shared = getMaterials();

  // Por instancia: cor da carcaca (tinge o atlas compartilhado), textura do numero e do capacete
  const paint = new MeshStandardMaterial({ map: shared.textures.kartAtlas, color, roughness: 0.35, metalness: 0.4 });
  paint.userData.untexturedColor = color; // modo debug "sem textura": continua na cor do kart
  const numberTexture = createNumberTexture(number);
  const plateMaterial = new MeshStandardMaterial({ map: numberTexture, roughness: 0.6 });
  // Capacete: faixa + numero desenhados em canvas na cor do kart (o material fica branco)
  const helmetTexture = createHelmetTexture({ color, number, size: HELMET_TEXTURE_SIZE, layout: HELMET_LAYOUT });
  const helmetMaterial = new MeshStandardMaterial({ map: helmetTexture, roughness: 0.3, metalness: 0.1 });
  helmetMaterial.userData.untexturedColor = color;

  const root = new Group();
  root.name = `kart-${type}-${number}`;

  const chassis = new Group();
  chassis.name = 'chassis';
  const body = mesh('body', g.body, paint);
  const windows = mesh('windows', g.cabin, shared.glass);
  windows.castShadow = false;
  const plate = mesh('number', g.plate, plateMaterial);
  plate.castShadow = false;
  plate.position.set(0, shape.plateY, g.body.boundingBox.min.z - 0.005);
  plate.rotation.y = Math.PI; // virada para -Z (traseira)

  const driver = new Group();
  driver.name = 'driver';
  driver.position.set(0, shape.seat.y, shape.seat.z);
  const torso = mesh('torso', g.torso, shared.suit);
  torso.position.y = TORSO_HEIGHT / 2;
  const head = mesh('head', g.head, shared.skin);
  head.position.y = TORSO_HEIGHT + HEAD_RADIUS * 0.9;
  const helmet = mesh('helmet', g.helmet, [helmetMaterial, shared.visor]);
  helmet.position.y = HELMET_RADIUS - HEAD_RADIUS; // casco centrado um pouco acima da cabeca

  head.add(helmet);
  driver.add(torso, head);
  chassis.add(body, windows, plate, driver);
  root.add(chassis);

  // Rodas expostas, fora da carcaca; entre-eixos vem do tuning (mesma fonte da fisica)
  const halfBase = KART_TYPES[type].wheelBase / 2;
  const wheelX = shape.bodyWidth / 2 + shape.wheelWidth / 2 - 0.02;
  const tireMaterials = [shared.tireTread, shared.tireCap, shared.tireCap];
  const nodes = { root, chassis, body, windows, number: plate, driver, torso, head, helmet };

  for (const [side, x] of [['L', wheelX], ['R', -wheelX]]) {
    // Frente: pivo de esterco (rotation.y) separado do no de giro (rotation.x)
    const steer = new Group();
    steer.name = `steerF${side}`;
    steer.position.set(x, shape.wheelRadius, halfBase);
    const front = mesh(`wheelF${side}`, g.tire, tireMaterials);
    steer.add(front);
    const rear = mesh(`wheelR${side}`, g.tire, tireMaterials);
    rear.position.set(x, shape.wheelRadius, -halfBase);
    root.add(steer, rear);
    nodes[steer.name] = steer;
    nodes[front.name] = front;
    nodes[rear.name] = rear;
  }

  return {
    root,
    nodes,
    helmetTexture, // lido pelo export de layout UV (modo debug)
    wheelRadius: shape.wheelRadius,
    anim: { frontSpin: 0, rearSpin: 0 }, // giro acumulado das rodas (rad), so visual
    dispose() {
      paint.dispose();
      plateMaterial.dispose();
      numberTexture.dispose();
      helmetMaterial.dispose();
      helmetTexture.dispose();
      root.removeFromParent();
    },
  };
}
