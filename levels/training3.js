// Тренировка 1.3 — Первая рыба (7 колец + 1 медленная рыба)
registerLevel('T3', {
  id: 'T3',
  name: 'Первая рыба',
  isTraining: true,

  bgColor: '#1a3a58',
  gridColor: 'rgba(30, 58, 85, 0.18)',
  floorColor: '#2e4a2e',
  floorTopColor: '#6b8e5a',
  hillColor: '#3f6039',
  waterTint: 'rgba(100, 180, 255, 0.04)',

  maxThrust: 170, thrustAccel: 0.04,
  maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,

  worldW: 2600, worldH: 1100, floorY: 1060,
  start: { x: 100, y: 980 },
  finish: { x: 2500, y: 200, r: 35 },

  levelType: 'rings',
  ringsRequired: 7,
  rings: [
    { x: 400, y: 800, r: 28, id: 1 },
    { x: 700, y: 500, r: 28, id: 2 },
    { x: 1000, y: 800, r: 28, id: 3 },
    { x: 1400, y: 400, r: 28, id: 4 },
    { x: 1800, y: 700, r: 28, id: 5 },
    { x: 2100, y: 400, r: 28, id: 6 },
    { x: 2400, y: 700, r: 28, id: 7 }
  ],

  walls: [
    { x1: 0, y1: 0, x2: 2600, y2: 0, id: 'top' },
    { x1: 2600, y1: 0, x2: 2600, y2: 1100, id: 'right' },
    { x1: 2600, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' }
  ],

  fishes: [
    { x: 1200, y: 600, r: 14, vx: 20, vy: 10, type: 'normal' }
  ],
  music: 'music/menu.mp3'
});