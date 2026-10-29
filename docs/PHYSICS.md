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

motor:   a += engineAccel * throttle * max(0, 1 - (vF/maxSpeed)^2)
freio:   vF > reverseThreshold ? a -= brakeDecel * brake : (re) a -= reverseAccel * brake
         (re limitada a reverseMaxSpeed)
vF += a*DT
arrasto: |vF| -= (dragCoef*vF^2 + rollingResistance) * DT, sem trocar o sinal
aderencia: vL *= exp(-lateralGrip * DT)       <- parametro que o drift vai mexer
v = f*vF + l*vL ;  pos += v*DT

esterco: alvo = -steer * maxSteer / (1 + (|vF|/steerFalloffSpeed)^2)
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

Ainda nao implementado: drift, miniturbo, colisoes.
