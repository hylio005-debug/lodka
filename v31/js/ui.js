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
  leaderboard: el('screen-leaderboard')
};

const hudEls = [
  el('hud'), el('hpbar'), el('hptext'), el('hint'),
  el('playerBadge'), el('gameControls'),
  el('mobileControls'), el('thrustButton')
];

function showScreen(name) {
  for (const k in screens) screens[k].classList.toggle('show', k === name);
  const playing = (name === null);
  hudEls.forEach(e => e && e.classList.toggle('hidden', !playing));
  const cv = el('game');
  if (cv) cv.classList.toggle('hidden', !playing);

  if (name === 'map') {
    if (typeof drawMapCanvas === 'function') drawMapCanvas();
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

async function tryLockLandscape() {
  if (!isTouch) return;
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}
}

function checkOrientation() {
  const warning = el('portraitWarning');
  if (!warning) return;
  if (!isTouch) {
    warning.classList.remove('show');
    return;
  }
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait && started) warning.classList.add('show');
  else warning.classList.remove('show');
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
    if (menuMusic) menuMusic.pause();
    if (gameMusic) gameMusic.pause();
    stopMotor();
  } else if (musicEnabled) {
    switchMusic('game');
  }
}

// ---------- Глобальные клавиши ----------
window.addEventListener('keydown', e => {
  if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')
      && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    toggleFullscreen();
  }
  if (e.key === 'Escape' && started) togglePause();
});

window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

updateFsIcon();
