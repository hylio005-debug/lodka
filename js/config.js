// ================================================================
//  js/config.js — КОНСТАНТЫ И НАСТРОЙКИ
//  Игра «Погружение» v4.1
// ================================================================

const GAME_VERSION = '4.1';
const SERVER_URL = 'https://lodka777.online/api.php';

const UNLOCK_THRESHOLD = 80;
const MAX_LEVEL = 5;
const MAX_HP = 100;
const FALL_SPEED = 70;

// Настройки прожектора
const MAX_ENERGY = 100;
const ENERGY_DRAIN = 15;     // Тратится в секунду при включении
const ENERGY_REGEN = 5;      // Восстанавливается в секунду при выключении

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

// ---------- АРТЕФАКТЫ ----------
// ---------- АРТЕФАКТЫ ----------
let inventory = {
  map: false,
  winch: false,
  flashlight: false,
  torpedo: false
};

// Загрузка артефактов для КОНКРЕТНОГО игрока
function loadInventoryForPlayer(klass, nick) {
  const safeKlass = (klass === '—' || !klass) ? 'nick' : klass;
  const key = 'pogruzhenie_inv_' + safeKlass + '_' + nick;
  
  inventory.map = false;
  inventory.winch = false;
  inventory.flashlight = false;
  inventory.torpedo = false;
  
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      inventory.map = !!parsed.map;
      inventory.winch = !!parsed.winch;
      inventory.flashlight = !!parsed.flashlight;
      inventory.torpedo = !!parsed.torpedo;
    }
  } catch (e) {}
}

// Сохранение артефактов для КОНКРЕТНОГО игрока
function saveInventoryForPlayer(klass, nick) {
  const safeKlass = (klass === '—' || !klass) ? 'nick' : klass;
  const key = 'pogruzhenie_inv_' + safeKlass + '_' + nick;
  try {
    localStorage.setItem(key, JSON.stringify(inventory));
  } catch (e) {}
}

// ---------- СОСТОЯНИЕ ИГРЫ ----------
let currentPlayer = null;
let currentLevel = 1;
let playerProgress = 1;

let running = false;
let paused = false;
let resultState = null;
let elapsed = 0;
let lastTime = 0;
let started = false;     // Игра началась (нажали Play)
let isWaiting = false;   // Игрок в уровне, но ещё не нажал Мотор/ЛКМ
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

// ---------- МЕХАНИКИ АРТЕФАКТОВ ----------
// Лебедка
let winchActive = false;
let winchState = 'idle';   // 'idle', 'shooting', 'pulling'
let winchHook = { x: 0, y: 0, targetX: 0, targetY: 0, t: 0, maxDist: 300 };
let winchCooldown = 0;
const WINCH_COOLDOWN_MAX = 3.0; // 3 секунды

// Прожектор
let flashlightOn = false;
let energy = MAX_ENERGY;

// Ракетомет
let torpedoes = [];
let torpedoCooldown = 0;
const TORPEDO_COOLDOWN_MAX = 2.0; // 2 секунды
const TORPEDO_SPEED = 400;

// ---------- КРАКЕН (БОСС 5-го УРОВНЯ) ----------
let krakenActive = false;
let krakenDefeated = false;
let krakenHp = 300;
let krakenMaxHp = 300;
let krakenPhase = 1;
let krakenAttackTimer = 0;
let krakenInkTimer = 0;
let krakenDamageFlash = 0;
let krakenFlashType = 'ice';
let krakenSinkT = 0;
let tentacleWarnings = [];
let krakenPos = { x: 2900, y: 550, r: 90 };
let tentacles = [];
let inkClouds = [];


// ---------- АУДИО ----------
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

// ---------- СПИСОК УЧЕНИКОВ ----------
let allStudents = (typeof STUDENTS !== 'undefined' && Array.isArray(STUDENTS))
  ? STUDENTS.slice()
  : [];

let currentLevelData = null;

// ---------- МИР ----------
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

// Цвета уровня
let levelBgColor = '#1a3a58';
let levelGridColor = 'rgba(30, 58, 85, 0.18)';
let levelFloorColor = '#2e4a2e';
let levelFloorTopColor = '#6b8e5a';
let levelHillColor = '#3f6039';
let levelWaterTint = 'rgba(100, 180, 255, 0.04)';
let levelIsDark = false; // Для 4-го уровня

const camera = { x: 0, y: 0 };
let W = 0;
let H = 0;
let cssW = 0;
let cssH = 0;
let zoom = 1;

function viewW() { return W / zoom; }
function viewH() { return H / zoom; }

// ---------- ДРОН ----------
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