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

  if (mode === 'list') {
    el('classSelect').value = '';
    const ss = el('studentSelect');
    ss.innerHTML = '<option value="">— сначала выберите класс —</option>';
    ss.disabled = true;
    el('confirmStudentBtn').disabled = true;
  } else {
    updateNickPreview();
  }
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
  
  // Сбрасываем прогресс тренировки и режим карты
  if (typeof completedTraining !== 'undefined') {
    completedTraining = [];
  }
  if (typeof currentMapMode !== 'undefined') {
    currentMapMode = 'training';
  }
  
  switchMode('list');
  el('nickInput').value = '';
  showScreen('select');
  loadStudentsLocal();
}
// ---------- Слушатели ----------
el('tabList').addEventListener('click', () => switchMode('list'));
el('tabNick').addEventListener('click', () => switchMode('nick'));
el('nickInput').addEventListener('input', updateNickPreview);
el('nickInput').addEventListener('input', updateNickPreview);

// === МОБИЛЬНЫЙ ФИКС: ВВОД НИКА ===
const nickInput = el('nickInput');
if (nickInput) {
  // 1. Нажатие "Enter" на клавиатуре: закрываем клавиатуру и жмем "Дальше"
  nickInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nickInput.blur();
      setTimeout(() => {
        const btn = el('confirmStudentBtn');
        if (btn && !btn.disabled) btn.click();
      }, 100);
    }
  });

  // 2. При клике на поле — прокручиваем экран, чтобы поле было по центру (над клавиатурой)
  nickInput.addEventListener('focus', () => {
    setTimeout(() => {
      nickInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });

  // 3. Умный отступ, если открылась виртуальная клавиатура
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const selectScreen = el('screen-select');
      if (!selectScreen || !selectScreen.classList.contains('show')) return;
      
      // Вычисляем высоту клавиатуры
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      
      if (keyboardHeight > 100) {
        // Если клавиатура открыта, добавляем отступ снизу, чтобы кнопки не прятались
        selectScreen.style.paddingBottom = (keyboardHeight + 40) + 'px';
      } else {
        // Если клавиатура закрыта, возвращаем как было
        selectScreen.style.paddingBottom = '';
      }
    });
  }
}

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
  
  // Загружаем прогресс тренировки именно этого игрока
  if (typeof loadTrainingForPlayer === 'function') {
    loadTrainingForPlayer();
  }
  
  // Сбрасываем режим карты (если тренировка не пройдена — принудительно она)
  if (typeof isTrainingComplete === 'function' && !isTrainingComplete()) {
    if (typeof currentMapMode !== 'undefined') {
      currentMapMode = 'training';
    }
  } else {
    if (typeof currentMapMode !== 'undefined') {
      currentMapMode = 'campaign';
    }
  }
  
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
