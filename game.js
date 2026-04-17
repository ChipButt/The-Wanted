(() => {
const hubScreen = document.getElementById('hubScreen');
const gameScreen = document.getElementById('gameScreen');
const startHeistBtn = document.getElementById('startHeistBtn');
const resetProgressBtn = document.getElementById('resetProgressBtn');
const backToHubBtn = document.getElementById('backToHubBtn');

const totalBankedEl = document.getElementById('totalBanked');
const bestHeistEl = document.getElementById('bestHeist');
const heistsPlayedEl = document.getElementById('heistsPlayed');
const paintingsStolenEl = document.getElementById('paintingsStolen');

const currentHaulEl = document.getElementById('currentHaul');
const strikeCountEl = document.getElementById('strikeCount');
const paintingsLeftEl = document.getElementById('paintingsLeft');

const questionModal = document.getElementById('questionModal');
const questionText = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const cancelAnswerBtn = document.getElementById('cancelAnswerBtn');

const summaryModal = document.getElementById('summaryModal');
const summaryTitle = document.getElementById('summaryTitle');
const summaryText = document.getElementById('summaryText');
const summaryContinueBtn = document.getElementById('summaryContinueBtn');

const messageBanner = document.getElementById('messageBanner');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const interactBtn = document.getElementById('interactBtn');
const joystickButtons = [...document.querySelectorAll('.joystick button')];

const STORAGE_KEY = 'nanaHeistSave_v4';

const ROOM = { x: 170, y: 150, w: 620, h: 340 };
const DOOR = { x: 445, y: 470, w: 70, h: 28 };
const GUARD_DOOR = { x: 748, y: 255, w: 26, h: 76 };

const PLAYER_SPRITE_SIZE = 36;
const GUARD_SIZE = 18;

const spriteFiles = {
  north: 'north.png',
  'north-east': 'north-east.png',
  east: 'east.png',
  'south-east': 'south-east.png',
  south: 'south.png',
  'south-west': 'south-west.png',
  west: 'west.png',
  'north-west': 'north-west.png'
};

const playerSprites = {};
let spritesLoaded = false;

function loadPlayerSprites() {
  let loadedCount = 0;
  const keys = Object.keys(spriteFiles);

  keys.forEach((dir) => {
    const img = new Image();
    img.onload = () => {
      loadedCount += 1;
      if (loadedCount === keys.length) spritesLoaded = true;
    };
    img.onerror = () => {
      console.warn(`Failed to load sprite: ${spriteFiles[dir]}`);
    };
    img.src = spriteFiles[dir];
    playerSprites[dir] = img;
  });
}

const state = {
  save: loadSave(),
  screen: 'hub',
  keys: { up: false, down: false, left: false, right: false },
  run: null,
  activePainting: null,
  currentTheme: null,
  player: {
    x: 480,
    y: 430,
    w: 18,
    h: 18,
    speed: 2.4,
    controlLocked: false,
    visible: true,
    direction: 'south'
  },
  guard: {
    x: 900,
    y: 320,
    w: GUARD_SIZE,
    h: GUARD_SIZE,
    active: false
  }
};

const themes = [
  {
    title: 'Blue Velvet Gallery',
    backWall: '#4a5d78',
    leftWall: '#38485f',
    rightWall: '#314157',
    floorTop: '#243142',
    floorBottom: '#1a2431',
    trim: '#9eb4d3',
    frame: '#ffffff',
    frameShadow: '#8ea0bb'
  },
  {
    title: 'Crimson Vault Museum',
    backWall: '#6d4d5b',
    leftWall: '#563946',
    rightWall: '#4d333f',
    floorTop: '#34202a',
    floorBottom: '#26161e',
    trim: '#d6a8b9',
    frame: '#ffffff',
    frameShadow: '#c78ea6'
  },
  {
    title: 'Emerald Wing Collection',
    backWall: '#52715e',
    leftWall: '#405948',
    rightWall: '#374d3d',
    floorTop: '#233629',
    floorBottom: '#18261d',
    trim: '#aed1ba',
    frame: '#ffffff',
    frameShadow: '#8db79b'
  }
];

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    totalBanked: 0,
    bestHeist: 0,
    heistsPlayed: 0,
    paintingsStolen: 0,
    usedQuestionIds: []
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
  renderHubStats();
}

function resetProgress() {
  state.save = {
    totalBanked: 0,
    bestHeist: 0,
    heistsPlayed: 0,
    paintingsStolen: 0,
    usedQuestionIds: []
  };
  saveProgress();
  showBanner('Progress reset.');
}

function formatMoney(pence) {
  return '£' + (pence / 100).toFixed(2);
}

function normalizeText(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function closeEnough(a, b) {
  if (a.length < 5 || b.length < 5) return false;
  const distance = levenshtein(a, b);
  return distance <= 1 || distance / Math.max(a.length, b.length) <= 0.15;
}

function isAnswerCorrect(input, question) {
  const cleanedInput = normalizeText(input);
  if (!cleanedInput) return false;
  const answers = question.answers.map(normalizeText);

  if (question.matchType === 'contains') {
    for (const ans of answers) {
      if (cleanedInput.includes(ans)) return true;
      if (closeEnough(cleanedInput, ans)) return true;
    }
    return false;
  }

  for (const ans of answers) {
    if (cleanedInput === ans) return true;
    if (closeEnough(cleanedInput, ans)) return true;
  }
  return false;
}

function renderHubStats() {
  totalBankedEl.textContent = formatMoney(state.save.totalBanked);
  bestHeistEl.textContent = formatMoney(state.save.bestHeist);
  heistsPlayedEl.textContent = String(state.save.heistsPlayed);
  paintingsStolenEl.textContent = String(state.save.paintingsStolen);
}

function showScreen(name) {
  state.screen = name;
  hubScreen.classList.toggle('active', name === 'hub');
  gameScreen.classList.toggle('active', name === 'game');
}

function showBanner(text) {
  messageBanner.textContent = text;
  messageBanner.classList.add('show');
  clearTimeout(showBanner._timer);
  showBanner._timer = setTimeout(() => {
    messageBanner.classList.remove('show');
    messageBanner.textContent = '';
  }, 3500);
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function selectQuestions(count) {
  let available = window.QUESTION_BANK.filter(q => !state.save.usedQuestionIds.includes(q.id));
  if (available.length < count) {
    state.save.usedQuestionIds = [];
    available = [...window.QUESTION_BANK];
  }
  return shuffle(available).slice(0, count);
}

function createPaintings(questions) {
  const slots = [
    { x: 255, y: 154, w: 56, h: 18 },
    { x: 370, y: 154, w: 56, h: 18 },
    { x: 485, y: 154, w: 56, h: 18 },
    { x: 600, y: 154, w: 56, h: 18 },

    { x: 250, y: 458, w: 56, h: 18 },
    { x: 365, y: 458, w: 56, h: 18 },
    { x: 595, y: 458, w: 56, h: 18 },
    { x: 710, y: 458, w: 56, h: 18 },

    { x: 186, y: 248, w: 18, h: 54 },
    { x: 756, y: 352, w: 18, h: 54 }
  ];

  return slots.map((slot, i) => ({
    ...slot,
    question: questions[i],
    status: 'available',
    id: 'painting-' + i
  }));
}

function startHeist() {
  const chosenQuestions = selectQuestions(10);
  state.currentTheme = themes[Math.floor(Math.random() * themes.length)];
  state.run = {
    haul: 0,
    strikes: 0,
    paintings: createPaintings(chosenQuestions),
    ended: false,
    escaped: false
  };

  state.player = {
    x: 480,
    y: 430,
    w: 18,
    h: 18,
    speed: 2.4,
    controlLocked: false,
    visible: true,
    direction: 'south'
  };

  state.guard = {
    x: GUARD_DOOR.x + 4,
    y: GUARD_DOOR.y + 28,
    w: GUARD_SIZE,
    h: GUARD_SIZE,
    active: false
  };

  updateRunStats();
  showScreen('game');
  showBanner('Heist started: ' + state.currentTheme.title);
}

function updateRunStats() {
  if (!state.run) return;
  currentHaulEl.textContent = formatMoney(state.run.haul);
  strikeCountEl.textContent = `${state.run.strikes} / 3`;
  paintingsLeftEl.textContent = String(state.run.paintings.filter(p => p.status === 'available').length);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tryMove(dx, dy) {
  const p = state.player;
  const minX = ROOM.x + 10;
  const maxX = ROOM.x + ROOM.w - 10 - p.w;
  const minY = ROOM.y + 28;
  const maxY = ROOM.y + ROOM.h - 10 - p.h;

  p.x = Math.max(minX, Math.min(maxX, p.x + dx));
  p.y = Math.max(minY, Math.min(maxY, p.y + dy));
}

function updatePlayerDirection(dx, dy) {
  if (dx === 0 && dy === 0) return;

  if (dy < 0 && dx === 0) state.player.direction = 'north';
  else if (dy > 0 && dx === 0) state.player.direction = 'south';
  else if (dx > 0 && dy === 0) state.player.direction = 'east';
  else if (dx < 0 && dy === 0) state.player.direction = 'west';
  else if (dx > 0 && dy < 0) state.player.direction = 'north-east';
  else if (dx < 0 && dy < 0) state.player.direction = 'north-west';
  else if (dx > 0 && dy > 0) state.player.direction = 'south-east';
  else if (dx < 0 && dy > 0) state.player.direction = 'south-west';
}

function getNearbyPainting() {
  if (!state.run) return null;
  const p = state.player;
  const probe = { x: p.x - 18, y: p.y - 18, w: p.w + 36, h: p.h + 36 };
  return state.run.paintings.find(painting => painting.status === 'available' && rectsOverlap(probe, painting)) || null;
}

function maybeEscape() {
  if (!state.run || state.run.ended) return;

  if (rectsOverlap(state.player, DOOR) && state.run.haul > 0) {
    state.player.controlLocked = true;
    state.player.direction = 'south';
    state.run.escaped = true;
  } else if (rectsOverlap(state.player, DOOR)) {
    showBanner('You need some stolen art before escaping.');
  }
}

function interact() {
  if (!state.run || state.run.ended || state.player.controlLocked) return;

  if (rectsOverlap(state.player, DOOR)) {
    maybeEscape();
    return;
  }

  const painting = getNearbyPainting();
  if (!painting) {
    showBanner('Nothing to interact with here.');
    return;
  }

  state.activePainting = painting;
  questionText.textContent = `${painting.question.question} (${formatMoney(painting.question.value)})`;
  answerInput.value = '';
  questionModal.classList.remove('hidden');
  answerInput.focus();
}

function submitAnswer() {
  if (!state.activePainting) return;

  const painting = state.activePainting;
  const q = painting.question;
  const input = answerInput.value;

  questionModal.classList.add('hidden');

  if (isAnswerCorrect(input, q)) {
    painting.status = 'stolen';
    state.run.haul += Number(q.value);
    state.save.paintingsStolen += 1;
    state.save.usedQuestionIds.push(q.id);
    updateRunStats();
    showBanner(`Stolen! +${formatMoney(q.value)}`);
    maybeAutoFinish();
  } else {
    painting.status = 'failed';
    state.run.strikes += 1;
    updateRunStats();
    flashWrong();
    showBanner('Wrong answer. Security alert increased.');

    if (state.run.strikes >= 3) {
      triggerGuardChase();
    } else {
      maybeAutoFinish();
    }
  }

  state.activePainting = null;
}

function flashWrong() {
  const old = canvas.style.boxShadow;
  canvas.style.boxShadow = '0 0 0 3px #b24141 inset';
  setTimeout(() => canvas.style.boxShadow = old, 250);
}

function maybeAutoFinish() {
  const anyAvailable = state.run.paintings.some(p => p.status === 'available');
  if (!anyAvailable) {
    showBanner('All paintings attempted. Head for the exit to bank your haul.');
  }
}

function triggerGuardChase() {
  state.player.controlLocked = true;
  state.guard.active = true;
  showBanner('Security! Run for it... too late.');
}

function endHeist(escaped) {
  if (!state.run || state.run.ended) return;

  state.run.ended = true;
  state.run.escaped = escaped;
  state.save.heistsPlayed += 1;

  if (escaped) {
    state.save.totalBanked += state.run.haul;
    if (state.run.haul > state.save.bestHeist) state.save.bestHeist = state.run.haul;
    summaryTitle.textContent = 'Heist complete';
    summaryText.textContent = `You escaped with ${formatMoney(state.run.haul)}. It has been added to your total banked cash.`;
  } else {
    summaryTitle.textContent = 'Caught by security';
    summaryText.textContent = `You were chased out and lost this run's haul of ${formatMoney(state.run.haul)}.`;
  }

  saveProgress();
  summaryModal.classList.remove('hidden');
}

function returnToHub() {
  summaryModal.classList.add('hidden');
  showScreen('hub');
  state.run = null;
  renderHubStats();
}

function update() {
  if (state.screen !== 'game' || !state.run || state.run.ended) return;
  if (!questionModal.classList.contains('hidden')) return;

  if (!state.player.controlLocked) {
    let dx = 0;
    let dy = 0;

    if (state.keys.left) dx -= state.player.speed;
    if (state.keys.right) dx += state.player.speed;
    if (state.keys.up) dy -= state.player.speed;
    if (state.keys.down) dy += state.player.speed;

    if (dx !== 0 || dy !== 0) {
      updatePlayerDirection(dx, dy);
      tryMove(dx, dy);
    }
  } else if (state.guard.active) {
    state.player.direction = 'south';

    if (state.player.x > 470) state.player.x -= 2.1;
    if (state.player.y < 488) state.player.y += 2.0;

    if (state.guard.x > state.player.x + 24) state.guard.x -= 2.0;
    if (state.guard.y < state.player.y + 10) state.guard.y += 1.5;
    if (state.guard.y > state.player.y + 10) state.guard.y -= 1.5;

    if (state.player.y >= 485) {
      state.player.visible = false;
    }

    if (!state.player.visible && state.guard.y >= 475) {
      endHeist(false);
    }
  } else if (state.run.escaped) {
    if (state.player.y < 488) {
      state.player.y += 2.0;
      state.player.direction = 'south';
    } else {
      state.player.visible = false;
      endHeist(true);
    }
  }
}

function drawPoly(points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawGradientFloor(x, y, w, h, topColor, bottomColor) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

function drawExitDoor(theme) {
  ctx.fillStyle = '#5d422c';
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
  ctx.strokeStyle = '#322215';
  ctx.lineWidth = 2;
  ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);

  ctx.fillStyle = '#7c5b3f';
  ctx.fillRect(DOOR.x + 8, DOOR.y + 4, DOOR.w - 16, DOOR.h - 8);

  ctx.strokeStyle = theme.trim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DOOR.x, DOOR.y);
  ctx.lineTo(DOOR.x + DOOR.w, DOOR.y);
  ctx.stroke();
}

function drawGuardDoor(theme) {
  ctx.fillStyle = '#5d422c';
  ctx.fillRect(GUARD_DOOR.x, GUARD_DOOR.y, GUARD_DOOR.w, GUARD_DOOR.h);
  ctx.strokeStyle = '#322215';
  ctx.lineWidth = 2;
  ctx.strokeRect(GUARD_DOOR.x, GUARD_DOOR.y, GUARD_DOOR.w, GUARD_DOOR.h);

  ctx.fillStyle = '#7c5b3f';
  ctx.fillRect(GUARD_DOOR.x + 4, GUARD_DOOR.y + 8, GUARD_DOOR.w - 8, GUARD_DOOR.h - 16);

  ctx.strokeStyle = theme.trim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(GUARD_DOOR.x, GUARD_DOOR.y);
  ctx.lineTo(GUARD_DOOR.x + GUARD_DOOR.w, GUARD_DOOR.y);
  ctx.stroke();
}

function drawPaintingFrame(p, theme) {
  const isVertical = p.h > p.w;
  const fill = p.status === 'failed' ? '#994444' : theme.frame;
  const shadow = p.status === 'failed' ? '#682828' : theme.frameShadow;

  ctx.fillStyle = shadow;
  ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);

  ctx.fillStyle = fill;
  ctx.fillRect(p.x, p.y, p.w, p.h);

  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x, p.y, p.w, p.h);

  if (p.status === 'failed') {
    ctx.strokeStyle = '#2f0e0e';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.stroke();
  }

  if (!isVertical) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 3);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(p.x + 3, p.y + 4, 3, p.h - 8);
  }
}

function drawFallbackPlayer() {
  ctx.fillStyle = '#f3d082';
  ctx.fillRect(state.player.x, state.player.y, state.player.w, state.player.h);
  ctx.fillStyle = '#222';
  ctx.fillRect(state.player.x + 4, state.player.y + 4, 3, 3);
  ctx.fillRect(state.player.x + 11, state.player.y + 4, 3, 3);
}

function drawPlayerSprite() {
  if (!state.player.visible) return;

  const sprite = playerSprites[state.player.direction];
  const drawX = state.player.x + (state.player.w / 2) - (PLAYER_SPRITE_SIZE / 2);
  const drawY = state.player.y + state.player.h - PLAYER_SPRITE_SIZE;

  if (spritesLoaded && sprite && sprite.complete) {
    ctx.drawImage(sprite, drawX, drawY, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE);
  } else {
    drawFallbackPlayer();
  }
}

function drawGuard() {
  if (!state.guard.active) return;

  ctx.fillStyle = '#6b8cff';
  ctx.fillRect(state.guard.x, state.guard.y, state.guard.w, state.guard.h);
  ctx.fillStyle = '#162041';
  ctx.fillRect(state.guard.x + 4, state.guard.y + 4, 3, 3);
  ctx.fillRect(state.guard.x + 11, state.guard.y + 4, 3, 3);
}

function drawRoom() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const theme = state.currentTheme || themes[0];

  ctx.fillStyle = '#101318';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const backWall = [
    { x: ROOM.x + 34, y: ROOM.y },
    { x: ROOM.x + ROOM.w - 34, y: ROOM.y },
    { x: ROOM.x + ROOM.w - 8, y: ROOM.y + 30 },
    { x: ROOM.x + 8, y: ROOM.y + 30 }
  ];

  const leftWall = [
    { x: ROOM.x, y: ROOM.y + 28 },
    { x: ROOM.x + 34, y: ROOM.y },
    { x: ROOM.x + 34, y: ROOM.y + ROOM.h - 32 },
    { x: ROOM.x, y: ROOM.y + ROOM.h }
  ];

  const rightWall = [
    { x: ROOM.x + ROOM.w - 34, y: ROOM.y },
    { x: ROOM.x + ROOM.w, y: ROOM.y + 28 },
    { x: ROOM.x + ROOM.w, y: ROOM.y + ROOM.h },
    { x: ROOM.x + ROOM.w - 34, y: ROOM.y + ROOM.h - 32 }
  ];

  drawPoly(backWall, theme.backWall, '#121821', 2);
  drawPoly(leftWall, theme.leftWall, '#121821', 2);
  drawPoly(rightWall, theme.rightWall, '#121821', 2);

  drawGradientFloor(ROOM.x + 34, ROOM.y + 30, ROOM.w - 68, ROOM.h - 62, theme.floorTop, theme.floorBottom);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y = ROOM.y + 45 + i * 38;
    ctx.beginPath();
    ctx.moveTo(ROOM.x + 38, y);
    ctx.lineTo(ROOM.x + ROOM.w - 38, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#f4efe6';
  ctx.font = '20px Arial';
  ctx.fillText(theme.title, ROOM.x + 40, 42);

  drawGuardDoor(theme);
  drawExitDoor(theme);

  if (state.run) {
    for (const p of state.run.paintings) {
      if (p.status === 'stolen') continue;
      drawPaintingFrame(p, theme);
    }
  }

  const nearby = getNearbyPainting();
  if (nearby && !state.player.controlLocked && questionModal.classList.contains('hidden')) {
    ctx.fillStyle = 'rgba(0,0,0,.68)';
    ctx.fillRect(state.player.x - 10, state.player.y - 28, 92, 20);
    ctx.fillStyle = '#f7e7b0';
    ctx.font = '12px Arial';
    ctx.fillText('Press E / Interact', state.player.x - 4, state.player.y - 14);
  } else if (rectsOverlap(state.player, DOOR) && !state.player.controlLocked) {
    ctx.fillStyle = 'rgba(0,0,0,.68)';
    ctx.fillRect(state.player.x - 8, state.player.y - 28, 86, 20);
    ctx.fillStyle = '#f7e7b0';
    ctx.font = '12px Arial';
    ctx.fillText('Exit & bank', state.player.x - 2, state.player.y - 14);
  }

  drawPlayerSprite();
  drawGuard();
}

function loop() {
  update();
  drawRoom();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

  if (k === 'arrowup' || k === 'w') state.keys.up = true;
  if (k === 'arrowdown' || k === 's') state.keys.down = true;
  if (k === 'arrowleft' || k === 'a') state.keys.left = true;
  if (k === 'arrowright' || k === 'd') state.keys.right = true;

  if ((k === 'e' || k === ' ') && questionModal.classList.contains('hidden') && state.screen === 'game') {
    e.preventDefault();
    interact();
  }

  if (k === 'enter' && !questionModal.classList.contains('hidden')) {
    submitAnswer();
  }
});

document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();

  if (k === 'arrowup' || k === 'w') state.keys.up = false;
  if (k === 'arrowdown' || k === 's') state.keys.down = false;
  if (k === 'arrowleft' || k === 'a') state.keys.left = false;
  if (k === 'arrowright' || k === 'd') state.keys.right = false;
});

joystickButtons.forEach(btn => {
  const dir = btn.dataset.dir;
  const map = { up: 'up', down: 'down', left: 'left', right: 'right' };
  const press = (val) => state.keys[map[dir]] = val;

  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    press(true);
  }, { passive: false });

  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    press(false);
  }, { passive: false });

  btn.addEventListener('mousedown', () => press(true));
  btn.addEventListener('mouseup', () => press(false));
  btn.addEventListener('mouseleave', () => press(false));
});

interactBtn.addEventListener('click', interact);
startHeistBtn.addEventListener('click', startHeist);
resetProgressBtn.addEventListener('click', resetProgress);
backToHubBtn.addEventListener('click', () => showScreen('hub'));

submitAnswerBtn.addEventListener('click', submitAnswer);
cancelAnswerBtn.addEventListener('click', () => {
  questionModal.classList.add('hidden');
  state.activePainting = null;
});

summaryContinueBtn.addEventListener('click', returnToHub);

loadPlayerSprites();
renderHubStats();
showScreen('hub');
loop();
})();
