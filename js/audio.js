// ================================================================
//  js/audio.js — МУЗЫКА + ЗВУКИ (Web Audio API + mp3)
//  Версия 5.0 — мотор через реальные mp3-сэмплы
// ================================================================

// ================================================================
//  ⚙️ НАСТРОЙКИ ЗВУКА — МЕНЯЙ ЗДЕСЬ
// ================================================================
// ================================================================
//  ⚙️ НАСТРОЙКИ ЗВУКА
//  Базовые значения — а ползунки в игре умножают их.
//  То есть: итоговая_громкость = базовая × ползунок × masterVolume
// ================================================================
const AUDIO_SETTINGS = {
  // ---------- УДАРЫ ----------
  wallHitVolume:      0.50,
  wallHitVolume2:     0.25,
  fishHitVolume:      0.40,
  fishHitVolume2:     0.22,

  // ---------- КОЛЬЦО / ФИНИШ / СМЕРТЬ ----------
  ringVolume:         0.20,
  ringVolume2:        0.12,
  finishVolume:       0.20,
  deathVolume:        0.20,

  // ---------- МОТОР ----------
  motorLayer1Volume:  0.30,
  motorLayer2Volume:  0.40,
  motorLayer3Volume:  0.50,
  motorSpeedLow:      0.33,
  motorSpeedHigh:     0.66,

  // ---------- МУЗЫКА ----------
  menuMusicVolume:    0.5,
  gameMusicVolume:    0.45,

  // ---------- ОБЩИЙ ----------
  masterVolume:       1.0
};

// ================================================================
//  🎚️ ПОЛЬЗОВАТЕЛЬСКИЕ МНОЖИТЕЛИ (из ползунков)
//  Значения 0..1. Сохраняются в localStorage.
// ================================================================
const USER_VOL = {
  music:  0.5,
  motor:  0.5,
  hits:   0.6,
  fx:     0.5,
  master: 1.0
};

try {
  const saved = localStorage.getItem('pogruzhenie_volumes');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(USER_VOL, parsed);
  }
} catch (e) {}

function saveUserVolume() {
  try {
    localStorage.setItem('pogruzhenie_volumes', JSON.stringify(USER_VOL));
  } catch (e) {}
}

// Итоговая громкость музыки = базовая × ползунок_музыки × ползунок_общей
function musicVolumeMultiplier() {
  return USER_VOL.music * USER_VOL.master;
}
// Итоговая громкость ударов
function hitsVolumeMultiplier() {
  return USER_VOL.hits * USER_VOL.master;
}
// Итоговая громкость эффектов (кольцо, финиш, смерть)
function fxVolumeMultiplier() {
  return USER_VOL.fx * USER_VOL.master;
}
// Итоговая громкость мотора
function motorVolumeMultiplier() {
  return USER_VOL.motor * USER_VOL.master;
}

// ================================================================

const menuMusic = document.getElementById('menuMusic');
const gameMusic = document.getElementById('gameMusic');
const muteBtn = document.getElementById('muteBtn');

function updateMuteIcon() {
  if (muteBtn) muteBtn.textContent = musicEnabled ? '🔊' : '🔇';
  const optMusic = document.getElementById('opt-music');
  if (optMusic) optMusic.textContent = musicEnabled ? 'включена' : 'выключена';
}

function startMusicIfAllowed() {
  if (!musicEnabled || musicStarted) return;
  musicStarted = true;
  if (menuMusic) {
    menuMusic.volume = AUDIO_SETTINGS.menuMusicVolume * AUDIO_SETTINGS.masterVolume;
    menuMusic.play().catch(() => { musicStarted = false; });
  }
}

function switchMusic(track) {
  if (menuMusic) menuMusic.pause();
  if (gameMusic) gameMusic.pause();
  if (!musicEnabled) return;
  if (track === 'menu' && menuMusic) {
    menuMusic.volume = AUDIO_SETTINGS.menuMusicVolume * AUDIO_SETTINGS.masterVolume;
    menuMusic.play().catch(() => {});
  } else if (track === 'game' && gameMusic) {
    gameMusic.volume = AUDIO_SETTINGS.gameMusicVolume * AUDIO_SETTINGS.masterVolume;
    gameMusic.play().catch(() => {});
  }
}

function toggleMute() {
  musicEnabled = !musicEnabled;
  soundEnabled = musicEnabled;
  try {
    localStorage.setItem('pogruzhenie_music', musicEnabled ? 'on' : 'off');
    localStorage.setItem('pogruzhenie_sound', soundEnabled ? 'on' : 'off');
  } catch (e) {}
  if (musicEnabled) {
    if (started) switchMusic('game');
    else switchMusic('menu');
  } else {
    if (menuMusic) menuMusic.pause();
    if (gameMusic) gameMusic.pause();
    stopMotor();
  }
  updateMuteIcon();
}

if (muteBtn) {
  muteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMute();
  });
}

// ================================================================
//  WEB AUDIO API
// ================================================================
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn('Web Audio API не поддерживается');
  }
}

function unlockAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type, volume, startDelay) {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime + (startDelay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime((volume || 0.15) * AUDIO_SETTINGS.masterVolume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ================================================================
//  УДАРЫ / КОЛЬЦО / ФИНИШ / СМЕРТЬ (синтез — как было)
// ================================================================
function soundWallHit() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(85, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.28);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(220, t0);
  filter.Q.value = 1;

  const vol = AUDIO_SETTINGS.wallHitVolume * AUDIO_SETTINGS.masterVolume;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(150, t0);
  osc2.frequency.exponentialRampToValueAtTime(70, t0 + 0.15);
  const vol2 = AUDIO_SETTINGS.wallHitVolume2 * AUDIO_SETTINGS.masterVolume;
  gain2.gain.setValueAtTime(0, t0);
  gain2.gain.linearRampToValueAtTime(vol2, t0 + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t0);
  osc2.stop(t0 + 0.25);
}

function soundFishHit() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.22);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t0);

  const vol = AUDIO_SETTINGS.fishHitVolume * AUDIO_SETTINGS.masterVolume;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.35);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(320, t0 + 0.03);
  osc2.frequency.exponentialRampToValueAtTime(180, t0 + 0.25);
  const vol2 = AUDIO_SETTINGS.fishHitVolume2 * AUDIO_SETTINGS.masterVolume;
  gain2.gain.setValueAtTime(0, t0 + 0.03);
  gain2.gain.linearRampToValueAtTime(vol2, t0 + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t0 + 0.03);
  osc2.stop(t0 + 0.35);
}

function soundRing() {
  if (!soundEnabled || !audioCtx) return;
  playTone(880, 0.22, 'sine', AUDIO_SETTINGS.ringVolume, 0);
  playTone(1320, 0.38, 'sine', AUDIO_SETTINGS.ringVolume2, 0.08);
}

function soundFinish() {
  if (!soundEnabled || !audioCtx) return;
  const v = AUDIO_SETTINGS.finishVolume;
  playTone(523, 0.3, 'sine', v, 0);
  playTone(659, 0.3, 'sine', v, 0.1);
  playTone(784, 0.5, 'sine', v, 0.2);
  playTone(1046, 0.7, 'sine', v * 0.75, 0.3);
}

function soundDeath() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.7);
  const vol = AUDIO_SETTINGS.deathVolume * AUDIO_SETTINGS.masterVolume;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.8);
}

// ================================================================
//  МОТОР — три mp3-сэмпла, плавное переключение по скорости
// ================================================================
let motorBuffers = { fan1: null, fan2: null, fan3: null };
let motorSources = { fan1: null, fan2: null, fan3: null };
let motorGains = { fan1: null, fan2: null, fan3: null };
let motorActive = false;
let motorBuffersLoaded = false;

// Загружаем три mp3-сэмпла один раз
async function loadMotorBuffers() {
  if (motorBuffersLoaded || !audioCtx) return;
  try {
    const urls = {
      fan1: 'music/fan/fan1.mp3',
      fan2: 'music/fan/fan2.mp3',
      fan3: 'music/fan/fan3.mp3'
    };
    const promises = Object.keys(urls).map(async (key) => {
      const resp = await fetch(urls[key]);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      motorBuffers[key] = audioBuffer;
    });
    await Promise.all(promises);
    motorBuffersLoaded = true;
    console.log('✅ Мотор: 3 mp3-сэмпла загружены');
  } catch (err) {
    console.error('❌ Ошибка загрузки mp3 мотора:', err);
  }
}

function startMotor() {
  if (!soundEnabled || !audioCtx || motorActive) return;
  if (!motorBuffersLoaded) {
    // Если буферы не загружены — пробуем загрузить и запуститься после
    loadMotorBuffers().then(() => {
      if (!motorActive && soundEnabled && audioCtx) startMotor();
    });
    return;
  }

  motorActive = true;
  const t0 = audioCtx.currentTime;

  // Создаём три источника, играющих одновременно
  Object.keys(motorBuffers).forEach(key => {
    const buf = motorBuffers[key];
    if (!buf) return;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t0);

    src.connect(gain);
    gain.connect(audioCtx.destination);

    src.start(t0);

    motorSources[key] = src;
    motorGains[key] = gain;
  });

  // Стартовое распределение — все слои чуть-чуть
  updateMotorSound(0);
}

function stopMotor() {
  if (!motorActive) return;
  motorActive = false;
  try {
    const t = audioCtx.currentTime;
    Object.keys(motorGains).forEach(key => {
      const g = motorGains[key];
      if (g) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.3);
      }
    });
    Object.keys(motorSources).forEach(key => {
      const s = motorSources[key];
      if (s) {
        try { s.stop(t + 0.4); } catch (e) {}
      }
    });
  } catch (e) {}
  motorSources = { fan1: null, fan2: null, fan3: null };
  motorGains = { fan1: null, fan2: null, fan3: null };
}

// intensity — от 0 (стоит) до 1 (максимальная скорость)
function updateMotorSound(intensity) {
  if (!motorActive) return;
  try {
    const t = audioCtx.currentTime;
    const i = Math.min(1, Math.max(0, intensity));
    const master = AUDIO_SETTINGS.masterVolume;

    // Веса трёх слоёв в зависимости от скорости
    let w1 = 0, w2 = 0, w3 = 0;
    const low = AUDIO_SETTINGS.motorSpeedLow;
    const high = AUDIO_SETTINGS.motorSpeedHigh;

    if (i <= low) {
      // Только fan1 — тихий
      w1 = 1 - (i / low) * 0.5;   // от 1.0 к 0.5
    } else if (i <= high) {
      // Переход fan1 → fan2
      const k = (i - low) / (high - low);   // 0..1
      w1 = 0.5 * (1 - k);
      w2 = k;
    } else {
      // Переход fan2 → fan3
      const k = (i - high) / (1 - high);
      w2 = 1 - k;
      w3 = k;
    }

    const v1 = w1 * AUDIO_SETTINGS.motorLayer1Volume * master;
    const v2 = w2 * AUDIO_SETTINGS.motorLayer2Volume * master;
    const v3 = w3 * AUDIO_SETTINGS.motorLayer3Volume * master;

    if (motorGains.fan1) motorGains.fan1.gain.linearRampToValueAtTime(v1, t + 0.15);
    if (motorGains.fan2) motorGains.fan2.gain.linearRampToValueAtTime(v2, t + 0.15);
    if (motorGains.fan3) motorGains.fan3.gain.linearRampToValueAtTime(v3, t + 0.15);
  } catch (e) {}
}

// Предзагрузка mp3 при первом клике (unlockAudio)
const _originalUnlockAudio = unlockAudio;
unlockAudio = function() {
  _originalUnlockAudio();
  loadMotorBuffers();
};

updateMuteIcon();
