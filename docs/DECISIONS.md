# Decisoes de design

Formato: data - decisao - motivo.

## 2026-10-29 - 2 tipos de carcaca, 1 hierarquia

**Decisao:** os karts "sport" (baixo, traseira arredondada, cabine recuada) e "sedan" (alto,
quadrado, cabine centralizada) usam exatamente a mesma arvore de 15 nos (`src/kart/kartModel.js`).
O que muda por tipo e so o perfil lateral da carcaca/cabine e algumas medidas
(`src/kart/kartShapes.js`); entre-eixos vem de `KART_TYPES` em `tuning.js`. Cor e numero sao
por instancia (regra 8).

**Motivo:** a animacao procedural, a camera e a fisica podem tratar qualquer kart igual
(mesmos nomes de nos, mesmos pivos). Trocar o tipo e trocar dados, nao codigo.

## 2026-10-29 - Frente = +Z local, +X local = esquerda

**Decisao:** confirmado frente = +Z. `heading` e a rotacao em +Y (positivo vira a esquerda).
`KartInput.steer = +1` e direita, entao direita gera yaw negativo.

**Motivo:** e a convencao do `Object3D.lookAt` do three (objetos nao-camera apontam +Z para o
alvo) e `rotation.y = heading` leva +Z para `(sin h, 0, cos h)` sem sinais extras. A
consequencia (+X = esquerda, por ser sistema destro com Y para cima) fica documentada para
ninguem inverter o esterco por engano.

## 2026-10-29 - Aderencia lateral como UM parametro (decaimento exponencial)

**Decisao:** a cada passo, a velocidade lateral do kart e multiplicada por `exp(-lateralGrip * DT)`.
Sem modelo de pneu (slip angle, Pacejka).

**Motivo:** um numero so (1/s) controla "quanto o kart escorrega", e independe do passo. O drift
vai funcionar baixando esse numero; a grama ja faz isso com `OFFROAD.gripFactor`.

## 2026-10-29 - Rodas fora do no chassis

**Decisao:** as rodas sao filhas de `root`, irmas de `chassis`.

**Motivo:** quando o chassi ganhar rolagem/arfagem procedural, a carcaca inclina e as rodas
continuam no chao.

## 2026-11-05 - Texturas geradas por script deterministico (nao CC0)

**Decisao:** todas as texturas PNG de `public/textures/` saem de `scripts/generate-textures.js`
(`npm run textures`), com ruido de valor periodico e o `createRng` de `core/rng.js` com seed fixa.
`pngjs` entrou como devDependency so para gravar/ler PNG nos scripts.

**Motivo:** origem e licenca triviais de documentar (feitas no projeto), mesmo arquivo em qualquer
maquina (2 execucoes dao PNGs identicos byte a byte), e o atlas do kart pode ser desenhado
exatamente sobre os retangulos de `kart/kartUV.js` (um layout so para UV e desenho).

## 2026-11-05 - UV da pista por comprimento de arco, com tile inteiro na volta

**Decisao:** em cada faixa gerada da spline, `u` vai de 0 (borda esquerda) a 1 (direita) e
`v = s / tile`, sendo `s` o arco acumulado da linha media *daquela faixa* (centro para o asfalto,
meio da zebra, meio do rail). O tile e ajustado para `L / round(L / nominal)`: a linha de
fechamento tem `v` inteiro e, com `texture.repeat` inteiro, emenda com `v = 0` sem salto.
Asfalto com 4 colunas na largura (`TRACK_GEN.asphaltColumns`).

**Motivo:** `v` por parametro da curva (t) esticaria a textura conforme o espacamento dos pontos de
controle; por arco a densidade ao longo do tracado e constante. Faixa de largura constante numa
curva nao desenrola sem distorcao: a borda a distancia `d` do centro fica com escala `1 - k*d`
(no grampo de raio 9,7 m: 38% na borda interna, 162% na externa). Dar a cada borda o seu proprio
arco evitaria isso mas cisalharia a textura ate `2*pi*largura` (~75 m) por volta. Aceitamos o
fator `1 - k*d` (invisivel no asfalto isotropico, visivel no checker) e documentamos. As colunas
reduzem a "dobra" da interpolacao afim em quads trapezoidais nas curvas fechadas.

## 2026-11-05 - Um atlas para o kart, tingido pela cor do material

**Decisao:** `kart_atlas.png` (1024x1024) tem um retangulo por peca (`ATLAS_RECTS`). A carcaca usa
projecao em caixa por triangulo (eixo dominante da normal) a 256 px/m nas 3 projecoes; pneu,
capacete, torso e cabeca remapeiam o UV parametrico da primitiva para o seu retangulo. As areas
pintaveis sao claras e o `MeshStandardMaterial.color` de cada kart multiplica o atlas. 8 px de
margem entre pecas, preenchida com a propria borda (ou com o lado oposto, nas pecas que dao a volta).

**Motivo:** regra 8 (uma geometria, uma textura para os 4 karts); a variacao continua sendo so cor e
numero. Densidade fixa em px/m = mesmo detalhe em qualquer peca da carcaca, nos 2 tipos. A banda
tem um numero inteiro de garras (`TREAD_LUGS`) para a emenda do cilindro ser continua.

## 2026-11-05 - Zebras e guard rails so visuais

**Decisao:** zebras (1 m, coladas na borda) e guard rails (face a 7,5 m do centro, 0,8 m de altura)
sao malhas geradas da spline, sem efeito na fisica: a zebra conta como grama em `surfaceAt`, e o
rail nao colide.

**Motivo:** esta entrega e de texturas; colisao e zebra com aderencia propria sao escopo de
`physics/`. Os 7,5 m cabem no grampo (raio 9,7 m) sem a fita dobrar - o teste confere isso.

## 2026-11-05 - Modo de demonstracao so troca materiais no render

**Decisao:** `render/demoMode.js` escuta T/L/C/V/H e so troca `material.map` (checker),
`mesh.material` (espelho `MeshBasicMaterial`) e a camera usada no `renderer.render`. As luzes da
entrega de iluminacao nao mudaram: a sombra continua seguindo o jogador.

**Motivo:** nao tocar em physics/ai/race nem no determinismo; o modo e removivel sem efeito no jogo.
