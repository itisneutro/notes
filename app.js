// ─────────────────────────────────────────
//  MyNotes PWA — app.js  (v2)
// ─────────────────────────────────────────

const STORAGE_KEY = 'mynotes_v4';
const CATS = {
  tasks:    { label: 'Задачи',     icon: '✦', color: '#FF6B35', hasDateNav: true,  hasWorkoutNav: false },
  workout:  { label: 'Тренировка', icon: '◈', color: '#00D4AA', hasDateNav: false, hasWorkoutNav: true  },
  homework: { label: 'Домашка',    icon: '◆', color: '#A78BFA', hasDateNav: true,  hasWorkoutNav: false },
  notes:    { label: 'Заметки',    icon: '◇', color: '#F59E0B', hasDateNav: false, hasWorkoutNav: false },
};

// ── helpers ──────────────────────────────
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function today()      { return toKey(new Date()); }
function uid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function parseKey(k)  { const [y,m,d]=k.split('-'); return new Date(+y,+m-1,+d); }
function addDays(k,n) { const d=parseKey(k); d.setDate(d.getDate()+n); return toKey(d); }
function fmtFull(k)   { return parseKey(k).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}); }
function fmtShort(k)  { return parseKey(k).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); }
function fmtWd(k)     { return parseKey(k).toLocaleDateString('ru-RU',{weekday:'short'}).replace('.',''); }
function fmtMonth(k)  { return parseKey(k).toLocaleDateString('ru-RU',{month:'long',year:'numeric'}); }

// ── state ─────────────────────────────────
let state = loadState();
let activeTab     = 'tasks';
let selectedDate  = today();
let workoutOffset = 0;
let workoutDates  = [];
let editingId     = null;
let dateWinStart  = -3;

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeDefault(); }
  catch { return makeDefault(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function makeDefault() {
  const t = today();
  return {
    tasks:    { [t]: [{ id: uid(), text: 'Пример задачи на сегодня', done: false }] },
    workout:  { [t]: [{ id: uid(), text: 'Жим лёжа — 3×8 × 80кг', done: false }, { id: uid(), text: 'Приседания — 4×6 × 100кг', done: false }] },
    homework: { [t]: [{ id: uid(), text: 'Математика — параграф 12', done: false }] },
    notes:    [{ id: uid(), text: 'Пример заметки', done: false }],
  };
}

// ── accessors ─────────────────────────────
function wkDate() {
  rebuildWorkoutDates();
  workoutOffset = Math.max(-(workoutDates.length-1), Math.min(0, workoutOffset));
  return workoutDates[workoutDates.length - 1 + workoutOffset];
}
function rebuildWorkoutDates() {
  workoutDates = Object.keys(state.workout).filter(k=>(state.workout[k]||[]).length>0).sort();
  if (!workoutDates.includes(today())) { workoutDates.push(today()); workoutDates.sort(); }
}
function currentItems() {
  if (activeTab==='notes')   return state.notes;
  if (activeTab==='workout') return state.workout[wkDate()] || [];
  return state[activeTab][selectedDate] || [];
}
function setItems(arr) {
  if (activeTab==='notes')   { state.notes = arr; return; }
  if (activeTab==='workout') { state.workout[wkDate()] = arr; return; }
  state[activeTab][selectedDate] = arr;
}

// ── mutations ─────────────────────────────
function addItem(text) {
  if (!text.trim()) return;
  setItems([...currentItems(), { id: uid(), text: text.trim(), done: false }]);
  saveState(); render();
}
function toggleItem(id) {
  setItems(currentItems().map(i => i.id===id ? {...i, done:!i.done} : i));
  saveState(); render();
}
function deleteItem(id) {
  setItems(currentItems().filter(i => i.id!==id));
  saveState(); render();
}
function updateItem(id, text) {
  if (!text.trim()) return;
  setItems(currentItems().map(i => i.id===id ? {...i, text:text.trim()} : i));
  saveState(); render();
}
function clearDone() {
  setItems(currentItems().filter(i => !i.done));
  saveState(); render();
}

// copy item text to clipboard
function copyItem(id) {
  const item = currentItems().find(i=>i.id===id);
  if (!item) return;
  navigator.clipboard.writeText(item.text).catch(()=>{});
  showToast('Скопировано ✓');
}

// move item to tomorrow (only for date-based tabs)
function moveToTomorrow(id) {
  if (activeTab==='notes' || activeTab==='workout') return;
  const item = currentItems().find(i=>i.id===id);
  if (!item) return;
  // remove from current date
  setItems(currentItems().filter(i=>i.id!==id));
  // add to tomorrow
  const tomorrow = addDays(selectedDate, 1);
  const dest = state[activeTab][tomorrow] || [];
  state[activeTab][tomorrow] = [...dest, {...item, id:uid(), done:false}];
  saveState(); render();
  showToast('Перенесено на ' + fmtShort(tomorrow));
}

// ── toast ─────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── DOM refs ──────────────────────────────
const itemList   = document.getElementById('itemList');
const mainInput  = document.getElementById('mainInput');
const addBtn     = document.getElementById('addBtn');
const clearBtn   = document.getElementById('clearDoneBtn');
const dateNav    = document.getElementById('dateNav');
const dateNavDays= document.getElementById('dateNavDays');
const datePrev   = document.getElementById('datePrev');
const dateNext   = document.getElementById('dateNext');
const calMonth   = document.getElementById('calMonth');
const workoutNav = document.getElementById('workoutNav');
const wkPrev     = document.getElementById('wkPrev');
const wkNext     = document.getElementById('wkNext');
const wkDateLbl  = document.getElementById('wkDateLabel');

// ── render ────────────────────────────────
function render() {
  const cat = CATS[activeTab];

  // accent color
  document.querySelectorAll('.blob').forEach(b => b.style.background = cat.color);
  document.querySelector('.progress-ring').style.stroke = cat.color;
  document.querySelector('.progress-pct').style.color   = cat.color;
  document.querySelector('.add-btn').style.background   = cat.color;
  document.querySelector('.add-btn').style.boxShadow    = `0 4px 14px ${cat.color}55`;
  document.documentElement.style.setProperty('--accent', cat.color);

  // header
  document.getElementById('sectionIcon').textContent = cat.icon;
  document.getElementById('sectionIcon').style.color = cat.color;
  document.getElementById('sectionName').textContent = cat.label;

  const displayDate = activeTab==='workout' ? wkDate() : (cat.hasDateNav ? selectedDate : today());
  document.getElementById('dateLabel').textContent = fmtFull(displayDate).replace(/^./,c=>c.toUpperCase());

  // navs
  dateNav.classList.toggle('visible', cat.hasDateNav);
  workoutNav.classList.toggle('visible', cat.hasWorkoutNav);
  if (cat.hasDateNav)    renderDateNav();
  if (cat.hasWorkoutNav) renderWorkoutNav();

  // items
  const items = currentItems();
  const doneCount = items.filter(i=>i.done).length;
  document.getElementById('statActive').textContent = items.length - doneCount;
  document.getElementById('statDone').textContent   = doneCount;
  clearBtn.classList.toggle('visible', doneCount>0);

  // progress (circumference for r=19 → 2π*19 ≈ 119.4)
  const circ = 2 * Math.PI * 19;
  const pct  = items.length ? Math.round((doneCount/items.length)*100) : 0;
  const ring = document.querySelector('.progress-ring');
  ring.style.strokeDasharray  = circ;
  ring.style.strokeDashoffset = circ - (pct/100)*circ;
  document.getElementById('progressPct').textContent = pct+'%';

  // list
  if (items.length===0) {
    itemList.innerHTML = `<div class="empty-state"><div class="es-icon">${cat.icon}</div><div class="es-text">Пока пусто — добавь что-нибудь</div></div>`;
  } else {
    itemList.innerHTML = '';
    items.forEach(item => itemList.appendChild(buildItem(item, cat)));
  }

  // badges
  Object.keys(CATS).forEach(tab => {
    const badge = document.getElementById('badge-'+tab);
    let count = 0;
    if (tab==='notes')   count = (state.notes||[]).filter(i=>!i.done).length;
    else if (tab==='workout') count = (state.workout[today()]||[]).filter(i=>!i.done).length;
    else count = (state[tab][today()]||[]).filter(i=>!i.done).length;
    badge.textContent = count>0 ? count : '';
    badge.classList.toggle('show', count>0);
  });

  // active tab
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab===activeTab));

  mainInput.placeholder = `Добавить в «${cat.label}»...`;
}

function buildItem(item, cat) {
  const div = document.createElement('div');
  div.className = 'item' + (item.done ? ' done' : '');
  div.style.borderLeftColor = item.done ? 'rgba(255,255,255,0.07)' : cat.color;

  if (editingId===item.id) {
    const inp = document.createElement('input');
    inp.className = 'edit-input'; inp.value = item.text;
    inp.addEventListener('blur',    () => { updateItem(item.id, inp.value); editingId=null; });
    inp.addEventListener('keydown', e => { if (e.key==='Enter') { updateItem(item.id, inp.value); editingId=null; } });
    div.appendChild(inp);
    setTimeout(() => inp.focus(), 10);
    return div;
  }

  // check
  const cbtn = document.createElement('button');
  cbtn.className = 'check-btn';
  cbtn.innerHTML = `<div class="check-circle${item.done?' checked':''}">${item.done?'<span class="check-mark">✓</span>':''}</div>`;
  cbtn.addEventListener('click', () => toggleItem(item.id));

  // text
  const span = document.createElement('span');
  span.className = 'item-text'; span.textContent = item.text;
  span.addEventListener('dblclick', () => { editingId=item.id; render(); });
  let pressTimer;
  span.addEventListener('touchstart', () => { pressTimer=setTimeout(()=>{ editingId=item.id; render(); }, 600); });
  span.addEventListener('touchend', () => clearTimeout(pressTimer));
  span.addEventListener('touchmove', () => clearTimeout(pressTimer));

  // action buttons
  const actions = document.createElement('div');
  actions.className = 'item-actions';

  // copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'act-btn act-copy';
  copyBtn.title = 'Копировать';
  copyBtn.textContent = '⎘';
  copyBtn.addEventListener('click', () => copyItem(item.id));

  // move to tomorrow (only for date tabs)
  if (cat.hasDateNav) {
    const moveBtn = document.createElement('button');
    moveBtn.className = 'act-btn act-move';
    moveBtn.title = 'На завтра';
    moveBtn.textContent = '→';
    moveBtn.addEventListener('click', () => moveToTomorrow(item.id));
    actions.appendChild(moveBtn);
  }

  actions.appendChild(copyBtn);

  // delete
  const delBtn = document.createElement('button');
  delBtn.className = 'act-btn act-delete';
  delBtn.title = 'Удалить';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', () => deleteItem(item.id));
  actions.appendChild(delBtn);

  div.appendChild(cbtn);
  div.appendChild(span);
  div.appendChild(actions);
  return div;
}

// ── Calendar ──────────────────────────────
function renderDateNav() {
  const t = today();
  calMonth.textContent = fmtMonth(selectedDate).replace(/^./,c=>c.toUpperCase());
  dateNavDays.innerHTML = '';
  const winSize = 14;
  for (let i=dateWinStart; i<dateWinStart+winSize; i++) {
    const d = addDays(t, i);
    const chip = document.createElement('button');
    chip.className = 'day-chip' + (d===selectedDate?' active':'') + (d===t?' today':'');
    const dayNum = parseKey(d).getDate();
    chip.innerHTML = `<span class="dc-wd">${fmtWd(d)}</span><span class="dc-d">${dayNum}</span>`;
    const items = state[activeTab][d];
    if (items && items.filter(i=>!i.done).length>0) chip.innerHTML += `<span class="dc-dot"></span>`;
    chip.addEventListener('click', () => { selectedDate=d; render(); });
    dateNavDays.appendChild(chip);
  }
  // scroll active chip into view
  setTimeout(() => {
    const active = dateNavDays.querySelector('.day-chip.active');
    if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }, 50);
}

datePrev.addEventListener('click', () => { dateWinStart-=7; render(); });
dateNext.addEventListener('click', () => { dateWinStart+=7; render(); });

// ── Workout nav ───────────────────────────
function renderWorkoutNav() {
  rebuildWorkoutDates();
  const cur = wkDate();
  wkDateLbl.textContent = cur===today() ? 'Сегодня — '+fmtShort(cur) : fmtFull(cur);
  wkPrev.disabled = workoutOffset <= -(workoutDates.length-1);
  wkNext.disabled = workoutOffset >= 0;
}
wkPrev.addEventListener('click', () => { workoutOffset = Math.max(-(workoutDates.length-1), workoutOffset-1); render(); });
wkNext.addEventListener('click', () => { if (workoutOffset<0) workoutOffset++; render(); });

// ── Nav tabs ──────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab; editingId = null;
    if (activeTab==='tasks'||activeTab==='homework') selectedDate=today();
    if (activeTab==='workout') { rebuildWorkoutDates(); workoutOffset=0; }
    render();
  });
});

// ── Input ─────────────────────────────────
addBtn.addEventListener('click', () => { addItem(mainInput.value); mainInput.value=''; mainInput.focus(); });
mainInput.addEventListener('keydown', e => { if (e.key==='Enter') { addItem(mainInput.value); mainInput.value=''; } });
clearBtn.addEventListener('click', clearDone);

// ── Init ──────────────────────────────────
render();
