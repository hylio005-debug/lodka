// ================================================================
//  js/multiplayer.js — Сетевой клиент (Поддержка N игроков)
// ================================================================

let socket = null;
const SERVER_URLS = { 
  local: window.location.origin, 
  online: 'https://lodka777.ru'   // ← сервер раздаёт и статику, и socket.io с одного домена
};
let currentServerMode = 'local';
let myRoomCode = null;
let myTeam = null;

let opponents = {}; 
let remoteTorpedoes = [];
let pvpGameEnded = false;



function getSocketURL() {
  // 🌐 Если нажата кнопка "Интернет" — подключаемся к продакшену
  if (currentServerMode === 'online') {
    return 'https://lodka777.ru';
  }

  // 🏠 Если "Локальная сеть":
  const host = window.location.hostname;
  const port = window.location.port;

  // Если игра открыта на порту 3000 (через node server.js) — используем его же
  if (port === '3000') {
    return window.location.origin;
  }
  // Если через Live Server (порт 5500) — шлём на 3000
  return 'http://localhost:3000';
}

function initMultiplayer() {
  if (socket && socket.connected) return;

  if (typeof io === 'undefined') {
    console.error('❌ Библиотека Socket.IO не загружена! Проверьте интернет или блокировщик рекламы.');
    showToast('❌ Ошибка сети: Socket.IO не загружен');
    return;
  }

  try {
    if (socket) socket.disconnect();
    
    socket = io(getSocketURL(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5
    });
  } catch (err) {
    console.error('❌ Ошибка при создании сокета:', err);
    return;
  }

  // Если io() вернул null
  if (!socket) {
    console.error('❌ io() вернул null. Библиотека заблокирована.');
    return;
  }

  socket.onAny((event, ...args) => {
    console.log('📡 ПРИШЛО СОБЫТИЕ:', event, args);
  });

  socket.on('connect', () => {
    console.log('✅ Подключено к серверу:', socket.id);
    socket.emit('request_rooms');
  });
// ⬇️⬇️⬇️ ВСТАВЬ КОД СЮДА (ПРЯМО ПОД БЛОКОМ CONNECT) ⬇️⬇️⬇️
  socket.on('room_closed', () => {
    showToast('❌ Создатель покинул комнату. Лобби закрыто.');

    myRoomCode = null;
    
    // Сбрасываем игровое состояние если были в бою
    if (typeof started !== 'undefined' && started) {
      started = false; running = false; paused = false;
      pvpGameEnded = false;
      if (typeof opponents !== 'undefined') {
        for (const k in opponents) delete opponents[k];
      }
      if (typeof remoteTorpedoes !== 'undefined') {
        remoteTorpedoes.length = 0;
      }
      const po = el('pauseOverlay'); if (po) po.classList.remove('show');
    }
    
    const lobby = el('mpLobby');
    const mainMenu = el('mpMainMenu');
    if (lobby) lobby.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
    
    if (el('mpStartBtn')) el('mpStartBtn').style.display = 'none';
    if (el('mpReadyBtn')) el('mpReadyBtn').style.display = 'none';
    if (el('mpCountdown')) el('mpCountdown').style.display = 'none';
    
    if (typeof showScreen === 'function') showScreen('multiplayer');
  });
  // ⬆️⬆️⬆️ КОНЕЦ ВСТАВКИ ⬆️⬆️⬆️





    // Слушаем список комнат
  socket.on('rooms_list', (rooms) => {
    const listContainer = el('mpServerList');
    if (!listContainer) return;
    
    if (rooms.length === 0) {
      listContainer.innerHTML = '<div style="color: #5a6a7a; text-align: center; padding: 20px;">Нет активных серверов. Создайте свой!</div>';
      return;
    }

    let html = '';
    rooms.forEach(room => {
      const isFull = room.players >= room.maxPlayers;
      const lockIcon = room.hasPassword ? '🔒' : '🔓';
      const btnText = isFull ? 'Заполнен' : 'Войти';
      const btnDisabled = isFull ? 'disabled' : '';
      
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #1e3a55; font-size: 13px;">
          <div>
            <span style="color: #ffd166; font-weight: bold;">${lockIcon} ${room.name}</span><br>
            <span style="color: #5a6a7a; font-size: 11px;">Игроки: ${room.players}/${room.maxPlayers} (${room.mode === 'ctf' ? '3x3' : '1x1'})</span>
          </div>
          <button class="btn ${isFull ? 'secondary' : ''}" style="padding: 6px 12px; font-size: 12px;" ${btnDisabled} onclick="joinServer('${room.code}', ${room.hasPassword})">${btnText}</button>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  });


  socket.on('lobby_update', (data) => {
    myRoomCode = data.code;

    const mainMenu = el('mpMainMenu');
    const lobby = el('mpLobby');
    if (mainMenu) mainMenu.style.display = 'none';
    if (lobby) {
      lobby.style.display = 'block';
      const title = lobby.querySelector('h3');
      if (title) title.innerHTML = `Код комнаты: <span style="color:#ffd166">${data.code}</span>`;
    }
    
    const list = el('mpPlayersList');
    const bluePlayers = data.players.filter(p => p.team === 'blue');
    const redPlayers = data.players.filter(p => p.team === 'red');
    const maxTeam = data.mode === 'ctf' ? 3 : 1;

    const me = data.players.find(p => p.id === socket.id);
    const isHost = me?.isHost;

    // Функция для отрисовки одного слота
    const renderSlot = (team, index) => {
      const player = team === 'blue' ? bluePlayers[index] : redPlayers[index];
      const teamColor = team === 'blue' ? '#7fd6ff' : '#ff6b6b';

      if (player) {
        // В слоте есть игрок
        const hostIcon = player.isHost ? ' 👑' : '';
        const readyIcon = player.isReady ? '✅' : '⏳';
        const removeBtn = (isHost && player.isBot) ? `<span style="cursor:pointer; color:#ff6b6b; font-weight:bold;" onclick="mpRemoveBot('${player.id}')">❌</span>` : '';
        
        return `<div style="color: ${teamColor}; padding: 8px 0; display: flex; justify-content: space-between; border-bottom: 1px solid #1e3a55;">
                  <span>${player.nick}${hostIcon}</span>
                  <div style="display:flex; gap:10px;">
                    <span>${readyIcon}</span>
                    ${removeBtn}
                  </div>
                </div>`;
      } else {
        // Слот пустой
        if (isHost) {
          // Хост видит выпадающий список
          return `<div style="padding: 4px 0; border-bottom: 1px dashed #1e3a55;">
                    <select onchange="mpAddBotToTeam('${team}')" style="width:100%; background:transparent; color:#5a6a7a; border:none; font-size:12px;">
                      <option value="">+ Добавить...</option>
                      <option value="bot">🤖 Бот (AI)</option>
                    </select>
                  </div>`;
        } else {
          // Обычный игрок видит пустоту
          return `<div style="color: #5a6a7a; padding: 8px 0; border-bottom: 1px dashed #1e3a55; font-size:12px;">Ожидание...</div>`;
        }
      }
    };

    let html = `
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <!-- Синяя команда -->
        <div style="flex: 1; border: 1px solid #7fd6ff; border-radius: 8px; padding: 10px;">
          <h4 style="color: #7fd6ff; margin: 0 0 10px 0; text-align: center;">Синие (${bluePlayers.length}/${maxTeam})</h4>
          ${Array.from({length: maxTeam}).map((_, i) => renderSlot('blue', i)).join('')}
        </div>

        <!-- Красная команда -->
        <div style="flex: 1; border: 1px solid #ff6b6b; border-radius: 8px; padding: 10px;">
          <h4 style="color: #ff6b6b; margin: 0 0 10px 0; text-align: center;">Красные (${redPlayers.length}/${maxTeam})</h4>
          ${Array.from({length: maxTeam}).map((_, i) => renderSlot('red', i)).join('')}
        </div>
      </div>
    `;
    list.innerHTML = html;

    // Кнопки
    const startBtn = el('mpStartBtn');
    const readyBtn = el('mpReadyBtn');

    if (isHost) {
      if (startBtn) startBtn.style.display = 'block';
      if (readyBtn) readyBtn.style.display = 'none';
    } else {
      if (startBtn) startBtn.style.display = 'none';
      if (readyBtn) {
        readyBtn.style.display = 'block';
        if (me.isReady) {
          readyBtn.textContent = '❌ ОТМЕНИТЬ ГОТОВНОСТЬ';
          readyBtn.style.background = '#7a1f2a';
          readyBtn.style.color = '#fff';
        } else {
          readyBtn.textContent = '✅ Я ГОТОВ';
          readyBtn.style.background = '#14324a';
          readyBtn.style.color = '#6ee787';
        }
      }
    }
  });

  // 2. Игра началась
    socket.on('game_start', (data) => {
    if (el('mpCountdown')) el('mpCountdown').style.display = 'none';
    // ... дальше твой код
    myRoomCode = data.code;
    myTeam = data.myTeam;
     myWeapon = data.weapon || 'torpedo';
    pvpGameEnded = false;
    remoteTorpedoes = [];
    opponents = {};
    freezeScore = { blue: 0, red: 0 };  // ← НОВОЕ: сброс счётчика

    if (typeof inventory !== 'undefined') {
      inventory.torpedo = true; inventory.winch = true; inventory.flashlight = true; inventory.map = true;
    }

    window.pvpPlayersInfo = {};
    data.players.forEach(p => {
      window.pvpPlayersInfo[p.id] = { nick: p.nick, team: p.team };
    });

    showToast(`🎮 Бой! Ты в команде ${myTeam === 'blue' ? 'СИНИХ' : 'КРАСНЫХ'}`);
    
    if (typeof startLevel === 'function') {
      currentLevel = data.mode === 'ctf' ? 'PVP_CTF' : 'PVP';
      startLevel(currentLevel);
    }
  });

  // 3. Движение, выстрелы и урон
  socket.on('player_moved', (data) => {
    if (!opponents[data.id]) {
      const info = (window.pvpPlayersInfo && window.pvpPlayersInfo[data.id]) || {};
      opponents[data.id] = {
        x: data.x, y: data.y, angle: data.angle,
        hp: 100, propellerAngle: 0, visible: true,
        team: info.team || 'blue',
        nick: info.nick || 'Пилот',
        vx: 0, vy: 0,
      };
    }
    opponents[data.id].targetX = data.x;
    opponents[data.id].targetY = data.y;
    opponents[data.id].targetAngle = data.angle;
    opponents[data.id].hp = data.hp;
    opponents[data.id].propellerAngle = data.propellerAngle;
    opponents[data.id].vx = data.vx || 0;
    opponents[data.id].vy = data.vy || 0;
});
  // Получение координат ботов
  // Получение координат ботов
  socket.on('bots_update', (botsData) => {
    if (pvpGameEnded) return;
    for (const botId in botsData) {
      const data = botsData[botId];
      
      // Защита: если пришёл null/NaN — пропускаем тик
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) continue;
      
      if (!opponents[botId]) {
        opponents[botId] = { 
          x: data.x, y: data.y, angle: data.angle, 
          hp: data.hp, propellerAngle: 0, visible: true,
          isBot: true, team: data.team, nick: data.nick,
          vx: 0, vy: 0,
        };
      }
      
      // При респавне (телепорт на базу) — мгновенно, без интерполяции
      if (data.justTeleported) {
        opponents[botId].x = data.x;
        opponents[botId].y = data.y;
        opponents[botId].angle = data.angle;
      }
      
      opponents[botId].targetX = data.x;
      opponents[botId].targetY = data.y;
      opponents[botId].targetAngle = data.angle;
      opponents[botId].hp = data.hp;
      opponents[botId].vx = data.vx || 0;
      opponents[botId].vy = data.vy || 0;



      opponents[botId].hasFlag = data.hasFlag;
      opponents[botId].isFrozen = data.isFrozen; 
      opponents[botId].isDead = !!data.isDead;
      opponents[botId].captureTimer = data.captureTimer || 0;

      opponents[botId].propellerAngle += 0.3;

      // Флаг теперь синхронизируется отдельно через flag_state
    }
});


    // ================================================================
  //  СНАРЯДЫ — сервер создаёт и удаляет, клиент только рисует
  // ================================================================
  socket.on('bullet_spawn', (data) => {
    remoteTorpedoes.push({
      id: data.id,
      x: data.x, y: data.y,
      vx: data.vx, vy: data.vy,
      angle: data.angle,
      life: 3.0,
      isCryo: data.isCryo,
      team: data.team,
      ownerId: data.ownerId,
    });
  });

  socket.on('bullet_despawn', (data) => {
    const idx = remoteTorpedoes.findIndex(t => t.id === data.id);
    if (idx >= 0) remoteTorpedoes.splice(idx, 1);
  });

    // ================================================================
  //  АВТОРИТАРНЫЙ HP — сервер решает, клиент только читает
  // ================================================================
  socket.on('your_hp', ({ hp }) => {
    if (typeof sub === 'undefined') return;
    if (typeof started === 'boolean' && !started) return;
    sub.hp = hp;
  });

  socket.on('you_died_ctf', ({ respawnIn }) => {
    if (typeof started === 'boolean' && !started) return;
    // Лодка мертва — исчезает, ждём респавна
    isPvpDead = true;
    pvpDeathTimer = respawnIn || 3;
    sub.hp = 0;
    sub.vx = 0; sub.vy = 0;
    isPvpFrozen = false;
    showToast(`💀 Лодка уничтожена! Респавн через ${Math.ceil(respawnIn)}...`);
  });

  socket.on('you_respawned', ({ x, y, hp }) => {
    if (typeof started === 'boolean' && !started) return; 
    sub.hp = hp;
    sub.x = x; sub.y = y;
    sub.vx = 0; sub.vy = 0;
    sub.invuln = 2.0;
    isPvpFrozen = false;
    isPvpDead = false;
    pvpDeathTimer = 0;
    showToast('🔄 Респавн на базе!');
  });

  socket.on('you_died', () => {
    if (pvpGameEnded) return;
    if (typeof started === 'boolean' && !started) return;
    sub.hp = 0;
    if (typeof pvpGameOver === 'function') pvpGameOver(false);
  });

  socket.on('game_over_duel', ({ winnerId }) => {
    if (pvpGameEnded) return;
    if (typeof started === 'boolean' && !started) return;  
    const iWon = (winnerId === socket.id);
    if (typeof pvpGameOver === 'function') pvpGameOver(iWon);
  });
  // ← ВСТАВЬ СЮДА (прямо под закрывающей }); от game_over_duel)
  socket.on('freeze_score', (data) => {
    if (typeof freezeScore !== 'undefined' && data) {
      freezeScore = data;
    }
  });
  // ← КОНЕЦ ВСТАВКИ
  // 4. CTF события
  // ================================================================
  //  ЕДИНЫЙ СНИМОК ФЛАГА (вместо 5 событий)
  // ================================================================
  socket.on('flag_state', (data) => {
    if (!data) return;
    ctfFlag.state = data.state;
    ctfFlag.x = data.x;
    ctfFlag.y = data.y;
    ctfFlag.vy = data.vy;
    ctfFlag.carrierId = data.carrierId;
    ctfFlag.carrierTeam = data.carrierTeam;
    ctfFlag.captureProgress = data.captureProgress || 0;
    ctfFlag.captureTeam = data.captureTeam;
    ctfFlag.onFloor = data.onFloor;
    ctfFlag.canBePickedAt = data.canBePickedAt || 0;   // ← ДОБАВИТЬ

    // HUD
    blueCaptureTime = (data.captureTeam === 'blue') ? data.captureProgress : 0;
    redCaptureTime  = (data.captureTeam === 'red')  ? data.captureProgress : 0;
    lastFlagOwnerTeam = data.carrierTeam;
  });



 

  socket.on('get_frozen', () => {
    if (typeof started === 'boolean' && !started) return; 
    isPvpFrozen = true;
    freezeReturnTimer = 5.0;
    showToast('❄️ Вас заморозили! Летите на базу...');
    // Сервер сам дропает флаг через applyBulletDamage.
    // Клиентский dropFlag() не нужен и перезатирает canBePickedAt.
  });
  
  socket.on('game_over_ctf', ({ winTeam }) => {
    if (typeof started === 'boolean' && !started) return;
    if (typeof pvpGameOverCTF === 'function') pvpGameOverCTF(winTeam);
  });

  socket.on('player_froze', ({ targetId }) => {
    if (opponents[targetId]) {
      opponents[targetId].isFrozen = true;
      opponents[targetId].freezeTimer = 5.0;
    }
  });

  socket.on('opponent_left', (data) => {
    if (opponents[data.id]) opponents[data.id].visible = false;
  });

  socket.on('error_msg', (msg) => {
    const statusEl = el('mpStatus');
    if (statusEl) {
      statusEl.textContent = '❌ ' + msg;
      statusEl.style.color = '#ff6b6b';
    }
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Ошибка подключения к серверу:', err.message);
  });
    // ⬇️⬇️⬇️ ВОТ СЮДА ВСТАВЛЯЕМ ⬇️⬇️⬇️
  socket.on('opponent_dead', () => {
    if (pvpGameEnded) return;
    // В CTF смерть = респавн, а не конец матча
    if (currentLevel === 'PVP_CTF') return;
    if (typeof pvpGameOver === 'function') pvpGameOver(true);
  });

  const readyBtn = el('mpReadyBtn');
  if (readyBtn) {
    readyBtn.addEventListener('click', () => {
      if (socket && myRoomCode) {
        socket.emit('toggle_ready', { code: myRoomCode });
      }
    });
  }

  socket.on('freeze_score', (data) => {
    if (typeof freezeScore !== 'undefined') {
      freezeScore = data;
    }
  });

  // ⬆️⬆️⬆️ КОНЕЦ ВСТАВКИ ⬆️⬆️⬆️
socket.on('countdown_start', () => {
    if (el('mpStartBtn')) el('mpStartBtn').style.display = 'none';
    if (el('mpReadyBtn')) el('mpReadyBtn').style.display = 'none';
    
    const cd = el('mpCountdown');
    if (cd) {
      cd.style.display = 'block';
      let timeLeft = 5;
      cd.textContent = timeLeft;
      
      const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
          cd.textContent = timeLeft;
        } else {
          clearInterval(timer);
          cd.textContent = 'GO!';
        }
      }, 1000);
    }
  });
  // Кнопка добавления бота


}

// ================================================================
//  ФУНКЦИИ ОТПРАВКИ
// ================================================================
function mpSendMyPosition(x, y, angle, propellerAngle, hp) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('player_move', {
      code: myRoomCode,
      x, y, angle, propellerAngle, hp,
      vx: (typeof sub !== 'undefined' ? sub.vx : 0) || 0,
      vy: (typeof sub !== 'undefined' ? sub.vy : 0) || 0,
      isFrozen: (typeof isPvpFrozen !== 'undefined' && isPvpFrozen) || false, // ← НОВОЕ
    });
  }
}

function mpSendShoot(x, y, vx, vy, angle, isCryo) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('player_shoot', { code: myRoomCode, x, y, vx, vy, angle, isCryo });
  }
}

function mpSendHit(targetId, damage) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('player_hit', { code: myRoomCode, targetId, damage });
  }
}

function mpSendFlagPickup(playerId) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('flag_pickup', { code: myRoomCode, playerId: playerId, team: myTeam });
  }
}

function mpSendFlagDrop(x, y) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('flag_drop', { code: myRoomCode, x: x, y: y });
  }
}

function mpSendFreeze(targetId) {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('freeze_player', { code: myRoomCode, targetId: targetId });
  }
}

// ================================================================
//  ДЕЙСТВИЯ В ЛОББИ
// ================================================================
function mpCreateRoom() {
  initMultiplayer();

  if (!socket) {
    showToast('❌ Нет соединения');
    return;
  }

  const doCreate = () => {
    const name = el('mpRoomName').value.trim() || 'Комната';
    const password = el('mpCreatePassword').value.trim();
    const mode = el('mpMode').value;
    const weapon = el('mpWeapon') ? el('mpWeapon').value : 'torpedo';
    const nick = (typeof currentPlayer !== 'undefined' && currentPlayer) ? currentPlayer.short : 'Игрок';

    console.log('🟢 Создаем комнату:', { name, password, mode, nick, weapon });
    socket.emit('create_room', { name, password, mode, nick, weapon });
  };

  if (socket.connected) {
    doCreate();
  } else {
    showToast('⏳ Подключение к серверу...');
    socket.once('connect', doCreate);
  }
}


function mpJoinRoom() {
  initMultiplayer();
  if (!socket) {
    showToast('❌ Нет соединения');
    return;
  }

  const code = el('mpCodeInput').value.trim().toUpperCase();
  const nick = (typeof currentPlayer !== 'undefined' && currentPlayer) ? currentPlayer.short : 'Гость';
  if (!code) return showToast('Введите код комнаты');

  const doJoin = () => {
    socket.emit('join_room', { code, password: null, nick });
  };

  if (socket.connected) {
    doJoin();
  } else {
    showToast('⏳ Подключение...');
    socket.once('connect', doJoin);
  }
}

// ================================================================
//  ПРИВЯЗКА КНОПОК
// ================================================================
if (typeof el !== 'undefined') {
  const mpCreateBtn = el('mpCreateBtn');
  if (mpCreateBtn) mpCreateBtn.addEventListener('click', mpCreateRoom);

  const mpJoinBtn = el('mpJoinBtn');
  if (mpJoinBtn) mpJoinBtn.addEventListener('click', mpJoinRoom);

  const mpRefreshBtn = el('mpRefreshBtn');
  if (mpRefreshBtn) mpRefreshBtn.addEventListener('click', () => {
    if (socket && socket.connected) socket.emit('request_rooms');
  });

  const mpBackBtn = el('mpBackBtn');
  if (mpBackBtn) mpBackBtn.addEventListener('click', () => showScreen('map'));

  const mpDirectJoinBtn = el('mpDirectJoinBtn');
  if (mpDirectJoinBtn) mpDirectJoinBtn.addEventListener('click', () => {
    const box = el('mpDirectJoinBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  const mpStartBtn = el('mpStartBtn');
  if (mpStartBtn) {
    mpStartBtn.addEventListener('click', () => {
      if (socket && socket.connected && myRoomCode) {
        const wallsCTF  = (typeof LEVELS !== 'undefined' && LEVELS['PVP_CTF']) ? LEVELS['PVP_CTF'].walls : [];
        const wallsDuel = (typeof LEVELS !== 'undefined' && LEVELS['PVP'])     ? LEVELS['PVP'].walls     : [];
        
        // ⚡ Один источник правды: генерируем базы из start-координат
        const basesCTF  = getBasesFromLevel(LEVELS['PVP_CTF']);
        const basesDuel = getBasesFromLevel(LEVELS['PVP']);
        
        socket.emit('start_game', { code: myRoomCode, wallsCTF, wallsDuel, basesCTF, basesDuel });
      }
    });
  }

  const mpLeaveLobbyBtn = el('mpLeaveLobbyBtn');
  if (mpLeaveLobbyBtn) {
    mpLeaveLobbyBtn.addEventListener('click', () => {
      if (socket && socket.connected && myRoomCode) {
        socket.emit('player_abandon', { code: myRoomCode });
      }
      myRoomCode = null;
      el('mpLobby').style.display = 'none';
      el('mpMainMenu').style.display = 'flex';
    });
  }
    // ================================================================
  //  Переключение режимов Локальная / Интернет
  // ================================================================
  const modeLocalBtn = el('modeLocalBtn');
  const modeOnlineBtn = el('modeOnlineBtn');

  if (modeLocalBtn) {
    modeLocalBtn.addEventListener('click', () => {
      currentServerMode = 'local';
      modeLocalBtn.style.background = '#2b7fff';
      modeLocalBtn.style.color = 'white';
      if (modeOnlineBtn) {
        modeOnlineBtn.style.background = 'transparent';
        modeOnlineBtn.style.color = '#7fd6ff';
      }
      
      // Переподключаем сокет
      if (socket) socket.disconnect();
      socket = null;
      initMultiplayer();
      
      showToast('🏠 Локальная сеть');
      console.log('🔌 Переключено на локальную сеть. URL:', getSocketURL());
    });
  }

  if (modeOnlineBtn) {
    modeOnlineBtn.addEventListener('click', () => {
      currentServerMode = 'online';
      modeOnlineBtn.style.background = '#2b7fff';
      modeOnlineBtn.style.color = 'white';
      if (modeLocalBtn) {
        modeLocalBtn.style.background = 'transparent';
        modeLocalBtn.style.color = '#7fd6ff';
      }
      
      // Переподключаем сокет
      if (socket) socket.disconnect();
      socket = null;
      initMultiplayer();
      
      showToast('🌐 Интернет');
      console.log('🔌 Переключено на интернет. URL:', getSocketURL());
    });
  }
}

function pvpGameOver(isWin) {
  if (pvpGameEnded) return;
  pvpGameEnded = true;
  
  if (typeof started !== 'undefined') started = false;   // ← ДОБАВИТЬ  // ← СТОП отрисовки
  if (typeof running !== 'undefined') running = false;
  if (typeof stopMotor === 'function') stopMotor();
  
  showToast(isWin ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ...');
  
  setTimeout(() => { 
    if (typeof showPvPStats === 'function') {
      showPvPStats(isWin);
    } else {
      // Если функции нет, просто выкидываем на карту
      if (typeof goToMap === 'function') goToMap();
    }
  }, 2000);
}

// Если функции showPvPStats нет, добавим заглушку
function showPvPStats(isWin) {
  const statsContainer = document.getElementById('stats');
  const titleEl = document.getElementById('result-title');
  if (!statsContainer || !titleEl) return;

  titleEl.textContent = isWin ? '🏆 ПОБЕДА В ДУЭЛИ!' : '💀 ПОРАЖЕНИЕ...';
  titleEl.style.color = isWin ? '#ffd166' : '#ff6b6b';
  
  statsContainer.innerHTML = `
    <div class="row"><span>Режим</span><span class="val">⚔️ PvP</span></div>
    <div class="row"><span>Вердикт</span><span class="val">${isWin ? 'Ты сильнее!' : 'Повезёт в следующий раз'}</span></div>
  `;
  // Переключить кнопки: "В лобби" + "К карте" (для PvP)
  const _r = document.getElementById('statsRestart');
  const _m = document.getElementById('statsMenu');
  const _l = document.getElementById('statsLobbyBtn');
  if (_r) _r.style.display = 'none';
  if (_m) _m.style.display = 'none';
  if (_l) _l.style.display = 'inline-block';

  if (typeof showScreen === 'function') showScreen('stats');
}
function pvpGameOverCTF(winTeam) {
  if (pvpGameEnded) return;
  pvpGameEnded = true;
  
  if (typeof started !== 'undefined') started = false;
  if (typeof running !== 'undefined') running = false;
  if (typeof stopMotor === 'function') stopMotor();
  
  const statsContainer = document.getElementById('stats');
  const titleEl = document.getElementById('result-title');
  if (!statsContainer || !titleEl) return;

  const isTie = winTeam === 'tie';
  const myWin = (winTeam === myTeam);

  titleEl.textContent = isTie ? '🤝 НИЧЬЯ!' : (myWin ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ...');
  titleEl.style.color = isTie ? '#ffd166' : (myWin ? '#6ee787' : '#ff6b6b');
  
  statsContainer.innerHTML = `
    <div class="row"><span>Режим</span><span class="val">🏴 Захват флага</span></div>
    <div class="row"><span>Твой захват</span><span class="val">${Math.min(10, myTeam === 'blue' ? blueCaptureTime : redCaptureTime).toFixed(1)} / 10</span></div>
    <div class="row"><span>Захват врага</span><span class="val">${Math.min(10, myTeam === 'blue' ? redCaptureTime : blueCaptureTime).toFixed(1)} / 10</span></div>
    <div class="row"><span>Вердикт</span><span class="val">${isTie ? 'Ничья' : (myWin ? 'Ты лучший!' : 'Повезёт в следующий раз')}</span></div>
  `;
    // Переключить кнопки: "В лобби" + "К карте" (для PvP)
  const _r = document.getElementById('statsRestart');
  const _m = document.getElementById('statsMenu');
  const _l = document.getElementById('statsLobbyBtn');
  if (_r) _r.style.display = 'none';
  if (_m) _m.style.display = 'none';
  if (_l) _l.style.display = 'inline-block';

  if (typeof showScreen === 'function') showScreen('stats');

}

window.joinServer = function(code, hasPassword) {
  initMultiplayer();
  if (!socket) {
    showToast('❌ Нет соединения');
    return;
  }

  let password = null;
  if (hasPassword) {
    password = prompt('Введите пароль для подключения:');
    if (password === null) return;
  }

  const nick = (typeof currentPlayer !== 'undefined' && currentPlayer) ? currentPlayer.short : 'Гость';

  const doJoin = () => {
    socket.emit('join_room', { code, password, nick });
  };

  if (socket.connected) {
    doJoin();
  } else {
    showToast('⏳ Подключение...');
    socket.once('connect', doJoin);
  }
};

function mpSwitchTeam(team) {
  console.log('🟢 Клик по кнопке смены команды:', team);
  
  // Убеждаемся, что team — это просто строка "blue" или "red"
  if (team !== 'blue' && team !== 'red') {
    console.error('❌ Ошибка: передан неверный параметр команды!', team);
    return;
  }

  if (socket && socket.connected && myRoomCode) {
    socket.emit('switch_team', { code: myRoomCode, newTeam: team });
  } else {
    showToast('⚠️ Ошибка соединения');
  }
}


  // Обработка нажатия кнопки "Я готов"


window.mpAddBotToTeam = function(team) {
  if (socket && myRoomCode) {
    socket.emit('add_bot', { code: myRoomCode, team: team });
  }
};

window.mpRemoveBot = function(botId) {
  if (socket && myRoomCode) {
    socket.emit('remove_bot', { code: myRoomCode, botId: botId });
  }
};

function mpSendDead() {
  if (socket && socket.connected && myRoomCode) {
    socket.emit('player_dead', { code: myRoomCode });
  }
}
 
  // Начало отсчета
  