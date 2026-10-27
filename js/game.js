// ================================================================
//  js/game.js — ЛОГИКА, ЦИКЛ, СТАТИСТИКА, ОТПРАВКА
//  Игра «Погружение» v4.2 (Кракен)
// ================================================================

// ---------- Ввод: мышь ----------
const mouse = { x: 0, y: 0, down: false, rightDown: false };

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  let nx = sx / zoom + camera.x;
  let ny = sy / zoom + camera.y;
  
  // Защита от битых координат
  if (!isFinite(nx) || isNaN(nx)) nx = sub.x + Math.cos(sub.angle) * 100;
  if (!isFinite(ny) || isNaN(ny)) ny = sub.y + Math.sin(sub.angle) * 100;
  
  mouse.x = nx;
  mouse.y = ny;

  if (e.button === 0) { // ЛКМ
    mouse.down = true; 
    e.preventDefault(); 
  }
  // (Остальной код для ПКМ и СКМ оставь как есть)
  if (e.button === 2) { // ПКМ (Лебедка)
    mouse.rightDown = true;
    if (started && !paused && inventory.winch && winchCooldown <= 0 && winchState === 'idle') {
      fireWinch();
    }
    e.preventDefault();
  }
  if (e.button === 1) { // СКМ (Прожектор)
    if (started && !paused && inventory.flashlight) {
      toggleFlashlight();
    }
    e.preventDefault();
  }
});

window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rightDown = false;
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  mouse.x = sx / zoom + camera.x;
  mouse.y = sy / zoom + camera.y;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Ввод: клавиатура ----------
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (started && !paused && inventory.torpedo && torpedoCooldown <= 0) {
      fireTorpedo();
    }
    e.preventDefault();
  }
  if (e.code === 'Escape' && started) {
    togglePause();
  }
  if ((e.code === 'KeyF' || e.code === 'KeyА') && started && !paused && inventory.flashlight) {
    toggleFlashlight();
  }
});

// ---------- Стик (Мобилка) ----------
const joystickBase = el('joystickBase');
const joystickKnob = el('joystickKnob');
const mobileControls = el('mobileControls');
const thrustButton = el('thrustButton');

const stick = { active: false, pointerId: null, cx: 0, cy: 0, dx: 0, dy: 0, maxRadius: 50 };

function stickStart(clientX, clientY, pointerId) {
  const r = joystickBase.getBoundingClientRect();
  stick.cx = r.left + r.width / 2;
  stick.cy = r.top + r.height / 2;
  stick.maxRadius = r.width * 0.32;
  stick.active = true;
  stick.pointerId = pointerId;
  joystickBase.classList.add('active');
  mobileControls.classList.add('active');
  stickMove(clientX, clientY);
}
function stickMove(clientX, clientY) {
  if (!stick.active) return;
  let dx = clientX - stick.cx, dy = clientY - stick.cy;
  const len = Math.hypot(dx, dy);
  if (len > stick.maxRadius) {
    dx = dx / len * stick.maxRadius;
    dy = dy / len * stick.maxRadius;
  }
  stick.dx = dx / stick.maxRadius;
  stick.dy = dy / stick.maxRadius;
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}
function stickEnd() {
  stick.active = false;
  stick.pointerId = null;
  stick.dx = 0; stick.dy = 0;
  joystickBase.classList.remove('active');
  mobileControls.classList.remove('active');
  joystickKnob.style.transform = '';
}

joystickBase.addEventListener('pointerdown', e => {
  if (typeof isEditMode !== 'undefined' && isEditMode) return;
  e.preventDefault();
  joystickBase.setPointerCapture(e.pointerId);
  stickStart(e.clientX, e.clientY, e.pointerId);
});
joystickBase.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.pointerId) return;
  e.preventDefault();
  stickMove(e.clientX, e.clientY);
});
joystickBase.addEventListener('pointerup', e => {
  if (e.pointerId !== stick.pointerId) return;
  stickEnd();
});
joystickBase.addEventListener('pointercancel', e => {
  if (e.pointerId !== stick.pointerId) return;
  stickEnd();
});

// ---------- Мотор (Мобилка) ----------
const thrustBtn = el('thrustBtn');
const thrust = { pressed: false, pointerId: null };

function thrustDown(pointerId) {
  thrust.pressed = true;
  thrust.pointerId = pointerId;
  thrustBtn.classList.add('active');
  thrustButton.classList.add('active');
  if (isWaiting) startActualRun();
}
function thrustUp() {
  thrust.pressed = false;
  thrust.pointerId = null;
  thrustBtn.classList.remove('active');
  thrustButton.classList.remove('active');
}

thrustBtn.addEventListener('pointerdown', e => {
  if (typeof isEditMode !== 'undefined' && isEditMode) return;
  e.preventDefault();
  thrustBtn.setPointerCapture(e.pointerId);
  thrustDown(e.pointerId);
});
thrustBtn.addEventListener('pointerup', e => {
  if (e.pointerId !== thrust.pointerId) return;
  thrustUp();
});
thrustBtn.addEventListener('pointercancel', e => {
  if (e.pointerId !== thrust.pointerId) return;
  thrustUp();
});

// ---------- Кнопки артефактов на мобилке ----------
const mobWinchBtn = el('mobWinchBtn');
const mobFlashBtn = el('mobFlashBtn');
const mobTorpedoBtn = el('mobTorpedoBtn');

if (mobWinchBtn) {
  mobWinchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (inventory.winch && winchCooldown <= 0 && winchState === 'idle') fireWinch();
  });
}
if (mobFlashBtn) {
  mobFlashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (inventory.flashlight) toggleFlashlight();
  });
}
if (mobTorpedoBtn) {
  mobTorpedoBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (inventory.torpedo && torpedoCooldown <= 0) fireTorpedo();
  });
}

// ---------- Геометрия ----------
const WALL_THICKNESS = 22; 

function circleVsSegment(cx, cy, r, x1, y1, x2, y2) {
  const halfT = WALL_THICKNESS / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const vx = cx - x1, vy = cy - y1;
  let t = vx * ux + vy * uy;
  let s = vx * (-uy) + vy * ux;
  if (t < 0) t = 0;
  if (t > len) t = len;
  if (s < -halfT) s = -halfT;
  if (s > halfT) s = halfT;
  const closestX = x1 + ux * t - uy * s;
  const closestY = y1 + uy * t + ux * s;
  const ddx = cx - closestX, ddy = cy - closestY;
  const dist2 = ddx * ddx + ddy * ddy;
  if (dist2 < r * r) {
    const dist = Math.sqrt(dist2);
    let nx = 1, ny = 1;
    if (dist > 0.001) {
      nx = ddx / dist;
      ny = ddy / dist;
    } else {
      nx = ddx > 0 ? 1 : -1;
      ny = ddy > 0 ? 1 : -1;
    }
    return { hit: true, nx, ny, px: closestX, py: closestY, depth: r - dist };
  }
  return { hit: false };
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------- Обновление мира ----------
function updateWorldFromLevel(data) {
  WORLD_W = data.worldW || 3200;
  WORLD_H = data.worldH || 1100;
  FLOOR_Y = data.floorY || 1060;

  walls = (data.walls || []).slice();
  finish = data.finish || { x: 3080, y: 120, r: 30 };

  rings = (data.rings || []).map((r, i) => ({
    x: r.x, y: r.y, r: r.r || 45, id: r.id || i + 1, passed: false
  }));
  ringsRequired = data.ringsRequired || rings.length;
  levelType = data.levelType || 'maze';
  levelIsDark = data.isDark || false;

  levelBgColor = data.bgColor || '#1a3a58';
  levelGridColor = data.gridColor || 'rgba(30, 58, 85, 0.18)';
  levelFloorColor = data.floorColor || '#2e4a2e';
  levelFloorTopColor = data.floorTopColor || '#6b8e5a';
  levelHillColor = data.hillColor || '#3f6039';
  levelWaterTint = data.waterTint || 'rgba(100, 180, 255, 0.04)';

  if (data.maxThrust) sub.maxThrust = data.maxThrust;
  if (data.thrustAccel) sub.thrustAccel = data.thrustAccel;
  if (data.maxAngVel) sub.maxAngVel = data.maxAngVel;
  if (data.angAccel) sub.angAccel = data.angAccel;
  if (data.fallBlend) sub.fallBlend = data.fallBlend;

  fishes.length = 0;
    (data.fishes || []).forEach(f => {
    fishes.push({
      x: f.x, y: f.y, r: f.r || 14,
      vx: f.vx || 30, vy: f.vy || 15,
      type: f.type || 'normal',
      wiggle: Math.random() * Math.PI * 2,
      dir: f.vx >= 0 ? 1 : -1,
      tailPhase: Math.random() * Math.PI * 2,
      anglerPhase: Math.random() * Math.PI * 2,
      mouthPhase: Math.random() * Math.PI * 2,
      frozen: 0
    });
  });

  // Выбираем старт в зависимости от того, кто мы
  if (currentLevel === 'PVP' && typeof amIPlayer1 !== 'undefined' && !amIPlayer1 && data.start2) {
    sub.x = data.start2.x;
    sub.y = data.start2.y;
    sub.angle = Math.PI; // Смотрим влево
  } else {
    sub.x = data.start ? data.start.x : 100;
    sub.y = data.start ? data.start.y : 980;
    sub.angle = 0;
  }
  sub.vx = 0; sub.vy = 0;
  sub.angVel = 0;
  sub.hp = MAX_HP; sub.invuln = 0;
  sub.animTime = 0; sub.propellerAngle = 0; sub.bubbleTimer = 0;

  currentRingIndex = 0;
  ringsCollected = 0;

  // Сброс артефактов
  winchState = 'idle';
  winchCooldown = 0;
  torpedoCooldown = 0;
  torpedoes = [];
  energy = MAX_ENERGY;
  flashlightOn = false;

  updateZoom();
  updateCamera();
}

// ---------- Механики артефактов ----------
function fireWinch() {
  const fx = Math.cos(sub.angle);
  const fy = Math.sin(sub.angle);
  const WINCH_RANGE = 200;
  const rawX = sub.x + fx * WINCH_RANGE;
  const rawY = sub.y + fy * WINCH_RANGE;

  let targetX = rawX;
  let targetY = rawY;
  let hitBoss = false;

   // Ищем стену и Кракена по пути
  const wallHit = raycastWall(sub.x, sub.y, rawX, rawY, 5);
  let bossHit = null;
  if (currentLevelData && currentLevelData.boss === 'kraken' && !krakenDefeated) {
    if (typeof isPointInKraken === 'function') {
      const dxr = rawX - sub.x, dyr = rawY - sub.y;
      const lenr = Math.hypot(dxr, dyr);
      const steps = Math.ceil(lenr / 6);
      for (let i = 1; i <= steps; i++) {
        const tt = i / steps;
        const px = sub.x + dxr * tt;
        const py = sub.y + dyr * tt;
        if (isPointInKraken(px, py)) {
          bossHit = { x: px, y: py, t: tt };
          break;
        }
      }
    }
  }

  // Берём то, что ближе
  const wallT = wallHit ? wallHit.t : Infinity;
  const bossT = bossHit ? bossHit.t : Infinity;

  if (bossT < wallT) {
    targetX = bossHit.x;
    targetY = bossHit.y;
    hitBoss = true;
  } else if (wallHit) {
    // Ставим крюк чуть перед стеной
    targetX = wallHit.x - fx * 6;
    targetY = wallHit.y - fy * 6;
  }

  winchState = 'shooting';
  winchHook.originX = sub.x;
  winchHook.originY = sub.y;
  winchHook.x = sub.x;
  winchHook.y = sub.y;
  winchHook.targetX = targetX;
  winchHook.targetY = targetY;
  winchHook.hitBoss = hitBoss;
  winchHook.pullTime = 0;
  winchHook.t = 0;
  soundRing();
  lastFirePos = { x: sub.x, y: sub.y };
  lastFireTime = elapsed;
}

function toggleFlashlight() {
  if (energy <= 0 && !flashlightOn) {
    showToast('⚡ Нет энергии!');
    return;
  }
  flashlightOn = !flashlightOn;
  soundRing(); // Щелчок
}

function fireTorpedo() {
  const fx = Math.cos(sub.angle);
  const fy = Math.sin(sub.angle);
  torpedoes.push({
    x: sub.x + fx * 20,
    y: sub.y + fy * 20,
    vx: fx * TORPEDO_SPEED,
    vy: fy * TORPEDO_SPEED,
    life: 2.0,
    angle: sub.angle
  });
  torpedoCooldown = TORPEDO_COOLDOWN_MAX;
  soundRing();
  lastFirePos = { x: sub.x, y: sub.y };
  lastFireTime = elapsed;

  // Отправка выстрела по сети
  if (currentLevel === 'PVP' && typeof mpSendShoot === 'function' && myRoomCode) {
    console.log('📡 1. КЛИЕНТ ОТПРАВИЛ ВЫСТРЕЛ НА СЕРВЕР');
    mpSendShoot(sub.x + fx * 20, sub.y + fy * 20, fx * TORPEDO_SPEED, fy * TORPEDO_SPEED, sub.angle);
  }
}

// ---------- Запуск уровня ----------
function startLevel(levelId) {
  if (typeof LEVELS === 'undefined' || !LEVELS[levelId]) {
    showToast('⚠️ Уровень ' + levelId + ' не найден');
    return;
  }
  
  // Принудительно будим аудио-контекст (из-за политики браузеров)
  if (typeof unlockAudio === 'function') {
    unlockAudio();
  }
  
  currentLevelData = LEVELS[levelId];
  updateWorldFromLevel(currentLevelData);
  prepareRun();
  showScreen(null);
  
  // Переключение музыки уровня
  if (gameMusic && musicEnabled) {
    const musicSrc = currentLevelData.music || 'music/menu.mp3';
    const source = gameMusic.querySelector('source');
    
    if (source) {
      const currentSrc = source.src || '';
      // Если трек отличается от того, что играет сейчас
      if (!currentSrc.includes(musicSrc)) {
        source.src = musicSrc;
        gameMusic.load();
      }
      
      gameMusic.volume = (AUDIO_SETTINGS.gameMusicVolume || 0.45) * (musicVolumeMultiplier ? musicVolumeMultiplier() : 1);
      
      gameMusic.play().catch(() => {
        console.warn('Браузер заблокировал музыку, ждем клика...');
      });
    }
  }
}

// ---------- Подготовка запуска ----------
function prepareRun() {
  sub.hp = MAX_HP;
  sub.invuln = 0;
  sub.animTime = 0;
  sub.propellerAngle = 0;
  sub.bubbleTimer = 0;

  wallHits = 0; wallContactTime = 0; inContact = false;
  wallDamage = 0; fishHits = 0; fishDamage = 0;
  collisionPoints = [];
  elapsed = 0; resultState = null;
  currentRun = null; scoreSent = false; paused = false;
  ringsCollected = 0;
  currentRingIndex = 0;
  missedRingWarning = false;
  finishBlockedWarning = false;
  sub.inkBlind = 0;

  krakenActive = false;
  krakenDefeated = false;
  krakenHp = 300;
  krakenMaxHp = 300;
  krakenPhase = 1;
  krakenAttackTimer = 0;
  krakenInkTimer = 0;
  krakenDamageFlash = 0;
  krakenFlashType = 'ice';
  krakenSinkT = 0;
  krakenWakeT = 0;
  
  krakenRiseT = 0;
  krakenBlinkT = 0;
  krakenSquintT = 0;
  if (currentLevelData && currentLevelData.bossPos) {
    krakenPos = { ...currentLevelData.bossPos };
  } else {
    krakenPos = { x: 2900, y: 550, r: 90 };
  }
  tentacles = [];
  inkClouds = [];
  tentacleWarnings = [];
  sub.tentacleInvuln = 0;
  const bb = el('bossbar');
  if (bb) bb.classList.add('hidden');

  ambientBubbles.length = 0;
  generateDecorations();

  mouse.down = false;
  mouse.x = sub.x + 100;
  mouse.y = sub.y;

  stickEnd(); thrustUp();

  updateZoom();
  updateCamera();
  lastTime = performance.now();
  started = true;
  running = true;
  
  // Ожидание старта
  isWaiting = true;
  const sh = el('startHint');
  if (sh) sh.classList.remove('hidden');

  // ⚡ ДЛЯ PVP СТАРТУЕМ СРАЗУ, БЕЗ НАЖАТИЯ ЛКМ
  if (currentLevel === 'PVP') {
    isWaiting = false;
    if (sh) sh.classList.add('hidden');
  }
  
  updateArtifactUI();
  updateMinimapVisibility();  // <--- ЭТА СТРОКА ДОЛЖНА БЫТЬ
  updateHud();
  checkOrientation();
    // Принудительно применяем сохранённый лэйаут при старте уровня
  if (typeof applyLayoutFromStorage === 'function') {
    applyLayoutFromStorage();
  }
}

function startActualRun() {
  isWaiting = false;
  const sh = el('startHint');
  if (sh) sh.classList.add('hidden');
}

function generateDecorations() {
  seaFloorHills = [];
  for (let x = 0; x < 3200; x += 180) {
    seaFloorHills.push({
      x: x + Math.random() * 80,
      r: 60 + Math.random() * 80,
      h: 20 + Math.random() * 30
    });
  }

  seaweeds = [];
  for (let x = 40; x < WORLD_W - 40; x += 90 + Math.random() * 60) {
    let tooClose = false;
    for (const w of walls) {
      if (w.x1 === w.x2 && Math.abs(w.x1 - x) < 40) { tooClose = true; break; }
    }
    if (tooClose) continue;

    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      seaweeds.push({
        x: x + (Math.random() - 0.5) * 40,
        baseY: FLOOR_Y + 6,
        height: 60 + Math.random() * 90,
        width: 6 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.7,
        color: Math.random() < 0.5 ? '#2e8b57' : '#3cb371'
      });
    }
  }
}

function updateAmbientBubbles(dt) {
  if (qualityLevel === 'low' && Math.random() > 0.4) {
    // меньше пузырьков
  } else if (Math.random() < 3 * dt) {
    ambientBubbles.push({
      x: camera.x + Math.random() * viewW(),
      y: FLOOR_Y - 10,
      r: 2 + Math.random() * 3,
      vy: -30 - Math.random() * 40,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      life: 0, maxLife: 6 + Math.random() * 4
    });
  }
  for (let i = ambientBubbles.length - 1; i >= 0; i--) {
    const b = ambientBubbles[i];
    b.life += dt; b.wobble += dt * b.wobbleSpeed;
    b.y += b.vy * dt; b.x += Math.sin(b.wobble) * 12 * dt;
    if (b.y < 30 || b.life > b.maxLife) ambientBubbles.splice(i, 1);
  }
  const maxBubbles = qualityLevel === 'low' ? 30 : (qualityLevel === 'medium' ? 60 : 100);
  if (ambientBubbles.length > maxBubbles) {
    ambientBubbles.splice(0, ambientBubbles.length - maxBubbles);
  }
}

function applyDamage(a, source) {
  sub.hp -= a;
  sub.invuln = 0.35;
  if (source === 'wall') soundWallHit();
  else if (source === 'fish') soundFishHit();
}

// ---------- Главный update ----------
function update(dt) {
  if (!running || !started || paused) return;
    // ==========================================
  // 🛡️ АНТИ-NaN БРОНЯ (Защита от телепортации)
  // ==========================================
  if (isNaN(sub.x) || !isFinite(sub.x)) sub.x = 100;
  if (isNaN(sub.y) || !isFinite(sub.y)) sub.y = 100;
  if (isNaN(sub.vx) || !isFinite(sub.vx)) sub.vx = 0;
  if (isNaN(sub.vy) || !isFinite(sub.vy)) sub.vy = 0;
  if (isNaN(sub.angle) || !isFinite(sub.angle)) sub.angle = 0;
  if (isNaN(sub.angVel) || !isFinite(sub.angVel)) sub.angVel = 0;
  
  if (isNaN(mouse.x) || !isFinite(mouse.x)) mouse.x = sub.x + 100;
  if (isNaN(mouse.y) || !isFinite(mouse.y)) mouse.y = sub.y;
  
  if (isNaN(camera.x) || !isFinite(camera.x)) camera.x = 0;
  if (isNaN(camera.y) || !isFinite(camera.y)) camera.y = 0;
  
  if (isNaN(winchHook.x) || isNaN(winchHook.y)) winchState = 'idle';
  // ==========================================
   const prevX = sub.x;
   const prevY = sub.y;
  
  // Если ждем старта — только анимация
  if (isWaiting) {
    sub.animTime += dt;
      // Если координаты лодки сломались — принудительно возвращаем её на старт
  if (isNaN(sub.x) || isNaN(sub.y) || sub.x < -100 || sub.y < -100) {
    sub.x = 100; 
    sub.y = 980;
    sub.vx = 0; 
    sub.vy = 0;
    sub.hp = 100; // На всякий случай
    showToast('⚠️ Координаты восстановлены');
  }
    if (!isTouch && mouse.down) startActualRun();
    if (isTouch && thrust.pressed) startActualRun();
    return; 
  }

  sub.animTime += dt;

  // Таймеры артефактов
  if (winchCooldown > 0) winchCooldown -= dt;
  if (torpedoCooldown > 0) torpedoCooldown -= dt;
  if (sub.inkBlind > 0) {
    sub.inkBlind -= dt;
    if (sub.inkBlind < 0) sub.inkBlind = 0;
  }
  if (sub.tentacleInvuln > 0) {
    sub.tentacleInvuln -= dt;
    if (sub.tentacleInvuln < 0) sub.tentacleInvuln = 0;
  }

  // Прожектор
  if (flashlightOn) {
    energy -= ENERGY_DRAIN * dt;
    if (energy <= 0) {
      energy = 0;
      flashlightOn = false;
      showToast('⚡ Энергия кончилась!');
    }
  } else {
    energy += ENERGY_REGEN * dt;
    if (energy > MAX_ENERGY) energy = MAX_ENERGY;
  }

  // Управление
  let targetAngle = null;
  if (isTouch && stick.active) {
    const len = Math.hypot(stick.dx, stick.dy);
    if (len > 0.15) targetAngle = Math.atan2(stick.dy, stick.dx);
  } else if (!isTouch) {
    const dxm = mouse.x - sub.x, dym = mouse.y - sub.y;
    if (Math.hypot(dxm, dym) > 30) targetAngle = Math.atan2(dym, dxm);
  }
  // Чернила: дрейф прицела
  if (targetAngle !== null && sub.inkBlind > 0) {
    targetAngle += (Math.random() - 0.5) * 0.5;
  }
  if (targetAngle !== null) {
    let diff = normAngle(targetAngle - sub.angle);
    const maxStep = sub.maxAngVel * dt;
    if (diff > maxStep) diff = maxStep;
    else if (diff < -maxStep) diff = -maxStep;
    sub.angVel += (diff / dt - sub.angVel) * sub.angAccel;
  } else {
    sub.angVel *= 0.92;
  }
  sub.angle = normAngle(sub.angle + sub.angVel * dt);

  // Движение и Лебедка
  const thrustOn = isTouch ? thrust.pressed : mouse.down;
  
  if (winchState === 'pulling') {
    winchHook.pullTime = (winchHook.pullTime || 0) + dt;
    const dx = winchHook.x - sub.x;
    const dy = winchHook.y - sub.y;
    const dist = Math.hypot(dx, dy);

    // Если дистанция стала NaN или бесконечной — сбрасываем лебедку
    if (isNaN(dist) || !isFinite(dist) || dist < 12 || winchHook.pullTime > 1.0) {
      winchState = 'idle';
      winchCooldown = WINCH_COOLDOWN_MAX;
      sub.vx = 0; sub.vy = 0;
    } else {
      const pullSpeed = 600;
      sub.vx = (dx / dist) * pullSpeed;
      sub.vy = (dy / dist) * pullSpeed;
    }
  } else {
    // Обычное движение
    const fx = Math.cos(sub.angle), fy = Math.sin(sub.angle);
    if (thrustOn) {
      sub.vx += (fx * sub.maxThrust - sub.vx) * sub.thrustAccel;
      sub.vy += (fy * sub.maxThrust - sub.vy) * sub.thrustAccel;
      if (!motorActive) startMotor();
      const intensity = Math.min(1, Math.hypot(sub.vx, sub.vy) / sub.maxThrust);
      updateMotorSound(intensity);
    } else {
      sub.vx += (0 - sub.vx) * sub.fallBlend;
      sub.vy += (FALL_SPEED - sub.vy) * sub.fallBlend;
      if (motorActive) stopMotor();
    }
  }

  sub.x += sub.vx * dt;
  sub.y += sub.vy * dt;

  // Логика выстрела копья
   // Логика выстрела лебедки
  if (winchState === 'shooting') {
    winchHook.t += dt;

    if (winchHook.t >= 0.2) {
      // Крюк долетел
      winchHook.x = winchHook.targetX;
      winchHook.y = winchHook.targetY;

      if (winchHook.hitBoss) {
        // Попадание в Кракена: урон + отбрасывание дрона
        krakenHp = Math.max(0, krakenHp - 15);
        krakenDamageFlash = 0.3;
        krakenFlashType = 'physical';
        if (!krakenActive) {
          krakenActive = true;
          showToast('🐙 КРАКЕН ПРОБУДИЛСЯ!');
              playBossMusic();
        }
        const d = Math.hypot(sub.x - krakenPos.x, sub.y - krakenPos.y) || 1;
        sub.vx = (sub.x - krakenPos.x) / d * 250;
        sub.vy = (sub.y - krakenPos.y) / d * 250;
        winchState = 'idle';
        winchCooldown = WINCH_COOLDOWN_MAX;
      } else {
        winchState = 'pulling';
        winchHook.pullTime = 0;
      }
    } else {
      // Летит — интерполируем от точки выстрела к цели
      const k = winchHook.t / 0.2;
      winchHook.x = winchHook.originX + (winchHook.targetX - winchHook.originX) * k;
      winchHook.y = winchHook.originY + (winchHook.targetY - winchHook.originY) * k;
    }
  }
  // Логика торпед
  // Логика торпед — заморозка рыб
  for (let i = torpedoes.length - 1; i >= 0; i--) {
    const t = torpedoes[i];
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.life -= dt;
    
    let hitSomething = false;
    for (const w of walls) {
      if (circleVsSegment(t.x, t.y, 4, w.x1, w.y1, w.x2, w.y2).hit) { hitSomething = true; break; }
    }
    if (!hitSomething) {
      for (let j = fishes.length - 1; j >= 0; j--) {
        const f = fishes[j];
        if (f.frozen > 0) continue;
        const dx = f.x - t.x, dy = f.y - t.y;
        if (dx*dx + dy*dy < (f.r + 10)*(f.r + 10)) {
          f.frozen = 5.0;
          hitSomething = true;
          soundFishHit();
          break;
        }
      }
    }
    // Попадание в Кракена
    // Попадание в Кракена (точный SVG-хитбокс)
    if (!hitSomething && currentLevelData && currentLevelData.boss === 'kraken' && !krakenDefeated) {
      if (typeof isPointInKraken === 'function' && isPointInKraken(t.x, t.y)) {
        krakenHp = Math.max(0, krakenHp - 25);
        krakenDamageFlash = 0.3;
        krakenFlashType = 'ice';
        hitSomething = true;
        soundRing();
        if (!krakenActive) {
          krakenActive = true;
          showToast('🐙 КРАКЕН ПРОБУДИЛСЯ!');
          playBossMusic();
        }
      }
    }
    
    if (hitSomething || t.life <= 0) {
      torpedoes.splice(i, 1);
    }
  }

  const speed = Math.hypot(sub.vx, sub.vy);
  sub.propellerAngle += (4 + speed * 0.15) * dt;

  // Пузырьки от дрона
  sub.bubbleTimer -= dt;
  if (sub.bubbleTimer <= 0 && speed > 20) {
    sub.bubbleTimer = 0.08 + Math.random() * 0.12;
    ambientBubbles.push({
      x: sub.x - Math.cos(sub.angle) * sub.r * 1.7 + (Math.random() - 0.5) * 4,
      y: sub.y - Math.sin(sub.angle) * sub.r * 1.7 + (Math.random() - 0.5) * 4,
      r: 1.5 + Math.random() * 2,
      vy: -20 - Math.random() * 25,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 3 + Math.random() * 3,
      life: 0, maxLife: 2 + Math.random() * 2
    });
  }

  // Кольца
  if (levelType === 'rings' && rings.length > 0) {
    if (currentRingIndex < rings.length) {
      const r = rings[currentRingIndex];
      const dx = sub.x - r.x, dy = sub.y - r.y;
      if (Math.hypot(dx, dy) < r.r) {
        r.passed = true;
        ringsCollected = currentRingIndex + 1;
        currentRingIndex++;
        soundRing();
      }
    }
  }

  // Стены (коллизия)
  let hitAny = false, firstHitInfo = null;
  for (const w of walls) {
    const res = circleVsSegment(sub.x, sub.y, sub.r, w.x1, w.y1, w.x2, w.y2);
    if (res.hit) {
      hitAny = true;
      sub.x += res.nx * res.depth;
      sub.y += res.ny * res.depth;
      const vn = sub.vx * res.nx + sub.vy * res.ny;
      if (vn < 0) { sub.vx -= vn * res.nx; sub.vy -= vn * res.ny; }
      if (!firstHitInfo) firstHitInfo = { wall: w.id, px: res.px, py: res.py };
    }
  }
  if (hitAny && !inContact) {
    inContact = true; wallHits++;
    collisionPoints.push({
      x: firstHitInfo.px, y: firstHitInfo.py,
      wall: firstHitInfo.wall, t: elapsed, type: 'wall'
    });
    applyDamage(6, 'wall');
  } else if (!hitAny && inContact) {
    inContact = false;
  }
  if (inContact) {
    wallContactTime += dt; wallDamage += 4 * dt; sub.hp -= 4 * dt;
  }

  // Рыбы (движение и коллизия)
  // Рыбы (движение и коллизия)
  for (const f of fishes) {
    if (f.frozen > 0) {
      f.frozen -= dt;

      const dx = f.x - sub.x, dy = f.y - sub.y;
      const rr = f.r + sub.r;
      if (dx*dx + dy*dy < rr*rr) {
        const d = Math.hypot(dx, dy) || 1;
        const nx = -dx / d, ny = -dy / d;
        sub.x += nx * 2; sub.y += ny * 2;
        sub.vx += nx * 30; sub.vy += ny * 30;
      }
      continue;
    }

    f.wiggle += dt * 1.5;
    f.tailPhase += dt * 6;
    f.anglerPhase += dt * 2;
    f.mouthPhase += dt * 4;

    f.x += (f.vx + Math.sin(f.wiggle) * 15) * dt;
    f.y += (f.vy + Math.cos(f.wiggle * 0.7) * 15) * dt;

    if (f.x < f.r) { f.x = f.r; f.vx = Math.abs(f.vx); }
    if (f.x > WORLD_W - f.r) { f.x = WORLD_W - f.r; f.vx = -Math.abs(f.vx); }
    if (f.y < f.r) { f.y = f.r; f.vy = Math.abs(f.vy); }
    if (f.y > FLOOR_Y - f.r) { f.y = FLOOR_Y - f.r; f.vy = -Math.abs(f.vy); }

    for (const w of walls) {
      const res = circleVsSegment(f.x, f.y, f.r, w.x1, w.y1, w.x2, w.y2);
      if (res.hit) {
        f.x += res.nx * res.depth;
        f.y += res.ny * res.depth;
        const vn = f.vx * res.nx + f.vy * res.ny;
        if (vn < 0) { f.vx -= 2 * vn * res.nx; f.vy -= 2 * vn * res.ny; }
      }
    }

    if (Math.abs(f.vx) > 5) f.dir = f.vx >= 0 ? 1 : -1;

    // Коллизия с дроном
    const isAngler = f.type === 'angler';
    const rx = isAngler ? f.r * 2.5 : f.r * 1.4;
    const ry = isAngler ? f.r * 1.5 : f.r * 0.9;
    const bodyDx = sub.x - f.x;
    const bodyDy = sub.y - f.y;
    const bodyNx = bodyDx / (rx + sub.r);
    const bodyNy = bodyDy / (ry + sub.r);
    const bodyDist = bodyNx * bodyNx + bodyNy * bodyNy;
    const hitBody = bodyDist < 1;

    let hitLure = false;
    if (isAngler) {
      const dirL = f.dir >= 0 ? 1 : -1;
      const lureX = f.x + dirL * f.r * 0.9;
      const lureY = f.y - f.r * 2.0;
      const lureR = f.r * 0.35;
      const lureDx = sub.x - lureX;
      const lureDy = sub.y - lureY;
      const lureRR = lureR + sub.r;
      hitLure = (lureDx * lureDx + lureDy * lureDy) < (lureRR * lureRR);
    }

    if (hitBody || hitLure) {
      if (sub.invuln <= 0) {
        fishHits++;
        fishDamage += 12;
        applyDamage(12, 'fish');
      }
    }

    // Физическое отталкивание (срабатывает ТОЛЬКО когда урон уже прошел)
    // Делаем радиус отталкивания чуть меньше радиуса урона
    const pushRadius = Math.max(rx * 0.7, ry * 0.7) + sub.r * 0.5; 
    const dist = Math.hypot(bodyDx, bodyDy) || 1;
    
    if (dist < pushRadius) {
      const ux = bodyDx / dist, uy = bodyDy / dist;
      const overlap = pushRadius - dist;
      sub.x += ux * overlap;
      sub.y += uy * overlap;
      const vDot = sub.vx * ux + sub.vy * uy;
      if (vDot < 0) {
        sub.vx -= vDot * ux * 1.3;
        sub.vy -= vDot * uy * 1.3;
      }
      sub.vx += ux * 40;
      sub.vy += uy * 40;
    }
  }
  updateKraken(dt);
  if (!running) return;
  updateAmbientBubbles(dt);
  if (sub.invuln > 0) sub.invuln -= dt;

  if (sub.hp <= 0) { 
    sub.hp = 0; 
    if (currentLevel === 'PVP') {
      if (typeof mpSendMyPosition === 'function' && myRoomCode) {
      mpSendMyPosition(sub.x, sub.y, sub.angle, sub.propellerAngle, 0);
      }
      if (typeof mpSendDead === 'function') mpSendDead(); // <-- Отправляем сигнал
      if (typeof pvpGameOver === 'function') pvpGameOver(false);
    } else {
      die(); 
    }
    return; 
  }
  // Финиш
  const fdx = sub.x - finish.x, fdy = sub.y - finish.y;
  if (Math.hypot(fdx, fdy) < finish.r - 4) {
    if (levelType === 'rings' && ringsCollected < ringsRequired) {
      if (!finishBlockedWarning) {
        finishBlockedWarning = true;
        showToast('🔒 Не собраны все кольца (' + ringsCollected + '/' + ringsRequired + ')');
        setTimeout(() => { finishBlockedWarning = false; }, 2500);
      }
    } else if (currentLevelData && currentLevelData.boss === 'kraken' && !krakenDefeated) {
      if (!finishBlockedWarning) {
        finishBlockedWarning = true;
        showToast('🐙 Сначала победите Кракена!');
        setTimeout(() => { finishBlockedWarning = false; }, 2500);
      }
    } else {
      win();
      return;
    }
  }

  elapsed += dt;
  // --- ОТЛАДОЧНЫЙ КОД ---
  if (Math.abs(sub.x - prevX) > 150 || Math.abs(sub.y - prevY) > 150) {
    console.warn('🚨 [DEBUG] РЕЗКИЙ СКАЧОК ЛОДКИ!', 'Было:', prevX.toFixed(1), prevY.toFixed(1), 'Стало:', sub.x.toFixed(1), sub.y.toFixed(1), 'Скорость:', sub.vx.toFixed(1), sub.vy.toFixed(1));
  }
  if (sub.x <= 0 || sub.y <= 0 || sub.x >= WORLD_W || sub.y >= WORLD_H) {
    console.warn('🚨 [DEBUG] ВЫЛЕТ В СТЕНУ/УГОЛ!', sub.x.toFixed(1), sub.y.toFixed(1));
    // Принудительно вытаскиваем лодку обратно в центр экрана
    sub.x = Math.max(100, Math.min(WORLD_W - 100, sub.x));
    sub.y = Math.max(100, Math.min(WORLD_H - 100, sub.y));
    sub.vx = 0;
    sub.vy = 0;
  }
  // Обновление снарядов врага (визуальные)
  if (currentLevel === 'PVP' && typeof remoteTorpedoes !== 'undefined') {
    for (let i = remoteTorpedoes.length - 1; i >= 0; i--) {
      const t = remoteTorpedoes[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      
      // Проверка столкновения со стенами
      let hit = false;
      for (const w of walls) {
        if (circleVsSegment(t.x, t.y, 4, w.x1, w.y1, w.x2, w.y2).hit) { hit = true; break; }
      }
      
      if (hit || t.life <= 0) {
        remoteTorpedoes.splice(i, 1);
      }
    }
  }

    // ============================================================
  // ⚡ ИНТЕРПОЛЯЦИЯ ВРАГА (плавное движение)
  // ============================================================
  if (currentLevel === 'PVP' && typeof opponentPos !== 'undefined' && opponentPos.visible) {
    const lerpSpeed = 0.25;
    
    // Движение
    opponentPos.x += (opponentTarget.x - opponentPos.x) * lerpSpeed;
    opponentPos.y += (opponentTarget.y - opponentPos.y) * lerpSpeed;
    
    // Защита от NaN
    if (isNaN(opponentPos.x)) opponentPos.x = opponentTarget.x;
    if (isNaN(opponentPos.y)) opponentPos.y = opponentTarget.y;
    
    // Поворот
    let angleDiff = opponentTarget.angle - opponentPos.angle;
    if (isNaN(angleDiff)) angleDiff = 0; 
    
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    opponentPos.angle += angleDiff * lerpSpeed;
    
    if (isNaN(opponentPos.angle)) opponentPos.angle = 0;

    // Пропеллер
    opponentPos.propellerAngle = opponentTarget.propellerAngle;
  }
  // ============================================================
  // ============================================================
  // PVP: СТОЛКНОВЕНИЯ И УРОН
  // ============================================================
  // ============================================================
  // PVP: СТОЛКНОВЕНИЯ И УРОН
  // ============================================================
  if (currentLevel === 'PVP' && typeof opponentPos !== 'undefined' && opponentPos.visible && sub.hp > 0) {
    
    // 1. Наши торпеды бьют врага
    for (let i = torpedoes.length - 1; i >= 0; i--) {
      const t = torpedoes[i];
      const dx = t.x - opponentPos.x;
      const dy = t.y - opponentPos.y;
      if (dx*dx + dy*dy < (sub.r * 1.5 + 10) * (sub.r * 1.5 + 10)) {
        torpedoes.splice(i, 1);
        if (typeof mpSendHit === 'function') mpSendHit(20); // Отправляем урон
        soundFishHit();
        break;
      }
    }

    // 2. Вражеские торпеды бьют нас
    if (typeof remoteTorpedoes !== 'undefined') {
      for (let i = remoteTorpedoes.length - 1; i >= 0; i--) {
        const t = remoteTorpedoes[i];
        const dx = t.x - sub.x;
        const dy = t.y - sub.y;
        if (dx*dx + dy*dy < (sub.r + 10) * (sub.r + 10)) {
          remoteTorpedoes.splice(i, 1);
          soundWallHit();
          break;
        }
      }
    }

    // 3. Таран
    const rdx = sub.x - opponentPos.x;
    const rdy = sub.y - opponentPos.y;
    const rdist = Math.hypot(rdx, rdy);
    if (rdist < sub.r * 2 && sub.invuln <= 0) {
      sub.invuln = 1.0;
      sub.hp -= 15; 
      if (typeof mpSendHit === 'function') mpSendHit(15);
      
      const d = rdist || 1;
      sub.vx = (rdx / d) * 300;
      sub.vy = (rdy / d) * 300;
      soundWallHit();
    }
  }

   // Проверка победы (если у врага 0 HP)
  if (currentLevel === 'PVP' && typeof opponentTarget !== 'undefined' && opponentTarget.hp <= 0) {
    if (typeof pvpGameOver === 'function') pvpGameOver(true);
  }

    // Отправка координат по сети
  if (currentLevel === 'PVP' && typeof mpSendMyPosition === 'function' && myRoomCode) {
    if (!window.lastNetSend) window.lastNetSend = 0;
    if (Date.now() - window.lastNetSend > 50) {
      mpSendMyPosition(sub.x, sub.y, sub.angle, sub.propellerAngle, sub.hp);
      window.lastNetSend = Date.now();
    }
  }
  // ----------------------
 
  // ----------------------
  updateCamera();
  updateHud();
}

function win() {
  running = false;
  resultState = 'win';
  stopMotor();
  soundFinish();
  finalizeRun();
  
  // Если точность меньше 80, показываем заголовок "Недостаточно точности"
  if (currentRun.accuracy < UNLOCK_THRESHOLD) {
    showStats('Недостаточно точности');
  } else {
    showStats('Сектор пройден!');
  }
}

function die() {
  running = false;
  resultState = 'dead';
  stopMotor();
  soundDeath();
  finalizeRun();
  showStats('Дрон потерян');
}

async function showStats(title) {
  el('result-title').textContent = title;
  const run = currentRun; 
  // Для тренировки — свой заголовок и сохранение прогресса
  if (String(currentLevel).startsWith('T')) {
    if (run.resultState === 'win') {
      el('result-title').textContent = '🎓 Молодец! Тренировка пройдена!';
      if (typeof saveTrainingCompletion === 'function') {
        saveTrainingCompletion(currentLevel);
      }
    } else {
      el('result-title').textContent = '🎓 Попробуй ещё раз!';
    }
  }
  
  const totalTime = run.time;
  const accuracy = run.accuracy;

  let grade, gradeClass;
  if (run.resultState === 'dead') { grade = 'Дрон потерян'; gradeClass = 'bad'; }
  else if (accuracy >= 90) { grade = 'Отличный пилот'; gradeClass = 'good'; }
  else if (accuracy >= 80) { grade = 'Хорошо'; gradeClass = 'good'; }
  else if (accuracy >= 60) { grade = 'Средне'; gradeClass = 'warn'; }
  else { grade = 'Много ошибок'; gradeClass = 'bad'; }

  const playerStr = currentPlayer
    ? (currentPlayer.source === 'nick' ? currentPlayer.short
        : `${currentPlayer.klass} — ${currentPlayer.short}`)
    : '—';

  const rows = [
    ['Игрок', playerStr],
    ['Уровень', currentLevel + ' — ' + (currentLevelData ? currentLevelData.name : '')],
    ['Время', totalTime.toFixed(2) + ' с']
  ];
  if (levelType === 'rings') {
    rows.push(['Колец собрано', run.ringsCollected + ' / ' + run.ringsRequired]);
  }
  rows.push(
    ['Касаний стен', run.wallHits],
    ['Урон от стен', Math.round(run.wallDamage)],
    ['Касаний рыб', run.fishHits],
    ['Урон от рыб', Math.round(run.fishDamage)],
    ['Остаток корпуса', run.hp + ' / ' + MAX_HP],
    ['Оценка точности', `<span class="${gradeClass}">${accuracy}%</span>`],
    ['Вердикт', `<span class="${gradeClass}">${grade}</span>`]
  );

  // 1. Генерируем HTML для основной статистики
  let html = '';
  for (const [k, v] of rows) {
    html += `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`;
  }

  // 2. Проверяем артефакт (если уровень пройден на 80%+)
  let artifactHtml = '';
  if (run.resultState === 'win' && accuracy >= UNLOCK_THRESHOLD) {
    const artifactData = {
      1: { key: 'map', icon: '🗺', name: 'Древняя Карта', desc: 'Теперь вы видите схему подводных залов. На экране появится миникарта.' },
      2: { key: 'winch', icon: '⚙', name: 'Лебедка', desc: 'Позволяет делать быстрый рывок (ПКМ / кнопка).' },
      3: { key: 'flashlight', icon: '💡', name: 'Прожектор', desc: 'Освещает темноту (СКМ / F). Тратит энергию.' },
      4: { key: 'torpedo', icon: '❄️', name: 'Крио-бластер', desc: 'Замораживает рыб ледяными снарядами (Пробел / кнопка).' }
    };

    const art = artifactData[currentLevel];
    if (art && !inventory[art.key]) {
      // Выдаем артефакт
      inventory[art.key] = true;
      if (currentPlayer && currentPlayer.source !== 'nick') {
        saveInventoryForPlayer(currentPlayer.klass, currentPlayer.short);
      }

      // Формируем красивую плашку артефакта
      artifactHtml = `
        <div style="margin-top: 15px; padding: 15px; background: rgba(212, 162, 89, 0.15); border: 1px solid #d4a259; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
          <h3 style="color: #ffd166; margin: 0 0 10px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">🎉 Получен новый артефакт!</h3>
          <div style="font-size: 40px; margin-bottom: 10px; filter: drop-shadow(0 0 10px rgba(255,209,102,0.5));">${art.icon}</div>
          <div style="font-size: 18px; color: #7fd6ff; font-weight: bold; margin-bottom: 8px;">${art.name}</div>
          <div style="font-size: 13px; color: #d8e8f4; opacity: 0.9; line-height: 1.4;">${art.desc}</div>
        </div>
      `;
    }
  }

  // 3. Показываем экраны
  if (run.resultState === 'win' && accuracy < UNLOCK_THRESHOLD) {
    // Провал по точности
    const failContainer = el('fail-stats-container');
    if (failContainer) failContainer.innerHTML = html;
    showScreen('fail');
  } else {
    // Успех или смерть
    const statsContainer = el('stats');

    // 🏆 Если это победа на 5-м уровне — добавляем кнопку финала
    let endingHtml = '';
    if (currentLevel === 5 && run.resultState === 'win' && accuracy >= UNLOCK_THRESHOLD) {
      endingHtml = `
        <div style="margin-top: 20px; padding: 20px; background: linear-gradient(145deg, rgba(255,209,102,0.2), rgba(212,162,89,0.1)); border: 2px solid #ffd166; border-radius: 12px; text-align: center;">
          <h3 style="color: #ffd166; margin: 0 0 12px; font-size: 20px;">🏆 ЭКСПЕДИЦИЯ ЗАВЕРШЕНА!</h3>
          <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.9; line-height: 1.5;">Вы прошли все 5 секторов, заморозили Кракена и открыли путь к сокровищу древнего храма.</p>
          <button class="btn gold" id="showEndingBtn" style="font-size: 16px; padding: 14px 30px;">🎬 Смотреть финал</button>
        </div>
      `;
    }

    if (statsContainer) statsContainer.innerHTML = html + artifactHtml + endingHtml;
    showScreen('stats');

    // Привязываем кнопку "Смотреть финал" (если она есть)
    const showEndingBtn = el('showEndingBtn');
    if (showEndingBtn) {
      showEndingBtn.addEventListener('click', () => showScreen('ending'));
    }
  }

  // 4. Отправка результата (Уровень + Артефакты В ОДНОМ ЗАПРОСЕ)
  if (!scoreSent && currentPlayer && run.resultState === 'win' && !String(currentLevel).startsWith('T')) {
    scoreSent = true;
    const result = await sendResult(currentLevel, accuracy);
    // ...
  
    const s = el('sendStatus');
    if (s) {
      if (result.ok) {
        s.textContent = '✅ Результат и артефакты сохранены';
        s.style.color = '#6ee787';
      } else {
        s.textContent = '⚠️ ' + (result.error || 'Нет связи');
        s.style.color = '#ff6b6b';
      }
    }
    if (!result.ok) console.error('❌ Отправка не удалась:', result.error);
  }

  // 5. Обновляем прогресс
  if (run.resultState === 'win' && accuracy >= UNLOCK_THRESHOLD && !String(currentLevel).startsWith('T')) {
    if (Number(currentLevel) + 1 > playerProgress && Number(currentLevel) < MAX_LEVEL) {
      playerProgress = Number(currentLevel) + 1;
    }
  }
}

function finalizeRun() {
  const totalTime = elapsed;
  const accuracy = Math.max(0, Math.round(
    100 - wallHits * 8 - wallContactTime * 4 - fishHits * 10
    - Math.max(0, totalTime - 60) * 0.3
  ));
  currentRun = {
    time: totalTime, accuracy,
    wallHits, fishHits, wallContactTime,
    fishDamage, wallDamage,
    hp: Math.round(sub.hp),
    resultState,
    ringsCollected: ringsCollected,
    ringsRequired: ringsRequired,
    date: new Date().toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  };
  scoreSent = false;
}

// ---------- HUD ----------
const hud = el('hud');
const hpfill = el('hpfill');
const hptext = el('hptext');
const energybar = el('energybar');
const energyfill = el('energyfill');
const energytext = el('energytext');

function updateHud() {
  if (!hud) return; // Защита

  let hudHtml = `Время: ${elapsed.toFixed(1)}s<br>`;
  if (levelType === 'rings') {
    hudHtml += `Кольца: ${ringsCollected}/${ringsRequired}<br>`;
  }
  hudHtml += `Касания стен: ${wallHits}<br>`;
  hudHtml += `Корпус: ${Math.round(Math.max(0, sub.hp))}`;
  hud.innerHTML = hudHtml;

  const hpPct = Math.max(0, Math.min(100, sub.hp));
  if (hpfill) {
    hpfill.style.width = hpPct + '%';
    if (hpPct > 60) hpfill.style.background = 'linear-gradient(90deg, #6ee787, #3ddc84)';
    else if (hpPct > 30) hpfill.style.background = 'linear-gradient(90deg, #ffd166, #ffb347)';
    else hpfill.style.background = 'linear-gradient(90deg, #ff6b6b, #e63946)';
  }
  if (hptext) hptext.textContent = 'Корпус: ' + Math.round(hpPct);

  // Энергия
  if (inventory.flashlight) {
    if (energybar) energybar.classList.remove('hidden');
    if (energytext) energytext.classList.remove('hidden');
    const ePct = Math.max(0, Math.min(100, (energy / MAX_ENERGY) * 100));
    if (energyfill) energyfill.style.width = ePct + '%';
    if (energytext) energytext.textContent = 'Энергия: ' + Math.round(ePct);
    if (energybar) {
      if (flashlightOn) energybar.style.borderColor = '#ffd166';
      else energybar.style.borderColor = '#1e3a55';
    }
  } else {
    if (energybar) energybar.classList.add('hidden');
    if (energytext) energytext.classList.add('hidden');
  }

  // Кулдауны
  const winchCd = el('winchCd');
  const torpedoCd = el('torpedoCd');
  
  if (winchCd) {
    if (inventory.winch) {
      winchCd.style.display = 'flex';
      const fill = winchCd.querySelector('.fill');
      if (winchCooldown > 0) {
        winchCd.classList.remove('ready');
        if (fill) fill.style.transform = `scaleY(${winchCooldown / WINCH_COOLDOWN_MAX})`;
      } else {
        winchCd.classList.add('ready');
        if (fill) fill.style.transform = `scaleY(0)`;
      }
    } else {
      winchCd.style.display = 'none';
    }
  }

  if (torpedoCd) {
    if (inventory.torpedo) {
      torpedoCd.style.display = 'flex';
      const fill = torpedoCd.querySelector('.fill');
      if (torpedoCooldown > 0) {
        torpedoCd.classList.remove('ready');
        if (fill) fill.style.transform = `scaleY(${torpedoCooldown / TORPEDO_COOLDOWN_MAX})`;
      } else {
        torpedoCd.classList.add('ready');
        if (fill) fill.style.transform = `scaleY(0)`;
      }
    } else {
      torpedoCd.style.display = 'none';
    }
  }
}

// ---------- Статистика ----------


function showArtifactScreen(art) {
  el('artifact-title').textContent = 'Вы нашли артефакт!';
  el('artifact-icon').textContent = art.icon;
  el('artifact-name').textContent = art.name;
  el('artifact-desc').textContent = art.desc;
  showScreen('artifact');
  updateArtifactUI();
}

// ---------- Кнопки игрового меню ----------
const pauseBtn = el('pauseBtn');
if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

const pauseResume = el('pauseResume');
if (pauseResume) pauseResume.addEventListener('click', () => {
  paused = false; 
  const po = el('pauseOverlay'); if (po) po.classList.remove('show');
  if (musicEnabled) switchMusic('game');
});

const pauseRestart = el('pauseRestart');
if (pauseRestart) pauseRestart.addEventListener('click', () => {
  paused = false; 
  const po = el('pauseOverlay'); if (po) po.classList.remove('show');
  startLevel(currentLevel);
});

const pauseChange = el('pauseChangePlayer');
if (pauseChange) pauseChange.addEventListener('click', () => {
  paused = false; 
  const po = el('pauseOverlay'); if (po) po.classList.remove('show');
  goToSelectPlayer();
});

const pauseExit = el('pauseExit');
if (pauseExit) pauseExit.addEventListener('click', () => {
  paused = false; 
  const po = el('pauseOverlay'); if (po) po.classList.remove('show');
  goToMap();
});

const restartBtn = el('restartBtn');
if (restartBtn) restartBtn.addEventListener('click', () => { startLevel(currentLevel); });

const exitBtn = el('exitBtn');
if (exitBtn) exitBtn.addEventListener('click', goToMap);

const artBtn = el('artifactContinueBtn');
if (artBtn) artBtn.addEventListener('click', goToMap);

const playBtn = el('playBtn');
if (playBtn) {
  playBtn.addEventListener('click', () => {
    unlockAudio();
    startMusicIfAllowed();
    goToSelectPlayer();
  });
}

// Кнопки экрана статистики
const statsRestartBtn = el('statsRestart');
if (statsRestartBtn) statsRestartBtn.addEventListener('click', () => { startLevel(currentLevel); });

const statsMapBtn = el('statsMap');
if (statsMapBtn) statsMapBtn.addEventListener('click', goToMap);

const statsMenuBtn = el('statsMenu');
if (statsMenuBtn) statsMenuBtn.addEventListener('click', goToMap);

// Кнопка экрана "Недостаточно точности"
const failContinueBtn = el('failContinueBtn');
if (failContinueBtn) {
  failContinueBtn.addEventListener('click', () => {
    goToMap();
  });
}
// ================================================================
//  КНОПКИ НАВИГАЦИИ (ИСТОРИЯ, УПРАВЛЕНИЕ, ПАРАМЕТРЫ, ЛИДЕРБОРД)
// ================================================================
const storyBackBtn = el('storyBack');
if (storyBackBtn) {
  storyBackBtn.addEventListener('click', () => {
    if (currentPlayer) goToMap(); else showScreen('splash');
  });
}

const controlsBackBtn = el('controlsBack');
if (controlsBackBtn) {
  controlsBackBtn.addEventListener('click', () => {
    if (currentPlayer) goToMap(); else showScreen('splash');
  });
}

const optionsBackBtn = el('optionsBack');
if (optionsBackBtn) {
  optionsBackBtn.addEventListener('click', () => {
    if (currentPlayer) goToMap(); else showScreen('splash');
  });
}

const lbBackBtn = el('lbBack');
if (lbBackBtn) {
  lbBackBtn.addEventListener('click', () => {
    if (currentPlayer) goToMap(); else showScreen('splash');
  });
}

// ================================================================
//  ПЕРЕКЛЮЧАТЕЛИ КАЧЕСТВА В ПАРАМЕТРАХ (чтобы не пропали)
// ================================================================
const optQuality = el('opt-quality');
if (optQuality) {
  optQuality.value = qualityLevel;
  optQuality.addEventListener('change', (e) => {
    qualityLevel = e.target.value;
    try { localStorage.setItem('pogruzhenie_quality', qualityLevel); } catch (err) {}
    showToast('Качество: ' + qualityLevel);
  });
}

const optRender = el('opt-render');
if (optRender) {
  optRender.value = renderScale.toString();
  optRender.addEventListener('change', (e) => {
    renderScale = parseFloat(e.target.value);
    try { localStorage.setItem('pogruzhenie_render_scale', renderScale.toString()); } catch (err) {}
    if (typeof resize === 'function') resize();
    showToast('Разрешение: ' + renderScale);
  });
}

// ---------- goToMap ----------
function goToMap() {
  started = false; running = false; paused = false;
  el('pauseOverlay').classList.remove('show');
  stickEnd(); thrustUp(); stopMotor();
  updateMinimapVisibility();
  
  // Если тренировка не пройдена — принудительно режим Тренировки
  if (typeof isTrainingComplete === 'function' && !isTrainingComplete()) {
    if (typeof currentMapMode !== 'undefined') {
      currentMapMode = 'training';
    }
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'training');
    });
  }
  
  updateMapInfo();
  showScreen('map');
}

// ---------- Главный цикл ----------
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (started) {
    update(dt);
    draw();
  } else {
    sub.animTime += dt;
  }
  requestAnimationFrame(loop);
}

// ---------- Инициализация ----------
detectQuality();
generateDecorations();
resize();

updateCamera();
showScreen('splash');
lastTime = performance.now();
// ================================================================
//  🐙 КРАКЕН — ЛОГИКА БОЯ
// ================================================================
function updateKraken(dt) {
  if (!currentLevelData || currentLevelData.boss !== 'kraken') return;

  // Пробуждение
  if (krakenActive && !krakenDefeated && krakenWakeT < 1) {
    krakenWakeT = Math.min(1, krakenWakeT + dt / 0.9);
  }

  // Подъём с пола (медленнее открытия глаза)
  if (krakenActive && !krakenDefeated && krakenRiseT < 1) {
    krakenRiseT = Math.min(1, krakenRiseT + dt / 1.8);
  }

  // Таймеры моргания
  if (krakenBlinkT > 0) {
    krakenBlinkT -= dt;
    if (krakenBlinkT < 0) krakenBlinkT = 0;
  }
  if (krakenSquintT > 0) {
    krakenSquintT -= dt;
    if (krakenSquintT < 0) krakenSquintT = 0;
  }

  // Случайное моргание (редкое)
  if (krakenActive && !krakenDefeated && krakenBlinkT <= 0 && Math.random() < dt * 0.3) {
    krakenBlinkT = 0.3;
  }

  if (krakenDefeated) {
    if (krakenSinkT < 1) {
      krakenSinkT = Math.min(1, krakenSinkT + dt / 3);
    }
    updateBossBar();
    return;
  }

  // Триггер боя
  if (!krakenActive && sub.x > (currentLevelData.bossTriggerX || 2400)) {
    krakenActive = true;
    showToast('🐙 КРАКЕН ПРОБУДИЛСЯ!');
        playBossMusic();
  }

  if (!krakenActive) return;

  krakenPhase = krakenHp > 200 ? 1 : (krakenHp > 100 ? 2 : 3);
  if (krakenDamageFlash > 0) krakenDamageFlash -= dt;

  // Атаки щупальцами
  // Атаки щупальцами — всегда 1 за атаку
  // Атаки щупальцами — 1 за атаку, с паузами
  krakenAttackTimer -= dt;
  if (krakenAttackTimer <= 0) {
    // Базовая пауза по фазам
    const baseInterval = krakenPhase === 1 ? 5.5 : (krakenPhase === 2 ? 4.5 : 3.5);
    // ±20% рандома — чтобы не было «метронома»
    const jitter = baseInterval * (0.8 + Math.random() * 0.4);
    krakenAttackTimer = jitter;
    spawnTentacle();
  }

  // Чернила (фаза 2+)
  if (krakenPhase >= 2) {
    krakenInkTimer -= dt;
    if (krakenInkTimer <= 0) {
      krakenInkTimer = krakenPhase === 2 ? 6 : 4;
      spawnInkCloud();
    }
  }

    // Предупреждения перед появлением щупальца
  for (let i = tentacleWarnings.length - 1; i >= 0; i--) {
    const w = tentacleWarnings[i];
    w.life += dt;
    if (w.life >= w.delay) {
      spawnTentacleActual(w.x);
      tentacleWarnings.splice(i, 1);
    }
  }
  // Обновление щупалец
  // Обновление щупалец — медленный плавный подъём, быстрый спуск
  for (let i = tentacles.length - 1; i >= 0; i--) {
    const t = tentacles[i];
    t.life += dt;

    // Тайминги (в секундах)
    const RISE = 3.3;   // медленный подъём — в 3× медленнее предыдущего
    const HOLD = 0.5;   // держится наверху
    const FALL = 0.55;  // быстрый спуск

    if (t.life < RISE) {
      // Подъём: ease-out — быстро стартует, плавно тормозит у потолка
      const k = t.life / RISE;
      const eased = 1 - Math.pow(1 - k, 2);
      t.height = eased * t.maxHeight;
    } else if (t.life < RISE + HOLD) {
      t.height = t.maxHeight;
    } else if (t.life < RISE + HOLD + FALL) {
      // Спуск: ease-in — плавно начинает, ускоряется вниз
      const k = (t.life - RISE - HOLD) / FALL;
      const eased = k * k;
      t.height = t.maxHeight * (1 - eased);
    } else {
      tentacles.splice(i, 1);
      continue;
    }

    if (t.height <= 20) continue;

    // Физическая коллизия ВСЕГДА (даже в неуязвимости) — как стена
    const res = circleVsSegment(
      sub.x, sub.y, sub.r,
      t.x, t.baseY,
      t.x, t.baseY - t.height
    );
    if (res.hit) {
      sub.x += res.nx * res.depth;
      sub.y += res.ny * res.depth;
      const vn = sub.vx * res.nx + sub.vy * res.ny;
      if (vn < 0) {
        sub.vx -= vn * res.nx * 1.5;
        sub.vy -= vn * res.ny * 1.5;
      }
    }

    // Урон — только если ОБА кулдауна истекли
    if (res.hit && sub.invuln <= 0 && (sub.tentacleInvuln || 0) <= 0) {
      applyDamage(30, 'wall');
      sub.invuln = 0.5;
      sub.tentacleInvuln = 1.5; // ← щит от повторных ударов щупальцами
    }
  }

  // Обновление чернил
  // Обновление чернил — ослепляют, но не тормозят
  for (let i = inkClouds.length - 1; i >= 0; i--) {
    const c = inkClouds[i];
    c.life -= dt;
    if (c.life <= 0) { inkClouds.splice(i, 1); continue; }
    const dx = sub.x - c.x, dy = sub.y - c.y;
    if (dx*dx + dy*dy < c.r * c.r) {
      sub.inkBlind = Math.max(sub.inkBlind || 0, 1.2);
    }
  }

  // Таран в тело Кракена (точный SVG-хитбокс)
  const kHead = getKrakenHeadPos();
  const kdx = sub.x - kHead.x;
  const kdy = sub.y - kHead.y;
  const kdist = Math.hypot(kdx, kdy);
  
  let isRamHit = false;
  if (typeof isPointInKraken === 'function') {
    // Проверяем центр лодки и её нос
    const p1 = isPointInKraken(sub.x, sub.y);
    const p2 = isPointInKraken(sub.x + Math.cos(sub.angle) * sub.r, sub.y + Math.sin(sub.angle) * sub.r);
    if (p1 || p2) isRamHit = true;
  } else {
    // Запасной вариант, если SVG не загрузился
    isRamHit = (kdist < krakenPos.r + sub.r);
  }

  if (isRamHit && sub.invuln <= 0) {
    krakenHp = Math.max(0, krakenHp - 10);
    krakenDamageFlash = 0.2;
    krakenFlashType = 'physical';
    sub.hp -= 20;
    sub.invuln = 1.0;
    const d = kdist || 1;
    sub.vx = (kdx / d) * 280;
    sub.vy = (kdy / d) * 280;
    sub.x = kHead.x + (kdx / d) * (krakenPos.r + sub.r + 5);
    sub.y = kHead.y + (kdy / d) * (krakenPos.r + sub.r + 5);
    soundWallHit();
      if (sub.hp <= 0) { 
    sub.hp = 0; 
    if (currentLevel === 'PVP' && typeof pvpGameOver === 'function') {
      pvpGameOver(false);
    } else {
      die(); 
    }
    return; 
  }
}
  

  // Победа
  // Победа — заморозка вместо убийства
  if (krakenHp <= 0 && !krakenDefeated) {
    krakenDefeated = true;
    krakenSinkT = 0;
    tentacles.length = 0;
    inkClouds.length = 0;
    showToast('❄️ Кракен заморожен! Путь к сокровищу открыт!');
    soundFinish();
  }

  updateBossBar();
}

function spawnTentacle() {
  // Если игрок стрелял недавно — бьём туда. Иначе — рандом возле дрона.
  const TIME_WINDOW = 4.0; // 4 секунды
  let x;
  if (elapsed - lastFireTime < TIME_WINDOW) {
    // Точка последнего выстрела ± небольшой разброс
    x = lastFirePos.x + (Math.random() - 0.5) * 60;
  } else {
    // Рандом возле текущей позиции
    x = sub.x + (Math.random() - 0.5) * 600;
  }
  x = Math.max(100, Math.min(WORLD_W - 100, x));

  // Прищур глаза при атаке
  if (typeof krakenSquintT !== 'undefined') krakenSquintT = 0.8;

  tentacleWarnings.push({
    x: x,
    life: 0,
    delay: 0.35
  });
}

function spawnTentacleActual(x) {
  tentacles.push({
    x: x, baseY: FLOOR_Y, height: 0,
    maxHeight: 950 + Math.random() * 100,
    width: 14, life: 0,
    phase: Math.random() * Math.PI * 2
  });
}

function spawnInkCloud() {
  inkClouds.push({
    x: sub.x + (Math.random() - 0.5) * 300,
    y: sub.y + (Math.random() - 0.5) * 200,
    r: 120, life: 5.0
  });
}

function updateBossBar() {
  const bar = el('bossbar');
  const fill = el('bossbar-fill');
  const text = el('bossbar-text');
  if (!bar) return;
  if (!krakenActive || krakenDefeated) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  const pct = Math.max(0, krakenHp / krakenMaxHp * 100);
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = '🐙 КРАКЕН · ' + krakenHp + ' / ' + krakenMaxHp;
}

// ================================================================
//  Raycast для лебедки
// ================================================================
function raycastWall(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const steps = Math.ceil(len / 6);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const w of walls) {
      if (circleVsSegment(px, py, r, w.x1, w.y1, w.x2, w.y2).hit) {
        return { x: px, y: py, t: t };
      }
    }
  }
  return null;
}

function raycastBoss(x1, y1, x2, y2, boss) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.ceil(len / 6);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const bdx = px - boss.x, bdy = py - boss.y;
    if (bdx*bdx + bdy*bdy < boss.r * boss.r) {
      return { x: px, y: py, t };
    }
  }
  return null;
}

function playBossMusic() {
  if (!musicEnabled || !gameMusic || !currentLevelData) return;
  const newSrc = currentLevelData.krakenMusic;
  if (!newSrc) return;
  const srcEl = gameMusic.querySelector('source');
  if (!srcEl) return;
  if (!srcEl.src.includes(newSrc)) {
    srcEl.src = newSrc;
    gameMusic.load();
  }
  gameMusic.volume = (AUDIO_SETTINGS.gameMusicVolume || 0.45) *
    (typeof musicVolumeMultiplier === 'function' ? musicVolumeMultiplier() : 1);
  gameMusic.play().catch(() => {});
}
function getKrakenHeadPos() {
  const headR = krakenPos.r;
  const restingY = FLOOR_Y - headR * 1.05;
  const riseT = (typeof krakenRiseT !== 'undefined') ? krakenRiseT : (krakenActive ? 1 : 0);
  const baseY = restingY + (krakenPos.y - restingY) * riseT;
  const sinkT = (typeof krakenSinkT !== 'undefined') ? krakenSinkT : (krakenDefeated ? 1 : 0);

  let x = krakenPos.x;
  let y = baseY + (restingY - baseY) * sinkT;

  // Живое качание с течением (только когда проснулся и жив)
  if (krakenActive && !krakenDefeated) {
    const t = sub.animTime;
    // Увеличили амплитуду по X и Y
    x += Math.sin(t * 0.55) * 30 + Math.sin(t * 1.3) * 10;
    y += Math.sin(t * 0.8) * 35 + Math.sin(t * 1.7) * 12;
  }

  return { x, y };
}

// Совместимость со старым именем
function getKrakenHeadY() {
  return getKrakenHeadPos().y;
}

function updateMinimapVisibility() {
  const mm = el('minimap-container');
  if (!mm) {
    console.warn('Элемент #minimap-container не найден в HTML');
    return;
  }
  
  if (typeof inventory !== 'undefined' && inventory.map && started) {
    mm.classList.remove('hidden');
  } else {
    mm.classList.add('hidden');
  }
}
// ---------- Кнопки экрана ФИНАЛА ----------
const endingRestartBtn = el('endingRestartBtn');
if (endingRestartBtn) {
  endingRestartBtn.addEventListener('click', () => {
    currentLevel = 1;
    startLevel(1);
  });
}

const endingMapBtn = el('endingMapBtn');
if (endingMapBtn) {
  endingMapBtn.addEventListener('click', goToMap);
}


requestAnimationFrame(loop);

checkOrientation();