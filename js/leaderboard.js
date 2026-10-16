// ================================================================
//  js/leaderboard.js — ЛИДЕРБОРД через Cloudflare Worker
//  Версия 2.0 — GitHub вместо Google Sheets
// ================================================================

// ⚙️ URL Cloudflare Worker (из Шага 3)
const LEADERBOARD_API = 'https://raspy-rice-519d.hylio005.workers.dev/';

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
      return { ok: false, error: errText };
    }

    const json = await resp.json();
    if (json.success) {
      return { ok: true, data: json };
    } else {
      return { ok: false, error: json.error || 'Неизвестная ошибка' };
    }
  } catch (err) {
    console.error('Ошибка отправки:', err);
    return { ok: false, error: err.message };
  }
}

// ================================================================
//  ЗАГРУЗКА ПРОГРЕССА ИГРОКА
// ================================================================
async function loadPlayerProgress() {
  if (!currentPlayer) { playerProgress = 1; return; }
  if (currentPlayer.source === 'nick') { playerProgress = 1; return; }

  try {
    const resp = await fetch(LEADERBOARD_API + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    if (!json.success || !json.data || !json.data.players) {
      playerProgress = 1;
      setServerStatus('online', 'Сервер: подключён');
      return;
    }

    const key = `${currentPlayer.klass}|${currentPlayer.short}|${DEVICE_TYPE}`;
    const player = json.data.players.find(p => p.key === key);

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
//  ЗАГРУЗКА ЛИДЕРБОРДА (топ-10)
// ================================================================
async function loadLeaderboard() {
  const container = el('leaderboard-container');
  container.innerHTML = '<div class="empty-msg">Загрузка...</div>';

  try {
    const resp = await fetch(LEADERBOARD_API + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    if (!json.success || !json.data || !json.data.leaders) {
      container.innerHTML = '<div class="empty-msg">Пока нет результатов.</div>';
      return;
    }

    const leaders = json.data.leaders;
    if (!leaders.length) {
      container.innerHTML = '<div class="empty-msg">Пока нет результатов.</div>';
      return;
    }

    let html = `<table class="leaderboard"><thead><tr>
      <th class="rank">#</th><th>Пилот</th><th>Ср.</th><th>Ур.</th>
    </tr></thead><tbody>`;

    leaders.forEach((l, i) => {
      const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const device = l.device === 'Mobile' ? '📱' : '💻';
      const playerStr = l.klass && l.klass !== '—'
        ? `${escapeHtml(l.klass)} — ${escapeHtml(l.nick)}`
        : escapeHtml(l.nick);
      html += `<tr class="${cls}">
        <td class="rank">${medal || (i + 1)}</td>
        <td>${playerStr} ${device}</td>
        <td style="text-align:right;">${l.avg}%</td>
        <td style="text-align:right;">${l.passedCount}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="empty-msg">⚠️ Не удалось загрузить таблицу</div>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
