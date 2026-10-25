// ================================================================
//  js/multiplayer.js — СЕТЕВАЯ ИГРА (PvP)
// ================================================================

let socket = null;
// ================================================================
// НАСТРОЙКИ СЕРВЕРОВ
// ================================================================
const SERVER_URLS = {
  local: window.location.origin, 
  online: 'https://lodka777.ru' // <-- Теперь с HTTPS!
};

let currentServerMode = 'local'; // 'local' или 'online'

function getSocketURL() {
  // Если мы уже на локальном сервере, то local = текущий origin
  if (currentServerMode === 'local') {
    // Проверяем: если мы на localhost или локальном IP, используем текущий origin
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.startsWith('192.168.') || 
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.')) {
      return window.location.origin;
    }
    // Если мы на облачном сервере, но выбрали "локальную", пробуем localhost:3000
    return 'http://localhost:3000';
  }
  return SERVER_URLS.online;
}
let myRoomCode = null;
let amIPlayer1 = false;

// Переменные для PvP

let pvpGameEnded = false;

let remoteTorpedoes = [];
let opponentPos = { x: 0, y: 0, angle: 0, propellerAngle: 0, visible: false };
let opponentTarget = { x: 0, y: 0, angle: 0, propellerAngle: 0, hp: 100 };




function initMultiplayer() {
  if (socket) return; 

  const url = getSocketURL();
  console.log('🔌 Подключение к:', url);
  socket = io(url);
  
  socket.on('connect', () => {
    console.log('✅ Подключено к серверу:', socket.id);
    socket.emit('request_rooms'); // Запрашиваем список комнат при входе
  });

  // 1. Получение списка комнат
  socket.on('rooms_list', (rooms) => {
    const listContainer = el('mpServerList');
    if (!listContainer) return;
    
    if (rooms.length === 0) {
      listContainer.innerHTML = '<div style="color: #5a6a7a; text-align: center; padding: 20px;">Нет активных серверов. Создайте свой!</div>';
      return;
    }

    let html = '';
    rooms.forEach(room => {
      const isFull = room.players >= 2;
      const lockIcon = room.hasPassword ? '🔒' : '🔓';
      const btnText = isFull ? 'Заполнен' : 'Войти';
      const btnDisabled = isFull ? 'disabled' : '';
      
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #1e3a55; font-size: 13px;">
          <div>
            <span style="color: #ffd166; font-weight: bold;">${lockIcon} ${room.name}</span><br>
            <span style="color: #5a6a7a; font-size: 11px;">Игроки: ${room.players}/2</span>
          </div>
          <button class="btn ${isFull ? 'secondary' : ''}" style="padding: 6px 12px; font-size: 12px;" ${btnDisabled} onclick="joinServer('${room.code}', ${room.hasPassword})">${btnText}</button>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  });

  // 2. Комната создана
  socket.on('room_created', ({ code }) => {
    myRoomCode = code;
    amIPlayer1 = true;
    el('mpStatus').textContent = `Код комнаты: ${code} — ждём второго игрока...`;
    el('mpStatus').style.color = '#ffd166';
  });

  // 3. Игра началась
  socket.on('game_start', (data) => {
    myRoomCode = data.code;
    amIPlayer1 = (data.p1 === socket.id);
    
    pvpGameEnded = false;
    remoteTorpedoes = [];
    opponentPos.visible = false;
    opponentTarget.hp = 100;
    
    if (typeof inventory !== 'undefined') {
      inventory.torpedo = true;
      inventory.winch = true;
      inventory.flashlight = true;
      inventory.map = true;
    }
    
    showToast(`🎮 Дуэль! Ты — ${amIPlayer1 ? 'СИНИЙ' : 'КРАСНЫЙ'}`);
    if (typeof startLevel === 'function') {
      currentLevel = 'PVP';
      startLevel('PVP');
    }
  });

  // 4. СИНХРОНИЗАЦИЯ ДВИЖЕНИЯ ВРАГА (ТО, ЧТО ПОТЕРЯЛОСЬ!)
  socket.on('opponent_move', (data) => {
    opponentTarget.x = Number(data.x) || 0;
    opponentTarget.y = Number(data.y) || 0;
    opponentTarget.angle = Number(data.angle) || 0;
    opponentTarget.propellerAngle = Number(data.propellerAngle) || 0;
    opponentTarget.hp = (data.hp !== undefined && !isNaN(data.hp)) ? Number(data.hp) : 100;
    opponentPos.visible = true; // <--- ДЕЛАЕМ ВРАГА ВИДИМЫМ
  });

  // 5. Выстрелы врага
  socket.on('opponent_shoot', (data) => {
    console.log('💥 Прилетела торпеда врага');
    remoteTorpedoes.push({
      x: data.x, y: data.y, vx: data.vx, vy: data.vy, angle: data.angle, life: 3.0
    });
  });

  // 6. Получение урона
  socket.on('opponent_hit', (data) => {
    if (pvpGameEnded) return;
    sub.hp -= data.damage;
    showToast(`💥 Тебе нанесли ${data.damage} урона!`);
    
    if (typeof mpSendMyPosition === 'function' && myRoomCode) {
      mpSendMyPosition(sub.x, sub.y, sub.angle, sub.propellerAngle, sub.hp);
    }
    
    if (sub.hp <= 0) { 
      sub.hp = 0; 
      if (typeof mpSendDead === 'function') mpSendDead(); 
      pvpGameOver(false); 
    }
  });

  // 7. Враг умер (Победа!)
  socket.on('opponent_dead', () => {
    if (!pvpGameEnded) {
      pvpGameOver(true); 
    }
  });

  // 8. Враг отключился
  socket.on('opponent_left', () => {
    opponentPos.visible = false;
    el('mpStatus').textContent = '⚠️ Соперник вышел.';
    el('mpStatus').style.color = '#ff6b6b';
    showToast('⚠️ Соперник отключился!');
  });

  // 9. Ошибки от сервера
  socket.on('error_msg', (msg) => {
    el('mpStatus').textContent = '❌ ' + msg;
    el('mpStatus').style.color = '#ff6b6b';
  });
}

function mpCreateRoom() {
  initMultiplayer();
  const name = el('mpRoomName').value.trim() || 'Без названия';
  const password = el('mpCreatePassword').value.trim();
  socket.emit('create_room', { name, password });
}

function mpJoinRoom() {
  initMultiplayer();
  const code = el('mpCodeInput').value.trim().toUpperCase();
  if (!code) return showToast('Введите код комнаты');
  socket.emit('join_room', { code, password: null }); // Если по коду, пароль не спрашиваем (для простоты)
}

// Глобальная функция для клика по кнопке "Войти" в списке
window.joinServer = function(code, hasPassword) {
  initMultiplayer();
  let password = null;
  if (hasPassword) {
    password = prompt('Введите пароль для подключения:');
    if (password === null) return; // Пользователь нажал "Отмена"
  }
  socket.emit('join_room', { code, password });
};
function mpJoinRoom() {
  initMultiplayer();
  const code = el('mpCodeInput').value.trim().toUpperCase();
  if (!code) return showToast('Введите код комнаты');
  socket.emit('join_room', { code });
}

function mpSendMyPosition(x, y, angle, propellerAngle, hp) {
  if (socket && myRoomCode) socket.emit('player_move', { code: myRoomCode, x, y, angle, propellerAngle, hp });
}
function mpSendShoot(x, y, vx, vy, angle) {
  if (socket && myRoomCode) socket.emit('player_shoot', { code: myRoomCode, x, y, vx, vy, angle });
}
function mpSendHit(damage) {
  if (socket && myRoomCode) socket.emit('player_hit', { code: myRoomCode, damage: damage });
}

function pvpGameOver(isWin) {
  if (pvpGameEnded) return;
  pvpGameEnded = true;
  
  if (typeof running !== 'undefined') running = false;
  if (typeof stopMotor === 'function') stopMotor();
  
  // Скрываем лодку врага и очищаем снаряды
  if (typeof opponentPos !== 'undefined') opponentPos.visible = false;
  if (typeof remoteTorpedoes !== 'undefined') remoteTorpedoes = [];
  if (typeof torpedoes !== 'undefined') torpedoes = [];

  // Сбрасываем лобби, чтобы можно было создать новую комнату
  myRoomCode = null;
  
  // Показываем сообщение
  showToast(isWin ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ...');
  
  // Через 2 секунды показываем статистику
  setTimeout(() => { 
    showPvPStats(isWin);
  }, 2000);
}

function showPvPStats(isWin) {
  const statsContainer = document.getElementById('stats');
  const titleEl = document.getElementById('result-title');
  if (!statsContainer || !titleEl) return;

  titleEl.textContent = isWin ? '🏆 ПОБЕДА В ДУЭЛИ!' : '💀 ПОРАЖЕНИЕ...';
  titleEl.style.color = isWin ? '#ffd166' : '#ff6b6b';
  
  const timeStr = typeof elapsed !== 'undefined' ? elapsed.toFixed(1) : '0.0';
  const myHp = typeof sub !== 'undefined' ? Math.round(sub.hp) : 0;
  const enemyHp = typeof opponentTarget !== 'undefined' ? Math.round(opponentTarget.hp) : 0;
  
  statsContainer.innerHTML = `
    <div class="row"><span>Режим</span><span class="val">⚔️ Дуэль (PvP)</span></div>
    <div class="row"><span>Время боя</span><span class="val">${timeStr} с</span></div>
    <div class="row"><span>Твой корпус</span><span class="val ${myHp > 0 ? 'good' : 'bad'}">${myHp} / 100</span></div>
    <div class="row"><span>Корпус врага</span><span class="val ${enemyHp > 0 ? 'good' : 'bad'}">${enemyHp} / 100</span></div>
    <div class="row"><span>Вердикт</span><span class="val">${isWin ? 'Ты сильнее!' : 'Повезёт в следующий раз'}</span></div>
    
    <div style="margin-top: 24px; text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <button class="btn gold" id="pvpPlayAgainBtn">🔄 В лобби (Реванш)</button>
      <button class="btn secondary" id="pvpMapBtn">🗺 На карту</button>
    </div>
  `;
  
  document.getElementById('pvpPlayAgainBtn').addEventListener('click', () => {
    if (typeof showScreen === 'function') showScreen('multiplayer');
    // Сбрасываем статус лобби
    const statusEl = document.getElementById('mpStatus');
    if (statusEl) {
      statusEl.textContent = 'Выберите действие для новой дуэли';
      statusEl.style.color = '#7fd6ff';
    }
    // Переподключаемся, если сокет отвалился
    if (typeof initMultiplayer === 'function') initMultiplayer();
  });
  
  document.getElementById('pvpMapBtn').addEventListener('click', () => {
    if (typeof goToMap === 'function') goToMap();
  });
  
  if (typeof showScreen === 'function') showScreen('stats');
}

if (typeof el !== 'undefined') {
  const mpCreateBtn = el('mpCreateBtn');
  if (mpCreateBtn) mpCreateBtn.addEventListener('click', mpCreateRoom);
  const mpJoinBtn = el('mpJoinBtn');
  if (mpJoinBtn) mpJoinBtn.addEventListener('click', mpJoinRoom);
  const mpBackBtn = el('mpBackBtn');
  if (mpBackBtn) mpBackBtn.addEventListener('click', () => showScreen('map'));
}

function mpSendDead() {
  if (socket && myRoomCode) {
    socket.emit('player_dead', { code: myRoomCode });
  }
}

// Переключатель режимов сервера
const modeLocalBtn = el('modeLocalBtn');
const modeOnlineBtn = el('modeOnlineBtn');

// Привязка кнопок лобби
if (typeof el !== 'undefined') {
  const mpCreateBtn = el('mpCreateBtn');
  if (mpCreateBtn) mpCreateBtn.addEventListener('click', mpCreateRoom);

  const mpJoinBtn = el('mpJoinBtn');
  if (mpJoinBtn) mpJoinBtn.addEventListener('click', mpJoinRoom);

  const mpRefreshBtn = el('mpRefreshBtn');
  if (mpRefreshBtn) mpRefreshBtn.addEventListener('click', () => {
    if (socket) socket.emit('request_rooms');
  });

  const mpBackBtn = el('mpBackBtn');
  if (mpBackBtn) mpBackBtn.addEventListener('click', () => showScreen('map'));

  const mpDirectJoinBtn = el('mpDirectJoinBtn');
  if (mpDirectJoinBtn) mpDirectJoinBtn.addEventListener('click', () => {
    const box = el('mpDirectJoinBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  // ... (твой старый код для кнопок переключения режима local/online) ...
}


if (modeLocalBtn && modeOnlineBtn) {
  modeLocalBtn.addEventListener('click', () => {
    if (currentServerMode === 'local') return;
    currentServerMode = 'local';
    modeLocalBtn.style.background = '#2b7fff';
    modeLocalBtn.style.color = 'white';
    modeOnlineBtn.style.background = 'transparent';
    modeOnlineBtn.style.color = '#7fd6ff';
    
    // Переподключаем сокет
    if (socket) socket.disconnect();
    socket = null;
    initMultiplayer();
    showToast('🏠 Режим: Локальная сеть');
    
    const statusEl = el('mpStatus');
    if (statusEl) statusEl.textContent = 'Режим: Локальная сеть. Создайте или присоединитесь к комнате.';
  });

  modeOnlineBtn.addEventListener('click', () => {
    if (currentServerMode === 'online') return;
    currentServerMode = 'online';
    modeOnlineBtn.style.background = '#2b7fff';
    modeOnlineBtn.style.color = 'white';
    modeLocalBtn.style.background = 'transparent';
    modeLocalBtn.style.color = '#7fd6ff';
    
    if (socket) socket.disconnect();
    socket = null;
    initMultiplayer();
    showToast('🌐 Режим: Интернет');
    
    const statusEl = el('mpStatus');
    if (statusEl) statusEl.textContent = 'Режим: Интернет. Создайте или присоединитесь к комнате.';
  });

  
}
