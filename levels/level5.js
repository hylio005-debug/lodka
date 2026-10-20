// ================================================================
//  levels/level5.js — Уровень 5: «Логово Кракена» (БОСС)
// ================================================================

registerLevel(5, {
  id: 5,
  name: 'Логово Кракена',

  bgColor: '#160818',
  gridColor: 'rgba(80, 30, 60, 0.2)',
  floorColor: '#2a1020',
  floorTopColor: '#5a2038',
  hillColor: '#3a1528',
  waterTint: 'rgba(200, 100, 150, 0.05)',

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

  levelType: 'boss',
  ringsRequired: 0,
  rings: [],

  // ====== НАСТРОЙКИ БОССА ======
  boss: 'kraken',
  bossPos: { x: 2900, y: 550, r: 90 },
  bossTriggerX: 2400,

  walls: [
    { x1: 0, y1: 0, x2: 3200, y2: 0, id: 'top' },
    { x1: 3200, y1: 0, x2: 3200, y2: 1100, id: 'right' },
    { x1: 3200, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },

    // Пара колонн на подходе, арена справа (x > 2400) чистая
    { x1: 800, y1: 400, x2: 800, y2: 700, id: 'col1' },
    { x1: 1600, y1: 400, x2: 1600, y2: 700, id: 'col2' },
  ],

  fishes: [
    { x: 300, y: 300, r: 13, vx: 50, vy: 25, type: 'normal' },
    { x: 600, y: 800, r: 14, vx: -45, vy: -30, type: 'angler' },
    { x: 1000, y: 600, r: 15, vx: -60, vy: -25, type: 'normal' },
    { x: 1300, y: 300, r: 14, vx: 50, vy: 30, type: 'angler' },
    { x: 1800, y: 700, r: 15, vx: -55, vy: -35, type: 'angler' },
    { x: 2200, y: 400, r: 14, vx: 45, vy: 25, type: 'normal' },
  ],

  music: 'music/menu.mp3',
  krakenMusic: 'music/kraken.mp3',
  description: 'Финальное испытание. Кракен ждёт в своём логове.'
});