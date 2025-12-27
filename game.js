/* Project Carrot v0.3.4 (bugfix pack)
  FIX#1: normalizeHorse must clamp maxCap to GRADE_CAP[grade] before using it.
  FIX#2: Missing/NaN stats should not reroll randomly on each render.
         - Normalize ONCE on load
         - Use deterministic defaults (seeded by horse id)
         - If normalize changed anything, persist immediately (saveState)
*/

const STORAGE_KEY = "project_carrot_save_v034";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** 등급별 스탯 상한 (밸런스 게이트) */
const GRADE_CAP = {
  S: 10,
  A: 9,
  B: 8,
  C: 7,
};

const ui = {
  timeText: $("#timeText"),
  tabText: $("#tabText"),
  apText: $("#apText"),
  apMaxText: $("#apMaxText"),
  moneyText: $("#moneyText"),

  btnNextTime: $("#btnNextTime"),

  panels: {
    stable: $("#panel-stable"),
    shop: $("#panel-shop"),
    work: $("#panel-work"),
    gacha: $("#panel-gacha"),
    gp: $("#panel-gp")
  },

  bottomTabs: $$(".bottomNav__item"),

  // stable
  stableEmpty: $("#stableEmpty"),
  stableHorse: $("#stableHorse"),
  horseName: $("#horseName"),
  horseId: $("#horseId"),
  horseGrade: $("#horseGrade"),
  statHp: $("#statHp"),
  statVigor: $("#statVigor"),
  statSpeed: $("#statSpeed"),
  statCharm: $("#statCharm"),
  needSatiety: $("#needSatiety"),
  needHygiene: $("#needHygiene"),
  needMood: $("#needMood"),
  needSatietyText: $("#needSatietyText"),
  needHygieneText: $("#needHygieneText"),
  needMoodText: $("#needMoodText"),
  inventoryList: $("#inventoryList"),
  btnRenameHorse: $("#btnRenameHorse"),
  winProbBadge: $("#winProbBadge"),

  // shop
  shopCatBtns: $$(".segmented__btn"),
  shopList: $("#shopList"),
  btnBuyLottery: $("#btnBuyLottery"),

  // work
  btnWork: $("#btnWork"),

  // gacha
  btnGacha: $("#btnGacha"),
  crate: $("#crate"),
  gachaResult: $("#gachaResult"),

  // gp
  gpLeague: $("#gpLeague"),
  gpProb: $("#gpProb"),
  btnGP: $("#btnGP"),
  gpLog: $("#gpLog"),

  // settings
  btnSettings: $("#btnSettings"),

  // toast
  toast: $("#toast"),

  // modal
  modalOverlay: $("#modalOverlay"),
  modalTitle: $("#modalTitle"),
  modalBody: $("#modalBody"),
  modalActions: $("#modalActions"),
};

const SHOP_ITEMS = [
  // 관리
  { id: "feed", cat: "manage", name: "먹이", price: 3000, desc: "포만감 +20" },
  { id: "shampoo", cat: "manage", name: "샴푸", price: 3000, desc: "위생 +20" },
  { id: "toy", cat: "manage", name: "장난감", price: 5000, desc: "기분 +20" },

  // 성장
  { id: "oneshot", cat: "growth", name: "홀스원샷", price: 20000, desc: "체력 +1~5 (랜덤)" },
  { id: "horsebull", cat: "growth", name: "홀스불", price: 20000, desc: "말 기력 +1~5 (랜덤)" },
  { id: "horonamin", cat: "growth", name: "호로나민H", price: 20000, desc: "속도 +1~5 (랜덤)" },
  { id: "horsegel", cat: "growth", name: "홀스젤", price: 99000, desc: "매력 +1~3 (랜덤)" },

  // AP 충전
  { id: "booster", cat: "growth", name: "홀스부스터", price: 9900, desc: "AP 즉시 10 (오전/오후 1회 제한)" },
];

const SPECIAL_OUT_OF_STOCK = {
  id: "special_oos",
  cat: "special",
  name: "재고 없음",
  price: 0,
  desc: "특수 아이템은 현재 구상 중입니다."
};

const LOTTERY = {
  price: 5000,
  table: [
    [0, 50],
    [10000, 30],
    [50000, 15],
    [200000, 4],
    [1000000, 1]
  ]
};

const GACHA = { price: 50000 };

const GP_LEAGUES = [
  { key: "rookie", name: "루키", baseReward: 30000 },
  { key: "semi", name: "세미프로", baseReward: 70000 },
  { key: "pro", name: "프로", baseReward: 140000 },
];

const DEFAULT_STATE = {
  version: "0.3.4",
  theme: "dark",
  time: { day: 1, slot: "AM" }, // AM / PM
  ap: { current: 10, max: 10 },
  money: 10000,
  horse: null,
  inventory: {},
  boosterUsed: { AM: false, PM: false },
  ui: { tab: "stable", shopCat: "manage" },
  gp: { leagueIdx: 0, logs: [] }
};

let state = loadState();

/* =========================
   MOBILE: 더블탭 줌 방지 (iOS 보정)
========================= */
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
})();

/* =========================
   INIT
========================= */
// INIT 직후
ui.modalOverlay.hidden = true;
applyTheme(state.theme);
bindEvents();
renderAll();

/* =========================
   EVENTS
========================= */
function bindEvents() {
  ui.bottomTabs.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  ui.btnNextTime.addEventListener("click", () => nextTime());
  ui.btnSettings.addEventListener("click", () => openSettingsModal());

  ui.shopCatBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      state.ui.shopCat = btn.dataset.shopcat;
      saveAndRender();
    });
  });

  ui.btnBuyLottery.addEventListener("click", () => buyLottery());
  ui.btnWork.addEventListener("click", () => doWork());
  ui.btnGacha.addEventListener("click", () => startGachaFlow());
  ui.btnRenameHorse.addEventListener("click", () => openRenameHorseModal());
  ui.btnGP.addEventListener("click", () => runGrandPrix());
}

/* =========================
   STORAGE / LOAD
========================= */
function loadState() {
  let loaded = structuredClone(DEFAULT_STATE);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = deepMerge(loaded, JSON.parse(raw));
  } catch {
    loaded = structuredClone(DEFAULT_STATE);
  }

  // 기본 보정
  if (!loaded.ap || !isFiniteNum(loaded.ap.max)) loaded.ap = { current: 10, max: 10 };
  loaded.ap.max = 10;
  loaded.ap.current = clamp(toNum(loaded.ap.current, 10), 0, loaded.ap.max);

  if (!loaded.boosterUsed) loaded.boosterUsed = { AM: false, PM: false };
  if (!loaded.ui) loaded.ui = { tab: "stable", shopCat: "manage" };
  if (!loaded.gp) loaded.gp = { leagueIdx: 0, logs: [] };
  if (!loaded.inventory || typeof loaded.inventory !== "object") loaded.inventory = {};

  // ✅ FIX#2: 로드 시 1회 정규화 + 바뀌면 즉시 저장
  let dirty = false;
  if (loaded.horse) {
    const before = JSON.stringify(loaded.horse);
    normalizeHorse(loaded.horse);
    const after = JSON.stringify(loaded.horse);
    if (before !== after) dirty = true;
  }

  // 버전 / 테마
  loaded.version = "0.3.4";
  loaded.theme = (loaded.theme === "light" || loaded.theme === "dark") ? loaded.theme : "dark";

  // ✅ 정규화로 바뀐 데이터는 여기서 바로 저장(렌더 반복 재롤링 방지)
  if (dirty) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded)); } catch {}
  }

  return loaded;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveAndRender() {
  saveState();
  renderAll();
}

/* =========================
   FIX CORE: normalizeHorse
========================= */
function normalizeHorse(h) {
  // 필수 필드
  if (!h || typeof h !== "object") return;

  // grade 유효성
  const grade = (typeof h.grade === "string" ? h.grade.toUpperCase() : "C");
  h.grade = (GRADE_CAP[grade] ? grade : "C");

  // ✅ FIX#1: maxCap은 저장값을 믿지 말고 grade cap로 상한 clamp
  const gradeCap = GRADE_CAP[h.grade];
  const savedMaxCap = toNum(h.maxCap, gradeCap);
  h.maxCap = clamp(savedMaxCap, 1, gradeCap);

  // stats 구조 보장
  if (!h.stats || typeof h.stats !== "object") h.stats = {};
  const keys = ["hp", "vigor", "speed", "charm"];
  for (const k of keys) {
    const v = toNum(h.stats[k], NaN);

    if (!isFiniteNum(v)) {
      // ✅ FIX#2: 랜덤 reroll 금지 → 결정론적 기본값(말 id 기반)
      // 범위는 [3, maxCap] (maxCap이 3보다 작으면 [1,maxCap])
      const min = Math.min(3, h.maxCap);
      const max = h.maxCap;
      const seeded = seededInt(`${h.id ?? "noid"}:${k}:${h.grade}`, min, max);
      h.stats[k] = seeded;
    } else {
      h.stats[k] = clamp(Math.round(v), 0, h.maxCap);
    }
  }

  // needs 구조 보장
  if (!h.needs || typeof h.needs !== "object") h.needs = {};
  h.needs.satiety = clamp(toNum(h.needs.satiety, 80), 0, 100);
  h.needs.hygiene = clamp(toNum(h.needs.hygiene, 80), 0, 100);
  h.needs.mood = clamp(toNum(h.needs.mood, 80), 0, 100);

  // 이름
  if (typeof h.name !== "string") h.name = "";
  if (typeof h.id !== "string") h.id = String(Math.floor(Math.random()*900000 + 100000));
}

/* =========================
   RENDER
========================= */
function renderAll() {
  renderHUD();
  renderTabs();
  renderStable();
  renderShop();
  renderGP();
}

function renderHUD() {
  ui.timeText.textContent = `${state.time.day}일차 ${state.time.slot === "AM" ? "오전" : "오후"}`;
  ui.apText.textContent = String(state.ap.current);
  ui.apMaxText.textContent = String(state.ap.max);
  ui.moneyText.textContent = fmtMoney(state.money);
  ui.tabText.textContent = tabLabel(state.ui.tab);
}

function renderTabs() {
  const t = state.ui.tab;
  Object.entries(ui.panels).forEach(([key, el]) => el.hidden = (key !== t));
  ui.bottomTabs.forEach(btn => btn.classList.toggle("is-active", btn.dataset.tab === t));
}

function renderStable() {
  const h = state.horse;

  ui.stableEmpty.hidden = !!h;
  ui.stableHorse.hidden = !h;
  if (!h) return;

  // (정상 루트에선 loadState에서 normalize 끝났지만, 혹시 런타임 생성/외부 주입 대비)
  normalizeHorse(h);

  ui.horseName.textContent = h.name || "이름없음";
  ui.horseId.textContent = `ID: ${h.id}`;
  ui.horseGrade.textContent = `등급: ${h.grade} (CAP ${h.maxCap})`;

  ui.statHp.textContent = h.stats.hp;
  ui.statVigor.textContent = h.stats.vigor;
  ui.statSpeed.textContent = h.stats.speed;
  ui.statCharm.textContent = h.stats.charm;

  setMeter(ui.needSatiety, ui.needSatietyText, h.needs.satiety);
  setMeter(ui.needHygiene, ui.needHygieneText, h.needs.hygiene);
  setMeter(ui.needMood, ui.needMoodText, h.needs.mood);

  const prob = calcWinProb(h);
  ui.winProbBadge.textContent = `우승확률 ${(prob*100).toFixed(0)}%`;

  renderInventory();
}

function renderInventory() {
  const entries = Object.entries(state.inventory).filter(([,v]) => v > 0);

  if (entries.length === 0) {
    ui.inventoryList.innerHTML =
      `<div class="empty"><div class="empty__title">인벤토리가 비어있어요</div><div class="empty__desc">상점에서 아이템을 구매해보세요.</div></div>`;
    return;
  }

  const idToItem = (id) => SHOP_ITEMS.find(x => x.id === id) || null;

  ui.inventoryList.innerHTML = entries.map(([id, count]) => {
    const item = idToItem(id);
    const name = item?.name ?? id;
    const desc = item?.desc ?? "";
    const disabled = (id === "booster" && state.boosterUsed[state.time.slot]) ? "disabled" : "";
    const note = (id === "booster" && state.boosterUsed[state.time.slot])
      ? `<div class="itemRow__desc">이번 ${state.time.slot==="AM"?"오전":"오후"}엔 이미 사용함</div>`
      : `<div class="itemRow__desc">${esc(desc)}</div>`;

    return `
      <div class="itemRow">
        <div class="itemRow__meta">
          <div class="itemRow__name">${esc(name)} <span class="muted">x${count}</span></div>
          ${note}
        </div>
        <div class="itemRow__right">
          <button class="btn" data-use="${esc(id)}" ${disabled}>사용</button>
        </div>
      </div>
    `;
  }).join("");

  $$("#inventoryList [data-use]").forEach(btn => {
    btn.addEventListener("click", () => useItem(btn.dataset.use));
  });
}

function renderShop() {
  ui.shopCatBtns.forEach(btn => btn.classList.toggle("is-active", btn.dataset.shopcat === state.ui.shopCat));
  const cat = state.ui.shopCat;

  if (cat === "special") {
    ui.shopList.innerHTML = `
      <div class="itemRow">
        <div class="itemRow__meta">
          <div class="itemRow__name">${SPECIAL_OUT_OF_STOCK.name}</div>
          <div class="itemRow__desc">${SPECIAL_OUT_OF_STOCK.desc}</div>
        </div>
        <div class="itemRow__right"><span class="badge">재고 없음</span></div>
      </div>
    `;
    return;
  }

  const items = SHOP_ITEMS.filter(x => x.cat === cat);
  ui.shopList.innerHTML = items.map(item => `
    <div class="itemRow">
      <div class="itemRow__meta">
        <div class="itemRow__name">${esc(item.name)}</div>
        <div class="itemRow__desc">${esc(item.desc)}</div>
        <div class="itemRow__price">${fmtMoney(item.price)}원</div>
      </div>
      <div class="itemRow__right">
        <button class="btn btn--primary" data-buy="${esc(item.id)}">구매</button>
      </div>
    </div>
  `).join("");

  $$("#shopList [data-buy]").forEach(btn => btn.addEventListener("click", () => openBuyModal(btn.dataset.buy)));
}

function renderGP() {
  const league = GP_LEAGUES[state.gp.leagueIdx] ?? GP_LEAGUES[0];
  ui.gpLeague.textContent = league.name;

  const prob = state.horse ? calcWinProb(state.horse) : null;
  ui.gpProb.textContent = prob == null ? "-" : `${(prob*100).toFixed(0)}%`;

  ui.gpLog.innerHTML = (state.gp.logs.length === 0)
    ? `<div class="empty"><div class="empty__title">아직 경기 기록이 없어요</div><div class="empty__desc">그랑프리에 참가해보세요.</div></div>`
    : state.gp.logs.slice(-20).reverse().map(line => `<div class="logLine">${esc(line)}</div>`).join("");
}

/* =========================
   TAB / THEME / SETTINGS
========================= */
function switchTab(tab) {
  state.ui.tab = tab;
  saveAndRender();
}
function tabLabel(tab) {
  return ({ stable:"마구간", shop:"상점", work:"알바", gacha:"뽑기", gp:"그랑프리" })[tab] ?? "마구간";
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f6f7fb" : "#0b0f14");
}

function openSettingsModal() {
  const themeNow = state.theme;

  openModal({
    title: "설정",
    bodyHTML: `
      <div class="list">
        <div class="itemRow">
          <div class="itemRow__meta">
            <div class="itemRow__name">테마</div>
            <div class="itemRow__desc">라이트모드 / 다크모드 전환</div>
          </div>
          <div class="itemRow__right">
            <button class="btn btn--primary" id="btnToggleTheme">${themeNow === "dark" ? "라이트모드" : "다크모드"}로</button>
          </div>
        </div>

        <div class="itemRow">
          <div class="itemRow__meta">
            <div class="itemRow__name" style="color: var(--danger);">게임 초기화</div>
            <div class="itemRow__desc">모든 데이터가 삭제됩니다 (2중 확인)</div>
          </div>
          <div class="itemRow__right">
            <button class="btn" id="btnResetGame" style="border-color: color-mix(in srgb, var(--danger) 45%, var(--border));">초기화</button>
          </div>
        </div>
      </div>
    `,
    actions: [{ label: "닫기", kind: "ghost", onClick: closeModal }]
  });

  $("#btnToggleTheme").addEventListener("click", () => {
    state.theme = (state.theme === "dark") ? "light" : "dark";
    applyTheme(state.theme);
    saveAndRender();
    closeModal();
    toast(`테마가 ${state.theme === "dark" ? "다크" : "라이트"}로 변경됨`);
  });

  $("#btnResetGame").addEventListener("click", () => {
    closeModal();
    openModal({
      title: "진짜 초기화할까요?",
      bodyHTML: `<div class="empty"><div class="empty__title">경고 ⚠️</div><div class="empty__desc">이 작업은 되돌릴 수 없습니다.</div></div>`,
      actions: [
        { label: "취소", kind: "ghost", onClick: closeModal },
        { label: "초기화", kind: "danger", onClick: () => {
          closeModal();
          if (confirm("정말로 게임을 초기화할까요? (되돌릴 수 없음)")) resetGame();
        }}
      ]
    });
  });
}

function resetGame() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
  applyTheme(state.theme);
  renderAll();
  toast("게임이 초기화되었습니다.");
}

/* =========================
   TIME / AP
========================= */
function nextTime() {
  if (state.time.slot === "AM") {
    state.time.slot = "PM";
    state.boosterUsed.PM = false;
  } else {
    state.time.slot = "AM";
    state.time.day += 1;
    state.boosterUsed.AM = false;
    state.boosterUsed.PM = false;

    if (state.horse) {
      state.horse.needs.satiety = clamp(state.horse.needs.satiety - 10, 0, 100);
      state.horse.needs.hygiene = clamp(state.horse.needs.hygiene - 8, 0, 100);
      state.horse.needs.mood = clamp(state.horse.needs.mood - 6, 0, 100);
    }
  }

  state.ap.max = 10;
  state.ap.current = 10;

  saveAndRender();
  toast("시간이 흘렀다… AP가 10으로 충전됨 ✨");
}

function spendAP(n) {
  if (state.ap.current < n) {
    toast("AP가 부족해요. 다음 시간으로 넘겨서 충전하세요!");
    return false;
  }
  state.ap.current -= n;
  return true;
}

/* =========================
   SHOP BUY FLOW
========================= */
function openBuyModal(itemId) {
  const item = SHOP_ITEMS.find(x => x.id === itemId);
  if (!item) return;

  let qty = 1;

  const renderBody = () => `
    <div class="qty">
      <div class="itemRow">
        <div class="itemRow__meta">
          <div class="itemRow__name">${esc(item.name)}</div>
          <div class="itemRow__desc">${esc(item.desc)}</div>
          <div class="itemRow__price">개당 ${fmtMoney(item.price)}원</div>
        </div>
        <div class="itemRow__right">
          <span class="badge">총 ${fmtMoney(item.price * qty)}원</span>
        </div>
      </div>

      <div class="qtyRow">
        <div class="muted">수량</div>
        <div class="qtyBox">
          <button class="btnMini" id="qtyMinus">-</button>
          <div class="qtyNum" id="qtyNum">${qty}</div>
          <button class="btnMini" id="qtyPlus">+</button>
        </div>
      </div>

      <div class="qtyRow">
        <div class="muted">빠른 추가</div>
        <div class="qtyBox">
          <button class="btnMini" id="add1">+1</button>
          <button class="btnMini" id="add5">+5</button>
          <button class="btnMini" id="add10">+10</button>
        </div>
      </div>

      <div class="hint">※ 직접 타이핑 없이 버튼으로만 조절 가능</div>
    </div>
  `;

  openModal({
    title: "구매 수량 선택",
    bodyHTML: renderBody(),
    actions: [
      { label: "취소", kind: "ghost", onClick: closeModal },
      { label: "구매", kind: "primary", onClick: () => {
        const cost = item.price * qty;
        if (state.money < cost) { toast("소지금이 부족해요!"); return; }
        state.money -= cost;
        addInventory(item.id, qty);
        closeModal();
        toast(`${item.name} x${qty} 구매 완료`);
        saveAndRender();
      }}
    ]
  });

  const wire = () => {
    $("#qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); refresh(); });
    $("#qtyPlus").addEventListener("click", () => { qty = Math.min(999, qty + 1); refresh(); });
    $("#add1").addEventListener("click", () => { qty = Math.min(999, qty + 1); refresh(); });
    $("#add5").addEventListener("click", () => { qty = Math.min(999, qty + 5); refresh(); });
    $("#add10").addEventListener("click", () => { qty = Math.min(999, qty + 10); refresh(); });
  };

  const refresh = () => { ui.modalBody.innerHTML = renderBody(); wire(); };
  wire();
}

function addInventory(itemId, count) {
  state.inventory[itemId] = (state.inventory[itemId] || 0) + count;
}

/* =========================
   LOTTERY / WORK
========================= */
function buyLottery() {
  if (state.money < LOTTERY.price) { toast("소지금이 부족해요!"); return; }
  state.money -= LOTTERY.price;

  const reward = weightedPick(LOTTERY.table);
  state.money += reward;

  saveAndRender();
  toast(reward === 0 ? "복권… 꽝 😇" : `복권 당첨! +${fmtMoney(reward)}원`);
}

function doWork() {
  if (!spendAP(1)) return;

  const payout = weightedPick([
    [1000, 100],
    [2000, 50],
    [5000, 25],
    [10000, 12],
    [20000, 6],
    [50000, 2],
    [100000, 1],
  ]);

  state.money += payout;
  saveAndRender();
  toast(`알바 완료! +${fmtMoney(payout)}원`);
}

/* =========================
   ITEM USE
========================= */
function useItem(itemId) {
  const cnt = state.inventory[itemId] || 0;
  if (cnt <= 0) return;

  if (itemId === "booster") {
    if (state.boosterUsed[state.time.slot]) {
      toast(`이번 ${state.time.slot === "AM" ? "오전" : "오후"}엔 이미 홀스부스터를 사용했어요!`);
      return;
    }
    state.ap.current = 10;
    state.boosterUsed[state.time.slot] = true;
    consumeInventory(itemId, 1);
    saveAndRender();
    toast("홀스부스터 사용! AP가 10으로 충전됨 ⚡");
    return;
  }

  if (!state.horse) { toast("말이 없어서 사용할 수 없어요!"); return; }
  normalizeHorse(state.horse);

  const h = state.horse;

  switch (itemId) {
    case "feed":
      h.needs.satiety = clamp(h.needs.satiety + 20, 0, 100);
      toast("먹이 사용! 포만감 +20");
      break;
    case "shampoo":
      h.needs.hygiene = clamp(h.needs.hygiene + 20, 0, 100);
      toast("샴푸 사용! 위생 +20");
      break;
    case "toy":
      h.needs.mood = clamp(h.needs.mood + 20, 0, 100);
      toast("장난감 사용! 기분 +20");
      break;

    case "oneshot": {
      const inc = randInt(1, 5);
      h.stats.hp = clamp(h.stats.hp + inc, 0, h.maxCap);
      toast(`홀스원샷! 체력 +${inc}`);
      break;
    }
    case "horsebull": {
      const inc = randInt(1, 5);
      h.stats.vigor = clamp(h.stats.vigor + inc, 0, h.maxCap);
      toast(`홀스불! 말 기력 +${inc}`);
      break;
    }
    case "horonamin": {
      const inc = randInt(1, 5);
      h.stats.speed = clamp(h.stats.speed + inc, 0, h.maxCap);
      toast(`호로나민H! 속도 +${inc}`);
      break;
    }
    case "horsegel": {
      const inc = randInt(1, 3);
      h.stats.charm = clamp(h.stats.charm + inc, 0, h.maxCap);
      toast(`홀스젤! 매력 +${inc}`);
      break;
    }

    default:
      toast("사용할 수 없는 아이템이에요.");
      return;
  }

  consumeInventory(itemId, 1);
  saveAndRender();
}

function consumeInventory(itemId, n) {
  state.inventory[itemId] = Math.max(0, (state.inventory[itemId] || 0) - n);
}

/* =========================
   HORSE NAME
========================= */
function openRenameHorseModal() {
  if (!state.horse) return;
  openModal({
    title: "말 이름 변경",
    bodyHTML: `
      <div class="list">
        <div class="hint">새 이름을 입력해주세요.</div>
        <input class="input" id="nameInput" maxlength="12" value="${escAttr(state.horse.name || "")}" placeholder="예: 당근이" />
      </div>
    `,
    actions: [
      { label: "취소", kind: "ghost", onClick: closeModal },
      { label: "저장", kind: "primary", onClick: () => {
        const v = ($("#nameInput").value || "").trim();
        if (!v) { toast("이름을 입력해주세요!"); return; }
        state.horse.name = v;
        closeModal();
        saveAndRender();
        toast(`이름 변경 완료: ${v}`);
      }}
    ]
  });
}

function openNamePickModal(onSubmit) {
  openModal({
    title: "말 이름을 정해주세요",
    bodyHTML: `
      <div class="list">
        <div class="hint">직접 입력해서 이름을 결정하세요.</div>
        <input class="input" id="pickNameInput" maxlength="12" placeholder="예: 카롯트" />
      </div>
    `,
    actions: [
      { label: "취소", kind: "ghost", onClick: () => { closeModal(); onSubmit(null); } },
      { label: "결정", kind: "primary", onClick: () => {
        const v = ($("#pickNameInput").value || "").trim();
        if (!v) { toast("이름을 입력해주세요!"); return; }
        closeModal();
        onSubmit(v);
      }}
    ]
  });
}

/* =========================
   GACHA
========================= */
function startGachaFlow() {
  if (state.money < GACHA.price) { toast("소지금이 부족해요!"); return; }

  openModal({
    title: "말을 뽑을까요?",
    bodyHTML: `
      <div class="empty">
        <div class="empty__title">진짜 뽑으시겠어요? 🎁</div>
        <div class="empty__desc">비용: <b>${fmtMoney(GACHA.price)}원</b><br/>계속을 누르면 상자가 흔들리며 자동으로 뽑기가 진행됩니다.</div>
      </div>
    `,
    actions: [
      { label: "취소", kind: "ghost", onClick: closeModal },
      { label: "계속", kind: "primary", onClick: () => {
        disableModalActions(true);

        state.money -= GACHA.price;
        saveState(); // 중간 저장

        ui.crate.classList.add("shake");
        ui.gachaResult.hidden = true;
        ui.gachaResult.innerHTML = "";
        closeModal();

        setTimeout(() => {
          ui.crate.classList.remove("shake");

          const newHorse = rollHorse();
          normalizeHorse(newHorse);

          ui.gachaResult.hidden = false;
          ui.gachaResult.innerHTML = renderHorseReveal(newHorse);

          $("#btnTakeHorse").addEventListener("click", () => {
            openNamePickModal((name) => {
              if (!name) return;
              newHorse.name = name;

              state.horse = newHorse;
              saveState(); // ✅ 영입 즉시 저장 (비결정성 방지)
              toast(`새 말 영입! ${name} 🐴`);

              ui.gachaResult.hidden = true;
              ui.gachaResult.innerHTML = "";
              switchTab("stable");
              renderAll();
            });
          });

          $("#btnReroll").addEventListener("click", () => {
            ui.gachaResult.hidden = true;
            ui.gachaResult.innerHTML = "";
            toast("다시 뽑을 준비 완료!");
          });

          saveAndRender();
        }, 1200);
      }}
    ]
  });
}

function renderHorseReveal(h) {
  const prob = calcWinProb(h);
  return `
    <div class="itemRow">
      <div class="itemRow__meta">
        <div class="itemRow__name">새 말 등장! (등급 ${esc(h.grade)})</div>
        <div class="itemRow__desc">예상 우승 확률: <b>${(prob*100).toFixed(0)}%</b> (참고)</div>
      </div>
      <div class="itemRow__right">
        <span class="badge">CAP ${h.maxCap}</span>
        <span class="badge">ID ${esc(h.id)}</span>
      </div>
    </div>

    <div class="grid2">
      <div class="stat"><div class="stat__label">체력</div><div class="stat__value">${h.stats.hp}</div></div>
      <div class="stat"><div class="stat__label">말 기력</div><div class="stat__value">${h.stats.vigor}</div></div>
      <div class="stat"><div class="stat__label">속도</div><div class="stat__value">${h.stats.speed}</div></div>
      <div class="stat"><div class="stat__label">매력</div><div class="stat__value">${h.stats.charm}</div></div>
    </div>

    <div class="itemRow">
      <div class="itemRow__meta">
        <div class="itemRow__name">데려갈까요?</div>
        <div class="itemRow__desc">데려가기 누르면 이름을 직접 입력합니다.</div>
      </div>
      <div class="itemRow__right">
        <button class="btn" id="btnReroll">취소(다시 뽑기)</button>
        <button class="btn btn--primary" id="btnTakeHorse">데려가기</button>
      </div>
    </div>
  `;
}

function rollHorse() {
  const id = String(Math.floor(Math.random()*900000 + 100000));
  const grade = rollGrade();
  const cap = GRADE_CAP[grade];

  const h = {
    id,
    name: "",
    grade,
    maxCap: cap, // 생성 시 cap 고정
    stats: {
      hp: randInt(3, cap),
      vigor: randInt(3, cap),
      speed: randInt(3, cap),
      charm: randInt(1, cap),
    },
    needs: {
      satiety: randInt(70, 95),
      hygiene: randInt(70, 95),
      mood: randInt(70, 95),
    }
  };
  return h;
}

function rollGrade() {
  // S가 희귀하게 나오도록
  const r = Math.random();
  if (r < 0.03) return "S";
  if (r < 0.15) return "A";
  if (r < 0.40) return "B";
  return "C";
}

/* =========================
   GRAND PRIX
========================= */
function runGrandPrix() {
  if (!state.horse) { toast("말이 없으면 참가할 수 없어요!"); return; }
  normalizeHorse(state.horse);

  if (!spendAP(5)) return;

  const league = GP_LEAGUES[state.gp.leagueIdx] ?? GP_LEAGUES[0];
  const prob = calcWinProb(state.horse);
  const win = Math.random() < prob;

  let reward = 0;
  if (win) {
    reward = league.baseReward + randInt(10000, 60000);
    state.money += reward;

    if (Math.random() < 0.35 && state.gp.leagueIdx < GP_LEAGUES.length - 1) {
      state.gp.leagueIdx += 1;
      toast(`우승! +${fmtMoney(reward)}원 🎉 그리고 리그 승급!`);
      state.gp.logs.push(`[${stamp()}] 우승! +${fmtMoney(reward)}원 (확률 ${(prob*100).toFixed(0)}%) → ${GP_LEAGUES[state.gp.leagueIdx].name} 승급`);
      saveAndRender();
      return;
    }

    toast(`우승! +${fmtMoney(reward)}원 🎉`);
    state.gp.logs.push(`[${stamp()}] 우승! +${fmtMoney(reward)}원 (확률 ${(prob*100).toFixed(0)}%)`);
  } else {
    reward = randInt(1000, 12000);
    state.money += reward;
    toast(`패배… 위로금 +${fmtMoney(reward)}원 😇`);
    state.gp.logs.push(`[${stamp()}] 패배… 위로금 +${fmtMoney(reward)}원 (확률 ${(prob*100).toFixed(0)}%)`);
  }

  state.horse.needs.satiety = clamp(state.horse.needs.satiety - 8, 0, 100);
  state.horse.needs.hygiene = clamp(state.horse.needs.hygiene - 6, 0, 100);
  state.horse.needs.mood = clamp(state.horse.needs.mood - 4, 0, 100);

  saveAndRender();
}

function calcWinProb(horse) {
  normalizeHorse(horse);

  const s = horse.stats;
  const needsAvg = (horse.needs.satiety + horse.needs.hygiene + horse.needs.mood) / 3;

  const power = (s.speed * 2.2) + (s.hp * 1.1) + (s.vigor * 1.1) + (s.charm * 0.4);

  // maxPower는 grade cap 기준으로 계산(밸런스)
  const cap = horse.maxCap;
  const maxPower = (cap * 2.2) + (cap * 1.1) + (cap * 1.1) + (cap * 0.4);
  const statPart = clamp(power / maxPower, 0, 1);
  const needPart = clamp(needsAvg / 100, 0, 1);

  const raw = (statPart * 0.72) + (needPart * 0.28);
  const scaled = 0.15 + raw * 0.70; // 0.15~0.85
  return clamp(scaled, 0.15, 0.85);
}

/* =========================
   MODAL / TOAST
========================= */
function openModal({ title, bodyHTML, actions }) {
  ui.modalTitle.textContent = title;
  ui.modalBody.innerHTML = bodyHTML;

  ui.modalActions.innerHTML = "";
  actions.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    if (a.kind === "primary") btn.classList.add("btn--primary");
    if (a.kind === "ghost") btn.classList.add("btn--ghost");
    if (a.kind === "danger") {
      btn.style.background = "color-mix(in srgb, var(--danger) 18%, transparent)";
      btn.style.borderColor = "color-mix(in srgb, var(--danger) 45%, var(--border))";
    }
    btn.textContent = a.label;
    btn.addEventListener("click", a.onClick);
    ui.modalActions.appendChild(btn);
  });

  ui.modalOverlay.hidden = false;
}

function closeModal() { ui.modalOverlay.hidden = true; }

function disableModalActions(disabled) {
  Array.from(ui.modalActions.querySelectorAll("button")).forEach(b => b.disabled = disabled);
}

let toastTimer = null;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-show"), 1600);
}

/* =========================
   HELPERS
========================= */
function fmtMoney(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function weightedPick(table) {
  const total = table.reduce((sum, [,w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of table) {
    r -= w;
    if (r <= 0) return value;
  }
  return table[table.length - 1][0];
}

function setMeter(elFill, elText, value) {
  const v = clamp(value, 0, 100);
  elFill.style.width = `${v}%`;
  elText.textContent = `${v}/100`;
}

function stamp() {
  const d = state.time.day;
  const t = state.time.slot === "AM" ? "오전" : "오후";
  return `${d}일차 ${t}`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function escAttr(s) { return esc(s).replaceAll("\n", " "); }

function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const k of Object.keys(source)) {
    const sv = source[k];
    if (Array.isArray(sv)) target[k] = sv.slice();
    else if (sv && typeof sv === "object") {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], sv);
    } else target[k] = sv;
  }
  return target;
}

function isFiniteNum(v) { return typeof v === "number" && Number.isFinite(v); }
function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** ✅ 결정론적 기본값: 같은 id면 항상 같은 값 */
function seededInt(seedStr, min, max) {
  if (max <= min) return min;

  // FNV-1a 32bit
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 0~1
  const u = (h >>> 0) / 4294967295;
  return Math.floor(u * (max - min + 1)) + min;
}
