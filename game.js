(() => {
  const hubScreen = document.getElementById('hubScreen');
  const gameScreen = document.getElementById('gameScreen');
  const startHeistBtn = document.getElementById('startHeistBtn');
  const backToHubBtn = document.getElementById('backToHubBtn');

  const totalBankedEl = document.getElementById('totalBanked');
  const bestHeistEl = document.getElementById('bestHeist');
  const heistsPlayedEl = document.getElementById('heistsPlayed');
  const paintingsStolenEl = document.getElementById('paintingsStolen');

  const haulValueEl = document.getElementById('haulValue');
  const strikesValueEl = document.getElementById('strikesValue');
  const paintingsLeftValueEl = document.getElementById('paintingsLeftValue');

  const questionModal = document.getElementById('questionModal');
  const questionTextEl = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  const cancelAnswerBtn = document.getElementById('cancelAnswerBtn');

  const summaryOverlay = document.getElementById('summaryOverlay');
  const summaryTitle = document.getElementById('summaryTitle');
  const summarySubtitle = document.getElementById('summarySubtitle');
  const summaryContinueBtn = document.getElementById('summaryContinueBtn');

  const banner = document.getElementById('gameBanner');

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const interactBtn = document.getElementById('interactBtn');
  const joystick = document.getElementById('joystick');
  const joystickButtons = Array.from(document.querySelectorAll('.joy-btn'));

  const SAVE_KEY = 'nanaHeistSave_v11';
  const LAST_HEIST_WRONG_KEY = 'nanaHeistLastWrong_v11';

  const SOURCE_W = 2816;
  const SOURCE_H = 1536;

  let VIEW_W = canvas.width;
  let VIEW_H = canvas.height;

  const sx = (x) => (x / SOURCE_W) * VIEW_W;
  const sy = (y) => (y / SOURCE_H) * VIEW_H;

  const MOVE_SPEED_DESKTOP = 2.35;
  const MOVE_SPEED_MOBILE = 3.35;
  const CHASE_PLAYER_SPEED = 2.6;
  const GUARD_CHASE_SPEED = 3.35;
  const GUARD_ESCORT_SPEED = 2.0;

  const WALK_FRAME_MS = 120;
  const RUN_FRAME_MS = 95;
  const GUARD_WALK_FRAME_MS = 130;
  const PULL_FRAME_MS = 120;

  const WRONG_FLASH_MS = 260;
  const SHAKE_MS = 260;
  const GUARD_FLASH_MS = 2200;
  const BANNER_MS = 2500;

  const INTERACT_DISTANCE = 90;
  const CATCH_DISTANCE = 28;

  function isMobileLike() {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 900
    );
  }

  function getMoveSpeed() {
    return isMobileLike() ? MOVE_SPEED_MOBILE : MOVE_SPEED_DESKTOP;
  }

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function imageReady(img) {
    return !!img && img.complete && img.naturalWidth > 0;
  }

  function createAudio(src, volume = 1, loop = false) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = volume;
    a.loop = loop;
    return a;
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return {
          totalBanked: 0,
          bestHeist: 0,
          heistsPlayed: 0,
          paintingsStolen: 0,
          usedQuestionIds: []
        };
      }
      const parsed = JSON.parse(raw);
      return {
        totalBanked: Number(parsed.totalBanked || 0),
        bestHeist: Number(parsed.bestHeist || 0),
        heistsPlayed: Number(parsed.heistsPlayed || 0),
        paintingsStolen: Number(parsed.paintingsStolen || 0),
        usedQuestionIds: Array.isArray(parsed.usedQuestionIds) ? parsed.usedQuestionIds : []
      };
    } catch {
      return {
        totalBanked: 0,
        bestHeist: 0,
        heistsPlayed: 0,
        paintingsStolen: 0,
        usedQuestionIds: []
      };
    }
  }

  function saveProgress() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
  }

  function loadLastHeistWrong() {
    try {
      const raw = localStorage.getItem(LAST_HEIST_WRONG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLastHeistWrong(items) {
    localStorage.setItem(LAST_HEIST_WRONG_KEY, JSON.stringify(items || []));
  }

  function formatMoney(pence) {
    return '£' + (pence / 100).toFixed(2);
  }

  function normalizeText(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9%.\-\s]/g, ' ')
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
    const d = levenshtein(a, b);
    return d <= 1 || d / Math.max(a.length, b.length) <= 0.15;
  }

  function isAnswerCorrect(input, question) {
    const cleanedInput = normalizeText(input);
    if (!cleanedInput) return false;

    const answers = Array.isArray(question.answers) ? question.answers.map(normalizeText) : [];

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

  function pointInRect(px, py, rect) {
    return px >= rect.x1 && px <= rect.x2 && py >= rect.y1 && py <= rect.y2;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        (yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.000001) + xi;

      if (intersect) inside = !inside;
    }
    return inside;
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

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  function showBanner(text) {
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add('show');
    clearTimeout(showBanner._timer);
    showBanner._timer = setTimeout(() => {
      banner.classList.remove('show');
      banner.textContent = '';
    }, BANNER_MS);
  }

  function renderHubStats() {
    if (totalBankedEl) totalBankedEl.textContent = formatMoney(state.save.totalBanked);
    if (bestHeistEl) bestHeistEl.textContent = formatMoney(state.save.bestHeist);
    if (heistsPlayedEl) heistsPlayedEl.textContent = String(state.save.heistsPlayed);
    if (paintingsStolenEl) paintingsStolenEl.textContent = String(state.save.paintingsStolen);
  }

  function updateRunStats() {
    if (!state.run) return;
    if (haulValueEl) haulValueEl.textContent = formatMoney(state.run.haul);
    if (strikesValueEl) strikesValueEl.textContent = `${state.run.strikes} / 3`;
    if (paintingsLeftValueEl) {
      const left = state.run.items.filter((i) => i.status === 'available').length;
      paintingsLeftValueEl.textContent = String(left);
    }
  }

  function safeRestartAudio(audio, volume = 1) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  function stopAudio(audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  const roomBackground = loadImage('museum-room.png');

  const backgroundMusic = createAudio('Minuet Antique.mp3', 0.22, true);
  const chaChingSound = createAudio('ChaChing.mp3', 0.9, false);
  const sirenSound = createAudio('Siren.mp3', 0.55, true);
  const withMeSound = createAudio('WithMe.mp3', 0.95, false);
  const heyStopSound = createAudio('Hey!Stop.mp3', 0.95, false);

  const failVoiceFiles = [
    'Didntwantthat.mp3',
    'GottaGetThemRight.mp3',
    'IllGetTheNext.mp3',
    'NextTime.mp3'
  ];

  function playRandomFailVoice() {
    if (!state.run) return;

    if (!state.run.failVoicePool || state.run.failVoicePool.length === 0) {
      state.run.failVoicePool = shuffle([...failVoiceFiles]);
    }

    const file = state.run.failVoicePool.shift();
    const audio = createAudio(file, 0.9, false);
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function stopAllGameAudio() {
    stopAudio(backgroundMusic);
    stopAudio(sirenSound);
    stopAudio(withMeSound);
    stopAudio(heyStopSound);
    stopAudio(chaChingSound);
  }

  function playHeyStopThenSiren() {
    state.audio.sirenStarted = false;

    const startSiren = () => {
      if (state.audio.sirenStarted) return;
      state.audio.sirenStarted = true;
      safeRestartAudio(sirenSound, 0.55);
    };

    try {
      heyStopSound.pause();
      heyStopSound.currentTime = 0;
      heyStopSound.volume = 0.95;
      heyStopSound.addEventListener('ended', startSiren, { once: true });
      const p = heyStopSound.play();
      if (p && typeof p.catch === 'function') p.catch(() => startSiren());
    } catch (_) {
      startSiren();
    }

    setTimeout(() => {
      if (state.run && (state.run.mode === 'chase' || state.run.mode === 'escort' || state.run.mode === 'escort_wait')) {
        startSiren();
      }
    }, 1200);
  }

  function playWithMe() {
    state.audio.withMeFinished = false;
    state.audio.withMePlayed = true;

    try {
      withMeSound.pause();
      withMeSound.currentTime = 0;
      withMeSound.onended = () => {
        state.audio.withMeFinished = true;
      };
      const p = withMeSound.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          state.audio.withMeFinished = true;
        });
      }
    } catch (_) {
      state.audio.withMeFinished = true;
    }
  }

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

  function loadSeq(prefix, count) {
    return Array.from({ length: count }, (_, i) => loadImage(`${prefix}${i}_delay-0.2s.png`));
  }

  const guardRunAnimations = {
    east: loadSeq('Security Guard East Running_', 6),
    west: loadSeq('Security Guard West Running_', 6),
    north: loadSeq('Security Guard North Running_', 6),
    south: loadSeq('Security Guard South Running_', 6),
    'north-east': loadSeq('Security Guard North-East Running_', 6),
    'north-west': loadSeq('Security Guard North-West Running_', 6),
    'south-east': loadSeq('Security Guard South-East Running_', 6),
    'south-west': loadSeq('Security Guard South-West Running_', 6)
  };

  const guardWalkAnimations = {
    south: loadSeq('Security Guard South Walking_', 6),
    'south-east': loadSeq('Security Guard South-East Walking_', 6),
    'south-west': loadSeq('Security Guard South-West Walking_', 6)
  };

  const guardFallbackSprites = {
    east: loadImage('Security Guard East.png'),
    west: loadImage('Security Guard West.png'),
    north: loadImage('Security Guard North.png'),
    south: loadImage('Security Guard South.png'),
    'north-east': loadImage('Security Guard North-East.png'),
    'north-west': loadImage('Security Guard North-West.png'),
    'south-east': loadImage('Security Guard South-East.png'),
    'south-west': loadImage('Security Guard South-West.png')
  };

  const artImages = {
    northA: loadImage('painting_abstract_small.png'),
    northB: loadImage('painting_mona_lisa_large.png'),
    northC: loadImage('painting_starry_night.png'),
    westA: loadImage('painting_landscape_left_angle.png'),
    westB: loadImage('painting_portrait_left_lower_angle.png'),
    westC: loadImage('painting_portrait_left_lower_angle_2.png'),
    westD: loadImage('painting_portrait_left_lower_angle_3.png'),
    eastA: loadImage('painting_portrait_right_angle.png'),
    eastB: loadImage('painting_mona_lisa_right_lower_angle.png'),
    aboard: loadImage('A-Board_Art_Piece.png'),
    pedestal: loadImage('statue_on_pedestal.png')
  };

  const state = {
    save: loadSave(),
    homework: {
      pending: loadLastHeistWrong()
    },
    screen: 'hub',
    keys: { up: false, down: false, left: false, right: false },
    run: null,
    activeItem: null,
    lastTimestamp: 0,
    player: {
      x: 0,
      y: 0,
      direction: 'south',
      moving: false,
      visible: true,
      controlLocked: false,
      walkFrameIndex: 0,
      walkFrameTimer: 0,
      action: null
    },
    guard: {
      x: 0,
      y: 0,
      direction: 'south-west',
      active: false,
      visible: true,
      mode: 'run',
      frameIndex: 0,
      frameTimer: 0,
      moving: false
    },
    fx: {
      wrongFlashTimer: 0,
      guardFlashTimer: 0,
      shakeTimer: 0,
      shakeX: 0,
      shakeY: 0
    },
    audio: {
      sirenStarted: false,
      withMePlayed: false,
      withMeFinished: true
    }
  };

  function getFloorPoly() {
    return [
      { x: sx(738), y: sy(730) },
      { x: sx(2073), y: sy(730) },
      { x: sx(2505), y: sy(1360) },
      { x: sx(281), y: sy(1360) }
    ];
  }

  function getExitZone() {
    return {
      x1: sx(1180),
      y1: sy(1280),
      x2: sx(1640),
      y2: sy(1495)
    };
  }

  function getGuardDoorZone() {
    return {
      x1: sx(2522),
      y1: sy(1174),
      x2: sx(2639),
      y2: sy(1325)
    };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = width;
    canvas.height = height;
    VIEW_W = width;
    VIEW_H = height;

    if (state.run) {
      buildScaledRunData(state.run);
    }
  }

  function markQuestionUsed(questionId) {
    if (!questionId) return;
    if (!state.save.usedQuestionIds.includes(questionId)) {
      state.save.usedQuestionIds.push(questionId);
      saveProgress();
    }
  }

  function getUnusedQuestions() {
    const bank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
    const used = new Set(state.save.usedQuestionIds);
    return bank.filter((q) => !used.has(q.id));
  }

  function chooseQuestionForItem(item) {
    if (item.question) return item.question;

    const available = getUnusedQuestions();
    if (available.length === 0) return null;

    const q = shuffle(available)[0];
    item.question = q;
    markQuestionUsed(q.id);
    return q;
  }

  function recordWrongQuestion(questionObj) {
    if (!questionObj || !state.run) return;
    const firstAnswer =
      Array.isArray(questionObj.answers) && questionObj.answers.length
        ? questionObj.answers[0]
        : '';
    state.run.wrongQuestions.push({
      question: questionObj.question,
      answer: firstAnswer
    });
  }

  function getFloorItemBlocker(item) {
    if (!item || item.type !== 'floor' || item.status === 'stolen') return null;

    return {
      x1: item.anchorX - item.drawW * 0.46,
      y1: item.anchorY - item.drawH * 0.18,
      x2: item.anchorX + item.drawW * 0.46,
      y2: item.anchorY + 10
    };
  }

  function pointHitsFloorBlocker(px, py) {
    if (!state.run) return false;

    for (const item of state.run.items) {
      const blocker = getFloorItemBlocker(item);
      if (blocker && pointInRect(px, py, blocker)) return true;
    }

    return false;
  }

  function isWalkablePoint(x, y, options = {}) {
    if (!pointInPolygon({ x, y }, getFloorPoly())) return false;
    if (!options.ignoreFloorBlockers && pointHitsFloorBlocker(x, y)) return false;
    return true;
  }

  function randomFloorPoint(minX, maxX, minY, maxY, avoid = []) {
    for (let i = 0; i < 500; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (!isWalkablePoint(x, y, { ignoreFloorBlockers: false })) continue;
      if (pointInRect(x, y, getExitZone())) continue;
      if (distance(x, y, sx(1410), sy(1220)) < 90) continue;

      let tooClose = false;
      for (const other of avoid) {
        if (distance(x, y, other.x, other.y) < 150) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) return { x, y };
    }

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  function createHeistItems() {
    const items = [];

    const northSlots = [
      { x: sx(898 - 175), y: sy(443 - 75), w: sx(350), h: sy(150), anchorX: sx(975), anchorY: sy(760), wall: 'north', image: artImages.northA },
      { x: sx(1414 - 175), y: sy(393 - 75), w: sx(350), h: sy(150), anchorX: sx(1410), anchorY: sy(760), wall: 'north', image: artImages.northB },
      { x: sx(1925 - 175), y: sy(440 - 75), w: sx(350), h: sy(150), anchorX: sx(1845), anchorY: sy(760), wall: 'north', image: artImages.northC }
    ];

    const westSlots = [
      { x: sx(503 - 80), y: sy(576 - 160), w: sx(160), h: sy(320), anchorX: sx(690), anchorY: sy(790), wall: 'west', image: artImages.westA },
      { x: sx(291 - 80), y: sy(806 - 160), w: sx(160), h: sy(320), anchorX: sx(530), anchorY: sy(1015), wall: 'west', image: shuffle([artImages.westB, artImages.westC, artImages.westD])[0] }
    ];

    const eastSlots = [
      { x: sx(2219 - 80), y: sy(525 - 160), w: sx(160), h: sy(320), anchorX: sx(2040), anchorY: sy(785), wall: 'east', image: artImages.eastA },
      { x: sx(2405 - 80), y: sy(721 - 160), w: sx(160), h: sy(320), anchorX: sx(2150), anchorY: sy(1015), wall: 'east', image: artImages.eastB }
    ];

    let index = 0;

    northSlots.forEach((slot) => {
      items.push({
        id: `item-${index++}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
    });

    westSlots.forEach((slot) => {
      items.push({
        id: `item-${index++}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
    });

    eastSlots.forEach((slot) => {
      items.push({
        id: `item-${index++}`,
        type: 'wall',
        status: 'available',
        question: null,
        ...slot
      });
    });

    const pedestalPos = randomFloorPoint(
      sx(1050), sx(1700),
      sy(930), sy(1190),
      []
    );

    items.push({
      id: `item-${index++}`,
      type: 'floor',
      floorKind: 'pedestal',
      status: 'available',
      question: null,
      image: artImages.pedestal,
      anchorX: pedestalPos.x,
      anchorY: pedestalPos.y,
      drawW: 78,
      drawH: 125
    });

    const aboardPos = randomFloorPoint(
      sx(1820), sx(2230),
      sy(930), sy(1220),
      [{ x: pedestalPos.x, y: pedestalPos.y }]
    );

    items.push({
      id: `item-${index++}`,
      type: 'floor',
      floorKind: 'aboard',
      status: 'available',
      question: null,
      image: artImages.aboard,
      anchorX: aboardPos.x,
      anchorY: aboardPos.y,
      drawW: 82,
      drawH: 128
    });

    return items;
  }

  function buildScaledRunData(run) {
    for (const item of run.items) {
      if (item.type === 'floor') {
        if (item.floorKind === 'pedestal') {
          item.drawW = Math.max(60, sx(78));
          item.drawH = Math.max(90, sy(125));
        } else {
          item.drawW = Math.max(60, sx(82));
          item.drawH = Math.max(90, sy(128));
        }
      }
    }
  }

  function startHeist() {
    hideHomeworkPopup();

    showScreen('game');
    resizeCanvas();

    state.run = {
      haul: 0,
      strikes: 0,
      items: createHeistItems(),
      wrongQuestions: [],
      ended: false,
      mode: 'play',
      failVoicePool: shuffle([...failVoiceFiles])
    };

    buildScaledRunData(state.run);
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

    const guardDoor = getGuardDoorZone();
    state.guard = {
      x: (guardDoor.x1 + guardDoor.x2) / 2,
      y: guardDoor.y2,
      direction: 'south-west',
      active: false,
      visible: true,
      mode: 'run',
      frameIndex: 0,
      frameTimer: 0,
      moving: false
    };

    state.audio.sirenStarted = false;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = true;

    stopAllGameAudio();
    safeRestartAudio(backgroundMusic, 0.22);

    updateRunStats();
    showBanner('Heist started.');
  }

  function interact() {
    if (!state.run || state.run.ended) return;
    if (state.player.controlLocked || state.player.action) return;

    const exit = getExitZone();

    if (
      (state.run.mode === 'play' || state.run.mode === 'chase') &&
      pointInRect(state.player.x, state.player.y, exit)
    ) {
      if (state.run.haul <= 0) {
        showBanner('You need some stolen art before escaping.');
        return;
      }

      state.player.controlLocked = true;
      state.run.mode = 'escape';
      state.player.direction = 'south';
      showBanner('Escaping...');
      return;
    }

    if (state.run.mode !== 'play') return;

    const item = getNearbyItem();
    if (!item) {
      showBanner('Nothing to interact with here.');
      return;
    }

    const q = chooseQuestionForItem(item);
    if (!q) {
      showBanner('No unused questions left.');
      return;
    }

    state.activeItem = item;
    questionTextEl.textContent = `${q.question} (${formatMoney(Number(q.value || 0))})`;
    answerInput.value = '';
    questionModal.classList.remove('hidden');
    window.scrollTo(0, 0);

    setTimeout(() => {
      try {
        answerInput.focus({ preventScroll: true });
      } catch (_) {
        answerInput.focus();
      }
    }, 0);
  }

  function submitAnswer() {
    if (!state.activeItem) return;

    const item = state.activeItem;
    const q = item.question;
    if (!q) {
      state.activeItem = null;
      questionModal.classList.add('hidden');
      return;
    }

    const input = answerInput.value;
    questionModal.classList.add('hidden');

    if (isAnswerCorrect(input, q)) {
      startPullAnimation(item);
    } else {
      item.status = 'failed';
      state.run.strikes += 1;
      recordWrongQuestion(q);
      updateRunStats();
      flashWrong();
      playRandomFailVoice();
      showBanner('Wrong answer. Security alert increased.');

      if (state.run.strikes >= 3) {
        triggerGuardChase();
      }
    }

    state.activeItem = null;
  }

  function remainingAvailableItems() {
    if (!state.run) return 0;
    return state.run.items.filter((i) => i.status === 'available').length;
  }

  function getNearbyItem() {
    if (!state.run || state.run.mode !== 'play') return null;

    let nearest = null;
    let nearestDist = Infinity;

    for (const item of state.run.items) {
      if (item.status !== 'available') continue;
      const d = distance(state.player.x, state.player.y, item.anchorX, item.anchorY);
      if (d < sx(INTERACT_DISTANCE) && d < nearestDist) {
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

  function updateGuardAnimation(delta) {
    if (!state.guard.active) return;

    const frameMs = state.guard.mode === 'walk' ? GUARD_WALK_FRAME_MS : RUN_FRAME_MS;
    if (!state.guard.moving) {
      state.guard.frameIndex = 0;
      state.guard.frameTimer = 0;
      return;
    }

    state.guard.frameTimer += delta;
    if (state.guard.frameTimer >= frameMs) {
      state.guard.frameTimer = 0;
      state.guard.frameIndex = (state.guard.frameIndex + 1) % 6;
    }
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
    state.run.haul += Number(q.value || 0);

    updateRunStats();
    showBanner(`Stolen! +${formatMoney(Number(q.value || 0))}`);
    safeRestartAudio(chaChingSound, 0.9);

    state.player.action = null;
    state.player.controlLocked = false;
    state.run.mode = 'play';

    if (remainingAvailableItems() === 0) {
      showBanner('All items attempted. Head for the exit.');
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

    if (!pointInPolygon({ x: nx, y: ny }, getFloorPoly())) return;
    if (!options.ignoreBlockers && pointHitsFloorBlocker(nx, ny)) return;

    state.player.x = nx;
    state.player.y = ny;
  }

  function moveTowards(entity, targetX, targetY, speed, dirResolver = vectorToDirection) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) {
      entity.moving = false;
      return;
    }

    const mx = (dx / len) * speed;
    const my = (dy / len) * speed;

    entity.x += mx;
    entity.y += my;
    entity.direction = dirResolver(mx, my);
    entity.moving = true;
  }

  function escortDirectionResolver(dx, dy) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'south';
    if (dy >= 0) {
      if (dx > 0.45) return 'south-east';
      if (dx < -0.45) return 'south-west';
      return 'south';
    }
    if (dx > 0.3) return 'south-east';
    if (dx < -0.3) return 'south-west';
    return 'south';
  }

  function flashWrong() {
    state.fx.wrongFlashTimer = WRONG_FLASH_MS;
    state.fx.shakeTimer = SHAKE_MS;
  }

  function updateFX(delta) {
    if (state.fx.wrongFlashTimer > 0) {
      state.fx.wrongFlashTimer = Math.max(0, state.fx.wrongFlashTimer - delta);
    }

    if (state.fx.guardFlashTimer > 0) {
      state.fx.guardFlashTimer = Math.max(0, state.fx.guardFlashTimer - delta);
    }

    if (state.fx.shakeTimer > 0) {
      state.fx.shakeTimer = Math.max(0, state.fx.shakeTimer - delta);
      state.fx.shakeX = (Math.random() - 0.5) * 10;
      state.fx.shakeY = (Math.random() - 0.5) * 8;
    } else {
      state.fx.shakeX = 0;
      state.fx.shakeY = 0;
    }
  }

  function triggerGuardChase() {
    state.guard.active = true;
    state.guard.visible = true;
    state.guard.mode = 'run';
    state.guard.frameIndex = 0;
    state.guard.frameTimer = 0;
    state.guard.moving = true;

    state.player.controlLocked = false;
    state.run.mode = 'chase';
    state.fx.guardFlashTimer = GUARD_FLASH_MS;
    state.audio.withMePlayed = false;
    state.audio.withMeFinished = false;

    playHeyStopThenSiren();
    showBanner('Security is coming...');
  }

  function triggerHeistEndHomework() {
    state.homework.pending = state.run?.wrongQuestions ? [...state.run.wrongQuestions] : [];
    saveLastHeistWrong(state.homework.pending);
  }

  function endHeist(escaped) {
    if (!state.run || state.run.ended) return;

    state.run.ended = true;
    stopAllGameAudio();
    triggerHeistEndHomework();

    if (escaped) {
      state.save.heistsPlayed += 1;
      state.save.totalBanked += state.run.haul;
      if (state.run.haul > state.save.bestHeist) {
        state.save.bestHeist = state.run.haul;
      }
      state.save.paintingsStolen += state.run.items.filter((i) => i.status === 'stolen').length;
      saveProgress();

      summaryTitle.textContent = 'Heist complete';
      summarySubtitle.textContent = `You escaped with ${formatMoney(state.run.haul)}. It has been added to your total banked cash.`;
      summaryOverlay.classList.remove('hidden');
      renderHubStats();
      return;
    }

    state.save.heistsPlayed += 1;
    saveProgress();
    renderHubStats();
    returnCaughtToHub();
  }

  function returnCaughtToHub() {
    if (!state.run) return;

    state.run.ended = true;
    state.run = null;
    state.activeItem = null;

    state.player.action = null;
    state.player.controlLocked = false;
    state.player.moving = false;
    state.player.visible = true;

    state.guard.active = false;
    state.guard.visible = true;

    summaryOverlay.classList.add('hidden');
    showScreen('hub');
    renderHubStats();
    maybeShowHomeworkPopup();
    showBanner('Caught! Better luck next heist.');
  }

  function returnToHub() {
    stopAllGameAudio();
    summaryOverlay.classList.add('hidden');
    state.run = null;
    state.activeItem = null;
    state.player.action = null;
    showScreen('hub');
    renderHubStats();
    maybeShowHomeworkPopup();
  }

  function update(delta) {
    updateFX(delta);

    if (state.screen !== 'game' || !state.run || state.run.ended) return;
    if (!questionModal.classList.contains('hidden') && state.run.mode === 'play') return;

    state.player.moving = false;
    state.guard.moving = false;

    if (state.run.mode === 'play') {
      let dx = 0;
      let dy = 0;

      if (state.keys.left) dx -= getMoveSpeed();
      if (state.keys.right) dx += getMoveSpeed();
      if (state.keys.up) dy -= getMoveSpeed();
      if (state.keys.down) dy += getMoveSpeed();

      if (dx !== 0 || dy !== 0) {
        state.player.moving = true;
        state.player.direction = vectorToDirection(dx, dy);
        tryMove(dx, dy);
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'pull') {
      updatePullAnimation(delta);
      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'chase') {
      let dx = 0;
      let dy = 0;

      if (state.keys.left) dx -= CHASE_PLAYER_SPEED;
      if (state.keys.right) dx += CHASE_PLAYER_SPEED;
      if (state.keys.up) dy -= CHASE_PLAYER_SPEED;
      if (state.keys.down) dy += CHASE_PLAYER_SPEED;

      if (dx !== 0 || dy !== 0) {
        state.player.moving = true;
        state.player.direction = vectorToDirection(dx, dy);
        tryMove(dx, dy);
      }

      moveTowards(state.guard, state.player.x, state.player.y, GUARD_CHASE_SPEED, vectorToDirection);

      if (distance(state.guard.x, state.guard.y, state.player.x, state.player.y) < CATCH_DISTANCE) {
        state.run.mode = 'escort';
        state.player.controlLocked = true;

        if (!state.audio.withMePlayed) {
          playWithMe();
        }

        showBanner('Caught! Escorted out.');
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'escort') {
      state.guard.mode = 'walk';

      const exit = getExitZone();
      const exitCenterX = (exit.x1 + exit.x2) / 2;
      const exitCenterY = (exit.y1 + exit.y2) / 2;

      moveTowards(state.guard, exitCenterX + 18, exitCenterY + 8, GUARD_ESCORT_SPEED, escortDirectionResolver);

      state.player.x = state.guard.x - 18;
      state.player.y = state.guard.y + 4;
      state.player.direction = 'south';
      state.player.moving = state.guard.moving;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (
        pointInRect(state.player.x, state.player.y, exit) ||
        pointInRect(state.guard.x, state.guard.y, exit)
      ) {
        state.run.mode = 'escort_wait';
      }

      return;
    }

    if (state.run.mode === 'escort_wait') {
      state.player.moving = false;
      state.guard.moving = false;
      state.player.direction = 'south';
      state.guard.direction = 'south';

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      const exit = getExitZone();
      const exitCenterX = (exit.x1 + exit.x2) / 2;
      const exitCenterY = (exit.y1 + exit.y2) / 2;

      state.player.x = exitCenterX - 16;
      state.player.y = exitCenterY + 6;
      state.guard.x = exitCenterX + 18;
      state.guard.y = exitCenterY + 8;

      if (state.audio.withMeFinished) {
        state.player.visible = false;
        state.guard.visible = false;
        endHeist(false);
      }
      return;
    }

    if (state.run.mode === 'escape') {
      const exit = getExitZone();
      const targetX = (exit.x1 + exit.x2) / 2;
      const targetY = exit.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (dx / len) * CHASE_PLAYER_SPEED;
      const my = (dy / len) * CHASE_PLAYER_SPEED;

      state.player.moving = true;
      state.player.direction = vectorToDirection(mx, my);
      state.player.x += mx;
      state.player.y += my;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (state.player.y >= exit.y2 - sy(10)) {
        state.player.visible = false;
        endHeist(true);
      }
    }
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

  function drawFallbackRoom() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#d8d8de');
    g.addColorStop(0.55, '#ded6cf');
    g.addColorStop(1, '#cfc6be');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(canvas.width * 0.22, canvas.height * 0.1, canvas.width * 0.56, canvas.height * 0.35);

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
  }

  function drawExitMat() {
    const exit = getExitZone();
    const matX = exit.x1 + 8;
    const matY = exit.y1 + 14;
    const matW = exit.x2 - exit.x1 - 16;
    const matH = 28;

    ctx.save();
    ctx.fillStyle = 'rgba(42,45,50,0.72)';
    ctx.fillRect(matX, matY, matW, matH);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(matX, matY, matW, matH);
    ctx.fillStyle = '#e9dfc8';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', matX + matW / 2, matY + matH / 2 + 1);
    ctx.restore();
  }

  function resolveItemImage(item) {
    return item.image || null;
  }

  function drawWallItem(item) {
    const img = resolveItemImage(item);
    if (!img) return;

    if (item.status === 'failed') {
      ctx.save();
      ctx.filter = 'grayscale(100%) brightness(0.65)';
      drawImageFit(img, item.x, item.y, item.w, item.h);
      ctx.restore();
      return;
    }

    drawImageFit(img, item.x, item.y, item.w, item.h);
  }

  function drawFloorItem(item) {
    const drawX = item.anchorX - item.drawW / 2;
    const drawY = item.anchorY - item.drawH;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(item.anchorX, item.anchorY - 4, item.drawW * 0.32, item.drawH * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const img = resolveItemImage(item);
    if (!img) return;

    if (item.status === 'failed') {
      ctx.save();
      ctx.filter = 'grayscale(100%) brightness(0.65)';
      ctx.drawImage(img, drawX, drawY, item.drawW, item.drawH);
      ctx.restore();
      return;
    }

    ctx.drawImage(img, drawX, drawY, item.drawW, item.drawH);
  }

  function getCurrentPlayerImage() {
    if (state.player.action && state.player.action.type === 'pull') {
      const set = pullAnimations[state.player.action.dir] || pullAnimations.north;
      return set[Math.min(state.player.action.frameIndex, set.length - 1)];
    }

    const set = walkAnimations[state.player.direction] || walkAnimations.south;
    return set[state.player.walkFrameIndex];
  }

  function drawFallbackPlayer() {
    const drawX = state.player.x - 50;
    const drawY = state.player.y - 100;

    ctx.fillStyle = '#f3d082';
    ctx.fillRect(drawX + 34, drawY + 14, 32, 72);
    ctx.fillStyle = '#222';
    ctx.fillRect(drawX + 44, drawY + 28, 6, 6);
    ctx.fillRect(drawX + 56, drawY + 28, 6, 6);
  }

  function drawPlayer() {
    if (!state.player.visible) return;

    const drawX = state.player.x - 50;
    const drawY = state.player.y - 100;
    const img = getCurrentPlayerImage();

    if (imageReady(img)) {
      ctx.drawImage(img, drawX, drawY, 100, 100);
    } else {
      drawFallbackPlayer();
    }
  }

  function getCurrentGuardImage() {
    if (state.guard.mode === 'walk') {
      const dir =
        state.guard.direction === 'south-east' || state.guard.direction === 'south-west' || state.guard.direction === 'south'
          ? state.guard.direction
          : 'south';
      const set = guardWalkAnimations[dir] || guardWalkAnimations.south;
      const frame = set[state.guard.frameIndex % set.length];
      if (imageReady(frame)) return frame;
      return guardFallbackSprites[dir] || guardFallbackSprites.south;
    }

    const runSet = guardRunAnimations[state.guard.direction] || guardRunAnimations.south;
    const runFrame = runSet[state.guard.frameIndex % runSet.length];
    if (imageReady(runFrame)) return runFrame;
    return guardFallbackSprites[state.guard.direction] || guardFallbackSprites.south;
  }

  function drawFallbackGuard() {
    const drawX = state.guard.x - 50;
    const drawY = state.guard.y - 100;
    ctx.fillStyle = '#6b8cff';
    ctx.fillRect(drawX + 32, drawY + 12, 34, 76);
  }

  function drawGuard() {
    if (!state.guard.active || !state.guard.visible) return;

    const drawX = state.guard.x - 50;
    const drawY = state.guard.y - 100;
    const img = getCurrentGuardImage();

    if (imageReady(img)) {
      ctx.drawImage(img, drawX, drawY, 100, 100);
    } else {
      drawFallbackGuard();
    }
  }

  function drawPrompt() {
    if (!state.run || state.run.mode !== 'play' || state.player.controlLocked) return;

    const item = getNearbyItem();
    if (item) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(state.player.x - 70, state.player.y - 124, 140, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Attempt to grab', state.player.x, state.player.y - 114);
      return;
    }

    if (pointInRect(state.player.x, state.player.y, getExitZone())) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(state.player.x - 30, state.player.y - 124, 60, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Exit', state.player.x, state.player.y - 114);
    }
  }

  function drawRoom() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(state.fx.shakeX, state.fx.shakeY);

    if (imageReady(roomBackground)) {
      ctx.drawImage(roomBackground, 0, 0, canvas.width, canvas.height);
    } else {
      drawFallbackRoom();
    }

    drawExitMat();

    if (state.run) {
      const wallItems = state.run.items.filter((i) => i.type === 'wall' && i.status !== 'stolen');
      const floorItems = state.run.items.filter((i) => i.type === 'floor' && i.status !== 'stolen');

      wallItems.forEach(drawWallItem);

      const drawables = [];
      floorItems.forEach((item) => {
        drawables.push({ y: item.anchorY, draw: () => drawFloorItem(item) });
      });

      if (state.player.visible) drawables.push({ y: state.player.y, draw: drawPlayer });
      if (state.guard.active && state.guard.visible) drawables.push({ y: state.guard.y, draw: drawGuard });

      drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    }

    drawPrompt();
    ctx.restore();

    if (state.fx.wrongFlashTimer > 0) {
      const alpha = (state.fx.wrongFlashTimer / WRONG_FLASH_MS) * 0.22;
      ctx.fillStyle = `rgba(255,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (
      state.fx.guardFlashTimer > 0 ||
      (state.run && (state.run.mode === 'chase' || state.run.mode === 'escort' || state.run.mode === 'escort_wait'))
    ) {
      const pulse = Math.floor(performance.now() / 120) % 2;
      ctx.fillStyle = pulse === 0 ? 'rgba(255,0,0,0.10)' : 'rgba(0,100,255,0.10)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function ensureHomeworkPopup() {
    if (document.getElementById('homeworkOverlay')) return;

    const style = document.createElement('style');
    style.textContent = `
      #homeworkOverlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.48);
        z-index: 9999;
        padding: 18px;
      }
      #homeworkOverlay.show {
        display: flex;
      }
      #homeworkBoard {
        width: min(760px, 94vw);
        max-height: 82vh;
        overflow: auto;
        background: linear-gradient(180deg, #1f3b2b 0%, #14261c 100%);
        border: 12px solid #6f5437;
        border-radius: 18px;
        box-shadow: 0 20px 55px rgba(0,0,0,0.45);
        color: #f2f5ef;
        padding: 22px 22px 18px;
        font-family: "Trebuchet MS", Arial, sans-serif;
      }
      #homeworkBoard h2 {
        margin: 0 0 6px;
        color: #f5f7f1;
        font-size: 30px;
        line-height: 1.1;
        text-align: center;
      }
      #homeworkBoard .chalk-sub {
        text-align: center;
        margin-bottom: 18px;
        font-size: 17px;
        color: #d9e8dd;
      }
      #homeworkList {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .homework-item {
        border-top: 1px dashed rgba(240,255,240,0.26);
        padding-top: 12px;
      }
      .homework-question {
        font-size: 17px;
        line-height: 1.35;
        color: #ffffff;
        margin-bottom: 6px;
      }
      .homework-answer {
        font-size: 16px;
        line-height: 1.3;
        color: #d6f2d2;
      }
      .homework-close {
        display: block;
        margin: 18px auto 0;
        border: none;
        border-radius: 999px;
        background: #ece7d8;
        color: #1b1b1b;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'homeworkOverlay';
    overlay.innerHTML = `
      <div id="homeworkBoard" role="dialog" aria-modal="true" aria-labelledby="homeworkTitle">
        <h2 id="homeworkTitle">Preparation for Next Heist</h2>
        <div class="chalk-sub">Best do your homework.</div>
        <div id="homeworkList"></div>
        <button class="homework-close" id="homeworkCloseBtn">Got it</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideHomeworkPopup();
    });

    const closeBtn = document.getElementById('homeworkCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', hideHomeworkPopup);
  }

  function maybeShowHomeworkPopup() {
    ensureHomeworkPopup();
    if (!state.homework.pending.length || state.screen !== 'hub') return;

    const overlay = document.getElementById('homeworkOverlay');
    const list = document.getElementById('homeworkList');
    if (!overlay || !list) return;

    list.innerHTML = '';

    state.homework.pending.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'homework-item';
      item.innerHTML = `
        <div class="homework-question">${entry.question}</div>
        <div class="homework-answer">Answer: ${entry.answer}</div>
      `;
      list.appendChild(item);
    });

    overlay.classList.add('show');
  }

  function hideHomeworkPopup() {
    ensureHomeworkPopup();
    const overlay = document.getElementById('homeworkOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  function showScreen(name) {
    state.screen = name;
    if (hubScreen) hubScreen.classList.toggle('active', name === 'hub');
    if (gameScreen) gameScreen.classList.toggle('active', name === 'game');

    if (name === 'game') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.body.style.touchAction = 'none';
      canvas.style.touchAction = 'none';
      window.scrollTo(0, 0);
      resizeCanvas();
    } else {
      stopAllGameAudio();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.body.style.touchAction = '';
      canvas.style.touchAction = '';
    }
  }

  function applyJoystickLayout() {
    if (!joystick) return;

    joystick.style.position = 'relative';
    joystick.style.width = '168px';
    joystick.style.height = '112px';
    joystick.style.display = 'block';

    const up = joystick.querySelector('[data-dir="up"]');
    const down = joystick.querySelector('[data-dir="down"]');
    const left = joystick.querySelector('[data-dir="left"]');
    const right = joystick.querySelector('[data-dir="right"]');

    [up, down, left, right].forEach((btn) => {
      if (!btn) return;
      btn.style.position = 'absolute';
      btn.style.width = '48px';
      btn.style.height = '48px';
    });

    if (up) {
      up.style.left = '56px';
      up.style.top = '0px';
    }
    if (left) {
      left.style.left = '0px';
      left.style.top = '56px';
    }
    if (down) {
      down.style.left = '56px';
      down.style.top = '56px';
    }
    if (right) {
      right.style.left = '112px';
      right.style.top = '56px';
    }
  }

  answerInput.style.fontSize = '16px';
  answerInput.style.lineHeight = '1.2';
  answerInput.style.transform = 'translateZ(0)';
  answerInput.autocapitalize = 'off';
  answerInput.autocomplete = 'off';
  answerInput.spellcheck = false;

  document.addEventListener(
    'touchmove',
    (e) => {
      if (state.screen === 'game') {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

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

    if (k === 'escape') {
      hideHomeworkPopup();
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
    const press = (val) => {
      state.keys[map[dir]] = val;
    };

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      press(true);
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      press(false);
    }, { passive: false });

    btn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      press(false);
    }, { passive: false });

    btn.addEventListener('mousedown', () => press(true));
    btn.addEventListener('mouseup', () => press(false));
    btn.addEventListener('mouseleave', () => press(false));
  });

  if (interactBtn) interactBtn.addEventListener('click', interact);
  if (startHeistBtn) startHeistBtn.addEventListener('click', startHeist);

  if (backToHubBtn) {
    backToHubBtn.addEventListener('click', () => {
      stopAllGameAudio();
      state.run = null;
      state.activeItem = null;
      state.player.action = null;
      showScreen('hub');
      renderHubStats();
      maybeShowHomeworkPopup();
    });
  }

  if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', submitAnswer);

  if (cancelAnswerBtn) {
    cancelAnswerBtn.addEventListener('click', () => {
      questionModal.classList.add('hidden');
      state.activeItem = null;
    });
  }

  if (summaryContinueBtn) {
    summaryContinueBtn.addEventListener('click', returnToHub);
  }

  window.addEventListener('resize', resizeCanvas);

  function gameLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    try {
      update(delta);
      drawRoom();
    } catch (err) {
      console.error(err);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game error - check console', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(gameLoop);
  }

  renderHubStats();
  showScreen('hub');
  applyJoystickLayout();
  ensureHomeworkPopup();
  resizeCanvas();
  requestAnimationFrame(gameLoop);
})();
