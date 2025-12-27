/* Project Carrot (v0.3.6) - game.js
   - Single-file runtime: builds UI into #app (creates if missing)
   - LocalStorage save with migration/normalization (deterministic defaults)
   - Fixes:
     1) normalizeHorse clamps maxCap to GRADE_CAP[grade] (ignores inflated saved cap)
     2) normalization is persisted immediately on load (no reroll between renders)
*/

(() => {
  'use strict';

  const VERSION = '0.3.6';
  const LS_KEY = 'project_carrot_save';

  const PHASES = ['AM', 'PM'];
  const PHASE_LABEL = { AM: '오전', PM: '오후' };

  const TABS = [
    { id: 'stable', label: '마구간' },
    { id: 'shop', label: '상점' },
    { id: 'work', label: '알바' },
    { id: 'gacha', label: '뽑기' },
    { id: 'gp', label: '그랑프리' },
  ];

  const STAT_KEYS = ['health', 'stamina', 'speed', 'charm'];
  const STAT_LABEL = {
    health: '체력',
    stamina: '기력',
    speed: '속도',
    charm: '매력',
  };

  const GRADE_CAP = { SS: 100, S: 90, A: 80, B: 70, C: 60 };
  const GRADES = ['SS', 'S', 'A', 'B', 'C'];

  const AP_MAX = 10;
  const MAX_HORSES = 5;

  const LOTTO = {
    name: '홀스로또 6/45',
    price: 5000,
    picks: 6,
    min: 1,
    max: 45,
    payoutByMatches: {
      6: 100_000_000, // 1등
      5: 20_000_000, // 2등
      4: 1_000_000, // 3등
      3: 50_000, // 4등
      2: 5_000, // 5등
      0: 0, // 6등(꽝)
    },
  };

  // Shop items (0.3.6)
  const SHOP_CATEGORIES = [
    { id: 'care', label: '관리 아이템' },
    { id: 'growth', label: '성장 아이템' },
    { id: 'special', label: '특수 아이템' },
    { id: 'lotto', label: '복권' }, // separate tab in shop
  ];

  const ITEM_DEFS = [
    // Care - Food
    {
      id: 'sugar',
      cat: 'care',
      group: '먹이류',
      name: '각설탕',
      desc: '포만감 +20',
      price: 10000,
      effect: { status: { fullness: +20 } },
    },
    {
      id: 'carrot',
      cat: 'care',
      group: '먹이류',
      name: '당근',
      desc: '포만감 +10',
      price: 6000,
      effect: { status: { fullness: +10 } },
    },
    {
      id: 'hay',
      cat: 'care',
      group: '먹이류',
      name: '건초',
      desc: '포만감 +5',
      price: 3000,
      effect: { status: { fullness: +5 } },
    },
    {
      id: 'feed',
      cat: 'care',
      group: '먹이류',
      name: '사료',
      desc: '포만감 +3',
      price: 2000,
      effect: { status: { fullness: +3 } },
    },

    // Care - Shampoo
    {
      id: 'hs_premium_shampoo',
      cat: 'care',
      group: '샴푸류',
      name: 'HS 고급 샴푸',
      desc: '위생 +20',
      price: 10000,
      effect: { status: { hygiene: +20 } },
    },
    {
      id: 'hs_shampoo',
      cat: 'care',
      group: '샴푸류',
      name: 'HS 일반 샴푸',
      desc: '위생 +10',
      price: 6000,
      effect: { status: { hygiene: +10 } },
    },
    {
      id: 'uncle_shampoo',
      cat: 'care',
      group: '샴푸류',
      name: '말아저씨네 샴푸',
      desc: '위생 +5',
      price: 3000,
      effect: { status: { hygiene: +5 } },
    },
    {
      id: 'sauna_shampoo',
      cat: 'care',
      group: '샴푸류',
      name: '사우나 샴푸',
      desc: '위생 +3',
      price: 2000,
      effect: { status: { hygiene: +3 } },
    },

    // Care - Toys
    {
      id: 'horse_royce_toy',
      cat: 'care',
      group: '장난감류',
      name: '홀스로이스 장난감',
      desc: '기분 +20',
      price: 10000,
      effect: { status: { mood: +20 } },
    },
    {
      id: 'holaroid_toy',
      cat: 'care',
      group: '장난감류',
      name: '홀라로이드 장난감',
      desc: '기분 +10',
      price: 6000,
      effect: { status: { mood: +10 } },
    },
    {
      id: 'tennis_ball',
      cat: 'care',
      group: '장난감류',
      name: '테니스공',
      desc: '기분 +5',
      price: 3000,
      effect: { status: { mood: +5 } },
    },
    {
      id: 'inedible_gum',
      cat: 'care',
      group: '장난감류',
      name: '먹을 수 없는 개껌',
      desc: '기분 +3',
      price: 2000,
      effect: { status: { mood: +3 } },
    },

    // Growth items (unchanged)
    {
      id: 'horse_oneshot',
      cat: 'growth',
      group: '성장',
      name: '홀스원샷',
      desc: '체력 1~5 랜덤 증가',
      price: 20000,
      effect: { stat: 'health', min: 1, max: 5 },
    },
    {
      id: 'horse_bull',
      cat: 'growth',
      group: '성장',
      name: '홀스불',
      desc: '기력 1~5 랜덤 증가',
      price: 20000,
      effect: { stat: 'stamina', min: 1, max: 5 },
    },
    {
      id: 'horonamin_h',
      cat: 'growth',
      group: '성장',
      name: '호로나민H',
      desc: '속도 1~5 랜덤 증가',
      price: 20000,
      effect: { stat: 'speed', min: 1, max: 5 },
    },
    {
      id: 'horse_gel',
      cat: 'growth',
      group: '성장',
      name: '홀스젤',
      desc: '매력 1~3 랜덤 증가',
      price: 99000,
      effect: { stat: 'charm', min: 1, max: 3 },
    },

    // Special (out of stock)
    {
      id: 'special_stock_none',
      cat: 'special',
      group: '특수',
      name: '재고 없음',
      desc: '기획 중…',
      price: 0,
      disabled: true,
    },
  ];

  // Gacha config (not specified in the spec; chosen defaults)
  const GACHA = {
    price: 30000,
    probs: [
      { grade: 'SS', p: 0.01 },
      { grade: 'S', p: 0.04 },
      { grade: 'A', p: 0.15 },
      { grade: 'B', p: 0.3 },
      { grade: 'C', p: 0.5 },
    ],
  };

  // Grand Prix config (simple & stable)
  const GP = {
    apCost: 5,
    leagues: [
      { id: 1, name: '루키 리그', rewardWin: 12000, rewardLose: 2000 },
      { id: 2, name: '프로 리그', rewardWin: 28000, rewardLose: 5000 },
      { id: 3, name: '챔피언 리그', rewardWin: 65000, rewardLose: 10000 },
    ],
    advanceWins: 3,
  };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const nfmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return x.toLocaleString('ko-KR');
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  // Deterministic "random" for defaults (prevents reroll between renders/reloads)
  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rand01FromSeed(seed) {
    let x = seed || 123456789;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return (x >>> 0) / 4294967296;
  }
  function deterministicStatDefault(id, gradeCap, key) {
    const seed = hash32(`${id}:${key}:${gradeCap}`);
    const r = rand01FromSeed(seed);
    // 35% ~ 60% of cap
    return Math.floor(gradeCap * (0.35 + r * 0.25));
  }

  function cryptoId() {
    // portable id generator
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return 'h_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function nowDayPhaseKey(day, phase) {
    return `${day}_${phase}`;
  }

  function weightedWorkPayout() {
    // Values 1,000..100,000 step 1,000 with weights 1/value
    // => P(1000)/P(100000) = 100 as required
    const values = [];
    const weights = [];
    for (let v = 1000; v <= 100000; v += 1000) {
      values.push(v);
      weights.push(1 / v);
    }
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < values.length; i++) {
      r -= weights[i];
      if (r <= 0) return values[i];
    }
    return values[values.length - 1];
  }

  function computeWinChance(horse) {
    // Show "우승 확률" (simple and stable)
    // Score normalized by cap; apply mild penalty if status is bad.
    const cap = horse.maxCap;
    const s = horse.stats;
    const base =
      (s.health * 0.25 + s.stamina * 0.25 + s.speed * 0.3 + s.charm * 0.2) /
      cap; // 0..1-ish
    const st = horse.status;
    const statusAvg = (st.fullness + st.hygiene + st.mood) / 300; // 0..1
    const penalty = statusAvg < 0.5 ? (0.5 - statusAvg) * 0.25 : 0; // up to -0.125
    const chance = clamp(0.05 + 0.9 * clamp(base - penalty, 0, 1), 0.05, 0.95);
    return chance;
  }

  function sellPrice(horse) {
    const baseByGrade = {
      SS: 500000,
      S: 300000,
      A: 150000,
      B: 80000,
      C: 30000,
    };
    const base = baseByGrade[horse.grade] ?? 30000;
    const avg =
      STAT_KEYS.reduce((a, k) => a + horse.stats[k], 0) / STAT_KEYS.length;
    return Math.floor(base + avg * 1000);
  }

  // ---------------------------------------------------------------------------
  // Normalization / Migration (prevents cheating & reroll bugs)
  // ---------------------------------------------------------------------------
  function normalizeHorse(h) {
    const raw = h && typeof h === 'object' ? h : {};

    // Grade
    const grade = raw.grade && GRADE_CAP[raw.grade] ? raw.grade : 'C';
    const gradeCap = GRADE_CAP[grade];

    // ✅ Important fix: DO NOT trust saved maxCap; force it to gradeCap
    const id = typeof raw.id === 'string' && raw.id ? raw.id : cryptoId();
    const name =
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, 12)
        : '말';

    // Stats migration: accept older keys if present
    const statsRaw =
      raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const legacy = {
      health: statsRaw.health ?? statsRaw.hp ?? statsRaw.HP ?? raw.health,
      stamina: statsRaw.stamina ?? statsRaw.ap ?? statsRaw.AP ?? raw.stamina,
      speed: statsRaw.speed ?? statsRaw.spd ?? statsRaw.SPD ?? raw.speed,
      charm: statsRaw.charm ?? statsRaw.cha ?? statsRaw.CHA ?? raw.charm,
    };

    const stats = {};
    for (const k of STAT_KEYS) {
      const v = Number(legacy[k]);
      const vv = Number.isFinite(v)
        ? v
        : deterministicStatDefault(id, gradeCap, k);
      stats[k] = clamp(Math.floor(vv), 0, gradeCap); // ✅ clamp to gradeCap
    }

    const statusRaw =
      raw.status && typeof raw.status === 'object' ? raw.status : {};
    const status = {
      fullness: clamp(
        Number.isFinite(+statusRaw.fullness) ? +statusRaw.fullness : 70,
        0,
        100
      ),
      hygiene: clamp(
        Number.isFinite(+statusRaw.hygiene) ? +statusRaw.hygiene : 70,
        0,
        100
      ),
      mood: clamp(
        Number.isFinite(+statusRaw.mood) ? +statusRaw.mood : 70,
        0,
        100
      ),
    };

    return { id, name, grade, maxCap: gradeCap, stats, status };
  }

  function normalizeState(state) {
    // Returns { state, changed }
    let s = state && typeof state === 'object' ? state : {};
    let changed = false;

    // Version
    if (s.version !== VERSION) {
      s.version = VERSION;
      changed = true;
    }

    // Theme
    if (s.theme !== 'light' && s.theme !== 'dark') {
      s.theme = 'dark';
      changed = true;
    }

    // Day / Phase
    const day = Number(s.day);
    if (!Number.isFinite(day) || day < 1) {
      s.day = 1;
      changed = true;
    }
    const phase = s.phase;
    if (phase !== 'AM' && phase !== 'PM') {
      s.phase = 'AM';
      changed = true;
    }

    // Money
    const money = Number(s.money);
    if (!Number.isFinite(money) || money < 0) {
      s.money = 50000;
      changed = true;
    }

    // AP
    if (!s.ap || typeof s.ap !== 'object') {
      s.ap = { current: AP_MAX, max: AP_MAX };
      changed = true;
    }
    const apc = Number(s.ap.current);
    const apm = Number(s.ap.max);
    if (!Number.isFinite(apm) || apm !== AP_MAX) {
      s.ap.max = AP_MAX;
      changed = true;
    }
    if (!Number.isFinite(apc)) {
      s.ap.current = AP_MAX;
      changed = true;
    }
    s.ap.current = clamp(Math.floor(s.ap.current), 0, AP_MAX);

    // Inventory
    if (!s.inventory || typeof s.inventory !== 'object') {
      s.inventory = {};
      changed = true;
    }
    for (const [k, v] of Object.entries(s.inventory)) {
      const vv = Number(v);
      if (!Number.isFinite(vv) || vv < 0) {
        s.inventory[k] = 0;
        changed = true;
      }
      s.inventory[k] = Math.floor(s.inventory[k]);
    }

    // Horses
    const horsesRaw = Array.isArray(s.horses) ? s.horses : null;
    if (!horsesRaw) {
      s.horses = [makeRandomHorse()];
      changed = true;
    } else {
      const before = JSON.stringify(horsesRaw);
      s.horses = horsesRaw.map(normalizeHorse);
      // Enforce capacity
      if (s.horses.length === 0) {
        s.horses = [makeRandomHorse()];
        changed = true;
      }
      if (s.horses.length > MAX_HORSES) {
        s.horses = s.horses.slice(0, MAX_HORSES);
        changed = true;
      }
      if (JSON.stringify(s.horses) !== before) changed = true;
    }

    // Active horse
    const activeId =
      typeof s.activeHorseId === 'string' ? s.activeHorseId : null;
    const hasActive = s.horses.some((h) => h.id === activeId);
    if (!hasActive) {
      s.activeHorseId = s.horses[0].id;
      changed = true;
    }

    // UI state
    if (!TABS.some((t) => t.id === s.currentTab)) {
      s.currentTab = 'stable';
      changed = true;
    }
    if (!SHOP_CATEGORIES.some((c) => c.id === s.shopCat)) {
      s.shopCat = 'care';
      changed = true;
    }

    // Gacha state
    if (!s.gacha || typeof s.gacha !== 'object') {
      s.gacha = {};
      changed = true;
    }

    // GP state
    if (!s.gp || typeof s.gp !== 'object') {
      s.gp = { league: 1, wins: 0, losses: 0 };
      changed = true;
    }
    const league = Number(s.gp.league);
    if (!Number.isFinite(league) || league < 1 || league > GP.leagues.length) {
      s.gp.league = 1;
      changed = true;
    }
    s.gp.wins = Number.isFinite(+s.gp.wins)
      ? Math.max(0, Math.floor(+s.gp.wins))
      : 0;
    s.gp.losses = Number.isFinite(+s.gp.losses)
      ? Math.max(0, Math.floor(+s.gp.losses))
      : 0;

    // Lotto state
    if (!s.lotto || typeof s.lotto !== 'object') {
      s.lotto = { lastPurchaseDay: 0, ticket: null, history: [] };
      changed = true;
    }
    if (!Array.isArray(s.lotto.history)) {
      s.lotto.history = [];
      changed = true;
    }
    if (
      !Number.isFinite(+s.lotto.lastPurchaseDay) ||
      +s.lotto.lastPurchaseDay < 0
    ) {
      s.lotto.lastPurchaseDay = 0;
      changed = true;
    }
    if (s.lotto.ticket && typeof s.lotto.ticket === 'object') {
      // basic sanitize
      const t = s.lotto.ticket;
      if (!Array.isArray(t.numbers)) {
        t.numbers = [];
        changed = true;
      }
      t.numbers = [
        ...new Set(
          t.numbers.map((x) => clamp(Math.floor(+x), LOTTO.min, LOTTO.max))
        ),
      ].sort((a, b) => a - b);
      if (t.numbers.length !== LOTTO.picks) {
        /* keep; but won't draw */
      }
      if (!Number.isFinite(+t.drawDay) || +t.drawDay < 1) {
        t.drawDay = s.day + 1;
        changed = true;
      }
      if (t.drawPhase !== 'AM') {
        t.drawPhase = 'AM';
        changed = true;
      }
      if (t.status !== 'pending' && t.status !== 'drawn') {
        t.status = 'pending';
        changed = true;
      }
    } else if (s.lotto.ticket !== null) {
      s.lotto.ticket = null;
      changed = true;
    }

    return { state: s, changed };
  }

  function saveGame(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('Save failed', e);
      toast('저장이 실패했어요… (브라우저 저장공간 확인!)');
      return false;
    }
  }

  function loadGame() {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? safeJsonParse(raw) : null;
    const { state, changed } = normalizeState(parsed ?? makeFreshState());
    // ✅ Important fix: persist normalized data immediately (prevents reroll bugs)
    if (changed) saveGame(state);
    return state;
  }

  function resetGame() {
    localStorage.removeItem(LS_KEY);
    state = loadGame();
    applyTheme(state.theme);
    renderAll();
  }

  function makeFreshState() {
    const first = makeRandomHorse();
    return {
      version: VERSION,
      theme: 'dark',
      day: 1,
      phase: 'AM',
      money: 50000,
      ap: { current: AP_MAX, max: AP_MAX },
      inventory: {},
      horses: [first],
      activeHorseId: first.id,
      currentTab: 'stable',
      shopCat: 'care',
      gacha: {},
      gp: { league: 1, wins: 0, losses: 0 },
      lotto: { lastPurchaseDay: 0, ticket: null, history: [] },
    };
  }

  function rollGrade() {
    const r = Math.random();
    let acc = 0;
    for (const g of GACHA.probs) {
      acc += g.p;
      if (r <= acc) return g.grade;
    }
    return 'C';
  }

  function makeRandomHorse(overrides = {}) {
    const grade = overrides.grade ?? rollGrade();
    const cap = GRADE_CAP[grade] ?? 60;
    const id = overrides.id ?? cryptoId();
    const stats = {};
    for (const k of STAT_KEYS) {
      // Start 35%~60% of cap (random at creation is OK; this is new entity)
      stats[k] = clamp(Math.floor(cap * (0.35 + Math.random() * 0.25)), 0, cap);
    }
    const name = overrides.name ?? '새 말';
    return normalizeHorse({
      id,
      name,
      grade,
      maxCap: cap, // will be overwritten to grade cap anyway
      stats,
      status: { fullness: 70, hygiene: 70, mood: 70 },
    });
  }

  // ---------------------------------------------------------------------------
  // UI (Self-contained DOM builder)
  // ---------------------------------------------------------------------------
  let state = null;
  let $ = null;

  function injectRuntimeStyle() {
    if (document.getElementById('pc-runtime-style')) return;
    const style = document.createElement('style');
    style.id = 'pc-runtime-style';
    style.textContent = `
      :root {
        --bg: #0f1115;
        --panel: #161a22;
        --panel2: #11141a;
        --text: #e9ecf2;
        --muted: #aab2c0;
        --border: rgba(255,255,255,0.10);
        --accent: #43e2d1;
        --danger: #ff5a5f;
        --warn: #f5c542;
        --ok: #59c751;

        --radius: 14px;
        --gap: 12px;

        --navH: 68px;
        --fab: 54px;
      }
      :root[data-theme="light"]{
        --bg: #f7f8fb;
        --panel: #ffffff;
        --panel2: #f1f3f7;
        --text: #1c2230;
        --muted: #606a7b;
        --border: rgba(0,0,0,0.10);
        --accent: #1C9198;
        --danger: #d13a3a;
        --warn: #d58018;
        --ok: #1B934A;
      }
      html, body { height: 100%; }
      body{
        margin:0;
        background: var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      *{ box-sizing: border-box; }
      .pc-app{
        min-height: 100vh;
        padding-bottom: calc(var(--navH) + 16px);
      }
      .pc-topbar{
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      .pc-topbar-inner{
        padding: 12px 14px 10px;
        display:flex;
        align-items:flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .pc-leftStack{
        display:flex;
        flex-direction: column;
        gap: 4px;
      }
      .pc-date{
        font-weight: 800;
        letter-spacing: -0.2px;
        line-height: 1.1;
      }
      .pc-tabname{
        color: var(--muted);
        font-weight: 700;
        font-size: 13px;
      }
      .pc-rightStack{
        text-align: right;
        display:flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .pc-money{
        font-weight: 900;
        cursor: pointer; /* dev-mode trigger */
        user-select: none;
      }
      .pc-ap{
        color: var(--muted);
        font-weight: 700;
        font-size: 13px;
      }
      .pc-main{
        padding: 14px;
        display:flex;
        flex-direction: column;
        gap: var(--gap);
      }
      .pc-card{
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 12px;
      }
      .pc-cardTitle{
        font-weight: 900;
        margin-bottom: 8px;
        letter-spacing: -0.2px;
      }
      .pc-row{
        display:flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
      }
      .pc-muted{ color: var(--muted); }
      .pc-btn{
        border: 1px solid var(--border);
        background: var(--panel2);
        color: var(--text);
        padding: 10px 12px;
        border-radius: 12px;
        font-weight: 800;
        cursor: pointer;
        user-select: none;
      }
      .pc-btn:disabled{
        opacity: .5;
        cursor: not-allowed;
      }
      .pc-btnPrimary{
        background: var(--accent);
        color: #071014;
        border-color: transparent;
      }
      :root[data-theme="light"] .pc-btnPrimary{
        color: #ffffff;
      }
      .pc-btnDanger{
        background: var(--danger);
        color: white;
        border-color: transparent;
      }
      .pc-btnGhost{
        background: transparent;
      }
      .pc-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding: 4px 8px;
        border-radius: 10px;
        border: 1px solid var(--border);
        font-weight: 900;
        font-size: 12px;
      }
      .pc-grade{
        width: 44px;
        height: 28px;
        border-radius: 8px;
        background: var(--panel2);
        border: 1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight: 1000;
        letter-spacing: -0.3px;
      }
      .pc-horseName{
        font-size: 22px;
        font-weight: 1000;
        letter-spacing: -0.6px;
        line-height: 1.1;
      }
      .pc-grid2{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .pc-itemCard{
        background: var(--panel2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 10px;
        display:flex;
        flex-direction: column;
        gap: 8px;
      }
      .pc-itemImg{
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
      }
      :root[data-theme="light"] .pc-itemImg{
        background: linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.02));
      }
      .pc-itemName{ font-weight: 950; letter-spacing: -0.2px; }
      .pc-itemDesc{ color: var(--muted); font-size: 13px; line-height: 1.35; min-height: 36px; }
      .pc-itemPrice{ font-weight: 900; }

      .pc-tabs{
        display:flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pc-tabBtn{
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--panel2);
        font-weight: 900;
        cursor:pointer;
      }
      .pc-tabBtn.active{
        background: var(--accent);
        color: #071014;
        border-color: transparent;
      }
      :root[data-theme="light"] .pc-tabBtn.active{
        color: #ffffff;
      }

      .pc-bottomNav{
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: var(--navH);
        background: var(--bg);
        border-top: 1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content: space-around;
        z-index: 20;
      }
      .pc-navBtn{
        width: 20%;
        height: 100%;
        display:flex;
        flex-direction: column;
        align-items:center;
        justify-content:center;
        gap: 4px;
        color: var(--muted);
        font-weight: 900;
        font-size: 12px;
        cursor:pointer;
        user-select:none;
      }
      .pc-navBtn.active{
        color: var(--text);
      }
      .pc-dot{
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: transparent;
      }
      .pc-navBtn.active .pc-dot{
        background: var(--accent);
      }

      .pc-fab{
        position: fixed;
        width: var(--fab);
        height: var(--fab);
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--panel);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index: 25;
        font-weight: 1000;
        cursor:pointer;
        user-select:none;
      }
      .pc-fabNext{
        right: 16px;
        bottom: calc(var(--navH) + 16px);
        background: var(--accent);
        border-color: transparent;
        color: #071014;
      }
      :root[data-theme="light"] .pc-fabNext{ color: #ffffff; }
      .pc-fabSettings{
        left: 16px;
        bottom: calc(var(--navH) + 16px);
      }

      .pc-modalOverlay{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 18px;
        z-index: 100;
      }
      .pc-modal{
        width: min(520px, 100%);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 14px;
      }
      .pc-modalTitle{
        font-weight: 1000;
        letter-spacing: -0.3px;
        margin-bottom: 6px;
      }
      .pc-modalDesc{
        color: var(--muted);
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 10px;
      }
      .pc-modalActions{
        display:flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 12px;
        flex-wrap: wrap;
      }
      .pc-qtyRow{
        display:flex;
        gap: 8px;
        align-items:center;
        justify-content: center;
        margin-top: 10px;
      }
      .pc-qtyBox{
        display:flex;
        gap: 8px;
        align-items:center;
        justify-content:center;
        padding: 8px 10px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--panel2);
        min-width: 160px;
      }
      .pc-qtyNum{
        font-weight: 1000;
        width: 44px;
        text-align:center;
      }
      .pc-quickRow{
        display:flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content:center;
        margin-top: 8px;
      }
      .pc-hr{ height: 1px; background: var(--border); margin: 12px 0; }

      .pc-barList{ display:flex; flex-direction: column; gap: 8px; }
      .pc-barRow{ display:grid; grid-template-columns: 58px 1fr 70px; gap: 10px; align-items:center; }
      .pc-bar{
        height: 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.05);
        overflow:hidden;
      }
      :root[data-theme="light"] .pc-bar{ background: rgba(0,0,0,0.04); }
      .pc-barFill{
        height: 100%;
        width: 0%;
        background: var(--accent);
      }
      .pc-barVal{ text-align:right; font-weight: 900; color: var(--muted); font-size: 13px; }

      .pc-lottoGrid{
        display:grid;
        grid-template-columns: repeat(9, 1fr);
        gap: 6px;
      }
      @media (max-width: 420px){
        .pc-lottoGrid{ grid-template-columns: repeat(6, 1fr); }
      }
      .pc-lottoNum{
        padding: 10px 0;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--panel2);
        font-weight: 1000;
        text-align:center;
        cursor:pointer;
        user-select:none;
      }
      .pc-lottoNum.sel{
        background: var(--accent);
        color: #071014;
        border-color: transparent;
      }
      :root[data-theme="light"] .pc-lottoNum.sel{ color: #ffffff; }

      .pc-toast{
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: calc(var(--navH) + 90px);
        background: var(--panel);
        border: 1px solid var(--border);
        padding: 10px 12px;
        border-radius: 14px;
        z-index: 200;
        font-weight: 900;
        max-width: 90vw;
      }

      /* Flat UI: no drop shadows anywhere (explicitly none) */
      .pc-card, .pc-modal, .pc-fab, .pc-bottomNav, .pc-itemCard, .pc-btn, .pc-tabBtn { box-shadow: none !important; }
    `;
    document.head.appendChild(style);
  }

  function ensureAppRoot() {
    let app = document.getElementById('app');
    if (!app) {
      app = document.createElement('div');
      app.id = 'app';
      document.body.appendChild(app);
    }
    return app;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, k);
      else if (v !== false && v != null) node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function toast(msg) {
    const t = el('div', { class: 'pc-toast', text: msg });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1400);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  // Prevent double-tap zoom on iOS/Safari (JS approach)
  function preventDoubleTapZoom() {
    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------
  function openModal({
    title,
    desc,
    body,
    actions = [],
    closeOnOverlay = true,
  }) {
    const overlay = el('div', { class: 'pc-modalOverlay' });
    const modal = el('div', { class: 'pc-modal' });

    modal.appendChild(el('div', { class: 'pc-modalTitle', text: title || '' }));
    if (desc)
      modal.appendChild(el('div', { class: 'pc-modalDesc', text: desc }));

    if (body) modal.appendChild(body);

    const actionRow = el('div', { class: 'pc-modalActions' });
    for (const a of actions) actionRow.appendChild(a);
    modal.appendChild(actionRow);

    overlay.appendChild(modal);

    function close() {
      overlay.remove();
    }
    if (closeOnOverlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    document.body.appendChild(overlay);
    return { close, overlay, modal };
  }

  function confirmModal({
    title,
    desc,
    okText = '확인',
    cancelText = '취소',
    danger = false,
  }) {
    return new Promise((resolve) => {
      const { close } = openModal({
        title,
        desc,
        actions: [
          el('button', {
            class: 'pc-btn pc-btnGhost',
            text: cancelText,
            onclick: () => {
              close();
              resolve(false);
            },
          }),
          el('button', {
            class: `pc-btn ${danger ? 'pc-btnDanger' : 'pc-btnPrimary'}`,
            text: okText,
            onclick: () => {
              close();
              resolve(true);
            },
          }),
        ],
      });
    });
  }

  function promptModal({
    title,
    desc,
    placeholder = '',
    maxLen = 12,
    okText = '확인',
    cancelText = '취소',
  }) {
    return new Promise((resolve) => {
      const input = el('input', {
        type: 'text',
        placeholder,
        maxlength: maxLen,
        class: 'pc-btn',
        style: 'width:100%; text-align:left; font-weight:800;',
      });
      const body = el('div', {}, [input]);

      const { close } = openModal({
        title,
        desc,
        body,
        actions: [
          el('button', {
            class: 'pc-btn pc-btnGhost',
            text: cancelText,
            onclick: () => {
              close();
              resolve(null);
            },
          }),
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: okText,
            onclick: () => {
              const v = input.value.trim();
              close();
              resolve(v || null);
            },
          }),
        ],
      });

      setTimeout(() => input.focus(), 50);
    });
  }

  function qtyPickerModal({
    title,
    desc,
    initial = 1,
    max = 999,
    okText = '확인',
    cancelText = '취소',
  }) {
    return new Promise((resolve) => {
      let qty = clamp(initial, 1, max);

      const qtyNum = el('div', { class: 'pc-qtyNum', text: String(qty) });

      const decBtn = el('button', {
        class: 'pc-btn',
        text: '−',
        onclick: () => {
          qty = clamp(qty - 1, 1, max);
          qtyNum.textContent = String(qty);
        },
      });
      const incBtn = el('button', {
        class: 'pc-btn',
        text: '+',
        onclick: () => {
          qty = clamp(qty + 1, 1, max);
          qtyNum.textContent = String(qty);
        },
      });

      const qtyBox = el('div', { class: 'pc-qtyBox' }, [
        decBtn,
        qtyNum,
        incBtn,
      ]);

      const quick = (n) =>
        el('button', {
          class: 'pc-btn',
          text: `+${n}`,
          onclick: () => {
            qty = clamp(qty + n, 1, max);
            qtyNum.textContent = String(qty);
          },
        });

      const body = el('div', {}, [
        el('div', { class: 'pc-modalDesc', text: desc || '' }),
        el('div', { class: 'pc-qtyRow' }, [qtyBox]),
        el('div', { class: 'pc-quickRow' }, [quick(1), quick(5), quick(10)]),
      ]);

      const { close } = openModal({
        title,
        body,
        actions: [
          el('button', {
            class: 'pc-btn pc-btnGhost',
            text: cancelText,
            onclick: () => {
              close();
              resolve(null);
            },
          }),
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: okText,
            onclick: () => {
              close();
              resolve(qty);
            },
          }),
        ],
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Game actions
  // ---------------------------------------------------------------------------
  function getActiveHorse() {
    return (
      state.horses.find((h) => h.id === state.activeHorseId) || state.horses[0]
    );
  }

  function spendAP(cost) {
    if (state.ap.current < cost) return false;
    state.ap.current -= cost;
    return true;
  }

  function addMoney(amount) {
    state.money = Math.max(0, Math.floor(state.money + amount));
  }

  function addItem(itemId, qty) {
    state.inventory[itemId] = Math.max(
      0,
      Math.floor((state.inventory[itemId] || 0) + qty)
    );
  }

  function removeItem(itemId, qty) {
    state.inventory[itemId] = Math.max(
      0,
      Math.floor((state.inventory[itemId] || 0) - qty)
    );
  }

  function decayStatusOnTimeAdvance(horse) {
    // mild decay to keep management meaningful
    horse.status.fullness = clamp(horse.status.fullness - 10, 0, 100);
    horse.status.hygiene = clamp(horse.status.hygiene - 5, 0, 100);
    horse.status.mood = clamp(horse.status.mood - 5, 0, 100);
  }

  async function advanceTime() {
    // AM -> PM, PM -> next day AM
    if (state.phase === 'AM') {
      state.phase = 'PM';
    } else {
      state.phase = 'AM';
      state.day += 1;
    }

    // Reset AP
    state.ap.current = AP_MAX;
    state.ap.max = AP_MAX;

    // Status decay
    const horse = getActiveHorse();
    decayStatusOnTimeAdvance(horse);

    // Lotto draw happens "다음 날 오전"
    if (state.phase === 'AM') {
      await resolveLottoIfDue();
    }

    saveGame(state);
    renderAll();
  }

  async function resolveLottoIfDue() {
    const t = state.lotto.ticket;
    if (!t || t.status !== 'pending') return;
    if (t.drawPhase !== 'AM') return;
    if (state.day !== t.drawDay) return;

    if (!Array.isArray(t.numbers) || t.numbers.length !== LOTTO.picks) {
      // invalid ticket -> discard
      state.lotto.history.unshift({
        ...t,
        status: 'invalid',
        resultAtDay: state.day,
      });
      state.lotto.ticket = null;
      saveGame(state);
      return;
    }

    const winning = drawUniqueNumbers(LOTTO.min, LOTTO.max, LOTTO.picks).sort(
      (a, b) => a - b
    );
    const matches = t.numbers.filter((n) => winning.includes(n)).length;

    const prize = LOTTO.payoutByMatches[matches] ?? 0;
    addMoney(prize);

    const rankLabel = matches >= 2 ? `${7 - matches}등` : '6등(꽝)'; // 6->1등,5->2등,4->3등,3->4등,2->5등,0/1->6등
    const result = {
      ...t,
      status: 'drawn',
      winningNumbers: winning,
      matches,
      prize,
      rank: rankLabel,
      resultAtDay: state.day,
    };

    state.lotto.history.unshift(result);
    state.lotto.ticket = null;

    saveGame(state);

    openModal({
      title: `🎟️ ${LOTTO.name} 결과`,
      desc: `당첨 번호: ${winning.join(', ')}\n내 번호: ${t.numbers.join(
        ', '
      )}\n적중: ${matches}개 → ${rankLabel}\n당첨금: ${nfmt(prize)}원`,
      actions: [
        el('button', {
          class: 'pc-btn pc-btnPrimary',
          text: '오케이',
          onclick: (e) => e.target.closest('.pc-modalOverlay')?.remove(),
        }),
      ],
    });
  }

  function drawUniqueNumbers(min, max, count) {
    const set = new Set();
    while (set.size < count) {
      set.add(randInt(min, max));
    }
    return [...set];
  }

  async function doWork() {
    if (!spendAP(1)) return toast('AP가 부족해요!');
    const pay = weightedWorkPayout();
    addMoney(pay);
    saveGame(state);
    renderAll();
    toast(`알바 완료! +${nfmt(pay)}원`);
  }

  async function doGrandPrix() {
    if (!spendAP(GP.apCost)) return toast('AP가 부족해요! (필요: 5)');
    const horse = getActiveHorse();
    const chance = computeWinChance(horse);

    const leagueCfg = GP.leagues[state.gp.league - 1] || GP.leagues[0];
    const roll = Math.random();
    const win = roll < chance;

    if (win) {
      addMoney(leagueCfg.rewardWin);
      state.gp.wins += 1;
      toast(`🏁 우승! +${nfmt(leagueCfg.rewardWin)}원`);
    } else {
      addMoney(leagueCfg.rewardLose);
      state.gp.losses += 1;
      toast(`🥲 패배… +${nfmt(leagueCfg.rewardLose)}원 (위로금)`);
    }

    // League up
    if (
      win &&
      state.gp.wins >= GP.advanceWins &&
      state.gp.league < GP.leagues.length
    ) {
      state.gp.league += 1;
      state.gp.wins = 0;
      state.gp.losses = 0;
      toast(`리그 승급! → ${GP.leagues[state.gp.league - 1].name}`);
    }

    saveGame(state);
    renderAll();
  }

  async function buyItem(itemId) {
    const def = ITEM_DEFS.find((x) => x.id === itemId);
    if (!def || def.disabled) return;

    const maxBuy = Math.max(1, Math.floor(state.money / def.price));
    const qty = await qtyPickerModal({
      title: def.name,
      desc: `구매 수량을 선택하세요.\n(보유 금액: ${nfmt(state.money)}원)`,
      initial: 1,
      max: maxBuy,
      okText: '구매',
    });

    if (!qty) return;
    const cost = def.price * qty;
    if (state.money < cost) return toast('돈이 부족해요!');
    addMoney(-cost);
    addItem(def.id, qty);

    saveGame(state);
    renderAll();
    toast(`${def.name} x${qty} 구매 완료`);
  }

  async function useInventoryItem(itemId) {
    const def = ITEM_DEFS.find((x) => x.id === itemId);
    const have = state.inventory[itemId] || 0;
    if (!def || have <= 0) return;

    const qty = await qtyPickerModal({
      title: `${def.name} 사용`,
      desc: `사용 개수를 선택하세요.\n(보유: ${have}개)`,
      initial: 1,
      max: have,
      okText: '사용',
    });
    if (!qty) return;

    const horse = getActiveHorse();

    for (let i = 0; i < qty; i++) {
      applyItemEffect(def, horse);
    }
    removeItem(itemId, qty);

    saveGame(state);
    renderAll();
    toast(`${def.name} x${qty} 사용`);
  }

  function applyItemEffect(def, horse) {
    if (!def.effect) return;

    // Status effects
    if (def.effect.status) {
      for (const [k, delta] of Object.entries(def.effect.status)) {
        horse.status[k] = clamp(horse.status[k] + delta, 0, 100);
      }
    }

    // Stat growth effects (random)
    if (def.effect.stat) {
      const statKey = def.effect.stat;
      const inc = randInt(def.effect.min, def.effect.max);
      horse.stats[statKey] = clamp(horse.stats[statKey] + inc, 0, horse.maxCap);
    }
  }

  async function renameActiveHorse() {
    const horse = getActiveHorse();
    const name = await promptModal({
      title: '말 이름 변경',
      desc: '새 이름을 입력해줘 🐴',
      placeholder: horse.name,
      maxLen: 12,
      okText: '변경',
    });
    if (!name) return;
    horse.name = name;
    saveGame(state);
    renderAll();
    toast('이름 변경 완료');
  }

  // ---------------------------------------------------------------------------
  // Gacha flow (confirm -> shake -> reveal -> adopt with name)
  // ---------------------------------------------------------------------------
  async function gachaConfirmAndDraw() {
    if (state.money < GACHA.price) return toast('돈이 부족해요!');
    const ok = await confirmModal({
      title: '말 뽑기',
      desc: `정말 뽑으시겠어요?\n비용: ${nfmt(GACHA.price)}원`,
      okText: '계속',
      cancelText: '취소',
    });
    if (!ok) return;

    addMoney(-GACHA.price);
    saveGame(state);
    renderAll();

    // Shake animation modal
    let disabled = true;
    const box = el(
      'div',
      {
        class: 'pc-card',
        style:
          'text-align:center; padding: 22px; background: var(--panel2); border-radius: 18px;',
      },
      [
        el('div', {
          style: 'font-size:44px; font-weight:1000; letter-spacing:-1px;',
          text: '🎁',
        }),
        el('div', {
          class: 'pc-muted',
          style: 'margin-top:6px; font-weight:900;',
          text: '상자가 흔들리는 중…',
        }),
      ]
    );

    const { close, modal } = openModal({
      title: '뽑기 진행중',
      desc: '잠깐만요! (상자랑 싸우는 중)',
      body: box,
      actions: [
        el('button', { class: 'pc-btn', text: '진행중…', disabled: true }),
      ],
      closeOnOverlay: false,
    });

    // Add shake animation via inline keyframes
    const animStyle = document.createElement('style');
    animStyle.textContent = `
      @keyframes pc-shake {
        0% { transform: translateX(0); }
        20% { transform: translateX(-6px) rotate(-1deg); }
        40% { transform: translateX(6px) rotate(1deg); }
        60% { transform: translateX(-4px) rotate(-1deg); }
        80% { transform: translateX(4px) rotate(1deg); }
        100% { transform: translateX(0); }
      }
      .pc-shaking { animation: pc-shake 0.2s infinite; }
    `;
    document.head.appendChild(animStyle);
    box.classList.add('pc-shaking');

    await sleep(1000);

    box.classList.remove('pc-shaking');
    animStyle.remove();

    close(); // close progress modal

    const newHorse = makeRandomHorse({ name: '새 말' });

    // reveal modal
    const cap = newHorse.maxCap;
    const body = el('div', {}, [
      el('div', { class: 'pc-row' }, [
        el('div', { class: 'pc-grade', text: newHorse.grade }),
        el('div', { class: 'pc-horseName', text: '???' }),
      ]),
      el('div', { class: 'pc-hr' }),
      el('div', {
        class: 'pc-muted',
        style: 'font-weight:900;',
        text: `능력치 상한: ${cap}`,
      }),
      el(
        'div',
        { class: 'pc-barList', style: 'margin-top:10px;' },
        STAT_KEYS.map((k) => statBar(k, newHorse.stats[k], cap))
      ),
    ]);

    const { close: closeReveal } = openModal({
      title: '말이 나왔다!',
      desc: '데려갈래? (마구간이 꽉 차면 교체해야 해요)',
      body,
      actions: [
        el('button', {
          class: 'pc-btn pc-btnGhost',
          text: '떠나보내기',
          onclick: () => {
            closeReveal();
            toast('안녕… 🥲');
            renderAll();
          },
        }),
        el('button', {
          class: 'pc-btn pc-btnPrimary',
          text: '데려가기',
          onclick: async () => {
            // Name input
            const name = await promptModal({
              title: '말 이름 정하기',
              desc: '새 말의 이름을 직접 입력해줘!',
              placeholder: '예: 당근폭주',
              maxLen: 12,
              okText: '확정',
            });
            newHorse.name = name ?? newHorse.name;

            // Capacity handling
            if (state.horses.length >= MAX_HORSES) {
              closeReveal();
              await replaceHorseFlow(newHorse);
            } else {
              state.horses.push(newHorse);
              state.activeHorseId = newHorse.id;
              saveGame(state);
              closeReveal();
              renderAll();
              toast('새 말 영입 완료!');
            }
          },
        }),
      ],
      closeOnOverlay: false,
    });

    // Update reveal name after a tiny delay (dramatic effect)
    setTimeout(() => {
      const nameEl = body.querySelector('.pc-horseName');
      if (nameEl) nameEl.textContent = newHorse.name;
    }, 200);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function replaceHorseFlow(newHorse) {
    // Choose a horse to replace (cannot end with 0 horses anyway)
    const list = el('div', {
      style: 'display:flex; flex-direction:column; gap:10px;',
    });

    state.horses.forEach((h) => {
      const cap = h.maxCap;
      const row = el(
        'div',
        { class: 'pc-card', style: 'padding:10px; background: var(--panel2);' },
        [
          el('div', { class: 'pc-row' }, [
            el(
              'div',
              { style: 'display:flex; gap:10px; align-items:center;' },
              [
                el('div', { class: 'pc-grade', text: h.grade }),
                el('div', { style: 'font-weight:1000;', text: h.name }),
              ]
            ),
            el('button', {
              class: 'pc-btn pc-btnPrimary',
              text: '교체',
              onclick: () => {
                // replace h with newHorse
                const idx = state.horses.findIndex((x) => x.id === h.id);
                if (idx >= 0) {
                  state.horses[idx] = newHorse;
                  state.activeHorseId = newHorse.id;
                  saveGame(state);
                  close.close();
                  renderAll();
                  toast('교체 완료!');
                }
              },
            }),
          ]),
          el('div', {
            class: 'pc-muted',
            style: 'margin-top:8px; font-weight:900;',
            text: `판매가(참고): ${nfmt(sellPrice(h))}원`,
          }),
          el(
            'div',
            { class: 'pc-barList', style: 'margin-top:8px;' },
            STAT_KEYS.map((k) => statBar(k, h.stats[k], cap))
          ),
        ]
      );
      list.appendChild(row);
    });

    const close = openModal({
      title: '마구간이 가득 찼어요',
      desc: '새 말을 데려오려면 기존 말을 하나 교체해야 합니다.',
      body: list,
      actions: [
        el('button', {
          class: 'pc-btn',
          text: '그만둘래',
          onclick: () => {
            close.close();
            toast('이번엔 패스!');
          },
        }),
      ],
      closeOnOverlay: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Lotto purchase UI
  // ---------------------------------------------------------------------------
  async function openLottoPurchase() {
    // Restrict: once per day (AM/PM combined)
    if (state.lotto.ticket)
      return toast('이미 구매한 복권이 있어요! (결과는 다음 날 오전)');
    if (state.lotto.lastPurchaseDay === state.day)
      return toast('오늘은 이미 복권을 구매했어요!');

    if (state.money < LOTTO.price) return toast('돈이 부족해요!');

    const selected = new Set();
    const grid = el('div', { class: 'pc-lottoGrid' });

    for (let n = LOTTO.min; n <= LOTTO.max; n++) {
      const btn = el('div', { class: 'pc-lottoNum', text: String(n) });
      btn.addEventListener('click', () => {
        if (selected.has(n)) {
          selected.delete(n);
          btn.classList.remove('sel');
        } else {
          if (selected.size >= LOTTO.picks) {
            toast(`최대 ${LOTTO.picks}개까지 선택 가능!`);
            return;
          }
          selected.add(n);
          btn.classList.add('sel');
        }
        updatePickText();
      });
      grid.appendChild(btn);
    }

    const pickText = el('div', {
      class: 'pc-muted',
      style: 'font-weight:900; margin: 8px 0 0;',
    });

    function updatePickText() {
      const arr = [...selected].sort((a, b) => a - b);
      pickText.textContent = `선택: ${arr.length}/${LOTTO.picks}  ${
        arr.length ? '(' + arr.join(', ') + ')' : ''
      }`;
    }
    updatePickText();

    const body = el('div', {}, [
      el('div', { class: 'pc-card', style: 'background: var(--panel2);' }, [
        el('div', { style: 'font-weight:1000;', text: `🎟️ ${LOTTO.name}` }),
        el('div', {
          class: 'pc-muted',
          style: 'margin-top:6px; line-height:1.35;',
          text: '1~45 중 6개를 선택하세요.\n결과는 다음 날 오전에 나옵니다.\n하루 1회 구매 가능.',
        }),
        el('div', {
          class: 'pc-muted',
          style: 'margin-top:8px; font-weight:900;',
          text: `가격: ${nfmt(LOTTO.price)}원`,
        }),
      ]),
      el('div', { class: 'pc-hr' }),
      grid,
      pickText,
    ]);

    const { close } = openModal({
      title: '복권 구매 (B)',
      desc: '복권 판매 박스 파트는 B 스타일로 구성했어 😎',
      body,
      actions: [
        el('button', {
          class: 'pc-btn pc-btnGhost',
          text: '취소',
          onclick: () => close(),
        }),
        el('button', {
          class: 'pc-btn pc-btnPrimary',
          text: '구매',
          onclick: async () => {
            const arr = [...selected].sort((a, b) => a - b);
            if (arr.length !== LOTTO.picks) {
              toast('번호 6개를 딱 맞게 선택해줘!');
              return;
            }
            if (state.money < LOTTO.price) {
              toast('돈이 부족해요!');
              return;
            }

            const ok = await confirmModal({
              title: '구매 확인',
              desc: `${LOTTO.name}\n번호: ${arr.join(', ')}\n가격: ${nfmt(
                LOTTO.price
              )}원\n\n구매할까요?`,
              okText: '구매',
              cancelText: '취소',
            });
            if (!ok) return;

            addMoney(-LOTTO.price);
            state.lotto.lastPurchaseDay = state.day;
            state.lotto.ticket = {
              dayPurchased: state.day,
              phasePurchased: state.phase,
              numbers: arr,
              drawDay: state.day + 1,
              drawPhase: 'AM',
              status: 'pending',
            };

            saveGame(state);
            close();
            renderAll();
            toast('복권 구매 완료! (내일 오전에 결과)');
          },
        }),
      ],
      closeOnOverlay: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Horse storage UI (stable)
  // ---------------------------------------------------------------------------
  async function openHorseStorage() {
    const wrap = el('div', {
      style: 'display:flex; flex-direction:column; gap:10px;',
    });

    state.horses.forEach((h) => {
      const active = h.id === state.activeHorseId;
      const cap = h.maxCap;

      const card = el(
        'div',
        {
          class: 'pc-card',
          style: 'background: var(--panel2); padding: 10px;',
        },
        [
          el('div', { class: 'pc-row' }, [
            el(
              'div',
              { style: 'display:flex; gap:10px; align-items:center;' },
              [
                el('div', { class: 'pc-grade', text: h.grade }),
                el('div', { style: 'font-weight:1000;', text: h.name }),
                active ? el('span', { class: 'pc-chip', text: '현재' }) : null,
              ]
            ),
            el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [
              el('button', {
                class: `pc-btn ${active ? '' : 'pc-btnPrimary'}`,
                text: active ? '선택됨' : '말 바꾸기',
                disabled: active,
                onclick: () => {
                  state.activeHorseId = h.id;
                  saveGame(state);
                  close.close();
                  renderAll();
                  toast('말 교체 완료!');
                },
              }),
            ]),
          ]),
          el(
            'div',
            { class: 'pc-barList', style: 'margin-top:10px;' },
            STAT_KEYS.map((k) => statBar(k, h.stats[k], cap))
          ),
          el('div', {
            class: 'pc-muted',
            style: 'margin-top:8px; font-weight:900;',
            text: `판매가: ${nfmt(sellPrice(h))}원`,
          }),
          el(
            'div',
            {
              style: 'margin-top:8px; display:flex; justify-content:flex-end;',
            },
            [
              el('button', {
                class: 'pc-btn pc-btnDanger',
                text: '떠나보내기(판매)',
                disabled: state.horses.length <= 1,
                onclick: async () => {
                  if (state.horses.length <= 1) return;
                  const ok = await confirmModal({
                    title: '말 떠나보내기',
                    desc: `${h.name} (${
                      h.grade
                    })을(를) 판매할까요?\n\n판매가: ${nfmt(
                      sellPrice(h)
                    )}원\n주의: 말은 최소 1마리는 보유해야 해요!`,
                    okText: '판매',
                    cancelText: '취소',
                    danger: true,
                  });
                  if (!ok) return;

                  const price = sellPrice(h);
                  addMoney(price);

                  // remove horse
                  state.horses = state.horses.filter((x) => x.id !== h.id);
                  if (!state.horses.some((x) => x.id === state.activeHorseId)) {
                    state.activeHorseId = state.horses[0].id;
                  }
                  saveGame(state);
                  close.close();
                  renderAll();
                  toast('판매 완료… 잘 가… 🥲');
                },
              }),
            ]
          ),
        ]
      );

      wrap.appendChild(card);
    });

    const close = openModal({
      title: '말 보관함',
      desc: `보유 말: ${state.horses.length}/${MAX_HORSES}`,
      body: wrap,
      actions: [
        el('button', {
          class: 'pc-btn pc-btnPrimary',
          text: '닫기',
          onclick: (e) => e.target.closest('.pc-modalOverlay')?.remove(),
        }),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  async function openSettings() {
    const body = el('div', {}, [
      el('div', { class: 'pc-card', style: 'background: var(--panel2);' }, [
        el('div', { style: 'font-weight:1000;', text: '테마' }),
        el('div', {
          class: 'pc-muted',
          style: 'margin-top:6px;',
          text: '라이트/다크 모드 전환',
        }),
        el(
          'div',
          { style: 'display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;' },
          [
            el('button', {
              class: `pc-btn ${state.theme === 'light' ? 'pc-btnPrimary' : ''}`,
              text: '라이트',
              onclick: () => {
                state.theme = 'light';
                applyTheme('light');
                saveGame(state);
                renderAll();
              },
            }),
            el('button', {
              class: `pc-btn ${state.theme === 'dark' ? 'pc-btnPrimary' : ''}`,
              text: '다크',
              onclick: () => {
                state.theme = 'dark';
                applyTheme('dark');
                saveGame(state);
                renderAll();
              },
            }),
          ]
        ),
      ]),
      el(
        'div',
        {
          class: 'pc-card',
          style: 'background: var(--panel2); margin-top:10px;',
        },
        [
          el('div', { style: 'font-weight:1000;', text: '게임 초기화' }),
          el('div', {
            class: 'pc-muted',
            style: 'margin-top:6px; line-height:1.35;',
            text: '세이브가 전부 삭제되고 처음부터 시작합니다.\n(되돌리기 없음 😇)',
          }),
          el(
            'div',
            {
              style: 'margin-top:10px; display:flex; justify-content:flex-end;',
            },
            [
              el('button', {
                class: 'pc-btn pc-btnDanger',
                text: '초기화',
                onclick: async () => {
                  const ok1 = await confirmModal({
                    title: '초기화 확인',
                    desc: '진짜로 초기화할까요?\n(말, 돈, 인벤토리, 기록 다 날아감)',
                    okText: '계속',
                    cancelText: '취소',
                    danger: true,
                  });
                  if (!ok1) return;
                  const ok2 = await confirmModal({
                    title: '마지막 확인',
                    desc: '마지막 기회입니다.\n정말로 초기화할까요?',
                    okText: '초기화',
                    cancelText: '취소',
                    danger: true,
                  });
                  if (!ok2) return;
                  resetGame();
                  toast('초기화 완료!');
                },
              }),
            ]
          ),
        ]
      ),
    ]);

    openModal({
      title: '설정',
      desc: '여기서 테마도 바꾸고, 게임도 초기화할 수 있어요.',
      body,
      actions: [
        el('button', {
          class: 'pc-btn pc-btnPrimary',
          text: '닫기',
          onclick: (e) => e.target.closest('.pc-modalOverlay')?.remove(),
        }),
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function statBar(key, val, cap) {
    const fill = el('div', { class: 'pc-barFill' });
    const pct = cap > 0 ? clamp((val / cap) * 100, 0, 100) : 0;
    fill.style.width = `${pct}%`;

    return el('div', { class: 'pc-barRow' }, [
      el('div', {
        class: 'pc-muted',
        style: 'font-weight:900;',
        text: STAT_LABEL[key],
      }),
      el('div', { class: 'pc-bar' }, [fill]),
      el('div', { class: 'pc-barVal', text: `${val}/${cap}` }),
    ]);
  }

  function statusRow(label, val) {
    const fill = el('div', { class: 'pc-barFill' });
    fill.style.width = `${clamp(val, 0, 100)}%`;
    return el('div', { class: 'pc-barRow' }, [
      el('div', { class: 'pc-muted', style: 'font-weight:900;', text: label }),
      el('div', { class: 'pc-bar' }, [fill]),
      el('div', { class: 'pc-barVal', text: `${Math.floor(val)}/100` }),
    ]);
  }

  function renderTopbar(root) {
    const tab = TABS.find((t) => t.id === state.currentTab) || TABS[0];
    const topbar = el('div', { class: 'pc-topbar' }, [
      el('div', { class: 'pc-topbar-inner' }, [
        el('div', { class: 'pc-leftStack' }, [
          el('div', {
            class: 'pc-date',
            text: `${state.day}일차 ${PHASE_LABEL[state.phase]}`,
          }),
          el('div', { class: 'pc-tabname', text: tab.label }),
        ]),
        el('div', { class: 'pc-rightStack' }, [
          el('div', {
            class: 'pc-money',
            text: `${nfmt(state.money)}원`,
            onclick: async () => {
              // Developer mode: subtle money add
              const amtStr = prompt(
                '개발자 모드: 추가할 금액을 입력하세요 (숫자만)'
              );
              if (amtStr == null) return;
              const amt = Number(amtStr);
              if (!Number.isFinite(amt)) return toast('숫자만 입력!');
              addMoney(Math.floor(amt));
              saveGame(state);
              renderAll();
              toast('…(아무 일도 없었다)');
            },
          }),
          el('div', {
            class: 'pc-ap',
            text: `AP ${state.ap.current}/${state.ap.max}`,
          }),
        ]),
      ]),
    ]);
    root.appendChild(topbar);
  }

  function renderBottomNav(root) {
    const nav = el(
      'div',
      { class: 'pc-bottomNav' },
      TABS.map((t) =>
        el(
          'div',
          {
            class: `pc-navBtn ${state.currentTab === t.id ? 'active' : ''}`,
            onclick: () => {
              state.currentTab = t.id;
              saveGame(state);
              renderAll();
            },
          },
          [el('div', { class: 'pc-dot' }), el('div', { text: t.label })]
        )
      )
    );
    root.appendChild(nav);
  }

  function renderFabs(root) {
    // Swapped positions per 0.3.6: Next is bottom-right, Settings bottom-left
    const next = el('div', {
      class: 'pc-fab pc-fabNext',
      text: '▶',
      onclick: advanceTime,
      title: '다음 시간대로',
    });
    const settings = el('div', {
      class: 'pc-fab pc-fabSettings',
      text: '⚙',
      onclick: openSettings,
      title: '설정',
    });
    root.appendChild(next);
    root.appendChild(settings);
  }

  function renderStable(main) {
    const horse = getActiveHorse();
    const cap = horse.maxCap;

    // Horse header
    const header = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-row' }, [
        el('div', { style: 'display:flex; gap:10px; align-items:center;' }, [
          el('div', { class: 'pc-grade', text: horse.grade }),
          el('div', { class: 'pc-horseName', text: horse.name }),
        ]),
        el(
          'div',
          {
            style:
              'display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;',
          },
          [
            el('button', {
              class: 'pc-btn',
              text: '말 보관함',
              onclick: openHorseStorage,
            }),
            el('button', {
              class: 'pc-btn',
              text: '이름 변경',
              onclick: renameActiveHorse,
            }),
          ]
        ),
      ]),
      el('div', {
        class: 'pc-muted',
        style: 'margin-top:8px; font-weight:900;',
        text: `능력치 상한: ${cap}`,
      }),
    ]);

    main.appendChild(header);

    // Stats
    const statCard = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '능력치' }),
      el(
        'div',
        { class: 'pc-barList' },
        STAT_KEYS.map((k) => statBar(k, horse.stats[k], cap))
      ),
    ]);
    main.appendChild(statCard);

    // Status
    const statusCard = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '상태' }),
      el('div', { class: 'pc-barList' }, [
        statusRow('포만감', horse.status.fullness),
        statusRow('위생', horse.status.hygiene),
        statusRow('기분', horse.status.mood),
      ]),
    ]);
    main.appendChild(statusCard);

    // Inventory
    const invItems = Object.entries(state.inventory)
      .filter(([id, qty]) => qty > 0 && ITEM_DEFS.some((d) => d.id === id))
      .map(([id, qty]) => ({
        id,
        qty,
        def: ITEM_DEFS.find((d) => d.id === id),
      }));

    const invCard = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-row' }, [
        el('div', { class: 'pc-cardTitle', text: '인벤토리' }),
        el('div', {
          class: 'pc-muted',
          style: 'font-weight:900;',
          text: `${invItems.length}종`,
        }),
      ]),
    ]);

    if (invItems.length === 0) {
      invCard.appendChild(
        el('div', {
          class: 'pc-muted',
          text: '보유 중인 아이템이 없어요. 상점으로 가서 사오자! 🏃‍♀️',
        })
      );
    } else {
      const grid = el('div', { class: 'pc-grid2', style: 'margin-top:10px;' });
      invItems.forEach(({ id, qty, def }) => {
        const card = el(
          'div',
          { class: 'pc-itemCard', onclick: () => useInventoryItem(id) },
          [
            el('div', { class: 'pc-itemImg' }),
            el('div', { class: 'pc-itemName', text: `${def.name} x${qty}` }),
            el('div', { class: 'pc-itemDesc', text: def.desc }),
            el('div', { class: 'pc-itemPrice', text: '사용하기' }),
          ]
        );
        grid.appendChild(card);
      });
      invCard.appendChild(grid);
      invCard.appendChild(
        el('div', {
          class: 'pc-muted',
          style: 'margin-top:8px;',
          text: '아이템을 클릭하면 사용 개수를 선택할 수 있어요.',
        })
      );
    }

    main.appendChild(invCard);
  }

  function renderShop(main) {
    // Category tabs
    const tabs = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '상점' }),
      el(
        'div',
        { class: 'pc-tabs' },
        SHOP_CATEGORIES.map((c) =>
          el('div', {
            class: `pc-tabBtn ${state.shopCat === c.id ? 'active' : ''}`,
            text: c.label,
            onclick: () => {
              state.shopCat = c.id;
              saveGame(state);
              renderAll();
            },
          })
        )
      ),
      el('div', {
        class: 'pc-muted',
        style: 'margin-top:8px;',
        text: '인터넷 쇼핑 느낌으로 플랫하게 정리했어. (섀도우? 그런 거 없음 ㅋ)',
      }),
    ]);

    main.appendChild(tabs);

    if (state.shopCat === 'lotto') {
      const lottoCard = el('div', { class: 'pc-card' }, [
        el('div', { class: 'pc-cardTitle', text: `🎟️ ${LOTTO.name}` }),
        el('div', {
          class: 'pc-muted',
          style: 'line-height:1.45;',
          text: `가격: ${nfmt(
            LOTTO.price
          )}원\n하루 1회 구매 가능\n결과는 다음 날 오전에 공개`,
        }),
        el(
          'div',
          {
            style:
              'margin-top:10px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;',
          },
          [
            el('button', {
              class: 'pc-btn',
              text: '구매하기',
              onclick: openLottoPurchase,
            }),
          ]
        ),
      ]);
      main.appendChild(lottoCard);

      // Pending ticket / History
      if (state.lotto.ticket) {
        const t = state.lotto.ticket;
        main.appendChild(
          el('div', { class: 'pc-card' }, [
            el('div', { class: 'pc-cardTitle', text: '대기 중인 복권' }),
            el('div', {
              class: 'pc-muted',
              style: 'line-height:1.45;',
              text: `구매: ${t.dayPurchased}일차 ${
                PHASE_LABEL[t.phasePurchased]
              }\n내 번호: ${t.numbers.join(', ')}\n추첨: ${t.drawDay}일차 오전`,
            }),
          ])
        );
      }

      const hist = state.lotto.history.slice(0, 5);
      main.appendChild(
        el('div', { class: 'pc-card' }, [
          el('div', { class: 'pc-cardTitle', text: '최근 결과' }),
          hist.length
            ? el(
                'div',
                {
                  style:
                    'display:flex; flex-direction:column; gap:10px; margin-top:8px;',
                },
                hist.map((r) => {
                  const rank = r.rank ?? '결과';
                  return el(
                    'div',
                    {
                      class: 'pc-card',
                      style: 'background: var(--panel2); padding: 10px;',
                    },
                    [
                      el('div', {
                        style: 'font-weight:1000;',
                        text: `${r.resultAtDay || '?'}일차 결과 · ${rank}`,
                      }),
                      el('div', {
                        class: 'pc-muted',
                        style: 'margin-top:6px; line-height:1.45;',
                        text: `당첨: ${
                          r.winningNumbers?.join(', ') ?? '-'
                        }\n내 번호: ${r.numbers?.join(', ') ?? '-'}\n적중: ${
                          r.matches ?? 0
                        }개 · 당첨금: ${nfmt(r.prize ?? 0)}원`,
                      }),
                    ]
                  );
                })
              )
            : el('div', { class: 'pc-muted', text: '아직 결과가 없어요.' }),
        ])
      );

      return;
    }

    // Items grid
    const defs = ITEM_DEFS.filter((d) => d.cat === state.shopCat);
    // Group by group
    const groups = {};
    defs.forEach((d) => {
      const g = d.group || '기타';
      groups[g] = groups[g] || [];
      groups[g].push(d);
    });

    for (const [gname, items] of Object.entries(groups)) {
      main.appendChild(
        el('div', { class: 'pc-card' }, [
          el('div', { class: 'pc-cardTitle', text: gname }),
          state.shopCat === 'special'
            ? el('div', {
                class: 'pc-muted',
                text: '현재는 재고 없음으로 표시됩니다.',
              })
            : el('div', {
                class: 'pc-muted',
                text: '아이템을 클릭하면 상세 모달에서 수량을 정해 구매할 수 있어요.',
              }),
        ])
      );

      const grid = el('div', { class: 'pc-grid2' });
      items.forEach((def) => {
        const card = el(
          'div',
          {
            class: 'pc-itemCard',
            onclick: () => {
              if (def.disabled) return;
              openItemDetail(def);
            },
          },
          [
            el('div', { class: 'pc-itemImg' }),
            el('div', { class: 'pc-itemName', text: def.name }),
            el('div', { class: 'pc-itemDesc', text: def.desc }),
            el('div', {
              class: 'pc-itemPrice',
              text: def.disabled ? '재고 없음' : `${nfmt(def.price)}원`,
            }),
          ]
        );
        if (def.disabled) card.style.opacity = '0.6';
        grid.appendChild(card);
      });

      main.appendChild(grid);
    }

    function openItemDetail(def) {
      const body = el('div', {}, [
        el('div', {
          class: 'pc-itemImg',
          style: 'width: 120px; margin: 0 auto 10px;',
        }),
        el('div', {
          style: 'text-align:center; font-weight:1000; font-size:18px;',
          text: def.name,
        }),
        el('div', {
          class: 'pc-muted',
          style: 'text-align:center; margin-top:6px; white-space:pre-line;',
          text: `${def.desc}\n가격: ${nfmt(def.price)}원`,
        }),
      ]);

      const { close } = openModal({
        title: '상품 상세',
        desc: '수량을 조절해서 구매할 수 있어요.',
        body,
        actions: [
          el('button', {
            class: 'pc-btn pc-btnGhost',
            text: '닫기',
            onclick: () => close(),
          }),
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: '구매',
            onclick: async () => {
              close();
              await buyItem(def.id);
            },
          }),
        ],
      });
    }
  }

  function renderWork(main) {
    const card = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '알바' }),
      el('div', {
        class: 'pc-muted',
        style: 'line-height:1.45;',
        text: 'AP 1 소모\n보상은 1,000~100,000원 랜덤!\n(낮은 금액이 더 잘 나와요… 현실 고증 ㅠ)',
      }),
      el(
        'div',
        { style: 'margin-top:10px; display:flex; justify-content:flex-end;' },
        [
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: '알바 하기',
            onclick: doWork,
          }),
        ]
      ),
    ]);
    main.appendChild(card);
  }

  function renderGacha(main) {
    const card = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '뽑기' }),
      el('div', {
        class: 'pc-muted',
        style: 'line-height:1.45;',
        text: `말을 뽑아 마구간에 보관할 수 있어요.\n보관 한도: ${MAX_HORSES}마리\n비용: ${nfmt(
          GACHA.price
        )}원`,
      }),
      el(
        'div',
        {
          style:
            'margin-top:10px; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;',
        },
        [
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: '말 뽑기',
            onclick: gachaConfirmAndDraw,
          }),
        ]
      ),
    ]);

    main.appendChild(card);

    const info = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '확률(참고)' }),
      el('div', {
        class: 'pc-muted',
        style: 'line-height:1.45;',
        text: 'SS 1% · S 4% · A 15% · B 30% · C 50%\n(운빨겜은 운빨겜이다…)',
      }),
    ]);
    main.appendChild(info);
  }

  function renderGP(main) {
    const horse = getActiveHorse();
    const chance = computeWinChance(horse);
    const leagueCfg = GP.leagues[state.gp.league - 1] || GP.leagues[0];

    const card = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '그랑프리' }),
      el('div', {
        class: 'pc-muted',
        style: 'line-height:1.45;',
        text: `AP ${GP.apCost} 소모\n현재 리그: ${
          leagueCfg.name
        }\n우승 확률(추정): ${(chance * 100).toFixed(1)}%`,
      }),
      el(
        'div',
        { style: 'margin-top:10px; display:flex; justify-content:flex-end;' },
        [
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: '레이스 참가',
            onclick: doGrandPrix,
          }),
        ]
      ),
    ]);
    main.appendChild(card);

    const rec = el('div', { class: 'pc-card' }, [
      el('div', { class: 'pc-cardTitle', text: '전적' }),
      el('div', {
        class: 'pc-muted',
        style: 'font-weight:900;',
        text: `승: ${state.gp.wins} · 패: ${state.gp.losses}`,
      }),
      el('div', {
        class: 'pc-muted',
        style: 'margin-top:6px; line-height:1.45;',
        text: `우승 보상: ${nfmt(leagueCfg.rewardWin)}원\n패배 위로금: ${nfmt(
          leagueCfg.rewardLose
        )}원\n승급 조건: 우승 ${GP.advanceWins}회`,
      }),
    ]);
    main.appendChild(rec);
  }

  function renderMain(root) {
    const main = el('div', { class: 'pc-main' });

    if (state.currentTab === 'stable') renderStable(main);
    else if (state.currentTab === 'shop') renderShop(main);
    else if (state.currentTab === 'work') renderWork(main);
    else if (state.currentTab === 'gacha') renderGacha(main);
    else if (state.currentTab === 'gp') renderGP(main);

    root.appendChild(main);
  }

  function renderAll() {
    try {
      const appRoot = ensureAppRoot();
      clear(appRoot);

      const root = el('div', { class: 'pc-app' });
      renderTopbar(root);
      renderMain(root);
      renderBottomNav(root);
      renderFabs(root);

      appRoot.appendChild(root);
    } catch (e) {
      console.error(e);
      showFatal(e);
    }
  }

  function showFatal(e) {
    const appRoot = ensureAppRoot();
    clear(appRoot);
    const msg = el('div', { class: 'pc-card', style: 'margin: 16px;' }, [
      el('div', { class: 'pc-cardTitle', text: '앗… 게임이 멈췄어요' }),
      el('div', {
        class: 'pc-muted',
        style: 'white-space:pre-line;',
        text: String(e?.stack || e),
      }),
      el(
        'div',
        { style: 'margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;' },
        [
          el('button', {
            class: 'pc-btn pc-btnPrimary',
            text: '새로고침',
            onclick: () => location.reload(),
          }),
          el('button', {
            class: 'pc-btn pc-btnDanger',
            text: '세이브 삭제(긴급)',
            onclick: () => {
              localStorage.removeItem(LS_KEY);
              location.reload();
            },
          }),
        ]
      ),
    ]);
    appRoot.appendChild(msg);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    injectRuntimeStyle();
    preventDoubleTapZoom();

    state = loadGame();
    applyTheme(state.theme);

    // In case lotto draw is due right now (e.g., user opened game on draw morning)
    // resolve once at startup; if it changes state, save.
    (async () => {
      const beforeMoney = state.money;
      await resolveLottoIfDue();
      if (state.money !== beforeMoney) saveGame(state);
      renderAll();
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
