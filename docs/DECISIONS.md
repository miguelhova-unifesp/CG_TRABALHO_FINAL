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
