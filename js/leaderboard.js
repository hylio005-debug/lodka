// ================================================================
//  js/leaderboard.js — ЛИДЕРБОРД И СОХРАНЕНИЯ
// ================================================================

const LEADERBOARD_API = 'https://lodka777.online/api.php';
const LEADERBOARD_RAW = 'https://raw.githubusercontent.com/hylio005-debug/lodka-leaderboard/main/leaderboard.json';

// Отправка результата уровня
// Отправка результата уровня + артефактов ОДНИМ запросом
async function sendResult(level, accuracy) {
  if (!currentPlayer) return { ok: false, error: 'Нет игрока' };

  const payload = {
    action: 'save_level',
    klass: currentPlayer.klass,
    nick: currentPlayer.short,
    level: level,
    accuracy: accuracy,
    device: DEVICE_TYPE,
    inventory: inventory
  };

  try {
    const resp = await fetch(LEADERBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}

    if (!resp.ok) {
      const msg = (json && json.error) ? json.error : ('HTTP ' + resp.status + ': ' + text.slice(0, 120));
      console.error('❌ Сервер:', msg);
      return { ok: false, error: msg };
    }
    if (!json || json.success !== true) {
      const msg = (json && json.error) ? json.error : 'Неверный формат ответа';
      console.error('❌ Сервер вернул:', json);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    console.error('❌ Fetch:', err);
    return { ok: false, error: err.message };
  }
}

// Отправка артефактов на сервер
async function saveInventoryToServer() {
  if (!currentPlayer) return;
  const payload = {
    action: 'save_inventory',
    klass: currentPlayer.klass,
    nick: currentPlayer.short,
    device: DEVICE_TYPE,
    inventory: inventory
  };
  try {
    await fetch(LEADERBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Не удалось сохранить артефакты на сервере:', err);
  }
}

// Загрузка прогресса и инвентаря
async function loadPlayerProgress() {
  if (!currentPlayer) { playerProgress = 1; return; }

  try {
    const resp = await fetch(LEADERBOARD_RAW + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    if (!json.players || !Array.isArray(json.players)) {
      playerProgress = 1;
      setServerStatus('online', 'Сервер: подключён');
      return;
    }

    let key;
    if (currentPlayer.source === 'nick') {
      key = `—|${currentPlayer.short}|${DEVICE_TYPE}`;
    } else {
      key = `${currentPlayer.klass}|${currentPlayer.short}|${DEVICE_TYPE}`;
    }

    const player = json.players.find(p => p.key === key);

    if (player) {
      playerProgress = Number(player.progress) || 1;
      
      // ЗАГРУЖАЕМ АРТЕФАКТЫ С СЕРВЕРА
      if (player.inventory) {
        inventory.map = !!player.inventory.map;
        inventory.winch = !!player.inventory.winch;
        inventory.flashlight = !!player.inventory.flashlight;
        inventory.torpedo = !!player.inventory.torpedo;
        
        // Синхронизируем локальное хранилище
        if (currentPlayer.source !== 'nick') {
          saveInventoryForPlayer(currentPlayer.klass, currentPlayer.short);
        }
      }
    } else {
      playerProgress = 1;
    }
    setServerStatus('online', 'Сервер: подключён');
  } catch (err) {
    console.error('Ошибка загрузки прогресса:', err);
    playerProgress = 1;
    setServerStatus('offline', 'Сервер: ошибка');
  }
}

async function loadLeaderboard() {
  const container = el('leaderboard-container');
  if (!container) return;
  container.innerHTML = '<div class="empty-msg">Загрузка...</div>';

  try {
    const resp = await fetch(LEADERBOARD_RAW + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    const leaders = json.leaders || [];

    if (!leaders.length) {
      container.innerHTML = '<div class="empty-msg">Пока нет результатов.</div>';
      return;
    }

    let html = `<table class="leaderboard"><thead><tr>
      <th class="rank">#</th><th>Пилот</th><th>Балл</th><th>Ур.</th>
    </tr></thead><tbody>`;

    leaders.forEach((l, i) => {
      const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const device = l.device === 'Mobile' ? '📱' : '💻';
      const playerStr = l.klass && l.klass !== '—'
        ? `${escapeHtml(l.klass)} — ${escapeHtml(l.nick)}`
        : escapeHtml(l.nick);
      
      const score = l.score !== undefined ? l.score : l.avg;
      html += `<tr class="${cls}">
        <td class="rank">${medal || (i + 1)}</td>
        <td>${playerStr} ${device}</td>
        <td style="text-align:right; font-weight:bold; color:#ffd166;">${score}</td>
        <td style="text-align:right; opacity:0.7;">${l.passedCount}/5</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Ошибка загрузки лидерборда:', err);
    container.innerHTML = '<div class="empty-msg">⚠️ Не удалось загрузить таблицу</div>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}