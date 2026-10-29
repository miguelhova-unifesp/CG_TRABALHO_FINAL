# Pista

Codigo: `src/track/`. Regra 5: tudo sai dos pontos de controle em `trackData.js`.

## Fluxo

```
trackData.js (pontos [x, z], largura)
  -> trackGeometry.buildTrackSamples()   CatmullRomCurve3 fechada, centripetal,
                                         N amostras igualmente espacadas (getSpacedPoints)
  -> trackMeshes.createTrackMeshes()     asfalto + plano de grama
  -> trackQuery.createTrackQuery()       surfaceAt(x, z) -> asfalto ou grama (usado pela fisica)
```

`TrackSamples` guarda arrays planos (`px, pz, tx, tz, lx, lz, dist`): tangente unitaria e
vetor "esquerda" = tangente girada +90 graus em Y = `(tz, -tx)`.

## Asfalto

- 2 vertices por amostra (borda esquerda e direita), mais uma linha final que repete a primeira,
  para o loop fechar com UV continuo (`v` = distancia / largura).
- Triangulos anti-horarios vistos de cima (normal +Y). Fica `TRACK_GEN.asphaltY` acima da grama.

## Consulta de superficie

Distancia ate o segmento mais proximo da linha central. Busca local a partir do indice do
passo anterior (`state.trackIndex`, janela `TRACK_GEN.surfaceSearchWindow`); se a busca local
der "fora do asfalto", refaz a busca completa (evita minimo local errado perto de outro trecho).
Nao aloca nada.

## Pista de teste atual

11 pontos, ~515 m, largura 12 m: reta principal (sentido +Z), curva ampla a direita, reta
diagonal e um grampo (~11 m de raio na linha central). Largada em (0, 0), heading 0.
Para a pista real (~1.200 m, ~24 pontos) basta trocar `controlPoints`/`start`.

Ainda nao implementado: zebras, guard rails, waypoints, checkpoints, respawn.
