// ─────────────────────────────────────────────
//  MyNotes PWA — app.js
// ─────────────────────────────────────────────

const STORAGE_KEY = 'mynotes_v3';
// Теперь у workout тоже есть dateNav!
const CATS = {
  tasks:   { label: 'Задачи',     icon: '✦', color: '#FF6B35', hasDateNav: true },
  workout: { label: 'Тренировка', icon: '◈', color: '#00D4AA', hasDateNav: true },
  homework:{ label: 'Домашка',    icon: '◆', color: '#A78BFA', hasDateNav: true },
  notes:   { label: 'Заметки',    icon: '◇', color: '#F59E0B', hasDateNav: false },
};

// ── helpers ──────────────────────────────────
function toKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function today() { return toKey(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return toKey(d);
}
function parseKey(k) { const [y,m,d] = k.split('-'); return new Date(+y, +m-1, +d); }
function fmtWeekday(k) { return parseKey(k).toLocaleDateString('ru-RU', { weekday: 'short' }); }
function fmtFull(k)    { return parseKey(k).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); }

// ── state ─────────────────────────────────────
let state = loadState();
let activeTab = 'tasks';
let selectedDate = today();         
let editingId = null;
let dateWindowStart = -3;           

function loadState() {
  try { 
    let s = JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeDefault(); 
    if (!s.workoutTitles) s.workoutTitles = {}; // Миграция для старых сохранений
    return s;
  }
  catch { return makeDefault(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function makeDefault() {
  const t = today();
  return {
    tasks: { [t]: [{ id: uid(), text: 'Пример задачи', done: false }] },
    workout: { [t]: [{ id: uid(), text: 'Жим лёжа — 3×8 × 80кг', done: false }] },
    workoutTitles: {},
    homework: { [t]: [{ id: uid(), text: 'Математика — параграф 12', done: false }] },
    notes: [{ id: uid(), text: 'Пример заметки', done: false }],
  };
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── current items getter & setter ─────────────
function currentItems() {
  if (activeTab === 'notes') return state.notes || [];
  return (state[activeTab][selectedDate] || []);
}

function setItems(arr) {
  if (activeTab === 'notes') { state.notes = arr; return; }
  state[activeTab][selectedDate] = arr;
}

// ── mutations ─────────────────────────────────
function addItem(text) {
  if (!text.trim()) return;
  const items = [...currentItems(), { id: uid(), text: text.trim(), done: false }];
  setItems(items);
  saveState(); render();
}

function toggleItem(id) {
  setItems(currentItems().map(i => i.id === id ? { ...i, done: !i.done } : i));
  saveState(); render();
}

function deleteItem(id) {
  setItems(currentItems().filter(i => i.id !== id));
  saveState(); render();
}

function updateItem(id, text) {
  if (!text.trim()) return;
  setItems(currentItems().map(i => i.id === id ? { ...i, text: text.trim() } : i));
  saveState(); render();
}

function clearDone() {
  setItems(currentItems().filter(i => !i.done));
  saveState(); render();
}

// ── DOM refs ──────────────────────────────────
const $ = id => document.getElementById(id);
const itemList   = $('itemList');
const mainInput  = $('mainInput');
const addBtn     = $('addBtn');
const clearBtn   = $('clearDoneBtn');
const dateNav    = $('dateNav');
const dateNavDays= $('dateNavDays');
const datePrev   = $('datePrev');
const dateNext   = $('dateNext');

// ── render ────────────────────────────────────
function render() {
  const cat = CATS[activeTab];

  // accent
  document.querySelectorAll('.blob').forEach(b => b.style.background = cat.color);
  document.querySelector('.progress-ring').style.stroke = cat.color;
  document.querySelector('.progress-pct').style.color = cat.color;
  document.querySelector('.add-btn').style.background = cat.color;
  document.documentElement.style.setProperty('--accent', cat.color);

  // header texts
  $('sectionIcon').textContent = cat.icon;
  $('sectionIcon').style.color = cat.color;
  $('sectionName').textContent = cat.label;

// Видимость даты и календаря
  if (cat.hasDateNav) {
    $('dateLabel').textContent = fmtFull(selectedDate).replace(/^./, c => c.toUpperCase());
    $('calendarContainer').style.display = 'block'; // Показываем контейнер
  } else {
    $('dateLabel').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
    $('calendarContainer').style.display = 'none'; // Скрываем контейнер в заметках
  }

  // Подписи тренировок
  if (activeTab === 'workout') {
    $('workoutTitle').classList.add('visible');
    $('workoutTitle').value = state.workoutTitles[selectedDate] || '';
    $('workoutTitle').style.color = cat.color;
  } else {
    $('workoutTitle').classList.remove('visible');
  }

  // nav visibility
  dateNav.classList.toggle('visible', cat.hasDateNav);
  if (cat.hasDateNav) renderDateNav();

  // items
  const items = currentItems();
  const doneCount = items.filter(i => i.done).length;
  $('statActive').textContent = items.length - doneCount;
  $('statDone').textContent = doneCount;
  clearBtn.classList.toggle('visible', doneCount > 0);

  // progress ring
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  document.querySelector('.progress-ring').style.strokeDashoffset = 132 - (pct / 100) * 132;
  $('progressPct').textContent = pct + '%';

  // list
  if (items.length === 0) {
    itemList.innerHTML = `<div class="empty-state"><div class="es-icon">${cat.icon}</div><div class="es-text">Пока пусто — добавь что-нибудь</div></div>`;
  } else {
    itemList.innerHTML = '';
    items.forEach(item => itemList.appendChild(buildItem(item, cat.color)));
  }

  // nav badges
  Object.keys(CATS).forEach(tab => {
    const badge = $('badge-' + tab);
    let count = 0;
    if (tab === 'notes') { count = (state.notes || []).filter(i => !i.done).length; }
    else { count = (state[tab][today()] || []).filter(i => !i.done).length; }
    badge.textContent = count > 0 ? count : '';
    badge.classList.toggle('show', count > 0);
  });

  // active nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });

  // placeholder
  mainInput.placeholder = `Добавить в «${cat.label}»...`;
}

function buildItem(item, color) {
  const div = document.createElement('div');
  div.className = 'item' + (item.done ? ' done' : '');
  div.style.borderLeftColor = item.done ? 'rgba(255,255,255,0.1)' : color;

  if (editingId === item.id) {
    const inp = document.createElement('input');
    inp.className = 'edit-input';
    inp.value = item.text;
    inp.addEventListener('blur', () => { updateItem(item.id, inp.value); editingId = null; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { updateItem(item.id, inp.value); editingId = null; } });
    div.appendChild(inp);
    setTimeout(() => inp.focus(), 10);
  } else {
    const cbtn = document.createElement('button');
    cbtn.className = 'check-btn';
    cbtn.innerHTML = `<div class="check-circle${item.done ? ' checked' : ''}">${item.done ? '<span class="check-mark">✓</span>' : ''}</div>`;
    cbtn.addEventListener('click', () => toggleItem(item.id));

    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = item.text;
    span.addEventListener('dblclick', () => { editingId = item.id; render(); });
    
    let pressTimer;
    span.addEventListener('touchstart', () => { pressTimer = setTimeout(() => { editingId = item.id; render(); }, 600); });
    span.addEventListener('touchend', () => clearTimeout(pressTimer));

    const dbtn = document.createElement('button');
    dbtn.className = 'delete-btn';
    dbtn.textContent = '×';
    dbtn.addEventListener('click', () => deleteItem(item.id));

    div.appendChild(cbtn);
    div.appendChild(span);
    div.appendChild(dbtn);
  }
  return div;
}

// ── Date nav ──────────────────────────────────
function renderDateNav() {
  dateNavDays.innerHTML = '';
  const windowSize = 14;
  const t = today();
  for (let i = dateWindowStart; i < dateWindowStart + windowSize; i++) {
    const d = addDays(t, i);
    const chip = document.createElement('button');
    chip.className = 'day-chip' + (d === selectedDate ? ' active' : '') + (d === t ? ' today' : '');
    const wd = fmtWeekday(d).replace('.','');
    const dayNum = parseKey(d).getDate();
    chip.innerHTML = `<span class="dc-wd">${wd}</span><span class="dc-d">${dayNum}</span>`;

    const items = state[activeTab][d];
    if (items && items.filter(i => !i.done).length > 0) {
      chip.innerHTML += `<span class="dc-dot"></span>`;
    }

    chip.addEventListener('click', () => { selectedDate = d; render(); });
    dateNavDays.appendChild(chip);
  }
}

datePrev.addEventListener('click', () => { dateWindowStart -= 7; render(); });
dateNext.addEventListener('click', () => { dateWindowStart += 7; render(); });

// ── Nav tabs ──────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    editingId = null;
    if (activeTab !== 'notes') { selectedDate = today(); dateWindowStart = -3; }
    render();
  });
});

// ── Add item ──────────────────────────────────
addBtn.addEventListener('click', () => {
  addItem(mainInput.value);
  mainInput.value = '';
  mainInput.focus();
});
mainInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addItem(mainInput.value);
    mainInput.value = '';
  }
});

// ── Clear done ────────────────────────────────
clearBtn.addEventListener('click', clearDone);

// В самом низу app.js
$('datePicker').addEventListener('change', (e) => {
  if (e.target.value) {
    selectedDate = e.target.value;
    
    // Вычисляем разницу в днях от сегодня, чтобы центрировать ленту
    const selected = new Date(selectedDate);
    const now = new Date();
    const diffTime = selected - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Центрируем: показываем 3 дня до выбранной даты
    dateWindowStart = diffDays - 3; 
    
    render();
  }
});

// ── Подпись тренировки ────────────────────────
$('workoutTitle').addEventListener('input', (e) => {
  state.workoutTitles[selectedDate] = e.target.value;
  saveState();
});

// ── Init ──────────────────────────────────────
render();

// ── LIQUID GLASS LOGIC (Свайп меню) ──
function updateGlider() {
  const tabsList = ['tasks', 'workout', 'homework', 'notes'];
  const index = tabsList.indexOf(activeTab);
  const glider = document.getElementById('navGlider');
  if (glider) {
    glider.style.transform = `translateX(${index * 100}%)`;
  }
}

// Добавляем вызов ползунка в конец функции render
const originalRender = render;
render = function() {
  originalRender();
  updateGlider();
};

// Свайп по нижнему меню (водишь пальцем - вкладки переключаются)
const bNav = document.querySelector('.bottom-nav');
if (bNav) {
  bNav.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    
    const tabBtn = el.closest('.nav-item');
    if (tabBtn) {
      const newTab = tabBtn.dataset.tab;
      if (activeTab !== newTab) {
        tabBtn.click(); // Имитируем нажатие
      }
    }
  }, { passive: false });
}
