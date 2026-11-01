// ================================================================
//  server.js — Сервер "Погружения" v3.0
//  Bot AI + Server-Side Bullets Simulation
// ================================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

// ================================================================
//  BOT AI — КОНФИГ
// ================================================================
const BOT = {
  // ===== ФИЗИКА — 1:1 как у игрока =====
  maxThrust: 170,
  thrustAccel: 0.04,
  maxAngVel: 1.6,
  angAccel: 0.035,
  fallBlend: 0.05,
  fallSpeed: 70,

  // ===== ВООРУЖЕНИЕ — как у игрока =====
  shootCooldown: 2.0,
  bulletSpeed: 400,
  bulletDamage: 20,

  // ===== ПРИЦЕЛ (увеличен, чтобы бот мог стрелять с инерцией) =====
  aimTolerance: 0.35,       // было 0.15 — теперь ±20°
  aimError: 0.08,

  // ===== ДИСТАНЦИЯ =====
  attackDist: 300,          // было 250 — держится дальше, не залипает
  minShootRange: 0,
  shootRange: 550,
  seekRadius: 700,

  // ===== SEEK / SEPARATION =====
  separationDist: 55,
  wallAvoidDist: 70,
  wallCollisionR: 22,
  waypointReach: 40,
  stuckCheckTime: 1.0,      // было 2.0 — реагирует на застревание вдвое быстрее
  stuckMoveDist: 30,
};

const WALL_THICKNESS = 22;
const BULLET_LIFE = 3.0;
const BULLET_DAMAGE = 20;
const BULLET_RADIUS = 30;
const BULLET_MAX_SPEED = 600;

// ================================================================
//  ГЕОМЕТРИЯ
// ================================================================
function circleVsWall(cx, cy, r, wall) {
  const halfT = WALL_THICKNESS / 2;
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const vx = cx - wall.x1, vy = cy - wall.y1;
  let t = vx * ux + vy * uy;
  let s = vx * (-uy) + vy * ux;
  if (t < 0) t = 0;
  if (t > len) t = len;
  if (s < -halfT) s = -halfT;
  if (s > halfT) s = halfT;
  const closestX = wall.x1 + ux * t - uy * s;
  const closestY = wall.y1 + uy * t + ux * s;
  const ddx = cx - closestX, ddy = cy - closestY;
  const dist2 = ddx * ddx + ddy * ddy;
  if (dist2 < r * r) {
    const dist = Math.sqrt(dist2);
    return {
      hit: true,
      nx: dist > 0.001 ? ddx / dist : 1,
      ny: dist > 0.001 ? ddy / dist : 0,
      depth: r - dist,
    };
  }
  return { hit: false };
}

function lineBlocked(x1, y1, x2, y2, walls, step) {
  if (!walls || walls.length === 0) return false;
  step = step || 25;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const w of walls) {
      if (circleVsWall(px, py, 6, w).hit) return true;
    }
  }
  return false;
}

function predictAim(bot, target) {
  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const dist = Math.hypot(dx, dy);
  const travelTime = dist / BOT.bulletSpeed;
  return {
    x: target.x + (target.vx || 0) * travelTime * BOT.leadFactor,
    y: target.y + (target.vy || 0) * travelTime * BOT.leadFactor,
  };
}

// ================================================================
//  БОТ
// ================================================================
function createBotState(botId, team, nick, isCTF) {
  return {
    id: botId,
    // В дуэли карта 2000px (спавн 800 и 1200), в CTF — 3200px (спавн 200 и 3000)
    x: isCTF ? (team === 'blue' ? 200 : 3000) : (team === 'blue' ? 800 : 1200),
    y: isCTF ? 550 : 800,
    vx: 0, vy: 0,
    angVel: 0,
    angle: team === 'blue' ? 0 : Math.PI,
    hp: 100,
    team, nick,
    isBot: true,
    state: isCTF ? 'seekFlag' : 'patrol',
    isFrozen: false,
    freezeTimer: 0,
    hasFlag: false,
    captureTimer: 0,
    shootCooldown: 0,
    burst: 0,
    burstTimer: 0,
    waypoint: null,
    waypointRetargetTimer: 0,
    stuckCheckpointX: team === 'blue' ? 200 : 3000,
    stuckCheckpointY: 550,
    stuckCheckpointTimer: 0,
    avoidStuckUntil: 0,
    isDead: false,
    respawnTimer: 0,

  };
}

function pickTarget(bot, room) {
  const candidates = [];

  if (room.flag.state === 'carried' && room.flag.carrierId && room.flag.carrierTeam !== bot.team) {
    const carrierPlayer = room.players.find(p => p.id === room.flag.carrierId);
    const carrierBot = room.bots[room.flag.carrierId];
    const carrier = carrierPlayer && carrierPlayer.x !== undefined ? carrierPlayer : carrierBot;
    if (carrier && isFinite(carrier.x) && isFinite(carrier.y)) {
      candidates.push({
        id: room.flag.carrierId,
        x: carrier.x, y: carrier.y,
        vx: carrier.vx || 0, vy: carrier.vy || 0,
        priority: 10,
        dist: Math.hypot(carrier.x - bot.x, carrier.y - bot.y),
      });
    }
  }

  if (room.flag.state === 'dropped') {
    candidates.push({
      id: '__flag__', isFlag: true,
      x: room.flag.x, y: room.flag.y,
      vx: 0, vy: 0, priority: 8,
      dist: Math.hypot(room.flag.x - bot.x, room.flag.y - bot.y),
    });
  }

  for (const p of room.players) {
    if (p.isBot) continue;
    if (p.team === bot.team) continue;
    if (p.x === undefined || p.hp <= 0) continue;
    if (!isFinite(p.x) || !isFinite(p.y)) continue;
    const d = Math.hypot(p.x - bot.x, p.y - bot.y);
    const seekRad = room.mode === 'duel' ? 2500 : BOT.seekRadius; // В дуэли видит всю карту
    if (d < seekRad) {
      candidates.push({
        id: p.id, x: p.x, y: p.y,
        vx: p.vx || 0, vy: p.vy || 0,
        priority: 5, dist: d,
      });
    }
  }

  for (const otherId in room.bots) {
    if (otherId === bot.id) continue;
    const other = room.bots[otherId];
    if (other.team === bot.team) continue;
    if (other.isFrozen || other.hp <= 0) continue;
    const d = Math.hypot(other.x - bot.x, other.y - bot.y);
    const seekRad = room.mode === 'duel' ? 2500 : BOT.seekRadius;
    if (d < seekRad) {
      candidates.push({
        id: otherId, x: other.x, y: other.y,
        vx: other.vx || 0, vy: other.vy || 0,
        priority: 5, dist: d,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.dist - b.dist;
  });

  return candidates[0] || null;
}

function updateBot(bot, room, code, dt) {
  // ---------- МЁРТВ: ждём респавн ----------
  if (bot.isDead) {
    bot.respawnTimer -= dt;
    if (bot.respawnTimer <= 0) {
      const base = (room.bases && room.bases[bot.team]) 
        ? room.bases[bot.team] 
        : { x: bot.team === 'blue' ? 200 : 3000, y: 550 };
      bot.isDead = false;
      bot.respawnTimer = 0;
      bot.hp = 100;
      bot.x = base.x;
      bot.y = base.y;
      bot.angle = bot.team === 'blue' ? 0 : Math.PI;
      bot.vx = 0; bot.vy = 0;
      bot.angVel = 0;
      bot.isFrozen = false;
      bot.captureTimer = 0;
      bot.justTeleported = true;
    }
    return;
  }

  // ---------- ЗАМОРОЖЕН ----------
  if (bot.isFrozen) {
    bot.freezeTimer -= dt;
    
    // В дуэли тянем к базе, как в CTF
    if (room.mode === 'duel') {
      const base = (room.bases && room.bases[bot.team]) ? room.bases[bot.team] : { x: bot.team === 'blue' ? 800 : 1200, y: 800 };
      const dx = base.x - bot.x, dy = base.y - bot.y;
      const dist = Math.hypot(dx, dy);
      
      if (bot.freezeTimer <= 0 || dist < 15) {
        bot.isFrozen = false;
        bot.freezeTimer = 0;
        bot.x = base.x; bot.y = base.y;
        bot.vx = 0; bot.vy = 0;
      } else {
        const a = Math.atan2(dy, dx);
        bot.angle = a;
        bot.x += (dx / dist) * 500 * dt;
        bot.y += (dy / dist) * 500 * dt;
      }
      return;
    }

    // В CTF тянем к базе
    const base = (room.bases && room.bases[bot.team]) ? room.bases[bot.team] : { x: bot.team === 'blue' ? 200 : 3000, y: 550 };
    const baseX = base.x;
    const baseY = base.y;
    const dx = baseX - bot.x, dy = baseY - bot.y;
    const dist = Math.hypot(dx, dy);
    
    if (bot.freezeTimer <= 0 || dist < 15) {
      bot.isFrozen = false;
      bot.freezeTimer = 0;
      bot.x = baseX;
      bot.y = baseY;
      bot.vx = 0; bot.vy = 0;
      bot.angVel = 0;
    } else {
      const a = Math.atan2(dy, dx);
      bot.angle = a;
      bot.x += (dx / dist) * 500 * dt;
      bot.y += (dy / dist) * 500 * dt;
    }
    return;
  }

  const target = pickTarget(bot, room);

    if (bot.hasFlag) {
    bot.state = 'returnFlag';
  } else if (target && target.isFlag) {
    bot.state = 'seekFlag';
  } else if (target && !target.isFlag) {
    // Если цель есть — ВСЕГДА атакуем (даже если за стеной, облетим)
    bot.state = 'attack';
  } else if (room.flag.state === 'center' && room.mode === 'ctf') {
    bot.state = 'seekFlag';
  } else {
    bot.state = 'patrol';
  }

    let targetPos = null;
  if (bot.state === 'seekFlag') {
    targetPos = { x: room.flag.x, y: room.flag.y };
  } else if (bot.state === 'returnFlag') {
    targetPos = { x: bot.team === 'blue' ? 200 : 3000, y: 550 };
    } else if (bot.state === 'attack' && target) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;

    // В дуэли бот подлетает ближе (200) и держит дистанцию
    const prefDist = room.mode === 'duel' ? 200 : BOT.attackDist;
    const tolerance = room.mode === 'duel' ? 30 : 40;

    if (dist > prefDist + tolerance) {
      targetPos = { x: target.x, y: target.y };
    } else if (dist < prefDist - tolerance) {
      targetPos = {
        x: bot.x - ux * 100,
        y: bot.y - uy * 100,
      };
    } else {
      // В зоне — кружим вокруг цели (страйф)
      const perpX = -uy, perpY = ux;
      bot.strafeDir = bot.strafeDir || 1;
      if (Math.random() < 0.01) bot.strafeDir *= -1;
      targetPos = {
        x: bot.x + perpX * BOT.strafeAmount * bot.strafeDir + ux * 20,
        y: bot.y + perpY * BOT.strafeAmount * bot.strafeDir + uy * 20,
      };
    }

    // 🔥 УКЛОНЕНИЕ ОТ СНАРЯДОВ (только для дуэли)
    if (room.mode === 'duel' && room.bullets) {
      for (const b of room.bullets) {
        if (b.team === bot.team) continue;
        const bDist = Math.hypot(bot.x - b.x, bot.y - b.y);
        
        // Если снаряд близко (меньше 160 пикселей)
        if (bDist < 160) {
          const angleToBot = Math.atan2(bot.y - b.y, bot.x - b.x);
          const bulletAngle = Math.atan2(b.vy, b.vx);
          let diff = Math.abs(angleToBot - bulletAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          
          // Если пуля летит прямо в бота (погрешность ±35 градусов)
          if (diff < 0.6) {
            // Резко уклоняемся вбок (перпендикулярно пуле)
            const dodgeAngle = angleToBot + (Math.PI / 2) * bot.strafeDir;
            targetPos = { 
              x: bot.x + Math.cos(dodgeAngle) * 150, 
              y: bot.y + Math.sin(dodgeAngle) * 150 
            };
            break; // Уклоняемся от самого опасного
          }
        }
      }
    }
  } else {
    if (!bot.waypoint || bot.waypointRetargetTimer <= 0) {
      bot.waypoint = {
        x: 400 + Math.random() * 2400,
        y: 200 + Math.random() * 700,
      };
      bot.waypointRetargetTimer = 3 + Math.random() * 2;
    }
    bot.waypointRetargetTimer -= dt;
    targetPos = bot.waypoint;
  }

  // Anti-stuck override — работает во ВСЕХ состояниях (attack / seekFlag / patrol / returnFlag)
  if (bot.avoidStuckUntil && bot.avoidStuckUntil > Date.now() && bot.waypoint) {
    targetPos = bot.waypoint;
  }

    // ================================================================
  //  ФИЗИКА — 1:1 как у игрока (sub)
  // ================================================================

  // ---------- 5. ЦЕЛЕВОЙ УГОЛ ----------
  let targetAngle = null;
  if (bot.state === 'attack' && target) {
    targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
  } else if (targetPos) {
    const dx = targetPos.x - bot.x;
    const dy = targetPos.y - bot.y;
    if (Math.hypot(dx, dy) > 10) {
      targetAngle = Math.atan2(dy, dx);
    }
  }

  // 5.1 Wall-avoid — как игрок «видит стену и поворачивает»
  if (targetAngle !== null && room.walls) {
    const lookDist = 60;
    const lookX = bot.x + Math.cos(targetAngle) * lookDist;
    const lookY = bot.y + Math.sin(targetAngle) * lookDist;
    for (const w of room.walls) {
      const res = circleVsWall(lookX, lookY, 25, w);
      if (res.hit) {
        const awayAngle = Math.atan2(-res.ny, -res.nx);
        let delta = awayAngle - targetAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        delta = Math.max(-0.8, Math.min(0.8, delta));
        targetAngle += delta;
        break;
      }
    }
  }

  // 5.2 Separation — расталкивание союзников через коррекцию угла
  if (targetAngle !== null) {
    for (const otherId in room.bots) {
      if (otherId === bot.id) continue;
      const other = room.bots[otherId];
      if (other.isFrozen || other.team !== bot.team) continue;
      const dx = bot.x - other.x;
      const dy = bot.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < BOT.separationDist) {
        const awayAngle = Math.atan2(dy, dx);
        let delta = awayAngle - targetAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const push = (BOT.separationDist - d) / BOT.separationDist;
        targetAngle += delta * push * 0.5;
      }
    }
  }

  // ---------- 6. ПОВОРОТ (как sub.angle) ----------
  if (targetAngle !== null) {
    let diff = targetAngle - bot.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxStep = BOT.maxAngVel * dt;
    if (diff > maxStep) diff = maxStep;
    else if (diff < -maxStep) diff = -maxStep;

    bot.angVel = (bot.angVel || 0) + (diff / dt - (bot.angVel || 0)) * BOT.angAccel;
  } else {
    bot.angVel = (bot.angVel || 0) * 0.92;
  }
  bot.angle += (bot.angVel || 0) * dt;
  while (bot.angle > Math.PI) bot.angle -= Math.PI * 2;
  while (bot.angle < -Math.PI) bot.angle += Math.PI * 2;

  // ---------- 7. ДВИЖЕНИЕ (как sub.vx / sub.vy) ----------
  // Жмём ли мотор? — как игрок ЛКМ
  let thrustOn = false;
  if (bot.state === 'attack' && target) {
    const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    if (dist > BOT.attackDist + 50) thrustOn = true;
    // в зоне attackDist — не жмём, плавно тормозим и падаем
  } else {
    thrustOn = true;
  }

  if (thrustOn) {
    const fx = Math.cos(bot.angle);
    const fy = Math.sin(bot.angle);
    bot.vx += (fx * BOT.maxThrust - bot.vx) * BOT.thrustAccel;
    bot.vy += (fy * BOT.maxThrust - bot.vy) * BOT.thrustAccel;
  } else {
    // Свободное падение — как у игрока без ЛКМ
    bot.vx += (0 - bot.vx) * BOT.fallBlend;
    bot.vy += (BOT.fallSpeed - bot.vy) * BOT.fallBlend;
  }

  // Анти-NaN (если физика поломалась — сброс на базу)
  if (!isFinite(bot.x) || isNaN(bot.x)) bot.x = bot.team === 'blue' ? 200 : 3000;
  if (!isFinite(bot.y) || isNaN(bot.y)) bot.y = 550;
  if (!isFinite(bot.vx) || isNaN(bot.vx)) bot.vx = 0;
  if (!isFinite(bot.vy) || isNaN(bot.vy)) bot.vy = 0;
  if (!isFinite(bot.angVel) || isNaN(bot.angVel)) bot.angVel = 0;

  bot.x += bot.vx * dt;
  bot.y += bot.vy * dt;

  if (room.walls) {
    for (const w of room.walls) {
      const res = circleVsWall(bot.x, bot.y, BOT.wallCollisionR, w);
      if (res.hit) {
        bot.x += res.nx * res.depth;
        bot.y += res.ny * res.depth;
        const vn = bot.vx * res.nx + bot.vy * res.ny;
        if (vn < 0) { bot.vx -= vn * res.nx; bot.vy -= vn * res.ny; }
      }
    }
  }

  // NaN-защита ДО clamp (Math.max(NaN, x) = NaN)
  if (!isFinite(bot.x) || isNaN(bot.x)) { bot.x = bot.team === 'blue' ? 200 : 3000; bot.vx = 0; }
  if (!isFinite(bot.y) || isNaN(bot.y)) { bot.y = 550; bot.vy = 0; }
  if (!isFinite(bot.angle) || isNaN(bot.angle)) { bot.angle = 0; bot.angVel = 0; }
  if (!isFinite(bot.vx) || isNaN(bot.vx)) bot.vx = 0;
  if (!isFinite(bot.vy) || isNaN(bot.vy)) bot.vy = 0;
  if (!isFinite(bot.angVel) || isNaN(bot.angVel)) bot.angVel = 0;

  // Динамические границы карты (берем из внешних стен)
  let maxX = 3200, maxY = 1100;
  if (room.walls && room.walls.length > 0) {
    maxX = Math.max(...room.walls.map(w => Math.max(w.x1, w.x2)));
    maxY = Math.max(...room.walls.map(w => Math.max(w.y1, w.y2)));
  }
  bot.x = Math.max(80, Math.min(maxX - 80, bot.x));
  bot.y = Math.max(80, Math.min(maxY - 80, bot.y));

  bot.stuckCheckpointTimer += dt;
  if (bot.stuckCheckpointTimer >= BOT.stuckCheckTime) {
    const dx = bot.x - bot.stuckCheckpointX;
    const dy = bot.y - bot.stuckCheckpointY;
    if (Math.hypot(dx, dy) < BOT.stuckMoveDist) {
      // Застрял — ставим waypoint, куда лететь 2 сек (без телепорта)
      bot.waypoint = {
        x: 300 + Math.random() * 2600,
        y: 150 + Math.random() * 750,
      };
      bot.avoidStuckUntil = Date.now() + 2000;
    }
    bot.stuckCheckpointX = bot.x;
    bot.stuckCheckpointY = bot.y;
    bot.stuckCheckpointTimer = 0;
  }

  // Подбор флага ботом
  if (room.mode === 'ctf' && room.flag.state !== 'carried' && !bot.hasFlag) {
    const canPick = !room.flag.canBePickedAt || Date.now() >= room.flag.canBePickedAt;
    if (canPick && Math.hypot(bot.x - room.flag.x, bot.y - room.flag.y) < 45) {
      bot.hasFlag = true;
      bot.captureTimer = 0;
      room.flag.state = 'carried';
      room.flag.carrierId = bot.id;
      room.flag.carrierTeam = bot.team;
      room.flag.lastOwner = bot.id;
      room.flag.canBePickedAt = 0;
      room.flag.captureProgress = 0;
      room.flag.captureTeam = bot.team;
      for (const p of room.players) p.hasFlag = false;
    }
  }

    // ---------- 12. СТРЕЛЬБА (как у игрока) ----------
  if (bot.shootCooldown > 0) bot.shootCooldown -= dt;

  if (target && !target.isFlag && bot.shootCooldown <= 0) {
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distToTarget = Math.hypot(dx, dy);
    const angleToTarget = Math.atan2(dy, dx);

    let aimDiff = angleToTarget - bot.angle;
    while (aimDiff > Math.PI) aimDiff -= Math.PI * 2;
    while (aimDiff < -Math.PI) aimDiff += Math.PI * 2;

    const isAimed = Math.abs(aimDiff) < BOT.aimTolerance;
    const inRange = distToTarget > BOT.minShootRange && distToTarget < BOT.shootRange;
    const clear = !lineBlocked(bot.x, bot.y, target.x, target.y, room.walls || []);

    if (isAimed && inRange && clear) {
      fireBotBullet(bot, target, room, code);
      bot.shootCooldown = BOT.shootCooldown;
    }
  }
}

function fireBotBullet(bot, target, room, code) {
  if (!target || target.isFlag) return;

  // Стреляем СТРОГО по курсу лодки (bot.angle), как игрок fireTorpedo (sub.angle).
  // Без lead-aim — снаряд летит туда, где был игрок в момент выстрела.
  // ±небольшой разброс — как у игрока «рука дрогнула».
  const aimError = (Math.random() - 0.5) * BOT.aimError * 2;
  const aimAngle = bot.angle + aimError;

  // Оружие — как в комнате: torpedo → обычные, cryo → все крио.
  const isCryo = (room.weapon === 'cryo');

  createBullet(room, code, {
    ownerId: bot.id,
    team: bot.team,
    x: bot.x + Math.cos(aimAngle) * 25,
    y: bot.y + Math.sin(aimAngle) * 25,
    vx: Math.cos(aimAngle) * BOT.bulletSpeed,
    vy: Math.sin(aimAngle) * BOT.bulletSpeed,
    angle: aimAngle,
    isCryo: isCryo,
    damage: BOT.bulletDamage,
  });
}

// ================================================================
//  СНАРЯДЫ — СИМУЛЯЦИЯ НА СЕРВЕРЕ
// ================================================================
function createBullet(room, code, params) {
  if (!room.bullets) room.bullets = [];
  if (!room.nextBulletId) room.nextBulletId = 1;

  const id = room.nextBulletId++;
  const bullet = {
    id,
    ownerId: params.ownerId,
    team: params.team,
    x: params.x, y: params.y,
    vx: params.vx, vy: params.vy,
    angle: params.angle,
    isCryo: !!params.isCryo,
    damage: params.damage || BULLET_DAMAGE,
    life: BULLET_LIFE,
  };
  room.bullets.push(bullet);

  io.to(code).emit('bullet_spawn', {
    id,
    ownerId: params.ownerId,
    team: params.team,
    x: params.x, y: params.y,
    vx: params.vx, vy: params.vy,
    angle: params.angle,
    isCryo: bullet.isCryo,
  });
  return bullet;
}

function applyBulletDamage(room, code, target, damage, bullet) {
  if (target.obj && target.obj.isFrozen) return; // ← НОВОЕ: заморожен = неуязвим

  if (target.type === 'bot') {
    const bot = target.obj;
    if (!bot) return;
    if (bot.isDead) return;

    bot.hp -= damage;
    const willDie = bot.hp <= 0;

    if (bot.hasFlag) {
      bot.hasFlag = false;
      bot.captureTimer = 0;
      room.flag.state = 'dropped';
      room.flag.carrierId = null;
      room.flag.carrierTeam = null;
      room.flag.x = bot.x;
      room.flag.y = bot.y;
      room.flag.vy = 0;
      room.flag.canBePickedAt = Date.now() + 2000;
      room.flag.lastOwner = bot.id;
      room.flag.captureProgress = 0;
      room.flag.captureTeam = null;
      room.flag.onFloor = false;
      console.log(`[FLAG] ✅ ВЫПАЛ из бота ${bot.id} на (${bot.x.toFixed(0)}, ${bot.y.toFixed(0)})`);
    }

    if (willDie) {
      bot.hp = 0;
      bot.isDead = true;
      bot.respawnTimer = 3.0;
      bot.isFrozen = false;
      bot.vx = 0; bot.vy = 0;
      bot.angVel = 0;
      bot.captureTimer = 0;
    } else if (bullet && bullet.isCryo) {
      bot.isFrozen = true;
      bot.freezeTimer = 5.0;
      bot.captureTimer = 0;
      
      if (room.mode === 'duel') {
        if (!room.freezeScores) room.freezeScores = { blue: 0, red: 0 };
        // Очко идёт команде СТРЕЛКА (противоположной от бота)
        const shooterTeam = bot.team === 'blue' ? 'red' : 'blue';
        room.freezeScores[shooterTeam] += 1;
        
        io.to(code).emit('freeze_score', room.freezeScores);
        
        if (room.freezeScores[shooterTeam] >= 3) {
          io.to(code).emit('game_over_duel', { winnerId: bullet.ownerId });
          room.state = 'ended';
          room.bots = {};
          room.bullets = [];
          return;
        }
      }
    }
    return; // <--- КРИТИЧЕСКИ ВАЖНО! Останавливаем выполнение для бота
  }

  const p = target.obj;
  if (!p || p.isDead) return;

  p.hp -= damage;
  const willDie = p.hp <= 0;

  // ⚡ Флаг выпадает при ЛЮБОМ попадании
  if (room.flag.carrierId === p.id) {
    room.flag.state = 'dropped';
    room.flag.carrierId = null;
    room.flag.carrierTeam = null;
    room.flag.x = p.x;
    room.flag.y = p.y;
    room.flag.vy = 0;
    room.flag.canBePickedAt = Date.now() + 2000;
    room.flag.lastOwner = p.id;
    room.flag.captureProgress = 0;
    room.flag.captureTeam = null;
    room.flag.onFloor = false;
    console.log(`[FLAG] Выпал из игрока ${p.id} на (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  }

  if (willDie) {
    p.hp = 0;
    if (room.mode === 'ctf') {
      p.isDead = true;
      p.respawnTimer = 3.0;
      p.vx = 0; p.vy = 0;
      io.to(p.id).emit('you_died_ctf', { respawnIn: 3 });
    } else {
      io.to(p.id).emit('you_died');
      io.to(code).emit('game_over_duel', { winnerId: bullet ? bullet.ownerId : null });
      room.state = 'ended';
      room.bots = {};
      room.bullets = [];
    }
  } else {
    if (bullet && bullet.isCryo) {     
      io.to(p.id).emit('get_frozen', { by: bullet.ownerId });
      
      if (room.mode === 'duel') {
        if (!room.freezeScores) room.freezeScores = { blue: 0, red: 0 };
        // Очко идёт команде СТРЕЛКА (противоположной от игрока)
        const shooterTeam = p.team === 'blue' ? 'red' : 'blue';
        room.freezeScores[shooterTeam] += 1;
        
        io.to(code).emit('freeze_score', room.freezeScores);
        
        if (room.freezeScores[shooterTeam] >= 3) {
          io.to(p.id).emit('you_died');
          io.to(code).emit('game_over_duel', { winnerId: bullet.ownerId });
          room.state = 'ended';
          room.bots = {};
          room.bullets = [];
          return;
        }
      }
    }
    io.to(p.id).emit('your_hp', { hp: p.hp });
  }
}

function updateBullets(room, code, dt) {
  if (!room.bullets || room.bullets.length === 0) return;
  const walls = room.walls || [];

  for (let i = room.bullets.length - 1; i >= 0; i--) {
    if (room.state !== 'playing') break;   // ← матч закончился — выходим
    const b = room.bullets[i];
    if (!b) continue;                       // ← защита от undefined
    const oldX = b.x, oldY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    let hit = false;
    let hitTarget = null;

    if (walls.length > 0 && lineBlocked(oldX, oldY, b.x, b.y, walls, 10)) {
      hit = true;
    }

    if (!hit) {
      for (const p of room.players) {
        if (p.isBot) continue;
        if (p.team === b.team) continue;
        if (p.id === b.ownerId) continue;
        if (p.x === undefined || p.hp <= 0) continue;
        if (p.isFrozen) continue;  // ← НОВОЕ
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < BULLET_RADIUS * BULLET_RADIUS) {
          hit = true;
          hitTarget = { type: 'player', id: p.id, obj: p };
          break;
        }
      }
    }
    // Респавн мёртвых игроков в CTF
    for (const p of room.players) {
      if (p.isBot) continue;
      if (!p.isDead) continue;
      p.respawnTimer -= TICK_S;
      if (p.respawnTimer <= 0) {
        p.isDead = false;
        p.respawnTimer = 0;
        p.hp = 100;
        const base = (room.bases && room.bases[p.team]) 
          ? room.bases[p.team] 
          : { x: p.team === 'blue' ? 200 : 3000, y: 550 };
        p.x = base.x;
        p.y = base.y;
        p.vx = 0; p.vy = 0;
        io.to(p.id).emit('you_respawned', {
          x: p.x, y: p.y, hp: p.hp,
          invuln: 2.0,
        });
      }
    }
    if (!hit && room.bots) {
      for (const botId in room.bots) {
        const bot = room.bots[botId];
        if (bot.team === b.team) continue;
        if (bot.id === b.ownerId) continue;
        if (bot.hp <= 0) continue;
        if (bot.isFrozen) continue;  // ← НОВОЕ
        const dx = bot.x - b.x, dy = bot.y - b.y;
        if (dx * dx + dy * dy < BULLET_RADIUS * BULLET_RADIUS) {
          hit = true;
          hitTarget = { type: 'bot', id: botId, obj: bot };
          break;
        }
      }
    }

    if (hit) {
      if (hitTarget) applyBulletDamage(room, code, hitTarget, b.damage, b);
      io.to(code).emit('bullet_despawn', { id: b.id });
      room.bullets.splice(i, 1);
    } else if (b.life <= 0) {
      io.to(code).emit('bullet_despawn', { id: b.id });
      room.bullets.splice(i, 1);
    }
  }
}

// ================================================================
//  ГЛАВНЫЙ ТИК (20 Гц)
// ================================================================
const TICK_MS = 50;
const TICK_S = TICK_MS / 1000;

setInterval(() => {
  for (const code in rooms) {
    const room = rooms[code];
    if (room.state !== 'playing') continue;
    if (!room.bots) room.bots = {};

    const botsData = {};
    let ended = false;

    for (const botId in room.bots) {
      const bot = room.bots[botId];
      updateBot(bot, room, code, TICK_S);
      if (room.state === 'ended') { ended = true; break; }
        botsData[botId] = {
        x: isFinite(bot.x) ? bot.x : (bot.team === 'blue' ? 200 : 3000),
        y: isFinite(bot.y) ? bot.y : 550,
        angle: isFinite(bot.angle) ? bot.angle : 0,
        vx: isFinite(bot.vx) ? bot.vx : 0,
        vy: isFinite(bot.vy) ? bot.vy : 0,
        hp: bot.hp, team: bot.team, nick: bot.nick,
        hasFlag: bot.hasFlag, isFrozen: bot.isFrozen,
        isDead: !!bot.isDead,
        captureTimer: bot.captureTimer,
        justTeleported: !!bot.justTeleported,
      };
      if (bot.justTeleported) bot.justTeleported = false;
    }

    if (!ended) {
      updateBullets(room, code, TICK_S);
    }
   



    // ⚡ ЕДИНЫЙ ТИК ФЛАГА (физика + захват + синхронизация)
    if (!ended && room.mode === 'ctf') {
      const flag = room.flag;

      // 1. ФИЗИКА ПАДЕНИЯ
      if (flag.state === 'dropped' && flag.y < 1020) {
        flag.vy = Math.min(800, flag.vy + 600 * TICK_S);
        flag.y += flag.vy * TICK_S;
        if (flag.y >= 1020) {
          flag.y = 1020;
          flag.vy = 0;
          flag.onFloor = true;
        }
      }

      // 2. ЗАХВАТ (носитель на своей базе)
      if (flag.state === 'carried' && flag.carrierId) {
        const carrierBot = room.bots[flag.carrierId];
        const carrierPlayer = room.players.find(p => p.id === flag.carrierId && !p.isBot);
        
        let carrierX = null, carrierY = null, carrierTeam = null;
        if (carrierBot) {
          carrierX = carrierBot.x;
          carrierY = carrierBot.y;
          carrierTeam = carrierBot.team;
        } else if (carrierPlayer) {
          carrierX = carrierPlayer.x;
          carrierY = carrierPlayer.y;
          carrierTeam = carrierPlayer.team;
        }

        if (carrierX !== null) {
          flag.x = carrierX;
          flag.y = carrierY;

          // ⚡ Используем базы из карты (радиус захвата = радиус круга)
          const base = (room.bases && room.bases[carrierTeam]) 
            ? room.bases[carrierTeam] 
            : { x: carrierTeam === 'blue' ? 200 : 3000, y: 550, r: 120 };
          
          const distToBase = Math.hypot(carrierX - base.x, carrierY - base.y);

          if (distToBase < base.r) {
            flag.captureTeam = carrierTeam;
            flag.captureProgress += TICK_S;
            if (flag.captureProgress >= 10) {
              room.state = 'ended';
              room.bots = {};
              room.bullets = [];
              io.to(code).emit('game_over_ctf', { winTeam: carrierTeam });
              console.log(`[CTF] ${carrierTeam} захватил флаг!`);
            }
          }
          // Прогресс НЕ сбрасывается при выходе из круга.
          // Сбрасывается только при выпадении флага (applyBulletDamage) 
          // или при подборе новым носителем (flag_pickup).
        }
      }

      // 3. СИНХРОНИЗАЦИЯ КЛИЕНТАМ
      io.to(code).emit('flag_state', {
        state: flag.state,
        x: flag.x, y: flag.y, vy: flag.vy,
        carrierId: flag.carrierId,
        carrierTeam: flag.carrierTeam,
        captureProgress: flag.captureProgress,
        captureTeam: flag.captureTeam,
        onFloor: flag.onFloor,
        canBePickedAt: flag.canBePickedAt,
      });
    }

    if (!ended && Object.keys(botsData).length > 0) {
      io.to(code).emit('bots_update', botsData);
    }
  }
}, TICK_MS);

// ================================================================
//  SOCKET.IO
// ================================================================
io.on('connection', (socket) => {
  console.log('🔌 Подключился:', socket.id);

socket.on('create_room', ({ name, password, mode, nick, weapon }) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log(`[CREATE] ${socket.id} создал комнату ${code} (${name || 'без названия'}, mode=${mode})`);
  rooms[code] = {
      code,
      name: name || 'Комната',
      password: password || null,
      mode: mode || 'duel',
      weapon: weapon || 'torpedo',
      players: [],
      bots: {},
      bullets: [],
      nextBulletId: 1,
      walls: [],
      state: 'waiting',
      maxPlayers: mode === 'ctf' ? 6 : 2,
      flag: {
        state: 'center',
        x: 1600, y: 550, vy: 0,
        carrierId: null,
        carrierTeam: null,
        lastOwner: null,
        canBePickedAt: 0,
        captureProgress: 0,
        captureTeam: null,
        onFloor: false,
      },
    };
    joinRoomLogic(socket, code, password, true, nick);
  });

socket.on('request_rooms', () => {
  const list = Object.values(rooms).map(r => ({
    code: r.code, name: r.name,
    players: r.players.length, maxPlayers: r.maxPlayers,
    mode: r.mode, hasPassword: !!r.password,
  }));
  console.log(`[ROOMS] Запрос от ${socket.id}, активных комнат: ${list.length}`);
  socket.emit('rooms_list', list);
});

  socket.on('switch_team', ({ code, newTeam }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.team === newTeam) return;
    const maxPerTeam = room.mode === 'ctf' ? 3 : 1;
    if (room.players.filter(p => p.team === newTeam).length >= maxPerTeam) {
      return socket.emit('error_msg', 'Команда заполнена!');
    }
    player.team = newTeam;
    io.to(code).emit('lobby_update', {
      code: room.code, mode: room.mode, players: room.players,
    });
  });

  socket.on('toggle_ready', ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.isReady = !player.isReady;
    io.to(code).emit('lobby_update', {
      code: room.code, mode: room.mode, players: room.players,
    });
  });

  socket.on('add_bot', ({ code, team }) => {
    const room = rooms[code];
    if (!room) return;
    const host = room.players.find(p => p.id === socket.id);
    if (!host || !host.isHost) return;

    const maxPerTeam = room.mode === 'ctf' ? 3 : 1;
    if (room.players.filter(p => p.team === team).length >= maxPerTeam) {
      return socket.emit('error_msg', 'Команда заполнена!');
    }

    const botId = 'bot_' + Math.random().toString(36).substring(2, 7);
    const botNick = 'Бот_' + (Object.keys(room.bots).length + 1);
    const bot = createBotState(botId, team, botNick, room.mode === 'ctf');
    room.bots[botId] = bot;

    room.players.push({
      id: botId, team, nick: botNick,
      isHost: false, isReady: true, isBot: true,
      x: bot.x, y: bot.y, angle: bot.angle,
    });

    io.to(code).emit('lobby_update', {
      code: room.code, mode: room.mode, players: room.players,
    });
  });

  socket.on('remove_bot', ({ code, botId }) => {
    const room = rooms[code];
    if (!room) return;
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    room.players = room.players.filter(p => p.id !== botId);
    if (room.bots) delete room.bots[botId];
    io.to(code).emit('lobby_update', {
      code: room.code, mode: room.mode, players: room.players,
    });
  });

  socket.on('join_room', ({ code, password, nick }) => {
    if (!rooms[code]) return socket.emit('error_msg', 'Комната не найдена');
    joinRoomLogic(socket, code, password, false, nick);
  });

  function joinRoomLogic(socket, code, password, isCreator, nick = 'Пилот') {
    const room = rooms[code];
    if (room.password && room.password !== password) {
      return socket.emit('error_msg', 'Неверный пароль');
    }
    if (room.players.length >= room.maxPlayers) {
      return socket.emit('error_msg', 'Комната заполнена');
    }
    let team = 'spectator';
    if (room.mode === 'duel') {
      team = room.players.filter(p => !p.isBot).length === 0 ? 'blue' : 'red';
    } else {
      const blueCount = room.players.filter(p => p.team === 'blue').length;
      const redCount = room.players.filter(p => p.team === 'red').length;
      team = blueCount <= redCount ? 'blue' : 'red';
    }

    const playerData = {
      id: socket.id, team, nick,
      isHost: isCreator, isReady: false,
      x: team === 'blue' ? 200 : 3000, y: 550,
      angle: team === 'blue' ? 0 : Math.PI,
      vx: 0, vy: 0,
      hp: 100,
    };
    room.players.push(playerData);
    socket.join(code);
    socket.roomCode = code;

    io.to(code).emit('lobby_update', {
      code: room.code, mode: room.mode, players: room.players,
    });
  }

  socket.on('start_game', ({ code, wallsCTF, wallsDuel, basesCTF, basesDuel }) => {
    const room = rooms[code];
    if (!room) return;
    const host = room.players.find(p => p.id === socket.id);
    if (!host || !host.isHost) {
      return socket.emit('error_msg', 'Только создатель может начать игру');
    }
    const notReady = room.players.filter(p => p.id !== socket.id && !p.isBot && !p.isReady);
    if (notReady.length > 0) {
      return socket.emit('error_msg', 'Не все игроки готовы!');
    }

    if (room.mode === 'ctf' && Array.isArray(wallsCTF)) room.walls = wallsCTF;
    else if (room.mode === 'duel' && Array.isArray(wallsDuel)) room.walls = wallsDuel;
    // Сохраняем базы для CTF
    if (room.mode === 'ctf' && basesCTF) room.bases = basesCTF;
    if (room.mode === 'duel' && basesDuel) room.bases = basesDuel; // <--- ДОБАВИТ
    room.state = 'starting';
    room.bullets = [];
    room.nextBulletId = 1;

    io.to(code).emit('countdown_start');

    setTimeout(() => {
      if (!rooms[code] || rooms[code].state !== 'starting') return;
      room.state = 'playing';

      room.flag.state = 'center';
      room.flag.carrierId = null;
      room.flag.carrierTeam = null;
      room.flag.x = 1600;
      room.flag.y = 550;
      room.flag.vy = 0;
      room.flag.canBePickedAt = 0;
      room.flag.lastOwner = null;
      room.flag.captureProgress = 0;
      room.flag.captureTeam = null;
      room.flag.onFloor = false;
            // Сброс счётчика заморозок
      room.freezeScores = { blue: 0, red: 0 };

      const isCTF = room.mode === 'ctf';

      for (const botId in room.bots) {
        const b = room.bots[botId];
        const base = (room.bases && room.bases[b.team]) 
          ? room.bases[b.team] 
          : { x: isCTF ? (b.team === 'blue' ? 200 : 3000) : (b.team === 'blue' ? 800 : 1200), y: isCTF ? 550 : 800 };
        b.x = base.x;
        b.y = base.y;
        b.angle = b.team === 'blue' ? 0 : Math.PI;
        b.vx = 0; b.vy = 0;
        b.angVel = 0;
        b.hp = 100;
        b.freezeCount = 0; 
        b.hasFlag = false;
        b.captureTimer = 0;
        b.isDead = false;
        b.respawnTimer = 0;
        b.isFrozen = false;
        b.state = room.mode === 'ctf' ? 'seekFlag' : 'patrol';
        b.waypoint = null;
      }

      for (const p of room.players) {
        p.hp = 100;
        p.freezeCount = 0;
        const base = (room.bases && room.bases[p.team]) 
          ? room.bases[p.team] 
          : { x: isCTF ? (p.team === 'blue' ? 200 : 3000) : (p.team === 'blue' ? 800 : 1200), y: isCTF ? 550 : 800 };
        p.x = base.x;
        p.y = base.y;
        p.vx = 0; p.vy = 0;
      }

      room.players.forEach(p => {
        io.to(p.id).emit('game_start', {
          code: room.code,
          mode: room.mode,
          myTeam: p.team,
          players: room.players,
          weapon: room.weapon,
        });
      });
    }, 5000);
  });

  socket.on('player_move', (data) => {
    const room = rooms[data.code];
    if (!room || room.state !== 'playing') return;

    const p = room.players.find(pl => pl.id === socket.id);
    if (p) {
      p.x = data.x; p.y = data.y; p.angle = data.angle;
      p.vx = data.vx || 0;
      p.vy = data.vy || 0;
      p.isFrozen = !!data.isFrozen;  // ← НОВОЕ
    }

    socket.to(data.code).emit('player_moved', {
      id: socket.id,
      x: data.x, y: data.y, angle: data.angle,
      vx: data.vx || 0, vy: data.vy || 0,
      propellerAngle: data.propellerAngle,
      hp: p ? p.hp : 100,
    });
  });

  // ---------- ВЫСТРЕЛ: сервер создаёт снаряд ----------
  socket.on('player_shoot', (data) => {
    const room = rooms[data.code];
    if (!room || room.state !== 'playing') return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || p.hp <= 0) return;

    const vx = Math.max(-BULLET_MAX_SPEED, Math.min(BULLET_MAX_SPEED, Number(data.vx) || 0));
    const vy = Math.max(-BULLET_MAX_SPEED, Math.min(BULLET_MAX_SPEED, Number(data.vy) || 0));
    const angle = Number(data.angle) || 0;

    const spawnX = p.x + Math.cos(angle) * 30;
    const spawnY = p.y + Math.sin(angle) * 30;

    createBullet(room, data.code, {
      ownerId: socket.id,
      team: p.team,
      x: spawnX, y: spawnY,
      vx, vy, angle,
      isCryo: !!data.isCryo,
      damage: BULLET_DAMAGE,
    });
  });

  // ---------- ТАРАН: клиент шлёт player_hit ----------
  socket.on('player_hit', (data) => {
    const room = rooms[data.code];
    if (!room || room.state !== 'playing') return;
    const attacker = room.players.find(p => p.id === socket.id);
    if (!attacker || attacker.hp <= 0) return;

    if (!socket._lastHitTime) socket._lastHitTime = 0;
    const now = Date.now();
    if (now - socket._lastHitTime < 150) return;
    socket._lastHitTime = now;

    const dmg = Math.min(30, Math.max(1, Math.floor(Number(data.damage) || 15)));

    let target = null;
    if (data.targetId.startsWith('bot_') && room.bots && room.bots[data.targetId]) {
      target = { type: 'bot', id: data.targetId, obj: room.bots[data.targetId] };
    } else {
      const p = room.players.find(pl => pl.id === data.targetId && !pl.isBot);
      if (p) target = { type: 'player', id: p.id, obj: p };
    }
    if (!target) return;
    if (target.obj.team === attacker.team) return;

    applyBulletDamage(room, data.code, target, dmg, null);
  });

  // ---------- CTF ----------
  socket.on('flag_pickup', ({ code, playerId, team }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.flag.state === 'carried') return;
    if (room.flag.canBePickedAt && Date.now() < room.flag.canBePickedAt) return;

    room.flag.state = 'carried';
    room.flag.carrierId = playerId;
    room.flag.carrierTeam = team;
    room.flag.lastOwner = playerId;
    room.flag.canBePickedAt = 0;
    room.flag.captureProgress = 0;
    room.flag.captureTeam = team;
    room.players.forEach(p => p.hasFlag = false);
    const p = room.players.find(pl => pl.id === playerId);
    if (p) p.hasFlag = true;
  });

  socket.on('flag_drop', ({ code, x, y }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.flag.carrierId !== socket.id) return;
    room.flag.state = 'dropped';
    room.flag.carrierId = null;
    room.flag.carrierTeam = null;
    room.flag.x = x;
    room.flag.y = y;
    room.flag.vy = 0;
    room.flag.canBePickedAt = Date.now() + 2000;
    room.flag.captureProgress = 0;
    room.flag.captureTeam = null;
    room.flag.onFloor = false;
    room.players.forEach(p => p.hasFlag = false);
  });

  socket.on('freeze_player', ({ code, targetId }) => {
    // Оставлено для совместимости; сервер сам замораживает по isCryo-снаряду.
    const room = rooms[code];
    if (!room) return;
    if (targetId.startsWith('bot_') && room.bots && room.bots[targetId]) {
      const bot = room.bots[targetId];
      bot.isFrozen = true;
      bot.freezeTimer = 5.0;
    } else {
      io.to(targetId).emit('get_frozen', { by: socket.id });
    }
  });

  socket.on('player_abandon', ({ code }) => {
    const room = rooms[code];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (player.isHost) {
      // ХОСТ ЗАКРЫВАЕТ КОМНАТУ ЦЕЛИКОМ
      socket.to(code).emit('room_closed');   // остальным, но не себе
      const sockets = io.sockets.adapter.rooms.get(code);
      if (sockets) {
        for (const sid of sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(code);
        }
      }
      delete rooms[code];
      socket.leave(code);
      socket.roomCode = null;
      console.log(`🚪 Комната ${code} закрыта хостом`);
    } else {
      // НЕ-ХОСТ — просто выходит
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(code);
      socket.roomCode = null;
      socket.to(code).emit('opponent_left', { id: socket.id });
      io.to(code).emit('lobby_update', {
        code: room.code, mode: room.mode, players: room.players,
      });
      console.log(`🚪 Игрок ${socket.id} покинул комнату ${code}`);
    }
  });
  socket.on('player_dead', ({ code }) => {
    const room = rooms[code];
    if (!room || room.mode !== 'duel') return;
    if (room.state !== 'playing') return;
    room.state = 'ended';
    room.bots = {};
    room.bullets = [];
    socket.to(code).emit('opponent_dead');
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const player = room.players.find(p => p.id === socket.id);

    if (player && player.isHost) {
      io.to(code).emit('room_closed');
      const sockets = io.sockets.adapter.rooms.get(code);
      if (sockets) {
        for (const sid of sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(code);
        }
      }
      delete rooms[code];
      return;
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    socket.to(code).emit('opponent_left', { id: socket.id });

    if (room.players.length === 0) {
      delete rooms[code];
    } else {
      io.to(code).emit('lobby_update', {
        code: room.code, mode: room.mode, players: room.players,
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));