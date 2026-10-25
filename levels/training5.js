// Тренировка 1.5 — Финальное испытание (12 колец + 3 рыбы + удильщик)
registerLevel('T5', {
  id: 'T5',
  name: 'Финальное испытание',
  isTraining: true,

  bgColor: '#1a3a58',
  gridColor: 'rgba(30, 58, 85, 0.18)',
  floorColor: '#2e4a2e',
  floorTopColor: '#6b8e5a',
  hillColor: '#3f6039',
  waterTint: 'rgba(100, 180, 255, 0.04)',

  maxThrust: 170, thrustAccel: 0.04,
  maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,

  worldW: 3000, worldH: 1100, floorY: 1060,
  start: { x: 100, y: 980 },
  finish: { x: 2900, y: 200, r: 35 },

  levelType: 'rings',
  ringsRequired: 12,
  rings: [
    { x: 350, y: 700, r: 16, id: 1 },
    { x: 550, y: 400, r: 16, id: 2 },
    { x: 800, y: 700, r: 16, id: 3 },
    { x: 1050, y: 400, r: 16, id: 4 },
    { x: 1300, y: 700, r: 16, id: 5 },
    { x: 1550, y: 400, r: 16, id: 6 },
    { x: 1800, y: 700, r: 16, id: 7 },
    { x: 2050, y: 400, r: 16, id: 8 },
    { x: 2300, y: 700, r: 16, id: 9 },
    { x: 2500, y: 400, r: 16, id: 10 },
    { x: 2650, y: 700, r: 16, id: 11 },
    { x: 2820, y: 450, r: 16, id: 12 }
  ],

  walls: [
    { x1: 0, y1: 0, x2: 3000, y2: 0, id: 'top' },
    { x1: 3000, y1: 0, x2: 3000, y2: 1100, id: 'right' },
    { x1: 3000, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },

    { x1: 700, y1: 150, x2: 700, y2: 550, id: 'w1' },
    { x1: 1200, y1: 500, x2: 1200, y2: 1100, id: 'w2' },
    { x1: 1700, y1: 0, x2: 1700, y2: 550, id: 'w3' },
    { x1: 2200, y1: 500, x2: 2200, y2: 1100, id: 'w4' }
  ],

  fishes: [
    { x: 900, y: 600, r: 14, vx: 40, vy: 20, type: 'normal' },
    { x: 1900, y: 500, r: 14, vx: -40, vy: 20, type: 'normal' },
    { x: 2500, y: 600, r: 14, vx: 30, vy: 15, type: 'angler' }
  ],
  music: 'music/menu.mp3'
});