# Анонимный чат-бот для Telegram

Бот анонимного общения: поиск собеседника, фильтры по полу/возрасту, флирт-чат, анонимные звонки через WebApp (WebRTC), профиль и админка.

## Стек

- Python 3.11 / **aiogram 3.x** (polling локально, webhook в проде)
- **Redis (Upstash)** — очереди поиска, активные пары, FSM, кэш юзеров
- **Supabase Postgres** — профили, диалоги, рейтинги, подарки, баны
- **Render (Frankfurt, Free tier)** — хостинг (webhook)
- **Vercel + Next.js + WebRTC + Supabase Realtime** — WebApp звонков (этап 4)
- Подарки — **Telegram Stars**

## Локальная разработка

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env  # затем заполнить
python -m bot.main
```

Если `WEBHOOK_URL` пуст в `.env` — бот запустится в polling-режиме (для разработки).

## Деплой на Render (Free)

1. Запушить проект в GitHub
2. На [render.com](https://render.com) → New → Web Service → подключить репо
3. Регион: **Frankfurt**, План: **Free**
4. Build: `pip install -r requirements.txt`
5. Start: `python -m bot.main`
6. Healthcheck path: `/health`
7. Добавить environment variables (см. `.env.example`)
8. После деплоя — установить webhook через Telegram API (см. ниже)

### Установка webhook после деплоя

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-render-app>.onrender.com/webhook&secret_token=<WEBHOOK_SECRET>"
```

## Структура БД

Открыть Supabase → SQL Editor → выполнить [migrations/001_init.sql](migrations/001_init.sql).

## Что готово

### Этап 1 — Каркас
- Регистрация (пол, возраст)
- Главное меню: Поиск / Поиск по полу / Флирт / Профиль
- Профиль и настройки диалогов
- FSM на Redis, бан-чек middleware

### Этап 2 — Поиск и чат
- Поиск собеседника (рандом, по полу) с фильтром по возрасту (±3 года)
- Анонимная пересылка текста / фото / видео / голоса / стикеров
- Кнопки Следующий / Стоп
- Лайки/дизлайки после диалога

### Оптимизации
- Кэш юзеров в Redis (60 сек)
- Supabase через `asyncio.to_thread`
- `hide_media` партнёра кэшируется прямо в паре
- Webhook режим для прода

## Дальнейшие этапы

- [ ] Этап 3 — расширенный профиль, история диалогов
- [ ] Этап 4 — звонки (WebApp + WebRTC + Supabase Realtime)
- [ ] Этап 5 — флирт-комната, админка, премиум, подарки (Telegram Stars)

## Структура

```
telegrambot/
├── bot/
│   ├── main.py              # точка входа (polling | webhook)
│   ├── config.py            # настройки из .env
│   ├── handlers/            # start, menu, profile, search, chat, rating
│   ├── keyboards/
│   ├── states/
│   ├── middlewares/
│   └── services/            # db, redis, matcher
├── migrations/              # SQL для Supabase
├── render.yaml              # манифест Render
├── runtime.txt              # пиннинг Python
├── requirements.txt
└── .env.example
```
