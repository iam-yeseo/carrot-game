/* Project: Carrot (v0.2.1) */

// --- 1. 데이터 베이스 ---
const ITEMS = {
    "food_sugar": { name: "각설탕", price: 14000, cat: "food", val: 15, desc: "말이 좋아하는 특식", effect: "포만감 +15" },
    "food_hay": { name: "건초", price: 9500, cat: "food", val: 10, desc: "말이 좋아하는 풀떼기", effect: "포만감 +10" },
    "food_carrot": { name: "당근", price: 9500, cat: "food", val: 10, desc: "말이 좋아하는 별미", effect: "포만감 +10" },
    "food_feed": { name: "사료", price: 5000, cat: "food", val: 5, desc: "먹을 수 있으니까 먹는다", effect: "포만감 +5" },
    
    "toy_basic": { name: "기본 장난감", price: 5000, cat: "toy", val: 10, desc: "오래 갖고 놀면 질린다.", effect: "기분 +10" },
    "toy_fun": { name: "재밌는 장난감", price: 9500, cat: "toy", val: 20, desc: "갖고 놀 때마다 재밌다.", effect: "기분 +20" },
    "toy_magic": { name: "신기한 장난감", price: 99000, cat: "toy", val: "R", desc: "이게 대체 뭐지?", effect: "기분 랜덤 대박?" },

    "train_basic": { name: "기본 훈련도구", price: 5000, cat: "train", target: "stamina", val: 1, desc: "단순해서 외울 듯 싶다.", effect: "체력 +1" },
    "train_special": { name: "특수 훈련도구", price: 9500, cat: "train", target: "spirit", val: 1, desc: "힘들지만 재미있다.", effect: "기력 +1" },
    "train_magic": { name: "마법봉", price: 99000, cat: "train", target: "R", val: "R", desc: "요물이다.", effect: "랜덤 스탯 변화" },

    "care_comb": { name: "기본 빗", price: 5000, cat: "care", val: 5, desc: "역할에 충실한 빗", effect: "위생 +5" },
    "care_comb_good": { name: "결 좋은 빗", price: 9500, cat: "care", val: 10, desc: "빗기만 해도 윤기가 좌르르", effect: "위생 +10" },
    "care_broom": { name: "빗자루", price: 99000, cat: "care", val: "R", desc: "이걸로 날 빗기겠다고?", effect: "위생 랜덤 변화" },

    "med_digest": { name: "홀스활명수", price: 10000, cat: "med", type: "digest", desc: "소화가 빨라진다.", effect: "과식 치료" },
    "med_clean": { name: "말을씻자", price: 10000, cat: "med", type: "clean", desc: "꼬질꼬질한 냄새가 사라진다.", effect: "위생 +50" },
    "med_oneshot": { name: "홀스원샷", price: 10000, cat: "med", type: "oneshot", desc: "차량용이 아니다.", effect: "랜덤 능력치 +5~20" }
};

const MAX_STATS = { "SS": 100, "S": 90, "A": 80, "B": 70, "C": 60 };

// --- 2. 게임 상태 ---
let gameData = {
    time: { day: 1, phase: "am", actions: 4 },
    money: 100000,
    alba: { count: 0, stack: 0 }, // stack: 10번 채우면 행동력 소모
    lottery: {
        status: "ready", // ready, bought, checked
        myNumbers: [],
        winningNumbers: [],
        rank: 0
    },
    horse: {
        name: "초코",
        grade: "C",
        status: { hunger: 50, hygiene: 50, mood: 50 },
        baseStats: { stamina: 30, speed: 25, spirit: 20, charm: 15 }
    },
    inventory: { "food_feed": 10, "toy_basic": 5, "train_basic": 5 }
};

// --- 3. 초기화 ---
function initGame() {
    loadGame();
    renderStore();
    renderLotteryGrid();
    updateUI();
}

// --- 4. 시간 및 행동 시스템 ---
function useAction(cost) {
    if (gameData.time.actions < cost) {
        customAlert(`행동력이 부족합니다!<br>(필요: ⚡️${cost})`);
        return false;
    }
    gameData.time.actions -= cost;
    if (gameData.time.actions <= 0) {
        setTimeout(() => {
            customAlert("모든 행동력을 소모했습니다.<br>시간이 흐릅니다.");
            nextPhase();
        }, 1000);
    }
    saveGame();
    return true;
}

function nextPhase() {
    gameData.alba.count = 0; // 알바 횟수 리셋
    gameData.time.actions = 4;

    if (gameData.time.phase === "am") {
        gameData.time.phase = "pm";
    } else {
        gameData.time.phase = "am";
        gameData.time.day++;
        dailyUpdate();
        checkLotteryResult(); // 다음날 아침 복권 결과 발표
    }
    updateUI();
    saveGame();
}

function dailyUpdate() {
    const s = gameData.horse.status;
    s.hunger = Math.max(-20, s.hunger - 10);
    s.hygiene = Math.max(0, s.hygiene - 10);
    s.mood = Math.max(0, s.mood - 10);
}

// --- 5. UI 업데이트 ---
function updateUI() {
    // 날짜 및 행동력
    const phaseText = gameData.time.phase === "am" ? "오전" : "오후";
    document.getElementById("date-display").innerText = `${gameData.time.day}일차 ${phaseText}`;
    document.getElementById("action-points").innerText = "⚡️".repeat(gameData.time.actions);
    document.getElementById("money-display").innerText = gameData.money.toLocaleString() + " 원";

    // 말 상태
    document.getElementById("horse-name-display").innerText = gameData.horse.name;
    const isStats = document.getElementById("btn-stat-toggle").innerText === "상태"; // 현재 버튼이 '상태'면 능력치 뷰인 것
    document.getElementById("panel-title").innerText = `${gameData.horse.name}의 ${isStats ? '능력치' : '상태'}`;

    const s = gameData.horse.status;
    updateBar("hunger", s.hunger, 100);
    updateBar("hygiene", s.hygiene, 100);
    updateBar("mood", s.mood, 100);

    const b = gameData.horse.baseStats;
    updateBar("stamina", b.stamina, MAX_STATS[gameData.horse.grade], true);
    updateBar("speed", b.speed, MAX_STATS[gameData.horse.grade], true);
    updateBar("spirit", b.spirit, MAX_STATS[gameData.horse.grade], true);
    updateBar("charm", b.charm, MAX_STATS[gameData.horse.grade], true);

    // 알바 UI
    document.getElementById("alba-count").innerText = 30 - gameData.alba.count;
    document.getElementById("alba-stack").innerText = gameData.alba.stack;

    // 인벤토리 (마구간)
    renderStableInventory();
    
    // 복권 UI
    updateLotteryUI();
}

function updateBar(id, val, max, isAbility = false) {
    const bar = document.getElementById(`bar-${id}`);
    const txt = document.getElementById(`text-${id}`);
    let percent = Math.max(0, Math.min(100, (val / max) * 100));
    bar.style.width = percent + "%";
    txt.innerText = val + (isAbility ? `/${max}` : "");
}

function toggleStatView() {
    const btn = document.getElementById("btn-stat-toggle");
    const sDiv = document.getElementById("stat-status");
    const aDiv = document.getElementById("stat-ability");

    if (btn.innerText === "능력치") { // 누르면 능력치 보여줌
        btn.innerText = "상태";
        sDiv.classList.add("hidden");
        aDiv.classList.remove("hidden");
    } else { // 누르면 상태 보여줌
        btn.innerText = "능력치";
        sDiv.classList.remove("hidden");
        aDiv.classList.add("hidden");
    }
    updateUI();
}

function renderStableInventory() {
    const list = document.getElementById("stable-inventory-list");
    list.innerHTML = "";
    for(let key in gameData.inventory) {
        if(gameData.inventory[key] > 0) {
            const span = document.createElement("span");
            span.className = "mini-item-chip";
            span.innerText = `${ITEMS[key].name} x${gameData.inventory[key]}`;
            list.appendChild(span);
        }
    }
}

// --- 6. 상호작용 (인사 등) ---
function touchHorse() {
    const msgs = [
        "히힝! (반가워요)", "푸르르... (당근 줘)", "내 갈기 멋져?", 
        "오늘 컨디션 어때?", "달리고 싶어!", "주인님 최고!"
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    document.getElementById("message-bubble").innerText = msg;
    
    // 이모지 애니메이션 리셋
    const emo = document.getElementById("horse-emoji");
    emo.style.animation = 'none';
    emo.offsetHeight; /* trigger reflow */
    emo.style.animation = 'bounce 0.5s';
}

// --- 7. 알바 시스템 (쿨타임 & 스택) ---
let isAlbaCooling = false;

function doAlba() {
    if (isAlbaCooling) return;
    if (gameData.alba.count >= 30) {
        customAlert("오늘 알바는 여기까지입니다.");
        return;
    }

    // 쿨타임 시작
    isAlbaCooling = true;
    const btn = document.getElementById("btn-alba");
    const bar = document.getElementById("alba-cooldown");
    btn.disabled = true;
    btn.innerText = "휴식 중...";
    bar.style.width = "100%"; // 꽉 찼다가 줄어듦
    
    // 2초 동안 줄어들기
    setTimeout(() => { bar.style.width = "0%"; }, 10); 

    setTimeout(() => {
        isAlbaCooling = false;
        btn.disabled = false;
        btn.innerText = "💰 일하고 돈 받기";
    }, 2000);

    // 로직 처리
    gameData.alba.count++;
    gameData.alba.stack++;

    // 10회마다 행동력 소모
    if (gameData.alba.stack >= 10) {
        if (!useAction(1)) {
            // 행동력 없어서 실패 시 롤백
            gameData.alba.count--;
            gameData.alba.stack--;
            return; 
        }
        gameData.alba.stack = 0;
        customAlert("열심히 일했더니 피곤하네요.<br>(⚡️1 소모)");
    }

    // 돈 벌기 (확률)
    let earned = 0;
    const r = Math.random() * 100;
    if (r < 90) earned = Math.floor(Math.random() * 1000) + 1;
    else if (r < 99) earned = Math.floor(Math.random() * 4000) + 1001;
    else earned = Math.floor(Math.random() * 5000) + 5001;

    gameData.money += earned;
    document.getElementById("alba-result").innerText = `+${earned.toLocaleString()}원`;
    
    updateUI();
    saveGame();
}

// --- 8. 복권 시스템 ---
let selectedLottoNums = [];

function renderLotteryGrid() {
    const grid = document.getElementById("lottery-grid");
    grid.innerHTML = "";
    for(let i=1; i<=30; i++) {
        const div = document.createElement("div");
        div.className = "lotto-num";
        div.innerText = i;
        div.onclick = () => toggleLottoNum(i, div);
        div.id = `lotto-btn-${i}`;
        grid.appendChild(div);
    }
}

function toggleLottoNum(num, el) {
    if (gameData.lottery.status !== "ready") return;

    if (selectedLottoNums.includes(num)) {
        selectedLottoNums = selectedLottoNums.filter(n => n !== num);
        el.classList.remove("selected");
    } else {
        if (selectedLottoNums.length >= 3) {
            customAlert("3개까지만 선택 가능합니다.");
            return;
        }
        selectedLottoNums.push(num);
        el.classList.add("selected");
    }
}

function buyLottery() {
    if (selectedLottoNums.length !== 3) {
        customAlert("숫자 3개를 모두 선택해주세요.");
        return;
    }
    if (gameData.money < 5000) {
        customAlert("돈이 부족합니다.");
        return;
    }

    confirmModal(`번호 [${selectedLottoNums.join(", ")}] 로<br>5,000원에 구매하시겠습니까?`, () => {
        gameData.money -= 5000;
        gameData.lottery.status = "bought";
        gameData.lottery.myNumbers = [...selectedLottoNums];
        gameData.lottery.winningNumbers = [];
        
        customAlert("복권 구매 완료! 내일 아침을 기다리세요.");
        updateUI();
        saveGame();
    });
}

function checkLotteryResult() {
    // 다음날 아침이 되었을 때 실행됨
    if (gameData.lottery.status === "bought") {
        // 당첨 번호 생성 (1~30 중복 없이 3개)
        const nums = [];
        while(nums.length < 3) {
            const r = Math.floor(Math.random() * 30) + 1;
            if(!nums.includes(r)) nums.push(r);
        }
        gameData.lottery.winningNumbers = nums;
        gameData.lottery.status = "checked";
        
        // 등수 판별
        const my = gameData.lottery.myNumbers;
        let matchCnt = 0;
        my.forEach(n => { if (nums.includes(n)) matchCnt++; });
        
        gameData.lottery.rank = 0;
        if (matchCnt === 3) gameData.lottery.rank = 1;
        else if (matchCnt === 2) gameData.lottery.rank = 2;
        else if (matchCnt === 1) gameData.lottery.rank = 3;
    } else {
        // 안 샀으면 리셋
        resetLotteryState();
    }
}

function updateLotteryUI() {
    const buyArea = document.getElementById("lottery-buy-area");
    const waitArea = document.getElementById("lottery-waiting-area");
    const resArea = document.getElementById("lottery-result-area");

    if (gameData.lottery.status === "ready") {
        buyArea.classList.remove("hidden");
        waitArea.classList.add("hidden");
        resArea.classList.add("hidden");
        // 그리드 초기화 (시각적)
        if(selectedLottoNums.length === 0) {
             document.querySelectorAll(".lotto-num").forEach(e => e.classList.remove("selected"));
        }
    } else if (gameData.lottery.status === "bought") {
        buyArea.classList.add("hidden");
        waitArea.classList.remove("hidden");
        resArea.classList.add("hidden");
        
        const myDiv = document.getElementById("my-lotto-nums");
        myDiv.innerHTML = gameData.lottery.myNumbers.map(n => `<div class="ball">${n}</div>`).join("");
    } else if (gameData.lottery.status === "checked") {
        buyArea.classList.add("hidden");
        waitArea.classList.add("hidden");
        resArea.classList.remove("hidden");

        const winNums = gameData.lottery.winningNumbers;
        const myNums = gameData.lottery.myNumbers;
        
        // 당첨 번호 표시 (내 번호랑 맞으면 강조)
        const winDiv = document.getElementById("win-lotto-nums");
        winDiv.innerHTML = winNums.map(n => {
            const isMatch = myNums.includes(n);
            return `<div class="ball ${isMatch ? 'win' : ''}">${n}</div>`;
        }).join("");

        const rankMsg = document.getElementById("lotto-rank-msg");
        const claimBtn = document.getElementById("btn-claim-prize");
        
        if (gameData.lottery.rank > 0) {
            const prizes = {1: "1,000만원", 2: "500만원", 3: "100만원"};
            rankMsg.innerHTML = `<span style="color:red; font-size:18px">축하합니다! ${gameData.lottery.rank}등 당첨!</span>`;
            claimBtn.innerText = `🎁 ${prizes[gameData.lottery.rank]} 수령하기`;
            claimBtn.classList.remove("hidden");
        } else {
            rankMsg.innerText = "아쉽게도 꽝입니다... 다음 기회에!";
            claimBtn.innerText = "다음 기회에...";
            claimBtn.classList.remove("hidden");
            claimBtn.onclick = resetLotteryState; // 꽝이면 그냥 리셋
        }
    }
}

function claimLotteryPrize() {
    const rank = gameData.lottery.rank;
    let prize = 0;
    if (rank === 1) prize = 10000000;
    else if (rank === 2) prize = 5000000;
    else if (rank === 3) prize = 1000000;

    gameData.money += prize;
    customAlert(`축하합니다! 당첨금 ${prize.toLocaleString()}원을 수령했습니다!`);
    resetLotteryState();
    saveGame();
}

function resetLotteryState() {
    gameData.lottery.status = "ready";
    gameData.lottery.myNumbers = [];
    gameData.lottery.winningNumbers = [];
    gameData.lottery.rank = 0;
    selectedLottoNums = []; // 선택 배열 초기화
    updateUI();
    saveGame();
}

// --- 9. 레이싱 변경 (⚡️4 소모) ---
function startRace() {
    if (gameData.money < 10000) { customAlert("참가비가 부족합니다."); return; }
    
    // 행동력 4 체크
    if (gameData.time.actions < 4) {
        customAlert("행동력이 부족합니다.<br>레이싱은 ⚡️4가 모두 필요합니다.");
        return;
    }

    confirmModal("⚡️행동력 4를 모두 소모하여<br>그랑프리에 참가하시겠습니까?", () => {
        gameData.time.actions = 0; // 4 소모 (0으로 만듦)
        gameData.money -= 10000;
        
        // 레이싱 로직 (기존 동일)
        const b = gameData.horse.baseStats;
        let winProb = 1 + (b.stamina*0.1 + b.spirit*0.1 + b.speed*0.2 + b.charm*0.05);
        let rank = 1;
        let isFinished = false;
        
        while (!isFinished && rank <= 8) {
            if (Math.random()*100 < winProb) isFinished = true;
            else { rank++; winProb += 1; }
        }
        if (rank > 8) rank = 8;
        
        const prizes = [0, 1000000, 500000, 100000, 50000, 10000, 5000, 3000, 1000];
        gameData.money += prizes[rank];
        
        document.getElementById("race-result").classList.remove("hidden");
        document.getElementById("race-result").innerHTML = `${rank}등!<br>상금: ${prizes[rank].toLocaleString()}원`;
        
        customAlert("경주가 끝났습니다.<br>힘을 다 써서 시간이 흐릅니다.");
        setTimeout(nextPhase, 1000); // 레이싱 후 강제 턴 넘김
    });
}


// --- 10. 모달 시스템 (Alert 대체) ---
let confirmCallback = null;

function customAlert(msg) {
    document.getElementById("alert-msg").innerHTML = msg;
    document.getElementById("alert-btn-group").innerHTML = `<button class="btn-yes" onclick="closeAlert()">확인</button>`;
    document.getElementById("alert-overlay").classList.remove("hidden");
}

function confirmModal(msg, callback) {
    document.getElementById("alert-msg").innerHTML = msg;
    confirmCallback = callback;
    document.getElementById("alert-btn-group").innerHTML = `
        <button class="btn-yes" onclick="confirmYes()">네</button>
        <button class="btn-no" onclick="closeAlert()">아니요</button>
    `;
    document.getElementById("alert-overlay").classList.remove("hidden");
}

function confirmYes() {
    if (confirmCallback) confirmCallback();
    closeAlert();
}

function closeAlert() {
    document.getElementById("alert-overlay").classList.add("hidden");
}

// 기타 함수들(openItemModal, confirmUseItem 등)은 기존 유지, alert()만 customAlert()로 변경됨.
// (아이템 사용 함수는 내용이 길어서 위에 통합함)
function openItemModal(cat) {
    const list = document.getElementById("modal-list");
    list.innerHTML = "";
    let hasItem = false;
    for(let k in gameData.inventory) {
        if(gameData.inventory[k]>0 && ITEMS[k].cat === cat) {
            hasItem = true;
            const row = document.createElement("div");
            row.className = "modal-item-row";
            row.innerHTML = `<span>${ITEMS[k].name}</span><span>x${gameData.inventory[k]}</span>`;
            row.onclick = () => selectItemInModal(k);
            list.appendChild(row);
        }
    }
    if(!hasItem) list.innerHTML = "<div style='text-align:center;color:#999'>아이템이 없습니다.</div>";
    document.getElementById("modal-overlay").classList.remove("hidden");
    document.getElementById("modal-quantity-area").classList.add("hidden");
}

let selKey = null; let selQty = 1;
function selectItemInModal(k) {
    selKey = k; selQty = 1;
    document.getElementById("selected-item-name").innerText = ITEMS[k].name;
    document.getElementById("modal-quantity-area").classList.remove("hidden");
    updateQtyUI();
}
function changeQty(d) {
    const max = Math.min(5, gameData.inventory[selKey]);
    selQty = Math.max(1, Math.min(max, selQty + d));
    updateQtyUI();
}
function updateQtyUI() {
    document.getElementById("qty-display").innerText = selQty;
}
function confirmUseItem() {
    const item = ITEMS[selKey];
    if(item.cat !== 'med' && !useAction(1)) { closeModal(); return; } // 행동력 체크
    
    // 효과 적용
    const val = (typeof item.val === 'number') ? item.val * selQty : 0;
    if(item.cat === 'food') gameData.horse.status.hunger += val;
    else if(item.cat === 'toy') gameData.horse.status.mood += val;
    else if(item.cat === 'train') gameData.horse.baseStats[item.target] += val;
    else if(item.cat === 'care') gameData.horse.status.hygiene += val;
    
    gameData.inventory[selKey] -= selQty;
    if(gameData.inventory[selKey] <= 0) delete gameData.inventory[selKey];
    
    closeModal();
    updateUI();
    saveGame();
    customAlert(`${item.name} 사용 완료!`);
}
function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }
function renderStore() { /* 기존 코드와 동일 (카테고리 렌더링) */ 
    const c = document.getElementById("shop-container"); c.innerHTML="";
    // (상점 렌더링 코드는 분량상 생략되었으나 이전 버전과 동일하게 작동합니다)
    // 실제 파일엔 포함되어야 합니다.
    const cats = {"food":"🥕","toy":"🧸","train":"🏋️","care":"🧹","med":"💊"};
    for(let cat in cats){
        const d=document.createElement("div"); d.innerHTML=`<div class='category-title'>${cats[cat]}</div>`;
        const g=document.createElement("div"); g.className="shop-grid";
        for(let k in ITEMS){
            if(ITEMS[k].cat===cat){
                const card=document.createElement("div"); card.className="item-card";
                card.innerHTML=`<span class='item-name'>${ITEMS[k].name}</span><span class='item-price'>${ITEMS[k].price}원</span><span class='item-desc'>${ITEMS[k].desc}</span>`;
                card.onclick=()=>tryBuy(k);
                g.appendChild(card);
            }
        }
        d.appendChild(g); c.appendChild(d);
    }
}
function tryBuy(k) {
    confirmModal(`${ITEMS[k].name} 구매하시겠습니까?`, ()=>{
        if(gameData.money >= ITEMS[k].price) {
            gameData.money -= ITEMS[k].price;
            gameData.inventory[k] = (gameData.inventory[k]||0)+1;
            updateUI(); saveGame(); customAlert("구매 완료");
        } else customAlert("돈 부족");
    });
}
function loadGame() {
    const s = localStorage.getItem("carrot_v2_1");
    if(s) gameData = JSON.parse(s);
}
function saveGame() { localStorage.setItem("carrot_v2_1", JSON.stringify(gameData)); }
function resetGame() { localStorage.removeItem("carrot_v2_1"); location.reload(); }
function changeName() {
    const n = prompt("이름 변경"); 
    if(n) { gameData.horse.name = n; updateUI(); saveGame(); }
}
function changeLocation(l) {
    document.querySelectorAll('.view-section').forEach(e=>e.classList.remove('active'));
    document.getElementById('view-'+l).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
    document.getElementById('btn-'+l).classList.add('active');
}

initGame();
