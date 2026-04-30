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
const MAX_ENERGY = 300;
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
        energy, lastEnergyUpdate, unlockedThemes, activeTheme,
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
    unlockedThemes      = d.unlockedThemes      ?? ['default'];
    activeTheme         = d.activeTheme         ?? 'default';
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

            // Злиття даних — беремо найкраще з обох джерел
            const merged = mergeGameData(fbData, localData);
            applyGameData(merged);
            saveToLocal();

            // Якщо локальні дані кращі — синхронізувати в Firebase
            const fbScore = fbData.score ?? 0;
            const localScore = localData?.score ?? 0;
            if (localScore > fbScore) {
                console.log('Local ahead, syncing merged data to Firebase');
                await syncToFirebase();
            }
        } else {
            if (localData) {
                applyGameData(localData);
            }
            await syncToFirebase();
        }
    } catch(e) {
        console.error('Firebase load error:', e);
        loadFromLocal();
    }
}

// Злиття даних — завжди беремо максимум
function mergeGameData(fbData, localData) {
    if (!localData) return fbData;
    if (!fbData) return localData;

    // Злиття осколків — беремо максимум кожного типу
    const mergedFragments = {};
    const allFragmentKeys = ['standard', 'rare', 'smart', 'diamond', 'competitive', 'strange'];
    allFragmentKeys.forEach(key => {
        mergedFragments[key] = Math.max(
            fbData.fragments?.[key] ?? 0,
            localData.fragments?.[key] ?? 0
        );
    });

    // Злиття тем — об'єднуємо обидва масиви
    const fbThemes = fbData.unlockedThemes ?? ['default'];
    const localThemes = localData.unlockedThemes ?? ['default'];
    const mergedThemes = [...new Set([...fbThemes, ...localThemes])];

    // Активна тема — беремо локальну якщо є (свіжіша)
    const mergedActiveTheme = localData.activeTheme ?? fbData.activeTheme ?? 'default';

    return {
        // Беремо більший score
        score:               Math.max(fbData.score ?? 0, localData.score ?? 0),
        clickValue:          Math.max(fbData.clickValue ?? 1, localData.clickValue ?? 1),
        autoClickValue:      Math.max(fbData.autoClickValue ?? 0, localData.autoClickValue ?? 0),
        level:               Math.max(fbData.level ?? 1, localData.level ?? 1),
        totalClicks:         Math.max(fbData.totalClicks ?? 0, localData.totalClicks ?? 0),
        totalEarned:         Math.max(fbData.totalEarned ?? 0, localData.totalEarned ?? 0),
        secretCardsFound:    Math.max(fbData.secretCardsFound ?? 0, localData.secretCardsFound ?? 0),
        energy:              Math.max(fbData.energy ?? 0, localData.energy ?? 0),
        lastEnergyUpdate:    Math.max(fbData.lastEnergyUpdate ?? 0, localData.lastEnergyUpdate ?? 0),

        // Злиття об'єктів — об'єднуємо куплені апгрейди та аксесуари
        purchasedUpgrades:   { ...fbData.purchasedUpgrades, ...localData.purchasedUpgrades },
        purchasedAccessories:{ ...fbData.purchasedAccessories, ...localData.purchasedAccessories },

        // Беремо локальний аксесуар (свіжіший)
        currentAccessoryId:  localData.currentAccessoryId ?? fbData.currentAccessoryId ?? null,

        // Злиття осколків та тем
        fragments:           mergedFragments,
        unlockedThemes:      mergedThemes,
        activeTheme:         mergedActiveTheme,
        currentTheme:        mergedActiveTheme,

        // Telegram дані
        telegramUser:        fbData.telegramUser ?? localData.telegramUser ?? null,
    };
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
    updateInventory();
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
            if (tabId === 'cases') renderLabRecipes();
            if (tabId === 'settings') renderThemeSettings();
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

// === КЕЙСИ ===
const CASES = {
    basic: {
        name: 'Базовий кейс', emoji: '📦', price: 5000000,
        chances: { standard: 60, rare: 30, smart: 20, diamond: 10, competitive: 2, strange: 0 }
    },
    epic: {
        name: 'Епік кейс', emoji: '🎁', price: 10000000,
        chances: { standard: 40, rare: 35, smart: 30, diamond: 20, competitive: 8, strange: 0 }
    },
    legendary: {
        name: 'Легендарний кейс', emoji: '💎', price: 30000000,
        chances: { standard: 20, rare: 25, smart: 30, diamond: 35, competitive: 20, strange: 0 }
    },
    secret: {
        name: 'Секретний кейс', emoji: '🌟', price: 250000000,
        chances: { standard: 0, rare: 0, smart: 25, diamond: 25, competitive: 25, strange: 25 }
    }
};

const FRAGMENTS = {
    standard:    { name: 'Стандартний', icon: '⚪', rarity: 'Звичайний',    color: '#9E9E9E' },
    rare:        { name: 'Рідкісний',   icon: '🔵', rarity: 'Рідкісний',    color: '#2196F3' },
    smart:       { name: 'Розумний',    icon: '🧠', rarity: 'Епічний',      color: '#9C27B0' },
    diamond:     { name: 'Алмазний',    icon: '💎', rarity: 'Легендарний',  color: '#FF9800' },
    competitive: { name: 'Змагальний',  icon: '🏆', rarity: 'Легендарний',  color: '#FF9800' },
    strange:     { name: 'Дивний',      icon: '❓', rarity: 'Секретний',    color: '#F44336' }
};

let currentCaseType = null;

// Підвкладки кейсів
document.querySelectorAll('.cases-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.cases-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.cases-subtab').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.subtab).classList.add('active');
    });
});

// Превью кейсу
window.openCasePreview = function(caseType) {
    const c = CASES[caseType];
    currentCaseType = caseType;

    document.getElementById('preview-emoji').textContent = c.emoji;
    document.getElementById('preview-title').textContent = c.name;
    document.getElementById('preview-price').textContent = c.price.toLocaleString() + ' очок';

    // Нормалізувати шанси
    const total = Object.values(c.chances).reduce((a, b) => a + b, 0);
    const list = document.getElementById('preview-chances');
    list.innerHTML = '';

    Object.entries(c.chances).forEach(([key, val]) => {
        if (val === 0) return;
        const f = FRAGMENTS[key];
        const pct = Math.round((val / total) * 100);
        const barColor = f.color;

        list.innerHTML += `
            <div class="chance-item">
                <span class="chance-icon">${f.icon}</span>
                <div class="chance-info">
                    <div class="chance-name">${f.name}</div>
                    <div class="chance-rarity">${f.rarity}</div>
                </div>
                <div class="chance-bar-wrap">
                    <div class="chance-bar" style="width:${pct}%; background:${barColor}"></div>
                </div>
                <span class="chance-pct">${pct}%</span>
            </div>
        `;
    });

    // Перевірити баланс
    const btn = document.getElementById('case-confirm-btn');
    if (score < c.price) {
        btn.textContent = `Недостатньо очок (потрібно ${c.price.toLocaleString()})`;
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        btn.textContent = `Відкрити за ${c.price.toLocaleString()} очок`;
        btn.disabled = false;
        btn.style.opacity = '1';
    }

    document.getElementById('case-preview-modal').classList.add('open');
};

window.closeCasePreview = function() {
    document.getElementById('case-preview-modal').classList.remove('open');
};

// Підтвердження відкриття
window.confirmOpenCase = function() {
    const c = CASES[currentCaseType];
    if (score < c.price) return;

    score -= c.price;
    updateUI();
    saveToLocal();

    closeCasePreview();
    startRoulette(currentCaseType);
};

// Рулетка
function rollFragment(caseType) {
    const chances = CASES[caseType].chances;
    const pool = [];
    Object.entries(chances).forEach(([key, weight]) => {
        for (let i = 0; i < weight; i++) pool.push(key);
    });
    return pool[Math.floor(Math.random() * pool.length)];
}

function startRoulette(caseType) {
    const modal = document.getElementById('roulette-modal');
    const track = document.getElementById('roulette-track');
    const resultDiv = document.getElementById('roulette-result');

    modal.classList.add('open');
    resultDiv.style.display = 'none';
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';

    // Визначити результат
    const winner = rollFragment(caseType);

    // Генерувати елементи рулетки (40 штук)
    const allFragments = Object.keys(CASES[caseType].chances).filter(k => CASES[caseType].chances[k] > 0);
    const items = [];

    for (let i = 0; i < 40; i++) {
        if (i === 32) {
            items.push(winner); // Переможець на позиції 32
        } else {
            items.push(allFragments[Math.floor(Math.random() * allFragments.length)]);
        }
    }

    track.innerHTML = items.map((key, i) => {
        const f = FRAGMENTS[key];
        return `<div class="roulette-item ${i === 32 ? 'highlight' : ''}">
            <span class="roulette-item-icon">${f.icon}</span>
            <span class="roulette-item-name">${f.name}</span>
        </div>`;
    }).join('');

    // Анімація прокрутки
    const itemWidth = 82; // 74px + 8px gap
    const targetX = -(32 * itemWidth) + (window.innerWidth / 2) - 37;

    setTimeout(() => {
        track.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        track.style.transform = `translateX(${targetX}px)`;
    }, 100);

    // Показати результат
    setTimeout(() => {
        const f = FRAGMENTS[winner];
        document.getElementById('result-icon').textContent = f.icon;
        document.getElementById('result-name').textContent = f.name + ' осколок';
        document.getElementById('result-rarity').textContent = f.rarity;
        document.getElementById('result-rarity').style.color = f.color;

        // Додати осколок
        fragments[winner] = (fragments[winner] || 0) + 1;
        updateInventory();
        saveToLocal();

        resultDiv.style.display = 'block';
        track.style.display = 'none';
        document.querySelector('.roulette-arrow').style.display = 'none';
    }, 4500);
}

window.closeRoulette = function() {
    document.getElementById('roulette-modal').classList.remove('open');
    document.getElementById('roulette-track').style.display = 'flex';
    document.querySelector('.roulette-arrow').style.display = 'block';
};

function updateInventory() {
    Object.keys(fragments).forEach(key => {
        const el = document.getElementById('inv-' + key);
        if (el) el.textContent = fragments[key] || 0;
        // Також старі елементи
        const old = document.getElementById('fragment-' + key);
        if (old) old.textContent = fragments[key] || 0;
    });
}

// === ТЕМИ ===
const THEMES = {
    default: {
        name: 'Стандартна', icon: '🎮', rarity: 'default',
        clickBonus: 0, autoBonus: 0,
        css: {}
    },
    math: {
        name: 'Математична', icon: '📐', rarity: 'common',
        clickBonus: 100, autoBonus: 100,
        css: { '--accent': '#00BCD4', '--gradient': 'linear-gradient(135deg, #006064 0%, #00BCD4 100%)', '--bg-primary': '#0a1628', '--bg-card': '#0d2137' }
    },
    nature: {
        name: 'Природа', icon: '🌿', rarity: 'common',
        clickBonus: 100, autoBonus: 100,
        css: { '--accent': '#4CAF50', '--gradient': 'linear-gradient(135deg, #1B5E20 0%, #4CAF50 100%)', '--bg-primary': '#0a1a0a', '--bg-card': '#0d2010' }
    },
    space: {
        name: 'Космос', icon: '🚀', rarity: 'common',
        clickBonus: 100, autoBonus: 100,
        css: { '--accent': '#7C4DFF', '--gradient': 'linear-gradient(135deg, #1A0050 0%, #7C4DFF 100%)', '--bg-primary': '#050010', '--bg-card': '#0d0020' }
    },
    rich: {
        name: 'Багата', icon: '💰', rarity: 'rare',
        clickBonus: 150, autoBonus: 150,
        css: { '--accent': '#FFD700', '--gradient': 'linear-gradient(135deg, #7B6000 0%, #FFD700 100%)', '--bg-primary': '#1a1400', '--bg-card': '#2a2000' }
    },
    ai: {
        name: 'Штучний інтелект', icon: '🤖', rarity: 'rare',
        clickBonus: 150, autoBonus: 150,
        css: { '--accent': '#00E5FF', '--gradient': 'linear-gradient(135deg, #001F3F 0%, #00E5FF 100%)', '--bg-primary': '#000d1a', '--bg-card': '#001428' }
    },
    fire: {
        name: 'Вогонь', icon: '🔥', rarity: 'rare',
        clickBonus: 150, autoBonus: 150,
        css: { '--accent': '#FF6D00', '--gradient': 'linear-gradient(135deg, #BF360C 0%, #FF6D00 100%)', '--bg-primary': '#1a0500', '--bg-card': '#2a0800' }
    },
    glitch: {
        name: '!~#*&!$', icon: '👾', rarity: 'secret',
        clickBonus: 400, autoBonus: 400,
        css: { '--accent': '#FF0000', '--gradient': 'linear-gradient(135deg, #000000 0%, #FF0000 50%, #000000 100%)', '--bg-primary': '#000000', '--bg-card': '#0a0000' }
    }
};

// Рецепти лабораторії
const LAB_RECIPES = [
    {
        id: 'common_theme',
        name: 'Звичайна тема',
        icon: '🎨',
        ingredients: { standard: 5, rare: 3 },
        cost: 40000000,
        result: ['math', 'nature', 'space'],
        rarity: 'common'
    },
    {
        id: 'rare_theme',
        name: 'Рідкісна тема',
        icon: '✨',
        ingredients: { smart: 5, diamond: 3 },
        cost: 70000000,
        result: ['rich', 'ai', 'fire'],
        rarity: 'rare'
    },
    {
        id: 'secret_theme',
        name: '!~#*&!$',
        icon: '👾',
        ingredients: { strange: 5, competitive: 5 },
        cost: 350000000,
        result: ['glitch'],
        rarity: 'secret'
    }
];

let unlockedThemes = ['default'];
let activeTheme = 'default';
let craftingRecipe = null;

function applyTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;

    activeTheme = themeId;

    // Застосувати CSS змінні
    Object.entries(theme.css).forEach(([key, val]) => {
        document.documentElement.style.setProperty(key, val);
    });

    // data-theme для CSS селекторів
    document.body.dataset.theme = themeId;

    // Видалити старі частинки
    const oldParticles = document.getElementById('theme-particles');
    if (oldParticles) oldParticles.remove();

    // Додати нові частинки
    if (themeId !== 'default') {
        spawnThemeParticles(themeId);
    }

    // Якщо секретна тема — показати секретний розділ
    const secretNav = document.getElementById('secret-nav');
    if (secretNav) {
        secretNav.style.display = themeId === 'glitch' ? 'flex' : 'none';
    }

    if (themeId === 'glitch') {
        document.body.classList.add('glitch-theme');
    } else {
        document.body.classList.remove('glitch-theme');
    }

    saveToLocal();
}

function spawnThemeParticles(themeId) {
    const container = document.createElement('div');
    container.id = 'theme-particles';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
    document.body.appendChild(container);

    const configs = {
        math:        { symbols: ['∑','∫','π','√','∞','±','÷','×','α','β','Δ','θ'], color: '#00BCD4', count: 15 },
        nature:      { symbols: ['🌿','🍃','🌸','🌺','🍀','🌱','🌻','🦋','🐝','🌾'], color: '#4CAF50', count: 12 },
        space:       { symbols: ['⭐','🌟','✨','💫','🌙','☄️','🪐','🔭','🌌','👾'], color: '#7C4DFF', count: 15 },
        rich:        { symbols: ['💰','💵','💎','🤑','💸','🏆','👑','💳','🪙','💴'], color: '#FFD700', count: 12 },
        ai:          { symbols: ['🤖','⚡','💡','🔮','🧠','📡','🖥️','⚙️','🔬','🛸'], color: '#00E5FF', count: 12 },
        fire:        { symbols: ['🔥','💥','✨','🌋','⚡','🌡️','🔴','🟠','🟡','💫'], color: '#FF6D00', count: 15 },
        glitch:      { symbols: ['👾','💀','⚠️','❌','🔴','⛔','💣','🕷️','☠️','🩸'], color: '#FF0000', count: 20 }
    };

    const cfg = configs[themeId];
    if (!cfg) return;

    for (let i = 0; i < cfg.count; i++) {
        setTimeout(() => {
            createParticle(container, cfg);
        }, i * 300);
    }

    // Постійно додавати нові
    const interval = setInterval(() => {
        if (!document.getElementById('theme-particles')) {
            clearInterval(interval);
            return;
        }
        createParticle(container, cfg);
    }, 1500);

    container.dataset.interval = interval;
}

function createParticle(container, cfg) {
    const el = document.createElement('div');
    const symbol = cfg.symbols[Math.floor(Math.random() * cfg.symbols.length)];
    const size = 16 + Math.random() * 20;
    const x = Math.random() * 100;
    const duration = 6 + Math.random() * 8;
    const delay = Math.random() * 2;

    el.textContent = symbol;
    el.style.cssText = `
        position: absolute;
        left: ${x}%;
        bottom: -50px;
        font-size: ${size}px;
        opacity: 0;
        animation: particleRise ${duration}s ${delay}s ease-in forwards;
        pointer-events: none;
        user-select: none;
        filter: drop-shadow(0 0 6px ${cfg.color});
    `;

    container.appendChild(el);
    setTimeout(() => el.remove(), (duration + delay) * 1000 + 500);
}

function renderLabRecipes() {
    const container = document.getElementById('lab-recipes-container');
    if (!container) return;

    container.innerHTML = LAB_RECIPES.map(recipe => {
        const canCraft = checkCanCraft(recipe);
        const ingredientsHtml = Object.entries(recipe.ingredients).map(([key, count]) => {
            const f = FRAGMENTS[key];
            const have = fragments[key] || 0;
            const enough = have >= count;
            return `<span class="recipe-ingredient ${enough ? 'enough' : 'not-enough'}">${f.icon} ×${count}</span>`;
        }).join('<span class="recipe-plus">+</span>');

        const isSecret = recipe.rarity === 'secret';

        return `
        <div class="lab-recipe-card ${isSecret ? 'secret-recipe-card' : ''}">
            <div class="recipe-header">
                <span class="recipe-big-icon">${recipe.icon}</span>
                <div>
                    <div class="recipe-title">${recipe.name}</div>
                    <div class="recipe-rarity-badge rarity-${recipe.rarity}">${recipe.rarity === 'common' ? 'Звичайна' : recipe.rarity === 'rare' ? 'Рідкісна' : '???'}</div>
                </div>
            </div>
            <div class="recipe-ingredients-row">${ingredientsHtml}</div>
            <div class="recipe-cost">💰 ${recipe.cost.toLocaleString()} очок</div>
            <div class="recipe-result-preview">
                Можливі теми: ${recipe.result.map(id => THEMES[id].icon + ' ' + THEMES[id].name).join(', ')}
            </div>
            <button class="recipe-craft-btn ${canCraft ? '' : 'disabled'}" 
                    onclick="startCraft('${recipe.id}')"
                    ${canCraft ? '' : 'disabled'}>
                ${canCraft ? '⚗️ Скрафтити' : 'Недостатньо ресурсів'}
            </button>
        </div>`;
    }).join('');
}

function checkCanCraft(recipe) {
    if (score < recipe.cost) return false;
    return Object.entries(recipe.ingredients).every(([key, count]) => (fragments[key] || 0) >= count);
}

window.startCraft = function(recipeId) {
    const recipe = LAB_RECIPES.find(r => r.id === recipeId);
    if (!recipe || !checkCanCraft(recipe)) return;

    craftingRecipe = recipe;

    // Показати модальне вікно крафту
    const modal = document.getElementById('craft-modal');
    const isSecret = recipe.rarity === 'secret';

    document.getElementById('craft-modal-title').textContent = recipe.name;
    document.getElementById('craft-modal-icon').textContent = recipe.icon;
    modal.classList.add('open');

    if (isSecret) {
        modal.classList.add('secret-craft');
    } else {
        modal.classList.remove('secret-craft');
    }
};

window.confirmCraft = async function() {
    const recipe = craftingRecipe;
    if (!recipe) return;

    // Списати ресурси
    score -= recipe.cost;
    Object.entries(recipe.ingredients).forEach(([key, count]) => {
        fragments[key] = (fragments[key] || 0) - count;
    });

    updateUI();
    updateInventory();

    // Закрити превью
    document.getElementById('craft-modal').classList.remove('open');

    // Показати анімацію крафту
    showCraftAnimation(recipe);
};

window.closeCraftModal = function() {
    document.getElementById('craft-modal').classList.remove('open');
};

function showCraftAnimation(recipe) {
    const overlay = document.getElementById('craft-animation-overlay');
    const isSecret = recipe.rarity === 'secret';

    overlay.innerHTML = `
        <div class="craft-anim-content ${isSecret ? 'secret-anim' : ''}">
            <div class="craft-anim-particles" id="craft-particles"></div>
            <div class="craft-anim-icon" id="craft-anim-icon">${recipe.icon}</div>
            <div class="craft-anim-text">Крафтимо...</div>
        </div>
    `;
    overlay.style.display = 'flex';

    // Генерувати частинки
    const particles = document.getElementById('craft-particles');
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'craft-particle';
        p.style.cssText = `
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 2}s;
            background: ${isSecret ? '#FF0000' : '#FFD700'};
        `;
        particles.appendChild(p);
    }

    // Через 3 секунди показати результат
    setTimeout(() => {
        const resultId = recipe.result[Math.floor(Math.random() * recipe.result.length)];
        const theme = THEMES[resultId];

        if (!unlockedThemes.includes(resultId)) {
            unlockedThemes.push(resultId);
        }

        overlay.innerHTML = `
            <div class="craft-result-content ${isSecret ? 'secret-result' : ''}">
                <div class="craft-result-icon">${theme.icon}</div>
                <div class="craft-result-name">${theme.name}</div>
                <div class="craft-result-rarity rarity-${theme.rarity}">
                    ${theme.rarity === 'secret' ? '??? СЕКРЕТНА ТЕМА ???' : theme.rarity === 'rare' ? 'Рідкісна тема' : 'Звичайна тема'}
                </div>
                <div class="craft-result-bonus">
                    +${theme.clickBonus} до кліку • +${theme.autoBonus} до автофарму
                </div>
                <button class="craft-apply-btn" onclick="applyThemeFromCraft('${resultId}')">
                    ✨ Застосувати тему
                </button>
                <button class="craft-later-btn" onclick="closeCraftAnimation()">
                    Пізніше
                </button>
            </div>
        `;

        saveToLocal();
        renderThemeSettings();
    }, 3000);
}

window.applyThemeFromCraft = function(themeId) {
    applyTheme(themeId);
    closeCraftAnimation();
    // Перейти в налаштування
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="settings"]').classList.add('active');
    document.getElementById('tab-settings').classList.add('active');
};

window.closeCraftAnimation = function() {
    document.getElementById('craft-animation-overlay').style.display = 'none';
};

function renderThemeSettings() {
    const container = document.getElementById('themes-container');
    if (!container) return;

    container.innerHTML = unlockedThemes.map(id => {
        const theme = THEMES[id];
        const isActive = activeTheme === id;
        return `
        <div class="theme-card ${isActive ? 'active-theme' : ''} rarity-border-${theme.rarity}" 
             onclick="selectTheme('${id}')">
            <div class="theme-icon">${theme.icon}</div>
            <div class="theme-name">${theme.name}</div>
            <div class="theme-bonuses">+${theme.clickBonus} клік • +${theme.autoBonus} авто</div>
            ${isActive ? '<div class="theme-active-badge">✓ Активна</div>' : ''}
        </div>`;
    }).join('');
}

window.selectTheme = function(themeId) {
    if (!unlockedThemes.includes(themeId)) return;
    applyTheme(themeId);
    renderThemeSettings();
};

// Секретний шифр
window.checkSecretCode = function() {
    const input = document.getElementById('secret-code-input').value.trim();
    const resultEl = document.getElementById('secret-code-result');
    const CIPHER = '31f953825106c4204b88ba535eac91bedafc7ab2231f2efe1badb3f14dbb02da';
    const ANSWER = 'Вітаю тебе, ти отримав 50 зірок, Дані Кепенку з 6 класу та отримаєш їх';

    if (input === CIPHER) {
        // Показати шифр і поле для відповіді
        resultEl.innerHTML = `
            <div class="cipher-decoded">
                <div class="cipher-text">${CIPHER}</div>
                <div class="cipher-hint">🔓 Шифр розпізнано! Введіть відповідь:</div>
                <input type="text" id="cipher-answer-input" class="secret-code-input" 
                       placeholder="Введіть відповідь на шифр..." style="margin-top:12px;" />
                <button class="secret-code-btn" onclick="checkCipherAnswer()" style="margin-top:8px;">
                    Підтвердити відповідь
                </button>
                <div id="cipher-answer-result"></div>
            </div>
        `;
    } else if (input === ANSWER) {
        // Якщо одразу ввели відповідь
        handleCorrectAnswer();
    } else {
        resultEl.innerHTML = '<span style="color:#F44336">❌ Невірний шифр. Спробуйте ще раз.</span>';
    }
};

window.checkCipherAnswer = function() {
    const input = document.getElementById('cipher-answer-input')?.value.trim();
    const ANSWER = 'Вітаю тебе, ти отримав 50 зірок, Дані Кепенку з 6 класу та отримаєш їх';
    const resultEl = document.getElementById('cipher-answer-result');

    if (!input) return;

    if (input === ANSWER) {
        handleCorrectAnswer();
    } else {
        if (resultEl) resultEl.innerHTML = '<span style="color:#F44336">❌ Невірна відповідь.</span>';
    }
};

function handleCorrectAnswer() {
    if (localStorage.getItem('secretCodeClaimed') === 'true') {
        document.getElementById('secret-code-result').innerHTML =
            '<span style="color:#FF9800">⚠️ Ви вже отримали нагороду!</span>';
        return;
    }

    localStorage.setItem('secretCodeClaimed', 'true');

    document.getElementById('secret-code-result').innerHTML = `
        <div class="cipher-success">
            <div style="font-size:3em; margin-bottom:12px;">🎉</div>
            <div style="font-size:1.2em; font-weight:700; color:#4CAF50; margin-bottom:8px;">
                Правильно! Вітаємо!
            </div>
            <div style="color:var(--text-secondary); margin-bottom:16px;">
                Напишіть <strong style="color:#FF0000">@dankaklytoii</strong> в Telegram<br>
                щоб отримати 50 зірок!
            </div>
            <a href="https://t.me/dankaklytoii" target="_blank" class="cipher-tg-btn">
                ✉️ Написати @dankaklytoii
            </a>
        </div>
    `;

    // Відключити поля
    const inp = document.getElementById('secret-code-input');
    const btn = document.getElementById('secret-code-btn');
    if (inp) inp.disabled = true;
    if (btn) btn.disabled = true;
}
function checkFounderAccess() {
    if (telegramUser?.username === 'dankaklytoii') {
        const nav = document.getElementById('founder-nav');
        if (nav) nav.style.display = 'flex';
    }
}

window.giveCoins = () => { score += 10000; updateUI(); saveToLocal(); alert('+10,000 очок!'); };

window.addCustomCoins = () => {
    const input = document.getElementById('founder-coins-input');
    const amount = parseInt(input.value);
    if (!amount || isNaN(amount)) { alert('Введіть кількість!'); return; }
    score += amount;
    updateUI();
    saveToLocal();
    renderLabRecipes(); // Оновити рецепти
    input.value = '';
    alert(`✅ Додано ${amount.toLocaleString()} очок!`);
};

window.addFragment = (type) => {
    fragments[type] = (fragments[type] || 0) + 1;
    updateInventory();
    saveToLocal();
    renderLabRecipes(); // Оновити рецепти
};

window.addCustomFragments = () => {
    const type = document.getElementById('founder-fragment-select').value;
    const amount = parseInt(document.getElementById('founder-fragment-amount').value);
    if (!amount || isNaN(amount) || amount < 1) { alert('Введіть кількість!'); return; }
    fragments[type] = (fragments[type] || 0) + amount;
    updateInventory();
    saveToLocal();
    renderLabRecipes(); // Оновити рецепти
    document.getElementById('founder-fragment-amount').value = '';
    const names = { standard:'Стандартний', rare:'Рідкісний', smart:'Розумний', diamond:'Алмазний', competitive:'Змагальний', strange:'Дивний' };
    alert(`✅ Додано ${amount}× ${names[type]}!`);
};
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

    // Застосувати збережену тему
    if (activeTheme && activeTheme !== 'default') {
        applyTheme(activeTheme);
    }

    // Рендер лабораторії та налаштувань
    renderLabRecipes();
    renderThemeSettings();
    updateInventory();

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

    // Синхронізація в Firebase раз на 1 годину
    const SYNC_INTERVAL = 60 * 60 * 1000; // 1 година
    
    // Перевірити коли була остання синхронізація
    const lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
    const now = Date.now();
    const timeSinceSync = now - lastSyncTime;
    const timeUntilSync = Math.max(0, SYNC_INTERVAL - timeSinceSync);
    
    // Запустити таймер до наступної синхронізації
    startSyncCountdown(timeUntilSync);
}

// ─── Таймер синхронізації ──────────────────────────────────────────────────────
let syncCountdownInterval = null;

function startSyncCountdown(initialMs) {
    let remaining = initialMs;
    
    updateSyncTimer(remaining);
    
    clearInterval(syncCountdownInterval);
    syncCountdownInterval = setInterval(async () => {
        remaining -= 1000;
        updateSyncTimer(remaining);
        
        if (remaining <= 0) {
            clearInterval(syncCountdownInterval);
            
            // Показати повідомлення про синхронізацію
            showSyncOverlay();
            
            // Синхронізувати
            saveToLocal();
            await syncToFirebase();
            
            localStorage.setItem('lastSyncTime', Date.now().toString());
            
            // Перезапустити таймер на 1 годину
            hideSyncOverlay();
            startSyncCountdown(60 * 60 * 1000);
        }
    }, 1000);
}

function updateSyncTimer(ms) {
    const el = document.getElementById('sync-timer');
    if (!el) return;
    
    if (ms <= 0) {
        el.textContent = 'Синхронізація...';
        return;
    }
    
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    el.textContent = `Оновлення через ${mins}:${secs.toString().padStart(2, '0')}`;
}

function showSyncOverlay() {
    let overlay = document.getElementById('sync-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sync-overlay';
        overlay.innerHTML = `
            <div class="sync-overlay-content">
                <div class="sync-spinner"></div>
                <div class="sync-text">Синхронізація даних...</div>
                <div class="sync-subtext">Зберігаємо ваш прогрес</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideSyncOverlay() {
    const overlay = document.getElementById('sync-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Примусова синхронізація (для основателя)
window.forceSyncAll = async function() {
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Синхронізуємо...'; }
    
    showSyncOverlay();
    saveToLocal();
    await syncToFirebase();
    localStorage.setItem('lastSyncTime', Date.now().toString());
    hideSyncOverlay();
    
    // Перезапустити таймер
    clearInterval(syncCountdownInterval);
    startSyncCountdown(60 * 60 * 1000);
    
    if (btn) {
        btn.textContent = '✅ Синхронізовано!';
        btn.style.background = '#4CAF50';
        setTimeout(() => {
            btn.textContent = '🔄 Примусова синхронізація';
            btn.style.background = '';
            btn.disabled = false;
        }, 2000);
    }
    
    alert('✅ Дані синхронізовано з Firebase!');
};

init();
