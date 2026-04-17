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

  const STORAGE_KEY = 'nanaHeistSave_v7';

  // Source image coordinate system from your museum-room asset workflow.
  const SOURCE_W = 2816;
  const SOURCE_H = 1536;

  const sx = (x) => (x / SOURCE_W) * canvas.width;
  const sy = (y) => (y / SOURCE_H) * canvas.height;

  // ===== Room geometry mapped from your coordinates =====
  const FLOOR_POLY = [
    { x: sx(677), y: sy(662) },
    { x: sx(2140), y: sy(663) },
    { x: sx(2725), y: sy(1427) },
    { x: sx(99), y: sy(1427) }
  ];

  const GUARD_DOOR_ZONE = {
    x1: sx(2522),
    y1: sy(1174),
    x2: sx(2639),
    y2: sy(1325)
  };

  // Bottom-center escape area on the floor.
  const EXIT_ZONE = {
    x1: sx(1180),
    y1: sy(1285),
    x2: sx(1640),
    y2: sy(1495)
  };

  // Scale
  const PLAYER_HEIGHT = 200;
  const PLAYER_WIDTH = 200;
  const GUARD_HEIGHT = 190;
  const GUARD_WIDTH = 120;
  const FOOT_RADIUS = 14;
  const MOVE_SPEED = 2.4;
  const WALK_FRAME_MS = 120;
  const PULL_FRAME_MS = 120;
  const INTERACT_DISTANCE = 70;

  // ===== Background =====
  const roomBackground = new Image();
  let roomLoaded = false;
  roomBackground.onload = () => { roomLoaded = true; };
  roomBackground.onerror = () => console.warn('Failed to load museum-room.png');
  roomBackground.src = 'museum-room.png';

  // ===== Nana walking animations =====
  const animationFiles = {
    south: [
      'Nana South Walking_0_delay-0.2s.png',
      'Nana South Walking_1_delay-0.2s.png',
      'Nana South Walking_2_delay-0.2s.png',
      'Nana South Walking_3_delay-0.2s.png',
      'Nana South Walking_4_delay-0.2s.png',
      'Nana South Walking_5_delay-0.2s.png'
    ],
    'south-east': [
      'Nana South-East Walking_0_delay-0.2s.png',
      'Nana South-East Walking_1_delay-0.2s.png',
      'Nana South-East Walking_2_delay-0.2s.png',
      'Nana South-East Walking_3_delay-0.2s.png',
      'Nana South-East Walking_4_delay-0.2s.png',
      'Nana South-East Walking_5_delay-0.2s.png'
    ],
    east: [
      'Nana East Walking_0_delay-0.2s.png',
      'Nana East Walking_1_delay-0.2s.png',
      'Nana East Walking_2_delay-0.2s.png',
      'Nana East Walking_3_delay-0.2s.png',
      'Nana East Walking_4_delay-0.2s.png',
      'Nana East Walking_5_delay-0.2s.png'
    ],
    'north-east': [
      'Nana North-East Walking_0_delay-0.2s.png',
      'Nana North-East Walking_1_delay-0.2s.png',
      'Nana North-East Walking_2_delay-0.2s.png',
      'Nana North-East Walking_3_delay-0.2s.png',
      'Nana North-East Walking_4_delay-0.2s.png',
      'Nana North-East Walking_5_delay-0.2s.png'
    ],
    north: [
      'Nana North Walking_0_delay-0.2s.png',
      'Nana North Walking_1_delay-0.2s.png',
      'Nana North Walking_2_delay-0.2s.png',
      'Nana North Walking_3_delay-0.2s.png',
      'Nana North Walking_4_delay-0.2s.png',
      'Nana North Walking_5_delay-0.2s.png'
    ],
    'north-west': [
      'Nana North-West Walking_0_delay-0.2s.png',
      'Nana North-West Walking_1_delay-0.2s.png',
      'Nana North-West Walking_2_delay-0.2s.png',
      'Nana North-West Walking_3_delay-0.2s.png',
      'Nana North-West Walking_4_delay-0.2s.png',
      'Nana North-West Walking_5_delay-0.2s.png'
    ],
    west: [
      'Nana West Walking_0_delay-0.2s.png',
      'Nana West Walking_1_delay-0.2s.png',
      'Nana West Walking_2_delay-0.2s.png',
      'Nana West Walking_3_delay-0.2s.png',
      'Nana West Walking_4_delay-0.2s.png',
      'Nana West Walking_5_delay-0.2s.png'
    ],
    'south-west': [
      'Nana South-West Walking_0_delay-0.2s.png',
      'Nana South-West Walking_1_delay-0.2s.png',
      'Nana South-West Walking_2_delay-0.2s.png',
      'Nana South-West Walking_3_delay-0.2s.png',
      'Nana South-West Walking_4_delay-0.2s.png',
      'Nana South-West Walking_5_delay-0.2s.png'
    ]
  };

  // ===== Nana pull animations =====
  const pullFiles = {
    east: [
      'Nana East Pull_0_delay-0.2s.png',
      'Nana East Pull_1_delay-0.2s.png',
      'Nana East Pull_2_delay-0.2s.png',
      'Nana East Pull_3_delay-0.2s.png',
      'Nana East Pull_4_delay-0.2s.png',
      'Nana East Pull_5_delay-0.2s.png'
    ],
    north: [
      'Nana North Pull_0_delay-0.2s.png',
      'Nana North Pull_1_delay-0.2s.png',
      'Nana North Pull_2_delay-0.2s.png',
      'Nana North Pull_3_delay-0.2s.png',
      'Nana North Pull_4_delay-0.2s.png',
      'Nana North Pull_5_delay-0.2s.png'
    ],
    west: [
      'Nana West Pull_0_delay-0.2s.png',
      'Nana West Pull_1_delay-0.2s.png',
      'Nana West Pull_2_delay-0.2s.png',
      'Nana West Pull_3_delay-0.2s.png',
      'Nana West Pull_4_delay-0.2s.png',
      'Nana West Pull_5_delay-0.2s.png'
    ]
  };

  const walkAnimations = {};
  const pullAnimations = {};
  let allSpritesLoaded = false;

  function loadAnimationSet(source, target) {
    let total = 0;
    let loaded = 0;
    const dirs = Object.keys(source);

    dirs.forEach((dir) => {
      target[dir] = [];
      source[dir].forEach((file) => {
        total += 1;
        const img = new Image();
        img.onload = () => {
          loaded += 1;
          if (loaded === total) {
            target.__loaded = true;
            if (walkAnimations.__loaded && pullAnimations.__loaded) {
              allSpritesLoaded = true;
            }
          }
        };
        img.onerror = () => console.warn(`Failed to load ${file}`);
        img.src = file;
        target[dir].push(img);
      });
    });
  }

  // ===== State =====
  const state = {
    save: loadSave(),
    screen: 'hub',
    keys: { up: false, down: false, left: false, right: false },
    run: null,
    activePainting: null,
    time: 0,
    lastTimestamp: 0,
    player: {
      x: sx(1410),
      y: sy(1240),
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null // null | { type:'pull', dir:'north'|'east'|'west', painting, frameIndex, timer }
    },
    guard: {
      x: sx(2575),
      y: sy(1260),
      active: false,
      visible: true
    }
  };

  // ===== Save =====
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

  // ===== Utilities =====
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

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect =
        ((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInRect(px, py, rect) {
    return px >= rect.x1 && px <= rect.x2 && py >= rect.y1 && py <= rect.y2;
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

  // ===== UI =====
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

  // ===== Questions =====
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

  // ===== Paintings =====
  function createPaintings(questions) {
    const slots = [
      // north/back wall
      { x: sx(860),  y: sy(275),  w: sx(170) - sx(0), h: sy(68) - sy(0), anchorX: sx(945),  anchorY: sy(455), wall: 'north' },
      { x: sx(1185), y: sy(275),  w: sx(170) - sx(0), h: sy(68) - sy(0), anchorX: sx(1270), anchorY: sy(455), wall: 'north' },
      { x: sx(1510), y: sy(275),  w: sx(170) - sx(0), h: sy(68) - sy(0), anchorX: sx(1595), anchorY: sy(455), wall: 'north' },
      { x: sx(1835), y: sy(275),  w: sx(170) - sx(0), h: sy(68) - sy(0), anchorX: sx(1920), anchorY: sy(455), wall: 'north' },

      // west wall
      { x: sx(500),  y: sy(520),  w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(715),  anchorY: sy(705),  wall: 'west' },
      { x: sx(395),  y: sy(765),  w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(655),  anchorY: sy(930),  wall: 'west' },
      { x: sx(300),  y: sy(1000), w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(590),  anchorY: sy(1145), wall: 'west' },

      // east wall
      { x: sx(2280), y: sy(555),  w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(2120), anchorY: sy(740),  wall: 'east' },
      { x: sx(2380), y: sy(790),  w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(2180), anchorY: sy(960),  wall: 'east' },
      { x: sx(2475), y: sy(1010), w: sx(58) - sx(0),  h: sy(165) - sy(0), anchorX: sx(2240), anchorY: sy(1165), wall: 'east' }
    ];

    return slots.map((slot, i) => ({
      ...slot,
      question: questions[i],
      status: 'available', // available | failed | stolen
      id: `painting-${i}`
    }));
  }

  function getNearbyPainting() {
    if (!state.run) return null;
    const px = state.player.x;
    const py = state.player.y;

    let nearest = null;
    let nearestDist = Infinity;

    for (const painting of state.run.paintings) {
      if (painting.status !== 'available') continue;
      const d = distance(px, py, painting.anchorX, painting.anchorY);
      if (d < INTERACT_DISTANCE && d < nearestDist) {
        nearest = painting;
        nearestDist = d;
      }
    }

    return nearest;
  }

  // ===== Game flow =====
  function startHeist() {
    const chosenQuestions = selectQuestions(10);
    state.run = {
      haul: 0,
      strikes: 0,
      paintings: createPaintings(chosenQuestions),
      ended: false,
      escaped: false,
      mode: 'play' // play | pull | chase | escape
    };

    state.player = {
      x: sx(1410),
      y: sy(1240),
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    };

    state.guard = {
      x: sx(2575),
      y: sy(1260),
      active: false,
      visible: true
    };

    updateRunStats();
    showScreen('game');
    showBanner('Heist started.');
  }

  function updateRunStats() {
    if (!state.run) return;
    currentHaulEl.textContent = formatMoney(state.run.haul);
    strikeCountEl.textContent = `${state.run.strikes} / 3`;
    paintingsLeftEl.textContent = String(state.run.paintings.filter(p => p.status === 'available').length);
  }

  function maybeEscape() {
    if (!state.run || state.run.ended) return;
    if (pointInRect(state.player.x, state.player.y, EXIT_ZONE) && state.run.haul > 0) {
      state.player.controlLocked = true;
      state.run.mode = 'escape';
      state.player.direction = 'south';
      return;
    }
    if (pointInRect(state.player.x, state.player.y, EXIT_ZONE)) {
      showBanner('You need some stolen art before escaping.');
    }
  }

  function interact() {
    if (!state.run || state.run.ended) return;
    if (state.player.controlLocked || state.player.action) return;

    if (pointInRect(state.player.x, state.player.y, EXIT_ZONE)) {
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

  function startPullAnimation(painting) {
    state.player.controlLocked = true;
    state.run.mode = 'pull';

    let pullDir = painting.wall;
    if (!pullAnimations[pullDir]) {
      pullDir = 'north';
    }

    if (pullDir === 'north') {
      state.player.direction = 'north';
    } else if (pullDir === 'west') {
      state.player.direction = 'west';
    } else if (pullDir === 'east') {
      state.player.direction = 'north-east';
    }

    state.player.action = {
      type: 'pull',
      dir: pullDir,
      painting,
      frameIndex: 0,
      timer: 0
    };
  }

  function finishSuccessfulPull() {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    const painting = action.painting;
    const q = painting.question;

    painting.status = 'stolen';
    state.run.haul += Number(q.value);
    state.save.paintingsStolen += 1;
    state.save.usedQuestionIds.push(q.id);

    updateRunStats();
    showBanner(`Stolen! +${formatMoney(q.value)}`);

    state.player.action = null;
    state.player.controlLocked = false;
    state.run.mode = 'play';

    const anyAvailable = state.run.paintings.some(p => p.status === 'available');
    if (!anyAvailable) {
      showBanner('All paintings attempted. Head for the exit to bank your haul.');
    }
  }

  function submitAnswer() {
    if (!state.activePainting) return;

    const painting = state.activePainting;
    const q = painting.question;
    const input = answerInput.value;

    questionModal.classList.add('hidden');

    if (isAnswerCorrect(input, q)) {
      startPullAnimation(painting);
    } else {
      painting.status = 'failed';
      state.run.strikes += 1;
      updateRunStats();
      flashWrong();
      showBanner('Wrong answer. Security alert increased.');

      if (state.run.strikes >= 3) {
        triggerGuardChase();
      }
    }

    state.activePainting = null;
  }

  function flashWrong() {
    const old = canvas.style.boxShadow;
    canvas.style.boxShadow = '0 0 0 3px #b24141 inset';
    setTimeout(() => {
      canvas.style.boxShadow = old;
    }, 250);
  }

  function triggerGuardChase() {
    state.player.controlLocked = true;
    state.guard.active = true;
    state.run.mode = 'chase';
    showBanner('Security! Run for it... too late.');
  }

  function endHeist(escaped) {
    if (!state.run || state.run.ended) return;

    state.run.ended = true;
    state.save.heistsPlayed += 1;

    if (escaped) {
      state.save.totalBanked += state.run.haul;
      if (state.run.haul > state.save.bestHeist) {
        state.save.bestHeist = state.run.haul;
      }
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
    state.run = null;
    showScreen('hub');
    renderHubStats();
  }

  // ===== Movement / animation =====
  function updateDirection(dx, dy) {
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

  function tryMove(dx, dy) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    const footPoint = { x: nx, y: ny };
    if (pointInPolygon(footPoint, FLOOR_POLY)) {
      state.player.x = nx;
      state.player.y = ny;
    }
  }

  function updateWalkAnimation(delta) {
    if (!state.player.moving) {
      state.player.walkFrameIndex = 0;
      state.player.walkFrameTimer = 0;
      return;
    }

    state.player.walkFrameTimer += delta;
    if (state.player.walkFrameTimer >= WALK_FRAME_MS) {
      state.player.walkFrameTimer = 0;
      state.player.walkFrameIndex = (state.player.walkFrameIndex + 1) % 6;
    }
  }

  function updatePullAnimation(delta) {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    action.timer += delta;
    if (action.timer >= PULL_FRAME_MS) {
      action.timer = 0;
      action.frameIndex += 1;

      if (action.frameIndex >= 6) {
        finishSuccessfulPull();
      }
    }
  }

  function update(delta) {
    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden')) return;

    state.player.moving = false;

    if (state.run.mode === 'play') {
      let dx = 0;
      let dy = 0;

      if (state.keys.left) dx -= MOVE_SPEED;
      if (state.keys.right) dx += MOVE_SPEED;
      if (state.keys.up) dy -= MOVE_SPEED;
      if (state.keys.down) dy += MOVE_SPEED;

      if (dx !== 0 || dy !== 0) {
        state.player.moving = true;
        updateDirection(dx, dy);
        tryMove(dx, dy);
      }

      updateWalkAnimation(delta);
    } else if (state.run.mode === 'pull') {
      updatePullAnimation(delta);
    } else if (state.run.mode === 'chase') {
      // Placeholder guard chase until his own animations are added.
      // Nana runs toward exit.
      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
      const targetY = EXIT_ZONE.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (dx / len) * (MOVE_SPEED * 1.45);
      const my = (dy / len) * (MOVE_SPEED * 1.45);

      state.player.moving = true;
      updateDirection(mx, my);
      tryMove(mx, my);
      updateWalkAnimation(delta);

      // Guard placeholder moves from door toward Nana
      const gdx = state.player.x - state.guard.x;
      const gdy = state.player.y - state.guard.y;
      const glen = Math.hypot(gdx, gdy) || 1;
      state.guard.x += (gdx / glen) * 1.8;
      state.guard.y += (gdy / glen) * 1.8;

      if (state.player.y >= EXIT_ZONE.y2 - sy(10)) {
        state.player.visible = false;
      }
      if (!state.player.visible && state.guard.y >= EXIT_ZONE.y1) {
        endHeist(false);
      }
    } else if (state.run.mode === 'escape') {
      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
      const targetY = EXIT_ZONE.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (dx / len) * MOVE_SPEED;
      const my = (dy / len) * MOVE_SPEED;

      state.player.moving = true;
      updateDirection(mx, my);
      tryMove(mx, my);
      updateWalkAnimation(delta);

      if (state.player.y >= EXIT_ZONE.y2 - sy(10)) {
        state.player.visible = false;
        endHeist(true);
      }
    }
  }

  // ===== Drawing =====
  function drawFallbackRoom() {
    ctx.fillStyle = '#20242b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawPaintingFrame(p) {
    const fill = p.status === 'failed' ? '#994444' : '#ffffff';
    const shadow = p.status === 'failed' ? '#682828' : '#b7bcc4';

    ctx.fillStyle = shadow;
    ctx.fillRect(p.x + 2, p.y + 2, p.w, p.h);

    ctx.fillStyle = fill;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = '#353535';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    if (p.status === 'failed') {
      ctx.strokeStyle = '#2f0e0e';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    if (p.wall === 'north') {
      ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, 4);
    } else {
      ctx.fillRect(p.x + 4, p.y + 6, 4, p.h - 12);
    }
  }

  function drawFallbackPlayer() {
    const drawX = state.player.x - PLAYER_WIDTH / 2;
    const drawY = state.player.y - PLAYER_HEIGHT;

    ctx.fillStyle = '#f3d082';
    ctx.fillRect(drawX + 70, drawY + 40, 60, 120);
    ctx.fillStyle = '#222';
    ctx.fillRect(drawX + 88, drawY + 65, 8, 8);
    ctx.fillRect(drawX + 105, drawY + 65, 8, 8);
  }

  function getCurrentPlayerImage() {
    if (state.player.action && state.player.action.type === 'pull') {
      const set = pullAnimations[state.player.action.dir];
      if (!set) return null;
      return set[Math.min(state.player.action.frameIndex, set.length - 1)];
    }

    const set = walkAnimations[state.player.direction];
    if (!set) return null;
    return set[state.player.walkFrameIndex];
  }

  function drawPlayer() {
    if (!state.player.visible) return;

    const img = getCurrentPlayerImage();
    const drawX = state.player.x - PLAYER_WIDTH / 2;
    const drawY = state.player.y - PLAYER_HEIGHT;

    if (allSpritesLoaded && img && img.complete) {
      ctx.drawImage(img, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
    } else {
      drawFallbackPlayer();
    }
  }

  function drawGuard() {
    if (!state.guard.active || !state.guard.visible) return;

    const drawX = state.guard.x - GUARD_WIDTH / 2;
    const drawY = state.guard.y - GUARD_HEIGHT;

    ctx.fillStyle = '#6b8cff';
    ctx.fillRect(drawX + 35, drawY + 45, 50, 125);
    ctx.fillStyle = '#162041';
    ctx.fillRect(drawX + 50, drawY + 68, 8, 8);
    ctx.fillRect(drawX + 66, drawY + 68, 8, 8);
  }

  function drawPrompt() {
    if (!state.run || state.run.mode !== 'play' || state.player.controlLocked) return;

    const painting = getNearbyPainting();
    if (painting) {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(state.player.x - 60, state.player.y - PLAYER_HEIGHT - 28, 120, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.fillText('Press E / Interact', state.player.x - 48, state.player.y - PLAYER_HEIGHT - 14);
      return;
    }

    if (pointInRect(state.player.x, state.player.y, EXIT_ZONE)) {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(state.player.x - 45, state.player.y - PLAYER_HEIGHT - 28, 90, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.fillText('Exit & bank', state.player.x - 28, state.player.y - PLAYER_HEIGHT - 14);
    }
  }

  function drawRoom() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (roomLoaded) {
      ctx.drawImage(roomBackground, 0, 0, canvas.width, canvas.height);
    } else {
      drawFallbackRoom();
    }

    if (state.run) {
      for (const p of state.run.paintings) {
        if (p.status === 'stolen') continue;
        drawPaintingFrame(p);
      }
    }

    drawPrompt();
    drawPlayer();
    drawGuard();
  }

  function gameLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    update(delta);
    drawRoom();
    requestAnimationFrame(gameLoop);
  }

  // ===== Events =====
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

  joystickButtons.forEach((btn) => {
    const dir = btn.dataset.dir;
    const map = { up: 'up', down: 'down', left: 'left', right: 'right' };
    const press = (val) => { state.keys[map[dir]] = val; };

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

  // ===== Init =====
  loadAnimationSet(animationFiles, walkAnimations);
  loadAnimationSet(pullFiles, pullAnimations);
  renderHubStats();
  showScreen('hub');
  requestAnimationFrame(gameLoop);
})();
