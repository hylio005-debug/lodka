// ================================================================
//  js/audio.js — МУЗЫКА + ЗВУКИ (Web Audio API + mp3)
//  Версия 5.1 — ползунки громкости + кнопки прослушивания
// ================================================================

// ================================================================
//  ⚙️ БАЗОВЫЕ НАСТРОЙКИ
//  Меняй здесь «эталонные» громкости. Ползунки в игре умножают их.
// ================================================================
const AUDIO_SETTINGS = {
  wallHitVolume:      0.50,
  wallHitVolume2:     0.25,
  fishHitVolume:      0.40,
  fishHitVolume2:     0.22,

  ringVolume:         0.20,
  ringVolume2:        0.12,
  finishVolume:       0.20,
  deathVolume:        0.20,

  motorLayer1Volume:  0.30,
  motorLayer2Volume:  0.40,
  motorLayer3Volume:  0.50,
  motorSpeedLow:      0.33,
  motorSpeedHigh:     0.66,

  menuMusicVolume:    0.5,
  gameMusicVolume:    0.45,

  masterVolume:       1.0
};

// ================================================================
//  🎚️ ПОЛЬЗОВАТЕЛЬСКИЕ МНОЖИТЕЛИ (из ползунков)
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
  if (saved) Object.assign(USER_VOL, JSON.parse(saved));
} catch (e) {}

function saveUserVolume() {
  try { localStorage.setItem('pogruzhenie_volumes', JSON.stringify(USER_VOL)); } catch (e) {}
}

function musicVolumeMultiplier() { return USER_VOL.music * USER_VOL.master; }
function hitsVolumeMultiplier()  { return USER_VOL.hits * USER_VOL.master; }
function fxVolumeMultiplier()    { return USER_VOL.fx * USER_VOL.master; }
function motorVolumeMultiplier() { return USER_VOL.motor * USER_VOL.master; }

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
    menuMusic.volume = AUDIO_SETTINGS.menuMusicVolume * musicVolumeMultiplier();
    menuMusic.play().catch(() => { musicStarted = false; });
  }
}

function switchMusic(track) {
  if (menuMusic) menuMusic.pause();
  if (gameMusic) gameMusic.pause();
  if (!musicEnabled) return;
  if (track === 'menu' && menuMusic) {
    menuMusic.volume = AUDIO_SETTINGS.menuMusicVolume * musicVolumeMultiplier();
    menuMusic.play().catch(() => {});
  } else if (track === 'game' && gameMusic) {
    gameMusic.volume = AUDIO_SETTINGS.gameMusicVolume * musicVolumeMultiplier();
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
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { console.warn('Web Audio API не поддерживается'); }
}

function unlockAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  loadMotorBuffers();
}

function playTone(freq, duration, type, volume, startDelay) {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime + (startDelay || 0);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume || 0.15, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ================================================================
//  УДАРЫ
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
  const vol = AUDIO_SETTINGS.wallHitVolume * hitsVolumeMultiplier();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.4);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(150, t0);
  osc2.frequency.exponentialRampToValueAtTime(70, t0 + 0.15);
  const vol2 = AUDIO_SETTINGS.wallHitVolume2 * hitsVolumeMultiplier();
  gain2.gain.setValueAtTime(0, t0);
  gain2.gain.linearRampToValueAtTime(vol2, t0 + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc2.connect(gain2); gain2.connect(audioCtx.destination);
  osc2.start(t0); osc2.stop(t0 + 0.25);
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
  const vol = AUDIO_SETTINGS.fishHitVolume * hitsVolumeMultiplier();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.35);

  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(320, t0 + 0.03);
  osc2.frequency.exponentialRampToValueAtTime(180, t0 + 0.25);
  const vol2 = AUDIO_SETTINGS.fishHitVolume2 * hitsVolumeMultiplier();
  gain2.gain.setValueAtTime(0, t0 + 0.03);
  gain2.gain.linearRampToValueAtTime(vol2, t0 + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc2.connect(gain2); gain2.connect(audioCtx.destination);
  osc2.start(t0 + 0.
