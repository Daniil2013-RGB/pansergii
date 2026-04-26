import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── Firebase Config ───────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCAbsbazApKPtfYukYdH93Q3pm7_fqQePU",
    authDomain: "pansergiitap.firebaseapp.com",
    projectId: "pansergiitap",
    storageBucket: "pansergiitap.firebasestorage.app",
    messagingSenderId: "598054840627",
    appId: "1:598054840627:web:5f846673fb49bc6bb17646",
    measurementId: "G-XF5YR0XXWR"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── Telegram WebApp ───────────────────────────────────────────────────────────
const tg = window.Telegram?.WebApp;
let telegramUser = null;

if (tg) {
    tg.ready();
    tg.expand();
    telegramUser = tg.initDataUnsafe?.user || null;
}

// Якщо не в Telegram — використовуємо тестовий ID для розробки
const userId = telegramUser?.id?.toString() || 'dev_' + (localStorage.getItem('devUserId') || (() => {
    const id = Math.random().toString(36).slice(2);
    localStorage.setItem('devUserId', id);
    return id;
})());

// ─── Стан гри ─────────────────────────────────────────────────────────────────
let score = 0;
let clickValue = 1;
let autoClickValue = 0;
let level = 1;
let purchasedUpgrades = {};
let purchasedAccessories = {};
let currentAccessoryId = null;
let saveTimeout = null;

// ─── DOM ───────────────────────────────────────────────────────────────────────
const scoreDisplay        = document.getElementById('score');
const levelDisplay        = document.getElementById('level');
const clickValueDisplay   = document.getElementById('click-value');
const autoClickDisplay    = document.getElementById('auto-click-value');
const mainCharacter       = document.getElementById('main-character');
const upgradesModal       = document.getElementById('upgrades-modal');
const accessoriesModal    = document.getElementById('accessories-modal');
const levelUpModal        = document.getElementById('level-up-modal');
const upgradesGrid        = document.getElementById('upgrades-grid');
const accessoriesGrid     = document.getElementById('accessories-grid');
const upgradesBtn         = document.getElementById('upgrades-tab-btn');
const accessoriesBtn      = document.getElementById('accessories-tab-btn');
const closeButtons        = document.querySelectorAll('.close-btn');
const claimRewardBtn      = document.getElementById('claim-reward-btn');
const levelUpMessage      = document.getElementById('level-up-message');
const loadingScreen       = document.getElementById('loading-screen');
const appDiv              = document.getElementById('app');

// Статус збереження
const saveStatusEl = document.createElement('div');
saveStatusEl.id = 'save-status';
saveStatusEl.textContent = '✓ Збережено';
document.body.appendChild(saveStatusEl);

// ─── Дані гри ──────────────────────────────────────────────────────────────────
const levels = [
    { threshold: 5000,  rewardId: 'acc-hat',      message: 'Вітаємо! Рівень 2 — отримуєте шляпу!' },
    { threshold: 10000, rewardId: 'acc-glasses',   message: 'Неймовірно! Рівень 3 — стильні окуляри!' },
    { threshold: 20000, rewardId: 'acc-gold-hat',  message: 'Майстер! Рівень 4 — золота шляпа!' },
    { threshold: 50000, rewardId: 'acc-crown',     message: 'Велич! Рівень 5 — корона!' }
];

const upgrades = [
    { id: 'upgrade-click-1',    name: 'Покращений клік',      description: '+1 очко за клік',    value: 1,   cost: 100,   type: 'click' },
    { id: 'upgrade-auto-1',     name: 'Мураха-робітник',      description: '+1 очко/сек',         value: 1,   cost: 500,   type: 'auto'  },
    { id: 'upgrade-click-2',    name: 'Сильний клік',         description: '+3 очка за клік',     value: 3,   cost: 1000,  type: 'click' },
    { id: 'upgrade-auto-2',     name: 'Маленька ферма',       description: '+5 очок/сек',         value: 5,   cost: 2000,  type: 'auto'  },
    { id: 'upgrade-click-3',    name: 'Кулак Сергія',         description: '+10 очок за клік',    value: 10,  cost: 5000,  type: 'click' },
    { id: 'upgrade-auto-3',     name: 'Королівство',          description: '+20 очок/сек',        value: 20,  cost: 10000, type: 'auto'  },
    { id: 'upgrade-word-of-god',name: 'Слово Пана Сергія',    description: '+500 оч. за клік',    value: 500, cost: 50000, type: 'click' }
];

const allAccessories = {
    'acc-hat':      { id: 'acc-hat',      name: 'Шляпа',        className: 'accessory-hat'      },
    'acc-glasses':  { id: 'acc-glasses',  name: 'Окуляри',      className: 'accessory-glasses'  },
    'acc-gold-hat': { id: 'acc-gold-hat', name: 'Золота шляпа', className: 'accessory-gold-hat' },
    'acc-crown':    { id: 'acc-crown',    name: 'Корона',       className: 'accessory-crown'    }
};

// ─── Firebase: завантаження / збереження ──────────────────────────────────────
async function loadFromFirebase() {
    try {
        const ref = doc(db, 'players', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            score              = d.score              ?? 0;
            clickValue         = d.clickValue         ?? 1;
            autoClickValue     = d.autoClickValue     ?? 0;
            level              = d.level              ?? 1;
            purchasedUpgrades  = d.purchasedUpgrades  ?? {};
            purchasedAccessories = d.purchasedAccessories ?? {};
            currentAccessoryId = d.currentAccessoryId ?? null;
        }
    } catch (e) {
        console.warn('Firebase недоступний, використовуємо localStorage', e);
        loadFromLocal();
    }
}

function loadFromLocal() {
    const saved = localStorage.getItem('serhiyGameSave');
    if (!saved) return;
    const d = JSON.parse(saved);
    score              = d.score              ?? 0;
    clickValue         = d.clickValue         ?? 1;
    autoClickValue     = d.autoClickValue     ?? 0;
    level              = d.level              ?? 1;
    purchasedUpgrades  = d.purchasedUpgrades  ?? {};
    purchasedAccessories = d.purchasedAccessories ?? {};
    currentAccessoryId = d.currentAccessoryId ?? null;
}

function saveToLocal() {
    localStorage.setItem('serhiyGameSave', JSON.stringify({
        score, clickValue, autoClickValue, level,
        purchasedUpgrades, purchasedAccessories, currentAccessoryId
    }));
}

async function saveToFirebase() {
    try {
        const ref = doc(db, 'players', userId);
        await setDoc(ref, {
            score, clickValue, autoClickValue, level,
            purchasedUpgrades, purchasedAccessories, currentAccessoryId,
            updatedAt: new Date().toISOString(),
            telegramUser: telegramUser ? {
                id: telegramUser.id,
                username: telegramUser.username || '',
                firstName: telegramUser.first_name || ''
            } : null
        });
        showSaveStatus();
    } catch (e) {
        console.warn('Помилка збереження Firebase:', e);
    }
}

// Дебаунс збереження — не більше 1 разу на 3 секунди
function scheduleSave() {
    saveToLocal();
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveToFirebase, 3000);
}

function showSaveStatus() {
    saveStatusEl.classList.add('show');
    setTimeout(() => saveStatusEl.classList.remove('show'), 1500);
}

// ─── Логіка гри ───────────────────────────────────────────────────────────────
function updateUI() {
    scoreDisplay.textContent      = Math.floor(score);
    clickValueDisplay.textContent = clickValue;
    autoClickDisplay.textContent  = autoClickValue;
    levelDisplay.textContent      = level;
    updateButtonStates();
}

function updateLevelAndCheckReward() {
    let newLevel = 1;
    for (let i = 0; i < levels.length; i++) {
        if (score >= levels[i].threshold) newLevel = i + 2;
    }
    if (newLevel > level) {
        level = newLevel;
        const info = levels[level - 2];
        showLevelUpModal(info.message, info.rewardId);
    }
}

function showLevelUpModal(message, rewardId) {
    levelUpMessage.textContent = message;
    levelUpModal.style.display = 'flex';
    claimRewardBtn.onclick = () => {
        purchasedAccessories[rewardId] = true;
        toggleAccessory(allAccessories[rewardId]);
        levelUpModal.style.display = 'none';
        updateButtonStates();
        scheduleSave();
    };
}

function onTap(e) {
    score += clickValue;
    updateUI();
    updateLevelAndCheckReward();
    scheduleSave();

    // Анімація +N
    const popup = document.createElement('div');
    popup.className = 'click-popup';
    popup.textContent = `+${clickValue}`;
    const rect = mainCharacter.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    popup.style.left = (clientX - rect.left) + 'px';
    popup.style.top  = (clientY - rect.top)  + 'px';
    mainCharacter.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
}

mainCharacter.addEventListener('click', onTap);
mainCharacter.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(e); }, { passive: false });

// Пасивний дохід
setInterval(() => {
    if (autoClickValue > 0) {
        score += autoClickValue;
        updateUI();
        updateLevelAndCheckReward();
        scheduleSave();
    }
}, 1000);

// ─── Магазин ──────────────────────────────────────────────────────────────────
function generateShopItems(items, container) {
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        const priceText = item.cost !== undefined ? `Ціна: ${item.cost} очок` : 'Нагорода за рівень';
        div.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description || ''}</p>
            <p>${priceText}</p>
            <button class="shop-button" data-id="${item.id}" data-cost="${item.cost || 0}">Купити</button>
        `;
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
                btn.textContent = 'Нагорода за рівень';
                btn.disabled = true;
            }
        } else {
            if (purchasedUpgrades[id]) {
                btn.textContent = 'Куплено ✓';
                btn.disabled = true;
            } else {
                btn.textContent = `Купити (${cost} оч.)`;
                btn.disabled = score < cost;
            }
        }
    });
}

upgradesModal.addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-button');
    if (!btn) return;
    const id = btn.dataset.id;
    const upgrade = upgrades.find(u => u.id === id);
    if (!upgrade || purchasedUpgrades[id] || score < upgrade.cost) return;

    score -= upgrade.cost;
    purchasedUpgrades[id] = true;
    if (upgrade.type === 'click') clickValue += upgrade.value;
    else autoClickValue += upgrade.value;

    updateUI();
    scheduleSave();
});

accessoriesModal.addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (purchasedAccessories[id]) {
        toggleAccessory(allAccessories[id]);
        updateButtonStates();
        scheduleSave();
    }
});

function toggleAccessory(accessory) {
    const existing = mainCharacter.querySelector('.accessory');
    if (existing) existing.remove();

    if (currentAccessoryId === accessory.id) {
        currentAccessoryId = null;
    } else {
        const el = document.createElement('div');
        el.className = `accessory ${accessory.className}`;
        mainCharacter.appendChild(el);
        currentAccessoryId = accessory.id;
    }
}

// ─── Модальні вікна ───────────────────────────────────────────────────────────
function setupModals() {
    upgradesBtn.onclick    = () => { upgradesModal.style.display = 'flex';    updateButtonStates(); };
    accessoriesBtn.onclick = () => { accessoriesModal.style.display = 'flex'; updateButtonStates(); };

    closeButtons.forEach(btn => {
        btn.onclick = () => btn.closest('.modal').style.display = 'none';
    });

    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    };
}

// ─── Старт ────────────────────────────────────────────────────────────────────
async function init() {
    await loadFromFirebase();

    generateShopItems(upgrades, upgradesGrid);
    generateShopItems(Object.values(allAccessories), accessoriesGrid);
    setupModals();

    if (currentAccessoryId && allAccessories[currentAccessoryId]) {
        const el = document.createElement('div');
        el.className = `accessory ${allAccessories[currentAccessoryId].className}`;
        mainCharacter.appendChild(el);
    }

    updateUI();

    // Ховаємо екран завантаження
    loadingScreen.style.display = 'none';
    appDiv.style.display = 'block';
}

init();
