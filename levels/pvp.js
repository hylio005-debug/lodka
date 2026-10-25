// ================================================================
//  levels/pvp.js — Арена для дуэли
// ================================================================
registerLevel('PVP', {
  id: 'PVP',
  name: 'Арена Дуэли',
  bgColor: '#0a1520',
  gridColor: 'rgba(50, 100, 150, 0.2)',
  floorColor: '#1a2a3a',
  floorTopColor: '#2a4a6a',
  hillColor: '#1a3a5a',
  waterTint: 'rgba(100, 180, 255, 0.05)',

  maxThrust: 170, thrustAccel: 0.04, maxAngVel: 1.6, angAccel: 0.035, fallBlend: 0.05,
  worldW: 2000, worldH: 1100, floorY: 1060,
  
  start: { x: 200, y: 800 }, // Старт для первого
  start2: { x: 1800, y: 800 }, // Старт для второго
  finish: { x: 0, y: 0, r: 1 }, // Финиш не нужен, ставим в угол

  levelType: 'maze',
  ringsRequired: 0,
  rings: [],

  walls: [
    { x1: 0, y1: 0, x2: 2000, y2: 0, id: 'top' },
    { x1: 2000, y1: 0, x2: 2000, y2: 1100, id: 'right' },
    { x1: 2000, y1: 1100, x2: 0, y2: 1100, id: 'bottom' },
    { x1: 0, y1: 1100, x2: 0, y2: 0, id: 'left' },
    // Центральная колонна
    { x1: 900, y1: 500, x2: 1100, y2: 500, id: 'c1' },
    { x1: 900, y1: 600, x2: 1100, y2: 600, id: 'c2' },
    { x1: 900, y1: 500, x2: 900, y2: 600, id: 'c3' },
    { x1: 1100, y1: 500, x2: 1100, y2: 600, id: 'c4' }
  ],

  fishes: [],
  music: 'music/menu.mp3'
});