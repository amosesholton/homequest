'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'homequest_v1';

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

// ─── Default quest data ────────────────────────────────────────────────────────
function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function makeTask(text, xp) {
  return { id: makeId('t'), text, xp, completed: false };
}

function defaultQuests() {
  return [
    {
      id: makeId('q'), title: 'Kitchen Conquest', icon: '🍳',
      color: '#FF6B35', description: 'Transform your kitchen into a sparkling sanctuary',
      completed: false,
      tasks: [
        makeTask('Wipe down counters & stovetop', 15),
        makeTask('Clean the microwave inside & out', 20),
        makeTask('Scrub the sink until it shines', 10),
        makeTask('Mop the kitchen floor', 25),
        makeTask('Organize the pantry shelves', 30),
        makeTask('Empty & clean the trash bin', 10),
      ],
    },
    {
      id: makeId('q'), title: 'Living Room Legend', icon: '🛋️',
      color: '#9B5DE5', description: 'Make your living room the ultimate cozy zone',
      completed: false,
      tasks: [
        makeTask('Vacuum or sweep all floors', 20),
        makeTask('Dust all surfaces & shelves', 15),
        makeTask('Organize cables & remotes', 10),
        makeTask('Fluff & arrange all cushions', 5),
        makeTask('Clear clutter from coffee table', 10),
        makeTask('Wipe down windows & mirrors', 20),
      ],
    },
    {
      id: makeId('q'), title: 'Laundry Mastery', icon: '👕',
      color: '#00BBF9', description: 'Conquer the laundry pile once and for all',
      completed: false,
      tasks: [
        makeTask('Sort clothes by color & fabric', 10),
        makeTask('Run wash cycles', 15),
        makeTask('Dry, fold & hang everything', 25),
        makeTask('Put away all clean clothes', 20),
        makeTask('Clean the washing machine drum', 15),
      ],
    },
    {
      id: makeId('q'), title: 'Bathroom Blitz', icon: '🚿',
      color: '#F15BB5', description: 'Blast through bathroom chores like a champion',
      completed: false,
      tasks: [
        makeTask('Scrub & disinfect the toilet', 25),
        makeTask('Clean the sink & mirror', 15),
        makeTask('Scrub the shower or bathtub', 25),
        makeTask('Mop the bathroom floor', 15),
        makeTask('Restock toiletries & towels', 10),
        makeTask('Empty the bathroom trash', 5),
      ],
    },
  ];
}

// ─── State ─────────────────────────────────────────────────────────────────────
let state = {
  player: { totalXP: 0, tasksCompleted: 0, questsCompleted: 0, streak: 0, lastActiveDate: null },
  quests: [],
};

let activeQuestId = null;
let selectedIcon   = '🏠';
let selectedColor  = '#FF6B35';

// ─── Persistence ───────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
    } else {
      state.quests = defaultQuests();
    }
  } catch {
    state.quests = defaultQuests();
  }
  updateStreak();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Streak ────────────────────────────────────────────────────────────────────
function updateStreak() {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  if (state.player.lastActiveDate === today) return;

  if (state.player.lastActiveDate === yesterday) {
    state.player.streak = (state.player.streak || 0) + 1;
  } else {
    state.player.streak = 1;
  }
  state.player.lastActiveDate = today;
  saveState();
}

// ─── XP / level helpers ────────────────────────────────────────────────────────
function levelThreshold(level) { return level * 150; }

function calcLevel(totalXP) {
  let xp = totalXP, level = 1;
  while (xp >= levelThreshold(level)) { xp -= levelThreshold(level); level++; }
  return level;
}

function calcXPInLevel(totalXP) {
  let xp = totalXP, level = 1;
  while (xp >= levelThreshold(level)) { xp -= levelThreshold(level); level++; }
  return xp;
}

function levelTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function bump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth; // reflow
  el.classList.add('bump');
}

// ─── Render ────────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderStats();
  renderGrid();
}

function renderHeader() {
  const level      = calcLevel(state.player.totalXP);
  const xpIn       = calcXPInLevel(state.player.totalXP);
  const threshold  = levelThreshold(level);
  const pct        = Math.round((xpIn / threshold) * 100);

  document.getElementById('playerLevel').textContent = level;
  document.getElementById('playerTitle').textContent = levelTitle(level);
  document.getElementById('xpFill').style.width      = pct + '%';
  document.getElementById('xpNums').textContent      = `${xpIn} / ${threshold} XP`;
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
    const card = document.getElementById('card_' + q.id);
    if (card) card.addEventListener('click', () => openTaskModal(q.id));
  });
}

function questCardHtml(quest) {
  const total    = quest.tasks.length;
  const done     = quest.tasks.filter(t => t.completed).length;
  const pct      = total ? Math.round((done / total) * 100) : 0;
  const totalXP  = quest.tasks.reduce((s, t) => s + t.xp, 0);
  const earnedXP = quest.tasks.filter(t => t.completed).reduce((s, t) => s + t.xp, 0);
  const complete = total > 0 && done === total;
  const iconBg   = hexAlpha(quest.color, 0.13);

  return `
    <div class="quest-card ${complete ? 'completed' : ''}" id="card_${quest.id}">
      ${complete ? '<div class="complete-badge">🏆 Complete</div>' : ''}
      <div class="quest-card-header">
        <div class="quest-icon-wrap" style="background:${iconBg}">
          ${quest.icon}
        </div>
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
          <span>${earnedXP} / ${totalXP} XP</span>
        </div>
        <button class="quest-cta"
                style="background:${complete ? '#52B788' : quest.color}">
          ${complete ? '🏆 Completed!' : 'View Tasks →'}
        </button>
      </div>
    </div>`;
}

// ─── Task modal ────────────────────────────────────────────────────────────────
function openTaskModal(questId) {
  activeQuestId = questId;
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return;

  document.getElementById('modalHero').style.background =
    `linear-gradient(135deg, ${quest.color}ee, ${quest.color}99)`;
  document.getElementById('modalHeroIcon').textContent  = quest.icon;
  document.getElementById('modalHeroTitle').textContent = quest.title;
  document.getElementById('modalHeroDesc').textContent  = quest.description || '';

  refreshModalProgress(quest);
  renderTaskList(quest);
  cancelAddTask();

  document.getElementById('taskOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  document.getElementById('taskOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function refreshModalProgress(quest) {
  const total    = quest.tasks.length;
  const done     = quest.tasks.filter(t => t.completed).length;
  const pct      = total ? Math.round((done / total) * 100) : 0;
  const earnedXP = quest.tasks.filter(t => t.completed).reduce((s, t) => s + t.xp, 0);

  document.getElementById('modalProgressFill').style.width = pct + '%';
  document.getElementById('modalTaskCount').textContent    = `${done} of ${total} tasks`;
  document.getElementById('modalXPEarned').textContent     = `+${earnedXP} XP earned`;
}

function renderTaskList(quest) {
  const list = document.getElementById('taskList');

  if (!quest.tasks.length) {
    list.innerHTML = `<div style="text-align:center;color:#9A9ABF;padding:20px 0;font-weight:600;font-size:0.9rem">
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
      <div class="task-xp-badge"
           style="background:${hexAlpha(quest.color, 0.12)};color:${quest.color}">
        +${task.xp}&nbsp;XP
      </div>
    </div>`).join('');
}

// ─── Toggle task ───────────────────────────────────────────────────────────────
function toggleTask(taskId) {
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest) return;
  const task = quest.tasks.find(t => t.id === taskId);
  if (!task) return;

  const prevLevel = calcLevel(state.player.totalXP);
  task.completed  = !task.completed;

  if (task.completed) {
    state.player.totalXP       += task.xp;
    state.player.tasksCompleted += 1;
    state.player.lastActiveDate  = new Date().toDateString();
  } else {
    state.player.totalXP        = Math.max(0, state.player.totalXP - task.xp);
    state.player.tasksCompleted = Math.max(0, state.player.tasksCompleted - 1);
    if (quest.completed) {
      quest.completed = false;
      state.player.questsCompleted = Math.max(0, state.player.questsCompleted - 1);
    }
  }

  saveState();

  // Animate DOM
  const el  = document.getElementById('task_' + taskId);
  const box = el?.querySelector('.task-checkbox');
  if (el && box) {
    el.classList.toggle('checked', task.completed);
    box.textContent = task.completed ? '✓' : '';
  }

  if (task.completed && el) {
    showXPFloat(el, task.xp);
  }

  // Level up?
  const newLevel = calcLevel(state.player.totalXP);
  if (task.completed && newLevel > prevLevel) {
    setTimeout(() => showLevelUp(newLevel), 550);
  }

  // Quest complete?
  if (task.completed && !quest.completed && quest.tasks.every(t => t.completed)) {
    quest.completed = true;
    state.player.questsCompleted += 1;
    saveState();
    setTimeout(() => questComplete(quest), 280);
  }

  refreshModalProgress(quest);
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
    btn.innerHTML = '<span class="plus-icon">✕</span> Cancel';
    btn.style.cssText = 'border-color:#EF233C;color:#EF233C';
    document.getElementById('newTaskInput').focus();
  }
}

function cancelAddTask() {
  document.getElementById('addTaskForm').style.display = 'none';
  document.getElementById('newTaskInput').value        = '';
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

  const xp    = parseInt(document.getElementById('newTaskXP').value, 10);
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest) return;

  quest.tasks.push({ id: makeId('t'), text, xp, completed: false });

  if (quest.completed) {
    quest.completed = false;
    state.player.questsCompleted = Math.max(0, state.player.questsCompleted - 1);
  }

  saveState();
  cancelAddTask();
  renderTaskList(quest);
  refreshModalProgress(quest);
  renderGrid();
}

// ─── New quest modal ───────────────────────────────────────────────────────────
function openNewQuestModal() {
  selectedIcon  = '🏠';
  selectedColor = '#FF6B35';

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

  const desc = document.getElementById('newQuestDesc').value.trim();
  const quest = {
    id: makeId('q'),
    title: name,
    description: desc || 'Complete all tasks to win this quest!',
    icon: selectedIcon,
    color: selectedColor,
    completed: false,
    tasks: [],
  };

  state.quests.push(quest);
  saveState();
  closeNewQuestModal();
  renderGrid();

  // Immediately open the new quest so user can add tasks
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
  refreshModalProgress(quest);
}

function showToast(msg, color) {
  const toast    = document.createElement('div');
  toast.className = 'quest-toast';
  toast.style.background = color;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(-50%) translateY(50px)';
    setTimeout(() => toast.remove(), 420);
  }, 3400);
}

function showXPFloat(element, xp) {
  const rect   = element.getBoundingClientRect();
  const float  = document.createElement('div');
  float.className   = 'xp-float';
  float.textContent = `+${xp} XP`;
  float.style.left  = (rect.left + rect.width / 2 - 28) + 'px';
  float.style.top   = (rect.top  - 2) + 'px';
  document.getElementById('xpFloats').appendChild(float);
  setTimeout(() => float.remove(), 1150);
}

function showLevelUp(level) {
  document.getElementById('levelUpNum').textContent       = level;
  document.getElementById('levelUpTitleText').textContent = levelTitle(level);
  document.getElementById('levelUpOverlay').classList.add('open');

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.55 },
    colors: ['#FF6B35', '#FFB627', '#9B5DE5', '#52B788', '#F15BB5'],
  });
}

function closeLevelUp() {
  document.getElementById('levelUpOverlay').classList.remove('open');
}

// ─── Wire up event listeners ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderAll();

  // New quest button
  document.getElementById('btnNewQuest').addEventListener('click', openNewQuestModal);

  // Close modals on backdrop click
  document.getElementById('taskOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTaskModal();
  });
  document.getElementById('newQuestOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNewQuestModal();
  });

  // Icon picker
  document.getElementById('iconGrid').addEventListener('click', e => {
    const btn = e.target.closest('.icon-btn');
    if (!btn) return;
    document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedIcon = btn.dataset.icon;
  });

  // Color picker
  document.getElementById('colorGrid').addEventListener('click', e => {
    const btn = e.target.closest('.color-btn');
    if (!btn) return;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedColor = btn.dataset.color;
  });

  // Keyboard shortcuts in add-task form
  document.getElementById('newTaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddTask();
    if (e.key === 'Escape') cancelAddTask();
  });

  // Keyboard shortcut in new-quest modal
  document.getElementById('newQuestName').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNewQuest();
  });

  // Global Escape closes open modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('taskOverlay').classList.contains('open'))     closeTaskModal();
    if (document.getElementById('newQuestOverlay').classList.contains('open')) closeNewQuestModal();
    if (document.getElementById('levelUpOverlay').classList.contains('open'))  closeLevelUp();
  });
});
