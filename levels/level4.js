registerLevel(4, {
  id: 4,
  name: 'Подводный остров',
  bgColor: '#050a15',          // Очень темный
  gridColor: 'rgba(20, 40, 60, 0.2)',
  floorColor: '#1a2a1a',
  floorTopColor: '#3a5a3a',
  hillColor: '#2a4a2a',
  waterTint: 'rgba(100, 200, 200, 0.08)',
  isDark: true,                // ВКЛЮЧАЕМ ТЕМНОТУ

  maxThrust: 170,
  thrustAccel: 0.04,
  maxAngVel: 1.6,
  angAccel: 0.035,
  fallBlend: 0.05,

  worldW: 3200,
  worldH: 1100,
  floorY: 1060,

  start: { x: 100, y: 980 },
  finish: { x: 3080, y: 120, r: 30 },

  levelType: 'maze',
  ringsRequired: 0,
  rings: [],

  walls: [
    { x1: 0, y1: 0, x2: 3200, y2: 0, id: 'top' },
    { x1: 3200, y1: 0, x2: 3200, y2: 1100, id: 'right' },
    { x1: 3200, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },

    // Скалы и пещеры
    { x1: 600, y1: 0, x2: 600, y2: 400, id: 'r1' },
    { x1: 600, y1: 800, x2: 600, y2: 1100, id: 'r2' },
    { x1: 1200, y1: 200, x2: 1200, y2: 900, id: 'r3' },
    { x1: 1800, y1: 0, x2: 1800, y2: 400, id: 'r4' },
    { x1: 1800, y1: 800, x2: 1800, y2: 1100, id: 'r5' },
    { x1: 2400, y1: 200, x2: 2400, y2: 900, id: 'r6' },
    { x1: 2900, y1: 0, x2: 2900, y2: 400, id: 'r7' },
    { x1: 2900, y1: 800, x2: 2900, y2: 1100, id: 'r8' },

    { x1: 800, y1: 400, x2: 1000, y2: 400, id: 's1' },
    { x1: 1400, y1: 700, x2: 1600, y2: 700, id: 's2' },
    { x1: 2000, y1: 400, x2: 2200, y2: 400, id: 's3' },
    { x1: 2600, y1: 700, x2: 2800, y2: 700, id: 's4' },
  ],

  fishes: [
    { x: 400, y: 300, r: 14, vx: 40, vy: 20, type: 'angler' },
    { x: 800, y: 900, r: 15, vx: -45, vy: -25, type: 'angler' },
    { x: 1000, y: 200, r: 14, vx: 50, vy: 30, type: 'angler' },
    { x: 1400, y: 500, r: 15, vx: -40, vy: -20, type: 'angler' },
    { x: 1600, y: 900, r: 14, vx: 45, vy: 25, type: 'angler' },
    { x: 2000, y: 200, r: 15, vx: -50, vy: -30, type: 'angler' },
    { x: 2200, y: 600, r: 14, vx: 40, vy: 20, type: 'angler' },
    { x: 2600, y: 900, r: 15, vx: -45, vy: -25, type: 'angler' },
    { x: 2800, y: 300, r: 14, vx: 50, vy: 30, type: 'angler' },
    { x: 3000, y: 700, r: 15, vx: -40, vy: -20, type: 'angler' },
    { x: 500, y: 1000, r: 14, vx: 45, vy: 25, type: 'angler' },
  ],

  music: 'music/level4.mp3',
  description: 'Тёмные пещеры. Без прожектора рыб не видно!'
});