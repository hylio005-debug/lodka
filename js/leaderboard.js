// ================================================================
//  js/leaderboard.js — ЛИДЕРБОРД v4.0
//  Прямая запись в GitHub API (без Worker)
//  ⚠️ ТОКЕН ВИДЕН В КОДЕ — только для учебного проекта
// ================================================================

// ⚙️ НАСТРОЙКИ GITHUB
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'hylio005-debug';
const GITHUB_REPO  = 'lodka-leaderboard';
const GITHUB_PATH  = 'leaderboard.json';
const GITHUB_BRANCH = 'main';

const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_PATH}`;

// ================================================================
//  ОТПРАВКА РЕЗУЛЬТАТА
// ================================================================
async function sendResult(level, accuracy) {
  if (!currentPlayer) return { ok: false, error: 'Нет игрока' };

  try {
    // 1. Читаем текущий файл (получаем SHA)
    const getResp = await fetch(GITHUB_API + '?t=' + Date.now(), {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!getResp.ok) {
      throw new Error('GitHub read error: ' + getResp.status);
    }

    const getData = await getResp.json();
    const currentJson = JSON.parse(atob(getData.content.replace(/\n/g, '')));
    const currentSha = getData.sha;

    if (!currentJson.players) currentJson.players = [];

    // 2. Обновляем данные игрока
    const key = `${currentPlayer.klass}|${currentPlayer.short}|${DEVICE_TYPE}`;
    let player = currentJson.players.find(p => p.key === key);

    if (!player) {
      player = {
        key: key,
        klass: currentPlayer.klass,
        nick: currentPlayer.short,
        device: DEVICE_TYPE,
        levels: [0, 0, 0, 0, 0],
        progress: 1,
        updated: new Date().toISOString()
      };
      currentJson.players.push(player);
    }

    const levelIdx = level - 1;
    if (levelIdx >= 0 && levelIdx < 5) {
      player.levels[levelIdx] = Number(accuracy);
    }

    // Правило ≥ 80% для разблокировки
    const UNLOCK_THRESHOLD = 80;
    if (Number(accuracy) >= UNLOCK_THRESHOLD) {
      const nextLevel = level + 1;
      if (nextLevel > player.progress && nextLevel <= 5) {
        player.progress = nextLevel;
      }
      if (level === 5 && player.progress < 5) {
        player.progress = 5;
      }
    }

    player.updated = new Date().toISOString();

    // 3. Пересчитываем лидерборд
    currentJson.leaders = computeLeaders(currentJson.players);
    currentJson.updated = new Date().toISOString();

    // 4. Записываем обратно в GitHub
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(currentJson, null, 2))));

    const putResp = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update ${currentPlayer.klass} ${currentPlayer.short} level ${level}: ${accuracy}%`,
        content: newContent,
        sha: currentSha,
        branch: GITHUB_BRANCH
      })
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      throw new Error('GitHub write error: ' + putResp.status + ' ' + errText);
    }

    return { ok: true };
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
    const resp = await fetch(GITHUB_RAW + '?t=' + Date.now());
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
    const resp = await fetch(GITHUB_RAW + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    const leaders = json.leaders || [];

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
    console.error('Ошибка загрузки лидерборда:', err);
    container.innerHTML = '<div class="empty-msg">⚠️ Не удалось загрузить таблицу</div>';
  }
}

// ================================================================
//  ПЕРЕСЧЁТ ТОП-10
// ================================================================
function computeLeaders(players) {
  if (!players || !players.length) return [];
  const byPlayer = {};
  for (const p of players) {
    const key = `${p.klass}|${p.nick}`;
    const passed = p.levels.filter(v => v > 0);
    const avg = passed.length > 0
      ? Math.round(passed.reduce((a, b) => a + b, 0) / passed.length)
      : 0;
    const entry = {
      klass: p.klass,
      nick: p.nick,
      device: p.device,
      levels: p.levels,
      progress: p.progress,
      passedCount: passed.length,
      avg: avg
    };
    if (!byPlayer[key] ||
        entry.avg > byPlayer[key].avg ||
        (entry.avg === byPlayer[key].avg && entry.passedCount > byPlayer[key].passedCount)) {
      byPlayer[key] = entry;
    }
  }
  return Object.values(byPlayer)
    .filter(l => l.passedCount > 0)
    .sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.passedCount !== a.passedCount) return b.passedCount - a.passedCount;
      return 0;
    })
    .slice(0, 10);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
