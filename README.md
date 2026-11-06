# Kart racing

Jogo de corrida de kart em 3D feito com [Three.js](https://threejs.org/)

## Sobre o jogo

A proposta é uma corrida de 3 voltas em uma pista com 4 karts: o jogador e 3
adversários controlados por IA. A mecânica central é o **drift**: segurar a derrapagem nas curvas
carrega um miniturbo que dá um impulso na saída.

Alguns pontos técnicos do projeto:

- **Física própria**, sem engines prontas (cannon-es, rapier etc.), com simulação em passo fixo
  de 60 Hz e renderização interpolada entre os estados.

- **Pista gerada a partir de uma spline** (`CatmullRomCurve3`): asfalto, grama, zebras, guard
  rails, waypoints e checkpoints saem dos mesmos pontos de controle.

- **Modelo hierárquico do kart**, com animação procedural (rodas, esterço, rolagem do chassi).
  Os 4 karts usam a mesma geometria e variam só cor, número e detalhes.

- **IA que "dirige como o jogador"**: os adversários geram os mesmos comandos do teclado
  (acelerar, frear, virar, drift), sem mexer direto na física.

- **Simulação determinística** (RNG com seed), o que permite replay a partir dos inputs.

### Estado atual

- kart dirigível com física própria (aceleração, freio, ré, aderência lateral, grama mais lenta);
- 2 tipos de carcaça (*sport* e *sedan*) sobre o mesmo modelo hierárquico;
- pista de teste provisória gerada pela spline, com zebras e guard rails (só visuais);
- câmera de perseguição em terceira pessoa;
- texturas PNG (asfalto, grama, zebra, guard rail, atlas do kart) com UVs gerados, e um modo de
  demonstração de texturas (ver [Modo de demonstração](#modo-de-demonstração-texturas)).

Ainda **não** implementados: drift e miniturbo, adversários com IA, voltas e checkpoints,
pontuação, HUD de corrida, colisões entre karts e com os guard rails



### Pré-requisitos

- [Node.js](https://nodejs.org/) **20.19 ou mais recente** (inclui o `npm`)
- Um navegador com suporte a WebGL2 (Chrome, Firefox, Edge ou Safari atuais)

Para conferir a versão instalada:

```bash
node --version
```

### Controles

| Ação                          | Teclas          |
|-------------------------------|-----------------|
| Acelerar                      | `W` ou `↑`      |
| Frear / dar ré (quase parado) | `S` ou `↓`      |
| Virar à esquerda              | `A` ou `←`      |
| Virar à direita               | `D` ou `→`      |
| Voltar ao grid de largada     | `R`             |

### Modo de demonstração (texturas)

Só afeta a renderização; a física continua igual. As teclas também aparecem no painel do canto
superior esquerdo.

| Ação                                                        | Tecla |
|-------------------------------------------------------------|-------|
| Alternar texturas reais / UV checker (grade numerada)        | `T`   |
| Alternar textura + iluminação / só textura (sem luz)         | `L`   |
| Alternar câmera de perseguição / câmera de inspeção          | `C`   |
| Próximo alvo da inspeção (jogador, sedan, emenda, grampo)    | `V`   |
| Esconder/mostrar o painel (para screenshots)                 | `H`   |

Na câmera de inspeção: arrastar com o botão esquerdo orbita, a roda dá zoom e o botão direito
desloca. O kart continua dirigível e a câmera o acompanha.

## Outros comandos

| Comando             | O que faz                                                        |
|---------------------|------------------------------------------------------------------|
| `npm run dev`       | servidor de desenvolvimento com recarga automática (porta 5173)  |
| `npm run dev:lan`   | igual ao anterior, mas acessível por outros aparelhos na rede    |
| `npm run build`     | gera a versão de produção na pasta `dist/`                       |
| `npm run preview`   | serve a pasta `dist/` localmente (porta 4173) para testar o build |
| `npm run test`      | roda os testes automatizados (Vitest)                            |
| `npm run lint`      | verifica o código com ESLint                                     |
| `npm run textures`  | regenera as texturas PNG em `public/textures/` (determinístico)  |
| `npm run uv-layouts`| exporta imagens do layout UV (kart e pista) para `docs/img/`     |

### Publicando o build

`npm run build` gera arquivos estáticos com caminhos relativos, então o conteúdo de `dist/` pode
ser colocado em qualquer servidor estático (GitHub Pages, itch.io etc.). Abrir o `index.html`
direto pelo sistema de arquivos (`file://`) não funciona por restrições do navegador; use
`npm run preview` ou outro servidor.

## Modelagem do kart e do piloto

Todo o kart é construído **em código**, sem arquivos de modelo externos (`.glb`/`.obj`): as
malhas são geradas a partir de curvas 2D e de primitivas paramétricas do Three.js. O código está
em [`src/kart/`](src/kart/) e os detalhes em [docs/KART_MODEL.md](docs/KART_MODEL.md).

### Modelagem hierárquica (grafo de cena)

O kart é uma árvore de 15 nós (`Object3D`). Cada nó guarda só a sua **transformação local**
(translação, rotação e escala em relação ao pai). A matriz de mundo é a composição das matrizes
de todos os ancestrais:

```
M_mundo(roda) = M_root · M_steerFL · M_wheelFL
cada M_local  = T · R · S
```

Por isso, mover o `root` leva o kart inteiro junto, e girar um nó afeta só a sua subárvore:

```
root            posição e direção do kart (vêm da física)
├─ chassis      reservado para rolagem/arfagem da carroceria
│  ├─ body      carcaça
│  ├─ windows   cabine de vidro
│  ├─ number    placa com o número
│  └─ driver    piloto, posicionado no banco
│     ├─ torso
│     └─ head
│        └─ helmet
├─ steerFL → wheelFL    pivô de esterço → giro da roda
├─ steerFR → wheelFR
├─ wheelRL
└─ wheelRR
```

Escolhas feitas na hierarquia:

- **Pivôs separados para cada eixo de rotação.** As rodas dianteiras têm dois nós: `steerF*`
  gira em Y (esterço) e, dentro dele, `wheelF*` gira em X (rolagem). Como a matriz do filho é
  aplicada depois da do pai, a roda gira em torno do próprio eixo *já esterçado*, e as duas
  rotações não se misturam (o que aconteceria com uma rotação de Euler num nó só).
- **Rodas fora do `chassis`.** Elas são filhas do `root`, irmãs do `chassis`. Quando a carroceria
  inclinar nas curvas, a carcaça rola e as rodas continuam apoiadas no chão.
- **Origem no chão, no meio do entre-eixos.** O ponto de referência do modelo é o mesmo ponto que
  a física simula, então basta copiar posição e direção do estado físico para o `root`.
- **Sistema de coordenadas:** destro, Y para cima, frente do kart = +Z local (a convenção do
  `lookAt` do Three.js), o que deixa +X local apontando para a esquerda.

### Carcaça e cabine: extrusão de perfis 2D

A carroceria é desenhada como um **perfil lateral** (`Shape`) no plano, com segmentos de reta e
curvas de **Bézier quadráticas e cúbicas** (bico, traseira arredondada, vidro traseiro
"fastback"). Esse perfil é **extrudado** (`ExtrudeGeometry`) na largura do kart:

- `curveSegments: 16` controla a **tesselação**, ou seja, em quantos segmentos de reta cada curva
  é aproximada antes de virar triângulos;
- o **bevel** (chanfro de 5 cm em 3 segmentos) arredonda as arestas, para a silhueta não ficar
  com cara de bloco;
- depois da extrusão, a geometria é girada e transladada **direto nos vértices** (`rotateY`,
  `translate`), para que o eixo X da `Shape` vire o eixo Z do kart e a peça fique centrada.
  Isso "assa" a orientação na malha, e o nó fica com transformação identidade.

A cabine usa a mesma técnica, com um perfil próprio e um pouco mais estreita que a carcaça.

Os **dois tipos de kart** (*sport* e *sedan*) mudam só os dados desses perfis e algumas medidas
([`kartShapes.js`](src/kart/kartShapes.js)). A hierarquia, os nomes dos nós e os pivôs são
idênticos, então a animação, a câmera e a física tratam qualquer kart da mesma forma.

### Rodas e piloto: primitivas paramétricas

- **Pneu:** `CylinderGeometry` com 24 segmentos radiais. O cilindro nasce com o eixo em Y e é
  girado `π/2` em Z nos vértices, ficando com o eixo em X. Assim o próprio `Mesh` é o nó de giro.
  O pneu usa **dois materiais** (multi-material por grupos): banda de rodagem e tampas laterais.
- **Torso:** cilindro com raios diferentes em cima e embaixo, que vira um tronco de cone.
- **Cabeça:** esfera (`SphereGeometry`).
- **Capacete:** esfera **parcial**. O ângulo polar vai só até `0,78π`, o que deixa o capacete
  aberto embaixo. A viseira é separada **reclassificando os triângulos**: para cada triângulo do
  buffer de índices, calcula-se o centroide, e os que ficam na faixa frontal (z alto, y perto do
  centro) vão para um segundo grupo de desenho, com o material escuro e reflexivo da viseira.
  Fica uma malha só, com dois materiais, sem modelar uma peça separada.

A quantidade de segmentos de cada primitiva foi escolhida pelo tamanho da peça na tela: o pneu
precisa de mais segmentos para a silhueta parecer redonda, e o torso fica com 12.

### Materiais e texturas procedurais

- **Iluminação física (PBR):** todas as peças usam `MeshStandardMaterial`, controlado por
  `roughness` e `metalness`. A pintura é semi-metálica (0,4) e pouco rugosa, o que gera brilho
  especular. Pneu e macacão são quase totalmente difusos.
- **Vidro:** material transparente (`opacity: 0.55`) com `depthWrite: false`, para não esconder o
  piloto no depth buffer. Por isso o vidro também não projeta sombra.
- **Viseira:** `DoubleSide`, porque a esfera aberta deixa a face interna visível.
- **Atlas de textura:** carcaça, capacete, pneu (banda e tampa com raios), macacão e pele leem
  um único PNG (`public/textures/kart_atlas.png`), cada peça no seu retângulo. As áreas pintáveis
  do atlas são claras e a cor do material de cada kart multiplica a textura, então os 4 karts
  usam a mesma imagem. Os raios na tampa continuam lá porque um pneu liso girando parece parado.
  Detalhes dos UVs em [docs/KART_MODEL.md](docs/KART_MODEL.md).
- **Placa de número** desenhada em `<canvas>` (`CanvasTexture`), uma por kart.
- Texturas de cor em sRGB, para as cores não saírem desbotadas; anisotropia máxima da GPU e
  mipmaps em todas.
- **Z-fighting:** a placa fica 5 mm atrás da traseira da carcaça (calculada pelo *bounding box*).
  Dois planos na mesma profundidade fariam os pixels "brigarem" no depth buffer.

### Um modelo, quatro karts

As geometrias ficam em **cache por tipo** e são compartilhadas por todos os karts daquele tipo,
assim como os materiais neutros (vidro, pneu, pele, viseira). Cada kart cria só o que é dele: o
material de pintura (cor da carcaça e do capacete) e a textura do número. Isso economiza memória
de GPU, porque os buffers de vértices sobem uma vez só. O `dispose()` de cada kart libera apenas
os recursos próprios dele.

### Iluminação e sombras

- **Luz hemisférica:** azul vindo do céu e verde vindo do chão, como luz ambiente.
- **Luz direcional (sol):** projeta sombra por **shadow mapping**, com mapa de 2048×2048 e uma
  câmera ortográfica de 50 × 50 m que acompanha o jogador. Isso concentra a resolução da sombra
  onde a câmera está olhando.
- **Bias negativo** na sombra, para evitar o *shadow acne* (listras de autossombreamento).
- **Tone mapping** ACES Filmic no renderer.

### Animação procedural

A animação ([`kartAnimation.js`](src/kart/kartAnimation.js)) **só lê** o estado da física, nunca
escreve nele:

- **Interpolação:** a física roda a 60 Hz fixos e o monitor pode ter outra taxa. A cada frame, a
  posição e a direção do `root` são interpoladas linearmente (`lerp`) entre o passo físico
  anterior e o atual, usando a fração `alpha` do acumulador. O movimento fica suave em qualquer
  taxa de quadros.
- **Esterço:** o ângulo das rodas vindo da física vai para `rotation.y` dos pivôs `steerF*`.
- **Giro das rodas:** usa a condição de **rolar sem deslizar**, `ω = v / r`. A cada frame, o
  ângulo acumulado aumenta `(v / r) · Δt` e é aplicado em `rotation.x` das quatro rodas. Esse
  acumulador é visual e fica no próprio modelo, fora do estado da física.

## Estrutura do projeto

```
src/
  main.js       # ponto de entrada: renderer, cena e game loop
  core/         # loop com passo fixo, entrada do teclado, RNG com seed
  config/       # tuning.js: todos os parâmetros de física, IA e pontuação
  track/        # pista gerada a partir da spline
  physics/      # física do kart
  kart/         # modelo hierárquico e animação procedural
  render/       # câmera, luzes e materiais
tests/          # testes automatizados
docs/           # documentação detalhada de cada sistema
```

A documentação de cada sistema fica em [`docs/`](docs/): física ([PHYSICS.md](docs/PHYSICS.md)),
pista ([TRACK.md](docs/TRACK.md)), IA ([AI.md](docs/AI.md)), modelo do kart
([KART_MODEL.md](docs/KART_MODEL.md)), pontuação ([SCORING.md](docs/SCORING.md)), ajuste de
valores ([TUNING.md](docs/TUNING.md)) e o registro de decisões de design
([DECISIONS.md](docs/DECISIONS.md)).


## Como rodar

```
# 1. Baixe o código
git clone <url-do-repositorio>
cd projeto_final

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev

```

O navegador abre automaticamente em <http://localhost:5173>. Se não abrir, acesse esse endereço
manualmente.