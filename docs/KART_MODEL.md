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
- Giro das rodas: `frontSpin`/`rearSpin += velocidade / wheelRadius * frameTime`, guardados em
  `model.anim` (visual, nunca no estado fisico). Fora do drift as duas usam `forwardSpeed`.
- **Rodas no drift** (`kartAnimation.js`, so le `KartState`): as rodas da frente vao do esterco
  fisico para o **contra-esterco**, apontando para a velocidade (angulo de deriva
  `atan2(vL, vF)`), misturado por `state.driftAmount` (mesma rampa da aderencia) e limitado a
  `STEERING.maxSteer` para o pneu nao entrar na carcaca. A frente rola com a velocidade na direcao
  da roda; a de tras gira `1 + KART_ANIM.driftWheelspin * driftAmount` vezes o que rolaria
  (patinando). Testes em `tests/kartAnimation.test.js`.

## Por tipo (kartShapes.js)

| | sport | sedan |
|---|---|---|
| perfil | baixo, bico afilado, traseira em bezier | alto, frente/traseira quase verticais |
| cabine | recuada, vidro traseiro "fastback" | centralizada, teto reto |
| largura da carcaca | 1.30 m | 1.36 m |
| raio do pneu | 0.30 m | 0.32 m |
| entre-eixos (tuning) | 2.1 m | 2.2 m |

Geometrias sao cacheadas por tipo e compartilhadas; `dispose()` do modelo libera so o que e da
instancia (material de pintura, material/textura do numero e do capacete). `disposeKartGeometries()` libera o cache.

## Texturas e UV (`kartUV.js`)

Um atlas compartilhado, `public/textures/kart_atlas.png` (1024x1024), com um retangulo por peca
(`ATLAS_RECTS`, 8 px de margem). Layout em `docs/img/uv_kart_sport.png` e `uv_kart_sedan.png`.

| peca | UV |
|---|---|
| carcaca (`body`) | projecao em caixa por triangulo, eixo dominante da normal: lateral (z, y), topo (z, x), frente/tras (x, y); 256 px/m em todas (`BODY_FRAME` cobre sport e sedan) |
| pneu | banda: u = volta inteira (16 garras inteiras = emenda continua), v = largura; tampas: UV radial do cilindro no retangulo do cubo |
| torso, cabeca | UV parametrico da esfera/cilindro remapeado para o retangulo (polo com u limitado a [0,1]) |
| capacete | **fora do atlas**: UV parametrico da esfera (u = longitude, v = 1 no topo), `CanvasTexture` por kart (`HELMET_*` em `kartUV.js`) |
| cabine (vidro), viseira | sem textura |
| placa de numero | `CanvasTexture` por instancia (inalterada) |

A pintura usa o material `paint` da instancia (`map` = atlas, `color` = cor do kart): o atlas e
claro nessas areas e a cor multiplica. Pneu, macacao e pele sao materiais compartilhados com o
mesmo atlas e cor branca; o pneu tambem usa `kart_atlas_normal.png` e `kart_atlas_roughness.png`
(mesmo layout, relevo so na banda e na tampa).

O capacete tem material proprio por kart (cor branca, `map` = `createHelmetTexture` em
`render/materials.js`): base na cor do kart, faixa de corrida do topo ate a nuca, faixa escura no
equador e o numero em disco branco nos 2 lados (u = 0 e 0.5) e na nuca (u = 0.75). A viseira
(u = 0.25) e o 2o grupo de material. Canvas de 512 x 200 px: proporcao da volta no equador sobre o
arco do topo a borda, para o texel ser quadrado no equador (perto do topo a longitude comprime,
como em qualquer esfera; por isso o desenho la so tem faixas ao longo dos meridianos).
