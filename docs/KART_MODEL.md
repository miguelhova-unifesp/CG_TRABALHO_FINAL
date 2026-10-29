# Modelo do kart

Codigo: `src/kart/kartModel.js` (hierarquia), `src/kart/kartShapes.js` (forma por tipo),
`src/kart/kartAnimation.js` (animacao procedural).

## Hierarquia (identica para sport e sedan - 15 nos)

```
root            Group  posicao/heading interpolados do KartState
├─ chassis      Group  reservado p/ roll/pitch procedural
│  ├─ body      Mesh   carcaca (ExtrudeGeometry do perfil lateral, com bevel)
│  ├─ windows   Mesh   cabine em vidro escuro translucido
│  ├─ number    Mesh   placa traseira, CanvasTexture por instancia
│  └─ driver    Group  posicao do banco por tipo
│     ├─ torso  Mesh
│     └─ head   Mesh
│        └─ helmet Mesh  2 materiais: casco (cor da instancia) + viseira
├─ steerFL      Group  pivo de esterco (rotation.y)
│  └─ wheelFL   Mesh   no de giro (rotation.x)
├─ steerFR      Group
│  └─ wheelFR   Mesh
├─ wheelRL      Mesh
└─ wheelRR      Mesh
```

Nos acessiveis por nome em `model.nodes`.

## Convencoes

- Origem no chao, no meio do entre-eixos. Frente = +Z, +X = esquerda.
- O cilindro do pneu tem o eixo "assado" em X (`rotateZ(pi/2)`), por isso o proprio Mesh e o no
  de giro. Rotacao positiva em X leva o topo da roda para +Z (rolar para frente).
- `steerFL/FR.rotation.y = state.steerAngle` (o angulo ja esta na convencao de yaw).
- Giro das rodas: `wheelSpin += forwardSpeed / wheelRadius * frameTime`, guardado em `model.anim`
  (visual, nunca no estado fisico).

## Por tipo (kartShapes.js)

| | sport | sedan |
|---|---|---|
| perfil | baixo, bico afilado, traseira em bezier | alto, frente/traseira quase verticais |
| cabine | recuada, vidro traseiro "fastback" | centralizada, teto reto |
| largura da carcaca | 1.30 m | 1.36 m |
| raio do pneu | 0.30 m | 0.32 m |
| entre-eixos (tuning) | 2.1 m | 2.2 m |

Geometrias sao cacheadas por tipo e compartilhadas; `dispose()` do modelo libera so o que e da
instancia (material de pintura, material/textura do numero). `disposeKartGeometries()` libera o cache.
