// ================================================================
//  js/config.js — КОНСТАНТЫ И НАСТРОЙКИ
//  Игра «Погружение» v3.1
// ================================================================

const GAME_VERSION = '3.1';
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyjL93GjBRaRs4oVgHJcdKw-zQCvLLz_M5gMQf-HkYBIE9WFNeKFeBMIaiUmt_H0Stg/exec';

const UNLOCK_THRESHOLD = 80;
const MAX_LEVEL = 5;
const MAX_HP = 100;
const FALL_SPEED = 70;

const TARGET_VIEW_WIDTH_DESKTOP = 1100;
const TARGET_VIEW_WIDTH_MOBILE = 650;

const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const DEVICE_TYPE = isTouch ? 'Mobile' : 'PC';

if (isTouch) {
  document.body.classList.add('input-touch');
}

function getTargetViewWidth() {
  return isTouch ? TARGET_VIEW_WIDTH_MOBILE : TARGET_VIEW_WIDTH_DESKTOP;
}

let renderScale = 0.75;
let qualityLevel = 'medium';

try {
  const savedRender = localStorage.getItem('pogruzhenie_render_scale');
  if (savedRender) renderScale = parseFloat(savedRender);
  const savedQuality = localStorage.getItem('pogruzhenie_quality');
  if (savedQuality) qualityLevel = savedQuality;
} catch (e) {}

function detectQuality() {
  const ram = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (isTouch || ram <= 2 || cores <= 2) {
    if (qualityLevel === 'medium') qualityLevel = 'low';
  }
}

// ---------- Состояние игры (глобальное) ----------
let currentPlayer = null;
let currentLevel = 1;
let playerProgress = 1;

let running = false;
let paused = false;
let resultState = null;
let elapsed = 0;
let lastTime = 0;
let started = false;
let currentRun = null;
let scoreSent = false;

let wallHits = 0;
let wallContactTime = 0;
let inContact = false;
let wallDamage = 0;
let fishHits = 0;
let fishDamage = 0;
let collisionPoints = [];
let ringsCollected = 0;
let currentRingIndex = 0;

let missedRingWarning = false;
let finishBlockedWarning = false;

let audioCtx = null;
let soundEnabled = true;
let musicEnabled = true;
let musicStarted = false;

try {
  const savedMusic = localStorage.getItem('pogruzhenie_music');
  if (savedMusic === 'off') { musicEnabled = false; soundEnabled = false; }
  const savedSound = localStorage.getItem('pogruzhenie_sound');
  if (savedSound === 'off') soundEnabled = false;
} catch (e) {}

let allStudents = (typeof STUDENTS !== 'undefined' && Array.isArray(STUDENTS))
  ? STUDENTS.slice()
  : [];

let currentLevelData = null;

let WORLD_W = 3200;
let WORLD_H = 1100;
let FLOOR_Y = 1060;

let walls = [];
let fishes = [];
let rings = [];
let ambientBubbles = [];
let seaFloorHills = [];
let seaweeds = [];

let finish = { x: 3080, y: 120, r: 30 };
let ringsRequired = 0;
let levelType = 'maze';

let levelBgColor = '#1a3a58';
let levelGridColor = 'rgba(30, 58, 85, 0.18)';
let levelFloorColor = '#2e4a2e';
let levelFloorTopColor = '#6b8e5a';
let levelHillColor = '#3f6039';
let levelWaterTint = 'rgba(100, 180, 255, 0.04)';

const camera = { x: 0, y: 0 };
let W = 0;
let H = 0;
let cssW = 0;
let cssH = 0;
let zoom = 1;

function viewW() { return W / zoom; }
function viewH() { return H / zoom; }

const sub = {
  x: 100, y: 980,
  r: 13, angle: 0, angVel: 0,
  vx: 0, vy: 0,
  hp: MAX_HP, invuln: 0,
  maxAngVel: 1.6, angAccel: 0.035,
  maxThrust: 170, thrustAccel: 0.04,
  fallBlend: 0.05,
  animTime: 0, propellerAngle: 0, bubbleTimer: 0, lightTimer: 0
};
