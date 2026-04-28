# 🔥 Налаштування Firebase для збільшення квоти

## Проблема: Quota exceeded

Firebase блокує запити через перевищення безкоштовної квоти.

## Рішення 1: Збільшити квоту (Безкоштовно)

### Крок 1: Відкрити Firebase Console
1. Зайди на https://console.firebase.google.com
2. Вибери проект `pansergiitap`

### Крок 2: Перейти на Blaze Plan (Pay as you go)
1. Зліва внизу натисни на **Upgrade**
2. Вибери **Blaze Plan** (оплата за використання)
3. **НЕ ХВИЛЮЙСЯ** - у тебе є безкоштовний ліміт:
   - 50,000 читань/день
   - 20,000 записів/день
   - 20,000 видалень/день
4. Після перевищення - платиш $0.06 за 100,000 операцій (дуже дешево)

### Крок 3: Встановити бюджетні алерти
1. Перейди в **Billing** (зліва внизу)
2. Натисни **Set budget alerts**
3. Встанови ліміт $5/місяць
4. Додай свій email для сповіщень

## Рішення 2: Оптимізувати Firestore Rules

### Поточні правила (небезпечні):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{userId} {
      allow read, write: if true; // ❌ Дозволено всім
    }
  }
}
```

### Безпечні правила:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{userId} {
      // Тільки власник може читати/писати свої дані
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // АБО для Telegram (без auth):
      // allow read, write: if true; // Тимчасово, поки не додамо валідацію
    }
  }
}
```

### Як змінити правила:
1. Firebase Console → **Firestore Database**
2. Вкладка **Rules**
3. Вставити нові правила
4. Натиснути **Publish**

## Рішення 3: Додати індекси

Індекси прискорюють запити і зменшують кількість операцій.

### Створити індекс для лідерборду:
1. Firebase Console → **Firestore Database**
2. Вкладка **Indexes**
3. Натиснути **Create Index**
4. Collection: `players`
5. Fields:
   - `score` - Descending
   - `updatedAt` - Descending
6. Натиснути **Create**

## Моніторинг використання

### Перевірити поточне використання:
1. Firebase Console → **Firestore Database**
2. Вкладка **Usage**
3. Подивитись графіки:
   - Document reads
   - Document writes
   - Document deletes

### Типове використання для гри:
- **1 гравець**: ~100-200 записів/годину
- **100 гравців**: ~10,000-20,000 записів/годину
- **Безкоштовний ліміт**: 20,000 записів/день

## Оптимізація коду (вже зроблено)

✅ Debounce 3 секунди при кліках
✅ Автозбереження кожні 30 секунд
✅ Система черги для запобігання дублікатів
✅ Кеш в localStorage

## Альтернатива: Використати інший backend

Якщо Firebase дорого:
1. **Supabase** (PostgreSQL) - більш щедрий безкоштовний план
2. **MongoDB Atlas** - 512MB безкоштовно
3. **PocketBase** - self-hosted, безкоштовно

---

## Швидке рішення ЗАРАЗ:

1. Перейди на Blaze Plan (безкоштовно до ліміту)
2. Встанови бюджетний аларм $5
3. Створи індекс для `score`

Це дасть тобі:
- 50,000 читань/день
- 20,000 записів/день
- Достатньо для 100+ активних гравців
