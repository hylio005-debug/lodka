// Тренировка 1.2 — Простой лабиринт (5 колец)
registerLevel('T2', {
  id: 'T2',
  name: 'Простой лабиринт',
  isTraining: true,

  bgColor: '#1a3a58',
  gridColor: 'rgba(30, 58, 85, 0.18)',
  floorColor: '#2e4a2e',
  floorTopColor: '#6b8e5a',
  hillColor: '#3f6039',
  waterTint: 'rgba(100, 180, 255, 0.04)',

  maxThrust: 170, thrustAccel: 0.04,
  maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,

  worldW: 2400, worldH: 1100, floorY: 1060,
  start: { x: 100, y: 980 },
  finish: { x: 2300, y: 200, r: 35 },

  levelType: 'rings',
  ringsRequired: 5,
  rings: [
    { x: 400, y: 700, r: 38, id: 1 },
    { x: 800, y: 400, r: 38, id: 2 },
    { x: 1200, y: 700, r: 38, id: 3 },
    { x: 1700, y: 400, r: 38, id: 4 },
    { x: 2100, y: 700, r: 38, id: 5 }
  ],

  walls: [
    { x1: 0, y1: 0, x2: 2400, y2: 0, id: 'top' },
    { x1: 2400, y1: 0, x2: 2400, y2: 1100, id: 'right' },
    { x1: 2400, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },

    { x1: 600, y1: 200, x2: 600, y2: 700, id: 'w1' },
    { x1: 1000, y1: 400, x2: 1000, y2: 1100, id: 'w2' },
    { x1: 1400, y1: 0, x2: 1400, y2: 600, id: 'w3' }
  ],

  fishes: [],
  music: 'music/menu.mp3'
});