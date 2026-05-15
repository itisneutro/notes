// ─────────────────────────────────────────────
//  MyNotes PWA — app.js
// ─────────────────────────────────────────────

const STORAGE_KEY = 'mynotes_v3';
const CATS = {
  tasks:   { label: 'Задачи',     icon: '✦', color: '#FF6B35', hasDateNav: true,    hasWorkoutNav: false },
  workout: { label: 'Тренировка', icon: '◈', color: '#00D4AA', hasDateNav: false,   hasWorkoutNav: true  },
  homework:{ label: 'Домашка',    icon: '◆', color: '#A78BFA', hasDateNav: true,    hasWorkoutNav: false },
  notes:   { label: 'Заметки',    icon: '◇', color: '#F59E0B', hasDateNav: false,   hasWorkoutNav: false },
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
function fmtShort(k)   { return parseKey(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }

// ── state ─────────────────────────────────────
let state = loadState();
let activeTab = 'tasks';
let selectedDate = today();         // for tasks / homework
let workoutOffset = 0;              // 0 = today, -1 = yesterday, etc.
let workoutDates = [];              // sorted list of dates that have workout data
let editingId = null;
let dateWindowStart = -3;           // how many days ago the date window starts

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeDefault(); }
  catch { return makeDefault(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function makeDefault() {
  const t = today();
  return {
    tasks: { [t]: [{ id: uid(), text: 'Пример задачи', done: false }] },
    workout: { [t]: [{ id: uid(), text: 'Жим лёжа — 3×8 × 80кг', done: false }, { id: uid(), text: 'Приседания — 4×6 × 100кг', done: false }] },
    homework: { [t]: [{ id: uid(), text: 'Математика — параграф 12', done: false }] },
    notes: [{ id: uid(), text: 'Пример заметки', done: false }],
  };
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── current items getter ───────────────────────
function currentItems() {
  if (activeTab === 'notes') return state.notes;
  if (activeTab === 'workout') {
    const d = workoutCurrentDate();
    return (state.workout[d] || []);
  }
  // tasks / homework — by selectedDate
  return (state[activeTab][selectedDate] || []);
}

function workoutCurrentDate() {
  if (workoutDates.length === 0) return today();
  // clamp offset
  workoutOffset = Math.max(-(workoutDates.length - 1), Math.min(0, workoutOffset));
  return workoutDates[workoutDates.length - 1 + workoutOffset];
}

function rebuildWorkoutDates() {
  workoutDates = Object.keys(state.workout).filter(k => (state.workout[k] || []).length > 0).sort();
  if (!workoutDates.includes(today())) {
    // always include today even if empty
    workoutDates.push(today());
    workoutDates.sort();
  }
}

// ── mutations ─────────────────────────────────
function setItems(arr) {
  if (activeTab === 'notes') { state.notes = arr; return; }
  if (activeTab === 'workout') {
    const d = workoutCurrentDate();
    state.workout[d] = arr;
    return;
  }
  state[activeTab][selectedDate] = arr;
}

function addItem(text) {
  if (!text.trim()) return;
  const items = [...currentItems(), { id: uid(), text: text.trim(), done: false }];
  setItems(items);
  saveState();
  render();
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
const workoutNav = $('workoutNav');
const wkPrev     = $('wkPrev');
const wkNext     = $('wkNext');
const wkDateLbl  = $('wkDateLabel');

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

  // date label
  if (activeTab === 'workout') {
    rebuildWorkoutDates();
    $('dateLabel').textContent = fmtFull(workoutCurrentDate()).replace(/^./, c => c.toUpperCase());
  } else if (cat.hasDateNav) {
    $('dateLabel').textContent = fmtFull(selectedDate).replace(/^./, c => c.toUpperCase());
  } else {
    $('dateLabel').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
  }

  // nav visibility
  dateNav.classList.toggle('visible', cat.hasDateNav);
  workoutNav.classList.toggle('visible', cat.hasWorkoutNav);

  if (cat.hasDateNav) renderDateNav();
  if (cat.hasWorkoutNav) renderWorkoutNav();

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
    else if (tab === 'workout') { count = (state.workout[today()] || []).filter(i => !i.done).length; }
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
    // check btn
    const cbtn = document.createElement('button');
    cbtn.className = 'check-btn';
    cbtn.innerHTML = `<div class="check-circle${item.done ? ' checked' : ''}">${item.done ? '<span class="check-mark">✓</span>' : ''}</div>`;
    cbtn.addEventListener('click', () => toggleItem(item.id));

    // text
    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = item.text;
    span.addEventListener('dblclick', () => { editingId = item.id; render(); });
    // long press for mobile
    let pressTimer;
    span.addEventListener('touchstart', () => { pressTimer = setTimeout(() => { editingId = item.id; render(); }, 600); });
    span.addEventListener('touchend', () => clearTimeout(pressTimer));

    // delete
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
  // show a window of days: dateWindowStart to dateWindowStart+13
  const windowSize = 14;
  const t = today();
  for (let i = dateWindowStart; i < dateWindowStart + windowSize; i++) {
    const d = addDays(t, i);
    const chip = document.createElement('button');
    chip.className = 'day-chip' + (d === selectedDate ? ' active' : '') + (d === t ? ' today' : '');
    const wd = fmtWeekday(d).replace('.','');
    const dayNum = parseKey(d).getDate();
    chip.innerHTML = `<span class="dc-wd">${wd}</span><span class="dc-d">${dayNum}</span>`;

    // show dot if has items
    const items = state[activeTab][d];
    if (items && items.filter(i => !i.done).length > 0) {
      chip.innerHTML += `<span class="dc-dot"></span>`;
    }

    chip.addEventListener('click', () => { selectedDate = d; render(); });
    dateNavDays.appendChild(chip);
  }

  datePrev.disabled = false;
  dateNext.disabled = false;
}

datePrev.addEventListener('click', () => { dateWindowStart -= 7; render(); });
dateNext.addEventListener('click', () => { dateWindowStart += 7; render(); });

// ── Workout nav ────────────────────────────────
function renderWorkoutNav() {
  rebuildWorkoutDates();
  const cur = workoutCurrentDate();
  wkDateLbl.textContent = cur === today() ? 'Сегодня — ' + fmtShort(cur) : fmtFull(cur);
  wkPrev.disabled = workoutOffset <= -(workoutDates.length - 1);
  wkNext.disabled = workoutOffset >= 0;

  // add new day button if viewing past
  if (workoutOffset < 0) {
    wkNext.textContent = 'След. ›';
  } else {
    wkNext.textContent = 'Новая ›';
    wkNext.disabled = true; // can't go forward from today
  }
}

wkPrev.addEventListener('click', () => {
  workoutOffset = Math.max(-(workoutDates.length - 1), workoutOffset - 1);
  render();
});
wkNext.addEventListener('click', () => {
  if (workoutOffset < 0) workoutOffset++;
  render();
});

// ── Nav tabs ──────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    editingId = null;
    if (activeTab === 'tasks' || activeTab === 'homework') selectedDate = today();
    if (activeTab === 'workout') { rebuildWorkoutDates(); workoutOffset = 0; }
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

// ── Init ──────────────────────────────────────
render();
