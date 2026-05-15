// ─────────────────────────────────────────
//  MyNotes PWA — app.js  v3
// ─────────────────────────────────────────

const STORAGE_KEY = 'mynotes_v4';
const CATS = {
  tasks:    { label:'Задачи',     icon:'✦', color:'#FF6B35', hasDateNav:true,  hasWorkoutNav:false },
  workout:  { label:'Тренировка', icon:'◈', color:'#00D4AA', hasDateNav:false, hasWorkoutNav:true  },
  homework: { label:'Домашка',    icon:'◆', color:'#A78BFA', hasDateNav:true,  hasWorkoutNav:false },
  notes:    { label:'Заметки',    icon:'◇', color:'#F59E0B', hasDateNav:false, hasWorkoutNav:false },
};

// ── helpers ───────────────────────────────────
function toKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function today(){ return toKey(new Date()); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function parseKey(k){ const [y,m,d]=k.split('-'); return new Date(+y,+m-1,+d); }
function addDays(k,n){ const d=parseKey(k); d.setDate(d.getDate()+n); return toKey(d); }
function fmtFull(k){ return parseKey(k).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}); }
function fmtShort(k){ return parseKey(k).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); }
function fmtWd(k){ return parseKey(k).toLocaleDateString('ru-RU',{weekday:'short'}).replace('.',''); }
function fmtMonthYear(d){ return d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}); }

// ── state ─────────────────────────────────────
let state        = loadState();
let activeTab    = 'tasks';
let selectedDate = today();
let workoutOffset= 0;
let workoutDates = [];
let editingId    = null;
let dateWinStart = -3;

// calendar modal state
let modalYear  = new Date().getFullYear();
let modalMonth = new Date().getMonth();

function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||makeDefault(); }
  catch{ return makeDefault(); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function makeDefault(){
  const t=today();
  return {
    tasks:   {[t]:[{id:uid(),text:'Пример задачи на сегодня',done:false}]},
    workout: {[t]:[{id:uid(),text:'Жим лёжа — 3×8 × 80кг',done:false},{id:uid(),text:'Приседания — 4×6 × 100кг',done:false},{id:uid(),text:'Тяга верхнего блока — 3×10 × 60кг',done:false}]},
    homework:{[t]:[{id:uid(),text:'Математика — параграф 12',done:false}]},
    notes:   [{id:uid(),text:'Пример заметки',done:false}],
  };
}

// ── accessors ─────────────────────────────────
function rebuildWorkoutDates(){
  workoutDates=Object.keys(state.workout).filter(k=>(state.workout[k]||[]).length>0).sort();
  if(!workoutDates.includes(today())){ workoutDates.push(today()); workoutDates.sort(); }
}
function wkDate(){
  rebuildWorkoutDates();
  workoutOffset=Math.max(-(workoutDates.length-1),Math.min(0,workoutOffset));
  return workoutDates[workoutDates.length-1+workoutOffset];
}
function currentItems(){
  if(activeTab==='notes')   return state.notes;
  if(activeTab==='workout') return state.workout[wkDate()]||[];
  return state[activeTab][selectedDate]||[];
}
function setItems(arr){
  if(activeTab==='notes')  { state.notes=arr; return; }
  if(activeTab==='workout'){ state.workout[wkDate()]=arr; return; }
  state[activeTab][selectedDate]=arr;
}

// ── mutations ─────────────────────────────────
function addItem(text){
  if(!text.trim()) return;
  setItems([...currentItems(),{id:uid(),text:text.trim(),done:false}]);
  saveState(); render();
}
function toggleItem(id){
  setItems(currentItems().map(i=>i.id===id?{...i,done:!i.done}:i));
  saveState(); render();
}
function deleteItem(id){
  setItems(currentItems().filter(i=>i.id!==id));
  saveState(); render();
}
function updateItem(id,text){
  if(!text.trim()) return;
  setItems(currentItems().map(i=>i.id===id?{...i,text:text.trim()}:i));
  saveState(); render();
}
function clearDone(){
  setItems(currentItems().filter(i=>!i.done));
  saveState(); render();
}
function copyItemText(id){
  const item=currentItems().find(i=>i.id===id);
  if(!item) return;
  navigator.clipboard.writeText(item.text).catch(()=>{});
  showToast('Скопировано ✓');
}
function moveToTomorrow(id){
  if(activeTab==='notes'||activeTab==='workout') return;
  const item=currentItems().find(i=>i.id===id);
  if(!item) return;
  setItems(currentItems().filter(i=>i.id!==id));
  const tomorrow=addDays(selectedDate,1);
  state[activeTab][tomorrow]=[...(state[activeTab][tomorrow]||[]),{...item,id:uid(),done:false}];
  saveState(); render();
  showToast('Перенесено на '+fmtShort(tomorrow)+' →');
}

// ── workout copy-all ───────────────────────────
function copyWorkoutTo(targetDate){
  const src=state.workout[wkDate()]||[];
  if(!src.length){ showToast('Тренировка пустая'); return; }
  // don't overwrite if target already has items — append unique
  const dest=state.workout[targetDate]||[];
  const newItems=src.map(i=>({...i,id:uid(),done:false}));
  state.workout[targetDate]=[...dest,...newItems];
  // rebuild dates
  rebuildWorkoutDates();
  // switch view to target
  workoutOffset=workoutDates.indexOf(targetDate)-( workoutDates.length-1);
  saveState(); render();
  showToast('Тренировка скопирована на '+fmtShort(targetDate));
}

// ── drag-to-reorder ────────────────────────────
let dragSrcIdx = null;

function attachDrag(listEl){
  let touchStartY=0, touchItem=null, touchIdx=null, clone=null;

  // pointer/touch drag
  listEl.addEventListener('touchstart', e=>{
    const item=e.target.closest('.item');
    if(!item||e.target.closest('.act-btn')||e.target.closest('.check-btn')) return;
    touchItem=item;
    touchIdx=[...listEl.children].filter(c=>c.classList.contains('item')).indexOf(item);
    touchStartY=e.touches[0].clientY;
    // create visual clone
    const rect=item.getBoundingClientRect();
    clone=item.cloneNode(true);
    clone.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:0.75;z-index:999;pointer-events:none;transition:none;transform:scale(1.02);box-shadow:0 10px 30px rgba(0,0,0,0.5);`;
    document.body.appendChild(clone);
    item.style.opacity='0.3';
  },{passive:true});

  listEl.addEventListener('touchmove', e=>{
    if(!touchItem||!clone) return;
    e.preventDefault();
    const dy=e.touches[0].clientY-touchStartY;
    clone.style.transform=`translateY(${dy}px) scale(1.02)`;
    // find drop target
    const y=e.touches[0].clientY;
    const items=[...listEl.children].filter(c=>c.classList.contains('item'));
    let newIdx=touchIdx;
    items.forEach((el,i)=>{
      const r=el.getBoundingClientRect();
      if(y>r.top+r.height/2) newIdx=i+1>items.length-1?items.length-1:i+1;
    });
    if(newIdx!==touchIdx){
      const arr=[...currentItems()];
      const [moved]=arr.splice(touchIdx,1);
      arr.splice(newIdx,0,moved);
      setItems(arr);
      touchIdx=newIdx;
      saveState();
      // re-render list only (no full render to avoid flicker)
      renderListOnly();
      // re-attach since DOM changed
      attachDrag(listEl);
    }
  },{passive:false});

  const endDrag=()=>{
    if(!touchItem) return;
    touchItem.style.opacity='';
    if(clone){ clone.remove(); clone=null; }
    touchItem=null; touchIdx=null;
  };
  listEl.addEventListener('touchend', endDrag,{passive:true});
  listEl.addEventListener('touchcancel', endDrag,{passive:true});
}

// ── toast ──────────────────────────────────────
let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2000);
}

// ── DOM refs ──────────────────────────────────
const itemList     = document.getElementById('itemList');
const mainInput    = document.getElementById('mainInput');
const addBtn       = document.getElementById('addBtn');
const clearBtn     = document.getElementById('clearDoneBtn');
const dateNav      = document.getElementById('dateNav');
const dateNavDays  = document.getElementById('dateNavDays');
const datePrev     = document.getElementById('datePrev');
const dateNext     = document.getElementById('dateNext');
const calMonth     = document.getElementById('calMonth');
const workoutNav   = document.getElementById('workoutNav');
const wkPrev       = document.getElementById('wkPrev');
const wkNext       = document.getElementById('wkNext');
const wkDateLbl    = document.getElementById('wkDateLabel');
const wkCopyBar    = document.getElementById('workoutCopyBar');
const wkCopyToday  = document.getElementById('wkCopyToday');
const wkCopyTomorrow=document.getElementById('wkCopyTomorrow');
const calIconBtn   = document.getElementById('calIconBtn');
const calModal     = document.getElementById('calModal');
const modalClose   = document.getElementById('modalClose');
const modalPrevM   = document.getElementById('modalPrevMonth');
const modalNextM   = document.getElementById('modalNextMonth');
const modalTitle   = document.getElementById('modalMonthTitle');
const modalDays    = document.getElementById('modalDays');

// ── render ────────────────────────────────────
function render(){
  const cat=CATS[activeTab];

  // accent
  document.querySelectorAll('.blob-1,.blob-2').forEach(b=>b.style.background=cat.color);
  document.querySelector('.progress-ring').style.stroke=cat.color;
  document.querySelector('.progress-pct').style.color=cat.color;
  document.querySelector('.add-btn').style.background=cat.color;
  document.querySelector('.add-btn').style.boxShadow=`0 4px 14px ${cat.color}55`;
  document.documentElement.style.setProperty('--accent',cat.color);

  // header
  document.getElementById('sectionIcon').textContent=cat.icon;
  document.getElementById('sectionIcon').style.color=cat.color;
  document.getElementById('sectionName').textContent=cat.label;

  const dispDate=activeTab==='workout'?wkDate():(cat.hasDateNav?selectedDate:today());
  document.getElementById('dateLabel').textContent=fmtFull(dispDate).replace(/^./,c=>c.toUpperCase());

  // cal icon button visibility
  calIconBtn.classList.toggle('hidden',!cat.hasDateNav);

  // navs
  dateNav.classList.toggle('visible',cat.hasDateNav);
  workoutNav.classList.toggle('visible',cat.hasWorkoutNav);
  wkCopyBar.classList.toggle('visible',cat.hasWorkoutNav);

  if(cat.hasDateNav)    renderDateNav();
  if(cat.hasWorkoutNav) renderWorkoutNav();

  // stats
  const items=currentItems();
  const done=items.filter(i=>i.done).length;
  document.getElementById('statActive').textContent=items.length-done;
  document.getElementById('statDone').textContent=done;
  clearBtn.classList.toggle('visible',done>0);

  // progress (r=19 → circ≈119.4)
  const circ=2*Math.PI*19;
  const pct=items.length?Math.round((done/items.length)*100):0;
  const ring=document.querySelector('.progress-ring');
  ring.style.strokeDasharray=circ;
  ring.style.strokeDashoffset=circ-(pct/100)*circ;
  document.getElementById('progressPct').textContent=pct+'%';

  renderListOnly();

  // badges
  Object.keys(CATS).forEach(tab=>{
    const badge=document.getElementById('badge-'+tab);
    let count=0;
    if(tab==='notes') count=(state.notes||[]).filter(i=>!i.done).length;
    else if(tab==='workout') count=(state.workout[today()]||[]).filter(i=>!i.done).length;
    else count=(state[tab][today()]||[]).filter(i=>!i.done).length;
    badge.textContent=count>0?count:'';
    badge.classList.toggle('show',count>0);
  });

  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===activeTab));
  mainInput.placeholder=`Добавить в «${CATS[activeTab].label}»...`;
}

function renderListOnly(){
  const items=currentItems();
  const cat=CATS[activeTab];
  if(items.length===0){
    itemList.innerHTML=`<div class="empty-state"><div class="es-icon">${cat.icon}</div><div class="es-text">Пока пусто — добавь что-нибудь</div></div>`;
  } else {
    itemList.innerHTML='';
    items.forEach(item=>itemList.appendChild(buildItem(item,cat)));
  }
  attachDrag(itemList);
}

function buildItem(item,cat){
  const div=document.createElement('div');
  div.className='item'+(item.done?' done':'');
  div.style.borderLeftColor=item.done?'rgba(255,255,255,0.07)':cat.color;

  if(editingId===item.id){
    const inp=document.createElement('input');
    inp.className='edit-input'; inp.value=item.text;
    inp.addEventListener('blur',()=>{updateItem(item.id,inp.value);editingId=null;});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){updateItem(item.id,inp.value);editingId=null;}});
    div.appendChild(inp);
    setTimeout(()=>inp.focus(),10);
    return div;
  }

  // check
  const cbtn=document.createElement('button');
  cbtn.className='check-btn';
  cbtn.innerHTML=`<div class="check-circle${item.done?' checked':''}">${item.done?'<span class="check-mark">✓</span>':''}</div>`;
btn.addEventListener('click', () => {
  selectedDate = k;
  dateWinStart = -3;
  calModal.classList.remove('open');
  render();
});

  // text
  const span=document.createElement('span');
  span.className='item-text'; span.textContent=item.text;
  let pressTimer, moved=false;
  span.addEventListener('touchstart',()=>{moved=false;pressTimer=setTimeout(()=>{if(!moved){editingId=item.id;render();}},600);},{passive:true});
  span.addEventListener('touchmove',()=>{moved=true;clearTimeout(pressTimer);},{passive:true});
  span.addEventListener('touchend',()=>clearTimeout(pressTimer),{passive:true});
  span.addEventListener('dblclick',()=>{editingId=item.id;render();});

  // actions
  const actions=document.createElement('div');
  actions.className='item-actions';

  if(cat.hasDateNav){
    const mv=document.createElement('button');
    mv.className='act-btn act-move'; mv.title='На завтра'; mv.textContent='→';
    mv.addEventListener('click',e=>{e.stopPropagation();moveToTomorrow(item.id);});
    actions.appendChild(mv);
  }

  const cp=document.createElement('button');
  cp.className='act-btn act-copy'; cp.title='Копировать'; cp.textContent='⎘';
  cp.addEventListener('click',e=>{e.stopPropagation();copyItemText(item.id);});
  actions.appendChild(cp);

  const dl=document.createElement('button');
  dl.className='act-btn act-delete'; dl.title='Удалить'; dl.textContent='✕';
  dl.addEventListener('click',e=>{e.stopPropagation();deleteItem(item.id);});
  actions.appendChild(dl);

  div.appendChild(cbtn);
  div.appendChild(span);
  div.appendChild(actions);
  return div;
}

// ── Date strip ────────────────────────────────
function renderDateNav(){
  calMonth.textContent=fmtMonthYear(parseKey(selectedDate)).replace(/^./,c=>c.toUpperCase());
  dateNavDays.innerHTML='';
  const t=today();
  for(let i=dateWinStart;i<dateWinStart+14;i++){
    const d=addDays(t,i);
    const chip=document.createElement('button');
    chip.className='day-chip'+(d===selectedDate?' active':'')+(d===t?' today':'');
    const dn=parseKey(d).getDate();
    chip.innerHTML=`<span class="dc-wd">${fmtWd(d)}</span><span class="dc-d">${dn}</span>`;
    const its=state[activeTab][d];
    if(its&&its.filter(i=>!i.done).length>0) chip.innerHTML+=`<span class="dc-dot"></span>`;
    chip.addEventListener('click',()=>{selectedDate=d;render();});
    dateNavDays.appendChild(chip);
  }
  setTimeout(()=>{
    const ac=dateNavDays.querySelector('.active');
    if(ac) ac.scrollIntoView({inline:'center',behavior:'smooth'});
  },50);
}
datePrev.addEventListener('click',()=>{dateWinStart-=7;render();});
dateNext.addEventListener('click',()=>{dateWinStart+=7;render();});

// ── Workout nav ───────────────────────────────
function renderWorkoutNav(){
  rebuildWorkoutDates();
  const cur=wkDate();
  wkDateLbl.textContent=cur===today()?'Сегодня — '+fmtShort(cur):fmtFull(cur);
  wkPrev.disabled=workoutOffset<=-(workoutDates.length-1);
  wkNext.disabled=workoutOffset>=0;
}
wkPrev.addEventListener('click',()=>{workoutOffset=Math.max(-(workoutDates.length-1),workoutOffset-1);render();});
wkNext.addEventListener('click',()=>{if(workoutOffset<0)workoutOffset++;render();});

// workout copy-all
wkCopyToday.addEventListener('click',()=>copyWorkoutTo(today()));
wkCopyTomorrow.addEventListener('click',()=>copyWorkoutTo(addDays(today(),1)));

// ── Calendar modal ────────────────────────────
calIconBtn.addEventListener('click',()=>{
  modalYear=parseKey(selectedDate).getFullYear();
  modalMonth=parseKey(selectedDate).getMonth();
  renderModal();
  calModal.classList.add('open');
});
modalClose.addEventListener('click',()=>calModal.classList.remove('open'));
calModal.addEventListener('click',e=>{if(e.target===calModal)calModal.classList.remove('open');});
modalPrevM.addEventListener('click',()=>{modalMonth--;if(modalMonth<0){modalMonth=11;modalYear--;}renderModal();});
modalNextM.addEventListener('click',()=>{modalMonth++;if(modalMonth>11){modalMonth=0;modalYear++;}renderModal();});

function renderModal(){
  const d=new Date(modalYear,modalMonth,1);
  modalTitle.textContent=fmtMonthYear(d).replace(/^./,c=>c.toUpperCase());
  modalDays.innerHTML='';
  const t=today();
  // offset: Monday=0
  let startDow=(d.getDay()+6)%7; // Mon=0
  for(let i=0;i<startDow;i++){
    const emp=document.createElement('button'); emp.className='modal-day empty'; emp.disabled=true;
    modalDays.appendChild(emp);
  }
  const daysInMonth=new Date(modalYear,modalMonth+1,0).getDate();
  for(let day=1;day<=daysInMonth;day++){
    const k=toKey(new Date(modalYear,modalMonth,day));
    const btn=document.createElement('button');
    btn.className='modal-day';
    if(k===t) btn.classList.add('today');
    if(k===selectedDate) btn.classList.add('selected');
    const its=activeTab!=='notes'&&activeTab!=='workout'?state[activeTab][k]:null;
    if(its&&its.filter(i=>!i.done).length>0) btn.classList.add('has-items');
    btn.textContent=day;
    btn.addEventListener('click',()=>{
      selectedDate=k;
      calModal.classList.remove('open');
      dateWinStart=-3; // re-center strip
      render();
    });
    modalDays.appendChild(btn);
  }
}

// ── Nav tabs ──────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeTab=btn.dataset.tab; editingId=null;
    if(activeTab==='tasks'||activeTab==='homework') selectedDate=today();
    if(activeTab==='workout'){rebuildWorkoutDates();workoutOffset=0;}
    render();
  });
});

// ── Input ─────────────────────────────────────
addBtn.addEventListener('click',()=>{addItem(mainInput.value);mainInput.value='';mainInput.focus();});
mainInput.addEventListener('keydown',e=>{if(e.key==='Enter'){addItem(mainInput.value);mainInput.value='';}});
clearBtn.addEventListener('click',clearDone);

// ── Init ──────────────────────────────────────
render();
