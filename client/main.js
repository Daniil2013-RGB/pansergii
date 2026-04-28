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
    // Убрали enableClosingConfirmation - не поддерживается в версии 6.0
    telegramUser = tg.initDataUnsafe?.user || null;
    
    // Адаптація під тему Telegram
    if (tg.themeParams) {
        document.body.classList.add('tg-theme');
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
    }
    
    // УБРАЛИ обробник viewportChanged - він спамить Firebase
}

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
let totalClicks = 0;
let totalEarned = 0;
let saveTimeout = null;
let secretCardsFound = 0;
let fragments = {
    standard: 0,
    rare: 0,
    smart: 0,
    diamond: 0,
    competitive: 0,
    strange: 0
};
let currentTheme = 'default';

// ─── DOM ───────────────────────────────────────────────────────────────────────
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const clickValueDisplay = document.getElementById('click-value');
const autoClickDisplay = document.getElementById('auto-click-value');
const mainCharacter = document.getElementById('main-character');
const upgradesGrid = document.getElementById('upgrades-grid');
const accessoriesGrid = document.getElementById('accessories-grid');
const loadingScreen = document.getElementById('loading-screen');
const appDiv = document.getElementById('app');
const profileName = document.getElementById('profile-name');
const totalClicksEl = document.getElementById('total-clicks');
const totalEarnedEl = document.getElementById('total-earned');

// Навігація
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

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
    { id: 'upgrade-click-1',    name: 'Покращений клік',      description: '+1 очко за клік',    value: 1,    cost: 100,    type: 'click' },
    { id: 'upgrade-auto-1',     name: 'Мураха-робітник',      description: '+1 очко/сек',       value: 1,    cost: 500,    type: 'auto'  },
    { id: 'upgrade-click-2',    name: 'Сильний клік',         description: '+3 очка за клік',   value: 3,    cost: 1000,   type: 'click' },
    { id: 'upgrade-auto-2',     name: 'Маленька ферма',       description: '+5 очок/сек',       value: 5,    cost: 2000,   type: 'auto'  },
    { id: 'upgrade-click-3',    name: 'Кулак Сергія',         description: '+10 очок за клік',  value: 10,   cost: 5000,   type: 'click' },
    { id: 'upgrade-auto-3',     name: 'Королівство',          description: '+20 очок/сек',      value: 20,   cost: 10000,  type: 'auto'  },
    { id: 'upgrade-word-of-god',name: 'Слово Пана Сергія',    description: '+500 оч. за клік',  value: 500,  cost: 50000,  type: 'click' },
    { id: 'upgrade-secret-1',   name: '🎁 Секретна сила',     description: '+100 оч./сек',      value: 100,  cost: 0,      type: 'auto', secret: true }
];

const allAccessories = {
    'acc-hat':      { id: 'acc-hat',      name: 'Шляпа',        className: 'accessory-hat'      },
    'acc-glasses':  { id: 'acc-glasses',  name: 'Окуляри',      className: 'accessory-glasses'  },
    'acc-gold-hat': { id: 'acc-gold-hat', name: 'Золота шляпа', className: 'accessory-gold-hat' },
    'acc-crown':    { id: 'acc-crown',    name: 'Корона',       className: 'accessory-crown'    }
};

// ─── Firebase: завантаження / збереження ──────────────────────────────────────
// ТИМЧАСОВО ВІДКЛЮЧЕНО через перевищення квоти
// Використовуємо тільки localStorage до завтра

async function loadFromFirebase() {
    console.log('⚠️ Firebase тимчасово відключено (квота перевищена)');
    console.log('📦 Використовуємо localStorage');
    loadFromLocal();
    return;
    
    /* УВІМКНУТИ ЗАВТРА:
    try {
        const ref = doc(db, 'players', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            score = d.score ?? 0;
            clickValue = d.clickValue ?? 1;
            autoClickValue = d.autoClickValue ?? 0;
            level = d.level ?? 1;
            purchasedUpgrades = d.purchasedUpgrades ?? {};
            purchasedAccessories = d.purchasedAccessories ?? {};
            currentAccessoryId = d.currentAccessoryId ?? null;
            totalClicks = d.totalClicks ?? 0;
            totalEarned = d.totalEarned ?? 0;
            secretCardsFound = d.secretCardsFound ?? 0;
            fragments = d.fragments ?? { standard: 0, rare: 0, smart: 0, diamond: 0, competitive: 0, strange: 0 };
            currentTheme = d.currentTheme ?? 'default';
            
            console.log('✅ Завантажено з Firebase:', score, 'очок');
            saveToLocal();
        } else {
            console.log('⚠️ Немає даних в Firebase, створюємо новий профіль');
            loadFromLocal();
            await saveToFirebase();
        }
    } catch (e) {
        console.error('❌ Помилка завантаження Firebase:', e);
        loadFromLocal();
    }
    */
}

function loadFromLocal() {
    const saved = localStorage.getItem('serhiyGameSave');
    if (!saved) return;
    try {
        const d = JSON.parse(saved);
        score = d.score ?? 0;
        clickValue = d.clickValue ?? 1;
        autoClickValue = d.autoClickValue ?? 0;
        level = d.level ?? 1;
        purchasedUpgrades = d.purchasedUpgrades ?? {};
        purchasedAccessories = d.purchasedAccessories ?? {};
        currentAccessoryId = d.currentAccessoryId ?? null;
        totalClicks = d.totalClicks ?? 0;
        totalEarned = d.totalEarned ?? 0;
        secretCardsFound = d.secretCardsFound ?? 0;
        fragments = d.fragments ?? { standard: 0, rare: 0, smart: 0, diamond: 0, competitive: 0, strange: 0 };
        currentTheme = d.currentTheme ?? 'default';
        console.log('📦 Завантажено з localStorage (кеш)');
    } catch (e) {
        console.error('Помилка парсингу localStorage:', e);
    }
}

function saveToLocal() {
    try {
        localStorage.setItem('serhiyGameSave', JSON.stringify({
            score, clickValue, autoClickValue, level,
            purchasedUpgrades, purchasedAccessories, currentAccessoryId,
            totalClicks, totalEarned, secretCardsFound, fragments, currentTheme,
            lastSaved: new Date().toISOString()
        }));
    } catch (e) {
        console.error('Помилка збереження в localStorage:', e);
    }
}

let saveInProgress = false;
let saveQueue = [];

async function saveToFirebase() {
    console.log('⚠️ Firebase тимчасово відключено (квота перевищена)');
    console.log('📦 Дані збережено в localStorage');
    return;
    
    /* УВІМКНУТИ ЗАВТРА:
    // Додати в чергу
    const currentData = {
        score, clickValue, autoClickValue, level,
        purchasedUpgrades, purchasedAccessories, currentAccessoryId,
        totalClicks, totalEarned, secretCardsFound, fragments, currentTheme
    };
    
    saveQueue.push(currentData);
    
    if (saveInProgress) {
        console.log('⏳ Збереження в черзі...');
        return;
    }
    
    saveInProgress = true;
    const dataToSave = saveQueue[saveQueue.length - 1];
    saveQueue = [];
    
    try {
        const ref = doc(db, 'players', userId);
        await setDoc(ref, {
            ...dataToSave,
            updatedAt: new Date().toISOString(),
            telegramUser: telegramUser ? {
                id: telegramUser.id,
                username: telegramUser.username || '',
                firstName: telegramUser.first_name || '',
                photoUrl: telegramUser.photo_url || ''
            } : null
        });
        
        console.log('✅ Збережено в Firebase:', dataToSave.score, 'очок');
        saveToLocal();
        
    } catch (e) {
        console.error('❌ Помилка збереження Firebase:', e);
        saveQueue.unshift(dataToSave);
        setTimeout(() => {
            saveInProgress = false;
            saveToFirebase();
        }, 2000);
        return;
    }
    
    saveInProgress = false;
    if (saveQueue.length > 0) {
        setTimeout(() => saveToFirebase(), 100);
    }
    */
}

function scheduleSave() {
    // Миттєво зберегти в localStorage
    saveToLocal();
    
    // НЕ зберігати в Firebase при кожній дії!
    // Тільки localStorage для економії квоти
}

function showSaveStatus() {
    saveStatusEl.classList.add('show');
    setTimeout(() => saveStatusEl.classList.remove('show'), 1500);
}

// ─── Проверка основателя ──────────────────────────────────────────────────────
function checkFounderAccess() {
    const isFounder = telegramUser?.username === 'dankaklytoii';
    if (isFounder) {
        // Показати тільки кнопку навігації, вкладка керується через .active
        document.getElementById('founder-nav').style.display = 'flex';
    }
    return isFounder;
}

// ─── Лідерборд ─────────────────────────────────────────────────────────────────
async function loadLeaderboard() {
    try {
        const { collection, query, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        
        const playersRef = collection(db, 'players');
        const q = query(playersRef, orderBy('score', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        
        const players = [];
        snapshot.forEach((doc) => {
            players.push({ id: doc.id, ...doc.data() });
        });
        
        // Заповнити подіум (топ-3)
        const podiumPlaces = document.querySelectorAll('.podium-place');
        const podiumOrder = [1, 0, 2]; // 2-е, 1-е, 3-є місце
        
        podiumOrder.forEach((index, podiumIndex) => {
            const place = podiumPlaces[podiumIndex];
            const player = players[index];
            
            if (player) {
                const avatar = place.querySelector('.podium-avatar');
                const avatarImg = avatar.querySelector('.podium-avatar-img');
                const avatarEmoji = avatar.querySelector('.podium-avatar-emoji');
                const name = place.querySelector('.podium-name');
                const score = place.querySelector('.podium-score');
                
                name.textContent = player.telegramUser?.firstName || player.telegramUser?.username || 'Гравець';
                score.textContent = Math.floor(player.score || 0).toLocaleString();
                
                // Аватарка
                if (player.telegramUser?.photoUrl) {
                    avatarImg.src = player.telegramUser.photoUrl;
                    avatarImg.style.display = 'block';
                    avatarEmoji.style.display = 'none';
                } else {
                    avatarImg.style.display = 'none';
                    avatarEmoji.style.display = 'block';
                }
            }
        });
        
        // Заповнити решту списку (з 4-го місця)
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';
        
        for (let i = 3; i < players.length; i++) {
            const player = players[i];
            const isCurrentUser = player.id === userId;
            
            const item = document.createElement('div');
            item.className = `leaderboard-item ${isCurrentUser ? 'current-user' : ''}`;
            
            const rank = i + 1;
            const playerName = player.telegramUser?.firstName || player.telegramUser?.username || 'Гравець';
            const playerScore = Math.floor(player.score || 0).toLocaleString();
            
            // Аватарка
            let avatarHTML = '<div class="leaderboard-avatar"><span class="leaderboard-avatar-emoji">👤</span></div>';
            if (player.telegramUser?.photoUrl) {
                avatarHTML = `<div class="leaderboard-avatar"><img src="${player.telegramUser.photoUrl}" /></div>`;
            }
            
            item.innerHTML = `
                <span class="rank">${rank}</span>
                ${avatarHTML}
                <span class="player-name">${playerName}${isCurrentUser ? ' (Ви)' : ''}</span>
                <span class="player-score">${playerScore}</span>
            `;
            
            leaderboardList.appendChild(item);
        }
        
        if (players.length <= 3) {
            leaderboardList.innerHTML = '<div class="no-data">Поки що немає інших гравців</div>';
        }
    } catch (e) {
        console.error('Помилка завантаження лідерборду:', e);
        document.getElementById('leaderboard-list').innerHTML = '<div class="no-data">Помилка завантаження</div>';
    }
}

// Функции для основателя (глобальные для onclick)
window.giveCoins = function() {
    score += 10000;
    updateUI();
    scheduleSave();
    alert('💰 +10,000 очок додано!');
};

window.unlockAll = function() {
    upgrades.forEach(upgrade => {
        if (!purchasedUpgrades[upgrade.id]) {
            purchasedUpgrades[upgrade.id] = true;
            if (upgrade.type === 'click') clickValue += upgrade.value;
            else autoClickValue += upgrade.value;
        }
    });
    Object.keys(allAccessories).forEach(id => {
        purchasedAccessories[id] = true;
    });
    updateUI();
    scheduleSave();
    alert('🔓 Все розблоковано!');
};

window.resetProgress = function() {
    if (confirm('Ви впевнені? Це видалить весь прогрес!')) {
        localStorage.removeItem('serhiyGameSave');
        location.reload();
    }
};

// Компенсація за баги
window.claimCompensation = async function() {
    try {
        // Перевірити чи вже отримував
        const compensationClaimed = localStorage.getItem('compensationClaimed');
        if (compensationClaimed === 'true') {
            alert('❌ Ви вже отримали компенсацію!');
            return;
        }
        
        // Видати компенсацію
        score += 5000000;
        totalEarned += 5000000;
        
        // Позначити що отримано
        localStorage.setItem('compensationClaimed', 'true');
        
        // Зберегти
        await saveToFirebase();
        updateUI();
        
        // Змінити кнопку
        const btn = document.getElementById('claim-compensation');
        if (btn) {
            btn.textContent = '✅ Отримано!';
            btn.disabled = true;
            btn.style.background = '#4CAF50';
        }
        
        alert('🎉 Ви отримали 5,000,000 очок як компенсацію!\nДякуємо за терпіння!');
    } catch (e) {
        console.error('Помилка отримання компенсації:', e);
        alert('❌ Помилка. Спробуйте ще раз.');
    }
};

// Ручне збереження
window.manualSave = async function() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Зберігаємо...';
    
    try {
        await saveToFirebase();
        btn.textContent = '✅ Збережено!';
        btn.style.background = '#4CAF50';
        setTimeout(() => {
            btn.textContent = '💾 Зберегти прогрес зараз';
            btn.style.background = '';
            btn.disabled = false;
        }, 2000);
    } catch (e) {
        btn.textContent = '❌ Помилка';
        btn.disabled = false;
        alert('Помилка збереження. Спробуйте ще раз.');
    }
};

// ─── Навігація ─────────────────────────────────────────────────────────────────
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            
            // Оновити активну кнопку
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Показати відповідну вкладку
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Завантажити лідерборд при відкритті вкладки
            if (tabId === 'leaderboard') {
                loadLeaderboard();
            }
        });
    });
}

// ─── Логіка гри ───────────────────────────────────────────────────────────────
function updateUI() {
    scoreDisplay.textContent = Math.floor(score).toLocaleString();
    clickValueDisplay.textContent = clickValue.toLocaleString();
    autoClickDisplay.textContent = autoClickValue.toLocaleString();
    levelDisplay.textContent = level;
    totalClicksEl.textContent = totalClicks.toLocaleString();
    totalEarnedEl.textContent = Math.floor(totalEarned).toLocaleString();
    
    // Оновити профіль
    document.getElementById('profile-level').textContent = level;
    document.getElementById('profile-secrets').textContent = `${secretCardsFound}/5`;
    
    // Оновити лічильник секретних карточок
    updateSecretCardsCounter();
    
    // Оновити осколки
    updateFragmentsDisplay();
    
    // Оновити ім'я та аватарку профілю
    if (telegramUser) {
        const name = telegramUser.first_name || telegramUser.username || 'Гравець';
        profileName.textContent = name;
        
        const usernameEl = document.getElementById('profile-username');
        if (telegramUser.username) {
            usernameEl.textContent = '@' + telegramUser.username;
        }
        
        // Завантажити аватарку якщо є
        if (telegramUser.photo_url) {
            const avatarImg = document.getElementById('profile-avatar-img');
            const avatarEmoji = document.getElementById('profile-avatar-emoji');
            avatarImg.src = telegramUser.photo_url;
            avatarImg.style.display = 'block';
            avatarEmoji.style.display = 'none';
        }
    }
    
    updateButtonStates();
}

function updateSecretCardsCounter() {
    let counter = document.getElementById('secret-cards-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'secret-cards-counter';
        counter.className = 'secret-cards-counter';
        document.body.appendChild(counter);
    }
    counter.textContent = `🎁 Знайдено: ${secretCardsFound}/5`;
    
    if (secretCardsFound >= 5) {
        counter.style.display = 'none';
    }
}

function updateFragmentsDisplay() {
    Object.keys(fragments).forEach(type => {
        const el = document.getElementById(`fragment-${type}`);
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
        showLevelUpNotification(info.message, info.rewardId);
    }
}

function showLevelUpNotification(message, rewardId) {
    // Простий alert замість модального вікна
    alert(message);
    purchasedAccessories[rewardId] = true;
    toggleAccessory(allAccessories[rewardId]);
    updateButtonStates();
    scheduleSave();
}

function onTap(e) {
    console.log('Tap event:', e.type, e.pointerType); // Отладка
    
    // Предотвратить дефолтное поведение и двойное срабатывание
    e.preventDefault();
    
    score += clickValue;
    totalClicks++;
    totalEarned += clickValue;
    updateUI();
    updateLevelAndCheckReward();
    scheduleSave();

    // Анімація +N
    const popup = document.createElement('div');
    popup.className = 'click-popup';
    popup.textContent = `+${clickValue}`;
    const rect = mainCharacter.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    popup.style.left = (clientX - rect.left) + 'px';
    popup.style.top = (clientY - rect.top) + 'px';
    mainCharacter.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

// Використовуємо pointerdown - універсальна подія для миші і тачу
if (mainCharacter) {
    console.log('Main character element found, adding event listener');
    mainCharacter.addEventListener('pointerdown', onTap);
    
    // Додатковий обробник для старих браузерів
    mainCharacter.addEventListener('touchstart', onTap, { passive: false });
} else {
    console.error('Main character element not found!');
}

// Пасивний дохід
setInterval(() => {
    if (autoClickValue > 0) {
        score += autoClickValue;
        totalEarned += autoClickValue;
        updateUI();
        updateLevelAndCheckReward();
        scheduleSave();
    }
}, 1000);

// ─── Магазин ──────────────────────────────────────────────────────────────────
function generateShopItems(items, container) {
    container.innerHTML = '';
    items.forEach(item => {
        if (item.secret && !purchasedUpgrades[item.id]) return; // Ховати секретні до покупки
        
        const div = document.createElement('div');
        div.className = 'shop-item';
        
        const priceText = item.cost > 0 ? `${item.cost.toLocaleString()} очок` : 'БЕЗКОШТОВНО';
        const description = item.description || item.name || '';
        
        div.innerHTML = `
            <div class="shop-item-info">
                <h3>${item.name || 'Предмет'}</h3>
                <p>${description}</p>
                <div class="shop-item-price">${priceText}</div>
            </div>
            <button class="shop-button" data-id="${item.id}" data-cost="${item.cost || 0}">
                Купити
            </button>
        `;
        container.appendChild(div);
    });
}

function updateButtonStates() {
    document.querySelectorAll('.shop-button').forEach(btn => {
        const id = btn.dataset.id;
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
                btn.textContent = 'Куплено ✓';
                btn.disabled = true;
            } else {
                btn.textContent = cost > 0 ? 'Купити' : 'Отримати';
                btn.disabled = cost > 0 && score < cost;
            }
        }
    });
}

// Обробка покупок
document.addEventListener('click', (e) => {
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
        scheduleSave();
    } else if (accessory && purchasedAccessories[id]) {
        toggleAccessory(accessory);
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

// ─── Секретні карточки ─────────────────────────────────────────────────────────
function spawnSecretCard() {
    if (document.querySelector('.secret-card')) return; // Тільки одна за раз
    if (secretCardsFound >= 5) return; // Максимум 5 карточок
    
    const card = document.createElement('div');
    card.className = 'secret-card';
    card.textContent = '🎁';
    
    // Рандомна позиція
    const x = Math.random() * (window.innerWidth - 60);
    const y = Math.random() * (window.innerHeight - 160) + 60;
    
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    
    document.body.appendChild(card);
    
    // Автовидалення через 5 секунд
    setTimeout(() => {
        if (card.parentNode) card.remove();
    }, 5000);
    
    // Клік по карточці
    card.addEventListener('click', () => {
        secretCardsFound++;
        
        if (secretCardsFound === 1) {
            // Перша карточка - розблокувати секретний апгрейд
            if (!purchasedUpgrades['upgrade-secret-1']) {
                purchasedUpgrades['upgrade-secret-1'] = true;
                autoClickValue += 100;
                alert('🎉 Перша секретна карточка!\n+100 очок за секунду назавжди!');
                generateShopItems(upgrades, upgradesGrid);
            }
        } else if (secretCardsFound <= 5) {
            // 2-5 карточки - по 1000 очок
            score += 1000;
            alert(`🎁 Секретна карточка ${secretCardsFound}/5!\n+1000 очок!`);
        }
        
        if (secretCardsFound >= 5) {
            alert('🏆 Ви знайшли всі 5 секретних карточок!\nБільше не з\'являтимуться.');
        }
        
        updateUI();
        scheduleSave();
        card.remove();
    });
}

// Спавн секретних карточок кожні 30-60 секунд (тільки якщо < 5)
setInterval(() => {
    if (secretCardsFound < 5 && Math.random() < 0.3) {
        spawnSecretCard();
    }
}, 45000);

// ─── Ініціалізація ────────────────────────────────────────────────────────────
async function init() {
    await loadFromFirebase();
    
    checkFounderAccess();
    setupNavigation();
    generateShopItems(upgrades, upgradesGrid);
    generateShopItems(Object.values(allAccessories), accessoriesGrid);
    
    if (currentAccessoryId && allAccessories[currentAccessoryId]) {
        const el = document.createElement('div');
        el.className = `accessory ${allAccessories[currentAccessoryId].className}`;
        mainCharacter.appendChild(el);
    }
    
    // Перевірити компенсацію
    const compensationClaimed = localStorage.getItem('compensationClaimed');
    const compensationBtn = document.getElementById('claim-compensation');
    if (compensationClaimed === 'true' && compensationBtn) {
        compensationBtn.textContent = '✅ Отримано!';
        compensationBtn.disabled = true;
        compensationBtn.style.background = '#4CAF50';
        compensationBtn.style.cursor = 'not-allowed';
    }
    
    updateUI();
    
    // Ховаємо екран завантаження
    loadingScreen.style.display = 'none';
    appDiv.style.display = 'block';
    
    // Перша секретна карточка через 10 секунд (якщо < 5)
    if (secretCardsFound < 5) {
        setTimeout(spawnSecretCard, 10000);
    }
    
    // Збереження при закритті/виході
    window.addEventListener('beforeunload', async (e) => {
        console.log('🚪 Закриття додатку, зберігаємо...');
        saveToLocal();
        await saveToFirebase();
    });
    
    window.addEventListener('pagehide', async (e) => {
        console.log('🚪 Page hide, зберігаємо...');
        saveToLocal();
        await saveToFirebase();
    });
    
    // Збереження при паузі (Telegram)
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            console.log('📱 Додаток згорнуто, зберігаємо...');
            saveToLocal();
            await saveToFirebase();
        } else {
            console.log('📱 Додаток відкрито, перезавантажуємо...');
            await loadFromFirebase();
            updateUI();
        }
    });
    
    // РІДКЕ автозбереження - кожні 2 ХВИЛИНИ (економія квоти)
    setInterval(async () => {
        console.log('⏰ Автозбереження (раз на 2 хв)...');
        await saveToFirebase();
    }, 120000); // 2 хвилини
}

init();