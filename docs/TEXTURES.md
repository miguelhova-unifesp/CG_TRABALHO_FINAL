# Texturas, mapeamento UV e iluminacao

Codigo: `src/render/` (materiais, texturas, modo debug, layout UV), `src/track/trackMeshes.js` (UV da
pista), `src/kart/kartUV.js` (UV do kart). Nada disso e importado por `physics/`, `ai/` ou `race/`.

## Requisitos da entrega -> onde estao

| requisito | como foi atendido |
|---|---|
| >= 3 texturas, em personagens e cenario | 6 texturas de cor (asfalto, grama, zebra, guard rail, atlas do kart, capacete) + numero; 4 mapas de dados (normal/rugosidade) |
| corretamente mapeadas, sem esticar | UV por comprimento de arco na pista, planar na grama, caixa com densidade fixa no kart; testes em `tests/trackUV.test.js` e `tests/kartUV.test.js`; xadrez de UV (tecla `T`) |
| apresentar as coordenadas UV | painel de layouts UV no jogo (tecla `U`, baixa PNG) e `npm run uv-layouts` (`docs/img/`) |
| manter as luzes e mostrar a interacao | luzes da entrega anterior intactas; `MeshStandardMaterial` com normal/roughness map; teclas `1`/`2` (cada luz), `M` (sem textura), `L` (sem luz) |

## Texturas

Todas as PNG saem de `scripts/generate-textures.js` (`npm run textures`), com o `createRng` de
`core/rng.js` e seed fixa: 2 execucoes geram arquivos identicos byte a byte. As `CanvasTexture`
sao desenhadas no navegador, uma por kart. Cor em sRGB (`SRGBColorSpace`); normal e rugosidade
em espaco linear. Anisotropia maxima da GPU e mipmaps em todas as PNG.

| arquivo / textura | tipo | tamanho | aplicada em |
|---|---|---|---|
| `asphalt_color.png` | cor | 1024^2 | asfalto (repeat 3x3 por tile de UV = tile de 4 m) |
| `asphalt_normal.png` | normal | 1024^2 | asfalto: pedriscos em relevo |
| `asphalt_roughness.png` | rugosidade | 1024^2 | asfalto: pedras e remendos de piche mais lisos |
| `grass_color.png` | cor | 512^2 | plano de grama (faixas de corte) |
| `curb_color.png` | cor | 256x512 | zebras (1 bloco vermelho + 1 branco por tile de 2 m) |
| `guardrail_color.png` | cor | 512x256 | guard rails (lamina W, poste, refletor, ferrugem) |
| `guardrail_normal.png` | normal | 512x256 | guard rails: ondas da lamina, parafuso |
| `guardrail_roughness.png` | rugosidade | 512x256 | guard rails: aco brilhante x ferrugem fosca |
| `kart_atlas.png` | cor | 1024^2 | carcaca (tingida pela cor do kart), pneu, macacao, pele |
| `kart_atlas_normal.png` | normal | 1024^2 | pneu: garras da banda, raios/aro/friso da tampa (resto plano) |
| `kart_atlas_roughness.png` | rugosidade | 1024^2 | pneu: borracha ~0.9, sulcos 1, aro metalico ~0.45 |
| `createHelmetTexture` | cor (canvas) | 512x200 | capacete: cor do kart, faixa, numero (1 por kart) |
| `createNumberTexture` | cor (canvas) | 128^2 | placa traseira (1 por kart) |
| `uv_checker.png` | cor | 1024^2 | so no modo debug (xadrez numerado, setas +U/+V) |

Regra 8: os 4 karts usam a mesma geometria e o mesmo atlas; o que varia e a cor do material e as 2
CanvasTexture (numero e capacete).

## Esquema de UV por malha

| malha | u | v | detalhe |
|---|---|---|---|
| asfalto | 0 (borda esq.) -> 1 (borda dir.), 4 colunas | arco acumulado da linha central / tile (~12 m) | tile ajustado para numero inteiro de tiles na volta: emenda sem salto |
| zebras | 0 -> 1 na largura (1 m) | arco da linha media da zebra / tile (~2 m) | idem |
| guard rail | posicao no perfil (frente -> topo -> tras) / perimetro | arco da linha media do rail / tile (~2 m) | 3 faces separadas (aresta viva na luz) |
| grama | x / 8 m | -z / 8 m | projecao planar no mundo (exata num plano) |
| carcaca do kart | projecao em caixa por triangulo (eixo dominante da normal) | | 256 px/m nas 3 projecoes: densidade uniforme, sem o 0-1 por face |
| pneu (banda) | volta inteira (16 garras inteiras) | largura do pneu | emenda continua do cilindro |
| pneu (tampas) | UV radial do cilindro | | retangulo `hub` do atlas |
| torso, cabeca | UV parametrico remapeado para o retangulo do atlas | | |
| capacete | longitude: 0.25 frente (viseira), 0.5 esquerda, 0.75 nuca, 0/1 direita | 1 no topo, 0 na borda de baixo | UV proprio (nao usa o atlas); canvas 512x200 = texel quadrado no equador |

Por que comprimento de arco: `v` por indice de segmento (ou pelo parametro `t` da spline) esticaria
a textura onde os pontos de controle estao longe e comprimiria onde estao perto. Com `v = s / tile`,
1 unidade de `v` e sempre o mesmo numero de metros. Limitacao geometrica (documentada em
`docs/TRACK.md` e `docs/DECISIONS.md`): numa curva a borda a distancia `d` do centro anda `1 - k*d`
vezes a linha central, entao a textura comprime na borda interna e estica na externa. No asfalto
(textura isotropica) nao se nota; no xadrez da para ver no grampo.

Os UVs da pista saem da spline (regra 5): mudar `controlPoints` regenera tudo.

## Integracao com iluminacao

Luzes (`src/render/lights.js`), **inalteradas** desde a entrega de iluminacao:

| luz | tipo | sombra |
|---|---|---|
| hemisferica | `HemisphereLight` ceu azul / chao verde, 1.1 | nao |
| sol | `DirectionalLight` 2.2, offset (30, 50, -20) do jogador | sim, 2048^2, caixa de 50 x 50 m que segue o jogador |

O que a luz revela em cada material (todos `MeshStandardMaterial`):

- **asfalto**: o `normalMap` faz os pedriscos brilharem no lado do sol; o `roughnessMap` deixa
  pedras e piche mais lisos (reflexo especular em angulo raso). Recebe a sombra dos karts.
- **guard rail**: metalness 0.35 + `roughnessMap` (aco liso x ferrugem) + `normalMap` das ondas da
  lamina: o brilho do sol corre ao longo da lamina. Projeta sombra na grama.
- **pneu**: as garras em relevo aparecem com o sol de lado; o aro (rugosidade baixa) brilha e a
  borracha nao.
- **carcaca**: roughness 0.35, metalness 0.4: reflexo especular forte na pintura tingida.
- **capacete**: roughness 0.3: o brilho passa por cima do desenho do canvas.

Sem `MeshBasicMaterial` em objetos texturizados no jogo; ele so e usado pelo modo debug `L`, para
mostrar a textura sem luz.

## Modo debug

Desligado por padrao. Liga com `` ` `` (tecla do apostrofo no ABNT2, a esquerda do `1`) ou com
`?debug` na URL (`http://localhost:5173/?debug`). Teclas em `DEBUG_VIEW.keys`
(`src/config/tuning.js`). Desligar o modo restaura tudo (texturas, luzes, camera).

| tecla | efeito |
|---|---|
| `` ` `` | liga/desliga o modo debug |
| `T` | xadrez de UV no lugar de todas as texturas (normal/rugosidade desligados, cor branca) |
| `M` | sem texturas: tira map/normal/roughness e usa uma cor lisa parecida com a media da textura; luz igual |
| `L` | so textura, sem luz (`MeshBasicMaterial` espelho) |
| `1` | liga/desliga a luz hemisferica |
| `2` | liga/desliga o sol (e com ele a sombra) |
| `U` | painel de layouts UV: asfalto (ultimo + primeiro tile, com a emenda), zebras, guard rail, kart sport, kart sedan, pneu, capacete; botao "baixar PNG" em cada um |
| `C` / `V` | camera de inspecao (orbita/zoom) / proximo alvo: jogador, sedan, emenda da volta, grampo |
| `H` | esconde o painel de teclas |

Implementacao: `render/demoMode.js` (estado, troca de mapas/cores, `light.visible`, camera),
`render/uvLayout.js` (desenho dos triangulos no espaco UV sobre a textura), `ui/demoHud.js` e
`ui/uvLayoutPanel.js`. Nao mexe na simulacao. As luzes so ganharam `hemi`/`sun` no retorno de
`createLights` para poderem ser ligadas/desligadas.

Fora do jogo, `npm run uv-layouts` grava os mesmos layouts (e 2 vistas de cima do xadrez no
asfalto: emenda e grampo) em `docs/img/`.

## Checklist de capturas para o relatorio

Para tirar print sem o painel: `H`. Para fixar a camera: `C` e orbitar com o mouse.

- [ ] Jogo normal, camera de perseguicao, sem painel (texturas + luz).
- [ ] Xadrez de UV (`T`) na reta da largada: celulas quadradas e do mesmo tamanho ao longo da pista.
- [ ] Xadrez de UV no grampo (`C`, `V` ate "grampo"): mostra a compressao `1 - k*d` na borda interna.
- [ ] Xadrez de UV na emenda da volta (`V` ate "emenda"): numeracao continua, sem salto.
- [ ] Xadrez de UV no kart de perto (`C` no jogador, zoom): celulas quadradas na lateral, no capo e
      na traseira; garras/numeros continuos no pneu.
- [ ] Mesmo enquadramento com textura normal (comparar com o xadrez).
- [ ] Layouts UV exportados (`U` -> baixar): `uv_asfalto_emenda`, `uv_zebras`, `uv_guard_rail`,
      `uv_kart_sport`, `uv_kart_sedan`, `uv_pneu`, `uv_capacete`.
- [ ] Com x sem textura (`M`), mesmo enquadramento: a luz e a sombra continuam, so a textura some.
- [ ] Textura sem luz (`L`): textura "chapada", sem sombra nem brilho.
- [ ] So hemisferica (`2` desliga o sol): sem sombra, sem brilho especular, relevo quase sumido.
- [ ] So o sol (`1` desliga a hemisferica): sombras pretas, relevo do asfalto/pneu bem marcado.
- [ ] Close no pneu com o sol de lado (`C`, orbitar): garras em relevo e aro brilhante.
- [ ] Close no capacete: faixa e numero em cada kart (7 vermelho, 12 azul).
- [ ] Guard rail de perto: brilho correndo na lamina, ferrugem fosca.

## Regenerar

```bash
npm run textures     # PNG em public/textures/ (deterministico)
npm run uv-layouts   # layouts e vistas do xadrez em docs/img/
```
