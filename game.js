(() => {
  'use strict';

  // v0.3.3: new key + migrate from legacy
  const STORAGE_KEY = 'carrot_v0.3.3';
  const LEGACY_KEYS = ['carrot_v0.3.2'];

  // ---------- Data Tables ----------
  const SELL_PRICE = { C: 50000, B: 100000, A: 150000, S: 200000, SS: 250000 };
  const GRADE_CAP = { C: 60, B: 70, A: 80, S: 90, SS: 100 };

  const DROP_RATES = {
    normal: [
      { grade: 'SS', p: 0.01 },
      { grade: 'S', p: 0.04 },
      { grade: 'A', p: 0.15 },
      { grade: 'B', p: 0.3 },
      { grade: 'C', p: 0.5 },
    ],
    premium: [
      { grade: 'SS', p: 0.04 },
      { grade: 'S', p: 0.08 },
      { grade: 'A', p: 0.2 },
      { grade: 'B', p: 0.25 },
      { grade: 'C', p: 0.43 },
    ],
  };

  const LEAGUES = [
    { code: 'H5', fee: 3000, prize: 1000000, base: 0.05 },
    { code: 'H4', fee: 5000, prize: 2000000, base: 0.04 },
    { code: 'H3', fee: 10000, prize: 3000000, base: 0.03 },
    { code: 'H2', fee: 15000, prize: 5000000, base: 0.02 },
    { code: 'H1', fee: 20000, prize: 10000000, base: 0.01 },
  ];

  const STORE_ITEMS = [
    {
      id: 'feed',
      name: '먹이',
      price: 10000,
      desc: '포만감 +25',
      use: (horse) =>
        (horse.status.fullness = clamp(horse.status.fullness + 25, 0, 100)),
    },
    {
      id: 'shampoo',
      name: '샴푸',
      price: 8000,
      desc: '위생 +25',
      use: (horse) =>
        (horse.status.hygiene = clamp(horse.status.hygiene + 25, 0, 100)),
    },
    {
      id: 'toy',
      name: '장난감',
      price: 9000,
      desc: '기분 +25',
      use: (horse) =>
        (horse.status.mood = clamp(horse.status.mood + 25, 0, 100)),
    },
    {
      id: 'training',
      name: '훈련 티켓',
      price: 20000,
      desc: '무작위 능력치 +2~5 (상한까지)',
      use: (horse) => {
        const keys = ['stamina', 'speed', 'spirit', 'charm'];
        const k = keys[randInt(0, keys.length - 1)];
        const inc = randInt(2, 5);
        horse.stats[k] = clamp(horse.stats[k] + inc, 0, horse.maxCap);
      },
    },
  ];

  // ---------- State ----------
  let gameData = null;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const timePill = $('#timePill');
  const apText = $('#apText');
  const apSkipBtn = $('#apSkipBtn');
  const moneyText = $('#moneyText');
  const moneyBtn = $('#moneyBtn');

  const horseCount = $('#horseCount');
  const horseList = $('#horseList');
  const horseDetail = $('#horseDetail');
  const inventoryList = $('#inventoryList');
  const sellArea = $('#sellArea');

  const storeItemsEl = $('#storeItems');
  const gachaNormalBtn = $('#gachaNormalBtn');
  const gachaPremiumBtn = $('#gachaPremiumBtn');

  const workBtn = $('#workBtn');
  const workClicksEl = $('#workClicks');
  const workPayEl = $('#workPay');
  const coolbar = $('#coolbar');

  const lotteryGrid = $('#lotteryGrid');
  const lotteryState = $('#lotteryState');
  const lotteryClearBtn = $('#lotteryClearBtn');
  const lotteryBuyBtn = $('#lotteryBuyBtn');
  const lotteryCheckBtn = $('#lotteryCheckBtn');

  const leagueList = $('#leagueList');
  const raceLog = $('#raceLog');

  const toast = $('#toast');

  // Modal
  const modalRoot = $('#modalRoot');
  const modalTitle = $('#modalTitle');
  const modalContent = $('#modalContent');
  const modalLeftBtn = $('#modalLeftBtn');
  const modalRightBtn = $('#modalRightBtn');

  // Tabs
  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.view').forEach((v) => v.classList.remove('active'));
      $(`#view-${tab}`).classList.add('active');
      renderAll();
    });
  });

  // ---------- Init ----------
  loadOrCreate();
  bindEvents();
  renderAll();

  // ---------- Helpers ----------
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function formatMoney(n) {
    return n.toLocaleString('ko-KR');
  }
  function rand() {
    return Math.random();
  }
  function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function pickByRates(rateList) {
    const r = rand();
    let acc = 0;
    for (const it of rateList) {
      acc += it.p;
      if (r <= acc) return it.grade;
    }
    return rateList[rateList.length - 1].grade;
  }

  function computeCondition(horse) {
    const { fullness, hygiene, mood } = horse.status;
    return Math.round((fullness + hygiene + mood) / 3);
  }

  function toastMsg(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function normalizeHorse(h) {
    const grade =
      h && typeof h.grade === 'string' && GRADE_CAP[h.grade] ? h.grade : 'C';

    // ✅ 등급별 상한을 넘지 못하게 2중 안전장치
    const gradeCap = GRADE_CAP[grade];
    const rawMaxCap = Number(h?.maxCap);
    const maxCap = Number.isFinite(rawMaxCap)
      ? clamp(rawMaxCap, 1, gradeCap) // ← 핵심: gradeCap으로 한 번 더 클램프
      : gradeCap;

    const stats = h?.stats && typeof h.stats === 'object' ? h.stats : {};
    const status = h?.status && typeof h.status === 'object' ? h.status : {};

    // ✅ NaN/미지정일 때 "랜덤" 대신 "예측 가능한 값"으로 고정
    // (등급이 높을수록 기본값도 자연스럽게 높게 잡히는, but deterministic)
    const baseMin = Math.max(20, maxCap - 35);
    const safeStat = (v) => (Number.isFinite(Number(v)) ? Number(v) : baseMin);

    const fixed = {
      id:
        typeof h?.id === 'string'
          ? h.id
          : `h_${Date.now()}_${Math.random().toString(16).slice(2)}`,

      name: typeof h?.name === 'string' ? h.name : `당근${randInt(10, 99)}`,

      grade,
      maxCap,

      stats: {
        stamina: clamp(safeStat(stats.stamina), 0, maxCap),
        speed: clamp(safeStat(stats.speed), 0, maxCap),
        spirit: clamp(safeStat(stats.spirit), 0, maxCap),
        charm: clamp(safeStat(stats.charm), 0, maxCap),
      },

      status: {
        fullness: clamp(
          Number.isFinite(Number(status.fullness))
            ? Number(status.fullness)
            : 80,
          0,
          100
        ),
        hygiene: clamp(
          Number.isFinite(Number(status.hygiene)) ? Number(status.hygiene) : 80,
          0,
          100
        ),
        mood: clamp(
          Number.isFinite(Number(status.mood)) ? Number(status.mood) : 80,
          0,
          100
        ),
      },
    };

    return fixed;
  }

  function applyDefaults(d) {
    let dirty = false;
    const out = d && typeof d === 'object' ? d : ((dirty = true), {});

    // version
    if (out.version !== 'v0.3.3') {
      out.version = 'v0.3.3';
      dirty = true;
    }

    // money
    if (!Number.isFinite(out.money)) {
      out.money = 100000;
      dirty = true;
    }

    // horses
    if (!Array.isArray(out.horses)) {
      out.horses = [];
      dirty = true;
    }
    const beforeHorseJson = JSON.stringify(out.horses);
    out.horses = out.horses.map(normalizeHorse);
    if (JSON.stringify(out.horses) !== beforeHorseJson) dirty = true;

    // currentHorseId
    if (!Number.isInteger(out.currentHorseId)) {
      out.currentHorseId = 0;
      dirty = true;
    }

    // inventory
    if (!(out.inventory && typeof out.inventory === 'object')) {
      out.inventory = {};
      dirty = true;
    }
    for (const it of STORE_ITEMS) {
      if (!Number.isFinite(out.inventory[it.id])) {
        out.inventory[it.id] = 0;
        dirty = true;
      }
    }

    // time
    if (!(out.time && typeof out.time === 'object')) {
      out.time = {};
      dirty = true;
    }
    if (!Number.isFinite(out.time.day)) {
      out.time.day = 1;
      dirty = true;
    }
    if (!(out.time.phase === 'AM' || out.time.phase === 'PM')) {
      out.time.phase = 'AM';
      dirty = true;
    }
    if (!Number.isFinite(out.time.apMax)) {
      out.time.apMax = 4;
      dirty = true;
    }
    if (!Number.isFinite(out.time.ap)) {
      out.time.ap = out.time.apMax;
      dirty = true;
    }
    const apClamped = clamp(out.time.ap, 0, out.time.apMax);
    if (apClamped !== out.time.ap) {
      out.time.ap = apClamped;
      dirty = true;
    }

    // lottery
    if (!(out.lottery && typeof out.lottery === 'object')) {
      out.lottery = {};
      dirty = true;
    }
    if (!['ready', 'bought', 'resultReady'].includes(out.lottery.status)) {
      out.lottery.status = 'ready';
      dirty = true;
    }
    if (!!out.lottery.isPurchased !== out.lottery.isPurchased) {
      out.lottery.isPurchased = !!out.lottery.isPurchased;
      dirty = true;
    }
    if (!Array.isArray(out.lottery.pick)) {
      out.lottery.pick = [];
      dirty = true;
    }
    if (!Number.isFinite(out.lottery.purchaseDay)) {
      out.lottery.purchaseDay = null;
      dirty = true;
    }
    if (!Array.isArray(out.lottery.drawNumbers)) {
      out.lottery.drawNumbers = [];
      dirty = true;
    }
    if (
      !(out.lottery.lastResult && typeof out.lottery.lastResult === 'object') &&
      out.lottery.lastResult !== null
    ) {
      out.lottery.lastResult = null;
      dirty = true;
    }

    // unlockedLeagues
    if (!Array.isArray(out.unlockedLeagues)) {
      out.unlockedLeagues = ['H5'];
      dirty = true;
    }
    if (!out.unlockedLeagues.includes('H5')) {
      out.unlockedLeagues.unshift('H5');
      dirty = true;
    }

    // work
    if (!(out.work && typeof out.work === 'object')) {
      out.work = {};
      dirty = true;
    }
    if (!Number.isFinite(out.work.totalClicks)) {
      out.work.totalClicks = 0;
      dirty = true;
    }
    if (!!out.work.inCooldown !== out.work.inCooldown) {
      out.work.inCooldown = !!out.work.inCooldown;
      dirty = true;
    }

    // logs
    if (!(out.logs && typeof out.logs === 'object')) {
      out.logs = {};
      dirty = true;
    }
    if (!Array.isArray(out.logs.racing)) {
      out.logs.racing = [];
      dirty = true;
    }

    // ✅ 정규화로 인해 데이터가 바뀌면 렌더에서 저장할 수 있게 표시
    out.__dirty = dirty;
    return out;
  }

  function loadFromKey(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function loadOrCreate() {
    // 1) try current key
    let loaded = loadFromKey(STORAGE_KEY);

    // 2) migrate from legacy keys
    if (!loaded) {
      for (const k of LEGACY_KEYS) {
        const legacy = loadFromKey(k);
        if (legacy) {
          loaded = legacy;
          break;
        }
      }
    }

    if (loaded) {
      gameData = applyDefaults(loaded);
      save(); // save under v0.3.3 key
      return;
    }

    // New Game
    const starter = createHorse('C');
    gameData = applyDefaults({
      version: 'v0.3.3',
      money: 100000,
      horses: [starter],
      currentHorseId: 0,
      inventory: { feed: 2, shampoo: 1, toy: 1, training: 0 },
      time: { day: 1, phase: 'AM', ap: 4, apMax: 4 },
      lottery: {
        status: 'ready',
        isPurchased: false,
        pick: [],
        purchaseDay: null,
        drawNumbers: [],
        lastResult: null,
      },
      unlockedLeagues: ['H5'],
      work: { totalClicks: 0, inCooldown: false },
      logs: { racing: [] },
    });
    save();
  }

  function createHorse(grade) {
    const maxCap = GRADE_CAP[grade];
    const baseMin = Math.max(20, maxCap - 35);
    const stats = {
      stamina: randInt(baseMin, maxCap),
      speed: randInt(baseMin, maxCap),
      spirit: randInt(baseMin, maxCap),
      charm: randInt(baseMin, maxCap),
    };
    const id = `h_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const name = `당근${randInt(10, 99)}`;
    return {
      id,
      name,
      grade,
      maxCap,
      stats,
      status: { fullness: 80, hygiene: 80, mood: 80 },
    };
  }

  function ensureMainHorse() {
    if (!Array.isArray(gameData.horses)) gameData.horses = [];
    if (gameData.horses.length === 0) {
      gameData.horses.push(createHorse('C'));
      gameData.currentHorseId = 0;
    }
    gameData.currentHorseId = clamp(
      gameData.currentHorseId,
      0,
      gameData.horses.length - 1
    );
  }

  function spendMoney(amount) {
    if (gameData.money < amount) return false;
    gameData.money -= amount;
    save();
    return true;
  }

  function gainMoney(amount) {
    gameData.money += amount;
    save();
  }

  function canSpendAP(n) {
    return gameData.time.ap >= n;
  }

  /**
   * v0.3.3: options to avoid modal collision (race result overwriting AP modal)
   * opts.suppressAutoPrompt: boolean
   */
  function spendAP(n, reason = '', opts = {}) {
    if (!canSpendAP(n)) return false;
    gameData.time.ap -= n;
    save();

    const suppress = !!opts.suppressAutoPrompt;

    if (gameData.time.ap === 0 && !suppress) {
      openModal({
        title: '⚡️ 행동력 소진!',
        html: `<p>AP를 다 썼어. 지금 페이즈를 넘길까?</p><p class="tiny">(${escapeHtml(
          reason || '휴식/스킵'
        )})</p>`,
        leftText: '아직 잠깐!',
        rightText: '페이즈 전환',
        onLeft: () => {},
        onRight: () => advancePhase(),
      });
    }
    return true;
  }

  function advancePhase() {
    ensureMainHorse();
    const mainId = gameData.currentHorseId;

    gameData.horses = gameData.horses.map(normalizeHorse);

    gameData.horses.forEach((h, idx) => {
      const isMain = idx === mainId;
      const dFull = isMain ? -20 : -10;
      const dHyg = isMain ? -10 : -5;
      const dMood = -5;

      h.status.fullness = clamp(h.status.fullness + dFull, 0, 100);
      h.status.hygiene = clamp(h.status.hygiene + dHyg, 0, 100);
      h.status.mood = clamp(h.status.mood + dMood, 0, 100);
    });

    const prevPhase = gameData.time.phase;

    if (gameData.time.phase === 'AM') gameData.time.phase = 'PM';
    else gameData.time.phase = 'AM';

    const dayChanged = prevPhase === 'PM' && gameData.time.phase === 'AM';
    if (dayChanged) {
      gameData.time.day += 1;
      rollLotteryIfNeeded();
    }

    gameData.time.ap = gameData.time.apMax;

    save();
    closeModal();
    toastMsg(
      dayChanged
        ? '새로운 하루! 🌅 상태가 좀 떨어졌어.'
        : '페이즈 전환! ⏱️ 상태가 좀 떨어졌어.'
    );
    renderAll();
  }

  function rollLotteryIfNeeded() {
    const lot = gameData.lottery;
    if (
      lot.status === 'bought' &&
      lot.isPurchased &&
      lot.purchaseDay === gameData.time.day - 1
    ) {
      lot.drawNumbers = draw3Unique(1, 30);
      const matches = lot.pick.filter((n) =>
        lot.drawNumbers.includes(n)
      ).length;
      const prize = lotteryPrize(matches);
      lot.lastResult = {
        matches,
        prize,
        pick: [...lot.pick],
        draw: [...lot.drawNumbers],
      };
      lot.status = 'resultReady';
      toastMsg('복권 결과가 생성됐어! 🎟️');
    }
    save();
  }

  function draw3Unique(min, max) {
    const set = new Set();
    while (set.size < 3) set.add(randInt(min, max));
    return Array.from(set).sort((a, b) => a - b);
  }

  function lotteryPrize(matches) {
    if (matches === 3) return 10000000;
    if (matches === 2) return 500000;
    if (matches === 1) return 50000;
    return 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // ---------- Modal ----------
  function openModal({ title, html, leftText, rightText, onLeft, onRight }) {
    modalTitle.textContent = title || '알림';
    modalContent.innerHTML = html || '';
    modalLeftBtn.textContent = leftText || '닫기';
    modalRightBtn.textContent = rightText || '확인';

    modalRoot.classList.add('open');
    modalRoot.setAttribute('aria-hidden', 'false');

    modalLeftBtn.onclick = () => {
      closeModal();
      onLeft && onLeft();
    };
    modalRightBtn.onclick = () => {
      closeModal();
      onRight && onRight();
    };
  }

  function closeModal() {
    modalRoot.classList.remove('open');
    modalRoot.setAttribute('aria-hidden', 'true');
    modalLeftBtn.onclick = null;
    modalRightBtn.onclick = null;
  }

  modalRoot.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close === '1') closeModal();
  });

  // ---------- Bind ----------
  function bindEvents() {
    apSkipBtn.addEventListener('click', () => {
      openModal({
        title: '⚡️ 강제 휴식/스킵',
        html: `<p>지금 페이즈를 넘기면 <b>모든 말 상태</b>가 감소해.</p>
              <p class="tiny">그래도? (말도 삶도 관리 안 하면 티가 난다…)</p>`,
        leftText: '취소',
        rightText: '전환',
        onRight: () => advancePhase(),
      });
    });

    // Dev Tools
    moneyBtn.addEventListener('click', () => {
      openModal({
        title: '🧪 Dev Tools',
        html: `
          <p>경제 밸런스 테스트용. 재화를 추가할 수 있어.</p>
          <div class="row" style="margin-top:10px; gap:8px;">
            <span class="pill">추가 금액</span>
            <input id="devMoneyInput" type="number" min="0" value="1000000"
                   style="flex:1; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:white; font-weight:900;">
          </div>
        `,
        leftText: '닫기',
        rightText: '추가',
        onRight: () => {
          const inp = $('#devMoneyInput');
          const v = Math.max(0, Number(inp?.value || 0));
          gainMoney(v);
          toastMsg(`₩${formatMoney(v)} 추가 완료 🧃`);
          renderAll();
        },
      });
    });

    gachaNormalBtn.addEventListener('click', () => startGacha('normal'));
    gachaPremiumBtn.addEventListener('click', () => startGacha('premium'));

    workBtn.addEventListener('click', onWorkClick);

    lotteryClearBtn.addEventListener('click', () => {
      gameData.lottery.pick = [];
      save();
      renderLottery();
    });

    lotteryBuyBtn.addEventListener('click', () => buyLottery());
    lotteryCheckBtn.addEventListener('click', () => checkLottery());
  }

  // ---------- Rendering ----------
  function renderAll() {
    gameData = applyDefaults(gameData);

    // ✅ 한 번 정규화했으면 즉시 저장해서 다음 렌더부터 값이 고정되게
    if (gameData.__dirty) {
      delete gameData.__dirty; // 저장에 섞이지 않게 제거
      save();
    } else {
      delete gameData.__dirty; // 혹시 남아있으면 제거
    }

    ensureMainHorse();

    timePill.textContent = `Day ${gameData.time.day} · ${gameData.time.phase}`;
    apText.textContent = String(gameData.time.ap);
    moneyText.textContent = formatMoney(gameData.money);

    renderStable();
    renderStore();
    renderWork();
    renderLottery();
    renderRacing();
  }

  // ----- Stable -----
  function renderStable() {
    horseCount.textContent = String(gameData.horses.length);

    horseList.innerHTML = '';
    gameData.horses.forEach((h, idx) => {
      const cond = computeCondition(h);
      const el = document.createElement('div');
      el.className = `horse-card ${
        idx === gameData.currentHorseId ? 'active' : ''
      }`;
      el.innerHTML = `
        <div class="horse-meta">
          <div class="horse-name">${escapeHtml(
            h.name
          )} <span class="badge grade-${h.grade}">${h.grade}</span></div>
          <div class="muted">컨디션 ${cond}/100 · 상한 ${h.maxCap}</div>
        </div>
        <div class="pill">선택</div>
      `;
      el.addEventListener('click', () => {
        gameData.currentHorseId = idx;
        save();
        renderStable();
        toastMsg(`메인 말 변경: ${h.name}`);
      });
      horseList.appendChild(el);
    });

    const main = gameData.horses[gameData.currentHorseId];
    const cond = computeCondition(main);
    horseDetail.innerHTML = `
      <div class="card-mini">
        <div class="row">
          <div class="kv">
            <div class="k">이름</div>
            <div class="v">${escapeHtml(main.name)} <span class="badge grade-${
      main.grade
    }">${main.grade}</span></div>
          </div>
          <div class="kv" style="text-align:right">
            <div class="k">컨디션</div>
            <div class="v">${cond}/100</div>
          </div>
        </div>

        <div class="bars">
          ${statBar('체력', main.stats.stamina, main.maxCap)}
          ${statBar('속도', main.stats.speed, main.maxCap)}
          ${statBar('기력', main.stats.spirit, main.maxCap)}
          ${statBar('매력', main.stats.charm, main.maxCap)}
        </div>

        <div class="divider"></div>

        <div class="bars">
          ${statusBar('포만감', main.status.fullness)}
          ${statusBar('위생', main.status.hygiene)}
          ${statusBar('기분', main.status.mood)}
        </div>
      </div>
    `;

    renderInventory();
    renderSellArea();
  }

  function statBar(label, value, cap) {
    const pct = Math.round((value / cap) * 100);
    return `
      <div class="bar">
        <div class="muted">${label}</div>
        <div class="meter"><div class="fill" style="width:${pct}%"></div></div>
        <div style="text-align:right; font-weight:900">${value}</div>
      </div>
    `;
  }

  function statusBar(label, value) {
    const pct = clamp(value, 0, 100);
    const cls = value < 30 ? 'bad' : 'status';
    return `
      <div class="bar">
        <div class="muted">${label}</div>
        <div class="meter"><div class="fill ${cls}" style="width:${pct}%"></div></div>
        <div style="text-align:right; font-weight:900">${value}</div>
      </div>
    `;
  }

  function renderInventory() {
    const inv = gameData.inventory || {};
    inventoryList.innerHTML = '';

    STORE_ITEMS.forEach((it) => {
      const qty = Number(inv[it.id] || 0);
      const row = document.createElement('div');
      row.className = 'inv-item';
      row.innerHTML = `
        <div class="inv-left">
          <div class="inv-title">${escapeHtml(
            it.name
          )} <span class="pill">x${qty}</span></div>
          <div class="inv-desc">${escapeHtml(it.desc)} · 가격 ₩${formatMoney(
        it.price
      )}</div>
        </div>
        <div class="inv-actions">
          <button class="btn primary" ${
            qty <= 0 ? 'disabled' : ''
          }>사용</button>
        </div>
      `;
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        if (qty <= 0) return;

        if (!spendAP(1, `아이템 사용: ${it.name}`)) {
          toastMsg('AP가 부족해 😵');
          return;
        }

        const main = gameData.horses[gameData.currentHorseId];
        it.use(main);
        gameData.inventory[it.id] = qty - 1;

        popEmoji('✨');

        save();
        toastMsg(`${it.name} 사용!`);
        renderAll();
      });

      inventoryList.appendChild(row);
    });
  }

  function popEmoji(emoji) {
    const target = $('#horseDetail');
    if (!target) return;
    const span = document.createElement('span');
    span.textContent = emoji;
    span.className = 'emoji-pop';
    span.style.position = 'absolute';
    span.style.right = '22px';
    span.style.marginTop = '6px';
    span.style.fontSize = '22px';

    const panel = target.closest('.panel');
    panel.style.position = 'relative';
    panel.appendChild(span);

    // reflow reset
    span.offsetHeight;
    setTimeout(() => span.remove(), 700);
  }

  function renderSellArea() {
    sellArea.innerHTML = '';
    if (gameData.horses.length <= 0) return;

    gameData.horses.forEach((h, idx) => {
      const price = SELL_PRICE[h.grade];
      const row = document.createElement('div');
      row.className = 'inv-item';
      row.innerHTML = `
        <div class="inv-left">
          <div class="inv-title">${escapeHtml(
            h.name
          )} <span class="badge grade-${h.grade}">${h.grade}</span></div>
          <div class="inv-desc">판매가 ₩${formatMoney(price)}</div>
        </div>
        <div class="inv-actions">
          <button class="btn">떠나보내기</button>
        </div>
      `;
      row.querySelector('button').addEventListener('click', () => {
        openModal({
          title: '🐴 말 판매',
          html: `<p><b>${escapeHtml(
            h.name
          )}</b>을(를) 떠나보낼까?</p><p class="tiny">판매가: ₩${formatMoney(
            price
          )}</p>`,
          leftText: '아니오',
          rightText: '판매',
          onRight: () => {
            gameData.horses.splice(idx, 1);
            gainMoney(price);
            if (gameData.currentHorseId >= gameData.horses.length)
              gameData.currentHorseId = gameData.horses.length - 1;
            ensureMainHorse();
            save();
            toastMsg(`판매 완료 +₩${formatMoney(price)}`);
            renderAll();
          },
        });
      });
      sellArea.appendChild(row);
    });
  }

  // ----- Store -----
  function renderStore() {
    storeItemsEl.innerHTML = '';
    STORE_ITEMS.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'store-item';
      card.innerHTML = `
        <div class="store-top">
          <div>
            <div style="font-weight:1000">${escapeHtml(it.name)}</div>
            <div class="muted">${escapeHtml(it.desc)}</div>
          </div>
          <div class="pill">₩${formatMoney(it.price)}</div>
        </div>

        <div class="qty-row">
          <div class="qty">
            <span class="muted">수량</span>
            <input type="number" min="1" max="99" value="1" />
          </div>
          <div class="muted">총액: <b style="color:white">₩<span class="total">0</span></b></div>
        </div>

        <button class="btn primary buyBtn" type="button">구매</button>
      `;

      const input = card.querySelector('input');
      const totalEl = card.querySelector('.total');
      const buyBtn = card.querySelector('.buyBtn');

      const updateTotal = () => {
        const qty = clamp(Number(input.value || 1), 1, 99);
        input.value = String(qty);
        totalEl.textContent = formatMoney(qty * it.price);
      };
      input.addEventListener('input', updateTotal);
      updateTotal();

      buyBtn.addEventListener('click', () => {
        const qty = clamp(Number(input.value || 1), 1, 99);
        const cost = qty * it.price;

        openModal({
          title: '🛒 구매 확인',
          html: `<p><b>${escapeHtml(it.name)}</b> x${qty} 구매할까?</p>
                <p class="tiny">총액: ₩${formatMoney(
                  cost
                )} · 잔액(예상): ₩${formatMoney(gameData.money - cost)}</p>`,
          leftText: '취소',
          rightText: '구매',
          onRight: () => {
            if (!spendMoney(cost)) {
              toastMsg('잔액이 부족해 😭');
              return;
            }
            gameData.inventory[it.id] =
              Number(gameData.inventory[it.id] || 0) + qty;
            save();
            toastMsg(`${it.name} x${qty} 구매 완료!`);
            renderAll();
          },
        });
      });

      storeItemsEl.appendChild(card);
    });
  }

  function startGacha(type) {
    const cost = type === 'normal' ? 100000 : 300000;
    const rates = type === 'normal' ? DROP_RATES.normal : DROP_RATES.premium;

    if (!spendMoney(cost)) {
      toastMsg('돈이 부족해… 가챠는 원래 그래 😇');
      return;
    }

    openModal({
      title: '🎁 두구두구…',
      html: `
        <div style="display:grid; place-items:center; gap:10px; padding:8px 0 2px;">
          <div id="gachaBox" class="gacha-box shake">🎁</div>
          <div class="muted">박스가 흔들리는 중…</div>
        </div>
      `,
      leftText: '취소',
      rightText: '계속',
      onLeft: () => {
        toastMsg('이미 결제했어… 돌아올 수 없어…');
      },
      onRight: () => {},
    });

    setTimeout(() => {
      const grade = pickByRates(rates);
      const horse = createHorse(grade);

      const canTake = gameData.horses.length < 5;

      openModal({
        title: `✨ 결과: ${grade} 등급!`,
        html: `
          <p><b>${escapeHtml(horse.name)}</b> (등급 <b>${grade}</b>)</p>
          <div class="card-mini" style="margin-top:10px">
            <div class="muted">능력치 (상한 ${horse.maxCap})</div>
            <div class="bars" style="margin-top:8px">
              ${statBar('체력', horse.stats.stamina, horse.maxCap)}
              ${statBar('속도', horse.stats.speed, horse.maxCap)}
              ${statBar('기력', horse.stats.spirit, horse.maxCap)}
              ${statBar('매력', horse.stats.charm, horse.maxCap)}
            </div>
            <div class="divider"></div>
            <div class="muted">판매가: ₩${formatMoney(SELL_PRICE[grade])}</div>
          </div>
          ${
            canTake
              ? ''
              : `<p style="margin-top:10px;color:rgba(255,204,0,.95)"><b>마구간이 꽉 찼어(5/5)</b> → 데려가기는 불가, 판매만 가능!</p>`
          }
        `,
        leftText: '판매',
        rightText: canTake ? '데려가기' : '확인',
        onLeft: () => {
          gainMoney(SELL_PRICE[grade]);
          toastMsg(`판매 완료 +₩${formatMoney(SELL_PRICE[grade])}`);
          renderAll();
        },
        onRight: () => {
          if (!canTake) return;
          gameData.horses.push(horse);
          gameData.currentHorseId = gameData.horses.length - 1;
          save();
          toastMsg('새 말 영입 완료! 🐴');
          renderAll();
        },
      });
    }, 1200);
  }

  // ----- Work -----
  function renderWork() {
    const pay = 2000;
    workPayEl.textContent = formatMoney(pay);

    const clicksInBlock = gameData.work.totalClicks % 10;
    workClicksEl.textContent = String(clicksInBlock);

    workBtn.disabled = gameData.work.inCooldown;
    if (!gameData.work.inCooldown) coolbar.style.width = '0%';
  }

  function onWorkClick() {
    if (gameData.work.inCooldown) return;

    const needAP = gameData.work.totalClicks % 10 === 0;

    if (needAP) {
      if (!spendAP(1, '알바 시작(10클릭 블록)')) {
        toastMsg('AP가 없어서 알바를 못해 😵');
        return;
      }
    }

    gainMoney(2000);
    gameData.work.totalClicks += 1;
    save();

    gameData.work.inCooldown = true;
    save();
    workBtn.disabled = true;

    coolbar.style.transition = 'none';
    coolbar.style.width = '100%';
    coolbar.offsetHeight;
    coolbar.style.transition = 'width 1s linear';
    coolbar.style.width = '0%';

    setTimeout(() => {
      gameData.work.inCooldown = false;
      save();
      renderAll();
    }, 1000);

    renderWork();
    toastMsg('+₩2,000');
  }

  // ----- Lottery -----
  function renderLottery() {
    if (!lotteryGrid.dataset.built) {
      lotteryGrid.dataset.built = '1';
      for (let i = 1; i <= 30; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lotto-num';
        b.textContent = String(i);
        b.addEventListener('click', () => toggleLotteryPick(i));
        lotteryGrid.appendChild(b);
      }
    }

    const lot = gameData.lottery;
    let stateHtml = '';
    if (lot.status === 'ready') {
      stateHtml = `<div class="card-mini"><b>상태:</b> 구매 가능 (오늘 1회)</div>`;
    } else if (lot.status === 'bought') {
      stateHtml = `<div class="card-mini"><b>상태:</b> 구매 완료 · 다음 날짜 변경(오후→오전) 시 결과 생성</div>`;
    } else if (lot.status === 'resultReady') {
      const r = lot.lastResult;
      stateHtml = `<div class="card-mini">
        <b>상태:</b> 결과 생성됨 🎉<br/>
        <span class="muted">선택: [${(r?.pick || []).join(', ')}] / 당첨: [${(
        r?.draw || []
      ).join(', ')}]</span>
      </div>`;
    }
    lotteryState.innerHTML = stateHtml;

    lotteryBuyBtn.disabled = !(
      lot.status === 'ready' && gameData.lottery.pick.length === 3
    );
    lotteryCheckBtn.disabled = !(lot.status === 'resultReady');

    const picks = new Set(lot.pick);
    Array.from(lotteryGrid.children).forEach((btn) => {
      const n = Number(btn.textContent);
      btn.classList.toggle('selected', picks.has(n));
    });
  }

  function toggleLotteryPick(n) {
    const lot = gameData.lottery;
    if (lot.status !== 'ready') {
      toastMsg('지금은 선택을 바꿀 수 없어!');
      return;
    }
    const idx = lot.pick.indexOf(n);
    if (idx >= 0) lot.pick.splice(idx, 1);
    else {
      if (lot.pick.length >= 3) {
        toastMsg('3개만 선택 가능!');
        return;
      }
      lot.pick.push(n);
      lot.pick.sort((a, b) => a - b);
    }
    save();
    renderLottery();
  }

  function buyLottery() {
    const lot = gameData.lottery;
    if (lot.status !== 'ready') {
      toastMsg('이미 구매했어!');
      return;
    }
    if (lot.pick.length !== 3) {
      toastMsg('숫자 3개 선택해줘!');
      return;
    }

    lot.status = 'bought';
    lot.isPurchased = true;
    lot.purchaseDay = gameData.time.day;
    lot.drawNumbers = [];
    lot.lastResult = null;

    save();
    toastMsg('복권 구매 완료 🎟️');
    renderLottery();
  }

  function checkLottery() {
    const lot = gameData.lottery;
    if (lot.status !== 'resultReady' || !lot.lastResult) {
      toastMsg('아직 결과가 없어!');
      return;
    }

    const { matches, prize, pick, draw } = lot.lastResult;

    openModal({
      title: '🎊 복권 결과',
      html: `
        <p>선택: <b>[${pick.join(', ')}]</b></p>
        <p>당첨: <b>[${draw.join(', ')}]</b></p>
        <p style="margin-top:10px">일치 개수: <b>${matches}</b></p>
        <p>당첨금: <b>₩${formatMoney(prize)}</b></p>
      `,
      leftText: '닫기',
      rightText: prize > 0 ? '수령' : '확인',
      onRight: () => {
        if (prize > 0) gainMoney(prize);

        lot.status = 'ready';
        lot.isPurchased = false;
        lot.pick = [];
        lot.purchaseDay = null;
        lot.drawNumbers = [];
        lot.lastResult = null;

        save();
        toastMsg(
          prize > 0
            ? `수령 완료 +₩${formatMoney(prize)}`
            : '다음엔 당근이 당첨되길 🥕'
        );
        renderAll();
      },
    });
  }

  // ----- Racing -----
  function renderRacing() {
    ensureMainHorse();
    const main = gameData.horses[gameData.currentHorseId];
    const cond = computeCondition(main);

    leagueList.innerHTML = '';
    LEAGUES.forEach((lg) => {
      const unlocked = gameData.unlockedLeagues.includes(lg.code);
      const card = document.createElement('div');
      card.className = 'league';
      card.innerHTML = `
        <div class="league-top">
          <div>
            <div class="league-code">${lg.code} ${unlocked ? '' : '🔒'}</div>
            <div class="muted">참가비 ₩${formatMoney(
              lg.fee
            )} · 우승 ₩${formatMoney(lg.prize)} · 기본승률 ${(
        lg.base * 100
      ).toFixed(0)}%</div>
          </div>
          <div class="pill">메인 컨디션 ${cond}</div>
        </div>
        <button class="btn primary" ${
          unlocked ? '' : 'disabled'
        }>참가 (⚡️4)</button>
      `;

      const btn = card.querySelector('button');
      btn.addEventListener('click', () => startRace(lg.code));
      leagueList.appendChild(card);
    });

    raceLog.innerHTML = '';
    const logs = (gameData.logs?.racing || []).slice().reverse().slice(0, 12);
    if (logs.length === 0) {
      raceLog.innerHTML = `<div class="log-item">아직 기록이 없어. 첫 경주를 해보자! 🐎</div>`;
    } else {
      logs.forEach((l) => {
        const el = document.createElement('div');
        el.className = 'log-item';
        el.innerHTML = `<b>${escapeHtml(l.league)}</b> · ${escapeHtml(
          l.horse
        )} · <b>${l.rank}등</b> ${l.win ? '🏆' : ''}<br/>
                        <span class="muted">+₩${formatMoney(
                          l.deltaMoney
                        )} · ${escapeHtml(l.when)}</span>`;
        raceLog.appendChild(el);
      });
    }
  }

  function startRace(leagueCode) {
    const lg = LEAGUES.find((x) => x.code === leagueCode);
    if (!lg) return;

    if (!gameData.unlockedLeagues.includes(leagueCode)) {
      toastMsg('아직 잠겨 있어!');
      return;
    }
    if (!canSpendAP(4)) {
      toastMsg('AP가 4 필요해!');
      return;
    }
    if (gameData.money < lg.fee) {
      toastMsg('참가비가 부족해!');
      return;
    }

    openModal({
      title: `🏁 ${leagueCode} 참가`,
      html: `<p>참가비 ₩${formatMoney(
        lg.fee
      )} 지불하고, ⚡️4를 소모해 참가할까?</p>
            <p class="tiny">참가 후 AP는 0이 돼. 결과에서 다음 액션을 안내해줄게.</p>`,
      leftText: '취소',
      rightText: '참가',
      onRight: () => doRace(lg),
    });
  }

  function doRace(lg) {
    if (!spendMoney(lg.fee)) {
      toastMsg('참가비 부족');
      return;
    }

    // v0.3.3: suppress AP=0 auto modal during race to avoid modal overwrite
    if (!spendAP(4, `경마 ${lg.code}`, { suppressAutoPrompt: true })) {
      toastMsg('AP 부족');
      return;
    }

    const main = gameData.horses[gameData.currentHorseId];
    const condition = computeCondition(main);

    const power =
      main.stats.speed * 0.38 +
      main.stats.stamina * 0.26 +
      main.stats.spirit * 0.22 +
      main.stats.charm * 0.14;

    const condBonus = (condition - 50) * 0.006;
    const playerScore =
      lg.base + (power / 100) * 0.35 + condBonus + Math.random() * 0.12;

    const difficulty =
      0.4 + LEAGUES.findIndex((x) => x.code === lg.code) * 0.04;
    const scores = [{ who: 'YOU', score: playerScore }];

    for (let i = 0; i < 7; i++) {
      const ai = difficulty + lg.base + Math.random() * 0.35;
      scores.push({ who: `AI${i + 1}`, score: ai });
    }

    scores.sort((a, b) => b.score - a.score);
    const rank = scores.findIndex((s) => s.who === 'YOU') + 1;

    let delta = 0;
    let win = false;

    if (rank === 1) {
      delta = lg.prize;
      gainMoney(lg.prize);
      win = true;
      unlockNextLeague(lg.code);
    }

    const when = `Day ${gameData.time.day} ${gameData.time.phase}`;
    gameData.logs.racing.push({
      league: lg.code,
      horse: main.name,
      rank,
      win,
      deltaMoney: delta,
      when,
    });
    save();

    // v0.3.3: guide the user when AP is 0 after racing
    const apZero = gameData.time.ap === 0;

    openModal({
      title: `🏇 결과: ${rank}등`,
      html: `
        <p><b>${escapeHtml(main.name)}</b>이(가) ${
        lg.code
      }에서 <b>${rank}등</b> 했어.</p>
        <p>보상: <b>₩${formatMoney(delta)}</b> ${win ? '🏆' : ''}</p>
        ${
          win
            ? `<p class="tiny">우승! 다음 리그가 해금될 수 있어.</p>`
            : `<p class="tiny">우승은… 다음에… RNG에게 커피라도.</p>`
        }
        ${
          apZero
            ? `<div class="card-mini" style="margin-top:10px"><b>AP가 0</b>이야. 다음 페이즈로 넘어가자.</div>`
            : ``
        }
      `,
      leftText: '닫기',
      rightText: apZero ? '페이즈 전환' : '확인',
      onRight: () => {
        if (apZero) advancePhase();
        else renderAll();
      },
    });

    renderAll();
  }

  function unlockNextLeague(code) {
    const idx = LEAGUES.findIndex((x) => x.code === code);
    const next = LEAGUES[idx + 1];
    if (!next) return;
    if (!gameData.unlockedLeagues.includes(next.code)) {
      gameData.unlockedLeagues.push(next.code);
      save();
      toastMsg(`새 리그 해금: ${next.code} 🔓`);
    }
  }
})();
