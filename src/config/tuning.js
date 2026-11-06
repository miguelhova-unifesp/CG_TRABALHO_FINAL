// Todos os numeros de fisica/IA/pontuacao, agrupados por sistema e com unidade no comentario.
// Valores iniciais da etapa 1 - ajustar jogando (ver docs/TUNING.md).

// Passo fixo
export const DT = 1 / 60; // em segundos

export const LOOP = {
  maxFrameTime: 0.25, // em segundos - frame mais longo que isso e cortado
};

/*
Os 2 tipos de kart. Os 3 parametros por kart sao maxSpeed, engineAccel e lateralGrip;
wheelBase e geometria (usado pela fisica e pelo modelo, mesma fonte). 
  */
export const KART_TYPES = {
  sport: {
    maxSpeed: 30, // m/s - motor para de empurrar aqui
    engineAccel: 14, // m/s^2 - aceleracao do motor com throttle 
    lateralGrip: 8, // 1/s - taxa de decaimento da velocidade lateral (maior = mais aderente)
    wheelBase: 2.1, // m - distancia entre eixos
  },
  sedan: {
    maxSpeed: 27, // m/s 
    engineAccel: 12.5, // m/s^2
    lateralGrip: 10, // 1/s
    wheelBase: 2.2, // m
  },
};

export const PHYSICS = {
  brakeDecel: 25, // m/s^2 - frenagem com brake = 1 andando para frente
  reverseAccel: 6, // m/s^2 - aceleracao de re (brake segurado quase parado)
  reverseMaxSpeed: 8, // m/s - limite de velocidade em re
  reverseThreshold: 0.5, // m/s - abaixo disso, o freio vira re
  dragCoef: 0.002, // 1/m - arrasto aerodinamico: a = dragCoef * v^2
  rollingResistance: 1.0, // m/s^2 - resistencia de rolagem constante
};

export const STEERING = {
  maxSteer: 0.45, // rad - esterco maximo das rodas parado (~26 graus)
  steerFalloffSpeed: 9, // m/s - esterco cai com 1 / (1 + (v / isto)^2)
  steerRate: 3.0, // rad/s - velocidade com que as rodas viram ate o alvo
};

export const OFFROAD = {
  accelFactor: 0.5, // adimensional - multiplica engineAccel na grama
  gripFactor: 0.5, // adimensional - multiplica lateralGrip na grama
  extraDrag: 4, // m/s^2 - resistencia extra constante na grama
};

export const CAMERA = {
  distance: 6.5, // m - distancia atras do kart
  height: 2.6, // m - altura acima do kart
  lookAhead: 4, // m - ponto de mira a frente do kart
  lookHeight: 0.8, // m - altura do ponto de mira
  smoothing: 8, // 1/s - taxa de aproximacao da camera (maior = mais rigida; atraso ~ v / isto)
  fov: 65, // graus - campo de visao vertical
};

export const TRACK_GEN = {
  samples: 240, // amostras ao longo da spline para malha e consulta de superficie
  asphaltY: 0.02, // m - altura do asfalto acima da grama (evita z-fighting)
  grassMargin: 60, // m - quanto o plano de grama passa da caixa da pista
  surfaceSearchWindow: 8, // amostras - janela de busca local a partir do indice anterior
  asphaltColumns: 4, // colunas na largura do asfalto (reduz a "dobra" do UV afim nas curvas fechadas)
  curbWidth: 1, // m - largura de cada zebra, colada na borda do asfalto (so visual)
  railOffset: 7.5, // m - distancia da linha central ate a face do guard rail
  railHeight: 0.8, // m
  railThickness: 0.1, // m
  // m - comprimento nominal de 1 tile de UV (v = 1) ao longo do tracado; o valor real e ajustado
  // para caber um numero inteiro de tiles na volta (emenda sem salto)
  uvTile: { asphalt: 12, curb: 2, rail: 2 },
  grassTile: 8, // m - 1 tile de UV da grama (projecao planar no mundo)
};

export const GRID = {
  lateralOffset: 2.5, // m - distancia de cada kart ao centro da pista no grid
  rowGap: 6, // m - quanto o 2o kart fica a frente do 1o
};
