/* Project: Carrot (v0.2.0)
    Code Name: carrot
*/

// --- 1. 데이터 베이스 (아이템 & 설정) ---
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
    "med_digest": { name: "홀스활명수", price: 10000, cat: "med", type: "digest", desc: "소화가 빨라진다.", effect: "과식 치료 (배부름 100으로)" },
    "med_clean": { name: "말을씻자", price: 10000, cat: "med", type: "clean", desc: "꼬질꼬질한 냄새가 사라진다.", effect: "위생 +50" },
    "med_oneshot": { name: "홀스원샷", price: 10000, cat: "med", type: "oneshot", desc: "차량용이 아니다.", effect: "랜덤 능력치 +5~20" }
};

const MAX_STATS = { "SS": 100, "S": 90, "A": 80, "B": 70, "C": 60 };

// --- 2. 게임 상태 (저장 대상) ---
let gameData = {
    time: {
        day: 1,
        phase: "am", // 'am' or 'pm'
        actions: 4
    },
    alba: {
        count: 0,
        limit: 30
    },
    money: 100000,
    horse: {
        name: "초코",
        grade: "C",
        status: { hunger: 50, hygiene: 50, mood: 50 },
        baseStats: { stamina: 30, speed: 25, spirit: 20, charm: 15 }
    },
    inventory: {
        "food_feed": 10,
        "toy_basic": 5,
        "train_basic": 5
    }
};

// --- 3. 초기화 및 저장 시스템 ---

function initGame() {
    loadGame(); // 저장된 데이터 불러오기
    renderStore(); // 상점 그리기
    updateUI(); // 화면 갱신
}

function saveGame() {
    localStorage.setItem("carrot_save_v2", JSON.stringify(gameData));
}

function loadGame() {
    const saved = localStorage.getItem("carrot_save_v2");
    if (saved) {
        gameData = JSON.parse(saved);
    } else {
        // 첫 시작
        customAlert("Project Carrot v0.2.0에 오신 것을 환영합니다!<br>신규 정착 지원금이 지급되었습니다.");
    }
}

function resetGame() {
    confirmModal("데이터를 초기화하고 1일차로 돌아가시겠습니까?", () => {
        localStorage.removeItem("carrot_save_v2");
        location.reload();
    });
}

// --- 4. 시간 및 행동 시스템 ---

function useAction(cost = 1) {
    if (gameData.time.actions < cost) {
        customAlert("행동력이 부족합니다!<br>다음 시간대로 넘어갑니다.");
        nextPhase();
        return false;
    }
    gameData.time.actions -= cost;
    
    // 행동력 0이면 자동 턴 넘김
    if (gameData.time.actions <= 0) {
        setTimeout(() => {
            customAlert("모든 행동력을 소모했습니다.<br>시간이 흐릅니다.");
            nextPhase();
        }, 500); // 약간의 딜레이
    }
    
    saveGame();
    return true;
}

function nextPhase() {
    // 알바 횟수 초기화
    gameData.alba.count = 0;
    gameData.time.actions = 4; // 행동력 리필

    if (gameData.time.phase === "am") {
        gameData.time.phase = "pm";
    } else {
        gameData.time.phase = "am";
        gameData.time.day++;
        dailyUpdate(); // 하루 지날 때 패시브 효과 (배고픔 등)
    }
    
    updateUI();
    saveGame();
}

function dailyUpdate() {
    // 하루가 지날 때 자연 감소
    const s = gameData.horse.status;
    s.hunger -= 10;
    s.hygiene -= 10;
    s.mood -= 10;
    
    // 범위 제한
    s.hygiene = Math.max(0, s.hygiene);
    s.mood = Math.max(0, s.mood);
}


// --- 5. UI 업데이트 및 로직 ---

function updateUI() {
    // 1. 상단 정보
    const phaseText = gameData.time.phase === "am" ? "오전" : "오후";
    document.getElementById("date-display").innerText = `${gameData.time.day}일차 ${phaseText}`;
    
    let bolt = "";
    for(let i=0; i<gameData.time.actions; i++) bolt += "⚡️";
    document.getElementById("action-points").innerText = bolt;
    
    document.getElementById("money-display").innerText = gameData.money.toLocaleString() + " 원";

    // 2. 마구간 정보
    document.getElementById("horse-name-display").innerText = gameData.horse.name;
    document.getElementById("panel-title").innerText = `${gameData.horse.name}의 ${isStatViewMode ? '능력치' : '상태'}`;

    // 상태 바 & 텍스트
    const s = gameData.horse.status;
    updateBar("hunger", s.hunger, 100);
    updateBar("hygiene", s.hygiene, 100);
    updateBar("mood", s.mood, 100);
    
    // 컨디션 계산
    const condVal = (s.hunger + s.hygiene + s.mood) / 3;
    let condText = "보통";
    if (condVal > 80) condText = "최고 좋음";
    else if (condVal > 60) condText = "좋음";
    else if (condVal < 40) condText = "나쁨";
    else if (condVal < 20) condText = "최악";
    document.getElementById("val-condition").innerText = condText;

    // 능력치 업데이트
    const b = gameData.horse.baseStats;
    updateBar("stamina", b.stamina, MAX_STATS[gameData.horse.grade], true);
    updateBar("speed", b.speed, MAX_STATS[gameData.horse.grade], true);
    updateBar("spirit", b.spirit, MAX_STATS[gameData.horse.grade], true);
    updateBar("charm", b.charm, MAX_STATS[gameData.horse.grade], true);

    // 알바 횟수
    document.getElementById("alba-count").innerText = 30 - gameData.alba.count;
    
    // 우승 확률 미리보기
    let prob = 1 + (b.stamina*0.1 + b.spirit*0.1 + b.speed*0.2 + b.charm*0.05);
    document.getElementById("win-prob").innerText = `예상 우승 확률: ${prob.toFixed(1)}%`;
}

function updateBar(id, val, max, isAbility = false) {
    const bar = document.getElementById(`bar-${id}`);
    const txt = document.getElementById(`text-${id}`);
    
    let percent = (val / max) * 100;
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;
    
    bar.style.width = percent + "%";
    txt.innerText = val + (isAbility ? `/${max}` : "");
}

// 스탯 뷰 토글
let isStatViewMode = false;
function toggleStatView() {
    isStatViewMode = !isStatViewMode;
    const sDiv = document.getElementById("stat-status");
    const aDiv = document.getElementById("stat-ability");
    
    if (isStatViewMode) {
        sDiv.classList.add("hidden");
        aDiv.classList.remove("hidden");
    } else {
        sDiv.classList.remove("hidden");
        aDiv.classList.add("hidden");
    }
    updateUI();
}

function changeName() {
    const newName = prompt("말의 새로운 이름을 지어주세요:", gameData.horse.name);
    if (newName && newName.length > 0) {
        gameData.horse.name = newName;
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


// --- 6. 상점 시스템 ---

function renderStore() {
    const container = document.getElementById("shop-container");
    container.innerHTML = "";
    
    const categories = {
        "food": "🥕 먹이",
        "toy": "🧸 장난감",
        "train": "🏋️ 훈련도구",
        "care": "🧹 케어도구",
        "med": "💊 의약품"
    };

    for (let catKey in categories) {
        // 카테고리 헤더
        const catDiv = document.createElement("div");
        catDiv.className = "category-block";
        catDiv.innerHTML = `<div class="category-title">${categories[catKey]}</div>`;
        
        // 아이템 그리드
        const grid = document.createElement("div");
        grid.className = "shop-grid";
        
        // 해당 카테고리 아이템 필터링
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


// --- 7. 마구간 아이템 사용 시스템 (모달) ---

let selectedItemKey = null;
let selectedQty = 1;

function openItemModal(category) {
    const modalList = document.getElementById("modal-list");
    const modalTitle = document.getElementById("modal-title");
    modalList.innerHTML = "";
    
    // 카테고리별 인벤토리 필터링
    let hasItem = false;
    for (let key in gameData.inventory) {
        if (gameData.inventory[key] > 0 && ITEMS[key].cat === category) {
            hasItem = true;
            const item = ITEMS[key];
            const row = document.createElement("div");
            row.className = "modal-item-row";
            row.innerHTML = `<span>${item.name}</span> <span>x${gameData.inventory[key]}</span>`;
            row.onclick = () => selectItemInModal(key);
            modalList.appendChild(row);
        }
    }

    if (!hasItem) {
        modalList.innerHTML = "<div style='text-align:center; padding:20px; color:#999'>아이템이 없습니다.</div>";
    }

    document.getElementById("modal-quantity-area").classList.add("hidden");
    document.getElementById("modal-overlay").classList.remove("hidden");
    
    // 제목 설정
    const titles = { food: "먹이 주기", toy: "놀아주기", train: "훈련하기", care: "관리하기" };
    modalTitle.innerText = titles[category];
}

function selectItemInModal(key) {
    selectedItemKey = key;
    selectedQty = 1;
    const item = ITEMS[key];
    const maxPoss = Math.min(5, gameData.inventory[key]);
    
    document.getElementById("selected-item-name").innerText = item.name;
    document.getElementById("modal-quantity-area").classList.remove("hidden");
    updateQtyUI(maxPoss);
}

function changeQty(delta) {
    const maxPoss = Math.min(5, gameData.inventory[selectedItemKey]);
    selectedQty += delta;
    if (selectedQty < 1) selectedQty = 1;
    if (selectedQty > maxPoss) selectedQty = maxPoss;
    updateQtyUI(maxPoss);
}

function updateQtyUI(max) {
    document.getElementById("qty-display").innerText = selectedQty;
    const item = ITEMS[selectedItemKey];
    
    // 효과 미리보기 계산
    let effectText = "";
    if (typeof item.val === "number") {
        effectText = `예상 효과: 수치 +${item.val * selectedQty}`;
    } else {
        effectText = `예상 효과: 랜덤`;
    }
    document.getElementById("effect-preview").innerText = effectText;
}

function confirmUseItem() {
    // 행동력 소모 체크 (약품 제외)
    const item = ITEMS[selectedItemKey];
    if (item.cat !== 'med' && gameData.time.actions < 1) {
        customAlert("행동력이 부족합니다!");
        return;
    }

    closeModal(); // 모달 닫기
    
    // 실제 효과 적용
    const totalVal = (typeof item.val === "number") ? item.val * selectedQty : 0;
    let msg = "";

    // 1. 먹이
    if (item.cat === "food") {
        gameData.horse.status.hunger += totalVal;
        msg = `냠냠! 포만감이 ${totalVal} 올랐어!`;
    } 
    // 2. 장난감
    else if (item.cat === "toy") {
        if (item.val === "R") { // 신기한 장난감
            const rand = Math.floor(Math.random()*151) - 50;
            gameData.horse.status.mood += rand;
            msg = `기분이 ${rand}만큼 변했어!`;
        } else {
            gameData.horse.status.mood += totalVal;
            msg = `재밌다! 기분이 ${totalVal} 올랐어!`;
        }
    }
    // 3. 훈련
    else if (item.cat === "train") {
        if (item.val === "R") { // 마법봉
            const stats = ["stamina", "speed", "spirit", "charm"];
            const target = stats[Math.floor(Math.random()*4)];
            const rand = Math.floor(Math.random()*71) - 20;
            gameData.horse.baseStats[target] = Math.min(MAX_STATS[gameData.horse.grade], Math.max(0, gameData.horse.baseStats[target] + rand));
            msg = `마법봉 효과! ${target} 수치가 변했다!`;
        } else {
            const stat = item.target;
            gameData.horse.baseStats[stat] = Math.min(MAX_STATS[gameData.horse.grade], gameData.horse.baseStats[stat] + totalVal);
            msg = `열심히 훈련해서 능력치가 올랐어!`;
        }
    }
    // 4. 케어
    else if (item.cat === "care") {
        if (item.val === "R") { // 빗자루
             const rand = Math.floor(Math.random()*71) - 20;
             gameData.horse.status.hygiene += rand;
             msg = "빗자루질을 했더니...";
        } else {
            gameData.horse.status.hygiene += totalVal;
            msg = `깔끔해졌다! 위생 +${totalVal}`;
        }
    }
    // 5. 의약품 (행동력 소모 X)
    else if (item.cat === "med") {
        if (item.type === "digest") gameData.horse.status.hunger = 100;
        else if (item.type === "clean") gameData.horse.status.hygiene += 50;
        else if (item.type === "oneshot") {
             const stats = ["stamina", "speed", "spirit", "charm"];
             const target = stats[Math.floor(Math.random()*4)];
             gameData.horse.baseStats[target] += (Math.floor(Math.random()*16)+5);
        }
        msg = "약을 사용했습니다.";
    }

    // 아이템 차감
    gameData.inventory[selectedItemKey] -= selectedQty;
    if (gameData.inventory[selectedItemKey] <= 0) delete gameData.inventory[selectedItemKey];

    // 행동력 차감 (의약품 제외)
    if (item.cat !== 'med') useAction(1);
    
    customAlert(msg);
    updateUI();
    saveGame();
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}


// --- 8. 돈 벌기 (알바 & 경마) ---

function doAlba() {
    if (gameData.alba.count >= gameData.alba.limit) {
        customAlert("오늘은 더 이상 알바를 할 수 없습니다.<br>(다음 시간대까지 대기)");
        return;
    }

    gameData.alba.count++;
    
    // 확률 로직 (1원이 많이 나오게)
    // 1~1000원: 90%, 1000~5000원: 9%, 5000~10000원: 1%
    let earned = 0;
    const r = Math.random() * 100;
    
    if (r < 90) { // 90% 확률
        earned = Math.floor(Math.random() * 1000) + 1;
    } else if (r < 99) { // 9% 확률
        earned = Math.floor(Math.random() * 4000) + 1001;
    } else { // 1% 확률
        earned = Math.floor(Math.random() * 5000) + 5001;
    }

    gameData.money += earned;
    document.getElementById("alba-result").innerText = `알바비 ${earned.toLocaleString()}원을 벌었습니다!`;
    updateUI();
    saveGame();
}

function startRace() {
    if (gameData.money < 10000) { customAlert("참가비가 부족합니다."); return; }
    
    confirmModal("참가비 10,000원을 내고 대회에 참가하시겠습니까?<br>(행동력 ⚡️1 소모)", () => {
         if (!useAction(1)) return; // 행동력 체크 및 소모

         gameData.money -= 10000;
         
         // 승패 로직 (이전과 동일)
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
         
         const resDiv = document.getElementById("race-result");
         resDiv.classList.remove("hidden");
         resDiv.innerHTML = `${rank}등!<br>상금: ${prizes[rank].toLocaleString()}원`;
         
         updateUI();
         saveGame();
    });
}


// --- 9. 유틸리티 (커스텀 알럿/컨펌) ---

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

// 게임 시작
initGame();
