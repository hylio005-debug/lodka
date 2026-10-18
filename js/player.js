// ================================================================
//  js/player.js — ВЫБОР ИГРОКА, ПРОГРЕСС, FIO.js
// ================================================================

let choiceMode = 'list';

function shortenFio(fio) {
  const parts = fio.trim().split(/\s+/);
  if (parts.length < 2) return fio.slice(0, 5);
  return parts[0].slice(0, 4) + '.' + parts[1].charAt(0);
}

function renderSelectedPreview() {
  const preview = el('selectedPreview');
  if (currentPlayer) {
    preview.classList.remove('hidden');
    if (currentPlayer.source === 'nick') {
      preview.textContent = `Ник: ${currentPlayer.short}`;
    } else {
      preview.textContent = `${currentPlayer.klass} — ${currentPlayer.short}`;
    }
  } else {
    preview.classList.add('hidden');
    preview.textContent = '';
  }
}

function switchMode(mode) {
  choiceMode = mode;
  el('tabList').classList.toggle('active', mode === 'list');
  el('tabNick').classList.toggle('active', mode === 'nick');
  el('paneList').classList.toggle('active', mode === 'list');
  el('paneNick').classList.toggle('active', mode === 'nick');
  currentPlayer = null;
  renderSelectedPreview();
  updateConfirmButton();
  updateNickPreview();
}

function updateConfirmButton() {
  const btn = el('confirmStudentBtn');
  if (choiceMode === 'list') {
    btn.disabled = !currentPlayer || currentPlayer.source !== 'list';
  } else {
    const nick = el('nickInput').value.trim();
    btn.disabled = nick.length < 2;
  }
}

function updateNickPreview() {
  if (choiceMode !== 'nick') return;
  const nick = el('nickInput').value.trim();
  if (nick.length >= 2) {
    currentPlayer = { klass: '—', short: nick, source: 'nick' };
    renderSelectedPreview();
  } else {
    currentPlayer = null;
    renderSelectedPreview();
  }
  updateConfirmButton();
}

function populateClassSelect() {
  const classSelect = el('classSelect');
  if (!allStudents || allStudents.length === 0) {
    el('loadingMsg').textContent = 'Список учеников пуст. Можно ввести свой ник.';
    el('loadingMsg').classList.remove('hidden');
    el('selectContent').classList.add('hidden');
    return;
  }

  const uniqueClasses = [...new Set(allStudents.map(s => s.klass))].sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, 'ru');
  });
  classSelect.innerHTML = '<option value="">— выберите класс —</option>' +
    uniqueClasses.map(k => `<option value="${k}">${k}</option>`).join('');
  classSelect.disabled = false;

  const studentSelect = el('studentSelect');
  studentSelect.innerHTML = '<option value="">— сначала выберите класс —</option>';
  studentSelect.disabled = true;

  el('loadingMsg').classList.add('hidden');
  el('selectContent').classList.remove('hidden');
}

function loadStudentsLocal() {
  el('loadingMsg').classList.remove('hidden');
  el('loadingMsg').textContent = 'Загрузка списка учеников...';
  el('selectContent').classList.add('hidden');
  el('selectError').classList.add('hidden');

  if (allStudents && allStudents.length > 0) {
    populateClassSelect();
    setServerStatus('online', 'Список учеников загружен');
  } else {
    el('loadingMsg').classList.add('hidden');
    el('selectError').classList.remove('hidden');
    setServerStatus('offline', 'Нет списка учеников');
  }
}

function updatePlayerBadge() {
  const badge = el('playerBadge');
  if (currentPlayer) {
    if (currentPlayer.source === 'nick') {
      badge.textContent = `👤 ${currentPlayer.short}`;
    } else {
      badge.textContent = `👤 ${currentPlayer.klass} · ${currentPlayer.short}`;
    }
  } else {
    badge.textContent = '';
  }
}

function setServerStatus(state, text) {
  const s = el('serverStatus');
  if (!s) return;
  s.className = 'server-status ' + state;
  s.textContent = text;
  const opt = el('opt-server');
  if (opt) opt.textContent = text;
}



function goToSelectPlayer() {
  started = false; running = false; paused = false;
  el('pauseOverlay').classList.remove('show');
  if (typeof stickEnd === 'function') stickEnd();
  if (typeof thrustUp === 'function') thrustUp();
  if (typeof stopMotor === 'function') stopMotor();
  currentPlayer = null;
  playerProgress = 1;
  switchMode('list');
  el('nickInput').value = '';
  showScreen('select');
  loadStudentsLocal();
}

// ---------- Слушатели ----------
el('tabList').addEventListener('click', () => switchMode('list'));
el('tabNick').addEventListener('click', () => switchMode('nick'));
el('nickInput').addEventListener('input', updateNickPreview);
el('nickInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !el('confirmStudentBtn').disabled) el('confirmStudentBtn').click();
});

el('classSelect').addEventListener('change', (e) => {
  const klass = e.target.value;
  const studentSelect = el('studentSelect');
  if (!klass) {
    studentSelect.innerHTML = '<option value="">— сначала выберите класс —</option>';
    studentSelect.disabled = true;
    currentPlayer = null;
    renderSelectedPreview();
    updateConfirmButton();
    return;
  }
  const students = allStudents
    .filter(s => s.klass === klass)
    .map(s => ({ klass: s.klass, short: s.nick }))
    .sort((a, b) => a.short.localeCompare(b.short, 'ru'));

  studentSelect.innerHTML = '<option value="">— выберите ученика —</option>' +
    students.map((s, i) => `<option value="${i}">${s.short}</option>`).join('');
  studentSelect.disabled = false;
  studentSelect.dataset.list = JSON.stringify(students);

  currentPlayer = null;
  renderSelectedPreview();
  updateConfirmButton();
});

el('studentSelect').addEventListener('change', (e) => {
  const idx = e.target.value;
  if (idx === '') {
    currentPlayer = null;
    renderSelectedPreview();
    updateConfirmButton();
    return;
  }
  const students = JSON.parse(el('studentSelect').dataset.list || '[]');
  const s = students[Number(idx)];
  if (!s) return;
  currentPlayer = { klass: s.klass, short: s.short, source: 'list' };
  renderSelectedPreview();
  updateConfirmButton();
});

el('confirmStudentBtn').addEventListener('click', async () => {
  if (!currentPlayer) return;
  
  // Загружаем артефакты именно этого игрока
  loadInventoryForPlayer(currentPlayer.klass, currentPlayer.short);
  
  updatePlayerBadge();
  await loadPlayerProgress();
  showScreen('map');
});

el('selectBackBtn').addEventListener('click', () => showScreen('splash'));
el('selectBackErrorBtn').addEventListener('click', () => showScreen('splash'));
el('selectRetryBtn').addEventListener('click', () => loadStudentsLocal());

el('pauseChangePlayer').addEventListener('click', () => {
  paused = false;
  el('pauseOverlay').classList.remove('show');
  goToSelectPlayer();
});

el('mapChangePlayerBtn').addEventListener('click', goToSelectPlayer);
