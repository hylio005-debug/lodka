// ================================================================
//  js/render.js — ОТРИСОВКА
// ================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

function updateZoom() {
  zoom = W / getTargetViewWidth();
  zoom = Math.max(0.6, Math.min(zoom, 2.5));
}

function resize() {
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  W = canvas.width = Math.round(cssW * renderScale);
  H = canvas.height = Math.round(cssH * renderScale);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  updateZoom();
}
window.addEventListener('resize', resize);

function updateCamera() {
  const vw = viewW(), vh = viewH();
  let cx = sub.x - vw / 2, cy = sub.y - vh / 2;
  cx = Math.max(0, Math.min(WORLD_W - vw, cx));
  cy = Math.max(0, Math.min(WORLD_H - vh, cy));
  if (WORLD_W < vw) cx = (WORLD_W - vw) / 2;
  if (WORLD_H < vh) cy = (WORLD_H - vh) / 2;
  camera.x = cx; camera.y = cy;
}

// ---------- Главная отрисовка ----------
function draw() {
  ctx.fillStyle = levelBgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  const vL = camera.x, vT = camera.y;
  const vR = camera.x + viewW(), vB = camera.y + viewH();

  if (qualityLevel !== 'low') drawLightRays(vL, vT, vR, vB);
  if (qualityLevel !== 'low') drawGrid(vL, vT, vR, vB);

  drawSeaFloor(vL, vR);

  if (levelType === 'rings') {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.x < vL - 100 || r.x > vR + 100) continue;
      drawRing(r, i === currentRingIndex);
    }
  }

  drawFinishPortal();

  for (const w of walls) {
    const minX = Math.min(w.x1, w.x2), maxX = Math.max(w.x1, w.x2);
    const minY = Math.min(w.y1, w.y2), maxY = Math.max(w.y1, w.y2);
    if (maxX < vL - 40 || minX > vR + 40) continue;
    if (maxY < vT - 40 || minY > vB + 40) continue;
    drawWall(w);
  }

  for (const f of fishes) {
    if (f.x < vL - 100 || f.x > vR + 100) continue;
    drawFish(f);
  }

  if (qualityLevel === 'high') {
    for (const p of collisionPoints) {
      if (p.type === 'wall') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 80, 0.55)';
        ctx.fill();
      }
    }
  }

  drawSub();

  for (const b of ambientBubbles) {
    if (b.x < vL - 20 || b.x > vR + 20) continue;
    if (b.y < vT - 20 || b.y > vB + 20) continue;
    const alpha = Math.max(0, 1 - b.life / b.maxLife);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 235, 255, ${0.5 * alpha})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawGrid(left, top, right, bottom) {
  const gridStep = 100;
  const sX = Math.floor(left / gridStep) * gridStep;
  const sY = Math.floor(top / gridStep) * gridStep;
  ctx.strokeStyle = levelGridColor;
  ctx.lineWidth = 1 / zoom;
  for (let x = sX; x <= right; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, sY); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let y = sY; y <= bottom; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(sX, y); ctx.lineTo(right, y); ctx.stroke();
  }
}

function drawLightRays(left, top, right, bottom) {
  const vw = right - left, vh = bottom - top;
  const t = sub.animTime;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(180, 220, 255, 0.05)';
  for (let i = 0; i < 4; i++) {
    const phase = i * 1.3 + t * 0.15;
    const x = left + ((i / 4) * vw + Math.sin(phase) * 100);
    const w = 100 + Math.sin(phase * 0.7) * 40;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.6 + vh * 0.4, bottom);
    ctx.lineTo(x - w * 0.4 + vh * 0.4, bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSeaFloor(left, right) {
  ctx.fillStyle = levelFloorColor;
  ctx.fillRect(left, FLOOR_Y, right - left, WORLD_H - FLOOR_Y + 50);
  ctx.fillStyle = levelFloorTopColor;
  ctx.fillRect(left, FLOOR_Y, right - left, 10);

  if (qualityLevel !== 'low') {
    ctx.fillStyle = levelHillColor;
    for (const h of seaFloorHills) {
      if (h.x + h.r < left || h.x - h.r > right) continue;
      ctx.beginPath();
      ctx.moveTo(h.x - h.r, FLOOR_Y + 4);
      ctx.quadraticCurveTo(h.x, FLOOR_Y - h.h, h.x + h.r, FLOOR_Y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (qualityLevel === 'high') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = Math.floor(left / 80) * 80; x < right; x += 80) {
      const px = x + ((x * 13) % 40);
      ctx.beginPath();
      ctx.arc(px, FLOOR_Y + 14 + ((x * 7) % 8), 3 + ((x * 3) % 4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
function drawSeaweed(sw) {
  const t = sub.animTime;
  const segments = 6;
  const segH = sw.height / segments;

  ctx.strokeStyle = sw.color;
  ctx.lineWidth = sw.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sw.x, sw.baseY);

  let px = sw.x, py = sw.baseY;
  for (let i = 1; i <= segments; i++) {
    const bend = Math.sin(t * sw.speed + sw.phase + i * 0.6) * (i / segments) * 10;
    const nx = sw.x + bend;
    const ny = sw.baseY - segH * i;
    ctx.lineTo(nx, ny);
    px = nx;
    py = ny;
  }
  ctx.stroke();

  // Листик на верхушке
  ctx.beginPath();
  ctx.ellipse(px, py, sw.width * 0.9, sw.width * 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = sw.color;
  ctx.fill();
}
function drawWall(w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ang = Math.atan2(dy, dx);
  const thickness = 22;

  ctx.save();
  ctx.translate(w.x1, w.y1);
  ctx.rotate(ang);

  ctx.fillStyle = '#6b5437';
  ctx.fillRect(0, -thickness / 2, len, thickness);

  ctx.strokeStyle = 'rgba(30, 18, 8, 0.7)';
  ctx.lineWidth = 1;
  const blockH = 14, blockW = 32;
  for (let y = -thickness / 2 + blockH; y < thickness / 2; y += blockH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(len, y); ctx.stroke();
  }
  let bc = 0;
  for (let x = 0; x < len; x += blockW) {
    bc++;
    if (bc % 2 === 0) continue;
    for (let y = -thickness / 2; y < thickness / 2; y += blockH) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + blockH); ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(255, 220, 150, 0.15)';
  ctx.fillRect(0, -thickness / 2, len, 3);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, thickness / 2 - 3, len, 3);

  ctx.restore();
}

function drawRing(r, isCurrent) {
  const t = sub.animTime;
  const pulse = isCurrent ? 1 + Math.sin(t * 3) * 0.08 : 1;

  const glow = ctx.createRadialGradient(r.x, r.y, r.r * 0.3, r.x, r.y, r.r * 1.8);
  if (r.passed) {
    glow.addColorStop(0, 'rgba(110, 231, 135, 0.35)');
    glow.addColorStop(1, 'rgba(110, 231, 135, 0)');
  } else if (isCurrent) {
    glow.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  } else {
    glow.addColorStop(0, 'rgba(127, 214, 255, 0.2)');
    glow.addColorStop(1, 'rgba(127, 214, 255, 0)');
  }
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.r * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(t * 0.8);

  const rr = r.r * pulse;
  ctx.strokeStyle = r.passed ? '#6ee787' : isCurrent ? '#ffd166' : 'rgba(127, 214, 255, 0.5)';
  ctx.lineWidth = isCurrent ? 6 / zoom : 4 / zoom;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.stroke();

  const segments = 8;
  ctx.strokeStyle = r.passed ? 'rgba(110, 231, 135, 0.6)' :
                    isCurrent ? 'rgba(255, 220, 130, 0.7)' : 'rgba(127, 214, 255, 0.3)';
  ctx.lineWidth = 2 / zoom;
  for (let i = 0; i < segments; i++) {
    ctx.rotate(Math.PI * 2 / segments);
    ctx.beginPath();
    ctx.moveTo(rr * 0.7, 0);
    ctx.lineTo(rr * 0.9, 0);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = r.passed ? '#6ee787' : isCurrent ? '#ffd166' : 'rgba(127, 214, 255, 0.5)';
  ctx.font = `bold ${14 / zoom}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.id, r.x, r.y);
}

function drawFinishPortal() {
  const t = sub.animTime;
  const allRingsPassed = levelType !== 'rings' || ringsCollected >= ringsRequired;
  const pulse = 1 + Math.sin(t * 2) * 0.08;

  const grad = ctx.createRadialGradient(finish.x, finish.y, finish.r * 0.3, finish.x, finish.y, finish.r * 2);
  if (allRingsPassed) {
    grad.addColorStop(0, 'rgba(255, 210, 100, 0.4)');
    grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
  } else {
    grad.addColorStop(0, 'rgba(120, 120, 120, 0.3)');
    grad.addColorStop(1, 'rgba(80, 80, 80, 0)');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * 1.1, 0, Math.PI * 2);
  ctx.strokeStyle = allRingsPassed ? '#d4a259' : '#5a5a5a';
  ctx.lineWidth = 8 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(finish.x, finish.y, finish.r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = allRingsPassed ? 'rgba(110, 231, 135, 0.3)' : 'rgba(80, 80, 80, 0.3)';
  ctx.fill();
  ctx.strokeStyle = allRingsPassed ? '#ffd166' : '#5a5a5a';
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();

  ctx.fillStyle = allRingsPassed ? '#ffd166' : '#7a7a7a';
  ctx.font = `bold ${11 / zoom}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(allRingsPassed ? 'ХРАМ' : '🔒', finish.x, finish.y);
}

function drawSub() {
  const t = sub.animTime;
  const invulnBlink = sub.invuln > 0 && Math.floor(sub.invuln * 20) % 2 === 0;
  const breath = 1 + Math.sin(t * 2.2) * 0.03;

  ctx.save();
  ctx.translate(sub.x, sub.y);
  ctx.rotate(sub.angle);
  ctx.scale(breath, breath);

  ctx.beginPath();
  ctx.ellipse(0, sub.r * 0.6, sub.r * 1.6, sub.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  ctx.save();
  ctx.translate(-sub.r * 1.7, 0);
  ctx.rotate(sub.propellerAngle);
  ctx.fillStyle = '#a0c8ff';
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(sub.r * 0.5, 0, sub.r * 0.45, sub.r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(-sub.r * 1.5, 0);
  ctx.lineTo(-sub.r * 1.2, -sub.r * 0.5);
  ctx.lineTo(-sub.r * 1.2, sub.r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#4f8cff';
  ctx.fill();

  const bg = ctx.createLinearGradient(0, -sub.r, 0, sub.r);
  bg.addColorStop(0, inContact ? '#ff8a8a' : (invulnBlink ? '#ffffff' : '#a4dfff'));
  bg.addColorStop(0.5, inContact ? '#ff6b6b' : (invulnBlink ? '#ffffff' : '#7fd6ff'));
  bg.addColorStop(1, inContact ? '#c94a4a' : (invulnBlink ? '#dddddd' : '#4a9edb'));

  ctx.beginPath();
  ctx.ellipse(0, 0, sub.r * 1.5, sub.r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = '#0b1a2a';
  ctx.lineWidth = 2 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sub.r * 0.25, 0, sub.r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11, 26, 42, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 220, 255, 0.7)';
  ctx.lineWidth = 1.2 / zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sub.r * 0.25, 0, sub.r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(160, 220, 255, 0.55)';
  ctx.fill();

  const lightOn = Math.sin(t * 6) > 0;
  ctx.beginPath();
  ctx.arc(sub.r * 0.25, -sub.r * 0.5, sub.r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = lightOn ? '#ffe066' : '#806020';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(sub.r * 1.5, 0);
  ctx.lineTo(sub.r * 1.1, -sub.r * 0.4);
  ctx.lineTo(sub.r * 1.1, sub.r * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#eaf6ff';
  ctx.fill();

  ctx.restore();
}

function drawFish(f) {
  if (f.type === 'angler') drawAnglerFish(f);
  else drawNormalFish(f);
}

function drawNormalFish(f) {
  const dir = f.dir >= 0 ? 1 : -1;
  const tailWag = Math.sin(f.tailPhase) * 0.5;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);
  ctx.beginPath();
  ctx.ellipse(0, 0, f.r * 1.4, f.r * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c17a5a';
  ctx.fill();
  ctx.strokeStyle = '#7a4a2a';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();
  ctx.save();
  ctx.translate(-f.r * 1.3, 0);
  ctx.rotate(tailWag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-f.r * 0.8, -f.r * 0.7);
  ctx.lineTo(-f.r * 0.8, f.r * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#c17a5a';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(f.r * 0.7, -f.r * 0.2, f.r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e0c8';
  ctx.fill();
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 0.8 / zoom;
  ctx.stroke();
  ctx.restore();
}

function drawAnglerFish(f) {
  const dir = f.dir >= 0 ? 1 : -1;
  const tailWag = Math.sin(f.tailPhase) * 0.5;
  const lurePulse = 0.7 + Math.sin(f.anglerPhase) * 0.3;
  const mouthOpen = 0.3 + Math.abs(Math.sin(f.mouthPhase)) * 0.7;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);

  if (qualityLevel !== 'low') {
    const lightGlow = ctx.createRadialGradient(f.r * 0.8, -f.r * 1.2, 2, f.r * 0.8, -f.r * 1.2, f.r * 5);
    lightGlow.addColorStop(0, `rgba(255, 240, 180, ${0.35 * lurePulse})`);
    lightGlow.addColorStop(0.5, `rgba(255, 220, 130, ${0.12 * lurePulse})`);
    lightGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.arc(f.r * 0.8, -f.r * 1.2, f.r * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(0, 0, f.r * 1.5, f.r * 1.0, 0, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.3, 2, 0, 0, f.r * 1.5);
  bodyGrad.addColorStop(0, '#3a2040');
  bodyGrad.addColorStop(1, '#0a0510');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();

  ctx.save();
  ctx.translate(-f.r * 1.4, 0);
  ctx.rotate(tailWag);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-f.r * 0.9, -f.r * 0.8);
  ctx.lineTo(-f.r * 0.6, 0);
  ctx.lineTo(-f.r * 0.9, f.r * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#2a1030';
  ctx.fill();
  ctx.strokeStyle = '#0a0510';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#1a0010';
  ctx.beginPath();
  ctx.moveTo(f.r * 0.6, 0);
  ctx.lineTo(f.r * 1.6, -f.r * 0.4 * mouthOpen);
  ctx.lineTo(f.r * 1.7, 0);
  ctx.lineTo(f.r * 1.6, f.r * 0.4 * mouthOpen);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 5; i++) {
    const tx = f.r * 0.7 + i * f.r * 0.2;
    ctx.beginPath();
    ctx.moveTo(tx, -f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.08, -f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.04, f.r * 0.15 * mouthOpen);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx, f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.08, f.r * 0.05);
    ctx.lineTo(tx + f.r * 0.04, -f.r * 0.15 * mouthOpen);
    ctx.closePath();
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(f.r * 0.4, -f.r * 0.3, f.r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc00';
  ctx.fill();
  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(f.r * 0.45, -f.r * 0.3, f.r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 1.5 / zoom;
  ctx.beginPath();
  ctx.moveTo(f.r * 0.5, -f.r * 0.6);
  ctx.quadraticCurveTo(f.r * 0.9, -f.r * 1.6, f.r * 0.9, -f.r * 2.0);
  ctx.stroke();

  const lureX = f.r * 0.9;
  const lureY = -f.r * 2.0;
  const lureR = f.r * 0.22 * (0.8 + lurePulse * 0.4);

  const lureGlow = ctx.createRadialGradient(lureX, lureY, 1, lureX, lureY, lureR * 4);
  lureGlow.addColorStop(0, `rgba(255, 250, 200, ${0.9 * lurePulse})`);
  lureGlow.addColorStop(0.3, `rgba(255, 220, 130, ${0.5 * lurePulse})`);
  lureGlow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = lureGlow;
  ctx.beginPath();
  ctx.arc(lureX, lureY, lureR * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lureX, lureY, lureR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 250, 220, 0.9)`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 130, 0.9)';
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  ctx.restore();
}
