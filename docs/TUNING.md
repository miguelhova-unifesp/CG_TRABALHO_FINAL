# Ajuste de sensacao

Todos os numeros ficam em `src/config/tuning.js`. Aqui: o que cada um muda ao jogar.

## Drift (`DRIFT`)

| parametro | aumentar | diminuir |
|---|---|---|
| `gripFactor` (0.3) | kart mais "preso", deriva menor | mais de lado; abaixo de ~0.2 fica dificil de controlar |
| `steerInner` (0.16 rad) | curva fechada mais fechada com o direcional para dentro | |
| `steerNeutral` (0.11 rad) | drift solto vira mais | drift solto quase reto |
| `steerOuter` (0.06 rad) | contra-esterco abre menos a curva | contra-esterco abre mais (perto de 0 = quase reto) |
| `speedRetention` (0.8) | drift quase nao perde velocidade (1 = nada) | drift freia mais (0 = so a aderencia) |
| `enterTime` (0.15 s) | entrada mais suave | entrada mais seca |
| `exitTime` (0.3 s) | saida mais escorregadia | saida mais seca ("tranco") |
| `minSpeed` (8 m/s) / `exitSpeed` (5 m/s) | so derrapa rapido | derrapa ate devagar |
| `minSteer` (0.3) | precisa virar mais para entrar | (teclado: steer e -1/0/1, so importa no gamepad) |

Raio do nariz no drift = `wheelBase / tan(angulo)`: 0.16 rad -> ~13 m, 0.11 -> ~19 m, 0.06 -> ~35 m
(sport, 2.1 m). Deriva ~ `atan(yawRate / (lateralGrip * gripFactor))`.

## Animacao (`KART_ANIM`)

| parametro | efeito |
|---|---|
| `driftWheelspin` (0.3) | quanto as rodas de tras giram a mais no drift (0 = rolam normal) |

O contra-esterco das rodas da frente nao tem numero proprio: segue o angulo de deriva, limitado a
`STEERING.maxSteer`.

