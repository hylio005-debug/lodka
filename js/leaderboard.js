
// ⚙️ URL PHP-прокси (ваш домен)
const LEADERBOARD_API = 'https://lodka777.online/api.php';

// ⚙️ URL JSON напрямую с GitHub (для чтения)
const LEADERBOARD_RAW = 'https://raw.githubusercontent.com/hylio005-debug/lodka-leaderboard/main/leaderboard.json';

// ================================================================
//  ОТПРАВКА РЕЗУЛЬТАТА
// ================================================================
async function sendResult(level, accuracy) {
  if (!currentPlayer) return { ok: false, error: 'Нет игрока' };

  const payload = {
    klass: currentPlayer.klass,
    nick: currentPlayer.short,
    level: level,
    accuracy: accuracy,
    device: DEVICE_TYPE
  };

  try {
    const resp = await fetch(LEADERBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: 'HTTP ' + resp.status + ': ' + errText };
    }

    const json = await resp.json();
    return { ok: json.success === true, data: json };
  } catch (err) {
    console.error('Ошибка отправки:', err);
    return { ok: false, error: err.message };
  }
}

// ================================================================
//  ЗАГРУЗКА ПРОГРЕССА
// ================================================================
async function loadPlayerProgress() {
  if (!currentPlayer) { playerProgress = 1; return; }
  if (currentPlayer.source === 'nick') { playerProgress = 1; return; }

  try {
    const resp = await fetch(LEADERBOARD_RAW + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    if (!json.players || !Array.isArray(json.players)) {
      playerProgress = 1;
      setServerStatus('online', 'Сервер: подключён');
      return;
    }

    const key = `${currentPlayer.klass}|${currentPlayer.short}|${DEVICE_TYPE}`;
    const player = json.players.find(p => p.key === key);

    if (player) {
      playerProgress = Number(player.progress) || 1;
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

// ================================================================
//  ЗАГРУЗКА ЛИДЕРБОРДА
// ================================================================
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
  <th class="rank">#</th><th>Пилот</th><th>Средний %</th><th>Ур.</th>
</tr></thead><tbody>`;

leaders.forEach((l, i) => {
  const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
  const device = l.device === 'Mobile' ? '📱' : '💻';
  const playerStr = l.klass && l.klass !== '—'
    ? `${escapeHtml(l.klass)} — ${escapeHtml(l.nick)}`
    : escapeHtml(l.nick);
  const avg = l.avg !== undefined ? l.avg : 0;
  html += `<tr class="${cls}">
    <td class="rank">${medal || (i + 1)}</td>
    <td>${playerStr} ${device}</td>
    <td style="text-align:right;">${avg}%</td>
    <td style="text-align:right;">${l.passedCount}/5</td>
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
