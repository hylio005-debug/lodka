// Тренировка 1.1 — Первые шаги (3 кольца, без врагов)
registerLevel('T1', {
  id: 'T1',
  name: 'Первые шаги',
  isTraining: true,

  bgColor: '#1a3a58',
  gridColor: 'rgba(30, 58, 85, 0.18)',
  floorColor: '#2e4a2e',
  floorTopColor: '#6b8e5a',
  hillColor: '#3f6039',
  waterTint: 'rgba(100, 180, 255, 0.04)',

  maxThrust: 170, thrustAccel: 0.04,
  maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,

  worldW: 2000, worldH: 1100, floorY: 1060,
  start: { x: 100, y: 980 },
  finish: { x: 1900, y: 300, r: 35 },

  levelType: 'rings',
  ringsRequired: 3,
  rings: [
    { x: 500, y: 700, r: 50, id: 1 },
    { x: 1000, y: 500, r: 50, id: 2 },
    { x: 1500, y: 700, r: 50, id: 3 }
  ],

  walls: [
    { x1: 0, y1: 0, x2: 2000, y2: 0, id: 'top' },
    { x1: 2000, y1: 0, x2: 2000, y2: 1100, id: 'right' },
    { x1: 2000, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' }
  ],

  fishes: [],
  music: 'music/menu.mp3'
});