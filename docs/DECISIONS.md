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

## 2026-11-11 - Modo debug desligado por padrao, teclas em tuning.js

**Decisao:** o modo de demonstracao de texturas virou "modo debug": comeca desligado
(`DEBUG_VIEW.enabledByDefault = false`), liga com `` ` `` ou `?debug` na URL, e todas as teclas
ficam em `DEBUG_VIEW.keys`. Desligar o modo restaura texturas, luzes e camera.

**Motivo:** o jogo normal nao deve ter painel nem teclas extras ativas; para o relatorio basta uma
tecla. Teclas configuraveis num lugar so (regra 7), sem conflito com W/A/S/D, setas, Espaco e R.

## 2026-11-11 - Liga/desliga de cada luz por light.visible

**Decisao:** `createLights` passou a devolver `hemi` e `sun`; o modo debug alterna
`light.visible`. Nenhum parametro de luz mudou.

**Motivo:** o three tira luzes invisiveis do calculo (e o sol invisivel tambem para de gerar
sombra), entao da para comparar a contribuicao de cada luz sem criar/remover objetos nem tocar na
configuracao da entrega de iluminacao.

## 2026-11-11 - "Sem textura" usa cor lisa aproximando a media da textura

**Decisao:** a tecla `M` tira `map`, `normalMap` e `roughnessMap` e troca a cor do material por
`userData.untexturedColor` (tabela `UNTEXTURED_COLOR` em `render/materials.js`; pintura e capacete
usam a cor do kart). No xadrez de UV a cor vai para branco.

**Motivo:** varios materiais tem `color` branca e a cor vem toda da textura (pneu, macacao, zebra);
sem textura ficariam brancos e a comparacao "com x sem textura" mediria a cor, nao a textura. No
xadrez, a tinta do kart escurecia as celulas e atrapalhava ler os numeros.

## 2026-11-11 - Capacete com UV proprio e CanvasTexture por kart

**Decisao:** o capacete saiu do atlas: usa o UV parametrico da esfera e um material proprio por
kart com `createHelmetTexture` (cor do kart, faixa de corrida, numero nos lados e na nuca). Canvas
de 512 x 200 px (`HELMET_TEXTURE_SIZE`), proporcao = volta no equador / arco do topo a borda.
A posicao de frente/lados/nuca no UV (`HELMET_LAYOUT`) e testada contra a geometria.

**Motivo:** pedido da entrega (desenho por kart). Continua valendo a regra 8: mesma geometria para
todos, so o desenho do canvas muda, como a placa de numero. Com texel quadrado no equador o numero
nao sai achatado; perto do topo a longitude comprime (inevitavel numa esfera), por isso la so ha
faixas ao longo dos meridianos.

## 2026-11-11 - Relevo do pneu no layout do atlas

**Decisao:** `kart_atlas_normal.png` e `kart_atlas_roughness.png` tem o mesmo layout do atlas, com
relevo/rugosidade so nos retangulos `tread` e `hub` (resto plano, rugosidade 1). So os materiais do
pneu usam esses mapas. Gerados sem ruido, a partir da mesma geometria do desenho de cor.

**Motivo:** o pneu ja le o atlas, entao os mapas reaproveitam os UVs sem textura nova por peca. O
relevo das garras deixa a roda girando visivel com o sol de lado. A pintura continua lisa de
proposito (carro de brinquedo estilizado).

## 2026-11-11 - Layout UV exportado no navegador, alem do script Node

**Decisao:** `render/uvLayout.js` desenha os triangulos de cada malha no espaco UV, sobre a propria
textura, num canvas com a proporcao real em metros; o painel (`U`) baixa cada um como PNG. O
`scripts/export-uv-layouts.js` continua gerando as imagens de `docs/img/`.

**Motivo:** a apresentacao pede mostrar as coordenadas UV dentro do jogo, incluindo o capacete (que
so existe como CanvasTexture no navegador). O script continua util para o relatorio sem abrir o jogo.

## 2026-11-11 - Sem tunel nesta entrega

**Decisao:** nao foi criado tunel. A interacao luz x textura e mostrada com os toggles de cada luz,
o guard rail metalico e a sombra dos karts no asfalto.

**Motivo:** o tunel e uma malha nova gerada da spline (escopo de pista), fora do que esta entrega
pede; decisao do grupo.

## 2026-11-11 - Drift arcade por aderencia baixa, lado travado

**Decisao:** o drift (Espaco + direcional) baixa a aderencia lateral (`DRIFT.gripFactor`, com rampa
de entrada/saida em `driftAmount`), trava o lado na entrada (`driftDir`) e troca o esterco por 3
angulos fixos (dentro/solto/contra) sem queda com a velocidade. Parte do modulo da velocidade que a
aderencia tiraria volta para a frente (`speedRetention`). Cancela ao soltar, frear, sair do asfalto
ou ficar abaixo de `exitSpeed`; um novo drift exige soltar e apertar o botao (`driftLatch`).

**Motivo:** segue a decisao de 2026-10-29 (drift = baixar `lateralGrip`), sem modelo de pneu. Lado
travado + direcional so abrindo/fechando e o controle classico de kart arcade: da para segurar o
drift a curva toda sem rodar. Sem `speedRetention` o grip baixo matava a velocidade lateral e o drift
virava freio (~10 m/s^2 de perda nas simulacoes). A rampa evita o "tranco" da saida. Com o botao
solto `driftAmount = 0` e a fisica e identica a anterior. `driftTime` fica no estado para o
miniturbo. Tudo em `KartState`, deterministico (teste de replay com drift).

## 2026-11-11 - Contra-esterco visual das rodas no drift

**Decisao:** no drift as rodas da frente mostram o angulo de deriva (apontam para a velocidade) em
vez do esterco fisico, que aponta para dentro da curva. Mistura por `driftAmount`, limite em
`STEERING.maxSteer`. Rodas de tras com giro extra (`KART_ANIM.driftWheelspin`). `model.anim.wheelSpin`
virou `frontSpin` e `rearSpin`.

**Motivo:** o `steerAngle` do estado e o da bicicleta cinematica do drift (para dentro); mostrado
direto, o kart parece "virar contra" a derrapagem. Contra-esterco e o que se espera ver num drift.
Calculado so a partir do estado (regra 3, teste confere que nada e escrito); `driftAmount` ja tem a
rampa de entrada/saida, entao a roda nao "pula". O limite reaproveita o esterco maximo normal, que ja
era o maior angulo visual do pneu sem atravessar a carcaca.

