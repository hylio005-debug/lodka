registerLevel(5, {
  id: 5,
  name: 'Сокровище',
  bgColor: '#2a2018',
  gridColor: 'rgba(80, 60, 30, 0.2)',
  floorColor: '#4a3a1e',
  floorTopColor: '#8a6a3a',
  hillColor: '#5a4828',
  waterTint: 'rgba(255, 220, 150, 0.05)',

  maxThrust: 180,
  thrustAccel: 0.04,
  maxAngVel: 1.7,
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

    // Колонны
    { x1: 800, y1: 400, x2: 800, y2: 700, id: 'col1' },
    { x1: 1600, y1: 400, x2: 1600, y2: 700, id: 'col2' },
    { x1: 2400, y1: 400, x2: 2400, y2: 700, id: 'col3' },

    { x1: 400, y1: 200, x2: 600, y2: 200, id: 'ped1' },
    { x1: 1200, y1: 900, x2: 1400, y2: 900, id: 'ped2' },
    { x1: 2000, y1: 200, x2: 2200, y2: 200, id: 'ped3' },
    { x1: 2800, y1: 900, x2: 3000, y2: 900, id: 'ped4' },
  ],

  fishes: [
    // Много рыб
    { x: 300, y: 300, r: 13, vx: 50, vy: 25, type: 'normal' },
    { x: 500, y: 800, r: 14, vx: -45, vy: -30, type: 'normal' },
    { x: 700, y: 200, r: 12, vx: 55, vy: 35, type: 'normal' },
    { x: 1000, y: 600, r: 15, vx: -60, vy: -25, type: 'normal' },
    { x: 1300, y: 300, r: 14, vx: 50, vy: 30, type: 'angler' },
    { x: 1500, y: 800, r: 15, vx: -55, vy: -35, type: 'angler' },
    { x: 1800, y: 200, r: 13, vx: 45, vy: 25, type: 'normal' },
    { x: 2000, y: 600, r: 14, vx: -50, vy: -30, type: 'normal' },
    { x: 2200, y: 300, r: 15, vx: 60, vy: 35, type: 'angler' },
    { x: 2500, y: 800, r: 14, vx: -45, vy: -25, type: 'angler' },
    { x: 2700, y: 200, r: 13, vx: 55, vy: 30, type: 'normal' },
    { x: 2900, y: 600, r: 15, vx: -50, vy: -35, type: 'angler' },
    { x: 3100, y: 400, r: 14, vx: 45, vy: 25, type: 'normal' },
    { x: 400, y: 1000, r: 13, vx: 50, vy: 30, type: 'normal' },
    { x: 1100, y: 1000, r: 14, vx: -55, vy: -25, type: 'angler' },
  ],

  music: 'music/menu.mp3',
  description: 'Зал сокровищ. Финальное испытание.'
});