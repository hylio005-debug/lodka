// ================================================================
//  js/audio.js — МУЗЫКА + ЗВУКИ (Web Audio API)
//  Версия 3.2 — тише мотор, громче столкновения
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
    menuMusic.volume = 0.5;
    menuMusic.play().catch(() => { musicStarted = false; });
  }
}

function switchMusic(track) {
  if (menuMusic) menuMusic.pause();
  if (gameMusic) gameMusic.pause();
  if (!musicEnabled) return;
  if (track === 'menu' && menuMusic) {
    menuMusic.volume = 0.5;
    menuMusic.play().catch(() => {});
  } else if (track === 'game' && gameMusic) {
    gameMusic.volume = 0.45;
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
  gain.gain.linearRampToValueAtTime(volume || 0.15, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// ================================================================
//  УДАР О СТЕНУ — ГРОМЧЕ
//  Мягкий подводный «бум» + дополнительный низ
// ================================================================
function soundWallHit() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;

  // Основной тон — низкий «бум»
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(85, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.28);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(220, t0);
  filter.Q.value = 1;

  // ГРОМЧЕ: 0.28 вместо 0.18
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);

  // Второй тон — «тело» удара, тоже громче
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(150, t0);
  osc2.frequency.exponentialRampToValueAtTime(70, t0 + 0.15);
  gain2.gain.setValueAtTime(0, t0);
  gain2.gain.linearRampToValueAtTime(0.14, t0 + 0.01);   // было 0.08
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t0);
  osc2.stop(t0 + 0.25);
}

// ================================================================
//  УДАР О РЫБУ — тоже громче
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

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.22, t0 + 0.01);   // громче
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.35);

  // Второй тон — тревожная нотка
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(320, t0 + 0.03);
  osc2.frequency.exponentialRampToValueAtTime(180, t0 + 0.25);
  gain2.gain.setValueAtTime(0, t0 + 0.03);
  gain2.gain.linearRampToValueAtTime(0.12, t0 + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(t0 + 0.03);
  osc2.stop(t0 + 0.35);
}

// ================================================================
//  КОЛЬЦО — приятный «динь»
// ================================================================
function soundRing() {
  if (!soundEnabled || !audioCtx) return;
  playTone(880, 0.22, 'sine', 0.2, 0);
  playTone(1320, 0.38, 'sine', 0.12, 0.08);
}

// ================================================================
//  ФИНИШ — торжественный аккорд
// ================================================================
function soundFinish() {
  if (!soundEnabled || !audioCtx) return;
  playTone(523, 0.3, 'sine', 0.2, 0);
  playTone(659, 0.3, 'sine', 0.2, 0.1);
  playTone(784, 0.5, 'sine', 0.2, 0.2);
  playTone(1046, 0.7, 'sine', 0.15, 0.3);
}

// ================================================================
//  СМЕРТЬ — падающий тон
// ================================================================
function soundDeath() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.7);
  gain.gain.setValueAtTime(0.2, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.8);
}

// ================================================================
//  МОТОР — ТИШЕ
//  Мягкий подводный гул, почти не слышный фон
// ================================================================
let motorOsc1 = null;
let motorOsc2 = null;
let motorOsc3 = null;
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
  motorOsc3 = audioCtx.createOscillator();

  motorOsc1.type = 'sine';
  motorOsc1.frequency.setValueAtTime(38, t0);

  motorOsc2.type = 'sine';
  motorOsc2.frequency.setValueAtTime(57, t0);

  motorOsc3.type = 'triangle';
  motorOsc3.frequency.setValueAtTime(76, t0);

  motorFilter = audioCtx.createBiquadFilter();
  motorFilter.type = 'lowpass';
  motorFilter.frequency.setValueAtTime(160, t0);
  motorFilter.Q.value = 0.6;

  motorGain = audioCtx.createGain();
  motorGain.gain.setValueAtTime(0, t0);
  // ТИШЕ: 0.02 вместо 0.04
  motorGain.gain.linearRampToValueAtTime(0.02, t0 + 0.5);

  motorLfo = audioCtx.createOscillator();
  motorLfo.type = 'sine';
  motorLfo.frequency.setValueAtTime(0.5, t0);
  motorLfoGain = audioCtx.createGain();
  motorLfoGain.gain.setValueAtTime(0.006, t0);   // меньше амплитуда

  motorLfo.connect(motorLfoGain);
  motorLfoGain.connect(motorGain.gain);

  motorOsc1.connect(motorFilter);
  motorOsc2.connect(motorFilter);
  motorOsc3.connect(motorFilter);
  motorFilter.connect(motorGain);
  motorGain.connect(audioCtx.destination);

  motorOsc1.start(t0);
  motorOsc2.start(t0);
  motorOsc3.start(t0);
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
    motorOsc3.stop(t + 0.4);
    motorLfo.stop(t + 0.4);
  } catch (e) {}
  motorOsc1 = null;
  motorOsc2 = null;
  motorOsc3 = null;
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

    // ТИШЕ: 0.015 + i * 0.02 вместо 0.025 + i * 0.035
    const vol = 0.015 + i * 0.02;
    motorGain.gain.cancelScheduledValues(t);
    motorGain.gain.linearRampToValueAtTime(vol, t + 0.15);

    if (motorOsc1) motorOsc1.frequency.setValueAtTime(38 + i * 8, t);
    if (motorOsc2) motorOsc2.frequency.setValueAtTime(57 + i * 12, t);
    if (motorOsc3) motorOsc3.frequency.setValueAtTime(76 + i * 16, t);

    motorFilter.frequency.setValueAtTime(160 + i * 80, t);
  } catch (e) {}
}

updateMuteIcon();
