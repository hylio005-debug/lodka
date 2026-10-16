// ================================================================
//  js/audio.js — МУЗЫКА + ЗВУКИ (Web Audio API)
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

// ---------- Web Audio API ----------
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

function soundWallHit() {
  if (!soundEnabled || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.15);
  gain.gain.setValueAtTime(0.25, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.2);
}

function soundFishHit() {
  if (!soundEnabled || !audioCtx) return;
  playTone(320, 0.12, 'sawtooth', 0.2, 0);
  playTone(180, 0.2, 'square', 0.15, 0.05);
}

function soundRing() {
  if (!soundEnabled || !audioCtx) return;
  playTone(880, 0.2, 'sine', 0.2, 0);
  playTone(1320, 0.35, 'sine', 0.12, 0.08);
}

function soundFinish() {
  if (!soundEnabled || !audioCtx) return;
  playTone(523, 0.3, 'sine', 0.2, 0);
  playTone(659, 0.3, 'sine', 0.2, 0.1);
  playTone(784, 0.5, 'sine', 0.2, 0.2);
  playTone(1046, 0.7, 'sine', 0.15, 0.3);
}

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
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.8);
}

// ---------- Мотор ----------
let motorOsc1 = null;
let motorOsc2 = null;
let motorGain = null;
let motorActive = false;

function startMotor() {
  if (!soundEnabled || !audioCtx || motorActive) return;
  motorActive = true;
  motorOsc1 = audioCtx.createOscillator();
  motorOsc2 = audioCtx.createOscillator();
  motorGain = audioCtx.createGain();
  motorOsc1.type = 'sawtooth';
  motorOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
  motorOsc2.type = 'sine';
  motorOsc2.frequency.setValueAtTime(82, audioCtx.currentTime);
  motorGain.gain.setValueAtTime(0, audioCtx.currentTime);
  motorGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.2);
  motorOsc1.connect(motorGain);
  motorOsc2.connect(motorGain);
  motorGain.connect(audioCtx.destination);
  motorOsc1.start();
  motorOsc2.start();
}

function stopMotor() {
  if (!motorActive) return;
  motorActive = false;
  try {
    const t = audioCtx.currentTime;
    motorGain.gain.cancelScheduledValues(t);
    motorGain.gain.setValueAtTime(motorGain.gain.value, t);
    motorGain.gain.linearRampToValueAtTime(0, t + 0.15);
    motorOsc1.stop(t + 0.2);
    motorOsc2.stop(t + 0.2);
  } catch (e) {}
  motorOsc1 = null; motorOsc2 = null; motorGain = null;
}

function updateMotorSound(intensity) {
  if (!motorActive || !motorGain) return;
  try {
    const t = audioCtx.currentTime;
    const vol = Math.min(0.1, 0.03 + intensity * 0.08);
    motorGain.gain.cancelScheduledValues(t);
    motorGain.gain.linearRampToValueAtTime(vol, t + 0.1);
    if (motorOsc1) motorOsc1.frequency.setValueAtTime(50 + intensity * 30, t);
    if (motorOsc2) motorOsc2.frequency.setValueAtTime(75 + intensity * 40, t);
  } catch (e) {}
}

updateMuteIcon();
