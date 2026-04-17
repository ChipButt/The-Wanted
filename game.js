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

  const STORAGE_KEY = 'nanaHeistSave_v9';

  // =========================
  // Source image coordinate system
  // =========================
  const SOURCE_W = 2816;
  const SOURCE_H = 1536;
  const sx = (x) => (x / SOURCE_W) * canvas.width;
  const sy = (y) => (y / SOURCE_H) * canvas.height;

  // =========================
  // Geometry
  // =========================
  const FLOOR_POLY = [
    { x: sx(738),  y: sy(730)  },
    { x: sx(2073), y: sy(730)  },
    { x: sx(2505), y: sy(1360) },
    { x: sx(281),  y: sy(1360) }
  ];

  const GUARD_DOOR_ZONE = {
    x1: sx(2522),
    y1: sy(1174),
    x2: sx(2639),
    y2: sy(1325)
  };

  const EXIT_ZONE = {
    x1: sx(1180),
    y1: sy(1280),
    x2: sx(1640),
    y2: sy(1495)
  };

  // =========================
  // Scale / timings
  // =========================
  const PLAYER_WIDTH = 100;
  const PLAYER_HEIGHT = 100;
  const GUARD_WIDTH = 100;
  const GUARD_HEIGHT = 100;

  const MOVE_SPEED = 2.35;
  const CHASE_SPEED = 3.0;
  const GUARD_SPEED = 2.2;

  const WALK_FRAME_MS = 120;
  const PULL_FRAME_MS = 120;

  const INTERACT_DISTANCE = 62;

  // =========================
  // Helpers
  // =========================
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    img.onerror = () => console.warn(`Failed to load ${src}`);
    return img;
  }

  function imageReady(img) {
    return !!img && img.complete && img.naturalWidth > 0;
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

  function getFloorItemBlocker(item) {
    if (!item || item.type !== 'floor' || item.status === 'stolen') return null;

    if (item.floorKind === 'pedestal') {
      return {
        x1: item.anchorX - item.drawW * 0.22,
        y1: item.anchorY - item.drawH * 0.10,
        x2: item.anchorX + item.drawW * 0.22,
        y2: item.anchorY + 6
      };
    }

    if (item.floorKind === 'aboard') {
      return {
        x1: item.anchorX - item.drawW * 0.26,
        y1: item.anchorY - item.drawH * 0.14,
        x2: item.anchorX + item.drawW * 0.26,
        y2: item.anchorY + 8
      };
    }

    return null;
  }

  function pointHitsFloorBlocker(px, py) {
    if (!state.run) return false;

    for (const item of state.run.items) {
      const blocker = getFloorItemBlocker(item);
      if (!blocker) continue;
      if (pointInRect(px, py, blocker)) return true;
    }

    return false;
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

  function getRoundNumber() {
    return state.save.heistsPlayed + 1;
  }

  function sequencePick(sequence, roundNumber) {
    return sequence[(roundNumber - 1) % sequence.length];
  }

  function randomFloorPoint(minX, maxX, minY, maxY, avoid = []) {
    for (let i = 0; i < 500; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (!pointInPolygon({ x, y }, FLOOR_POLY)) continue;
      if (pointInRect(x, y, EXIT_ZONE)) continue;
      if (distance(x, y, sx(1410), sy(1220)) < 90) continue;

      let tooClose = false;
      for (const other of avoid) {
        if (distance(x, y, other.x, other.y) < 120) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      return { x, y };
    }

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function vectorToDirection(dx, dy) {
    const sxn = Math.sign(dx);
    const syn = Math.sign(dy);

    if (sxn === 0 && syn < 0) return 'north';
    if (sxn === 0 && syn > 0) return 'south';
    if (sxn > 0 && syn === 0) return 'east';
    if (sxn < 0 && syn === 0) return 'west';
    if (sxn > 0 && syn < 0) return 'north-east';
    if (sxn < 0 && syn < 0) return 'north-west';
    if (sxn > 0 && syn > 0) return 'south-east';
    if (sxn < 0 && syn > 0) return 'south-west';
    return 'south';
  }

  // =========================
  // Assets
  // =========================
  const roomBackground = loadImage('museum-room.png');

  const walkAnimations = {
    south: [
      loadImage('Nana South Walking_0_delay-0.2s.png'),
      loadImage('Nana South Walking_1_delay-0.2s.png'),
      loadImage('Nana South Walking_2_delay-0.2s.png'),
      loadImage('Nana South Walking_3_delay-0.2s.png'),
      loadImage('Nana South Walking_4_delay-0.2s.png'),
      loadImage('Nana South Walking_5_delay-0.2s.png')
    ],
    'south-east': [
      loadImage('Nana South-East Walking_0_delay-0.2s.png'),
      loadImage('Nana South-East Walking_1_delay-0.2s.png'),
      loadImage('Nana South-East Walking_2_delay-0.2s.png'),
      loadImage('Nana South-East Walking_3_delay-0.2s.png'),
      loadImage('Nana South-East Walking_4_delay-0.2s.png'),
      loadImage('Nana South-East Walking_5_delay-0.2s.png')
    ],
    east: [
      loadImage('Nana East Walking_0_delay-0.2s.png'),
      loadImage('Nana East Walking_1_delay-0.2s.png'),
      loadImage('Nana East Walking_2_delay-0.2s.png'),
      loadImage('Nana East Walking_3_delay-0.2s.png'),
      loadImage('Nana East Walking_4_delay-0.2s.png'),
      loadImage('Nana East Walking_5_delay-0.2s.png')
    ],
    'north-east': [
      loadImage('Nana North-East Walking_0_delay-0.2s.png'),
      loadImage('Nana North-East Walking_1_delay-0.2s.png'),
      loadImage('Nana North-East Walking_2_delay-0.2s.png'),
      loadImage('Nana North-East Walking_3_delay-0.2s.png'),
      loadImage('Nana North-East Walking_4_delay-0.2s.png'),
      loadImage('Nana North-East Walking_5_delay-0.2s.png')
    ],
    north: [
      loadImage('Nana North Walking_0_delay-0.2s.png'),
      loadImage('Nana North Walking_1_delay-0.2s.png'),
      loadImage('Nana North Walking_2_delay-0.2s.png'),
      loadImage('Nana North Walking_3_delay-0.2s.png'),
      loadImage('Nana North Walking_4_delay-0.2s.png'),
      loadImage('Nana North Walking_5_delay-0.2s.png')
    ],
    'north-west': [
      loadImage('Nana North-West Walking_0_delay-0.2s.png'),
      loadImage('Nana North-West Walking_1_delay-0.2s.png'),
      loadImage('Nana North-West Walking_2_delay-0.2s.png'),
      loadImage('Nana North-West Walking_3_delay-0.2s.png'),
      loadImage('Nana North-West Walking_4_delay-0.2s.png'),
      loadImage('Nana North-West Walking_5_delay-0.2s.png')
    ],
    west: [
      loadImage('Nana West Walking_0_delay-0.2s.png'),
      loadImage('Nana West Walking_1_delay-0.2s.png'),
      loadImage('Nana West Walking_2_delay-0.2s.png'),
      loadImage('Nana West Walking_3_delay-0.2s.png'),
      loadImage('Nana West Walking_4_delay-0.2s.png'),
      loadImage('Nana West Walking_5_delay-0.2s.png')
    ],
    'south-west': [
      loadImage('Nana South-West Walking_0_delay-0.2s.png'),
      loadImage('Nana South-West Walking_1_delay-0.2s.png'),
      loadImage('Nana South-West Walking_2_delay-0.2s.png'),
      loadImage('Nana South-West Walking_3_delay-0.2s.png'),
      loadImage('Nana South-West Walking_4_delay-0.2s.png'),
      loadImage('Nana South-West Walking_5_delay-0.2s.png')
    ]
  };

  const pullAnimations = {
    east: [
      loadImage('Nana East Pull_0_delay-0.2s.png'),
      loadImage('Nana East Pull_1_delay-0.2s.png'),
      loadImage('Nana East Pull_2_delay-0.2s.png'),
      loadImage('Nana East Pull_3_delay-0.2s.png'),
      loadImage('Nana East Pull_4_delay-0.2s.png'),
      loadImage('Nana East Pull_5_delay-0.2s.png')
    ],
    north: [
      loadImage('Nana North Pull_0_delay-0.2s.png'),
      loadImage('Nana North Pull_1_delay-0.2s.png'),
      loadImage('Nana North Pull_2_delay-0.2s.png'),
      loadImage('Nana North Pull_3_delay-0.2s.png'),
      loadImage('Nana North Pull_4_delay-0.2s.png'),
      loadImage('Nana North Pull_5_delay-0.2s.png')
    ],
    west: [
      loadImage('Nana West Pull_0_delay-0.2s.png'),
      loadImage('Nana West Pull_1_delay-0.2s.png'),
      loadImage('Nana West Pull_2_delay-0.2s.png'),
      loadImage('Nana West Pull_3_delay-0.2s.png'),
      loadImage('Nana West Pull_4_delay-0.2s.png'),
      loadImage('Nana West Pull_5_delay-0.2s.png')
    ]
  };

  const guardSprites = {
    north: loadImage('Security Guard North.png'),
    'north-east': loadImage('Security Guard North-East.png'),
    east: loadImage('Security Guard East.png'),
    'south-east': loadImage('Security Guard South-East.png'),
    south: loadImage('Security Guard South.png'),
    'south-west': loadImage('Security Guard South-West.png'),
    west: loadImage('Security Guard West.png'),
    'north-west': loadImage('Security Guard North-West.png')
  };

  const artImages = {
    north: [
      loadImage('painting_abstract_small.png'),
      loadImage('painting_mona_lisa_large.png'),
      loadImage('painting_starry_night.png')
    ],
    westVariants: [
      loadImage('painting_portrait_left_lower_angle.png'),
      loadImage('painting_portrait_left_lower_angle_2.png'),
      loadImage('painting_portrait_left_lower_angle_3.png')
    ],
    east: [
      loadImage('painting_mona_lisa_right_lower_angle.png'),
      loadImage('painting_portrait_right_angle.png')
    ],
    pedestal: loadImage('statue_on_pedestal.png'),
    aboard: loadImage('A-Board Art Piece.png')
  };

  // =========================
  // State
  // =========================
  const state = {
    save: loadSave(),
    screen: 'hub',
    keys: { up: false, down: false, left: false, right: false },
    run: null,
    activeItem: null,
    lastTimestamp: 0,
    player: {
      x: sx(1410),
      y: sy(1220),
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    },
    guard: {
      x: (GUARD_DOOR_ZONE.x1 + GUARD_DOOR_ZONE.x2) / 2,
      y: GUARD_DOOR_ZONE.y2,
      direction: 'south-west',
      active: false,
      visible: true
    }
  };

  // =========================
  // UI
  // =========================
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

  // =========================
  // Heist items
  // =========================
  function createHeistItems(questions) {
    const items = [];
    const roundNumber = getRoundNumber();

    const northSlots = [
      { x: sx(980),  y: sy(285), w: sx(170), h: sy(68), anchorX: sx(1065), anchorY: sy(455), wall: 'north' },
      { x: sx(1370), y: sy(285), w: sx(170), h: sy(68), anchorX: sx(1455), anchorY: sy(455), wall: 'north' },
      { x: sx(1760), y: sy(285), w: sx(170), h: sy(68), anchorX: sx(1845), anchorY: sy(455), wall: 'north' }
    ];

    const westSlots = [
      { x: sx(500), y: sy(555), w: sx(58), h: sy(165), anchorX: sx(710), anchorY: sy(730), wall: 'west' },
      { x: sx(365), y: sy(900), w: sx(58), h: sy(165), anchorX: sx(620), anchorY: sy(1035), wall: 'west' }
    ];

    const eastSlots = [
      { x: sx(2280), y: sy(585), w: sx(58), h: sy(165), anchorX: sx(2110), anchorY: sy(770), wall: 'east' },
      { x: sx(2420), y: sy(940), w: sx(58), h: sy(165), anchorX: sx(2200), anchorY: sy(1085), wall: 'east' }
    ];

    const westSequence1 = [
      artImages.westVariants[1],
      artImages.westVariants[2],
      artImages.westVariants[0],
      artImages.westVariants[2],
      artImages.westVariants[0]
    ];

    const westSequence2 = [
      artImages.westVariants[2],
      artImages.westVariants[0],
      artImages.westVariants[1],
      artImages.westVariants[0],
      artImages.westVariants[1]
    ];

    let qIndex = 0;

    northSlots.forEach((slot, i) => {
      items.push({
        ...slot,
        id: `item-${qIndex}`,
        type: 'wall',
        status: 'available',
        question: questions[qIndex],
        image: artImages.north[i % artImages.north.length]
      });
      qIndex += 1;
    });

    items.push({
      ...westSlots[0],
      id: `item-${qIndex}`,
      type: 'wall',
      status: 'available',
      question: questions[qIndex],
      image: sequencePick(westSequence1, roundNumber)
    });
    qIndex += 1;

    items.push({
      ...westSlots[1],
      id: `item-${qIndex}`,
      type: 'wall',
      status: 'available',
      question: questions[qIndex],
      image: sequencePick(westSequence2, roundNumber)
    });
    qIndex += 1;

    eastSlots.forEach((slot, i) => {
      items.push({
        ...slot,
        id: `item-${qIndex}`,
        type: 'wall',
        status: 'available',
        question: questions[qIndex],
        image: artImages.east[i % artImages.east.length]
      });
      qIndex += 1;
    });

    const pedestalPos = randomFloorPoint(
      sx(1050), sx(1700),
      sy(930), sy(1190),
      []
    );

    items.push({
      id: `item-${qIndex}`,
      type: 'floor',
      floorKind: 'pedestal',
      status: 'available',
      question: questions[qIndex],
      image: artImages.pedestal,
      anchorX: pedestalPos.x,
      anchorY: pedestalPos.y,
      drawW: 78,
      drawH: 125
    });
    qIndex += 1;

    const aboardPos = randomFloorPoint(
      sx(1820), sx(2230),
      sy(930), sy(1220),
      [{ x: pedestalPos.x, y: pedestalPos.y }]
    );

    items.push({
      id: `item-${qIndex}`,
      type: 'floor',
      floorKind: 'aboard',
      status: 'available',
      question: questions[qIndex],
      image: artImages.aboard,
      anchorX: aboardPos.x,
      anchorY: aboardPos.y,
      drawW: 88,
      drawH: 135
    });

    return items;
  }

  function getNearbyItem() {
    if (!state.run) return null;

    let nearest = null;
    let nearestDist = Infinity;

    for (const item of state.run.items) {
      if (item.status !== 'available') continue;
      const d = distance(state.player.x, state.player.y, item.anchorX, item.anchorY);
      if (d < INTERACT_DISTANCE && d < nearestDist) {
        nearest = item;
        nearestDist = d;
      }
    }

    return nearest;
  }

  function getPullDirectionForItem(item) {
    if (item.type === 'wall') return item.wall;

    const dx = item.anchorX - state.player.x;
    if (dx > 22) return 'east';
    if (dx < -22) return 'west';
    return 'north';
  }

  // =========================
  // Game flow
  // =========================
  function startHeist() {
    const chosenQuestions = selectQuestions(9);

    state.run = {
      haul: 0,
      strikes: 0,
      items: createHeistItems(chosenQuestions),
      ended: false,
      mode: 'play'
    };

    state.activeItem = null;

    state.player = {
      x: sx(1410),
      y: sy(1220),
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    };

    state.guard = {
      x: (GUARD_DOOR_ZONE.x1 + GUARD_DOOR_ZONE.x2) / 2,
      y: GUARD_DOOR_ZONE.y2,
      direction: 'south-west',
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
    paintingsLeftEl.textContent = String(state.run.items.filter(i => i.status === 'available').length);
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

    const item = getNearbyItem();
    if (!item) {
      showBanner('Nothing to interact with here.');
      return;
    }

    state.activeItem = item;
    questionText.textContent = `${item.question.question} (${formatMoney(item.question.value)})`;
    answerInput.value = '';
    questionModal.classList.remove('hidden');
    answerInput.focus();
  }

  function startPullAnimation(item) {
    const pullDir = getPullDirectionForItem(item);

    state.player.controlLocked = true;
    state.run.mode = 'pull';
    state.player.action = {
      type: 'pull',
      dir: pullDir,
      item,
      frameIndex: 0,
      timer: 0
    };

    if (pullDir === 'north') state.player.direction = 'north';
    if (pullDir === 'west') state.player.direction = 'north-west';
    if (pullDir === 'east') state.player.direction = 'north-east';
  }

  function finishSuccessfulPull() {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    const item = action.item;
    const q = item.question;

    item.status = 'stolen';
    state.run.haul += Number(q.value);
    state.save.paintingsStolen += 1;
    state.save.usedQuestionIds.push(q.id);

    updateRunStats();
    showBanner(`Stolen! +${formatMoney(q.value)}`);

    state.player.action = null;
    state.player.controlLocked = false;
    state.run.mode = 'play';

    const anyAvailable = state.run.items.some(i => i.status === 'available');
    if (!anyAvailable) {
      showBanner('All items attempted. Head for the exit to bank your haul.');
    }
  }

  function submitAnswer() {
    if (!state.activeItem) return;

    const item = state.activeItem;
    const q = item.question;
    const input = answerInput.value;

    questionModal.classList.add('hidden');

    if (isAnswerCorrect(input, q)) {
      startPullAnimation(item);
    } else {
      item.status = 'failed';
      state.run.strikes += 1;
      updateRunStats();
      flashWrong();
      showBanner('Wrong answer. Security alert increased.');

      if (state.run.strikes >= 3) {
        triggerGuardChase();
      }
    }

    state.activeItem = null;
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
    showBanner('Security is coming...');
  }

  function returnCaughtToHub() {
    if (!state.run) return;

    const lostHaul = state.run.haul;

    state.run.ended = true;
    state.save.heistsPlayed += 1;
    saveProgress();

    state.run = null;
    state.activeItem = null;

    state.player.action = null;
    state.player.controlLocked = false;
    state.player.moving = false;
    state.player.visible = true;

    state.guard.active = false;
    state.guard.visible = true;

    summaryModal.classList.add('hidden');
    showScreen('hub');
    renderHubStats();
    showBanner(`Caught! You lost ${formatMoney(lostHaul)}.`);
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
      saveProgress();
      summaryModal.classList.remove('hidden');
      return;
    }

    saveProgress();
    returnCaughtToHub();
  }

  function returnToHub() {
    summaryModal.classList.add('hidden');
    state.run = null;
    showScreen('hub');
    renderHubStats();
  }

  // =========================
  // Animation / movement
  // =========================
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

  function tryMove(dx, dy, options = {}) {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    if (!pointInPolygon({ x: nx, y: ny }, FLOOR_POLY)) return;
    if (!options.ignoreBlockers && pointHitsFloorBlocker(nx, ny)) return;

    state.player.x = nx;
    state.player.y = ny;
  }

  function update(delta) {
    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden') && state.run.mode === 'play') return;

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
        state.player.direction = vectorToDirection(dx, dy);
        tryMove(dx, dy);
      }

      updateWalkAnimation(delta);

    } else if (state.run.mode === 'pull') {
      updatePullAnimation(delta);

    } else if (state.run.mode === 'chase') {
      const gdx = state.player.x - state.guard.x;
      const gdy = state.player.y - state.guard.y;
      const glen = Math.hypot(gdx, gdy) || 1;

      const gmx = (gdx / glen) * (GUARD_SPEED + 0.9);
      const gmy = (gdy / glen) * (GUARD_SPEED + 0.9);

      state.guard.direction = vectorToDirection(gmx, gmy);
      state.guard.x += gmx;
      state.guard.y += gmy;

      if (distance(state.guard.x, state.guard.y, state.player.x, state.player.y) < 24) {
        state.run.mode = 'escort';
        showBanner('Caught! Escorted out.');
      }

    } else if (state.run.mode === 'escort') {
      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
      const targetY = (EXIT_ZONE.y1 + EXIT_ZONE.y2) / 2;

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      if (len < 12) {
        returnCaughtToHub();
        return;
      }

      const mx = (dx / len) * MOVE_SPEED;
      const my = (dy / len) * MOVE_SPEED;

      state.player.moving = true;
      state.player.direction = vectorToDirection(mx, my);
      tryMove(mx, my, { ignoreBlockers: true });
      updateWalkAnimation(delta);

      const guardTargetX = state.player.x;
      const guardTargetY = state.player.y - 36;

      const egdx = guardTargetX - state.guard.x;
      const egdy = guardTargetY - state.guard.y;
      const eglen = Math.hypot(egdx, egdy) || 1;

      const egmx = (egdx / eglen) * GUARD_SPEED;
      const egmy = (egdy / eglen) * GUARD_SPEED;

      state.guard.direction = vectorToDirection(egmx, egmy);
      state.guard.x += egmx;
      state.guard.y += egmy;

    } else if (state.run.mode === 'escape') {
      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
      const targetY = EXIT_ZONE.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (dx / len) * MOVE_SPEED;
      const my = (dy / len) * MOVE_SPEED;

      state.player.moving = true;
      state.player.direction = vectorToDirection(mx, my);
      tryMove(mx, my, { ignoreBlockers: true });
      updateWalkAnimation(delta);

      if (state.player.y >= EXIT_ZONE.y2 - sy(10)) {
        state.player.visible = false;
        endHeist(true);
      }
    }
  }

  // =========================
  // Drawing
  // =========================
  function drawFallbackRoom() {
    ctx.fillStyle = '#20242b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawImageFit(img, x, y, w, h) {
    if (!imageReady(img)) return;
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawWallItem(item) {
    if (!imageReady(item.image)) {
      ctx.fillStyle = item.status === 'failed' ? '#8f4c4c' : '#ffffff';
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(item.x, item.y, item.w, item.h);
      return;
    }

    if (item.status === 'failed') {
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawImageFit(item.image, item.x, item.y, item.w, item.h);
      ctx.restore();

      ctx.strokeStyle = '#6b1f1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y);
      ctx.lineTo(item.x + item.w, item.y + item.h);
      ctx.stroke();
      return;
    }

    drawImageFit(item.image, item.x, item.y, item.w, item.h);
  }

  function drawFloorItem(item) {
    const drawW = item.drawW;
    const drawH = item.drawH;
    const drawX = item.anchorX - drawW / 2;
    const drawY = item.anchorY - drawH;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(item.anchorX, item.anchorY - 4, drawW * 0.32, drawH * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!imageReady(item.image)) {
      ctx.fillStyle = item.status === 'failed' ? '#8f4c4c' : '#ccc';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      return;
    }

    if (item.status === 'failed') {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(item.image, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.strokeStyle = '#6b1f1f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(drawX, drawY);
      ctx.lineTo(drawX + drawW, drawY + drawH);
      ctx.stroke();
      return;
    }

    ctx.drawImage(item.image, drawX, drawY, drawW, drawH);
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

  function drawFallbackPlayer() {
    const drawX = state.player.x - PLAYER_WIDTH / 2;
    const drawY = state.player.y - PLAYER_HEIGHT;

    ctx.fillStyle = '#f3d082';
    ctx.fillRect(drawX + 34, drawY + 14, 32, 72);
    ctx.fillStyle = '#222';
    ctx.fillRect(drawX + 44, drawY + 28, 6, 6);
    ctx.fillRect(drawX + 56, drawY + 28, 6, 6);
  }

  function drawPlayer() {
    if (!state.player.visible) return;

    const drawX = state.player.x - PLAYER_WIDTH / 2;
    const drawY = state.player.y - PLAYER_HEIGHT;
    const img = getCurrentPlayerImage();

    if (imageReady(img)) {
      ctx.drawImage(img, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
    } else {
      drawFallbackPlayer();
    }
  }

  function drawFallbackGuard() {
    const drawX = state.guard.x - GUARD_WIDTH / 2;
    const drawY = state.guard.y - GUARD_HEIGHT;
    ctx.fillStyle = '#6b8cff';
    ctx.fillRect(drawX + 32, drawY + 12, 34, 76);
  }

  function drawGuard() {
    if (!state.guard.active || !state.guard.visible) return;

    const drawX = state.guard.x - GUARD_WIDTH / 2;
    const drawY = state.guard.y - GUARD_HEIGHT;
    const img = guardSprites[state.guard.direction];

    if (imageReady(img)) {
      ctx.drawImage(img, drawX, drawY, GUARD_WIDTH, GUARD_HEIGHT);
    } else {
      drawFallbackGuard();
    }
  }

  function drawPrompt() {
    if (!state.run || state.run.mode !== 'play' || state.player.controlLocked) return;

    const item = getNearbyItem();
    if (item) {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(state.player.x - 60, state.player.y - PLAYER_HEIGHT - 24, 120, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.fillText('Press E / Interact', state.player.x - 48, state.player.y - PLAYER_HEIGHT - 10);
      return;
    }

    if (pointInRect(state.player.x, state.player.y, EXIT_ZONE)) {
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(state.player.x - 45, state.player.y - PLAYER_HEIGHT - 24, 90, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.fillText('Exit & bank', state.player.x - 28, state.player.y - PLAYER_HEIGHT - 10);
    }
  }

  function drawRoom() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imageReady(roomBackground)) {
      ctx.drawImage(roomBackground, 0, 0, canvas.width, canvas.height);
    } else {
      drawFallbackRoom();
    }

    if (state.run) {
      const wallItems = state.run.items.filter(i => i.type === 'wall' && i.status !== 'stolen');
      const floorItems = state.run.items.filter(i => i.type === 'floor' && i.status !== 'stolen');

      wallItems.forEach(drawWallItem);

      const floorDrawables = [];

      floorItems.forEach(item => {
        floorDrawables.push({
          y: item.anchorY,
          draw: () => drawFloorItem(item)
        });
      });

      if (state.player.visible) {
        floorDrawables.push({
          y: state.player.y,
          draw: drawPlayer
        });
      }

      if (state.guard.active && state.guard.visible) {
        floorDrawables.push({
          y: state.guard.y,
          draw: drawGuard
        });
      }

      floorDrawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    }

    drawPrompt();
  }

  function gameLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    update(delta);
    drawRoom();
    requestAnimationFrame(gameLoop);
  }

  // =========================
  // Events
  // =========================
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
    state.activeItem = null;
  });

  summaryContinueBtn.addEventListener('click', returnToHub);

  // =========================
  // Init
  // =========================
  renderHubStats();
  showScreen('hub');
  requestAnimationFrame(gameLoop);
})();
