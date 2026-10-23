// ================================================================
//  js/render.js — ОТРИСОВКА
// ================================================================

// ================================================================
//  js/render.js — ОТРИСОВКА
// ================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// Скрытый холст для карты света
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

// ================================================================
// ЗАГРУЗКА ВСЕХ СЛОЕВ КРАКЕНА ИЗ SVG
// ================================================================
const svgKrakenHead = new Image();
svgKrakenHead.src = 'assets/boss/kraken/kraken-head.svg';

const svgKrakenEye = new Image();
svgKrakenEye.src = 'assets/boss/kraken/kraken-eye.svg';

const svgKrakenPupilLeft = new Image();
svgKrakenPupilLeft.src = 'assets/boss/kraken/kraken-pupil-left.svg';

const svgKrakenPupilRight = new Image();
svgKrakenPupilRight.src = 'assets/boss/kraken/kraken-pupil-right.svg';

const svgKrakenEyelid = new Image();
svgKrakenEyelid.src = 'assets/boss/kraken/kraken-eyelid.svg';

const svgKrakenMouth = new Image();
svgKrakenMouth.src = 'assets/boss/kraken/kraken-mouth.svg';

// ================================================================
function updateZoom() {


  zoom = W / getTargetViewWidth();
  zoom = Math.max(0.6, Math.min(zoom, 2.5));
}

function resize() {
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  W = canvas.width = Math.round(cssW * renderScale);
  H = canvas.height = Math.round(cssH * renderScale);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  // Настраиваем размер скрытого холста для света
  lightCanvas.width = W;
  lightCanvas.height = H;

  // Вызываем функцию пересчета зума
  updateZoom();
}
window.addEventListener('resize', resize);

function updateCamera() {
  const vw = viewW(), vh = viewH();
  let cx = sub.x - vw / 2, cy = sub.y - vh / 2;
  cx = Math.max(0, Math.min(WORLD_W - vw, cx));
  cy = Math.max(0, Math.min(WORLD_H - vh, cy));
  if (WORLD_W < vw) cx = (WORLD_W - vw) / 2;
  if (WORLD_H < vh) cy = (WORLD_H - vh) / 2;
  camera.x = cx; camera.y = cy;
}

// ================================================================
//  ГЛАВНАЯ ОТРИСОВКА
// ================================================================
function draw() {
  // 1. Очищаем экран
  ctx.fillStyle = levelBgColor;
  ctx.fillRect(0, 0, W, H);

  // 2. Входим в мировые координаты
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  const vL = camera.x, vT = camera.y;
  const vR = camera.x + viewW(), vB = camera.y + viewH();

  // 3. Рисуем ВЕСЬ мир (дно, стены, рыб, лодку, пузырьки)
  if (qualityLevel !== 'low') drawLightRays(vL, vT, vR, vB);
  if (qualityLevel !== 'low') drawGrid(vL, vT, vR, vB);
  drawSeaFloor(vL, vR);
  
  if (qualityLevel !== 'low') {
    for (const sw of seaweeds) {
      if (sw.x < vL - 80 || sw.x > vR + 80) continue;
      drawSeaweed(sw);
    }
  }

  drawFinishPortal();

  for (const w of walls) {
    const minX = Math.min(w.x1, w.x2), maxX = Math.max(w.x1, w.x2);
    const minY = Math.min(w.y1, w.y2), maxY = Math.max(w.y1, w.y2);
    if (maxX < vL - 40 || minX > vR + 40) continue;
    if (maxY < vT - 40 || minY > vB + 40) continue;
    drawWall(w);
  }

  for (const f of fishes) {
    if (f.x < vL - 100 || f.x > vR + 100) continue;
    drawFish(f);
  }

  if (levelType === 'rings') {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.x < vL - 100 || r.x > vR + 100) continue;
      drawRing(r, i === currentRingIndex);
    }
  }

  for (const t of torpedoes) {
    if (t.x < vL - 50 || t.x > vR + 50) continue;
    drawTorpedo(t);
  }

  if (winchState !== 'idle') {
    drawWinch();
  }

  for (const b of ambientBubbles) {
    if (b.x < vL - 20 || b.x > vR + 20) continue;
    if (b.y < vT - 20 || b.y > vB + 20) continue;
    const alpha = Math.max(0, 1 - b.life / b.maxLife);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 235, 255, ${0.5 * alpha})`;
    ctx.fill();
  }

  if (currentLevelData && currentLevelData.boss === 'kraken') {
    for (const c of inkClouds) drawInkCloud(c);
    drawKraken();
    for (const w of tentacleWarnings) drawTentacleWarning(w);
    for (const t of tentacles) drawTentacle(t);
  }

  drawSub();

  ctx.restore();

  // 4. Накладываем свет (если уровень темный)
  if (levelIsDark) {
    drawDarkness();
  }

  if (sub.inkBlind > 0) {
    drawInkBlindness();
  }

  // 5. Миникарта
  if (inventory.map && started) {
    drawMinimap();
  }
}

function drawInkBlindness() {
  const alpha = Math.min(1, sub.inkBlind / 1.2);
  if (alpha <= 0) return;

  // Одна тёмная заливка
  ctx.fillStyle = `rgba(6, 3, 15, ${0.5 * alpha})`;
  ctx.fillRect(0, 0, W, H);

  // Виньетка (один градиент вместо пяти)
  const cx = W / 2, cy = H / 2;
  const maxR = Math.max(W, H) * 0.8;
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.25, cx, cy, maxR);
  grad.addColorStop(0, 'rgba(10, 5, 20, 0)');
  grad.addColorStop(1, `rgba(3, 1, 8, ${0.75 * alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}


// ================================================================
//  ТЕМНОТА И ПРОЖЕКТОР (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ================================================================
function drawDarkness() {
  // 1. Очищаем холст света
  lightCtx.clearRect(0, 0, W, H);
  
  // 2. Заливаем его сплошной ночной темнотой
  lightCtx.fillStyle = '#05080e'; // Очень темный цвет
  lightCtx.fillRect(0, 0, W, H);
  
  // 3. Включаем режим "screen" (складывание света)
  lightCtx.globalCompositeOperation = 'screen';
  
  // Координаты лодки на экране
  const sx = (sub.x - camera.x) * zoom;
  const sy = (sub.y - camera.y) * zoom;
  
  // 4. Рисуем ауру вокруг лодки (чтобы видеть под собой)
  const auraR = 160 * zoom;
  const auraGrad = lightCtx.createRadialGradient(sx, sy, 0, sx, sy, auraR);
  auraGrad.addColorStop(0, 'rgba(200, 230, 255, 0.9)'); // Яркий центр
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  lightCtx.fillStyle = auraGrad;
  lightCtx.beginPath();
  lightCtx.arc(sx, sy, auraR, 0, Math.PI * 2);
  lightCtx.fill();
  
  // 5. Рисуем конус фонарика
  if (flashlightOn) {
    const coneLen = 600 * zoom;
    const coneAngle = 0.5;
    const dir = sub.angle;
    
    const coneGrad = lightCtx.createRadialGradient(sx, sy, 20, sx, sy, coneLen);
    coneGrad.addColorStop(0, 'rgba(255, 255, 240, 1.0)'); // Бело-желтый
    coneGrad.addColorStop(0.4, 'rgba(255, 220, 150, 0.8)');
    coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    lightCtx.fillStyle = coneGrad;
    lightCtx.beginPath();
    lightCtx.moveTo(sx, sy);
    lightCtx.arc(sx, sy, coneLen, dir - coneAngle, dir + coneAngle);
    lightCtx.closePath();
    lightCtx.fill();
  }
  
  // Сбрасываем режим
  lightCtx.globalCompositeOperation = 'source-over';
  
  // 6. НАКЛАДЫВАЕМ КАРТУ СВЕТА НА ИГРУ
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

// ================================================================
//  МИНИКАРТА
// ================================================================
let minimapCtx = null;

function drawMinimap() {
  const mCanvas = el('minimapCanvas');
  if (!mCanvas) return;
  if (!minimapCtx) minimapCtx = mCanvas.getContext('2d');
  
  const mCtx = minimapCtx;
  const mW = mCanvas.width;
  const mH = mCanvas.height;

  // Очищаем радар
  mCtx.fillStyle = 'rgba(10, 26, 40, 0.95)';
  mCtx.fillRect(0, 0, mW, mH);

  // Настройки отображения (насколько "далеко" видит радар)
  const viewRange = 500; // Показываем область 1400x1400 вокруг лодки
  const scale = mW / viewRange;

  mCtx.save();
  
  // Центрируем радар на лодке и масштабируем
  mCtx.translate(mW / 2, mH / 2);
  mCtx.scale(scale, scale);
  mCtx.translate(-sub.x, -sub.y);

  // 1. Легкая сетка для ощущения движения
  mCtx.strokeStyle = 'rgba(30, 58, 85, 0.4)';
  mCtx.lineWidth = 2 / scale;
  const gridStep = 200;
  const startX = Math.floor((sub.x - viewRange) / gridStep) * gridStep;
  const startY = Math.floor((sub.y - viewRange) / gridStep) * gridStep;
  
  for (let x = startX; x < sub.x + viewRange; x += gridStep) {
    mCtx.beginPath(); mCtx.moveTo(x, sub.y - viewRange); mCtx.lineTo(x, sub.y + viewRange); mCtx.stroke();
  }
  for (let y = startY; y < sub.y + viewRange; y += gridStep) {
    mCtx.beginPath(); mCtx.moveTo(sub.x - viewRange, y); mCtx.lineTo(sub.x + viewRange, y); mCtx.stroke();
  }

  // 2. Стены (рисуем их потолще для видимости)
  mCtx.strokeStyle = 'rgba(212, 162, 89, 0.8)';
  mCtx.lineWidth = 4 / scale;
  mCtx.lineCap = 'round';
  for (const w of walls) {
    mCtx.beginPath();
    mCtx.moveTo(w.x1, w.y1);
    mCtx.lineTo(w.x2, w.y2);
    mCtx.stroke();
  }

  // Кракен на радаре
  if (krakenActive && !krakenDefeated) {
    mCtx.beginPath();
    mCtx.arc(krakenPos.x, krakenPos.y, krakenPos.r, 0, Math.PI * 2);
    mCtx.fillStyle = 'rgba(255, 100, 100, 0.55)';
    mCtx.fill();
    mCtx.strokeStyle = '#ff6b6b';
    mCtx.lineWidth = 3 / scale;
    mCtx.stroke();
  }

  // 4. Кольца
  if (levelType === 'rings') {
    for (const r of rings) {
      mCtx.beginPath();
      mCtx.arc(r.x, r.y, r.r * 0.5, 0, Math.PI * 2);
      mCtx.strokeStyle = r.passed ? '#6ee787' : 'rgba(255, 220, 130, 0.6)';
      mCtx.lineWidth = 3 / scale;
      mCtx.stroke();
    }
  }

  // 5. Торпеды
  mCtx.fillStyle = '#ff6b6b';
  for (const t of torpedoes) {
    mCtx.beginPath();
    mCtx.arc(t.x, t.y, 8 / scale, 0, Math.PI * 2);
    mCtx.fill();
  }

  mCtx.restore();

  // 6. Рисуем саму лодку в центре радара (она всегда в центре)
  mCtx.beginPath();
  mCtx.arc(mW / 2, mH / 2, 4, 0, Math.PI * 2);
  mCtx.fillStyle = '#7fd6ff';
  mCtx.fill();

  // 7. Указатель направления носа лодки
  mCtx.beginPath();
  mCtx.moveTo(mW / 2, mH / 2);
  mCtx.lineTo(mW / 2 + Math.cos(sub.angle) * 12, mH / 2 + Math.sin(sub.angle) * 12);
  mCtx.strokeStyle = '#ffffff';
  mCtx.lineWidth = 2;
  mCtx.stroke();
}

// ================================================================
//  ФОНОВЫЕ ЭЛЕМЕНТЫ
// ================================================================
function drawGrid(left, top, right, bottom) {
  const gridStep = 100;
  const sX = Math.floor(left / gridStep) * gridStep;
  const sY = Math.floor(top / gridStep) * gridStep;
  ctx.strokeStyle = levelGridColor;
  ctx.lineWidth = 1 / zoom;
  for (let x = sX; x <= right; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, sY); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = sY; y <= bottom; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(sX, y); ctx.lineTo(right, y); ctx.stroke();
  }
}

function drawLightRays(left, top, right, bottom) {
  const vw = right - left, vh = bottom - top;
  const t = sub.animTime;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(180, 220, 255, 0.05)';
  for (let i = 0; i < 4; i++) {
    const phase = i * 1.3 + t * 0.15;
    const x = left + ((i / 4) * vw + Math.sin(phase) * 100);
    const w = 100 + Math.sin(phase * 0.7) * 40;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.6 + vh * 0.4, bottom);
    ctx.lineTo(x - w * 0.4 + vh * 0.4, bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSeaFloor(left, right) {
  ctx.fillStyle = levelFloorColor;
  ctx.fillRect(left, FLOOR_Y, right - left, WORLD_H - FLOOR_Y + 50);
  ctx.fillStyle = levelFloorTopColor;
  ctx.fillRect(left, FLOOR_Y, right - left, 10);

  if (qualityLevel !== 'low') {
    ctx.fillStyle = levelHillColor;
    for (const h of seaFloorHills) {
      if (h.x + h.r < left || h.x - h.r > right) continue;
      ctx.beginPath();
      ctx.moveTo(h.x - h.r, FLOOR_Y + 4);
      ctx.quadraticCurveTo(h.x, FLOOR_Y - h.h, h.x + h.r, FLOOR_Y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (qualityLevel === 'high') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = Math.floor(left / 80) * 80; x < right; x += 80) {
      const px = x + ((x * 13) % 40);
      ctx.beginPath();
      ctx.arc(px, FLOOR_Y + 14 + ((x * 7) % 8), 3 + ((x * 3) % 4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSeaweed(sw) {
  const t = sub.animTime;
  const segments = 6;
  const segH = sw.height / segments;

  ctx.strokeStyle = sw.color;
  ctx.lineWidth = sw.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sw.x, sw.baseY);

  let px = sw.x, py = sw.baseY;
  for (let i = 1; i <= segments; i++) {
    const bend = Math.sin(t * sw.speed + sw.phase + i * 0.6) * (i / segments) * 10;
    const nx = sw.x + bend;
    const ny = sw.baseY - segH * i;
    ctx.lineTo(nx, ny);
    px = nx;
    py = ny;
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(px, py, sw.width * 0.9, sw.width * 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = sw.color;
  ctx.fill();
}

// ================================================================
//  СТЕНЫ, КОЛЬЦА, ФИНИШ, ДРОН, РЫБЫ
// ================================================================
function drawWall(w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ang = Math.atan2(dy, dx);
  const thickness = 22;
  const halfT = thickness / 2;

  ctx.save();
  ctx.translate(w.x1, w.y1);
  ctx.rotate(ang);

  // Основной прямоугольник
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -halfT, len, thickness);
  ctx.clip();

  ctx.fillStyle = '#6b5437';
  ctx.fillRect(0, -halfT, len, thickness);

  // Кладка
  ctx.strokeStyle = 'rgba(30, 18, 8, 0.7)';
  ctx.lineWidth = 1;
  const blockH = 14, blockW = 32;

  for (let y = -halfT + blockH; y < halfT; y += blockH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
  }

  let bc = 0;
  for (let x = 0; x < len; x += blockW) {
    bc++;
    if (bc % 2 === 0) continue;
    for (let y = -halfT; y < halfT; y += blockH) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + blockH); ctx.stroke();
    }
  }

  for (let x = blockW; x < len; x += blockW) {
    for (let y = -halfT + blockH; y < halfT - blockH; y += blockH * 2) {
      ctx.beginPath(); ctx.moveTo(x, y + blockH * 0.5); ctx.lineTo(x, y + blockH * 1.5); ctx.stroke();
    }
  }

  // Иероглифы
  if (len > 80) {
    const step = 70;
    for (let x = step * 0.6; x < len - step * 0.6; x += step) {
      const seed = (x + w.id.length * 13) % 97;
      drawMayanGlyphToCtx(ctx, x, 0, 20, seed);
    }
  }

  // Мох
  ctx.strokeStyle = 'rgba(40, 80, 50, 0.55)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < len; x += 40) {
    const r = hashNoise(x, 0, 7);
    if (r > 0.6) {
      ctx.beginPath();
      ctx.moveTo(x, -halfT);
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        ctx.lineTo(x + t * 18, -halfT + 2 + Math.sin(t * 6 + r * 10) * 2);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(40, 80, 50, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 9, -halfT + 2, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Трещины
  ctx.strokeStyle = 'rgba(20, 10, 0, 0.6)';
  ctx.lineWidth = 1;
  for (let x = 20; x < len; x += 90) {
    const r = hashNoise(x, 0, 11);
    if (r > 0.5) {
      const sx = x + (r - 0.5) * 30;
      ctx.beginPath();
      ctx.moveTo(sx, -halfT + 2);
      for (let k = 1; k <= 5; k++) {
        const t = k / 5;
        ctx.lineTo(sx + Math.sin(t * 8 + r * 5) * 3, -halfT + t * thickness);
      }
      ctx.stroke();
    }
  }

  // Полосы
  ctx.fillStyle = 'rgba(255, 220, 150, 0.15)';
  ctx.fillRect(0, -halfT, len, 3);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, halfT - 3, len, 3);

  ctx.restore(); // Выход из клипа

  // Круглые торцы
  drawWallCap(0, 0, halfT);
  drawWallCap(len, 0, halfT);

  ctx.restore();
}

function drawWallCap(x, y, halfT) {
  ctx.beginPath();
  ctx.arc(x, y, halfT, 0, Math.PI * 2);
  ctx.fillStyle = '#6b5437';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 18, 8, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, halfT * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 220, 150, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, halfT * 0.3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 220, 150, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, halfT * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 30, 15, 0.6)';
  ctx.fill();
}

function drawRing(r, isCurrent) {
  const t = sub.animTime;
  const pulse = isCurrent ? 1 + Math.sin(t * 3) * 0.08 : 1;

  const glow = ctx.createRadialGradient(r.x, r.y, r.r * 0.3, r.x, r.y, r.r * 1.8);
  if (r.passed) {
    glow.addColorStop(0, 'rgba(110, 231, 135, 0.35)');
    glow.addColorStop(1, 'rgba(110, 231, 135, 0)');
  } else if (isCurrent) {
    glow.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  } else {
    glow.addColorStop(0, 'rgba(127, 214, 255, 0.2)');
    glow.addColorStop(1, 'rgba(127, 214, 255, 0)');
  }
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(t * 0.8);

  const rr = r.r * pulse;
  ctx.strokeStyle = r.passed ? '#6ee787' : isCurrent ? '#ffd166' : 'rgba(127, 214, 255, 0.5)';
  ctx.lineWidth = isCurrent ? 6 / zoom : 4 / zoom;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.stroke();

  const segments = 8;
  ctx.strokeStyle = r.passed ? 'rgba(110, 231, 135, 0.6)' :
                    isCurrent ? 'rgba(255, 220, 130, 0.7)' : 'rgba(127, 214, 255, 0.3)';
  ctx.lineWidth = 2 / zoom;
  for (let i = 0; i < segments; i++) {
    ctx.rotate(Math.PI * 2 / segments);
    ctx.beginPath();
    ctx.moveTo(rr * 0.7, 0);
    ctx.lineTo(rr * 0.9, 0);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = r.passed ? '#6ee787' : isCurrent ? '#ffd166' : 'rgba(127, 214, 255, 0.5)';
  ctx.font = `bold ${14 / zoom}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.id, r.x, r.y);
}

function drawFinishPortal() {
  const t = sub.animTime;
  let allRingsPassed = levelType !== 'rings' || ringsCollected >= ringsRequired;
  if (currentLevelData && currentLevelData.boss === 'kraken' && !krakenDefeated) {
    allRingsPassed = false;
  }
  const pulse = 1 + Math.sin(t * 2) * 0.08;

  const grad = ctx.createRadialGradient(finish.x, finish.y, finish.r * 0.3, finish.x, finish.y, finish.r * 2);
  if (allRingsPassed) {
    grad.addColorStop(0, 'rgba(255, 210, 100, 0.4)');
    grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
  } else {
    grad.addColorStop(0, 'rgba(120, 120, 120, 0.3)');
    grad.addColorStop(1, 'rgba(80, 80, 80, 0)');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * 1.1, 0, Math.PI * 2);
  ctx.strokeStyle = allRingsPassed ? '#d4a259' : '#5a5a5a';
  ctx.lineWidth = 8 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = allRingsPassed ? 'rgba(110, 231, 135, 0.3)' : 'rgba(80, 80, 80, 0.3)';
  ctx.fill();
  ctx.strokeStyle = allRingsPassed ? '#ffd166' : '#5a5a5a';
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();

  ctx.fillStyle = allRingsPassed ? '#ffd166' : '#7a7a7a';
  ctx.font = `bold ${11 / zoom}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(allRingsPassed ? 'ХРАМ' : '🔒', finish.x, finish.y);
}

function drawSub() {
  const t = sub.animTime;
  const invulnBlink = sub.invuln > 0 && Math.floor(sub.invuln * 20) % 2 === 0;
  const breath = 1 + Math.sin(t * 2.2) * 0.03;

  ctx.save();
  ctx.translate(sub.x, sub.y);
  ctx.rotate(sub.angle);
  ctx.scale(breath, breath);

  ctx.beginPath();
  ctx.ellipse(0, sub.r * 0.6, sub.r * 1.6, sub.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  ctx.save();
  ctx.translate(-sub.r * 1.7, 0);
  ctx.rotate(sub.propellerAngle);
  ctx.fillStyle = '#a0c8ff';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(sub.r * 0.5, 0, sub.r * 0.45, sub.r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(-sub.r * 1.5, 0);
  ctx.lineTo(-sub.r * 1.2, -sub.r * 0.5);
  ctx.lineTo(-sub.r * 1.2, sub.r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#4f8cff';
  ctx.fill();

  const bg = ctx.createLinearGradient(0, -sub.r, 0, sub.r);
  bg.addColorStop(0, inContact ? '#ff8a8a' : (invulnBlink ? '#ffffff' : '#a4dfff'));
  bg.addColorStop(0.5, inContact ? '#ff6b6b' : (invulnBlink ? '#ffffff' : '#7fd6ff'));
  bg.addColorStop(1, inContact ? '#c94a4a' : (invulnBlink ? '#dddddd' : '#4a9edb'));

  ctx.beginPath();
  ctx.ellipse(0, 0, sub.r * 1.5, sub.r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = '#0b1a2a';
  ctx.lineWidth = 2 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sub.r * 0.25, 0, sub.r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11, 26, 42, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 220, 255, 0.7)';
  ctx.lineWidth = 1.2 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sub.r * 0.25, 0, sub.r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(160, 220, 255, 0.55)';
  ctx.fill();

  const lightOn = Math.sin(t * 6) > 0;
  ctx.beginPath();
  ctx.arc(sub.r * 0.25, -sub.r * 0.5, sub.r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = lightOn ? '#ffe066' : '#806020';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(sub.r * 1.5, 0);
  ctx.lineTo(sub.r * 1.1, -sub.r * 0.4);
  ctx.lineTo(sub.r * 1.1, sub.r * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#eaf6ff';
  ctx.fill();

  ctx.restore();
}

function drawFish(f) {
  if (f.type === 'angler') drawAnglerFish(f);
  else drawNormalFish(f);

  if (f.frozen > 0) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.globalAlpha = 0.75;

    ctx.beginPath();
    ctx.moveTo(-f.r * 1.3, -f.r * 1.1);
    ctx.lineTo(f.r * 1.3, -f.r * 1.1);
    ctx.lineTo(f.r * 1.5, 0);
    ctx.lineTo(f.r * 1.3, f.r * 1.1);
    ctx.lineTo(-f.r * 1.3, f.r * 1.1);
    ctx.lineTo(-f.r * 1.5, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(150, 230, 255, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-f.r * 0.8, -f.r * 0.6);
    ctx.lineTo(-f.r * 0.3, -f.r * 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3 / zoom;
    ctx.stroke();

    ctx.restore();
  }
}

function drawNormalFish(f) {
  const dir = f.dir >= 0 ? 1 : -1;
  const tailWag = Math.sin(f.tailPhase) * 0.5;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);
  ctx.beginPath();
  ctx.ellipse(0, 0, f.r * 1.4, f.r * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c17a5a';
  ctx.fill();
  ctx.strokeStyle = '#7a4a2a';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();
  ctx.save();
  ctx.translate(-f.r * 1.3, 0);
  ctx.rotate(tailWag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-f.r * 0.8, -f.r * 0.7);
  ctx.lineTo(-f.r * 0.8, f.r * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#c17a5a';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(f.r * 0.7, -f.r * 0.2, f.r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e0c8';
  ctx.fill();
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 0.8 / zoom;
  ctx.stroke();
  ctx.restore();
}

function drawAnglerFish(f) {
  const dir = f.dir >= 0 ? 1 : -1;
  const tailWag = Math.sin(f.tailPhase) * 0.5;
  const lurePulse = 0.7 + Math.sin(f.anglerPhase) * 0.3;
  const mouthOpen = 0.3 + Math.abs(Math.sin(f.mouthPhase)) * 0.7;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);

  if (qualityLevel !== 'low') {
    const lightGlow = ctx.createRadialGradient(f.r * 0.8, -f.r * 1.2, 2, f.r * 0.8, -f.r * 1.2, f.r * 5);
    lightGlow.addColorStop(0, `rgba(255, 240, 180, ${0.35 * lurePulse})`);
    lightGlow.addColorStop(0.5, `rgba(255, 220, 130, ${0.12 * lurePulse})`);
    lightGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.arc(f.r * 0.8, -f.r * 1.2, f.r * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, f.r * 1.5, f.r * 1.0, 0, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.3, 2, 0, 0, f.r * 1.5);
  bodyGrad.addColorStop(0, '#3a2040');
  bodyGrad.addColorStop(1, '#0a0510');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();

  ctx.save();
  ctx.translate(-f.r * 1.4, 0);
  ctx.rotate(tailWag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-f.r * 0.9, -f.r * 0.8);
  ctx.lineTo(-f.r * 0.6, 0);
  ctx.lineTo(-f.r * 0.9, f.r * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#2a1030';
  ctx.fill();
  ctx.strokeStyle = '#0a0510';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#1a0010';
  ctx.beginPath();
  ctx.moveTo(f.r * 0.6, 0);
  ctx.lineTo(f.r * 1.6, -f.r * 0.4 * mouthOpen);
  ctx.lineTo(f.r * 1.7, 0);
  ctx.lineTo(f.r * 1.6, f.r * 0.4 * mouthOpen);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 5; i++) {
    const tx = f.r * 0.7 + i * f.r * 0.2;
    ctx.beginPath();
    ctx.moveTo(tx, -f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.08, -f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.04, f.r * 0.15 * mouthOpen);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.08, f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.04, -f.r * 0.15 * mouthOpen);
    ctx.closePath();
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(f.r * 0.4, -f.r * 0.3, f.r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc00';
  ctx.fill();
  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(f.r * 0.45, -f.r * 0.3, f.r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.beginPath();
  ctx.moveTo(f.r * 0.5, -f.r * 0.6);
  ctx.quadraticCurveTo(f.r * 0.9, -f.r * 1.6, f.r * 0.9, -f.r * 2.0);
  ctx.stroke();

  const lureX = f.r * 0.9;
  const lureY = -f.r * 2.0;
  const lureR = f.r * 0.22 * (0.8 + lurePulse * 0.4);

  const lureGlow = ctx.createRadialGradient(lureX, lureY, 1, lureX, lureY, lureR * 4);
  lureGlow.addColorStop(0, `rgba(255, 250, 200, ${0.9 * lurePulse})`);
  lureGlow.addColorStop(0.3, `rgba(255, 220, 130, ${0.5 * lurePulse})`);
  lureGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = lureGlow;
  ctx.beginPath();
  ctx.arc(lureX, lureY, lureR * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lureX, lureY, lureR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 250, 220, 0.9)`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 130, 0.9)';
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  ctx.restore();
}

// ================================================================
//  НОВЫЕ ЭЛЕМЕНТЫ (Торпеды и Лебедка)
// ================================================================
function drawTorpedo(t) {
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -3);
  ctx.lineTo(-6, 3);
  ctx.closePath();
  ctx.fillStyle = '#7fd6ff';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-14 - Math.random() * 4, 0);
  ctx.lineTo(-6, 2);
  ctx.fillStyle = 'rgba(180, 235, 255, 0.8)';
  ctx.fill();
  
  ctx.restore();
}

function drawWinch() {
  const hx = winchHook.x;
  const hy = winchHook.y;
  
  ctx.beginPath();
  ctx.moveTo(sub.x, sub.y);
  ctx.lineTo(hx, hy);
  ctx.strokeStyle = 'rgba(160, 200, 220, 0.8)';
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  if (winchState === 'shooting') {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(sub.angle);
    ctx.beginPath();
    ctx.moveTo(10 / zoom, 0);
    ctx.lineTo(-5 / zoom, -3 / zoom);
    ctx.lineTo(-5 / zoom, 3 / zoom);
    ctx.closePath();
    ctx.fillStyle = '#eaf6ff';
    ctx.fill();
    ctx.restore();
  } else if (winchState === 'pulling') {
    ctx.beginPath();
    ctx.arc(hx, hy, 15 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 130, 0.4)';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(a) * 15 / zoom, hy + Math.sin(a) * 15 / zoom);
      ctx.stroke();
    }
  }
}

// ================================================================
//  🐙 КРАКЕН


// ================================================================
// Безопасная покраска картинки (без захвата фона)
const tintCanvas = document.createElement('canvas');
const tintCtx = tintCanvas.getContext('2d');

function drawTintedImage(img, x, y, w, h, color) {
  if (!img.complete || img.naturalWidth === 0) return;
  tintCanvas.width = w;
  tintCanvas.height = h;
  tintCtx.clearRect(0, 0, w, h);
  tintCtx.drawImage(img, 0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-in';
  tintCtx.fillStyle = color;
  tintCtx.fillRect(0, 0, w, h);
  tintCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintCanvas, x, y);
}


function drawKraken() {
  const t = sub.animTime;
  const flash = krakenDamageFlash > 0 && Math.floor(krakenDamageFlash * 20) % 2 === 0 && !krakenDefeated;
  const isIce = (typeof krakenFlashType !== 'undefined') && krakenFlashType === 'ice';
  const headR = krakenPos.r;

  const wakeT = (typeof krakenWakeT !== 'undefined') ? krakenWakeT : 1;
  const sleeping = !krakenActive && !krakenDefeated;
  const frozen = krakenDefeated;
  const sinkT = (typeof krakenSinkT !== 'undefined') ? krakenSinkT : (frozen ? 1 : 0);

  const headPos = getKrakenHeadPos();
  const headX = headPos.x;
  const headY = headPos.y;

  let openAmt = 1;
  if (sleeping) openAmt = 0;
  else if (frozen) openAmt = Math.max(0, 1 - sinkT * 2);
  else openAmt = Math.min(1, wakeT);

  let eyeMult = 1;
  if (typeof krakenBlinkT !== 'undefined' && krakenBlinkT > 0) {
    eyeMult = Math.abs((krakenBlinkT - 0.15) / 0.15);
    if (eyeMult > 1) eyeMult = 1;
  }
  if (typeof krakenSquintT !== 'undefined' && krakenSquintT > 0) {
    const squintFactor = 0.4 + 0.6 * (1 - krakenSquintT / 0.8);
    eyeMult = Math.min(eyeMult, squintFactor);
  }
  const eyeHeightMult = openAmt * eyeMult;
  const breath = sleeping ? (1 + Math.sin(t * 0.9) * 0.03) : 1;

  // Тень на дне
  ctx.beginPath();
  ctx.ellipse(krakenPos.x, FLOOR_Y, headR * 1.3, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // 1. ЩУПАЛЬЦА
  const baseY = headY + headR * 0.6;
  const headHeightAboveFloor = FLOOR_Y - headY;
  const spreadFactor = Math.min(1, Math.max(0, headHeightAboveFloor / 400));
  
  for (let i = 0; i < 8; i++) {
    const ang = Math.PI / 2 + ((i - 3.5) / 3.5) * 1.4;
    const still = frozen || sleeping;
    const sway = still ? 0 : Math.sin(t * 2 + i) * 15;
    const effLen = 50 + 150 * spreadFactor;
    const ex = krakenPos.x + Math.cos(ang) * effLen * 0.8 + sway;
    const ey = FLOOR_Y;
    const cx = krakenPos.x + Math.cos(ang) * effLen * 0.4;
    const cy = baseY + effLen * 0.55;

    let tentacleColor = '#6a1040';
    let tentacleDark = 'rgba(30, 0, 20, 0.5)';
    if (frozen) {
      tentacleColor = '#3a6a90';
      tentacleDark = 'rgba(20, 40, 60, 0.5)';
    } else if (sleeping) {
      tentacleColor = '#4a1838';
      tentacleDark = 'rgba(20, 0, 15, 0.4)';
    }

    ctx.beginPath();
    ctx.moveTo(headX + Math.cos(ang) * 15, baseY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.strokeStyle = tentacleColor;
    ctx.lineWidth = 12 / zoom;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(headX + Math.cos(ang) * 15, baseY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.strokeStyle = tentacleDark;
    ctx.lineWidth = 5 / zoom;
    ctx.stroke();
  }

  // ============================================================
    // ============================================================
    // ============================================================
  // 2. СЛОИ ГОЛОВЫ
  // ============================================================
  ctx.save();
  ctx.translate(headX, headY);
  ctx.scale(breath, breath);

  const drawW = headR * 2.6; 
  const drawH = headR * 2.6;
  const offsetX = -drawW / 2;
  const offsetY = -drawH / 2;

  // 2.1 Сама голова
  if (svgKrakenHead.complete && svgKrakenHead.naturalWidth > 0) {
    // 1. Всегда рисуем нормальную (непрозрачную) голову
    ctx.drawImage(svgKrakenHead, offsetX, offsetY, drawW, drawH);
    
    // 2. Если есть вспышка урона — накладываем цветной слой ПОВЕРХ неё
    if (flash && !frozen) {
      drawTintedImage(
        svgKrakenHead, 
        offsetX, offsetY, drawW, drawH, 
        isIce ? 'rgba(200, 240, 255, 0.6)' : 'rgba(255, 100, 100, 0.5)'
      );
    }
  }

  // 2.2 Белок глаза и Зрачки
  const eyeY = -headR * 0.1;
  const eyeOffsetX = headR * 0.42;

  if (eyeHeightMult > 0.05) {
    if (svgKrakenEye.complete && svgKrakenEye.naturalWidth > 0) {
      ctx.drawImage(svgKrakenEye, offsetX, offsetY, drawW, drawH);
    }

    if (svgKrakenPupilLeft.complete && svgKrakenPupilLeft.naturalWidth > 0) {
      const eyeAngL = Math.atan2(sub.y - (headY + eyeY), sub.x - (headX - eyeOffsetX));
      const pTrackXL = Math.cos(eyeAngL) * headR * 0.05 * eyeHeightMult;
      const pTrackYL = Math.sin(eyeAngL) * headR * 0.05 * eyeHeightMult;
      ctx.drawImage(svgKrakenPupilLeft, offsetX + pTrackXL, offsetY + pTrackYL, drawW, drawH);
    }

    if (svgKrakenPupilRight.complete && svgKrakenPupilRight.naturalWidth > 0) {
      const eyeAngR = Math.atan2(sub.y - (headY + eyeY), sub.x - (headX + eyeOffsetX));
      const pTrackXR = Math.cos(eyeAngR) * headR * 0.05 * eyeHeightMult;
      const pTrackYR = Math.sin(eyeAngR) * headR * 0.05 * eyeHeightMult;
      ctx.drawImage(svgKrakenPupilRight, offsetX + pTrackXR, offsetY + pTrackYR, drawW, drawH);
    }
  }

  // 2.3 Веки
  if (svgKrakenEyelid.complete && svgKrakenEyelid.naturalWidth > 0) {
    const lidShift = (1 - eyeHeightMult) * (headR * 0.15);
    ctx.drawImage(svgKrakenEyelid, offsetX, offsetY + lidShift, drawW, drawH);
  }

   // 2.4 Рот с зубами (Всегда почти открыт, чуть расширяется при атаке)
  if (svgKrakenMouth.complete && svgKrakenMouth.naturalWidth > 0) {
    
    let mouthOpen = 0.75; // Базовое состояние — рот приоткрыт на 75%
    
    if (frozen) {
      // При заморозке рот плавно закрывается
      mouthOpen = 0.75 * Math.max(0, 1 - sinkT * 2);
    } else if (sleeping) {
      // Спящий — рот закрыт
      mouthOpen = 0;
    } else {
      // Проснулся — рот приоткрыт
      const baseMouth = Math.min(1, wakeT) * 0.75;
      
      // При атаке — чуть шире (до 100%)
      let attackMouth = 0;
      if (typeof krakenSquintT !== 'undefined' && krakenSquintT > 0) {
        // Плавно от 0.75 до 1.0
        attackMouth = 0.75 + Math.min(1, krakenSquintT / 0.3) * 0.25;
      }
      
      mouthOpen = Math.max(baseMouth, attackMouth);
    }
    
    if (mouthOpen > 0.02) {
      ctx.save();
      
      const mouthY_in_SVG = 0.867; 
      const mouthOffsetY = (mouthY_in_SVG - 0.5) * drawH;
      ctx.translate(0, mouthOffsetY);
      
      // Растяжение всего в 1.33 раза (0.75 → 1.0) — это едва заметно
      ctx.scale(1, Math.max(0.02, mouthOpen));
      
      ctx.drawImage(
        svgKrakenMouth, 
        -drawW / 2, 
        -mouthY_in_SVG * drawH, 
        drawW, drawH
      );
      
      ctx.restore();
    }
  }

    // 2.5 ЛЕДЯНОЙ ПАНЦИРЬ + СФЕРА (при победе)
  if (frozen) {
    const iceAlpha = Math.min(1, sinkT * 1.5);
    
    // 1. Сначала красим саму голову в ледяной цвет (как раньше)
    drawTintedImage(svgKrakenHead, offsetX, offsetY, drawW, drawH, `rgba(180, 235, 255, ${0.5 * iceAlpha})`);
    
    // 2. Рисуем ледяную сферу вокруг головы (с чётким кантом)
    if (iceAlpha > 0.05) {
      const sphereR = headR * 1.4;
      
      // --- Заливка сферы (объёмный градиент) ---
      const sphereGrad = ctx.createRadialGradient(
        -sphereR * 0.35, -sphereR * 0.35, sphereR * 0.1,  // центр блика (сверху-слева)
        0, 0, sphereR                                       // внешний радиус
      );
      sphereGrad.addColorStop(0, `rgba(230, 250, 255, ${0.2 * iceAlpha})`);
      sphereGrad.addColorStop(0.6, `rgba(150, 215, 245, ${0.25 * iceAlpha})`);
      sphereGrad.addColorStop(1, `rgba(90, 170, 210, ${0.45 * iceAlpha})`);
      
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      
      // --- Чёткий внешний кант (белый) ---
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * iceAlpha})`;
      ctx.lineWidth = 4 / zoom;
      ctx.stroke();
      
      // --- Внутренний голубой кант (для объёма) ---
      ctx.beginPath();
      ctx.arc(0, 0, sphereR * 0.92, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150, 225, 255, ${0.55 * iceAlpha})`;
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      
      // --- Блик сверху-слева (эффект стекла/льда) ---
      const hlGrad = ctx.createRadialGradient(
        -sphereR * 0.45, -sphereR * 0.45, 1,
        -sphereR * 0.45, -sphereR * 0.45, sphereR * 0.45
      );
      hlGrad.addColorStop(0, `rgba(255, 255, 255, ${0.65 * iceAlpha})`);
      hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(-sphereR * 0.45, -sphereR * 0.45, sphereR * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = hlGrad;
      ctx.fill();
      
      // --- Маленький блик внизу-справа (контровой) ---
      const hl2Grad = ctx.createRadialGradient(
        sphereR * 0.5, sphereR * 0.5, 1,
        sphereR * 0.5, sphereR * 0.5, sphereR * 0.25
      );
      hl2Grad.addColorStop(0, `rgba(200, 240, 255, ${0.4 * iceAlpha})`);
      hl2Grad.addColorStop(1, 'rgba(200, 240, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(sphereR * 0.5, sphereR * 0.5, sphereR * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = hl2Grad;
      ctx.fill();
    }
  }

  ctx.restore(); // Конец отрисовки головы

 



  // Zzz над спящим
  if (sleeping) {
    for (let i = 0; i < 3; i++) {
      const zt = (t * 0.55 + i * 0.85) % 2.5;
      if (zt > 2.3) continue;
      const zx = headX + headR * 0.8 + Math.sin(t * 1.3 + i * 2) * 18;
      const zy = headY - headR * 1.1 - zt * 55;
      const zAlpha = Math.max(0, 1 - zt / 2.3);
      ctx.font = `bold ${Math.round(headR * 0.18 + i * headR * 0.05)}px monospace`;
      ctx.fillStyle = `rgba(127, 214, 255, ${zAlpha * 0.85})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('z', zx, zy);
    }
  }
}


function drawTentacle(tent) {
  if (tent.height < 1) return;

  const sway = Math.sin(tent.life * 4 + tent.phase) * 20;
  const baseX = tent.x;
  const baseY = FLOOR_Y;
  const tipX = baseX + sway;
  const tipY = baseY - tent.height;

  const glow = ctx.createRadialGradient(baseX, baseY, 5, baseX, baseY, tent.height);
  glow.addColorStop(0, 'rgba(180, 30, 60, 0.35)');
  glow.addColorStop(1, 'rgba(60, 10, 30, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(baseX, baseY, tent.height, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(baseX - tent.width, baseY);
  ctx.quadraticCurveTo(baseX - tent.width * 0.5, baseY - tent.height * 0.5, tipX - 4, tipY);
  ctx.lineTo(tipX + 4, tipY);
  ctx.quadraticCurveTo(baseX + tent.width * 0.5, baseY - tent.height * 0.5, baseX + tent.width, baseY);
  ctx.closePath();
  ctx.fillStyle = '#6a1040';
  ctx.fill();
  ctx.strokeStyle = '#1a0510';
  ctx.lineWidth = 2 / zoom;
  ctx.stroke();

  for (let i = 1; i <= 5; i++) {
    const tt = i / 6;
    const px = baseX + (tipX - baseX) * tt;
    const py = baseY + (tipY - baseY) * tt;
    ctx.beginPath();
    ctx.arc(px, py, 3 + (1 - tt) * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b8a';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ff3366';
  ctx.fill();
}

function drawInkCloud(c) {
  const alpha = Math.min(1, c.life / 1.0);
  const grad = ctx.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
  grad.addColorStop(0, `rgba(10, 0, 20, ${0.85 * alpha})`);
  grad.addColorStop(0.6, `rgba(20, 5, 30, ${0.6 * alpha})`);
  grad.addColorStop(1, 'rgba(20, 5, 30, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + c.life;
    const bx = c.x + Math.cos(a) * c.r * 0.5;
    const by = c.y + Math.sin(a) * c.r * 0.5;
    ctx.beginPath();
    ctx.arc(bx, by, c.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30, 10, 40, ${0.5 * alpha})`;
    ctx.fill();
  }
}
function drawTentacleWarning(w) {
  const k = w.life / w.delay;
  const baseY = FLOOR_Y - 4;

  // 1. Зона опасности на полу (пульсирующая)
  const zoneR = 22 + k * 42;
  ctx.beginPath();
  ctx.ellipse(w.x, baseY, zoneR, zoneR * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.25 + Math.sin(w.life * 30) * 0.15})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 100, 100, ${0.75 * (1 - k * 0.3)})`;
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();

  // 2. Сгусток пузырьков летит вверх
  const clumpY = baseY - k * 480;
  for (let i = 0; i < 10; i++) {
    const offX = Math.sin(i * 7.3 + w.life * 15) * 22;
    const offY = Math.cos(i * 7.3) * 12;
    const bx = w.x + offX;
    const by = clumpY + offY;
    const br = 5 + Math.sin(i * 1.7 + w.life * 20) * 2;
    const alpha = (0.95 - k * 0.4);

    const bgrad = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
    bgrad.addColorStop(0, `rgba(230, 248, 255, ${alpha})`);
    bgrad.addColorStop(0.7, `rgba(140, 210, 240, ${alpha * 0.8})`);
    bgrad.addColorStop(1, `rgba(80, 160, 200, ${alpha * 0.4})`);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = bgrad;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
  }

  // 3. Пузырьковый хвост внизу
  for (let i = 0; i < 6; i++) {
    const trailY = clumpY + 40 + i * 22;
    if (trailY > baseY) continue;
    const bx = w.x + Math.sin(i * 3.3 + w.life * 12) * 18;
    const br = 4 - i * 0.4;
    const alpha = (0.7 - i * 0.08) * (0.95 - k * 0.4);
    ctx.beginPath();
    ctx.arc(bx, trailY, br, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 235, 255, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
    ctx.lineWidth = 0.8 / zoom;
    ctx.stroke();
  }
}

// ================================================================
//  ПРОЦЕДУРНЫЕ ЭЛЕМЕНТЫ ДЛЯ СТЕН МАЙЯ
// ================================================================
function hashNoise(x, y, seed) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + (seed || 0) * 43.1) * 43758.5453;
  return n - Math.floor(n);
}

function drawMayanGlyphToCtx(c, x, y, size, seed) {
  const r1 = hashNoise(x, y, seed);
  const r2 = hashNoise(x + 100, y + 50, seed);
  const r3 = hashNoise(x + 200, y + 100, seed);

  c.strokeStyle = 'rgba(60, 30, 15, 0.55)';
  c.fillStyle = 'rgba(60, 30, 15, 0.45)';
  c.lineWidth = 1.2;

  c.strokeRect(x - size * 0.35, y - size * 0.35, size * 0.7, size * 0.7);

  const pattern = Math.floor(r1 * 4);

  if (pattern === 0) {
    c.beginPath(); c.arc(x, y, size * 0.08, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(x - size * 0.25, y + size * 0.15); c.lineTo(x + size * 0.25, y + size * 0.15); c.stroke();
  } else if (pattern === 1) {
    c.beginPath(); c.moveTo(x - size * 0.25, y); c.lineTo(x + size * 0.25, y);
    c.moveTo(x, y - size * 0.25); c.lineTo(x, y + size * 0.25); c.stroke();
  } else if (pattern === 2) {
    c.beginPath(); c.arc(x, y, size * 0.2, 0, Math.PI * 1.4); c.stroke();
    c.beginPath(); c.arc(x + size * 0.05, y + size * 0.05, size * 0.08, 0, Math.PI * 2); c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x - size * 0.18, y - size * 0.2); c.lineTo(x - size * 0.18, y + size * 0.2);
    c.moveTo(x, y - size * 0.2); c.lineTo(x, y + size * 0.2);
    c.moveTo(x + size * 0.18, y - size * 0.2); c.lineTo(x + size * 0.18, y + size * 0.2);
    c.stroke();
  }

  if (r2 > 0.6) {
    c.beginPath();
    c.arc(x + (r3 - 0.5) * size * 0.3, y + (r2 - 0.5) * size * 0.3, size * 0.05, 0, Math.PI * 2);
    c.fill();
  }
}