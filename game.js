/* Project: Carrot (v0.2.1) */

// --- 1. 데이터 베이스 (아이템 및 설정) ---
const ITEMS = {
    // [먹이]
    "food_sugar": { name: "각설탕", price: 14000, cat: "food", val: 15, desc: "말이 좋아하는 특식", effect: "포만감 +15" },
    "food_hay": { name: "건초", price: 9500, cat: "food", val: 10, desc: "말이 좋아하는 풀떼기", effect: "포만감 +10" },
    "food_carrot": { name: "당근", price: 9500, cat: "food", val: 10, desc: "말이 좋아하는 별미", effect: "포만감 +10" },
    "food_feed": { name: "사료", price: 5000, cat: "food", val: 5, desc: "먹을 수 있으니까 먹는다", effect: "포만감 +5" },
    
    // [장난감]
    "toy_basic": { name: "기본 장난감", price: 5000, cat: "toy", val: 10, desc: "오래 갖고 놀면 질린다.", effect: "기분 +10" },
    "toy_fun": { name: "재밌는 장난감", price: 9500, cat: "toy", val: 20, desc: "갖고 놀 때마다 재밌다.", effect: "기분 +20" },
    "toy_magic": { name: "신기한 장난감", price: 99000, cat: "toy", val: "R", desc: "이게 대체 뭐지?", effect: "기분 랜덤 대박?" },

    // [훈련]
    "train_basic": { name: "기본 훈련도구", price: 5000, cat: "train", target: "stamina", val: 1, desc: "단순해서 외울 듯 싶다.", effect: "체력 +1" },
    "train_special": { name: "특수 훈련도구", price: 9500, cat: "train", target: "spirit", val: 1, desc: "힘들지만 재미있다.", effect: "기력 +1" },
    "train_magic": { name: "마법봉", price: 99000, cat: "train", target: "R", val: "R", desc: "요물이다.", effect: "랜덤 스탯 변화" },

    // [케어]
    "care_comb": { name: "기본 빗", price: 5000, cat: "care", val: 5, desc: "역할에 충실한 빗", effect: "위생 +5" },
    "care_comb_good": { name: "결 좋은 빗", price: 9500, cat: "care", val: 10, desc: "빗기만 해도 윤기가 좌르르", effect: "위생 +10" },
    "care_broom": { name: "빗자루", price: 99000, cat: "care", val: "R", desc: "이걸로 날 빗기겠다고?", effect: "위생 랜덤 변화" },

    // [의약품]
    "med_digest": { name: "홀스활명수", price: 10000, cat: "med", type: "digest", desc: "소화가 빨라진다.", effect: "과식 치료" },
    "med_clean": { name: "말을씻자", price: 10000, cat: "med", type: "clean", desc: "꼬질꼬질한 냄새가 사라진다.", effect: "위생 +50" },
    "med_oneshot": { name: "홀스원샷", price: 10000, cat: "med", type: "oneshot", desc: "차량용이 아니다.", effect: "랜덤 능력치 +5~20" }
};

const MAX_STATS = { "SS": 100, "S": 90, "A": 80, "B": 70, "C": 60 };

// --- 2. 게임 상태 데이터 ---
let gameData = {
    time: { day: 1, phase: "am", actions: 4 },
    money: 100000,
    alba: { count: 0, stack: 0 }, // stack: 10번 채우면 행동력 1 소모
    lottery: {
        status: "ready", // ready(구매전), bought(구매완료), checked(결과확인가능)
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
    inventory: { "food_feed": 10, "toy_basic": 5, "train_basic": 5 } // 기본 지급
};

// --- 3. 초기화 및 저장 시스템 ---

function initGame() {
    loadGame();
    renderStore();
    renderLotteryGrid();
    updateUI();
}

function loadGame() {
    const saved = localStorage.getItem("carrot_v2_1");
    if (saved) {
        gameData = JSON.parse(saved);
    } else {
        // 첫 시작 시 환영 메시지
        setTimeout(() => customAlert("Project Carrot v0.2.1에 오신 것을 환영합니다!<br>지원금 100,000원이 지급되었습니다."), 500);
    }
}

function saveGame() {
    localStorage.setItem("carrot_v2_1", JSON.stringify(gameData));
}

function resetGame() {
    confirmModal("데이터를 완전히 초기화하고<br>1일차로 돌아가시겠습니까?", () => {
        localStorage.removeItem("carrot_v2_1");
        location.reload();
    });
}

// --- 4. 시간 및 행동 시스템 ---

function useAction(cost = 1) {
    if (gameData.time.actions < cost) {
        customAlert(`행동력이 부족합니다!<br>(필요: ⚡️${cost} / 보유: ⚡️${gameData.time.actions})`);
        return false;
    }
    gameData.time.actions -= cost;
    
    // 행동력 0이면 자동 턴 넘김 안내
    if (gameData.time.actions <= 0) {
        setTimeout(() => {
            customAlert("모든 행동력을 소모했습니다.<br>시간이 흐릅니다.");
            nextPhase();
        }, 800);
    }
    
    saveGame();
    return true;
}

function nextPhase() {
    // 페이즈 변경 로직
    gameData.alba.count = 0; // 알바 횟수 리셋
    gameData.time.actions = 4; // 행동력 리필

    if (gameData.time.phase === "am") {
        gameData.time.phase = "pm";
    } else {
        gameData.time.phase = "am";
        gameData.time.day++;
        dailyUpdate(); // 하루 경과 처리
        checkLotteryResult(); // 복권 결과 발표
    }
    
    updateUI();
    saveGame();
}

function dailyUpdate() {
    // 하루가 지날 때 패시브 효과
    const s = gameData.horse.status;
    s.hunger -= 10;
    s.hygiene -= 10;
    s.mood -= 10;
    
    // 최소값 제한 (-20, 0, 0)
    if(s.hunger < -20) s.hunger = -20;
    if(s.hygiene < 0) s.hygiene = 0;
    if(s.mood < 0) s.mood = 0;
}

// --- 5. UI 업데이트 ---

function updateUI() {
    // 1. 상단 정보
    const phaseText = gameData.time.phase === "am" ? "오전" : "오후";
    document.getElementById("date-display").innerText = `${gameData.time.day}일차 ${phaseText}`;
    document.getElementById("action-points").innerText = "⚡️".repeat(gameData.time.actions);
    document.getElementById("money-display").innerText = gameData.money.toLocaleString() + " 원";

    // 2. 마구간 정보
    document.getElementById("horse-name-display").innerText = gameData.horse.name;
    
    // 버튼 텍스트와 타이틀 동기화
    const toggleBtn = document.getElementById("btn-stat-toggle");
    const isAbilityMode = toggleBtn.innerText === "상태"; // 버튼이 '상태'면 현재 보는건 '능력치'
    document.getElementById("panel-title").innerText = `${gameData.horse.name}의 ${isAbilityMode ? '능력치' : '상태'}`;

    // 상태 바 업데이트
    const s = gameData.horse.status;
    updateBar("hunger", s.hunger, 100);
    updateBar("hygiene", s.hygiene, 100);
    updateBar("mood", s.mood, 100);
    
    // 컨디션 텍스트
    const condVal = (s.hunger + s.hygiene + s.mood) / 3;
    let condText = "보통";
    if (condVal > 80) condText = "최고 좋음";
    else if (condVal > 60) condText = "좋음";
    else if (condVal < 40) condText = "나쁨";
    else if (condVal < 20) condText = "최악";
    document.getElementById("val-condition").innerText = condText;

    // 능력치 바 업데이트
    const b = gameData.horse.baseStats;
    const gradeMax = MAX_STATS[gameData.horse.grade];
    updateBar("stamina", b.stamina, gradeMax, true);
    updateBar("speed", b.speed, gradeMax, true);
    updateBar("spirit", b.spirit, gradeMax, true);
    updateBar("charm", b.charm, gradeMax, true);

    // 알바 정보
    document.getElementById("alba-count").innerText = 30 - gameData.alba.count;
    document.getElementById("alba-stack").innerText = gameData.alba.stack;
    
    // 레이싱 확률
    let prob = 1 + (b.stamina*0.1 + b.spirit*0.1 + b.speed*0.2 + b.charm*0.05);
    document.getElementById("win-prob").innerText = `예상 우승 확률: ${prob.toFixed(1)}%`;

    // 인벤토리 및 복권 UI 갱신
    renderStableInventory();
    updateLotteryUI();
}

function updateBar(id, val, max, isAbility = false) {
    const bar = document.getElementById(`bar-${id}`);
    const txt = document.getElementById(`text-${id}`);
    
    // 시각적 % 계산 (0~100)
    let percent = (val / max) * 100;
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;
    
    bar.style.width = percent + "%";
    txt.innerText = val + (isAbility ? `/${max}` : "");
}

// 스탯 뷰 토글
function toggleStatView() {
    const btn = document.getElementById("btn-stat-toggle");
    const sDiv = document.getElementById("stat-status");
    const aDiv = document.getElementById("stat-ability");
    
    if (btn.innerText === "능력치") { 
        // 능력치 보기 모드로 전환
        btn.innerText = "상태";
        sDiv.classList.add("hidden");
        aDiv.classList.remove("hidden");
    } else { 
        // 상태 보기 모드로 전환
        btn.innerText = "능력치";
        sDiv.classList.remove("hidden");
        aDiv.classList.add("hidden");
    }
    updateUI();
}

function renderStableInventory() {
    const list = document.getElementById("stable-inventory-list");
    list.innerHTML = "";
    
    let isEmpty = true;
    for (let key in gameData.inventory) {
        if (gameData.inventory[key] > 0) {
            isEmpty = false;
            const span = document.createElement("span");
            span.className = "mini-item-chip";
            span.innerText = `${ITEMS[key].name} x${gameData.inventory[key]}`;
            list.appendChild(span);
        }
    }
    if (isEmpty) {
        list.innerHTML = '<span class="empty-msg">가방이 비어있습니다.</span>';
    }
}

function changeName() {
    const newName = prompt("말의 새로운 이름을 지어주세요:", gameData.horse.name);
    if (newName && newName.trim().length > 0) {
        gameData.horse.name = newName.trim();
        updateUI();
        saveGame();
    }
}

function changeLocation(loc) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${loc}`).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`btn-${loc}`).classList.add('active');
}

function touchHorse() {
    const msgs = ["히힝!", "푸르르...", "오늘 기분 어때요?", "달리고 싶어요!", "당근 주세요!", "주인님 최고!"];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    document.getElementById("message-bubble").innerText = msg;
    
    // 애니메이션 리셋 효과
    const emoji = document.getElementById("horse-emoji");
    const img = document.getElementById("horse-img");
    
    const target = img.classList.contains("hidden") ? emoji : img;
    target.style.animation = 'none';
    target.offsetHeight; /* reflow */
    target.style.animation = 'bounce 0.5s';
}


// --- 6. 상점 시스템 ---

function renderStore() {
    const container = document.getElementById("shop-container");
    container.innerHTML = "";
    
    const categories = {
        "food": "🥕 먹이", "toy": "🧸 장난감", "train": "🏋️ 훈련도구", "care": "🧹 케어도구", "med": "💊 의약품"
    };

    for (let catKey in categories) {
        const catDiv = document.createElement("div");
        catDiv.className = "category-block";
        catDiv.innerHTML = `<div class="category-title">${categories[catKey]}</div>`;
        
        const grid = document.createElement("div");
        grid.className = "shop-grid";
        
        for (let itemId in ITEMS) {
            if (ITEMS[itemId].cat === catKey) {
                const item = ITEMS[itemId];
                const card = document.createElement("div");
                card.className = "item-card";
                card.innerHTML = `
                    <div class="info-btn" onclick="event.stopPropagation(); toggleInfo(this)">i</div>
                    <span class="item-name">${item.name}</span>
                    <span class="item-price">${item.price.toLocaleString()}원</span>
                    <span class="item-desc">${item.desc}</span>
                    <span class="item-effect">${item.effect}</span>
                `;
                card.onclick = () => tryBuyItem(itemId);
                grid.appendChild(card);
            }
        }
        catDiv.appendChild(grid);
        container.appendChild(catDiv);
    }
}

function toggleInfo(btn) {
    const card = btn.parentElement;
    card.classList.toggle("show-effect");
}

function tryBuyItem(itemId) {
    const item = ITEMS[itemId];
    confirmModal(`[${item.name}]<br>${item.price.toLocaleString()}원을 지불하고 구매하시겠습니까?`, () => {
        if (gameData.money >= item.price) {
            gameData.money -= item.price;
            gameData.inventory[itemId] = (gameData.inventory[itemId] || 0) + 1;
            customAlert(`${item.name} 구매 완료!`);
            updateUI();
            saveGame();
        } else {
            customAlert("돈이 부족합니다!");
        }
    });
}


// --- 7. 아이템 사용 (모달) ---

let selectedItemKey = null;
let selectedQty = 1;

function openItemModal(category) {
    const list = document.getElementById("modal-list");
    list.innerHTML = "";
    
    let hasItem = false;
    for (let key in gameData.inventory) {
        if (gameData.inventory[key] > 0 && ITEMS[key].cat === category) {
            hasItem = true;
            const item = ITEMS[key];
            const row = document.createElement("div");
            row.className = "modal-item-row";
            row.innerHTML = `<span>${item.name}</span> <span>x${gameData.inventory[key]}</span>`;
            row.onclick = () => selectItemInModal(key);
            list.appendChild(row);
        }
    }

    if (!hasItem) {
        list.innerHTML = "<div style='text-align:center; padding:20px; color:#999'>해당 아이템이 없습니다.</div>";
    }

    document.getElementById("modal-quantity-area").classList.add("hidden");
    document.getElementById("modal-overlay").classList.remove("hidden");
    document.getElementById("modal-title").innerText = {food:"먹이 주기", toy:"놀아주기", train:"훈련하기", care:"관리하기"}[category];
}

function selectItemInModal(key) {
    selectedItemKey = key;
    selectedQty = 1;
    document.getElementById("selected-item-name").innerText = ITEMS[key].name;
    document.getElementById("modal-quantity-area").classList.remove("hidden");
    updateQtyUI();
}

function changeQty(delta) {
    const maxPoss = Math.min(5, gameData.inventory[selectedItemKey]);
    selectedQty += delta;
    if (selectedQty < 1) selectedQty = 1;
    if (selectedQty > maxPoss) selectedQty = maxPoss;
    updateQtyUI();
}

function updateQtyUI() {
    document.getElementById("qty-display").innerText = selectedQty;
    const item = ITEMS[selectedItemKey];
    let txt = "";
    if (typeof item.val === "number") txt = `예상 효과: 수치 +${item.val * selectedQty}`;
    else txt = `예상 효과: 랜덤`;
    document.getElementById("effect-preview").innerText = txt;
}

function confirmUseItem() {
    const item = ITEMS[selectedItemKey];
    
    // 행동력 체크 (의약품 제외)
    if (item.cat !== 'med' && !useAction(1)) {
        closeModal();
        return;
    }

    // 아이템 소모
    gameData.inventory[selectedItemKey] -= selectedQty;
    if (gameData.inventory[selectedItemKey] <= 0) delete gameData.inventory[selectedItemKey];

    // 효과 적용 로직
    const totalVal = (typeof item.val === "number") ? item.val * selectedQty : 0;
    
    if (item.cat === "food") gameData.horse.status.hunger += totalVal;
    else if (item.cat === "toy") {
        if (item.val === "R") gameData.horse.status.mood += (Math.floor(Math.random()*151)-50);
        else gameData.horse.status.mood += totalVal;
    }
    else if (item.cat === "train") {
        if (item.val === "R") {
            const arr = ["stamina", "speed", "spirit", "charm"];
            const t = arr[Math.floor(Math.random()*4)];
            gameData.horse.baseStats[t] += (Math.floor(Math.random()*71)-20);
        } else {
            gameData.horse.baseStats[item.target] += totalVal;
        }
    }
    else if (item.cat === "care") {
        if (item.val === "R") gameData.horse.status.hygiene += (Math.floor(Math.random()*71)-20);
        else gameData.horse.status.hygiene += totalVal;
    }
    else if (item.cat === "med") {
        if (item.type === "digest") gameData.horse.status.hunger = 100;
        else if (item.type === "clean") gameData.horse.status.hygiene += 50;
        else if (item.type === "oneshot") {
            const arr = ["stamina", "speed", "spirit", "charm"];
            const t = arr[Math.floor(Math.random()*4)];
            gameData.horse.baseStats[t] += (Math.floor(Math.random()*16)+5);
        }
    }

    closeModal();
    updateUI();
    saveGame();
    customAlert(`${item.name} 사용 완료!`);
}


// --- 8. 알바 시스템 (쿨타임 & 스택) ---

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
    bar.style.width = "100%"; 

    setTimeout(() => { bar.style.width = "0%"; }, 10);
    setTimeout(() => {
        isAlbaCooling = false;
        btn.disabled = false;
        btn.innerText = "💰 일하고 돈 받기";
    }, 2000); // 2초 쿨타임

    // 로직
    gameData.alba.count++;
    gameData.alba.stack++;

    // 10회마다 행동력 소모
    if (gameData.alba.stack >= 10) {
        if (!useAction(1)) {
            // 실패 시 롤백
            gameData.alba.count--;
            gameData.alba.stack--;
            return;
        }
        gameData.alba.stack = 0;
        customAlert("열심히 일했더니 피곤하네요.<br>(⚡️1 소모)");
    }

    // 보상
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


// --- 9. 복권 시스템 ---

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
        gameData.lottery.winningNumbers = []; // 초기화
        
        customAlert("구매 완료! 내일 아침 추첨 결과를 확인하세요.");
        updateUI();
        saveGame();
    });
}

function checkLotteryResult() {
    // 날짜 변경 시 호출됨
    if (gameData.lottery.status === "bought") {
        // 당첨 번호 생성
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
        resetLotteryState();
    }
}

function updateLotteryUI() {
    const buyArea = document.getElementById("lottery-buy-area");
    const waitArea = document.getElementById("lottery-waiting-area");
    const resArea = document.getElementById("lottery-result-area");

    // 상태별 표시 제어
    if (gameData.lottery.status === "ready") {
        buyArea.classList.remove("hidden");
        waitArea.classList.add("hidden");
        resArea.classList.add("hidden");
        if(selectedLottoNums.length === 0) {
            document.querySelectorAll(".lotto-num").forEach(e => e.classList.remove("selected"));
        }
    } else if (gameData.lottery.status === "bought") {
        buyArea.classList.add("hidden");
        waitArea.classList.remove("hidden");
        resArea.classList.add("hidden");
        
        document.getElementById("my-lotto-nums").innerHTML = 
            gameData.lottery.myNumbers.map(n => `<div class="ball">${n}</div>`).join("");
    } else if (gameData.lottery.status === "checked") {
        buyArea.classList.add("hidden");
        waitArea.classList.add("hidden");
        resArea.classList.remove("hidden");
        
        const winNums = gameData.lottery.winningNumbers;
        const myNums = gameData.lottery.myNumbers;
        
        document.getElementById("win-lotto-nums").innerHTML = 
            winNums.map(n => {
                const isMatch = myNums.includes(n);
                return `<div class="ball ${isMatch ? 'win' : ''}">${n}</div>`;
            }).join("");
            
        const msg = document.getElementById("lotto-rank-msg");
        const btn = document.getElementById("btn-claim-prize");
        
        if (gameData.lottery.rank > 0) {
            const prizes = {1: "1,000만원", 2: "500만원", 3: "100만원"};
            msg.innerHTML = `<span style="color:#d35400">축하합니다! ${gameData.lottery.rank}등 당첨!</span>`;
            btn.innerText = `🎁 ${prizes[gameData.lottery.rank]} 수령`;
            btn.classList.remove("hidden");
            btn.onclick = claimLotteryPrize;
        } else {
            msg.innerText = "아쉽게도 꽝입니다... 다음 기회에!";
            btn.innerText = "돌아가기";
            btn.classList.remove("hidden");
            btn.onclick = resetLotteryState;
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
}

function resetLotteryState() {
    gameData.lottery.status = "ready";
    gameData.lottery.myNumbers = [];
    gameData.lottery.winningNumbers = [];
    gameData.lottery.rank = 0;
    selectedLottoNums = [];
    updateUI();
    saveGame();
}


// --- 10. 레이싱 시스템 (행동력 4 소모) ---

function startRace() {
    if (gameData.money < 10000) {
        customAlert("참가비(10,000원)가 부족합니다.");
        return;
    }
    
    if (gameData.time.actions < 4) {
        customAlert("행동력이 부족합니다.<br>레이싱은 ⚡️4가 모두 필요합니다.");
        return;
    }

    confirmModal("⚡️행동력 4를 모두 소모하여<br>그랑프리에 참가하시겠습니까?", () => {
        // 소모 처리 (useAction 미사용, 강제 처리)
        gameData.time.actions = 0;
        gameData.money -= 10000;
        
        // 레이싱 로직
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
        
        updateUI();
        customAlert(`경주 완료! ${rank}등을 차지했습니다.<br>모든 힘을 쏟아 시간이 흐릅니다.`);
        setTimeout(nextPhase, 1000); // 강제 턴 넘김
    });
}


// --- 11. 모달 유틸리티 ---

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

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

// 게임 시작
initGame();
