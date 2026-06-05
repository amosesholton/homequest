'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY    = 'homequest_v1';
const COMBO_WINDOW   = 3 * 60 * 1000; // 3-minute combo window
const DECAY_RATE     = 0.9;            // 10% XP lost per day

const LEVEL_TITLES = [
  'Rookie Tidier',
  'Apprentice Cleaner',
  'Tidy Adventurer',
  'Cleaning Warrior',
  'Organized Champion',
  'Master of Chores',
  'Legendary Homekeeper',
  'Grand Keeper of the Realm',
];

// Combo multiplier tiers (highest first)
const COMBO_TIERS = [
  { min: 10, mult: 3.0,  label: '×3',    fire: '🔥🔥🔥', color: '#EF233C' },
  { min: 7,  mult: 2.5,  label: '×2.5',  fire: '🔥🔥🔥', color: '#FF6B35' },
  { min: 5,  mult: 2.0,  label: '×2',    fire: '🔥🔥',   color: '#FFB627' },
  { min: 3,  mult: 1.5,  label: '×1.5',  fire: '🔥🔥',   color: '#9B5DE5' },
  { min: 2,  mult: 1.25, label: '×1.25', fire: '🔥',     color: '#52B788' },
];

// ─── Default quest data ────────────────────────────────────────────────────────
function makeId(p) {
  return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/** xpMin/xpMax define the mystery reward range. createdAt drives decay. */
function makeTask(text, xpMin, xpMax) {
  return { id: makeId('t'), text, xpMin, xpMax, createdAt: Date.now(), completed: false, xpAwarded: null };
}

function defaultQuests() {
  return [
    {
      id: makeId('q'), title: 'Kitchen Conquest', icon: '🍳',
      color: '#FF6B35', description: 'Transform your kitchen into a sparkling sanctuary',
      completed: false, tasks: [
        makeTask('Wipe down counters & stovetop',    10, 22),
        makeTask('Clean the microwave inside & out', 14, 28),
        makeTask('Scrub the sink until it shines',    7, 15),
        makeTask('Mop the kitchen floor',            18, 35),
        makeTask('Organize the pantry shelves',      22, 42),
        makeTask('Empty & clean the trash bin',       7, 15),
      ],
    },
    {
      id: makeId('q'), title: 'Living Room Legend', icon: '🛋️',
      color: '#9B5DE5', description: 'Make your living room the ultimate cozy zone',
      completed: false, tasks: [
        makeTask('Vacuum or sweep all floors',        14, 28),
        makeTask('Dust all surfaces & shelves',       10, 22),
        makeTask('Organize cables & remotes',          7, 15),
        makeTask('Fluff & arrange all cushions',       3,  8),
        makeTask('Clear clutter from coffee table',    7, 15),
        makeTask('Wipe down windows & mirrors',       14, 28),
      ],
    },
    {
      id: makeId('q'), title: 'Laundry Mastery', icon: '👕',
      color: '#00BBF9', description: 'Conquer the laundry pile once and for all',
      completed: false, tasks: [
        makeTask('Sort clothes by color & fabric',    7, 15),
        makeTask('Run wash cycles',                  10, 22),
        makeTask('Dry, fold & hang everything',      18, 35),
        makeTask('Put away all clean clothes',       14, 28),
        makeTask('Clean the washing machine drum',   10, 22),
      ],
    },
    {
      id: makeId('q'), title: 'Bathroom Blitz', icon: '🚿',
      color: '#F15BB5', description: 'Blast through bathroom chores like a champion',
      completed: false, tasks: [
        makeTask('Scrub & disinfect the toilet',     18, 35),
        makeTask('Clean the sink & mirror',          10, 22),
        makeTask('Scrub the shower or bathtub',      18, 35),
        makeTask('Mop the bathroom floor',           10, 22),
        makeTask('Restock toiletries & towels',       7, 15),
        makeTask('Empty the bathroom trash',          3,  8),
      ],
    },
  ];
}

// ─── State ─────────────────────────────────────────────────────────────────────
let state = {
  player: { totalXP: 0, tasksCompleted: 0, questsCompleted: 0, streak: 0, lastActiveDate: null },
  quests: [],
  combo:  { count: 0, lastTaskTime: 0 },
};

let activeQuestId      = null;
let selectedIcon       = '🏠';
let selectedColor      = '#FF6B35';
let comboTimerInterval = null;

// ─── Persistence ───────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
      if (!state.combo) state.combo = { count: 0, lastTaskTime: 0 };
      migrateTasks();
    } else {
      state.quests = defaultQuests();
    }
  } catch {
    state.quests = defaultQuests();
  }
  updateStreak();
}

/** Upgrade tasks from old flat-xp format to xpMin/xpMax + createdAt */
function migrateTasks() {
  for (const quest of state.quests) {
    for (const task of quest.tasks) {
      if (task.xp != null && task.xpMin == null) {
        task.xpMin = Math.round(task.xp * 0.6);
        task.xpMax = Math.round(task.xp * 1.4);
        if (task.completed && task.xpAwarded == null) task.xpAwarded = task.xp;
        delete task.xp;
      }
      if (!task.createdAt) task.createdAt = Date.now();
      if (task.xpAwarded === undefined) task.xpAwarded = null;
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Streak ────────────────────────────────────────────────────────────────────
function updateStreak() {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (state.player.lastActiveDate === today) return;
  state.player.streak = (state.player.lastActiveDate === yesterday)
    ? (state.player.streak || 0) + 1 : 1;
  state.player.lastActiveDate = today;
  saveState();
}

// ─── XP / Level ────────────────────────────────────────────────────────────────
function levelThreshold(level) { return level * 150; }

function calcLevel(xp) {
  let level = 1;
  while (xp >= levelThreshold(level)) { xp -= levelThreshold(level); level++; }
  return level;
}

function calcXPInLevel(xp) {
  let level = 1;
  while (xp >= levelThreshold(level)) { xp -= levelThreshold(level); level++; }
  return xp;
}

function levelTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

// ─── Decay ─────────────────────────────────────────────────────────────────────
function decayFactor(task) {
  if (!task.createdAt) return 1;
  const days = (Date.now() - task.createdAt) / 86_400_000;
  return Math.max(0.1, Math.pow(DECAY_RATE, days));
}

function decayedRange(task) {
  const f = decayFactor(task);
  const min = Math.max(1, Math.round((task.xpMin || 5)  * f));
  const max = Math.max(2, Math.round((task.xpMax || 10) * f));
  const pct = Math.round((1 - f) * 100);
  return { min, max, pct };
}

/** 'fresh' | 'mild' | 'moderate' | 'heavy' */
function decayLevel(pct) {
  if (pct <  5) return 'fresh';
  if (pct < 20) return 'mild';
  if (pct < 50) return 'moderate';
  return 'heavy';
}

// ─── Combo ─────────────────────────────────────────────────────────────────────
function getComboTier(count) {
  for (const t of COMBO_TIERS) if (count >= t.min) return t;
  return null;
}

function startComboTimer() {
  clearInterval(comboTimerInterval);
  comboTimerInterval = setInterval(() => {
    const elapsed = Date.now() - state.combo.lastTaskTime;
    if (elapsed >= COMBO_WINDOW) {
      state.combo.count = 0;
      state.combo.lastTaskTime = 0;
      saveState();
      clearInterval(comboTimerInterval);
    }
    updateComboHUD();
  }, 500);
}

function updateComboHUD() {
  const hud = document.getElementById('comboHUD');
  if (!hud) return;

  const tier      = getComboTier(state.combo.count);
  const elapsed   = state.combo.lastTaskTime ? Date.now() - state.combo.lastTaskTime : COMBO_WINDOW;
  const remaining = Math.max(0, COMBO_WINDOW - elapsed);
  const pct       = (remaining / COMBO_WINDOW) * 100;

  if (!tier) {
    hud.classList.remove('active');
    return;
  }

  hud.classList.add('active');
  hud.style.setProperty('--cc', tier.color);

  document.getElementById('hudFire').textContent  = tier.fire;
  document.getElementById('hudMult').textContent  = tier.label;
  document.getElementById('hudCount').textContent = `${state.combo.count} in a row!`;

  const fill = document.getElementById('hudTimerFill');
  fill.style.width      = pct + '%';
  fill.style.background = pct < 25 ? '#EF233C' : tier.color;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function bump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ─── XP Badge HTML ─────────────────────────────────────────────────────────────
function xpBadgeHtml(task, questColor) {
  // Already completed — show what was actually awarded
  if (task.completed && task.xpAwarded != null) {
    return `<div class="xp-badge awarded"
      style="background:${rgba('#52B788',.15)};color:#52B788">
      +${task.xpAwarded}&nbsp;XP
    </div>`;
  }

  // Pending — show mystery range with decay coloring
  const { min, max, pct } = decayedRange(task);
  const level = decayLevel(pct);

  let icon  = '🎲';
  let color = questColor;
  if (level === 'moderate') { icon = '⚠️'; color = '#CC8800'; }
  if (level === 'heavy')    { icon = '⚠️'; color = '#EF233C'; }

  const hint = pct >= 5
    ? `<span class="decay-pct"> ▾${pct}%</span>`
    : '';

  const title = pct > 0
    ? `Decayed ${pct}% — originally ${task.xpMin}–${task.xpMax} XP`
    : 'Mystery reward! Complete to find out.';

  return `<div class="xp-badge mystery ${level}"
    style="background:${rgba(color,.12)};color:${color}"
    title="${title}">
    ${icon}&nbsp;${min}–${max}${hint}
  </div>`;
}

// ─── Render ────────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderStats();
  renderGrid();
  updateComboHUD();
}

function renderHeader() {
  const level = calcLevel(state.player.totalXP);
  const xpIn  = calcXPInLevel(state.player.totalXP);
  const thresh = levelThreshold(level);
  document.getElementById('playerLevel').textContent = level;
  document.getElementById('playerTitle').textContent = levelTitle(level);
  document.getElementById('xpFill').style.width      = Math.round(xpIn / thresh * 100) + '%';
  document.getElementById('xpNums').textContent      = `${xpIn} / ${thresh} XP`;
}

function renderStats() {
  document.getElementById('statXP').textContent     = state.player.totalXP.toLocaleString();
  document.getElementById('statTasks').textContent  = state.player.tasksCompleted;
  document.getElementById('statQuests').textContent = state.player.questsCompleted;
  document.getElementById('statStreak').textContent = state.player.streak;
}

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
    const el = document.getElementById('card_' + q.id);
    if (el) el.addEventListener('click', () => openTaskModal(q.id));
  });
}

function questCardHtml(quest) {
  const total    = quest.tasks.length;
  const done     = quest.tasks.filter(t => t.completed).length;
  const pct      = total ? Math.round(done / total * 100) : 0;
  const earnedXP = quest.tasks.filter(t => t.completed && t.xpAwarded != null)
                              .reduce((s, t) => s + t.xpAwarded, 0);

  // Potential XP = midpoint of each pending task's decayed range
  const potXP = quest.tasks.filter(t => !t.completed).reduce((s, t) => {
    const { min, max } = decayedRange(t);
    return s + Math.round((min + max) / 2);
  }, 0);

  const isComplete   = total > 0 && done === total;
  const decayingTasks = quest.tasks.filter(t => !t.completed && decayedRange(t).pct >= 20).length;

  return `
    <div class="quest-card ${isComplete ? 'completed' : ''}" id="card_${quest.id}">
      ${isComplete ? '<div class="complete-badge">🏆 Complete</div>' : ''}
      ${decayingTasks > 0 && !isComplete
        ? `<div class="decay-card-badge">⚠️ ${decayingTasks} task${decayingTasks > 1 ? 's' : ''} losing XP</div>`
        : ''}
      <div class="quest-card-header">
        <div class="quest-icon-wrap" style="background:${rgba(quest.color,.13)}">${quest.icon}</div>
        <div class="quest-meta">
          <div class="quest-name">${escHtml(quest.title)}</div>
          <div class="quest-desc">${escHtml(quest.description || 'Click to view tasks')}</div>
        </div>
      </div>
      <div class="quest-card-body">
        <div class="quest-progress-track">
          <div class="quest-progress-fill" style="background:${quest.color};width:${pct}%"></div>
        </div>
        <div class="quest-progress-labels">
          <span>${done} / ${total} tasks</span>
          <span>${earnedXP > 0 ? `+${earnedXP} XP earned` : `~${potXP} XP available`}</span>
        </div>
        <button class="quest-cta" style="background:${isComplete ? '#52B788' : quest.color}">
          ${isComplete ? '🏆 Completed!' : 'View Tasks →'}
        </button>
      </div>
    </div>`;
}

// ─── Task Modal ────────────────────────────────────────────────────────────────
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
  const done     = quest.tasks.filter(t => t.completed).length;
  const total    = quest.tasks.length;
  const earned   = quest.tasks.filter(t => t.completed && t.xpAwarded != null)
                              .reduce((s, t) => s + t.xpAwarded, 0);
  document.getElementById('modalProgressFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  document.getElementById('modalTaskCount').textContent    = `${done} of ${total} tasks`;
  document.getElementById('modalXPEarned').textContent     = `+${earned} XP earned`;
}

function renderTaskList(quest) {
  const list = document.getElementById('taskList');
  if (!quest.tasks.length) {
    list.innerHTML = `<div style="text-align:center;color:#9A9ABF;padding:20px 0;font-weight:600;font-size:.9rem">
      No tasks yet — add one below! 👇</div>`;
    return;
  }
  list.innerHTML = quest.tasks.map((task, i) => `
    <div class="task-item ${task.completed ? 'checked' : ''}"
         id="task_${task.id}"
         style="animation-delay:${i * 35}ms"
         onclick="toggleTask('${task.id}')">
      <div class="task-checkbox">${task.completed ? '✓' : ''}</div>
      <div class="task-text">${escHtml(task.text)}</div>
      ${xpBadgeHtml(task, quest.color)}
    </div>`).join('');
}

// ─── Core: toggle task ─────────────────────────────────────────────────────────
function toggleTask(taskId) {
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest) return;
  const task = quest.tasks.find(t => t.id === taskId);
  if (!task) return;

  const prevLevel = calcLevel(state.player.totalXP);
  task.completed = !task.completed;

  if (task.completed) {
    // ── 1. Variable reward ──────────────────────────────────
    const { min, max } = decayedRange(task);
    const rawXP = min + Math.floor(Math.random() * (max - min + 1));

    // ── 2. Combo multiplier ─────────────────────────────────
    const now = Date.now();
    state.combo.count = (state.combo.lastTaskTime && now - state.combo.lastTaskTime < COMBO_WINDOW)
      ? state.combo.count + 1 : 1;
    state.combo.lastTaskTime = now;

    const tier   = getComboTier(state.combo.count);
    const mult   = tier ? tier.mult : 1;
    const finalXP = Math.round(rawXP * mult);

    task.xpAwarded = finalXP;
    state.player.totalXP        += finalXP;
    state.player.tasksCompleted += 1;
    state.player.lastActiveDate  = new Date().toDateString();
    saveState();

    // ── DOM animation ───────────────────────────────────────
    const el  = document.getElementById('task_' + taskId);
    const box = el?.querySelector('.task-checkbox');
    if (el && box) {
      el.classList.add('checked');
      box.textContent = '✓';

      // Phase 1: rolling suspense
      const badge = el.querySelector('.xp-badge');
      if (badge) {
        badge.className = 'xp-badge rolling';
        badge.style = '';
        badge.innerHTML = '🎲&nbsp;…';

        // Phase 2: reveal after 650ms
        setTimeout(() => {
          if (!document.getElementById('task_' + taskId)) return;
          badge.className = 'xp-badge awarded reveal-pop';
          badge.style.background = rgba('#52B788', .15);
          badge.style.color      = '#52B788';
          badge.innerHTML = `+${finalXP}&nbsp;XP${tier ? ' ' + tier.fire : ''}`;
          showXPFloat(el, finalXP, tier);
        }, 650);
      }
    }

    // ── Level up? ───────────────────────────────────────────
    const newLevel = calcLevel(state.player.totalXP);
    if (newLevel > prevLevel) setTimeout(() => showLevelUp(newLevel), 1300);

    // ── Quest complete? ─────────────────────────────────────
    if (!quest.completed && quest.tasks.every(t => t.completed)) {
      quest.completed = true;
      state.player.questsCompleted += 1;
      saveState();
      setTimeout(() => questComplete(quest), 350);
    }

    updateComboHUD();
    startComboTimer();

  } else {
    // ── Uncomplete ──────────────────────────────────────────
    const wasXP = task.xpAwarded || 0;
    task.xpAwarded = null;
    state.player.totalXP        = Math.max(0, state.player.totalXP - wasXP);
    state.player.tasksCompleted = Math.max(0, state.player.tasksCompleted - 1);
    if (quest.completed) {
      quest.completed = false;
      state.player.questsCompleted = Math.max(0, state.player.questsCompleted - 1);
    }
    // Uncompleting breaks the combo
    state.combo.count = Math.max(0, state.combo.count - 1);
    saveState();

    const el  = document.getElementById('task_' + taskId);
    const box = el?.querySelector('.task-checkbox');
    if (el && box) {
      el.classList.remove('checked');
      box.textContent = '';
      // Restore mystery badge
      const badge = el.querySelector('.xp-badge');
      if (badge) badge.outerHTML = xpBadgeHtml(task, quest.color);
    }
    updateComboHUD();
  }

  refreshProgress(quest);
  renderHeader();
  renderStats();
  bump('statXP');
  bump('statTasks');
  renderGrid();
}

// ─── Add task ──────────────────────────────────────────────────────────────────
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
  // Parse "min-max" from select value, e.g. "7-15"
  const [xpMin, xpMax] = document.getElementById('newTaskXP').value.split('-').map(Number);
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest) return;

  quest.tasks.push({ id: makeId('t'), text, xpMin, xpMax, createdAt: Date.now(), completed: false, xpAwarded: null });
  if (quest.completed) {
    quest.completed = false;
    state.player.questsCompleted = Math.max(0, state.player.questsCompleted - 1);
  }
  saveState();
  cancelAddTask();
  renderTaskList(quest);
  refreshProgress(quest);
  renderGrid();
}

// ─── New Quest Modal ───────────────────────────────────────────────────────────
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
    description: document.getElementById('newQuestDesc').value.trim() || 'Complete all tasks to win!',
    icon: selectedIcon, color: selectedColor, completed: false, tasks: [],
  };
  state.quests.push(quest);
  saveState();
  closeNewQuestModal();
  renderGrid();
  setTimeout(() => openTaskModal(quest.id), 360);
}

// ─── Celebrations ──────────────────────────────────────────────────────────────
function questComplete(quest) {
  const colors = [quest.color, '#FFB627', '#FF6B35', '#52B788', '#fff'];
  const end    = Date.now() + 2800;
  (function frame() {
    confetti({ particleCount: 5, angle: 60,  spread: 58, origin: { x: 0 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 58, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  showToast(`🏆 Quest Complete: ${quest.title}!`, quest.color);
  bump('statQuests');
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
  }, 3400);
}

function showXPFloat(element, xp, tier) {
  const rect  = element.getBoundingClientRect();
  const el    = document.createElement('div');
  el.className   = 'xp-float';
  const bonus    = tier ? ` ${tier.fire}${tier.label}` : '';
  el.textContent = `+${xp} XP${bonus}`;
  el.style.left  = (rect.left + rect.width / 2 - 30) + 'px';
  el.style.top   = (rect.top - 2) + 'px';
  document.getElementById('xpFloats').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function showLevelUp(level) {
  document.getElementById('levelUpNum').textContent       = level;
  document.getElementById('levelUpTitleText').textContent = levelTitle(level);
  document.getElementById('levelUpOverlay').classList.add('open');
  confetti({ particleCount: 120, spread: 80, origin: { y: .55 },
    colors: ['#FF6B35','#FFB627','#9B5DE5','#52B788','#F15BB5'] });
}

function closeLevelUp() {
  document.getElementById('levelUpOverlay').classList.remove('open');
}

// ─── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderAll();

  // Resume combo timer if still within window after a reload
  if (state.combo.count >= 2 && state.combo.lastTaskTime) {
    if (Date.now() - state.combo.lastTaskTime < COMBO_WINDOW) {
      startComboTimer();
    } else {
      state.combo.count = 0; state.combo.lastTaskTime = 0; saveState();
    }
  }

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
    if (document.getElementById('levelUpOverlay').classList.contains('open'))  closeLevelUp();
  });
});
