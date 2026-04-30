import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCAbsbazApKPtfYukYdH93Q3pm7_fqQePU",
    authDomain: "pansergiitap.firebaseapp.com",
    projectId: "pansergiitap",
    storageBucket: "pansergiitap.firebasestorage.app",
    messagingSenderId: "598054840627",
    appId: "1:598054840627:web:5f846673fb49bc6bb17646"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Telegram
const tg = window.Telegram?.WebApp;
let telegramUser = null;
if (tg) {
    tg.ready();
    tg.expand();
    telegramUser = tg.initDataUnsafe?.user || null;
    if (tg.themeParams?.bg_color) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
    }
}

const userId = telegramUser?.id?.toString() || 'dev_' + (localStorage.getItem('devUserId') || (() => {
    const id = Math.random().toString(36).slice(2);
    localStorage.setItem('devUserId', id);
    return id;
})());

// ─── Доступ ────────────────────────────────────────────────────────────────────
const ALLOWED_USERS = ['dankaklytoii', 'Poderskaserjiitap'];
const isAllowed = ALLOWED_USERS.includes(telegramUser?.username);

function showMaintenance() {
    document.getElementById('loading-screen').style.display = 'none';
    
    const maintenance = document.createElement('div');
    maintenance.id = 'maintenance-screen';
    maintenance.innerHTML = `
        <div class="maintenance-container">
            <div class="maintenance-icon">🔧</div>
            <h1 class="maintenance-title">Технічні роботи</h1>
            <p class="maintenance-text">
                Ми активно працюємо над покращенням гри!<br>
                Незабаром все запрацює знову 🚀
            </p>
            <div class="maintenance-timer">Очікуйте оновлення...</div>
            <button class="maintenance-news-btn" onclick="showMaintenanceNews()">
                📰 Новини
            </button>
        </div>

        <!-- Новини (приховані) -->
        <div id="maintenance-news" style="display:none">
            <div class="maintenance-news-header">
                <button class="maintenance-back-btn" onclick="hideMaintenanceNews()">← Назад</button>
                <h2>📰 Новини</h2>
            </div>
            <div class="maintenance-news-list">
                <div class="news-card">
                    <div class="news-date">29 Квітня 2026</div>
                    <h3 class="news-title">🔧 Технічні роботи</h3>
                    <p class="news-content">
                        Зараз ми активно виправляємо баги та додаємо нові функції:<br><br>
                        🎰 <strong>Система кейсів</strong> з анімацією рулетки<br>
                        🎨 <strong>Теми вчителів</strong><br>
                        💎 <strong>Система досягнень</strong><br>
                        🔄 <strong>Покращене збереження</strong><br><br>
                        Дякуємо за терпіння! 🙏
                    </p>
                    <span class="news-badge">ТЕХНІЧНІ РОБОТИ</span>
                </div>
                <div class="news-card compensation-card">
                    <div class="news-date">29 Квітня 2026</div>
                    <h3 class="news-title">🎁 Компенсація за баги</h3>
                    <p class="news-content">
                        Вибачте за проблеми зі збереженням! Після відновлення роботи 
                        отримайте <strong>5,000,000 очок</strong> як компенсацію!
                    </p>
                    <span class="news-badge">КОМПЕНСАЦІЯ</span>
                </div>
                <div class="news-card">
                    <div class="news-date">26 Квітня 2026</div>
                    <h3 class="news-title">🎉 Версія 1.5 — Telegram Mini App!</h3>
                    <p class="news-content">
                        Гра перенесена в Telegram! Прогрес зберігається в хмарі Firebase.
                    </p>
                    <span class="news-badge">НОВА ВЕРСІЯ</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(maintenance);
}

window.showMaintenanceNews = function() {
    document.querySelector('.maintenance-container').style.display = 'none';
    document.getElementById('maintenance-news').style.display = 'block';
};

window.hideMaintenanceNews = function() {
    document.querySelector('.maintenance-container').style.display = 'flex';
    document.getElementById('maintenance-news').style.display = 'none';
};

// === СТАН ГРИ ===
let score = 0;
let clickValue = 1;
let autoClickValue = 0;
let level = 1;
let purchasedUpgrades = {};
let purchasedAccessories = {};
let currentAccessoryId = null;
let totalClicks = 0;
let totalEarned = 0;
let secretCardsFound = 0;
let fragments = { standard:0, rare:0, smart:0, diamond:0, competitive:0, strange:0 };
let currentTheme = 'default';

// === ЕНЕРГІЯ ===
const MAX_ENERGY = 100;
const ENERGY_REGEN_PER_SEC = MAX_ENERGY / (3 * 3600); // 100 за 3 години
let energy = MAX_ENERGY;
let lastEnergyUpdate = Date.now();

// === DOM ===
const scoreDisplay      = document.getElementById('score');
const levelDisplay      = document.getElementById('level');
const clickValueDisplay = document.getElementById('click-value');
const autoClickDisplay  = document.getElementById('auto-click-value');
const mainCharacter     = document.getElementById('main-character');
const upgradesGrid      = document.getElementById('upgrades-grid');
const accessoriesGrid   = document.getElementById('accessories-grid');
const loadingScreen     = document.getElementById('loading-screen');
const appDiv            = document.getElementById('app');
const profileName       = document.getElementById('profile-name');
const totalClicksEl     = document.getElementById('total-clicks');
const totalEarnedEl     = document.getElementById('total-earned');
const navItems          = document.querySelectorAll('.nav-item');
const tabContents       = document.querySelectorAll('.tab-content');

// === ДАНІ ===
const levels = [
    { threshold: 5000,  rewardId: 'acc-hat',     message: 'Вітаємо! Рівень 2 — отримуєте шляпу!' },
    { threshold: 10000, rewardId: 'acc-glasses',  message: 'Неймовірно! Рівень 3 — стильні окуляри!' },
    { threshold: 20000, rewardId: 'acc-gold-hat', message: 'Майстер! Рівень 4 — золота шляпа!' },
    { threshold: 50000, rewardId: 'acc-crown',    message: 'Велич! Рівень 5 — корона!' }
];

const upgrades = [
    { id:'upgrade-click-1',    name:'Покращений клік',   description:'+1 очко за клік',   value:1,   cost:100,   type:'click' },
    { id:'upgrade-auto-1',     name:'Мураха-робітник',   description:'+1 очко/сек',        value:1,   cost:500,   type:'auto'  },
    { id:'upgrade-click-2',    name:'Сильний клік',      description:'+3 очка за клік',    value:3,   cost:1000,  type:'click' },
    { id:'upgrade-auto-2',     name:'Маленька ферма',    description:'+5 очок/сек',        value:5,   cost:2000,  type:'auto'  },
    { id:'upgrade-click-3',    name:'Кулак Сергія',      description:'+10 очок за клік',   value:10,  cost:5000,  type:'click' },
    { id:'upgrade-auto-3',     name:'Королівство',       description:'+20 очок/сек',       value:20,  cost:10000, type:'auto'  },
    { id:'upgrade-word-of-god',name:'Слово Пана Сергія', description:'+500 оч. за клік',   value:500, cost:50000, type:'click' },
    { id:'upgrade-secret-1',   name:'Секретна сила',     description:'+100 оч./сек',       value:100, cost:0,     type:'auto', secret:true }
];

const allAccessories = {
    'acc-hat':      { id:'acc-hat',      name:'Шляпа',        className:'accessory-hat'      },
    'acc-glasses':  { id:'acc-glasses',  name:'Окуляри',      className:'accessory-glasses'  },
    'acc-gold-hat': { id:'acc-gold-hat', name:'Золота шляпа', className:'accessory-gold-hat' },
    'acc-crown':    { id:'acc-crown',    name:'Корона',       className:'accessory-crown'    }
};

// === ЗБЕРЕЖЕННЯ ===
function getGameData() {
    return {
        score, clickValue, autoClickValue, level,
        purchasedUpgrades, purchasedAccessories, currentAccessoryId,
        totalClicks, totalEarned, secretCardsFound, fragments, currentTheme,
        energy, lastEnergyUpdate,
        lastSaved: Date.now()
    };
}

function applyGameData(d) {
    score               = d.score               ?? 0;
    clickValue          = d.clickValue          ?? 1;
    autoClickValue      = d.autoClickValue      ?? 0;
    level               = d.level               ?? 1;
    purchasedUpgrades   = d.purchasedUpgrades   ?? {};
    purchasedAccessories= d.purchasedAccessories?? {};
    currentAccessoryId  = d.currentAccessoryId  ?? null;
    totalClicks         = d.totalClicks         ?? 0;
    totalEarned         = d.totalEarned         ?? 0;
    secretCardsFound    = d.secretCardsFound    ?? 0;
    fragments           = d.fragments           ?? { standard:0, rare:0, smart:0, diamond:0, competitive:0, strange:0 };
    currentTheme        = d.currentTheme        ?? 'default';
    energy              = d.energy              ?? MAX_ENERGY;
    lastEnergyUpdate    = d.lastEnergyUpdate    ?? Date.now();
}

function saveToLocal() {
    try {
        localStorage.setItem('serhiyGameSave', JSON.stringify(getGameData()));
    } catch(e) { console.error('localStorage save error:', e); }
}

function loadFromLocal() {
    try {
        const raw = localStorage.getItem('serhiyGameSave');
        if (!raw) return false;
        applyGameData(JSON.parse(raw));
        console.log('Loaded from localStorage:', score);
        return true;
    } catch(e) { return false; }
}

// Зберегти в Firebase ОДИН РАЗ при вході (не при кожному кліку)
let firebaseBlocked = false;

async function syncToFirebase() {
    if (firebaseBlocked) {
        console.warn('⚠️ Firebase заблоковано (квота), пропускаємо');
        return;
    }
    try {
        const ref = doc(db, 'players', userId);
        await setDoc(ref, {
            ...getGameData(),
            updatedAt: new Date().toISOString(),
            telegramUser: telegramUser ? {
                id: telegramUser.id,
                username: telegramUser.username || '',
                firstName: telegramUser.first_name || '',
                photoUrl: telegramUser.photo_url || ''
            } : null
        });
        console.log('✅ Synced to Firebase:', score);
    } catch(e) {
        if (e.code === 'resource-exhausted') {
            firebaseBlocked = true;
            console.warn('⚠️ Firebase квота вичерпана. Тільки localStorage до завтра.');
            // Розблокувати через 1 годину
            setTimeout(() => { firebaseBlocked = false; }, 60 * 60 * 1000);
        } else {
            console.error('Firebase sync error:', e);
        }
    }
}

async function loadFromFirebase() {
    try {
        const ref = doc(db, 'players', userId);
        const snap = await getDoc(ref);

        const localRaw = localStorage.getItem('serhiyGameSave');
        const localData = localRaw ? JSON.parse(localRaw) : null;

        if (snap.exists()) {
            const fbData = snap.data();
            const fbScore = fbData.score ?? 0;
            const localScore = localData?.score ?? 0;

            // Беремо дані з більшим прогресом
            if (localScore > fbScore) {
                console.log('Local is ahead, using local + syncing to Firebase');
                applyGameData(localData);
                await syncToFirebase(); // Завантажити локальне в Firebase
            } else {
                console.log('Firebase is ahead, using Firebase');
                applyGameData(fbData);
                saveToLocal();
            }
        } else {
            // Немає в Firebase — завантажити з localStorage і синхронізувати
            if (localData) {
                console.log('No Firebase data, uploading local data');
                applyGameData(localData);
            }
            await syncToFirebase();
        }
    } catch(e) {
        console.error('Firebase load error:', e);
        loadFromLocal();
    }
}

// === ОФЛАЙН АВТОФАРМ (макс 2 години) ===
function applyOfflineFarm() {
    const now = Date.now();
    const lastSaved = parseInt(localStorage.getItem('lastOnlineTime') || now);
    const offlineSeconds = Math.min((now - lastSaved) / 1000, 2 * 3600); // макс 2 год

    if (offlineSeconds > 60 && autoClickValue > 0) {
        const earned = Math.floor(offlineSeconds * autoClickValue);
        score += earned;
        totalEarned += earned;
        console.log('Offline farm:', earned, 'for', Math.floor(offlineSeconds), 'sec');

        // Показати повідомлення
        setTimeout(() => {
            alert(`Поки вас не було (${Math.floor(offlineSeconds/60)} хв), автофарм заробив +${earned.toLocaleString()} очок!`);
        }, 1500);
    }
    localStorage.setItem('lastOnlineTime', now);
}

// === ЕНЕРГІЯ ===
function calcEnergyRegen() {
    const now = Date.now();
    const elapsed = (now - lastEnergyUpdate) / 1000;
    const regen = elapsed * ENERGY_REGEN_PER_SEC;
    energy = Math.min(MAX_ENERGY, energy + regen);
    lastEnergyUpdate = now;
}

function renderEnergy() {
    const pct = (energy / MAX_ENERGY) * 100;
    const bar = document.getElementById('energy-bar-fill');
    const txt = document.getElementById('energy-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = Math.floor(energy) + ' / ' + MAX_ENERGY;

    // Колір бару
    if (bar) {
        if (pct > 60) bar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
        else if (pct > 30) bar.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
        else bar.style.background = 'linear-gradient(90deg, #f44336, #FF5722)';
    }
}

// Регенерація енергії кожну секунду
setInterval(() => {
    calcEnergyRegen();
    renderEnergy();
    saveToLocal();
}, 1000);

// === АВТОФАРМ (локальний) ===
setInterval(() => {
    if (autoClickValue > 0) {
        score += autoClickValue;
        totalEarned += autoClickValue;
        updateUI();
        updateLevelAndCheckReward();
        saveToLocal();
    }
}, 1000);

// === ТАП ===
function onTap(e) {
    e.preventDefault();

    calcEnergyRegen();
    if (energy < 1) {
        // Немає енергії
        const bar = document.getElementById('energy-bar-fill');
        if (bar) {
            bar.style.animation = 'shake 0.3s';
            setTimeout(() => bar.style.animation = '', 300);
        }
        return;
    }

    energy = Math.max(0, energy - 1);
    lastEnergyUpdate = Date.now();
    renderEnergy();

    score += clickValue;
    totalClicks++;
    totalEarned += clickValue;
    updateUI();
    updateLevelAndCheckReward();
    saveToLocal();

    // Анімація +N
    const popup = document.createElement('div');
    popup.className = 'click-popup';
    popup.textContent = '+' + clickValue;
    const rect = mainCharacter.getBoundingClientRect();
    const cx = e.clientX || (e.touches && e.touches[0].clientX) || rect.left + rect.width/2;
    const cy = e.clientY || (e.touches && e.touches[0].clientY) || rect.top + rect.height/2;
    popup.style.left = (cx - rect.left) + 'px';
    popup.style.top  = (cy - rect.top)  + 'px';
    mainCharacter.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

if (mainCharacter) {
    mainCharacter.addEventListener('pointerdown', onTap);
    mainCharacter.addEventListener('touchstart', onTap, { passive: false });
}

// === UI ===
function updateUI() {
    scoreDisplay.textContent      = Math.floor(score).toLocaleString();
    clickValueDisplay.textContent = clickValue.toLocaleString();
    autoClickDisplay.textContent  = autoClickValue.toLocaleString();
    levelDisplay.textContent      = level;
    if (totalClicksEl) totalClicksEl.textContent = totalClicks.toLocaleString();
    if (totalEarnedEl) totalEarnedEl.textContent = Math.floor(totalEarned).toLocaleString();

    const plvl = document.getElementById('profile-level');
    const psec = document.getElementById('profile-secrets');
    if (plvl) plvl.textContent = level;
    if (psec) psec.textContent = secretCardsFound + '/5';

    if (telegramUser) {
        if (profileName) profileName.textContent = telegramUser.first_name || telegramUser.username || 'Гравець';
        const uEl = document.getElementById('profile-username');
        if (uEl && telegramUser.username) uEl.textContent = '@' + telegramUser.username;
        if (telegramUser.photo_url) {
            const img = document.getElementById('profile-avatar-img');
            const em  = document.getElementById('profile-avatar-emoji');
            if (img) { img.src = telegramUser.photo_url; img.style.display = 'block'; }
            if (em)  em.style.display = 'none';
        }
    }

    updateSecretCardsCounter();
    updateFragmentsDisplay();
    updateButtonStates();
    renderEnergy();
}

function updateSecretCardsCounter() {
    let c = document.getElementById('secret-cards-counter');
    if (!c) {
        c = document.createElement('div');
        c.id = 'secret-cards-counter';
        c.className = 'secret-cards-counter';
        document.body.appendChild(c);
    }
    c.textContent = 'Знайдено: ' + secretCardsFound + '/5';
    c.style.display = secretCardsFound >= 5 ? 'none' : 'block';
}

function updateFragmentsDisplay() {
    Object.keys(fragments).forEach(type => {
        const el = document.getElementById('fragment-' + type);
        if (el) el.textContent = fragments[type];
    });
}

function updateLevelAndCheckReward() {
    let newLevel = 1;
    for (let i = 0; i < levels.length; i++) {
        if (score >= levels[i].threshold) newLevel = i + 2;
    }
    if (newLevel > level) {
        level = newLevel;
        const info = levels[level - 2];
        alert(info.message);
        purchasedAccessories[info.rewardId] = true;
        toggleAccessory(allAccessories[info.rewardId]);
        updateButtonStates();
        saveToLocal();
    }
}

// === МАГАЗИН ===
function generateShopItems(items, container) {
    container.innerHTML = '';
    items.forEach(item => {
        if (item.secret && !purchasedUpgrades[item.id]) return;
        const div = document.createElement('div');
        div.className = 'shop-item';
        const priceText = item.cost > 0 ? item.cost.toLocaleString() + ' очок' : 'БЕЗКОШТОВНО';
        div.innerHTML = '<div class="shop-item-info"><h3>' + (item.name||'Предмет') + '</h3><p>' + (item.description||'') + '</p><div class="shop-item-price">' + priceText + '</div></div><button class="shop-button" data-id="' + item.id + '" data-cost="' + (item.cost||0) + '">Купити</button>';
        container.appendChild(div);
    });
}

function updateButtonStates() {
    document.querySelectorAll('.shop-button').forEach(btn => {
        const id   = btn.dataset.id;
        const cost = parseInt(btn.dataset.cost);
        const isAcc = allAccessories[id] !== undefined;
        if (isAcc) {
            if (purchasedAccessories[id]) {
                btn.textContent = currentAccessoryId === id ? 'Зняти' : 'Надіти';
                btn.disabled = false;
            } else {
                btn.textContent = 'Нагорода';
                btn.disabled = true;
            }
        } else {
            if (purchasedUpgrades[id]) {
                btn.textContent = 'Куплено';
                btn.disabled = true;
            } else {
                btn.textContent = cost > 0 ? 'Купити' : 'Отримати';
                btn.disabled = cost > 0 && score < cost;
            }
        }
    });
}

document.addEventListener('click', e => {
    const btn = e.target.closest('.shop-button');
    if (!btn) return;
    const id = btn.dataset.id;
    const upgrade = upgrades.find(u => u.id === id);
    const accessory = allAccessories[id];
    if (upgrade && !purchasedUpgrades[id] && score >= upgrade.cost) {
        score -= upgrade.cost;
        purchasedUpgrades[id] = true;
        if (upgrade.type === 'click') clickValue += upgrade.value;
        else autoClickValue += upgrade.value;
        updateUI();
        saveToLocal();
    } else if (accessory && purchasedAccessories[id]) {
        toggleAccessory(accessory);
        updateButtonStates();
        saveToLocal();
    }
});

function toggleAccessory(accessory) {
    const ex = mainCharacter.querySelector('.accessory');
    if (ex) ex.remove();
    if (currentAccessoryId === accessory.id) {
        currentAccessoryId = null;
    } else {
        const el = document.createElement('div');
        el.className = 'accessory ' + accessory.className;
        mainCharacter.appendChild(el);
        currentAccessoryId = accessory.id;
    }
}

// === НАВІГАЦІЯ ===
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(t => t.classList.remove('active'));
            const tab = document.getElementById('tab-' + tabId);
            if (tab) tab.classList.add('active');
            if (tabId === 'leaderboard') loadLeaderboard();
        });
    });
}

// === ЛІДЕРБОРД ===
async function loadLeaderboard() {
    try {
        const { collection, query, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const q = query(collection(db, 'players'), orderBy('score', 'desc'), limit(50));
        const snap = await getDocs(q);
        const players = [];
        snap.forEach(d => players.push({ id: d.id, ...d.data() }));

        const podiumPlaces = document.querySelectorAll('.podium-place');
        const podiumOrder = [1, 0, 2];
        podiumOrder.forEach((idx, pi) => {
            const place = podiumPlaces[pi];
            const player = players[idx];
            if (!place || !player) return;
            const avatarImg = place.querySelector('.podium-avatar-img');
            const avatarEmoji = place.querySelector('.podium-avatar-emoji');
            place.querySelector('.podium-name').textContent = player.telegramUser?.firstName || player.telegramUser?.username || 'Гравець';
            place.querySelector('.podium-score').textContent = Math.floor(player.score||0).toLocaleString();
            if (player.telegramUser?.photoUrl) {
                avatarImg.src = player.telegramUser.photoUrl;
                avatarImg.style.display = 'block';
                avatarEmoji.style.display = 'none';
            }
        });

        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        for (let i = 3; i < players.length; i++) {
            const p = players[i];
            const isCurrent = p.id === userId;
            const name = p.telegramUser?.firstName || p.telegramUser?.username || 'Гравець';
            const avatarHTML = p.telegramUser?.photoUrl
                ? '<div class="leaderboard-avatar"><img src="' + p.telegramUser.photoUrl + '" /></div>'
                : '<div class="leaderboard-avatar"><span class="leaderboard-avatar-emoji">👤</span></div>';
            const item = document.createElement('div');
            item.className = 'leaderboard-item' + (isCurrent ? ' current-user' : '');
            item.innerHTML = '<span class="rank">' + (i+1) + '</span>' + avatarHTML + '<span class="player-name">' + name + (isCurrent?' (Ви)':'') + '</span><span class="player-score">' + Math.floor(p.score||0).toLocaleString() + '</span>';
            list.appendChild(item);
        }
        if (players.length <= 3) list.innerHTML = '<div class="no-data">Поки що немає інших гравців</div>';
    } catch(e) {
        console.error('Leaderboard error:', e);
        document.getElementById('leaderboard-list').innerHTML = '<div class="no-data">Помилка завантаження</div>';
    }
}

// === СЕКРЕТНІ КАРТОЧКИ ===
function spawnSecretCard() {
    if (document.querySelector('.secret-card')) return;
    if (secretCardsFound >= 5) return;
    const card = document.createElement('div');
    card.className = 'secret-card';
    card.textContent = '🎁';
    card.style.left = Math.random() * (window.innerWidth - 60) + 'px';
    card.style.top  = (Math.random() * (window.innerHeight - 160) + 60) + 'px';
    document.body.appendChild(card);
    const timer = setTimeout(() => { if (card.parentNode) card.remove(); }, 5000);
    card.addEventListener('click', () => {
        clearTimeout(timer);
        secretCardsFound++;
        if (secretCardsFound === 1 && !purchasedUpgrades['upgrade-secret-1']) {
            purchasedUpgrades['upgrade-secret-1'] = true;
            autoClickValue += 100;
            alert('Перша секретна карточка!\n+100 очок за секунду назавжди!');
            generateShopItems(upgrades, upgradesGrid);
        } else if (secretCardsFound <= 5) {
            score += 1000;
            alert('Секретна карточка ' + secretCardsFound + '/5!\n+1000 очок!');
        }
        if (secretCardsFound >= 5) alert('Ви знайшли всі 5 секретних карточок!');
        updateUI();
        saveToLocal();
        card.remove();
    });
}

setInterval(() => {
    if (secretCardsFound < 5 && Math.random() < 0.3) spawnSecretCard();
}, 45000);

// === ОСНОВАТЕЛЬ ===
function checkFounderAccess() {
    if (telegramUser?.username === 'dankaklytoii') {
        const nav = document.getElementById('founder-nav');
        if (nav) nav.style.display = 'flex';
    }
}

window.giveCoins = () => { score += 10000; updateUI(); saveToLocal(); alert('+10,000 очок!'); };
window.unlockAll = () => {
    upgrades.forEach(u => {
        if (!purchasedUpgrades[u.id]) {
            purchasedUpgrades[u.id] = true;
            if (u.type === 'click') clickValue += u.value;
            else autoClickValue += u.value;
        }
    });
    Object.keys(allAccessories).forEach(id => { purchasedAccessories[id] = true; });
    updateUI(); saveToLocal(); alert('Все розблоковано!');
};
window.resetProgress = () => {
    if (confirm('Видалити весь прогрес?')) { localStorage.clear(); location.reload(); }
};
window.spawnSecretCard = spawnSecretCard;

window.claimCompensation = async () => {
    if (localStorage.getItem('compensationClaimed') === 'true') { alert('Ви вже отримали компенсацію!'); return; }
    score += 5000000;
    totalEarned += 5000000;
    localStorage.setItem('compensationClaimed', 'true');
    updateUI();
    saveToLocal();
    await syncToFirebase();
    const btn = document.getElementById('claim-compensation');
    if (btn) { btn.textContent = 'Отримано!'; btn.disabled = true; btn.style.background = '#4CAF50'; }
    alert('Ви отримали 5,000,000 очок як компенсацію!');
};

window.manualSave = async () => {
    const btn = document.querySelector('.manual-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Зберігаємо...'; }
    saveToLocal();
    await syncToFirebase();
    if (btn) {
        btn.textContent = 'Збережено!';
        btn.style.background = '#4CAF50';
        setTimeout(() => { btn.textContent = 'Зберегти прогрес зараз'; btn.style.background = ''; btn.disabled = false; }, 2000);
    }
};

// === ІНІЦІАЛІЗАЦІЯ ===
async function init() {
    // Перевірка доступу — тільки для dankaklytoii і Poderskaserjiitap
    if (!isAllowed) {
        showMaintenance();
        return;
    }

    // 1. Завантажити з Firebase (порівняє з localStorage і візьме кращий)
    await loadFromFirebase();

    // 2. Офлайн автофарм
    applyOfflineFarm();

    // 3. Відновити енергію за час відсутності
    calcEnergyRegen();

    checkFounderAccess();
    setupNavigation();
    generateShopItems(upgrades, upgradesGrid);
    generateShopItems(Object.values(allAccessories), accessoriesGrid);

    if (currentAccessoryId && allAccessories[currentAccessoryId]) {
        const el = document.createElement('div');
        el.className = 'accessory ' + allAccessories[currentAccessoryId].className;
        mainCharacter.appendChild(el);
    }

    // Компенсація
    if (localStorage.getItem('compensationClaimed') === 'true') {
        const btn = document.getElementById('claim-compensation');
        if (btn) { btn.textContent = 'Отримано!'; btn.disabled = true; btn.style.background = '#4CAF50'; }
    }

    updateUI();
    loadingScreen.style.display = 'none';
    appDiv.style.display = 'block';

    if (secretCardsFound < 5) setTimeout(spawnSecretCard, 10000);

    // Зберегти час виходу
    window.addEventListener('beforeunload', () => {
        localStorage.setItem('lastOnlineTime', Date.now());
        saveToLocal();
    });

    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            localStorage.setItem('lastOnlineTime', Date.now());
            saveToLocal();
            // Синхронізувати в Firebase при виході (1 запит)
            await syncToFirebase();
        } else {
            // При поверненні - перевірити офлайн фарм
            applyOfflineFarm();
            calcEnergyRegen();
            updateUI();
        }
    });

    // Синхронізація в Firebase раз на 5 хвилин
    setInterval(async () => {
        await syncToFirebase();
    }, 5 * 60 * 1000);
}

init();
