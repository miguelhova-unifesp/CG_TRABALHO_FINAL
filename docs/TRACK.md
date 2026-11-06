# Pista

Codigo: `src/track/`. Regra 5: tudo sai dos pontos de controle em `trackData.js`.

## Fluxo

```
trackData.js (pontos [x, z], largura)
  -> trackGeometry.buildTrackSamples()   CatmullRomCurve3 fechada, centripetal,
                                         N amostras igualmente espacadas (getSpacedPoints)
  -> trackMeshes.createTrackMeshes()     asfalto, zebras, guard rails, grama (+ UVs)
  -> trackQuery.createTrackQuery()       surfaceAt(x, z) -> asfalto ou grama (usado pela fisica)
```

`TrackSamples` guarda arrays planos (`px, pz, tx, tz, lx, lz, dist`): tangente unitaria e
vetor "esquerda" = tangente girada +90 graus em Y = `(tz, -tx)`.

## Malhas (`trackMeshes.js`)

Todas sao faixas com (count + 1) linhas: a ultima repete a primeira em posicao, para o loop
fechar com UV continuo.

| malha | geometria | UV |
|---|---|---|
| asfalto | `asphaltColumns` colunas na largura, y = `asphaltY` | u 0..1 na largura, v = arco da central / tile (~12 m) |
| zebras | 1 faixa de `curbWidth` colada em cada borda | u 0..1, v = arco do meio da zebra / tile (~2 m: 1 bloco vermelho + 1 branco) |
| guard rails | 3 faces por lado (frente, topo, tras), face a `railOffset` do centro | u = posicao no perfil / perimetro, v = arco do meio do rail / tile (~2 m) |
| grama | plano unico cobrindo a caixa da pista + `grassMargin` | planar no mundo: u = x / `grassTile`, v = -z / `grassTile` |

- `offsetArcLength(samples, d)`: arco acumulado da linha deslocada `d` metros para a esquerda.
- `fitTileLength(L, nominal)`: tile real = `L / round(L / nominal)`, para a volta ter um numero
  inteiro de tiles. A linha de fechamento fica com v inteiro e, com `texture.repeat` inteiro, emenda
  com v = 0 sem salto.
- Triangulos orientados pela normal pedida (o builder confere no 1o quad e inverte se preciso).
- Distorcao conhecida: na borda a distancia `d` do centro a escala ao longo da pista e `1 - k*d`
  (grampo da pista de teste: 0,38 na borda interna). Ver `docs/DECISIONS.md`.
- Zebras e rails sao so visuais (ver DECISIONS).

## Consulta de superficie

Distancia ate o segmento mais proximo da linha central. Busca local a partir do indice do
passo anterior (`state.trackIndex`, janela `TRACK_GEN.surfaceSearchWindow`); se a busca local
der "fora do asfalto", refaz a busca completa (evita minimo local errado perto de outro trecho).
Nao aloca nada.

## Pista de teste atual

11 pontos, ~515 m, largura 12 m: reta principal (sentido +Z), curva ampla a direita, reta
diagonal e um grampo (~11 m de raio na linha central). Largada em (0, 0), heading 0.
Para a pista real (~1.200 m, ~24 pontos) basta trocar `controlPoints`/`start`.

Ainda nao implementado: waypoints, checkpoints, respawn, colisao com os guard rails.
