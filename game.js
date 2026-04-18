(() => {
  const hubScreen = document.getElementById('hubScreen');
  const gameScreen = document.getElementById('gameScreen');
  const startHeistBtn = document.getElementById('startHeistBtn');
  const resetProgressBtn = document.getElementById('resetProgressBtn');
  const backToHubBtn = document.getElementById('backToHubBtn');

  const haulValueEl = document.getElementById('haulValue');
  const strikesValueEl = document.getElementById('strikesValue');
  const paintingsLeftValueEl = document.getElementById('paintingsLeftValue');

  const totalBankedEl = document.getElementById('totalBanked');
  const bestHeistEl = document.getElementById('bestHeist');
  const heistsPlayedEl = document.getElementById('heistsPlayed');
  const paintingsStolenEl = document.getElementById('paintingsStolen');

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const joystick = document.getElementById('joystick');
  const joystickButtons = Array.from(document.querySelectorAll('.joy-btn'));
  const interactBtn = document.getElementById('interactBtn');

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

  const SAVE_KEY = 'nanaHeistSave_v11';
  const LAST_HEIST_WRONG_KEY = 'nanaHeistLastWrong_v11';

  const ROOM_W = 2556;
  const ROOM_H = 1538;

  const FLOOR_POLY = [
    { x: 281, y: 1360 },
    { x: 738, y: 730 },
    { x: 2073, y: 730 },
    { x: 2505, y: 1360 }
  ];

  const EXIT_ZONE_RAW = { x1: 2288, y1: 1090, x2: 2478, y2: 1360 };

  const PLAYER_WIDTH = 96;
  const PLAYER_HEIGHT = 96;
  const GUARD_WIDTH = 96;
  const GUARD_HEIGHT = 96;

  const MOVE_SPEED = 3.2;
  const GUARD_CHASE_SPEED = 4.8;
  const GUARD_ESCORT_SPEED = 2.4;
  const PLAYER_PULL_SPEED = 2.15;

  const PLAYER_FRAME_MS = 120;
  const GUARD_RUN_FRAME_MS = 90;
  const GUARD_WALK_FRAME_MS = 130;
  const BANNER_MS = 2200;
  const WRONG_FLASH_MS = 420;
  const WRONG_SHAKE_MS = 330;
  const GUARD_FLASH_MS = 2600;
  const QUESTION_MAX_STRIKES = 3;
  const SCALE_MOBILE_SPEED = 1.28;
  const CATCH_DISTANCE = 34;

  let scaleX = 1;
  let scaleY = 1;

  function sx(v) { return v * scaleX; }
  function sy(v) { return v * scaleY; }

  function scaleRect(r) {
    return {
      x1: sx(r.x1),
      y1: sy(r.y1),
      x2: sx(r.x2),
      y2: sy(r.y2)
    };
  }

  function pointInRect(px, py, rect) {
    return px >= rect.x1 && px <= rect.x2 && py >= rect.y1 && py <= rect.y2;
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function vectorToDirection(dx, dy) {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'south';
    const angle = Math.atan2(dy, dx);
    const oct = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8;
    return ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][oct];
  }

  function escortDirection(dx, dy, fallback = 'south') {
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback;
    if (dy >= 0) {
      if (dx > 0.45) return 'southeast';
      if (dx < -0.45) return 'southwest';
      return 'south';
    }
    if (dx > 0.3) return 'southeast';
    if (dx < -0.3) return 'southwest';
    return 'south';
  }

  function pointInPoly(point, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect =
        (yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function scaledFloorPoly() {
    return FLOOR_POLY.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  }

  function img(src) {
    const i = new Image();
    i.src = src;
    return i;
  }

  function loadSeq(prefix, count) {
    return Array.from({ length: count }, (_, i) => img(`${prefix}${i}_delay-0.2s.png`));
  }

  function imageReady(image) {
    return image && image.complete && image.naturalWidth > 0;
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

  const state = {
    screen: 'hub',
    save: loadSave(),
    homework: {
      pending: loadLastHeistWrong()
    },
    run: null,
    activeItem: null,
    lastTimestamp: 0,
    keys: { up: false, down: false, left: false, right: false },
    fx: {
      bannerTimer: 0,
      wrongFlashTimer: 0,
      wrongShakeTimer: 0,
      guardFlashTimer: 0,
      shakeX: 0,
      shakeY: 0
    },
    audio: {
      music: null,
      siren: null,
      heyStop: null,
      withMe: null,
      withMePlayed: false,
      withMeFinished: false
    },
    player: {
      x: 0,
      y: 0,
      visible: true,
      direction: 'south',
      frameIndex: 0,
      frameTimer: 0,
      moving: false,
      controlLocked: false,
      action: null
    },
    guard: {
      active: false,
      visible: true,
      x: 0,
      y: 0,
      direction: 'south',
      frameIndex: 0,
      frameTimer: 0,
      moving: false,
      mode: 'run'
    }
  };

  const roomBackground = img('museum_room.png');

  const walkAnimations = {
    north: [
      img('Nana North Walking_0_delay-0.2s.png'),
      img('Nana North Walking_1_delay-0.2s.png'),
      img('Nana North Walking_2_delay-0.2s.png')
    ],
    south: [
      img('Nana South Walking_0_delay-0.2s.png'),
      img('Nana South Walking_1_delay-0.2s.png'),
      img('Nana South Walking_2_delay-0.2s.png')
    ],
    east: [
      img('Nana East Walking_0_delay-0.2s.png'),
      img('Nana East Walking_1_delay-0.2s.png'),
      img('Nana East Walking_2_delay-0.2s.png')
    ],
    west: [
      img('Nana West Walking_0_delay-0.2s.png'),
      img('Nana West Walking_1_delay-0.2s.png'),
      img('Nana West Walking_2_delay-0.2s.png')
    ],
    northeast: [
      img('Nana North-East Walking_0_delay-0.2s.png'),
      img('Nana North-East Walking_1_delay-0.2s.png'),
      img('Nana North-East Walking_2_delay-0.2s.png')
    ],
    northwest: [
      img('Nana North-West Walking_0_delay-0.2s.png'),
      img('Nana North-West Walking_1_delay-0.2s.png'),
      img('Nana North-West Walking_2_delay-0.2s.png')
    ],
    southeast: [
      img('Nana South-East Walking_0_delay-0.2s.png'),
      img('Nana South-East Walking_1_delay-0.2s.png'),
      img('Nana South-East Walking_2_delay-0.2s.png')
    ],
    southwest: [
      img('Nana South-West Walking_0_delay-0.2s.png'),
      img('Nana South-West Walking_1_delay-0.2s.png'),
      img('Nana South-West Walking_2_delay-0.2s.png')
    ]
  };

  /* uses walking sprites during pull so the game still works even if pulling frames are absent */
  const pullAnimations = {
    north: walkAnimations.north,
    south: walkAnimations.south,
    east: walkAnimations.east,
    west: walkAnimations.west,
    northeast: walkAnimations.northeast,
    northwest: walkAnimations.northwest,
    southeast: walkAnimations.southeast,
    southwest: walkAnimations.southwest
  };

  const guardRunAnimations = {
    east: loadSeq('Security Guard East Running_', 6),
    west: loadSeq('Security Guard West Running_', 6),
    north: loadSeq('Security Guard North Running_', 6),
    south: loadSeq('Security Guard South Running_', 6),
    northeast: loadSeq('Security Guard North-East Running_', 6),
    northwest: loadSeq('Security Guard North-West Running_', 6),
    southeast: loadSeq('Security Guard South-East Running_', 6),
    southwest: loadSeq('Security Guard South-West Running_', 6)
  };

  const guardWalkAnimations = {
    south: loadSeq('Security Guard South Walking_', 6),
    southeast: loadSeq('Security Guard South-East Walking_', 6),
    southwest: loadSeq('Security Guard South-West Walking_', 6)
  };

  const failVoiceFiles = [
    'Didntwantthat.mp3',
    'GottaGetThemRight.mp3',
    'IllGetTheNext.mp3',
    'NextTime.mp3'
  ];

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    scaleX = rect.width / ROOM_W;
    scaleY = rect.height / ROOM_H;

    if (state.run) buildScaledRunData(state.run);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function isMobileLike() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function getMoveSpeed() {
    return MOVE_SPEED * (isMobileLike() ? SCALE_MOBILE_SPEED : 1);
  }

  function renderHubStats() {
    if (totalBankedEl) totalBankedEl.textContent = `£${(state.save.totalBanked / 100).toFixed(2)}`;
    if (bestHeistEl) bestHeistEl.textContent = `£${(state.save.bestHeist / 100).toFixed(2)}`;
    if (heistsPlayedEl) heistsPlayedEl.textContent = `${state.save.heistsPlayed}`;
    if (paintingsStolenEl) paintingsStolenEl.textContent = `${state.save.paintingsStolen}`;
  }

  function setHeistHeader(haul, strikes, left) {
    if (haulValueEl) haulValueEl.textContent = `£${(haul / 100).toFixed(2)}`;
    if (strikesValueEl) strikesValueEl.textContent = `${strikes} / ${QUESTION_MAX_STRIKES}`;
    if (paintingsLeftValueEl) paintingsLeftValueEl.textContent = `${left}`;
  }

  function showBanner(text) {
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add('show');
    state.fx.bannerTimer = BANNER_MS;
  }

  function updateBanner(delta) {
    if (state.fx.bannerTimer > 0) {
      state.fx.bannerTimer -= delta;
      if (state.fx.bannerTimer <= 0) {
        state.fx.bannerTimer = 0;
        if (banner) banner.classList.remove('show');
      }
    }
  }

  function startWrongFX() {
    state.fx.wrongFlashTimer = WRONG_FLASH_MS;
    state.fx.wrongShakeTimer = WRONG_SHAKE_MS;
  }

  function startGuardFX() {
    state.fx.guardFlashTimer = GUARD_FLASH_MS;
  }

  function updateFX(delta) {
    if (state.fx.wrongFlashTimer > 0) {
      state.fx.wrongFlashTimer = Math.max(0, state.fx.wrongFlashTimer - delta);
    }

    if (state.fx.guardFlashTimer > 0) {
      state.fx.guardFlashTimer = Math.max(0, state.fx.guardFlashTimer - delta);
    }

    if (state.fx.wrongShakeTimer > 0) {
      state.fx.wrongShakeTimer = Math.max(0, state.fx.wrongShakeTimer - delta);
      const p = state.fx.wrongShakeTimer / WRONG_SHAKE_MS;
      const mag = 7 * p;
      state.fx.shakeX = (Math.random() * 2 - 1) * mag;
      state.fx.shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      state.fx.shakeX = 0;
      state.fx.shakeY = 0;
    }

    updateBanner(delta);
  }

  function stopBackgroundMusic() {
    if (state.audio.music) {
      state.audio.music.pause();
      state.audio.music.currentTime = 0;
      state.audio.music = null;
    }
  }

  function playBackgroundMusic() {
    stopBackgroundMusic();
    state.audio.music = createAudio('BackgroundMusic.mp3', 0.42, true);
    state.audio.music.play().catch(() => {});
  }

  function playGuardAlert() {
    if (state.audio.heyStop) {
      state.audio.heyStop.pause();
      state.audio.heyStop.currentTime = 0;
    }
    if (state.audio.siren) {
      state.audio.siren.pause();
      state.audio.siren.currentTime = 0;
    }

    state.audio.heyStop = createAudio('HeyStop.mp3', 0.9, false);
    state.audio.siren = createAudio('Siren.mp3', 0.55, true);

    state.audio.heyStop.play().then(() => {
      state.audio.heyStop.addEventListener('ended', () => {
        if (state.audio.siren) state.audio.siren.play().catch(() => {});
      }, { once: true });
    }).catch(() => {
      if (state.audio.siren) state.audio.siren.play().catch(() => {});
    });
  }

  function playWithMe() {
    if (state.audio.withMePlayed) return;
    state.audio.withMePlayed = true;
    state.audio.withMeFinished = false;

    if (state.audio.withMe) {
      state.audio.withMe.pause();
      state.audio.withMe.currentTime = 0;
    }

    state.audio.withMe = createAudio('WithMe.mp3', 0.9, false);
    state.audio.withMe.addEventListener('ended', () => {
      state.audio.withMeFinished = true;
    }, { once: true });
    state.audio.withMe.play().catch(() => {
      state.audio.withMeFinished = true;
    });
  }

  function playRandomFailVoice() {
    if (!failVoiceFiles.length) return;
    const file = failVoiceFiles[Math.floor(Math.random() * failVoiceFiles.length)];
    const a = createAudio(file, 0.88, false);
    a.play().catch(() => {});
  }

  function stopAllGameAudio() {
    stopBackgroundMusic();
    ['siren', 'heyStop', 'withMe'].forEach((key) => {
      const a = state.audio[key];
      if (a) {
        a.pause();
        a.currentTime = 0;
        state.audio[key] = null;
      }
    });
  }

  function normalizeAnswer(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9%.\- ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getQuestionBank() {
    return Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  }

  function getUnusedQuestions() {
    const used = new Set(state.save.usedQuestionIds);
    return getQuestionBank().filter((q) => !used.has(q.id));
  }

  function markQuestionUsed(id) {
    if (!id) return;
    if (!state.save.usedQuestionIds.includes(id)) {
      state.save.usedQuestionIds.push(id);
      saveProgress();
    }
  }

  function chooseQuestionForItem(item) {
    if (item.question) return item.question;
    const available = getUnusedQuestions();
    if (!available.length) return null;
    const q = available[Math.floor(Math.random() * available.length)];
    item.question = q;
    markQuestionUsed(q.id);
    return q;
  }

  function answerMatches(questionObj, submitted) {
    const norm = normalizeAnswer(submitted);
    if (!norm) return false;
    const answers = Array.isArray(questionObj.answers) ? questionObj.answers : [];

    if (questionObj.matchType === 'contains') {
      return answers.some((a) => {
        const n = normalizeAnswer(a);
        return norm.includes(n) || n.includes(norm);
      });
    }

    return answers.some((a) => norm === normalizeAnswer(a));
  }

  function recordWrongQuestion(questionObj) {
    if (!questionObj || !state.run) return;
    const answer = Array.isArray(questionObj.answers) && questionObj.answers.length
      ? questionObj.answers[0]
      : '';
    state.run.wrongQuestions.push({
      question: questionObj.question,
      answer
    });
  }

  function resolveItemImage(item) {
    return item.image;
  }

  function createRunItems() {
    const wallScale = 4.0;

    return [
      {
        id: 'back_left',
        type: 'wall',
        x: sx(731),
        y: sy(477),
        w: sx(79 * wallScale),
        h: sy(57 * wallScale),
        image: img('painting_back_wall_left.png'),
        value: 1400,
        status: 'available',
        question: null
      },
      {
        id: 'back_center',
        type: 'wall',
        x: sx(1201),
        y: sy(431),
        w: sx(55 * wallScale),
        h: sy(83 * wallScale),
        image: img('painting_back_wall_center.png'),
        value: 1600,
        status: 'available',
        question: null
      },
      {
        id: 'back_right',
        type: 'wall',
        x: sx(1704),
        y: sy(469),
        w: sx(88 * wallScale),
        h: sy(56 * wallScale),
        image: img('painting_back_wall_right.png'),
        value: 1500,
        status: 'available',
        question: null
      },
      {
        id: 'left_upper',
        type: 'wall',
        x: sx(370),
        y: sy(563),
        w: sx(53 * wallScale),
        h: sy(74 * wallScale),
        image: img('painting_portrait_left_upper.png'),
        value: 1300,
        status: 'available',
        question: null
      },
      {
        id: 'left_lower',
        type: 'wall',
        x: sx(122),
        y: sy(817),
        w: sx(64 * wallScale),
        h: sy(93 * wallScale),
        image: img('painting_portrait_left_lower_angle.png'),
        value: 1250,
        status: 'available',
        question: null
      },
      {
        id: 'right_upper',
        type: 'wall',
        x: sx(2144),
        y: sy(601),
        w: sx(67 * wallScale),
        h: sy(101 * wallScale),
        image: img('painting_portrait_right_upper.png'),
        value: 1300,
        status: 'available',
        question: null
      },
      {
        id: 'right_lower',
        type: 'wall',
        x: sx(2276),
        y: sy(832),
        w: sx(64 * wallScale),
        h: sy(93 * wallScale),
        image: img('painting_portrait_right_lower_angle.png'),
        value: 1250,
        status: 'available',
        question: null
      },
      {
        id: 'pedestal',
        type: 'floor',
        floorType: 'pedestal',
        image: img('pedestal.png'),
        drawW: sx(130),
        drawH: sy(180),
        blockW: sx(120),
        blockH: sy(80),
        value: 1700,
        status: 'available',
        question: null,
        anchorX: 0,
        anchorY: 0,
        block: { x1: 0, y1: 0, x2: 0, y2: 0 }
      },
      {
        id: 'aboard',
        type: 'floor',
        floorType: 'aboard',
        image: img('ABOARD_ART_PIECE.PNG'),
        drawW: sx(120),
        drawH: sy(190),
        blockW: sx(110),
        blockH: sy(88),
        value: 1100,
        status: 'available',
        question: null,
        anchorX: 0,
        anchorY: 0,
        block: { x1: 0, y1: 0, x2: 0, y2: 0 }
      }
    ];
  }

  function randomFloorPosition(type) {
    const poly = scaledFloorPoly();
    const minX = Math.min(...poly.map((p) => p.x));
    const maxX = Math.max(...poly.map((p) => p.x));
    const minY = Math.min(...poly.map((p) => p.y));
    const maxY = Math.max(...poly.map((p) => p.y));

    let attempts = 0;
    while (attempts++ < 500) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + sy(90) + Math.random() * (maxY - minY - sy(160));

      if (!pointInPoly({ x, y }, poly)) continue;
      if (type === 'aboard' && x < sx(1450)) continue;
      if (type === 'pedestal' && x > sx(1980)) continue;

      const blockW = type === 'aboard' ? sx(110) : sx(120);
      const blockH = type === 'aboard' ? sy(88) : sy(80);

      const block = {
        x1: x - blockW / 2,
        y1: y - blockH,
        x2: x + blockW / 2,
        y2: y
      };

      let overlaps = false;
      if (state.run) {
        for (const item of state.run.items) {
          if (item.type !== 'floor') continue;
          const b = item.block;
          const sep =
            block.x2 < b.x1 - sx(18) ||
            block.x1 > b.x2 + sx(18) ||
            block.y2 < b.y1 - sy(18) ||
            block.y1 > b.y2 + sy(18);
          if (!sep) {
            overlaps = true;
            break;
          }
        }
      }

      if (!overlaps) return { x, y };
    }

    return type === 'aboard'
      ? { x: sx(2010), y: sy(1150) }
      : { x: sx(1090), y: sy(1080) };
  }

  function buildScaledRunData(run) {
    for (const item of run.items) {
      if (item.type === 'floor') {
        item.drawW = item.floorType === 'aboard' ? sx(120) : sx(130);
        item.drawH = item.floorType === 'aboard' ? sy(190) : sy(180);
        item.blockW = item.floorType === 'aboard' ? sx(110) : sx(120);
        item.blockH = item.floorType === 'aboard' ? sy(88) : sy(80);
      }
    }

    for (const item of run.items) {
      if (item.type === 'floor') {
        if (!item.anchorX || !item.anchorY) {
          const pos = randomFloorPosition(item.floorType);
          item.anchorX = pos.x;
          item.anchorY = pos.y;
        }
        item.block = {
          x1: item.anchorX - item.blockW / 2,
          y1: item.anchorY - item.blockH,
          x2: item.anchorX + item.blockW / 2,
          y2: item.anchorY
        };
      }
    }
  }

  let EXIT_ZONE = scaleRect(EXIT_ZONE_RAW);

  function remainingItemsCount() {
    if (!state.run) return 0;
    return state.run.items.filter((i) => i.status !== 'stolen').length;
  }

  function canStandAt(x, y, actor = 'player') {
    const poly = scaledFloorPoly();
    if (!pointInPoly({ x, y }, poly)) return false;

    if (state.run) {
      for (const item of state.run.items) {
        if (item.type !== 'floor') continue;
        if (item.status === 'stolen') continue;
        if (pointInRect(x, y, item.block)) return false;
      }
    }

    if (
      actor === 'player' &&
      state.guard.active &&
      state.guard.visible &&
      state.run &&
      (state.run.mode === 'play' || state.run.mode === 'chase')
    ) {
      if (Math.abs(x - state.guard.x) < 22 && Math.abs(y - state.guard.y) < 14) {
        return false;
      }
    }

    return true;
  }

  function startHeist() {
    hideHomeworkPopup();

    const items = createRunItems();

    state.run = {
      haul: 0,
      strikes: 0,
      items,
      roundIndex: Math.floor(Math.random() * 100000),
      wrongQuestions: [],
      mode: 'play'
    };

    buildScaledRunData(state.run);
    EXIT_ZONE = scaleRect(EXIT_ZONE_RAW);

    state.player.x = sx(1380);
    state.player.y = sy(1210);
    state.player.direction = 'south';
    state.player.frameIndex = 0;
    state.player.frameTimer = 0;
    state.player.visible = true;
    state.player.moving = false;
    state.player.controlLocked = false;
    state.player.action = null;

    state.guard.active = false;
    state.guard.visible = true;
    state.guard.x = sx(2440);
    state.guard.y = sy(1180);
    state.guard.direction = 'west';
    state.guard.frameIndex = 0;
    state.guard.frameTimer = 0;
    state.guard.moving = false;
    state.guard.mode = 'run';

    state.audio.withMePlayed = false;
    state.audio.withMeFinished = false;

    setHeistHeader(state.run.haul, state.run.strikes, remainingItemsCount());
    showScreen('game');
    playBackgroundMusic();
  }

  function getNearbyItem() {
    if (!state.run || state.run.mode !== 'play') return null;

    let found = null;
    let best = Infinity;

    for (const item of state.run.items) {
      if (item.status === 'stolen' || item.status === 'failed') continue;

      let tx;
      let ty;
      if (item.type === 'floor') {
        tx = item.anchorX;
        ty = item.anchorY - item.drawH * 0.45;
      } else {
        tx = item.x + item.w / 2;
        ty = item.y + item.h * 0.7;
      }

      const d = distance(state.player.x, state.player.y, tx, ty);
      if (d < sx(165) && d < best) {
        best = d;
        found = item;
      }
    }

    return found;
  }

  function getCurrentQuestion() {
    return state.activeItem?.question || null;
  }

  function interact() {
    if (state.screen !== 'game') return;
    if (!state.run) return;
    if (questionModal && !questionModal.classList.contains('hidden')) return;
    if (state.player.controlLocked) return;

    if (
      (state.run.mode === 'play' || state.run.mode === 'chase') &&
      pointInRect(state.player.x, state.player.y, EXIT_ZONE)
    ) {
      state.run.mode = 'escape';
      state.player.controlLocked = true;
      showBanner('Escaping...');
      return;
    }

    if (state.run.mode !== 'play') return;

    const item = getNearbyItem();
    if (!item) return;

    const q = chooseQuestionForItem(item);
    if (!q) {
      showBanner('No unused questions left.');
      return;
    }

    state.activeItem = item;
    if (questionTextEl) questionTextEl.textContent = q.question;
    if (answerInput) answerInput.value = '';
    if (questionModal) questionModal.classList.remove('hidden');

    requestAnimationFrame(() => {
      if (answerInput) answerInput.focus({ preventScroll: true });
    });
  }

  function submitAnswer() {
    if (!state.activeItem) return;
    const q = getCurrentQuestion();
    if (!q) return;

    const ok = answerMatches(q, answerInput ? answerInput.value : '');
    if (questionModal) questionModal.classList.add('hidden');

    if (ok) {
      state.run.haul += Number(q.value || state.activeItem.value || 0);
      state.activeItem.status = 'stolen';
      state.player.controlLocked = true;
      state.player.action = {
        type: 'pull',
        itemId: state.activeItem.id,
        dir: state.player.direction,
        frameIndex: 0,
        timer: 0
      };
      state.run.mode = 'pull';
      showBanner(`Stolen! +£${(Number(q.value || 0) / 100).toFixed(2)}`);
    } else {
      state.activeItem.status = 'failed';
      state.run.strikes += 1;
      recordWrongQuestion(q);
      startWrongFX();
      playRandomFailVoice();

      if (state.run.strikes >= QUESTION_MAX_STRIKES) {
        triggerGuard();
      } else {
        showBanner(`Wrong! Strike ${state.run.strikes}/${QUESTION_MAX_STRIKES}`);
      }
    }

    state.activeItem = null;
    setHeistHeader(state.run.haul, state.run.strikes, remainingItemsCount());
  }

  function triggerGuard() {
    if (state.guard.active) return;

    state.guard.active = true;
    state.guard.visible = true;
    state.guard.mode = 'run';
    state.guard.x = sx(2442);
    state.guard.y = sy(1190);
    state.guard.direction = 'west';
    state.guard.frameIndex = 0;
    state.guard.frameTimer = 0;
    state.guard.moving = true;

    /* player still gets to run */
    state.player.controlLocked = false;
    state.run.mode = 'chase';

    playGuardAlert();
    startGuardFX();
    showBanner('Hey! Stop!');
  }

  function triggerHeistEndHomework() {
    state.homework.pending = state.run?.wrongQuestions ? [...state.run.wrongQuestions] : [];
    saveLastHeistWrong(state.homework.pending);
  }

  function endHeist(escaped) {
    stopAllGameAudio();

    if (escaped) {
      state.save.totalBanked += state.run.haul;
      state.save.bestHeist = Math.max(state.save.bestHeist, state.run.haul);
      state.save.heistsPlayed += 1;
      state.save.paintingsStolen += state.run.items.filter((i) => i.status === 'stolen').length;
      saveProgress();
      triggerHeistEndHomework();
      renderHubStats();
      returnToHub();
      return;
    }

    state.save.heistsPlayed += 1;
    saveProgress();
    triggerHeistEndHomework();
    renderHubStats();
    returnToHub();
  }

  function endCaughtToHub() {
    stopAllGameAudio();
    state.save.heistsPlayed += 1;
    saveProgress();
    triggerHeistEndHomework();
    renderHubStats();
    returnToHub();
  }

  function returnToHub() {
    state.run = null;
    state.activeItem = null;
    if (summaryOverlay) summaryOverlay.classList.add('hidden');
    showScreen('hub');
    renderHubStats();
    maybeShowHomeworkPopup();
  }

  function updateWalkAnimation(delta) {
    if (!state.player.moving) {
      state.player.frameIndex = 0;
      state.player.frameTimer = 0;
      return;
    }

    state.player.frameTimer += delta;
    if (state.player.frameTimer >= PLAYER_FRAME_MS) {
      state.player.frameTimer = 0;
      const set = walkAnimations[state.player.direction] || walkAnimations.south;
      state.player.frameIndex = (state.player.frameIndex + 1) % set.length;
    }
  }

  function updateGuardAnimation(delta) {
    if (!state.guard.active) return;

    const frameMs = state.guard.mode === 'walk' ? GUARD_WALK_FRAME_MS : GUARD_RUN_FRAME_MS;
    const set =
      state.guard.mode === 'walk'
        ? (guardWalkAnimations[state.guard.direction] || guardWalkAnimations.south)
        : (guardRunAnimations[state.guard.direction] || guardRunAnimations.south);

    if (!state.guard.moving) {
      state.guard.frameIndex = 0;
      state.guard.frameTimer = 0;
      return;
    }

    state.guard.frameTimer += delta;
    if (state.guard.frameTimer >= frameMs) {
      state.guard.frameTimer = 0;
      state.guard.frameIndex = (state.guard.frameIndex + 1) % set.length;
    }
  }

  function updatePullAnimation(delta) {
    const action = state.player.action;
    if (!action || action.type !== 'pull') return;

    action.timer += delta;
    if (action.timer >= PLAYER_FRAME_MS) {
      action.timer = 0;
      const set = pullAnimations[action.dir] || pullAnimations.south;
      action.frameIndex = (action.frameIndex + 1) % set.length;
    }

    const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
    const targetY = EXIT_ZONE.y2 + sy(20);

    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (dx / len) * PLAYER_PULL_SPEED;
    const my = (dy / len) * PLAYER_PULL_SPEED;

    state.player.x += mx;
    state.player.y += my;
    state.player.moving = true;
    state.player.direction = vectorToDirection(mx, my);
    action.dir = state.player.direction;

    if (state.player.y >= EXIT_ZONE.y2 - sy(10)) {
      state.player.action = null;
      state.player.controlLocked = false;
      state.player.visible = false;
      state.run.items = state.run.items.filter((i) => i.id !== action.itemId);
      setHeistHeader(state.run.haul, state.run.strikes, remainingItemsCount());

      if (remainingItemsCount() <= 0) {
        endHeist(true);
      } else {
        state.player.visible = true;
        state.player.x = sx(1380);
        state.player.y = sy(1210);
        state.player.direction = 'south';
        state.player.frameIndex = 0;
        state.player.moving = false;
        state.run.mode = 'play';
        showBanner('Back in the room...');
      }
    }
  }

  function tryMove(dx, dy) {
    const speed = getMoveSpeed();
    const nx = state.player.x + dx * speed;
    const ny = state.player.y + dy * speed;

    if (canStandAt(nx, ny, 'player')) {
      state.player.x = nx;
      state.player.y = ny;
      state.player.moving = true;
      return true;
    }

    const nxOnly = state.player.x + dx * speed;
    if (canStandAt(nxOnly, state.player.y, 'player')) {
      state.player.x = nxOnly;
      state.player.moving = true;
      return true;
    }

    const nyOnly = state.player.y + dy * speed;
    if (canStandAt(state.player.x, nyOnly, 'player')) {
      state.player.y = nyOnly;
      state.player.moving = true;
      return true;
    }

    state.player.moving = false;
    return false;
  }

  function moveGuardToward(targetX, targetY, speed) {
    const dx = targetX - state.guard.x;
    const dy = targetY - state.guard.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) {
      state.guard.moving = false;
      return;
    }

    const mx = (dx / len) * speed;
    const my = (dy / len) * speed;

    state.guard.x += mx;
    state.guard.y += my;
    state.guard.moving = true;

    if (state.guard.mode === 'walk') {
      state.guard.direction = escortDirection(mx, my, state.guard.direction);
    } else {
      state.guard.direction = vectorToDirection(mx, my);
    }
  }

  function update(delta) {
    updateFX(delta);
    if (state.screen !== 'game' || !state.run) return;

    state.player.moving = false;
    state.guard.moving = false;

    if (state.run.mode === 'play') {
      let dx = 0;
      let dy = 0;

      if (!state.player.controlLocked) {
        if (state.keys.left) dx -= 1;
        if (state.keys.right) dx += 1;
        if (state.keys.up) dy -= 1;
        if (state.keys.down) dy += 1;
      }

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        state.player.direction = vectorToDirection(dx, dy);
        tryMove(dx, dy);
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'pull') {
      updatePullAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'chase') {
      let dx = 0;
      let dy = 0;

      if (!state.player.controlLocked) {
        if (state.keys.left) dx -= 1;
        if (state.keys.right) dx += 1;
        if (state.keys.up) dy -= 1;
        if (state.keys.down) dy += 1;
      }

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        state.player.direction = vectorToDirection(dx, dy);
        tryMove(dx, dy);
      }

      state.guard.mode = 'run';
      moveGuardToward(state.player.x, state.player.y, GUARD_CHASE_SPEED);

      if (distance(state.guard.x, state.guard.y, state.player.x, state.player.y) < CATCH_DISTANCE) {
        state.run.mode = 'escort';
        state.guard.mode = 'walk';
        state.player.controlLocked = true;
        playWithMe();
        showBanner('Caught! Escorted out.');
      }

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);
      return;
    }

    if (state.run.mode === 'escort') {
      state.guard.mode = 'walk';

      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2 + sx(18);
      const targetY = (EXIT_ZONE.y1 + EXIT_ZONE.y2) / 2 + sy(8);

      moveGuardToward(targetX, targetY, GUARD_ESCORT_SPEED);

      state.player.x = state.guard.x - sx(22);
      state.player.y = state.guard.y + sy(4);
      state.player.direction = 'south';
      state.player.moving = state.guard.moving;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (pointInRect(state.guard.x, state.guard.y, EXIT_ZONE)) {
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

      if (state.audio.withMeFinished) {
        state.player.visible = false;
        state.guard.visible = false;
        endCaughtToHub();
      }
      return;
    }

    if (state.run.mode === 'escape') {
      const targetX = (EXIT_ZONE.x1 + EXIT_ZONE.x2) / 2;
      const targetY = EXIT_ZONE.y2 + sy(30);

      const dx = targetX - state.player.x;
      const dy = targetY - state.player.y;
      const len = Math.hypot(dx, dy) || 1;
      const mx = (dx / len) * MOVE_SPEED;
      const my = (dy / len) * MOVE_SPEED;

      state.player.moving = true;
      state.player.direction = vectorToDirection(mx, my);
      state.player.x += mx;
      state.player.y += my;

      updateWalkAnimation(delta);
      updateGuardAnimation(delta);

      if (state.player.y >= EXIT_ZONE.y2 - sy(10)) {
        state.player.visible = false;
        endHeist(true);
      }
    }
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

  function drawImageFit(imgObj, x, y, w, h) {
    if (!imageReady(imgObj)) return;
    const scale = Math.min(w / imgObj.naturalWidth, h / imgObj.naturalHeight);
    const dw = imgObj.naturalWidth * scale;
    const dh = imgObj.naturalHeight * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(imgObj, dx, dy, dw, dh);
  }

  function drawExitMat() {
    const matX = EXIT_ZONE.x1 + 8;
    const matY = EXIT_ZONE.y1 + 14;
    const matW = EXIT_ZONE.x2 - EXIT_ZONE.x1 - 16;
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

  function drawWallItem(item) {
    const image = resolveItemImage(item);
    if (!image) return;

    if (item.status === 'failed') {
      ctx.save();
      ctx.filter = 'grayscale(100%) brightness(0.65)';
      drawImageFit(image, item.x, item.y, item.w, item.h);
      ctx.restore();
      return;
    }

    drawImageFit(image, item.x, item.y, item.w, item.h);
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

    const image = resolveItemImage(item);
    if (!image) return;

    if (item.status === 'failed') {
      ctx.save();
      ctx.filter = 'grayscale(100%) brightness(0.65)';
      ctx.drawImage(image, drawX, drawY, item.drawW, item.drawH);
      ctx.restore();
      return;
    }

    ctx.drawImage(image, drawX, drawY, item.drawW, item.drawH);
  }

  function getCurrentPlayerImage() {
    if (state.player.action && state.player.action.type === 'pull') {
      const set = pullAnimations[state.player.action.dir] || pullAnimations.south;
      return set[Math.min(state.player.action.frameIndex, set.length - 1)];
    }
    const set = walkAnimations[state.player.direction] || walkAnimations.south;
    return set[state.player.frameIndex % set.length];
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
    const image = getCurrentPlayerImage();

    if (imageReady(image)) {
      ctx.drawImage(image, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
    } else {
      drawFallbackPlayer();
    }
  }

  function getGuardImage() {
    const dir = state.guard.direction || 'south';
    if (state.guard.mode === 'walk') {
      const fallbackDir =
        dir === 'south' || dir === 'southeast' || dir === 'southwest'
          ? dir
          : 'south';
      const set = guardWalkAnimations[fallbackDir] || guardWalkAnimations.south;
      return set[state.guard.frameIndex % set.length];
    }
    const set = guardRunAnimations[dir] || guardRunAnimations.south;
    return set[state.guard.frameIndex % set.length];
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
    const image = getGuardImage();

    if (imageReady(image)) {
      ctx.drawImage(image, drawX, drawY, GUARD_WIDTH, GUARD_HEIGHT);
    } else {
      drawFallbackGuard();
    }
  }

  function drawPrompt() {
    if (!state.run || state.player.controlLocked) return;

    const item = getNearbyItem();
    if (state.run.mode === 'play' && item) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(state.player.x - 70, state.player.y - PLAYER_HEIGHT - 24, 140, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Attempt to grab', state.player.x, state.player.y - PLAYER_HEIGHT - 14);
      return;
    }

    if (
      (state.run.mode === 'play' || state.run.mode === 'chase') &&
      pointInRect(state.player.x, state.player.y, EXIT_ZONE)
    ) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(state.player.x - 30, state.player.y - PLAYER_HEIGHT - 24, 60, 20);
      ctx.fillStyle = '#f7e7b0';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Exit', state.player.x, state.player.y - PLAYER_HEIGHT - 14);
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
      (state.run && ['chase', 'escort', 'escort_wait'].includes(state.run.mode))
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

  function showScreen(name) {
    state.screen = name;
    if (hubScreen) hubScreen.classList.toggle('active', name === 'hub');
    if (gameScreen) gameScreen.classList.toggle('active', name === 'game');

    if (name === 'game') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.body.style.touchAction = 'none';
      if (canvas) canvas.style.touchAction = 'none';
      window.scrollTo(0, 0);
    } else {
      stopAllGameAudio();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.body.style.touchAction = '';
      if (canvas) canvas.style.touchAction = '';
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

  if (answerInput) {
    answerInput.style.fontSize = '16px';
    answerInput.style.lineHeight = '1.2';
    answerInput.style.transform = 'translateZ(0)';
    answerInput.autocapitalize = 'off';
    answerInput.autocomplete = 'off';
    answerInput.spellcheck = false;
  }

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

    if ((k === 'e' || k === ' ') && questionModal && questionModal.classList.contains('hidden') && state.screen === 'game') {
      e.preventDefault();
      interact();
    }

    if (k === 'enter' && questionModal && !questionModal.classList.contains('hidden')) {
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
    const press = (val) => { state.keys[map[dir]] = val; };

    btn.addEventListener('touchstart', (e) => { e.preventDefault(); press(true); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); press(false); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); press(false); }, { passive: false });

    btn.addEventListener('mousedown', () => press(true));
    btn.addEventListener('mouseup', () => press(false));
    btn.addEventListener('mouseleave', () => press(false));
  });

  if (interactBtn) interactBtn.addEventListener('click', interact);
  if (startHeistBtn) startHeistBtn.addEventListener('click', startHeist);

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener('click', () => {
      state.save = {
        totalBanked: 0,
        bestHeist: 0,
        heistsPlayed: 0,
        paintingsStolen: 0,
        usedQuestionIds: []
      };
      state.homework.pending = [];
      localStorage.removeItem(LAST_HEIST_WRONG_KEY);
      hideHomeworkPopup();
      saveProgress();
      renderHubStats();
      showBanner('Progress reset.');
    });
  }

  if (backToHubBtn) {
    backToHubBtn.addEventListener('click', () => {
      state.run = null;
      state.activeItem = null;
      showScreen('hub');
      renderHubStats();
      maybeShowHomeworkPopup();
    });
  }

  if (submitAnswerBtn) submitAnswerBtn.addEventListener('click', submitAnswer);

  if (cancelAnswerBtn) {
    cancelAnswerBtn.addEventListener('click', () => {
      if (questionModal) questionModal.classList.add('hidden');
      state.activeItem = null;
    });
  }

  if (summaryContinueBtn) summaryContinueBtn.addEventListener('click', returnToHub);

  renderHubStats();
  showScreen('hub');
  applyJoystickLayout();
  ensureHomeworkPopup();
  requestAnimationFrame(gameLoop);
})();
