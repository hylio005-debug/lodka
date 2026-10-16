// ================================================================
//  js/game.js — ЛОГИКА, ЦИКЛ, СТАТИСТИКА, ОТПРАВКА
// ================================================================

// ---------- Ввод: мышь ----------
const mouse = { x: 0, y: 0, down: false };

canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { mouse.down = true; e.preventDefault(); }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.down = false;
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  mouse.x = sx / zoom + camera.x;
  mouse.y = sy / zoom + camera.y;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Стик ----------
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

// ---------- Мотор ----------
const thrustBtn = el('thrustBtn');
const thrust = { pressed: false, pointerId: null };

function thrustDown(pointerId) {
  thrust.pressed = true;
  thrust.pointerId = pointerId;
  thrustBtn.classList.add('active');
  thrustButton.classList.add('active');
}
function thrustUp() {
  thrust.pressed = false;
  thrust.pointerId = null;
  thrustBtn.classList.remove('active');
  thrustButton.classList.remove('active');
}

thrustBtn.addEventListener('pointerdown', e => {
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

// ---------- Геометрия ----------
function circleVsSegment(cx, cy, r, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy || 1e-6;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  const ddx = cx - px, ddy = cy - py;
  const dist2 = ddx*ddx + ddy*ddy;
  if (dist2 < r*r) {
    const dist = Math.sqrt(dist2) || 1e-6;
    return { hit: true, nx: ddx / dist, ny: ddy / dist, px, py, depth: r - dist };
  }
  return { hit: false };
}
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------- Обновление мира из уровня ----------
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
      mouthPhase: Math.random() * Math.PI * 2
    });
  });

  sub.x = data.start ? data.start.x : 100;
  sub.y = data.start ? data.start.y : 980;
  sub.vx = 0; sub.vy = 0;
  sub.angle = 0; sub.angVel = 0;
  sub.hp = MAX_HP; sub.invuln = 0;
  sub.animTime = 0; sub.propellerAngle = 0; sub.bubbleTimer = 0;

  currentRingIndex = 0;
  ringsCollected = 0;

  updateZoom();
  updateCamera();
}

// ---------- Запуск уровня ----------
function startLevel(levelId) {
  if (typeof LEVELS === 'undefined' || !LEVELS[levelId]) {
    showToast('⚠️ Уровень ' + levelId + ' не найден');
    return;
  }
  currentLevelData = LEVELS[levelId];
  updateWorldFromLevel(currentLevelData);
  prepareRun();
  showScreen(null);
  if (gameMusic) {
    const musicSrc = currentLevelData.music || 'music/level1.mp3';
    const source = gameMusic.querySelector('source');
    if (source) source.src = musicSrc;
    gameMusic.load();
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
  checkOrientation();
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

  // Водоросли
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
  sub.animTime += dt;

  let targetAngle = null;
  if (isTouch && stick.active) {
    const len = Math.hypot(stick.dx, stick.dy);
    if (len > 0.15) targetAngle = Math.atan2(stick.dy, stick.dx);
  } else if (!isTouch) {
    const dxm = mouse.x - sub.x, dym = mouse.y - sub.y;
    if (Math.hypot(dxm, dym) > 30) targetAngle = Math.atan2(dym, dxm);
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

  const thrustOn = isTouch ? thrust.pressed : mouse.down;
  const fx = Math.cos(sub.angle), fy = Math.sin(sub.angle);

  if (thrustOn) {
    sub.vx += (fx * sub.maxThrust - sub.vx) * sub.thrustAccel;
    sub.vy += (fy * sub.maxThrust - sub.vy) * sub.thrustAccel;
  } else {
    sub.vx += (0 - sub.vx) * sub.fallBlend;
    sub.vy += (FALL_SPEED - sub.vy) * sub.fallBlend;
  }

  sub.x += sub.vx * dt;
  sub.y += sub.vy * dt;

  // Мотор
  if (thrustOn) {
    if (!motorActive) startMotor();
    const intensity = Math.min(1, Math.hypot(sub.vx, sub.vy) / sub.maxThrust);
    updateMotorSound(intensity);
  } else {
    if (motorActive) stopMotor();
  }

  const speed = Math.hypot(sub.vx, sub.vy);
  sub.propellerAngle += (4 + speed * 0.15) * dt;

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
    for (let i = currentRingIndex + 1; i < rings.length; i++) {
      const r = rings[i];
      if (r.passed) continue;
      const dx = sub.x - r.x, dy = sub.y - r.y;
      if (Math.hypot(dx, dy) < r.r) {
        if (!missedRingWarning) {
          missedRingWarning = true;
          setTimeout(() => { missedRingWarning = false; }, 2000);
        }
      }
    }
  }

  // Стены
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

  // Рыбы
  for (const f of fishes) {
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

// ================================================================
//  КОЛЛИЗИЯ С РЫБОЙ (эллипс) + ФОНАРИК УДИЛЬЩИКА (круг)
// ================================================================

// Размеры эллипса рыбы (совпадают с визуалом)
const isAngler = f.type === 'angler';
const rx = isAngler ? f.r * 1.5 : f.r * 1.4;   // полуось X
const ry = isAngler ? f.r * 1.0 : f.r * 0.9;   // полуось Y

// Нормализованное расстояние до центра эллипса
const bodyDx = sub.x - f.x;
const bodyDy = sub.y - f.y;
const bodyNx = bodyDx / (rx + sub.r);
const bodyNy = bodyDy / (ry + sub.r);
const bodyDist = bodyNx * bodyNx + bodyNy * bodyNy;

let hitBody = bodyDist < 1;

// Дополнительный хитбокс для фонарика-приманки удильщика
let hitLure = false;
if (isAngler) {
  // Фонарик вынесен вперёд: центр в (f.r*0.9, -f.r*2.0) относительно рыбы,
  // но с учётом направления dir
  const dir = f.dir >= 0 ? 1 : -1;
  const lureX = f.x + dir * f.r * 0.9;
  const lureY = f.y - f.r * 2.0;
  const lureR = f.r * 0.3;   // радиус светящегося шарика
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
  // Отталкивание от центра столкновения
  let pushX, pushY;
  if (hitBody) {
    pushX = -bodyDx;
    pushY = -bodyDy;
  } else {
    pushX = sub.x - (f.x + (f.dir >= 0 ? 1 : -1) * f.r * 0.9);
    pushY = sub.y - (f.y - f.r * 2.0);
  }
  const d = Math.hypot(pushX, pushY) || 1;
  const ux = pushX / d, uy = pushY / d;
  sub.x += ux * 2; sub.y += uy * 2;
  sub.vx += ux * 30; sub.vy += uy * 30;
}
  }

  updateAmbientBubbles(dt);
  if (sub.invuln > 0) sub.invuln -= dt;

  if (sub.hp <= 0) { sub.hp = 0; die(); return; }

  // Финиш
  const fdx = sub.x - finish.x, fdy = sub.y - finish.y;
  if (Math.hypot(fdx, fdy) < finish.r - 4) {
    if (levelType === 'rings' && ringsCollected < ringsRequired) {
      if (!finishBlockedWarning) {
        finishBlockedWarning = true;
        showToast('🔒 Не собраны все благословенные кольца (' + ringsCollected + '/' + ringsRequired + ')');
        setTimeout(() => { finishBlockedWarning = false; }, 2500);
      }
    } else {
      win();
      return;
    }
  }

  elapsed += dt;
  updateCamera();
}

function win() {
  running = false;
  resultState = 'win';
  stopMotor();
  soundFinish();
  finalizeRun();
  showStats('Сектор пройден!');
}
function die() {
  running = false;
  resultState = 'dead';
  stopMotor();
  soundDeath();
  finalizeRun();
  showStats('Дрон потерян');
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

function updateHud() {
  let hudHtml = `Время: ${elapsed.toFixed(1)}s<br>`;
  if (levelType === 'rings') {
    hudHtml += `Кольца: ${ringsCollected}/${ringsRequired}<br>`;
  }
  hudHtml += `Касания стен: ${wallHits}<br>`;
  hudHtml += `Корпус: ${Math.round(Math.max(0, sub.hp))}`;
  hud.innerHTML = hudHtml;

  const hpPct = Math.max(0, Math.min(100, sub.hp));
  hpfill.style.width = hpPct + '%';
  hptext.textContent = 'Корпус: ' + Math.round(hpPct);

  if (hpPct > 60) hpfill.style.background = 'linear-gradient(90deg, #6ee787, #3ddc84)';
  else if (hpPct > 30) hpfill.style.background = 'linear-gradient(90deg, #ffd166, #ffb347)';
  else hpfill.style.background = 'linear-gradient(90deg, #ff6b6b, #e63946)';
}

// ---------- Отправка ----------


// ---------- Статистика ----------
async function showStats(title) {
  el('result-title').textContent = title;
  const run = currentRun;
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

  let html = '';
  for (const [k, v] of rows) {
    html += `<div class="row"><span>${k}</span><span class="val">${v}</span></div>`;
  }
  el('stats').innerHTML = html;

  if (run.resultState === 'win' && accuracy < UNLOCK_THRESHOLD) {
    setTimeout(() => {
      alert('Вы были недостаточно точны.\nНа последнем повороте ваш дрон потерпел крушение.\n\nДля перехода в следующий сектор нужно ≥ ' + UNLOCK_THRESHOLD + '% точности.');
    }, 300);
  }

  el('sendStatus').textContent = '⏳ Отправка результата...';
  el('sendStatus').style.color = '#ffd166';

  showScreen('stats');

  if (!scoreSent && currentPlayer && run.resultState === 'win') {
    scoreSent = true;
    const result = await sendResult(currentLevel, accuracy);
    if (result.ok) {
      el('sendStatus').textContent = '✅ Результат отправлен в таблицу';
      el('sendStatus').style.color = '#6ee787';
    } else {
      el('sendStatus').textContent = '⚠️ Нет связи с таблицей';
      el('sendStatus').style.color = '#ff6b6b';
    }
  }

  if (run.resultState === 'win' && accuracy >= UNLOCK_THRESHOLD) {
    if (currentLevel + 1 > playerProgress && currentLevel < MAX_LEVEL) {
      playerProgress = currentLevel + 1;
    }
  }
}

// ---------- Лидерборд ----------


function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// ---------- Кнопки игрового меню ----------
el('pauseBtn').addEventListener('click', togglePause);
el('pauseResume').addEventListener('click', () => {
  paused = false; el('pauseOverlay').classList.remove('show');
  if (musicEnabled) switchMusic('game');
});
el('pauseRestart').addEventListener('click', () => {
  paused = false; el('pauseOverlay').classList.remove('show');
  startLevel(currentLevel);
});
el('pauseExit').addEventListener('click', () => {
  paused = false; el('pauseOverlay').classList.remove('show');
  goToMap();
});
el('restartBtn').addEventListener('click', () => { startLevel(currentLevel); });
el('exitBtn').addEventListener('click', goToMap);

el('storyBack').addEventListener('click', () => {
  if (currentPlayer) goToMap(); else showScreen('splash');
});
el('controlsBack').addEventListener('click', () => {
  if (currentPlayer) goToMap(); else showScreen('splash');
});
el('optionsBack').addEventListener('click', () => {
  if (currentPlayer) goToMap(); else showScreen('splash');
});
el('statsRestart').addEventListener('click', () => { startLevel(currentLevel); });
el('statsMap').addEventListener('click', goToMap);
el('statsMenu').addEventListener('click', goToMap);
el('lbBack').addEventListener('click', () => {
  if (currentPlayer) goToMap(); else showScreen('splash');
});

el('playBtn').addEventListener('click', () => {
  unlockAudio();
  startMusicIfAllowed();
  goToSelectPlayer();
});

el('opt-quality').addEventListener('change', (e) => {
  qualityLevel = e.target.value;
  try { localStorage.setItem('pogruzhenie_quality', qualityLevel); } catch (e) {}
  showToast('Качество: ' + qualityLevel);
});
el('opt-render').addEventListener('change', (e) => {
  renderScale = parseFloat(e.target.value);
  try { localStorage.setItem('pogruzhenie_render_scale', renderScale.toString()); } catch (e) {}
  resize();
  showToast('Разрешение: ' + renderScale);
});

// ---------- goToMap ----------
function goToMap() {
  started = false; running = false; paused = false;
  el('pauseOverlay').classList.remove('show');
  stickEnd(); thrustUp(); stopMotor();
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
    updateHud();
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
requestAnimationFrame(loop);

setTimeout(() => {
  const optQ = el('opt-quality');
  const optR = el('opt-render');
  if (optQ) optQ.value = qualityLevel;
  if (optR) optR.value = renderScale.toString();
}, 100);

checkOrientation();
