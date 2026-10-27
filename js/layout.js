const draggableElements = [
  { selector: '#hpbar',            key: 'hp' },
  { selector: '#energybar',        key: 'energy' },
  { selector: '#mobileControls',   key: 'stick' },
  { selector: '#thrustButton',     key: 'thrust' },
  { selector: '#minimap-container',key: 'minimap' },
  { selector: '#mobWinchBtn',      key: 'artW' },
  { selector: '#mobFlashBtn',      key: 'artF' },
  { selector: '#mobTorpedoBtn',    key: 'artT' }
];

let isEditMode = false;

function initLayoutEditor() {
  if (!isTouch) return;

  const editBtn = el('editLayoutBtn');
  const resetBtn = el('resetLayoutBtn');
  if (editBtn) editBtn.style.display = 'block';
  if (resetBtn) resetBtn.style.display = 'block';

  loadLayout();

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      paused = true;
      el('pauseOverlay').classList.remove('show');
      enableEditMode();
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', resetAllPositions);

  const saveToolbarBtn = el('editLayoutSaveBtn');
  const resetToolbarBtn = el('editLayoutResetBtn');
  if (saveToolbarBtn) saveToolbarBtn.addEventListener('click', exitEditMode);
  if (resetToolbarBtn) resetToolbarBtn.addEventListener('click', resetAllPositions);

  draggableElements.forEach(item => {
    const element = document.querySelector(item.selector);
    if (element) makeDraggable(element, item.key);
  });
}

function makeDraggable(element, key) {
  let offsetX = 0, offsetY = 0;
  let isDragging = false;

  element.addEventListener('pointerdown', (e) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Насколько далеко мы тапнули от центра кнопки
    offsetX = e.clientX - centerX;
    offsetY = e.clientY - centerY;

    isDragging = true;
    element.setPointerCapture(e.pointerId);
    element.style.zIndex = '10000';
  });

  element.addEventListener('pointermove', (e) => {
    if (!isEditMode || !isDragging) return;
    e.preventDefault();

    const halfW = element.offsetWidth / 2;
    const halfH = element.offsetHeight / 2;

    // Центр кнопки = курсор - offset, ограниченный краями экрана
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    newX = Math.max(halfW + 4, Math.min(window.innerWidth - halfW - 4, newX));
    newY = Math.max(halfH + 4, Math.min(window.innerHeight - halfH - 4, newY));

    element.style.setProperty('--edit-x', newX + 'px');
    element.style.setProperty('--edit-y', newY + 'px');
  });

    element.addEventListener('pointerup', (e) => {
        if (!isEditMode || !isDragging) return;
        isDragging = false;
        try { element.releasePointerCapture(e.pointerId); } catch (err) {}
        element.style.zIndex = '';

        // ⚡ Сохраняем напрямую из CSS-переменных, не из getBoundingClientRect
        const xVal = element.style.getPropertyValue('--edit-x');
        const yVal = element.style.getPropertyValue('--edit-y');

        let leftPercent = 50, topPercent = 50;

        if (xVal.endsWith('px')) {
            leftPercent = parseFloat(xVal) / window.innerWidth * 100;
        } else if (xVal.endsWith('vw')) {
            leftPercent = parseFloat(xVal);
        }

        if (yVal.endsWith('px')) {
            topPercent = parseFloat(yVal) / window.innerHeight * 100;
        } else if (yVal.endsWith('vh')) {
            topPercent = parseFloat(yVal);
        }

        saveLayoutPosition(key, leftPercent, topPercent);
    });
}

// Проверка наложения (5px зазор между кнопками)
function isOverlapping(element, selfKey, x, y) {
  // Временно ставим для проверки
  const oldX = element.style.getPropertyValue('--edit-x');
  const oldY = element.style.getPropertyValue('--edit-y');
  if (x && y) {
    element.style.setProperty('--edit-x', x);
    element.style.setProperty('--edit-y', y);
  }
  const rect = element.getBoundingClientRect();
  if (x && y) {
    element.style.setProperty('--edit-x', oldX);
    element.style.setProperty('--edit-y', oldY);
  }

  const margin = 5;
  for (const item of draggableElements) {
    if (item.key === selfKey) continue;
    const other = document.querySelector(item.selector);
    if (!other || other.classList.contains('hidden')) continue;
    
    // Пропускаем элементы-контейнеры (они невидимы)
    if (other.id === 'mobileArtifacts') continue;

    const or = other.getBoundingClientRect();
    if (rect.right - margin > or.left &&
        rect.left + margin < or.right &&
        rect.bottom - margin > or.top &&
        rect.top + margin < or.bottom) {
      return true;
    }
  }
  return false;
}

function enableEditMode() {
   const artContainer = document.getElementById('mobileArtifacts');
  if (artContainer) {
    artContainer.style.setProperty('transform', 'none', 'important');
    artContainer.style.setProperty('position', 'fixed', 'important');
    artContainer.style.setProperty('top', '0', 'important');
    artContainer.style.setProperty('left', '0', 'important');
    artContainer.style.setProperty('right', '0', 'important');
    artContainer.style.setProperty('bottom', '0', 'important');
    artContainer.style.setProperty('width', '100vw', 'important');
    artContainer.style.setProperty('height', '100vh', 'important');
  }
 
 
    // ⚡ СНАЧАЛА запоминаем реальные координаты кнопок (до включения режима)
  draggableElements.forEach(item => {
    const element = document.querySelector(item.selector);
    if (!element) return;
    if (!element.style.getPropertyValue('--edit-x')) {
      const rect = element.getBoundingClientRect();
      const leftPercent = (rect.left + rect.width / 2) / window.innerWidth * 100;
      const topPercent = (rect.top + rect.height / 2) / window.innerHeight * 100;
      element.style.setProperty('--edit-x', leftPercent + 'vw');
      element.style.setProperty('--edit-y', topPercent + 'vh');
    }
  });

  // Теперь включаем режим — кнопки останутся на местах
  isEditMode = true;
  document.body.classList.add('edit-layout');
  document.body.classList.add('custom-layout');
  showToast('📐 Таскайте кнопки. Жмите ✅ Готово когда закончите.');
}


function exitEditMode() {
  isEditMode = false;
  document.body.classList.remove('edit-layout');
  
  // ⚡ Принудительно применяем позиции из localStorage — это гарантирует,
  // что после выхода из редактора всё встанет туда, куда игрок поставил
  applyLayoutFromStorage();
  
  showToast('✅ Расположение сохранено!');
  el('pauseOverlay').classList.add('show');
}

function saveLayoutPosition(key, left, top) {
  try {
    const layout = JSON.parse(localStorage.getItem('pogruzhenie_layout_v2') || '{}');
    layout[key] = { left, top };
    localStorage.setItem('pogruzhenie_layout_v2', JSON.stringify(layout));
  } catch (e) {}
}

function applyLayoutFromStorage() {
  try {
    const layout = JSON.parse(localStorage.getItem('pogruzhenie_layout_v2') || '{}');
    let hasAny = false;
    draggableElements.forEach(item => {
      const element = document.querySelector(item.selector);
      if (!element) return;
      if (layout[item.key]) {
        element.style.setProperty('--edit-x', layout[item.key].left + 'vw');
        element.style.setProperty('--edit-y', layout[item.key].top + 'vh');
        hasAny = true;
      }
    });
    if (hasAny) document.body.classList.add('custom-layout');
  } catch (e) {}
}

function loadLayout() {
  applyLayoutFromStorage();
}

function resetAllPositions() {
  localStorage.removeItem('pogruzhenie_layout_v2');
  draggableElements.forEach(item => {
    const element = document.querySelector(item.selector);
    if (element) {
      element.style.removeProperty('--edit-x');
      element.style.removeProperty('--edit-y');
    }
  });
  document.body.classList.remove('custom-layout');
  showToast('🔄 Расположение сброшено к стандарту');
}

if (typeof isTouch !== 'undefined' && isTouch) {
  initLayoutEditor();
}