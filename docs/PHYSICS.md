# Fisica do kart

Codigo: `src/physics/kartPhysics.js` (`stepKart`), `src/physics/kartState.js` (`KartState`,
`KartInput`). Um passo = `DT = 1/60` s (regra 1). Nada de alocacao no passo.

## Passo (nesta ordem)

```
salva prevPosition/prevHeading/prevSteerAngle (interpolacao do render)
f = (sin h, 0, cos h)  frente      l = (cos h, 0, -sin h)  esquerda
vF = v.f   vL = v.l

superficie (trackQuery): na grama  engineAccel *= OFFROAD.accelFactor
                                   lateralGrip *= OFFROAD.gripFactor
                                   resistencia += OFFROAD.extraDrag
drift:   maquina de estados (abaixo); driftAmount em [0, 1]
         lateralGrip *= 1 + (DRIFT.gripFactor - 1) * driftAmount

motor:   a += engineAccel * throttle * max(0, 1 - (vF/maxSpeed)^2)
freio:   vF > reverseThreshold ? a -= brakeDecel * brake : (re) a -= reverseAccel * brake
         (re limitada a reverseMaxSpeed)
vF += a*DT
arrasto: |vF| -= (dragCoef*vF^2 + rollingResistance) * DT, sem trocar o sinal
aderencia: vL *= exp(-lateralGrip * DT)
         no drift: |v| perdida pela aderencia volta em parte para vF (speedRetention * driftAmount)
v = f*vF + l*vL ;  pos += v*DT

esterco: normal: alvo = -steer * maxSteer / (1 + (|vF|/steerFalloffSpeed)^2)
         drift:  alvo = -driftDir * (steerOuter .. steerNeutral .. steerInner) conforme steer*driftDir
         steerAngle anda ate o alvo a no maximo steerRate*DT
yaw:     h += vF * tan(steerAngle) / wheelBase * DT   (bicicleta cinematica)
```

A velocidade e montada na base *antes* de girar o heading: o giro cria velocidade lateral no
passo seguinte, e a aderencia vai comendo. Com aderencia alta o kart segue o nariz; com baixa ele
escorrega (angulo de deriva ~ yawRate / lateralGrip). Por isso grip e "o" parametro do drift.

## Velocidades resultantes (com o tuning atual)

| | asfalto | grama |
|---|---|---|
| sport | ~27.2 m/s (98 km/h), 0-20 m/s em ~2.0 s | ~14 m/s |
| sedan | ~24.5 m/s (88 km/h), 0-20 m/s em ~2.4 s | ~11 m/s |

`maxSpeed` e onde o motor para de empurrar; arrasto + rolagem deixam a velocidade final um pouco
abaixo.

## Drift

Entrada `KartInput.drift` (Espaco segurado). Estado em `KartState`: `drifting`, `driftDir`,
`driftTime`, `driftAmount`, `driftLatch`. Numeros em `DRIFT` (`config/tuning.js`).

| | condicao |
|---|---|
| entra | botao segurado e ainda nao usado (`driftLatch`), `abs(steer) >= minSteer`, `vF >= minSpeed`, no asfalto, sem freio |
| lado | `driftDir = sign(steer)` na entrada, travado ate o fim |
| sai | soltou o botao, freou, saiu do asfalto ou `vF < exitSpeed` |
| de novo | precisa soltar e apertar o botao (segurar direto nao encadeia drifts) |

Durante o drift:

- **Aderencia** cai para `gripFactor` x o normal, com rampa (`enterTime` na entrada, `exitTime` na
  saida). Deriva ~ `atan(yawRate / grip)`: menos grip = mais de lado. O sport (grip 8) derrapa
  mais que o sedan (grip 10) com os mesmos numeros.
- **Esterco** sem a queda com a velocidade: o direcional para dentro usa `steerInner` (curva
  fechada), solto `steerNeutral`, contra-esterco `steerOuter` (curva aberta). Pela bicicleta
  cinematica o raio do nariz e `wheelBase / tan(angulo)` e nao depende da velocidade.
- **Velocidade**: sem nada, matar a velocidade lateral com grip baixo freia muito (o drift viraria
  freio). `speedRetention` devolve essa fracao do modulo perdido para a frente; o modulo nunca
  passa do que era antes do passo (teste).
- `driftTime` conta a duracao do drift atual: base para o miniturbo (ainda nao implementado).

Sem o botao, `driftAmount = 0` e o passo e identico ao de antes do drift.

### Numeros com o tuning atual (acelerando, ~1 s depois de entrar)

| | normal, steer = 1 | drift para dentro | drift neutro | drift contra-esterco |
|---|---|---|---|---|
| sport (~27 m/s) | deriva 4.5 graus, raio ~44 m | 35 graus, ~16 m | 28 graus, ~21 m | 17 graus, ~37 m |
| sedan (~24 m/s) | 3.8 graus, ~39 m | 28 graus, ~15 m | 21 graus, ~21 m | 12 graus, ~37 m |

Perda de velocidade no drift: < 1 m/s. Saida (soltar o botao): deriva < 3.5 graus em 0.4 s.

Ainda nao implementado: miniturbo, colisoes.
