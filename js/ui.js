// ================================================================
//  js/ui.js — ЭКРАНЫ, ТОСТЫ, ПАУЗА, FULLSCREEN
// ================================================================

const el = id => document.getElementById(id);

const screens = {
  splash:      el('screen-splash'),
  select:      el('screen-select'),
  map:         el('screen-map'),
  story:       el('screen-story'),
  controls:    el('screen-controls'),
  options:     el('screen-options'),
  stats:       el('screen-stats'),
  leaderboard: el('screen-leaderboard'),
  artifact:    el('screen-artifact'),
  fail:        el('screen-fail'),
  ending:      el('screen-ending'),
  multiplayer: el('screen-multiplayer'),
};

const hudEls = [
  el('hud'), el('hpbar'), el('hptext'), el('hint'),
  el('playerBadge'), el('gameControls'), el('startHint'),
  el('mobileControls'), el('thrustButton'), el('mobileArtifacts'),
  el('cooldownPanel'), el('energybar'), el('energytext')
];

function showScreen(name) {
  for (const k in screens) {
    if (screens[k]) screens[k].classList.toggle('show', k === name);
  }
  const playing = (name === null);
  hudEls.forEach(e => {
    if (e) {
      if (e.id === 'startHint') {
        // startHint управляется отдельно в game.js
      } else {
        e.classList.toggle('hidden', !playing);
      }
    }
  });
  const cv = el('game');
  if (cv) cv.classList.toggle('hidden', !playing);

  if (name === 'map') {
    if (typeof drawMapCanvas === 'function') drawMapCanvas();
    updateMapInfo();
  }

  if (typeof musicEnabled !== 'undefined' && musicEnabled) {
    if (playing) switchMusic('game');
    else switchMusic('menu');
  }
}

// ---------- Тост ----------
function showToast(message) {
  const existing = document.querySelector('.game-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'game-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ---------- Fullscreen ----------
const fsBtn = el('fsBtn');
const winBtn = el('winBtn');
const fsIconExpand = el('fsIconExpand');
const fsIconCollapse = el('fsIconCollapse');

function isFullscreen() {
  return document.fullscreenElement || document.webkitFullscreenElement
      || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function toggleFullscreen() {
  const elem = document.documentElement;
  if (!isFullscreen()) {
    const req = elem.requestFullscreen || elem.webkitRequestFullscreen
             || elem.mozRequestFullScreen || elem.msRequestFullscreen;
    if (req) {
      try {
        const p = req.call(elem);
        if (p && p.catch) p.catch(() => showToast('⚠️ Полный экран заблокирован'));
      } catch (e) { showToast('⚠️ Полный экран заблокирован'); }
    }
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen
              || document.mozCancelFullScreen || document.msExitFullscreen;
    if (exit) exit.call(document);
  }
}

function openInWindow() {
  try {
    const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'fullscreen=yes,width=' + screen.width + ',height=' + screen.height);
    if (w) {
      showToast('✨ Открыто в новом окне');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      showToast('⚠️ Разрешите всплывающие окна');
    }
  } catch (e) { showToast('⚠️ Не удалось открыть'); }
}

function updateFsIcon() {
  const full = !!isFullscreen();
  if (fsIconExpand) fsIconExpand.style.display = full ? 'none' : 'block';
  if (fsIconCollapse) fsIconCollapse.style.display = full ? 'block' : 'none';
}

function bind(el, handler) {
  if (!el) return;
  el.addEventListener('click', e => { e.preventDefault(); handler(); });
  el.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
}

bind(fsBtn, toggleFullscreen);
bind(winBtn, openInWindow);

document.addEventListener('fullscreenchange', updateFsIcon);
document.addEventListener('webkitfullscreenchange', updateFsIcon);

// ---------- Пауза ----------
function togglePause() {
  if (!started) return;
  paused = !paused;
  el('pauseOverlay').classList.toggle('show', paused);
  if (paused) {
    if (musicEnabled && typeof menuMusic !== 'undefined') menuMusic.pause();
    if (musicEnabled && typeof gameMusic !== 'undefined') gameMusic.pause();
    stopMotor();
    updateArtifactUI();
    
    // Сбрасываем нажатия, чтобы лодка не поплыла сама после паузы
    mouse.down = false;
    mouse.rightDown = false;
    if (typeof thrust !== 'undefined') thrust.pressed = false;
    if (typeof winchState !== 'undefined') winchState = 'idle'; // Сбрасываем лебедку
  } else if (musicEnabled) {
    switchMusic('game');
  }
}

// ---------- Обновление панели артефактов в паузе ----------
function updateArtifactUI() {
  const btns = {
    map: el('artMapBtn'),
    winch: el('artWinchBtn'),
    flashlight: el('artFlashBtn'),
    torpedo: el('artTorpedoBtn')
  };
  
  for (const key in btns) {
    const btn = btns[key];
    if (!btn) continue;
    if (inventory[key]) {
      btn.classList.remove('off');
      btn.classList.add('active');
    } else {
      btn.classList.add('off');
      btn.classList.remove('active');
    }
  }

  // Мобильные кнопки
  const mobW = el('mobWinchBtn');
  const mobF = el('mobFlashBtn');
  const mobT = el('mobTorpedoBtn');
  if (mobW) mobW.style.display = inventory.winch ? 'flex' : 'none';
  if (mobF) mobF.style.display = inventory.flashlight ? 'flex' : 'none';
  if (mobT) mobT.style.display = inventory.torpedo ? 'flex' : 'none';
}

// ---------- Глобальные клавиши ----------
window.addEventListener('keydown', e => {
  if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')
      && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    // F уже обрабатывается в game.js для прожектора, но оставим фолбэк для фуллскрина
    if (!inventory.flashlight) toggleFullscreen();
  }
});
// ---------- Ориентация для мобилок ----------
function checkOrientation() {
  const warning = el('portraitWarning');
  if (!warning) return;
  if (!isTouch) {
    warning.classList.remove('show');
    return;
  }
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait && started) {
    warning.classList.add('show');
  } else {
    warning.classList.remove('show');
  }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

updateFsIcon();