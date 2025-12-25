// --- 1. 게임 데이터 및 설정 ---
const gameData = {
    day: 1,
    money: 20000, // 테스트용 넉넉한 초기 자금
    location: 'stable', // stable, outdoors, racetrack
    horse: {
        name: "초코",
        grade: "C", // 상한선: SS(100), S(90), A(80), B(70), C(60)
        
        // 상태 스탯 (마구간용)
        status: {
            hunger: 50,  // -20 ~ 120
            hygiene: 50, // 0 ~ 100
            mood: 50     // 0 ~ 100
        },
        
        // 기본 능력치 (베이스)
        baseStats: {
            stamina: 30,
            speed: 25,
            spirit: 20,
            charm: 15
        }
    },
    inventory: {} // { "item_id": count }
};

// 등급별 능력치 상한선
const MAX_STATS = { "SS": 100, "S": 90, "A": 80, "B": 70, "C": 60 };

// 아이템 목록 (DB 역할)
const ITEMS = {
    // 먹이
    "food_sugar": { name: "각설탕", price: 14000, type: "food", value: 15, desc: "포만감 +15" },
    "food_hay": { name: "건초", price: 9500, type: "food", value: 10, desc: "포만감 +10" },
    "food_carrot": { name: "당근", price: 9500, type: "food", value: 10, desc: "포만감 +10" },
    "food_feed": { name: "사료", price: 5000, type: "food", value: 5, desc: "포만감 +5" },
    // 장난감
    "toy_basic": { name: "기본 장난감", price: 5000, type: "toy", value: 10, desc: "기분 +10 (내구도 10)", maxDurability: 10 },
    "toy_fun": { name: "재밌는 장난감", price: 9500, type: "toy", value: 20, desc: "기분 +20 (내구도 20)", maxDurability: 20 },
    "toy_magic": { name: "신기한 장난감", price: 99000, type: "toy_random", desc: "기분 랜덤 대박?" },
    // 훈련도구
    "train_basic": { name: "기본 훈련도구", price: 5000, type: "train", stat: "stamina", value: 1, desc: "체력 +1" },
    "train_special": { name: "특수 훈련도구", price: 9500, type: "train", stat: "spirit", value: 1, desc: "기력 +1" },
    "train_magic": { name: "마법봉", price: 99000, type: "train_random", desc: "랜덤 스탯 변화" },
    // 케어도구
    "care_comb": { name: "기본 빗", price: 5000, type: "care", value: 5, desc: "위생 +5" },
    "care_comb_good": { name: "결 좋은 빗", price: 9500, type: "care", value: 10, desc: "위생 +10" },
    "care_magic": { name: "빗자루", price: 99000, type: "care_random", desc: "위생 랜덤 변화" },
    // 의약품
    "med_digest": { name: "홀스활명수", price: 10000, type: "med_digest", desc: "과식 치료 (배부름 100으로)" },
    "med_clean": { name: "말을씻자", price: 10000, type: "med_clean", desc: "위생 +50" },
    "med_oneshot": { name: "홀스원샷", price: 10000, type: "med_oneshot", desc: "랜덤 능력치 +5~20" }
};

// --- 2. 핵심 로직: 스탯 계산 및 컨디션 ---

function getConditionData() {
    const s = gameData.horse.status;
    
    // 1. 포만감 상태 판정
    let hungerState = "";
    let hungerMod = 0; // % 단위
    if (s.hunger <= -1) { hungerState = "굶주림"; hungerMod = -50; }
    else if (s.hunger <= 10) { hungerState = "매우 배고픔"; hungerMod = -10; }
    else if (s.hunger <= 30) { hungerState = "배고픔"; hungerMod = -5; }
    else if (s.hunger <= 50) { hungerState = "약간 배고픔"; hungerMod = 0; }
    else if (s.hunger <= 70) { hungerState = "약간 배부름"; hungerMod = 5; }
    else if (s.hunger <= 100) { hungerState = "배부름"; hungerMod = 10; }
    else { hungerState = "배 터짐"; hungerMod = -25; }

    // 2. 기분 상태 판정
    let moodState = "";
    let moodMod = 0;
    if (s.mood <= 20) { moodState = "우울함"; moodMod = -10; }
    else if (s.mood <= 40) { moodState = "슬픔"; moodMod = -5; }
    else if (s.mood <= 60) { moodState = "무난함"; moodMod = 0; }
    else if (s.mood <= 80) { moodState = "기분 좋음"; moodMod = 5; }
    else { moodState = "행복함"; moodMod = 10; }

    // 3. 컨디션 (종합) 계산: (포만감+위생+기분) / 3
    let conditionVal = (s.hunger + s.hygiene + s.mood) / 3;
    let conditionState = "";
    let conditionMod = 0; // 추가 너프/버프
    if (conditionVal <= 20) { conditionState = "매우 나쁨"; conditionMod = -10; }
    else if (conditionVal <= 40) { conditionState = "나쁨"; conditionMod = -5; }
    else if (conditionVal <= 60) { conditionState = "보통"; conditionMod = 0; }
    else if (conditionVal <= 80) { conditionState = "좋음"; conditionMod = 5; }
    else { conditionState = "매우 좋음"; conditionMod = 10; }

    // 총 변동률 (합연산)
    let totalMod = hungerMod + moodMod + conditionMod;

    return { hungerState, moodState, conditionState, totalMod };
}

function getEffectiveStats() {
    const { totalMod } = getConditionData();
    const base = gameData.horse.baseStats;
    
    // 비율 적용 함수 (소수점 반올림)
    const apply = (val) => Math.floor(val * (1 + totalMod / 100));

    return {
        stamina: apply(base.stamina),
        speed: apply(base.speed),
        spirit: apply(base.spirit),
        charm: apply(base.charm),
        modifierPercent: totalMod
    };
}

// --- 3. UI 업데이트 ---

function updateUI() {
    // 상단바
    document.getElementById("day-display").innerText = gameData.day + "일차";
    document.getElementById("money-display").innerText = gameData.money.toLocaleString() + " 원";

    // 스탯 패널
    const status = gameData.horse.status;
    const condData = getConditionData();
    const effStats = getEffectiveStats();

    // 상태 바 업데이트 (색상이나 너비)
    document.getElementById("bar-hunger").style.width = Math.max(0, Math.min(100, status.hunger)) + "%";
    document.getElementById("bar-hygiene").style.width = status.hygiene + "%";
    document.getElementById("bar-mood").style.width = status.mood + "%";
    document.getElementById("val-condition").innerText = condData.conditionState;

    // 능력치 업데이트 (버프/너프 색상 처리)
    const statKeys = ["stamina", "speed", "spirit", "charm"];
    statKeys.forEach(key => {
        const el = document.getElementById("val-" + key);
        const baseVal = gameData.horse.baseStats[key];
        const effVal = effStats[key];
        el.innerText = effVal;

        // 색상 클래스 초기화
        el.className = ""; 
        if (effVal > baseVal) el.classList.add("buff");
        else if (effVal < baseVal) el.classList.add("nerf");
    });
    
    // 경마장 확률 미리보기
    updateRaceProbUI(effStats);
}

// 스탯 보기 전환 토글
let isStatViewMode = false; // false: 상태(Condition), true: 능력치(Ability)
function toggleStatView() {
    // 장소에 따른 강제 설정이 우선이지만, 유저가 토글 누르면 바뀜
    isStatViewMode = !isStatViewMode;
    renderStatView();
}

function renderStatView() {
    const btnText = document.getElementById("stat-view-mode");
    const divStatus = document.getElementById("stat-status");
    const divAbility = document.getElementById("stat-ability");

    if (isStatViewMode) {
        btnText.innerText = "능력치 보기";
        divStatus.classList.add("hidden");
        divAbility.classList.remove("hidden");
    } else {
        btnText.innerText = "상태 보기";
        divStatus.classList.remove("hidden");
        divAbility.classList.add("hidden");
    }
}

// 장소 변경
function changeLocation(loc) {
    gameData.location = loc;
    
    // 탭 스타일
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + loc).classList.add('active');

    // 화면 전환
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + loc).classList.add('active');

    // 장소별 기본 스탯 뷰 설정
    if (loc === 'stable') {
        isStatViewMode = false; // 마구간은 상태 위주
        showMessage("집이 최고야!");
    } else {
        isStatViewMode = true; // 밖에서는 능력치 위주
        if (loc === 'outdoors') {
            renderShop();
            showMessage("무엇을 살까?");
        } else {
            showMessage("떨린다... 우승할 수 있을까?");
        }
    }
    renderStatView();
}

function showMessage(msg) {
    document.getElementById("message-bubble").innerText = msg;
}

// --- 4. 상점 및 인벤토리 시스템 ---

function renderShop() {
    const list = document.getElementById("shop-list");
    list.innerHTML = "";
    for (let key in ITEMS) {
        const item = ITEMS[key];
        const div = document.createElement("div");
        div.className = "item-card";
        div.innerHTML = `
            <span class="item-name">${item.name}</span>
            <span class="item-price">${item.price.toLocaleString()}원</span><br>
            <span style="color:#7f8c8d">${item.desc}</span>
        `;
        div.onclick = () => buyItem(key);
        list.appendChild(div);
    }
}

function buyItem(key) {
    const item = ITEMS[key];
    if (gameData.money < item.price) {
        alert("돈이 부족합니다!");
        return;
    }
    
    // 인벤토리 개수 체크 (99개 제한)
    const currentCount = gameData.inventory[key] || 0;
    if (currentCount >= 99) {
        alert("더 이상 소지할 수 없습니다.");
        return;
    }

    gameData.money -= item.price;
    gameData.inventory[key] = currentCount + 1;
    updateUI();
    renderInventory(); // 인벤토리 갱신
    alert(`${item.name} 구매 완료!`);
}

function renderInventory() {
    const list = document.getElementById("inventory-list");
    list.innerHTML = "";
    
    if (Object.keys(gameData.inventory).length === 0) {
        list.innerHTML = '<div class="empty-msg">아이템이 없습니다.</div>';
        return;
    }

    for (let key in gameData.inventory) {
        if (gameData.inventory[key] > 0) {
            const item = ITEMS[key];
            const div = document.createElement("div");
            div.className = "item-card";
            div.innerHTML = `
                <span class="item-name">${item.name}</span>
                <span class="item-count">x${gameData.inventory[key]}</span><br>
                <span style="color:#7f8c8d">${item.desc}</span>
            `;
            div.onclick = () => useItem(key);
            list.appendChild(div);
        }
    }
}

function useItem(key) {
    if (gameData.location !== 'stable') {
        alert("아이템은 마구간에서만 사용할 수 있습니다.");
        return;
    }

    const item = ITEMS[key];
    const s = gameData.horse.status;
    const base = gameData.horse.baseStats;

    // 아이템 효과 로직
    let used = true;
    let msg = "";

    // 1. 먹이
    if (item.type === "food") {
        if (s.hunger > 100) { alert("배가 불러서 못 먹어요!"); return; } // 과식 방지
        s.hunger += item.value;
        msg = "냠냠! 맛있다!";
    }
    // 2. 장난감
    else if (item.type === "toy") {
        s.mood = Math.min(100, s.mood + item.value);
        msg = "우와 재밌다!";
    }
    else if (item.type === "toy_random") {
        // 신기한 장난감 (-50 ~ +100)
        let val = Math.floor(Math.random() * 151) - 50; 
        s.mood = Math.min(100, Math.max(0, s.mood + val));
        msg = val > 0 ? "대박! 너무 재밌어!" : "음... 별로야.";
    }
    // 3. 훈련도구
    else if (item.type === "train") {
        base[item.stat] = Math.min(MAX_STATS[gameData.horse.grade], base[item.stat] + item.value);
        msg = "훈련 완료!";
    }
    else if (item.type === "train_random") {
        // 마법봉: 랜덤 스탯 변동
        const stats = ["stamina", "speed", "spirit", "charm"];
        const target = stats[Math.floor(Math.random() * stats.length)];
        const val = Math.floor(Math.random() * 71) - 20; // -20 ~ 50
        base[target] = Math.max(0, Math.min(MAX_STATS[gameData.horse.grade], base[target] + val));
        msg = `마법봉 휘두르기! ${target} 수치가 변했다!`;
    }
    // 4. 케어도구
    else if (item.type === "care") {
        s.hygiene = Math.min(100, s.hygiene + item.value);
        msg = "깔끔해졌어!";
    }
    else if (item.type === "care_random") {
        // 빗자루
        let val = Math.floor(Math.random() * 71) - 20; 
        s.hygiene += val;
        if(s.hygiene < 0) {
            s.mood += val; // 위생 마이너스면 기분도 나빠짐
            s.hygiene = 0;
        }
        s.hygiene = Math.min(100, s.hygiene);
        msg = "빗자루질 쓱싹쓱싹";
    }
    // 5. 의약품
    else if (item.type === "med_digest") {
        if (s.hunger <= 100) { alert("소화제가 필요 없어요."); return; }
        s.hunger = 100;
        msg = "속이 편안해졌어.";
    }
    else if (item.type === "med_clean") {
        s.hygiene = Math.min(100, s.hygiene + 50);
        msg = "반짝반짝해졌어!";
    }
    else if (item.type === "med_oneshot") {
        const stats = ["stamina", "speed", "spirit", "charm"];
        const target = stats[Math.floor(Math.random() * stats.length)];
        const val = Math.floor(Math.random() * 16) + 5; // 5~20
        base[target] = Math.min(MAX_STATS[gameData.horse.grade], base[target] + val);
        msg = `힘이 솟는다! ${target} +${val}`;
    }

    if (used) {
        gameData.inventory[key]--;
        if (gameData.inventory[key] <= 0) delete gameData.inventory[key];
        showMessage(msg);
        updateUI();
        renderInventory();
    }
}


// --- 5. 경마 시스템 ---

function updateRaceProbUI(effStats) {
    // 확률 계산: 1% + 체력10% + 기력10% + 속도20% + 매력5%
    let prob = 1 + (effStats.stamina * 0.1) + (effStats.spirit * 0.1) + (effStats.speed * 0.2) + (effStats.charm * 0.05);
    // UI에는 최대 100%까지만 표시
    document.getElementById("win-prob").innerText = "예상 우승 확률: " + prob.toFixed(1) + "%";
}

function startRace() {
    if (gameData.money < 10000) {
        alert("참가비(10,000원)가 부족합니다.");
        return;
    }
    
    // 조건 체크 (배부름 101~120 or 매우 나쁨 상태 등)
    const cond = getConditionData();
    if (gameData.horse.status.hunger > 100) { alert("배가 너무 불러서 뛸 수 없어요!"); return; }
    if (cond.conditionState === "매우 나쁨") { alert("컨디션 최악이라 출전 불가!"); return; }

    gameData.money -= 10000;
    
    const effStats = getEffectiveStats();
    let winProb = 1 + (effStats.stamina * 0.1) + (effStats.spirit * 0.1) + (effStats.speed * 0.2) + (effStats.charm * 0.05);
    
    // 경주 결과 시뮬레이션
    let rank = 1;
    let isFinished = false;

    // 1등부터 8등까지 순차 체크
    while (!isFinished && rank <= 8) {
        let roll = Math.random() * 100; // 0 ~ 99.99
        if (roll < winProb) {
            isFinished = true; // 해당 등수 당첨
        } else {
            rank++;
            winProb += 1; // 실패할 때마다 다음 등수 확률 1% 증가 (기획 반영)
        }
    }
    if (rank > 8) rank = 8; // 8등 밖은 8등 처리

    // 상금 지급
    const prizes = [0, 1000000, 500000, 100000, 50000, 10000, 5000, 3000, 1000];
    const prize = prizes[rank];
    gameData.money += prize;

    // 결과 표시
    const resDiv = document.getElementById("race-result");
    resDiv.classList.remove("hidden");
    resDiv.innerHTML = `${rank}등!<br>상금: ${prize.toLocaleString()}원 획득!`;
    
    updateUI();
}

// --- 6. 시간 경과 (패시브) 시스템 ---

// 현실 시간 기반 스탯 감소 (단순화를 위해 setInterval 사용)
// 5분 = 300,000ms, 10분 = 600,000ms
// 테스트를 위해 시간을 좀 빠르게 돌릴까요? (일단 요청하신대로 5분/10분 로직 작성)
// **주의: 브라우저 끄면 초기화됨 (저장 기능 없어서)**

setInterval(() => {
    // 5분마다 포만감 -1
    gameData.horse.status.hunger -= 1;
    updateUI();
}, 300000); // 5분

setInterval(() => {
    // 10분마다 위생 -1, 기분 -1
    gameData.horse.status.hygiene = Math.max(0, gameData.horse.status.hygiene - 1);
    gameData.horse.status.mood = Math.max(0, gameData.horse.status.mood - 1);
    updateUI();
}, 600000); // 10분


// 초기 실행
renderInventory();
updateUI();
renderStatView();
