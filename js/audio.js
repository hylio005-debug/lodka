// ================================================================
//  js/audio.js — МУЗЫКА + ЗВУКИ (Web Audio API)
//  Версия 4.0 — все громкости в блоке AUDIO_SETTINGS
// ================================================================

// ================================================================
//  ⚙️ НАСТРОЙКИ ЗВУКА — МЕНЯЙ ЗДЕСЬ
//  Значения от 0.0 (тишина) до 1.0 (максимум).
//  Меняй, сохраняй файл, обновляй игру (Ctrl+F5) — слышишь разницу.
// ================================================================
const AUDIO_SETTINGS = {
  // ---------- ГРОМКОСТЬ ОТДЕЛЬНЫХ ЗВУКОВ ----------
  // Удар о стену
  wallHitVolume:      0.50,   // основной «бум». Рекомендую 0.3–0.7
  wallHitVolume2:     0.25,   // «тело» удара. ~50% от основного

  // Удар о рыбу
  fishHitVolume:      0.80,   // основной тон
  fishHitVolume2:     0.50,   // тревожная нотка

  // Кольцо пройдено
  ringVolume:         0.20,   // «динь»
  ringVolume2:        0.12,   // второй тон

  // Финиш
  finishVolume:       0.20,   // каждая нота аккорда

  // Смерть
  deathVolume:        0.20,

  // ---------- МОТОР ----------
  motorVolume:        0.001,  // базовая громкость гула. Рекомендую 0.002–0.010
  motorVolumeDynamic: 0.001,  // добавка при разгоне (умножается на скорость)
  motorLfoAmount:     0.0001,  // амплитуда «дыхания». Рекомендую 0.0005–0.003

  // ---------- МУЗЫКА (mp3) ----------
  menuMusicVolume:    0.5,    // громкость меню
  gameMusicVolume:    0.45,   // громкость уровня

  // ---------- ОБЩИЙ ----------
  masterVolume:       1.0     // множитель для всего (0.0 – 1.0). 0.5 = в 2 раза тише всё
};

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

// Универсальный тон — громкость умножается на masterVolume
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
//  УДАР О СТЕНУ
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

// ================================================================
//  УДАР О РЫБУ
// ================================================================
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

// ================================================================
//  КОЛЬЦО
// ================================================================
function soundRing() {
  if (!soundEnabled || !audioCtx) return;
  playTone(880, 0.22, 'sine', AUDIO_SETTINGS.ringVolume, 0);
  playTone(1320, 0.38, 'sine', AUDIO_SETTINGS.ringVolume2, 0.08);
}

// ================================================================
//  ФИНИШ
// ================================================================
function soundFinish() {
  if (!soundEnabled || !audioCtx) return;
  const v = AUDIO_SETTINGS.finishVolume;
  playTone(523, 0.3, 'sine', v, 0);
  playTone(659, 0.3, 'sine', v, 0.1);
  playTone(784, 0.5, 'sine', v, 0.2);
  playTone(1046, 0.7, 'sine', v * 0.75, 0.3);
}

// ================================================================
//  СМЕРТЬ
// ================================================================
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
//  МОТОР
// ================================================================
let motorOsc1 = null;
let motorOsc2 = null;
let motorFilter = null;
let motorGain = null;
let motorLfo = null;
let motorLfoGain = null;
let motorActive = false;

function startMotor() {
  if (!soundEnabled || !audioCtx || motorActive) return;
  motorActive = true;
  const t0 = audioCtx.currentTime;

  motorOsc1 = audioCtx.createOscillator();
  motorOsc2 = audioCtx.createOscillator();

  motorOsc1.type = 'sine';
  motorOsc1.frequency.setValueAtTime(35, t0);

  motorOsc2.type = 'sine';
  motorOsc2.frequency.setValueAtTime(52, t0);

  motorFilter = audioCtx.createBiquadFilter();
  motorFilter.type = 'lowpass';
  motorFilter.frequency.setValueAtTime(120, t0);
  motorFilter.Q.value = 0.5;

  motorGain = audioCtx.createGain();
  motorGain.gain.setValueAtTime(0, t0);
  const baseVol = AUDIO_SETTINGS.motorVolume * AUDIO_SETTINGS.masterVolume;
  motorGain.gain.linearRampToValueAtTime(baseVol, t0 + 0.6);

  motorLfo = audioCtx.createOscillator();
  motorLfo.type = 'sine';
  motorLfo.frequency.setValueAtTime(0.4, t0);
  motorLfoGain = audioCtx.createGain();
  motorLfoGain.gain.setValueAtTime(AUDIO_SETTINGS.motorLfoAmount * AUDIO_SETTINGS.masterVolume, t0);

  motorLfo.connect(motorLfoGain);
  motorLfoGain.connect(motorGain.gain);

  motorOsc1.connect(motorFilter);
  motorOsc2.connect(motorFilter);
  motorFilter.connect(motorGain);
  motorGain.connect(audioCtx.destination);

  motorOsc1.start(t0);
  motorOsc2.start(t0);
  motorLfo.start(t0);
}

function stopMotor() {
  if (!motorActive) return;
  motorActive = false;
  try {
    const t = audioCtx.currentTime;
    motorGain.gain.cancelScheduledValues(t);
    motorGain.gain.setValueAtTime(motorGain.gain.value, t);
    motorGain.gain.linearRampToValueAtTime(0, t + 0.3);
    motorOsc1.stop(t + 0.4);
    motorOsc2.stop(t + 0.4);
    motorLfo.stop(t + 0.4);
  } catch (e) {}
  motorOsc1 = null;
  motorOsc2 = null;
  motorLfo = null;
  motorLfoGain = null;
  motorFilter = null;
  motorGain = null;
}

function updateMotorSound(intensity) {
  if (!motorActive || !motorGain || !motorFilter) return;
  try {
    const t = audioCtx.currentTime;
    const i = Math.min(1, Math.max(0, intensity));

    const vol = (AUDIO_SETTINGS.motorVolume + i * AUDIO_SETTINGS.motorVolumeDynamic)
              * AUDIO_SETTINGS.masterVolume;
    motorGain.gain.cancelScheduledValues(t);
    motorGain.gain.linearRampToValueAtTime(vol, t + 0.2);

    if (motorOsc1) motorOsc1.frequency.setValueAtTime(35 + i * 5, t);
    if (motorOsc2) motorOsc2.frequency.setValueAtTime(52 + i * 8, t);

    motorFilter.frequency.setValueAtTime(120 + i * 40, t);
  } catch (e) {}
}

updateMuteIcon();
