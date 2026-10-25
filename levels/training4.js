// Тренировка 1.4 — Две рыбы (10 колец)
registerLevel('T4', {
  id: 'T4',
  name: 'Две рыбы',
  isTraining: true,

  bgColor: '#1a3a58',
  gridColor: 'rgba(30, 58, 85, 0.18)',
  floorColor: '#2e4a2e',
  floorTopColor: '#6b8e5a',
  hillColor: '#3f6039',
  waterTint: 'rgba(100, 180, 255, 0.04)',

  maxThrust: 170, thrustAccel: 0.04,
  maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,

  worldW: 2800, worldH: 1100, floorY: 1060,
  start: { x: 100, y: 980 },
  finish: { x: 2700, y: 200, r: 35 },

  levelType: 'rings',
  ringsRequired: 10,
  rings: [
    { x: 350, y: 700, r: 21, id: 1 },
    { x: 600, y: 400, r: 21, id: 2 },
    { x: 900, y: 700, r: 21, id: 3 },
    { x: 1200, y: 400, r: 21, id: 4 },
    { x: 1500, y: 700, r: 21, id: 5 },
    { x: 1800, y: 400, r: 21, id: 6 },
    { x: 2100, y: 700, r: 21, id: 7 },
    { x: 2300, y: 400, r: 21, id: 8 },
    { x: 2500, y: 700, r: 21, id: 9 },
    { x: 2650, y: 400, r: 21, id: 10 }
  ],

  walls: [
    { x1: 0, y1: 0, x2: 2800, y2: 0, id: 'top' },
    { x1: 2800, y1: 0, x2: 2800, y2: 1100, id: 'right' },
    { x1: 2800, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },

    { x1: 750, y1: 200, x2: 750, y2: 600, id: 'w1' },
    { x1: 1350, y1: 500, x2: 1350, y2: 1100, id: 'w2' },
    { x1: 1950, y1: 0, x2: 1950, y2: 500, id: 'w3' }
  ],

  fishes: [
    { x: 800, y: 600, r: 14, vx: 30, vy: 15, type: 'normal' },
    { x: 2000, y: 500, r: 14, vx: -30, vy: 20, type: 'normal' }
  ],
  music: 'music/menu.mp3'
});