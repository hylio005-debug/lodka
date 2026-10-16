// ================================================================
//  js/map.js — КАРТА УРОВНЕЙ
// ================================================================

function updateMapInfo() {
  const info = el('mapPlayerInfo');
  if (currentPlayer) {
    if (currentPlayer.source === 'nick') {
      info.textContent = `👤 ${currentPlayer.short} · Прогресс: ${playerProgress} / ${MAX_LEVEL}`;
    } else {
      info.textContent = `${currentPlayer.klass} — ${currentPlayer.short} · Прогресс: ${playerProgress} / ${MAX_LEVEL}`;
    }
  } else {
    info.textContent = 'Выберите игрока';
  }
}

function drawMapCanvas() {
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

  const points = LEVELS_META.map(meta => ({
    x: meta.mapX * mW,
    y: (1 - meta.mapY) * mH,
    meta: meta
  }));

  mctx.strokeStyle = 'rgba(212, 162, 89, 0.5)';
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
    const isUnlocked = levelId <= playerProgress;
    const isPassed = levelId < playerProgress;

    const pulse = isUnlocked && !isPassed ? 1 + Math.sin(t * 3 + i) * 0.1 : 1;
    const r = 22 * pulse;

    if (isUnlocked) {
      const glow = mctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2);
      glow.addColorStop(0, isPassed ? 'rgba(110, 231, 135, 0.4)' : 'rgba(255, 220, 130, 0.5)');
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
      grad.addColorStop(0, '#ffd166');
      grad.addColorStop(1, '#a87c37');
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
    mctx.fillText('Ур. ' + levelId, p.x, p.y + r + 14);

    mctx.font = '11px monospace';
    mctx.fillStyle = isUnlocked ? '#7fd6ff' : '#5a6a7a';
    mctx.fillText(p.meta.name, p.x, p.y + r + 28);

    if (!isUnlocked) {
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
  mctx.fillStyle = '#ffd166';
  mctx.textAlign = 'center';
  mctx.fillText('Для открытия следующего сектора нужно ≥ ' + UNLOCK_THRESHOLD + '%', mW / 2, mH - 12);
}

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
