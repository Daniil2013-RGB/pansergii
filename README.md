# Пан Сергій Tap — Telegram Mini App

## Структура
```
client/            ← фронтенд (деплоїться на Netlify)
bot/               ← Telegram бот (запускається локально або на сервері)
netlify/functions/ ← serverless API
.env               ← секрети (не комітити!)
```

## Кроки для запуску

### 1. Firebase — увімкни Firestore
- Відкрий https://console.firebase.google.com → проект `pansergiitap`
- Зліва: **Build → Firestore Database → Create database**
- Вибери регіон (europe-west або us-east)
- Режим: **test mode** (для початку)
- Встанови правила (Rules tab):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{userId} {
      allow read, write: if true;
    }
  }
}
```

### 2. Netlify — задеплой фронтенд
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=client
```
Отримаєш URL типу `https://amazing-name-123.netlify.app`

### 3. Оновити URL гри в .env
```
GAME_URL=https://amazing-name-123.netlify.app
```

### 4. Запустити бота
```bash
cd bot
npm install
npm start
```

### 5. Налаштувати Menu Button у BotFather
- Напиши @BotFather
- `/setmenubutton` → вибери свого бота
- Вкажи URL: `https://amazing-name-123.netlify.app`
- Назва кнопки: `🎮 Грати`

## ⚠️ Важливо
- Файл `.env` НЕ комітити в git (він в .gitignore)
- Токен бота тримай в секреті


git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/Daniil2013-RGB/pansergii.git
git push -u origin main
