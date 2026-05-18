# AnonChat WebApp (звонки)

Next.js приложение для анонимных WebRTC аудио/видео-звонков, открывается как Telegram Mini App из бота.

Signaling — через Supabase Realtime (broadcast-каналы), peer-to-peer аудио/видео — через WebRTC + публичные STUN-сервера Google.

## Локальный запуск

```bash
cd webapp
npm install
cp .env.example .env.local   # заполнить SUPABASE_URL и SUPABASE_ANON_KEY
npm run dev
```

Открыть `http://localhost:3000/call?d=test&u=1&r=caller&t=audio` в одном табе и `?r=callee&u=2` в другом — должен пройти WebRTC handshake.

## Деплой на Vercel

1. На [vercel.com](https://vercel.com/new) → **Add New → Project**
2. Импортировать GitHub репо `B760m670/anonchatme-bot`
3. **Root Directory** → выбрать `webapp`
4. Framework: Next.js (определится автоматически)
5. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hxnpaneywrizompuygmu.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_xFTeVi0GDwVq55ppUXpy3Q_4qhybN0A`
6. **Deploy**

После деплоя получите URL вида `https://anonchatme-webapp.vercel.app`. Добавьте этот URL в env vars Render как `WEBAPP_URL`.

## Структура

```
webapp/
├── app/
│   ├── layout.tsx          # корневой layout с Telegram WebApp скриптом
│   ├── page.tsx            # главная (заглушка)
│   ├── call/page.tsx       # страница звонка
│   └── globals.css
├── lib/supabase.ts         # клиент Supabase
├── package.json
├── next.config.js
├── tsconfig.json
└── .env.example
```

## Как работает

1. Бот отправляет обоим участникам кнопку "Открыть звонок" с URL `/call?d=DIALOG_ID&u=USER_TG&r=caller|callee&t=audio|video`
2. WebApp открывается внутри Telegram
3. Запрашивает доступ к микрофону/камере (`navigator.mediaDevices.getUserMedia`)
4. Подключается к Supabase Realtime каналу `call:DIALOG_ID`
5. Обменивается через broadcast `sdp` / `ice` — устанавливает peer-to-peer соединение
6. Аудио/видео идёт **напрямую** между пирами (через WebRTC, не через сервер)
7. Кнопка "📞" завершает звонок и закрывает WebApp

## Ограничения

- Нет TURN-сервера. Если оба пользователя за симметричным NAT — соединение не установится. Решение: подключить бесплатный/платный TURN.
- Не использует Telegram initData для проверки. Для прода стоит валидировать на бэке.
