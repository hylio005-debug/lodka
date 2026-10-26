// ================================================================
//  js/map.js — КАРТА УРОВНЕЙ
// ================================================================
// ================================================================
//  УЧЁТ ПРОХОЖДЕНИЯ ТРЕНИРОВКИ (привязан к игроку)
// ================================================================
let completedTraining = [];

function getTrainingKey() {
  if (!currentPlayer) return null;
  const safeKlass = (currentPlayer.klass === '—' || !currentPlayer.klass) ? 'nick' : currentPlayer.klass;
  return 'pogruzhenie_training_' + safeKlass + '_' + currentPlayer.short;
}

function loadTrainingForPlayer() {
  completedTraining = [];
  const key = getTrainingKey();
  if (!key) return;
  try {
    const saved = localStorage.getItem(key);
    if (saved) completedTraining = JSON.parse(saved) || [];
  } catch (e) {}
  
  // Если на сервере прогресс кампании > 1, значит тренировка уже неактуальна
  if (typeof playerProgress !== 'undefined' && playerProgress > 1) {
    completedTraining = ['T1', 'T2', 'T3', 'T4', 'T5']; // Помечаем как пройденную
  }

  console.log(`🎓 Тренировка загружена: ${completedTraining.length}/5 для ${key}`);
}

function isTrainingComplete() {
  // Если прогресс кампании больше 1, значит игрок уже играет, тренировка не нужна
  if (typeof playerProgress !== 'undefined' && playerProgress > 1) {
    return true;
  }
  return completedTraining.length >= 5;
}

function saveTrainingCompletion(levelId) {
  if (!completedTraining.includes(levelId)) {
    completedTraining.push(levelId);
    const key = getTrainingKey();
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(completedTraining));
      } catch (e) {}
    }
    console.log(`🎓 Тренировка: пройдено ${completedTraining.length}/5 (${levelId})`);
  }
}

function getTrainingProgressText() {
  const done = completedTraining.length;
  if (done >= 5) return '✅ Тренировка завершена!';
  return `🎓 Прогресс: ${done}/5 уровней`;
}
function updateMapInfo() {
  const info = el('mapPlayerInfo');
  if (!info) return;
  
  const modeLabel = currentMapMode === 'training' 
    ? `🎓 Тренировка (${completedTraining.length}/5)` 
    : '🗺️ Кампания';
  
  if (currentPlayer) {
    if (currentPlayer.source === 'nick') {
      info.textContent = `${modeLabel} · 👤 ${currentPlayer.short}`;
    } else {
      info.textContent = `${modeLabel} · ${currentPlayer.klass} — ${currentPlayer.short}`;
    }
  } else {
    info.textContent = modeLabel;
  }
  
  // Обновить блокировку кампании
  if (typeof updateModeTabs === 'function') updateModeTabs();
}

let currentMapMode = 'training'; // По умолчанию — тренировка

function drawMapCanvas() {
  // ⚡ ПРИНУДИТЕЛЬНЫЙ ПЕРЕХОД В ТРЕНИРОВКУ, если она не пройдена
  if (typeof isTrainingComplete === 'function' && !isTrainingComplete() && currentMapMode === 'campaign') {
    currentMapMode = 'training';
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'training');
    });
  }

  const mapCanvas = el('mapCanvas');
  if (!mapCanvas) return;
  const mctx = mapCanvas.getContext('2d');
  const mW = mapCanvas.width;
  const mH = mapCanvas.height;

  mctx.fillStyle = '#0a1a28';
  mctx.fillRect(0, 0, mW, mH);

  const seaGrad = mctx.createLinearGradient(0, 0, mW, mH);
  seaGrad.addColorStop(0, '#0f3a5a');
  seaGrad.addColorStop(0.5, '#1a4a6a');
  seaGrad.addColorStop(1, '#0a2a48');
  mctx.fillStyle = seaGrad;
  mctx.fillRect(0, 0, mW, mH);

  mctx.strokeStyle = 'rgba(127, 214, 255, 0.08)';
  mctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const y = (i / 12) * mH + Math.sin(i * 1.3) * 5;
    mctx.beginPath();
    mctx.moveTo(0, y);
    for (let x = 0; x <= mW; x += 30) {
      mctx.lineTo(x, y + Math.sin(x * 0.02 + i * 0.5) * 4);
    }
    mctx.stroke();
  }

  // Выбор массива уровней в зависимости от режима
  const activeMeta = currentMapMode === 'training' ? TRAINING_LEVELS_META : LEVELS_META;

  const points = activeMeta.map(meta => ({
    x: meta.mapX * mW,
    y: (1 - meta.mapY) * mH,
    meta: meta
  }));

  mctx.strokeStyle = currentMapMode === 'training' 
    ? 'rgba(110, 231, 135, 0.5)' 
    : 'rgba(212, 162, 89, 0.5)';
  mctx.lineWidth = 2;
  mctx.setLineDash([6, 8]);
  mctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) mctx.moveTo(p.x, p.y);
    else mctx.lineTo(p.x, p.y);
  });
  mctx.stroke();
  mctx.setLineDash([]);

  const t = Date.now() / 1000;
  points.forEach((p, i) => {
    const levelId = p.meta.id;
    
    // Для кампании — обычная логика разблокировки
    // Для тренировки — все разблокированы
    let isUnlocked, isPassed;
    if (currentMapMode === 'training') {
      // Прогрессивная разблокировка: T1 всегда, T2 после T1 и т.д.
      const trainingIndex = activeMeta.findIndex(m => m.id === levelId);
      isUnlocked = trainingIndex <= completedTraining.length;
      isPassed = completedTraining.includes(levelId);
    } else {
      isUnlocked = levelId <= playerProgress;
      isPassed = levelId < playerProgress;
    }

    const pulse = isUnlocked && !isPassed ? 1 + Math.sin(t * 3 + i) * 0.1 : 1;
    const r = 22 * pulse;

    if (isUnlocked) {
      const glow = mctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2);
      const glowColor = currentMapMode === 'training' 
        ? 'rgba(110, 231, 135, 0.5)' 
        : 'rgba(255, 220, 130, 0.5)';
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
      mctx.fillStyle = glow;
      mctx.beginPath();
      mctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
      mctx.fill();
    }

    const grad = mctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, r);
    if (isPassed) {
      grad.addColorStop(0, '#a4ffb4');
      grad.addColorStop(1, '#2e8b57');
    } else if (isUnlocked) {
      if (currentMapMode === 'training') {
        grad.addColorStop(0, '#a4ffb4');
        grad.addColorStop(1, '#2e8b57');
      } else {
        grad.addColorStop(0, '#ffd166');
        grad.addColorStop(1, '#a87c37');
      }
    } else {
      grad.addColorStop(0, '#3a4a5a');
      grad.addColorStop(1, '#1a2a3a');
    }
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    mctx.fill();

    mctx.strokeStyle = isUnlocked ? '#ffd166' : '#1e3a55';
    mctx.lineWidth = 2;
    mctx.stroke();

    mctx.font = '22px sans-serif';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';
    mctx.fillStyle = '#ffffff';
    mctx.fillText(p.meta.icon, p.x, p.y);

    mctx.font = 'bold 11px monospace';
    mctx.fillStyle = isUnlocked ? '#ffffff' : '#7a8a9a';
    const label = currentMapMode === 'training' ? p.meta.name : ('Ур. ' + levelId);
    mctx.fillText(label, p.x, p.y + r + 14);

    if (currentMapMode === 'campaign' && !isUnlocked) {
      mctx.font = '14px sans-serif';
      mctx.fillStyle = '#7a8a9a';
      mctx.fillText('🔒', p.x + r * 0.7, p.y - r * 0.7);
    }
    if (isPassed) {
      mctx.font = '14px sans-serif';
      mctx.fillStyle = '#2e8b57';
      mctx.fillText('✅', p.x + r * 0.7, p.y - r * 0.7);
    }
  });

  mctx.font = '11px monospace';
  mctx.fillStyle = currentMapMode === 'training' ? '#6ee787' : '#ffd166';
  mctx.textAlign = 'center';
  let footer;
  if (currentMapMode === 'training') {
    if (isTrainingComplete()) {
      footer = '✅ Тренировка завершена! Кампания разблокирована.';
    } else {
      footer = `🎓 Тренировка: ${completedTraining.length}/5 · Пройдите все для доступа к кампании`;
    }
  } else {
    footer = 'Для открытия следующего сектора нужно ≥ ' + UNLOCK_THRESHOLD + '%';
  }
  mctx.fillText(footer, mW / 2, mH - 12);
}

// ---------- Переключение вкладок ----------
// ---------- Переключение вкладок ----------
function updateModeTabs() {
  const campaignTab = document.querySelector('.mode-tab[data-mode="campaign"]');
  if (campaignTab) {
    if (isTrainingComplete()) {
      campaignTab.classList.remove('locked');
      campaignTab.title = 'Кампания';
    } else {
      campaignTab.classList.add('locked');
      campaignTab.title = 'Кампания (сначала пройдите тренировку)';
    }
  }
}

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    
    if (tab.classList.contains('disabled')) {
      showToast('⚔️ Скоро появится!');
      return;
    }
    
    // ⚔️ Мультиплеер — открываем отдельный экран
    if (mode === 'multiplayer') {
      showScreen('multiplayer');
      if (typeof initMultiplayer === 'function') initMultiplayer();
      return;
    }
    
    if (mode === 'speedrun') {
      showToast('⏱️ Спидран скоро появится!');
      return;
    }
    if (mode === 'campaign' && !isTrainingComplete()) {
      showToast(`🔒 Пройдите тренировку (${completedTraining.length}/5)`);
      return;
    }
    
    currentMapMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => 
      t.classList.toggle('active', t === tab)
    );
    drawMapCanvas();
    updateMapInfo();
  });
});

// Проверить блокировку кампании при загрузке
updateModeTabs();

// ---------- Клик по карте ----------
el('mapCanvas').addEventListener('click', (e) => {
  const mapCanvas = el('mapCanvas');
  const rect = mapCanvas.getBoundingClientRect();
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const mW = mapCanvas.width;
  const mH = mapCanvas.height;

  const activeMeta = currentMapMode === 'training' ? TRAINING_LEVELS_META : LEVELS_META;

  for (const meta of activeMeta) {
    const px = meta.mapX * mW;
    const py = (1 - meta.mapY) * mH;
    const dist = Math.hypot(clickX - px, clickY - py);
    if (dist <= 40) {
      if (currentMapMode === 'training') {
        currentLevel = meta.id;
        startLevel(meta.id);
      } else {
        if (meta.id <= playerProgress) {
          currentLevel = meta.id;
          startLevel(meta.id);
        } else {
          showToast('🔒 Сектор закрыт. Пройдите предыдущие на ' + UNLOCK_THRESHOLD + '%+');
        }
      }
      return;
    }
  }
});


// ---------- Клик по карте ----------
el('mapCanvas').addEventListener('click', (e) => {
  const mapCanvas = el('mapCanvas');
  const rect = mapCanvas.getBoundingClientRect();
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const mW = mapCanvas.width;
  const mH = mapCanvas.height;

  for (const meta of LEVELS_META) {
    const px = meta.mapX * mW;
    const py = (1 - meta.mapY) * mH;
    const dist = Math.hypot(clickX - px, clickY - py);
    if (dist <= 40) {
      if (meta.id <= playerProgress) {
        currentLevel = meta.id;
        startLevel(meta.id);
      } else {
        showToast('🔒 Сектор закрыт. Пройдите предыдущие на ' + UNLOCK_THRESHOLD + '%+');
      }
      return;
    }
  }
});

// ---------- Пульсация карты ----------
setInterval(() => {
  if (screens.map && screens.map.classList.contains('show')) {
    drawMapCanvas();
  }
}, 200);

// ---------- Кнопки на карте ----------
el('mapStoryBtn').addEventListener('click', () => showScreen('story'));
el('mapControlsBtn').addEventListener('click', () => showScreen('controls'));
el('mapLeaderboardBtn').addEventListener('click', () => {
  loadLeaderboard();
  showScreen('leaderboard');
});
