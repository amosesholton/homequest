'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY    = 'homequest_v1';
const FRESHNESS_DAYS = 5; // completed tasks "expire" after this many days

const MOODS = [
  { min: 88, emoji: '🏡', label: 'Sparkling!',    barColor: '#52B788' },
  { min: 65, emoji: '🏡', label: 'Cozy & Tidy',   barColor: '#6BC28A' },
  { min: 45, emoji: '🏠', label: 'Getting Dusty', barColor: '#FFB627' },
  { min: 25, emoji: '🏠', label: 'Getting Messy', barColor: '#FF6B35' },
  { min: 10, emoji: '🏚️', label: 'Needs Help!',  barColor: '#EF233C' },
  { min:  0, emoji: '🏚️', label: 'In Crisis!',   barColor: '#EF233C' },
];

const MESSAGES = {
  'Sparkling!':    ["Your home loves you! 💖", "Everything is gleaming! ✨", "What a cozy haven! 🌟", "You're a home hero! 🦸"],
  'Cozy & Tidy':   ["Nice and tidy! 💚", "Home sweet home! 🍃", "Feeling fresh in here 🌿", "Looking good!"],
  'Getting Dusty': ["Could use a little love… 🧹", "Getting dusty in here 🌫️", "Your home needs some care!"],
  'Getting Messy': ["Things are piling up… 📦", "Your home is getting stressed 😟", "Time to roll up your sleeves!"],
  'Needs Help!':   ["Your home really needs you! 😰", "Please — things are falling apart! 🆘"],
  'In Crisis!':    ["🚨 Clean something NOW!", "Your home is crying for help! 😱"],
};

const ROOM_CONDITIONS = [
  { min: 85, label: '✨ Sparkling', color: '#2D9C62' },
  { min: 65, label: '💚 Tidy',     color: '#2D9C62' },
  { min: 40, label: '🌫️ Dusty',   color: '#CC8800' },
  { min: 20, label: '🟠 Messy',    color: '#D4500A' },
  { min:  0, label: '🔴 Neglected', color: '#C0002A' },
];

const CARE_EMOJIS = ['💚', '✨', '💛', '🌿', '💖', '⭐', '🌱'];

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  player: { tasksToday: 0, streak: 0, lastActiveDate: null, totalDone: 0 },
  quests: [],
};

let activeQuestId = null;
let selectedIcon  = '🏠';
let selectedColor = '#FF6B35';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeId(p) {
  return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function makeTask(text) {
  return { id: makeId('t'), text, completed: false, completedAt: null, createdAt: Date.now() };
}

function isTaskFresh(task) {
  if (!task.completed) return false;
  const ts = task.completedAt ?? Date.now();
  return (Date.now() - ts) / 86_400_000 < FRESHNESS_DAYS;
}

function questHealth(quest) {
  if (!quest.tasks.length) return 100;
  return Math.round(quest.tasks.filter(isTaskFresh).length / quest.tasks.length * 100);
}

function homeHealth() {
  if (!state.quests.length) return 100;
  return Math.round(state.quests.reduce((s, q) => s + questHealth(q), 0) / state.quests.length);
}

function getMood(h)      { return MOODS.find(m => h >= m.min)          ?? MOODS.at(-1); }
function getRoomCond(h)  { return ROOM_CONDITIONS.find(c => h >= c.min) ?? ROOM_CONDITIONS.at(-1); }

function pickMsg(mood) {
  const pool = MESSAGES[mood.label] ?? MESSAGES['Cozy & Tidy'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

function rgba(hex, a) {
  const [r, g, b] = [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map(x => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...state, ...JSON.parse(raw) };
      migrateTasks();
    } else {
      state.quests = defaultQuests();
    }
  } catch { state.quests = defaultQuests(); }
  updateStreak();
}

function migrateTasks() {
  for (const quest of state.quests) {
    for (const task of quest.tasks) {
      if (!task.createdAt)  task.createdAt = Date.now();
      if (task.completed && !task.completedAt) task.completedAt = Date.now() - 43_200_000;
      // Strip old XP fields from previous version
      delete task.xp; delete task.xpMin; delete task.xpMax; delete task.xpAwarded;
    }
    // Remove old 'completed' quest-level flag used by XP version
    delete quest.completed;
  }
  // Strip XP player fields
  delete state.player.totalXP;
  delete state.player.tasksCompleted;
  delete state.player.questsCompleted;
  delete state.combo;
  if (state.player.tasksToday  == null) state.player.tasksToday  = 0;
  if (state.player.totalDone   == null) state.player.totalDone   = 0;
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ─── Streak ───────────────────────────────────────────────────────────────────
function updateStreak() {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (state.player.lastActiveDate === today) return;
  if (state.player.lastActiveDate !== yesterday) state.player.tasksToday = 0;
  state.player.streak = (state.player.lastActiveDate === yesterday)
    ? (state.player.streak ?? 0) + 1 : 0;
  state.player.lastActiveDate = today;
  saveState();
}

// ─── Default quests ───────────────────────────────────────────────────────────
function defaultQuests() {
  return [
    {
      id: makeId('q'), title: 'Kitchen Conquest', icon: '🍳',
      color: '#FF6B35', description: 'Transform your kitchen into a sparkling sanctuary',
      tasks: [
        makeTask('Wipe down counters & stovetop'),
        makeTask('Clean the microwave inside & out'),
        makeTask('Scrub the sink until it shines'),
        makeTask('Mop the kitchen floor'),
        makeTask('Organize the pantry shelves'),
        makeTask('Empty & clean the trash bin'),
      ],
    },
    {
      id: makeId('q'), title: 'Living Room Legend', icon: '🛋️',
      color: '#9B5DE5', description: 'Make your living room the ultimate cozy zone',
      tasks: [
        makeTask('Vacuum or sweep all floors'),
        makeTask('Dust all surfaces & shelves'),
        makeTask('Organize cables & remotes'),
        makeTask('Fluff & arrange all cushions'),
        makeTask('Clear clutter from coffee table'),
        makeTask('Wipe down windows & mirrors'),
      ],
    },
    {
      id: makeId('q'), title: 'Laundry Mastery', icon: '👕',
      color: '#00BBF9', description: 'Conquer the laundry pile once and for all',
      tasks: [
        makeTask('Sort clothes by color & fabric'),
        makeTask('Run wash cycles'),
        makeTask('Dry, fold & hang everything'),
        makeTask('Put away all clean clothes'),
        makeTask('Clean the washing machine drum'),
      ],
    },
    {
      id: makeId('q'), title: 'Bathroom Blitz', icon: '🚿',
      color: '#F15BB5', description: 'Blast through bathroom chores like a champion',
      tasks: [
        makeTask('Scrub & disinfect the toilet'),
        makeTask('Clean the sink & mirror'),
        makeTask('Scrub the shower or bathtub'),
        makeTask('Mop the bathroom floor'),
        makeTask('Restock toiletries & towels'),
        makeTask('Empty the bathroom trash'),
      ],
    },
  ];
}

// ─── Render: pet ──────────────────────────────────────────────────────────────
function renderPet() {
  const health  = homeHealth();
  const mood    = getMood(health);
  const section = document.getElementById('petSection');

  document.getElementById('petHouse').textContent      = mood.emoji;
  document.getElementById('petMoodLabel').textContent  = mood.label;
  document.getElementById('petHealthFill').style.width = health + '%';
  document.getElementById('petHealthFill').style.background = mood.barColor;
  document.getElementById('petHealthPct').textContent  = health + '%';

  // Refresh message only on mood change
  if (section.dataset.mood !== mood.label) {
    document.getElementById('petMessage').textContent = pickMsg(mood);
    section.dataset.mood = mood.label;
  }

  // Crisis shake
  if (mood.label === 'In Crisis!') {
    const el = document.getElementById('petHouse');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

function bouncePet() {
  const el = document.getElementById('petHouse');
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');
}

// ─── Render: stats ────────────────────────────────────────────────────────────
function renderStats() {
  const sparkling = state.quests.filter(q => questHealth(q) >= 85).length;
  document.getElementById('statToday').textContent     = state.player.tasksToday ?? 0;
  document.getElementById('statStreak').textContent    = state.player.streak     ?? 0;
  document.getElementById('statSparkling').textContent = sparkling;
}

// ─── Render: quest grid ───────────────────────────────────────────────────────
function renderGrid() {
  const grid  = document.getElementById('questsGrid');
  const empty = document.getElementById('emptyState');

  if (!state.quests.length) {
    grid.style.display = 'none';
    empty.classList.add('visible');
    return;
  }
  grid.style.display = '';
  empty.classList.remove('visible');
  grid.innerHTML = state.quests.map(questCardHtml).join('');
  state.quests.forEach(q => {
    document.getElementById('card_' + q.id)?.addEventListener('click', () => openTaskModal(q.id));
  });
}

function questCardHtml(quest) {
  const health = questHealth(quest);
  const total  = quest.tasks.length;
  const fresh  = quest.tasks.filter(isTaskFresh).length;
  const pct    = total ? Math.round(fresh / total * 100) : 0;
  const cond   = getRoomCond(health);
  const stale  = quest.tasks.filter(t => t.completed && !isTaskFresh(t)).length;

  return `
    <div class="quest-card" id="card_${quest.id}">
      <div class="room-stripe" style="background:${cond.color}"></div>
      <div class="quest-card-header">
        <div class="quest-icon-wrap" style="background:${rgba(quest.color, .12)}">${quest.icon}</div>
        <div class="quest-meta">
          <div class="quest-name">${escHtml(quest.title)}</div>
          <div class="room-condition-label" style="color:${cond.color}">${cond.label}</div>
        </div>
      </div>
      <div class="quest-card-body">
        <div class="quest-progress-track">
          <div class="quest-progress-fill" style="background:${cond.color};width:${pct}%"></div>
        </div>
        <div class="quest-progress-labels">
          <span>${fresh} / ${total} tasks fresh</span>
          ${stale > 0 ? `<span class="stale-count">↻ ${stale} need${stale > 1 ? '' : 's'} redo</span>` : `<span>${health}% healthy</span>`}
        </div>
        <button class="quest-cta" style="background:${quest.color}">
          Care for this room →
        </button>
      </div>
    </div>`;
}

// ─── Task modal ───────────────────────────────────────────────────────────────
function openTaskModal(questId) {
  activeQuestId = questId;
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return;

  document.getElementById('modalHero').style.background =
    `linear-gradient(135deg, ${quest.color}ee, ${quest.color}99)`;
  document.getElementById('modalHeroIcon').textContent  = quest.icon;
  document.getElementById('modalHeroTitle').textContent = quest.title;
  document.getElementById('modalHeroDesc').textContent  = quest.description || '';

  refreshProgress(quest);
  renderTaskList(quest);
  cancelAddTask();

  document.getElementById('taskOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  document.getElementById('taskOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function refreshProgress(quest) {
  const total  = quest.tasks.length;
  const fresh  = quest.tasks.filter(isTaskFresh).length;
  const health = questHealth(quest);
  const cond   = getRoomCond(health);
  const pct    = total ? Math.round(fresh / total * 100) : 0;

  document.getElementById('modalProgressFill').style.width = pct + '%';
  document.getElementById('modalTaskCount').textContent    = `${fresh} of ${total} tasks fresh`;
  document.getElementById('modalXPEarned').textContent     = cond.label;
}

function renderTaskList(quest) {
  const list = document.getElementById('taskList');
  if (!quest.tasks.length) {
    list.innerHTML = `<div style="text-align:center;color:#9A9ABF;padding:20px 0;font-weight:600">
      No tasks yet — add one below! 👇</div>`;
    return;
  }
  list.innerHTML = quest.tasks.map((t, i) => taskItemHtml(t, i, quest.color)).join('');
}

function taskItemHtml(task, i, questColor) {
  const fresh = isTaskFresh(task);
  const stale = task.completed && !fresh;

  let cls          = '';
  let checkStyle   = '';
  let checkContent = '';
  let badge        = '';

  if (fresh) {
    cls          = 'checked';
    checkContent = '✓';
    checkStyle   = `background:${questColor};border-color:${questColor}`;
  } else if (stale) {
    cls          = 'stale';
    checkContent = '↻';
    checkStyle   = 'border-color:#CC8800;color:#CC8800;background:rgba(204,136,0,.1)';
    badge        = '<div class="stale-badge">↻ Needs care</div>';
  }

  return `
    <div class="task-item ${cls}" id="task_${task.id}"
         style="animation-delay:${i * 35}ms"
         onclick="toggleTask('${task.id}')">
      <div class="task-checkbox" style="${checkStyle}">${checkContent}</div>
      <div class="task-text">${escHtml(task.text)}</div>
      ${badge}
    </div>`;
}

// ─── Core: toggle task ────────────────────────────────────────────────────────
function toggleTask(taskId) {
  const quest = state.quests.find(q => q.id === activeQuestId);
  const task  = quest?.tasks.find(t => t.id === taskId);
  if (!task) return;

  const wasFresh = isTaskFresh(task);

  if (!task.completed || !wasFresh) {
    // Care / re-fresh
    task.completed   = true;
    task.completedAt = Date.now();
    state.player.tasksToday = (state.player.tasksToday ?? 0) + 1;
    state.player.totalDone  = (state.player.totalDone  ?? 0) + 1;
    state.player.lastActiveDate = new Date().toDateString();

    // Animate the item
    const el  = document.getElementById('task_' + taskId);
    const box = el?.querySelector('.task-checkbox');
    if (el && box) {
      el.classList.remove('stale');
      el.classList.add('checked');
      box.textContent  = '✓';
      box.style.cssText = `background:${quest.color};border-color:${quest.color}`;
      el.querySelector('.stale-badge')?.remove();
      showCareFloat(el);
    }

    bouncePet();

    // All tasks fresh → sparkling!
    if (quest.tasks.every(isTaskFresh)) {
      setTimeout(() => questSparkling(quest), 350);
    }

  } else {
    // Un-care
    task.completed   = false;
    task.completedAt = null;
    state.player.tasksToday = Math.max(0, (state.player.tasksToday ?? 0) - 1);

    const el  = document.getElementById('task_' + taskId);
    const box = el?.querySelector('.task-checkbox');
    if (el && box) {
      el.classList.remove('checked');
      box.textContent  = '';
      box.style.cssText = '';
    }
  }

  saveState();
  refreshProgress(quest);
  renderPet();
  renderStats();
  renderGrid();
}

// ─── Add task ─────────────────────────────────────────────────────────────────
function toggleAddTaskForm() {
  const form   = document.getElementById('addTaskForm');
  const btn    = document.getElementById('btnAddTask');
  const isOpen = form.style.display !== 'none';
  if (isOpen) {
    cancelAddTask();
  } else {
    form.style.display = 'block';
    btn.innerHTML  = '<span class="plus-icon">✕</span> Cancel';
    btn.style.cssText = 'border-color:#EF233C;color:#EF233C';
    document.getElementById('newTaskInput').focus();
  }
}

function cancelAddTask() {
  document.getElementById('addTaskForm').style.display = 'none';
  document.getElementById('newTaskInput').value = '';
  const btn = document.getElementById('btnAddTask');
  btn.innerHTML  = '<span class="plus-icon">+</span> Add a Task';
  btn.style.cssText = '';
}

function confirmAddTask() {
  const input = document.getElementById('newTaskInput');
  const text  = input.value.trim();
  if (!text) {
    input.classList.add('error');
    input.focus();
    setTimeout(() => input.classList.remove('error'), 800);
    return;
  }
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest) return;
  quest.tasks.push(makeTask(text));
  saveState();
  cancelAddTask();
  renderTaskList(quest);
  refreshProgress(quest);
  renderGrid();
}

// ─── New quest modal ──────────────────────────────────────────────────────────
function openNewQuestModal() {
  selectedIcon = '🏠'; selectedColor = '#FF6B35';
  document.getElementById('newQuestName').value = '';
  document.getElementById('newQuestDesc').value = '';
  document.querySelectorAll('.icon-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.icon === selectedIcon));
  document.querySelectorAll('.color-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.color === selectedColor));
  document.getElementById('newQuestOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('newQuestName').focus(), 360);
}

function closeNewQuestModal() {
  document.getElementById('newQuestOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function saveNewQuest() {
  const nameEl = document.getElementById('newQuestName');
  const name   = nameEl.value.trim();
  if (!name) {
    nameEl.classList.add('error');
    nameEl.focus();
    setTimeout(() => nameEl.classList.remove('error'), 800);
    return;
  }
  const quest = {
    id: makeId('q'), title: name,
    description: document.getElementById('newQuestDesc').value.trim() || 'Complete all tasks to care for this room!',
    icon: selectedIcon, color: selectedColor, tasks: [],
  };
  state.quests.push(quest);
  saveState();
  closeNewQuestModal();
  renderGrid();
  setTimeout(() => openTaskModal(quest.id), 360);
}

// ─── Celebrations ─────────────────────────────────────────────────────────────
function questSparkling(quest) {
  confetti({
    particleCount: 90, spread: 70, origin: { y: 0.55 },
    colors: [quest.color, '#52B788', '#FFB627', '#fff'],
    shapes: ['star', 'circle'],
  });
  showToast(`✨ ${quest.title} is Sparkling!`, '#2D9C62');
  renderGrid();
  refreshProgress(quest);
}

function showToast(msg, color) {
  const el = document.createElement('div');
  el.className = 'quest-toast';
  el.style.background = color;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s, transform .4s';
    el.style.opacity    = '0';
    el.style.transform  = 'translateX(-50%) translateY(50px)';
    setTimeout(() => el.remove(), 420);
  }, 3200);
}

function showCareFloat(element) {
  const rect = element.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const el       = document.createElement('div');
      el.className   = 'care-float';
      el.textContent = CARE_EMOJIS[Math.floor(Math.random() * CARE_EMOJIS.length)];
      el.style.left  = (rect.left + 16 + Math.random() * Math.max(0, rect.width - 32)) + 'px';
      el.style.top   = rect.top + 'px';
      document.getElementById('careFloats').appendChild(el);
      setTimeout(() => el.remove(), 1050);
    }, i * 110);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderPet();
  renderStats();
  renderGrid();

  document.getElementById('btnNewQuest').addEventListener('click', openNewQuestModal);

  document.getElementById('taskOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });
  document.getElementById('newQuestOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewQuestModal();
  });

  document.getElementById('iconGrid').addEventListener('click', e => {
    const b = e.target.closest('.icon-btn');
    if (!b) return;
    document.querySelectorAll('.icon-btn').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    selectedIcon = b.dataset.icon;
  });

  document.getElementById('colorGrid').addEventListener('click', e => {
    const b = e.target.closest('.color-btn');
    if (!b) return;
    document.querySelectorAll('.color-btn').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    selectedColor = b.dataset.color;
  });

  document.getElementById('newTaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddTask();
    if (e.key === 'Escape') cancelAddTask();
  });
  document.getElementById('newQuestName').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNewQuest();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('taskOverlay').classList.contains('open'))     closeTaskModal();
    if (document.getElementById('newQuestOverlay').classList.contains('open')) closeNewQuestModal();
  });
});
