import asyncio
import logging
from datetime import datetime, timedelta, timezone

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, Message

from bot.config import settings
from bot.services import db
from bot.services.redis_client import get_redis

router = Router(name="admin")
log = logging.getLogger(__name__)


def _is_admin(tg_id: int) -> bool:
    return tg_id in settings.admin_id_list


async def _parse_target(arg: str | None) -> int | None:
    if not arg:
        return None
    arg = arg.strip()
    if not arg.lstrip("-").isdigit():
        return None
    return int(arg)


@router.message(Command("admin"))
async def cmd_admin(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return
    await message.answer(
        "🛡 <b>Админ-команды</b>\n\n"
        "/stats — статистика\n"
        "/ban &lt;tg_id&gt; — забанить\n"
        "/unban &lt;tg_id&gt; — разбанить\n"
        "/user &lt;tg_id&gt; — карточка юзера\n"
        "/grant &lt;tg_id&gt; &lt;дней&gt; — выдать Premium",
        parse_mode="HTML",
    )


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    if not _is_admin(message.from_user.id):
        return

    def _count(table: str, **filters) -> int:
        q = db.get_db().table(table).select("id", count="exact")
        for k, v in filters.items():
            q = q.eq(k, v)
        return q.execute().count or 0

    def _count_dialogs_today() -> int:
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        return (
            db.get_db().table("dialogs")
            .select("id", count="exact")
            .gte("started_at", since)
            .execute()
            .count or 0
        )

    users_total, users_banned, dialogs_24h = await asyncio.gather(
        asyncio.to_thread(_count, "users"),
        asyncio.to_thread(_count, "users", banned=True),
        asyncio.to_thread(_count_dialogs_today),
    )

    r = get_redis()
    in_dialog_keys = await r.keys("pair:*")
    active_pairs = len(in_dialog_keys) // 2

    await message.answer(
        "📊 <b>Статистика</b>\n\n"
        f"Всего юзеров: <b>{users_total}</b>\n"
        f"Забанено: <b>{users_banned}</b>\n"
        f"Диалогов за 24ч: <b>{dialogs_24h}</b>\n"
        f"Активных пар сейчас: <b>{active_pairs}</b>",
        parse_mode="HTML",
    )


@router.message(Command("user"))
async def cmd_user(message: Message, command: CommandObject) -> None:
    if not _is_admin(message.from_user.id):
        return
    tg_id = await _parse_target(command.args)
    if tg_id is None:
        await message.answer("Использование: <code>/user 12345</code>", parse_mode="HTML")
        return
    user = await db.get_user_by_tg(tg_id, use_cache=False)
    if not user:
        await message.answer("Пользователь не найден.")
        return
    premium_until = user.get("premium_until") or "—"
    await message.answer(
        f"👤 <b>{tg_id}</b>\n"
        f"@{user.get('username') or '—'}\n"
        f"Пол: {user.get('gender') or '—'}\n"
        f"Возраст: {user.get('age') or '—'}\n"
        f"Диалогов: {user.get('dialogs_count', 0)}\n"
        f"👍 {user.get('likes_count', 0)} · 👎 {user.get('dislikes_count', 0)}\n"
        f"Premium до: {premium_until}\n"
        f"Banned: {user.get('banned')}",
        parse_mode="HTML",
    )


async def _set_banned(tg_id: int, banned: bool) -> dict | None:
    try:
        return await db.update_user(tg_id, {"banned": banned})
    except Exception as e:
        log.error("ban toggle failed: %s", e)
        return None


@router.message(Command("ban"))
async def cmd_ban(message: Message, command: CommandObject) -> None:
    if not _is_admin(message.from_user.id):
        return
    tg_id = await _parse_target(command.args)
    if tg_id is None:
        await message.answer("Использование: <code>/ban 12345</code>", parse_mode="HTML")
        return
    res = await _set_banned(tg_id, True)
    if res:
        await message.answer(f"🚫 Юзер <code>{tg_id}</code> забанен.", parse_mode="HTML")
        try:
            await message.bot.send_message(tg_id, "Вы заблокированы за нарушение правил.")
        except TelegramBadRequest:
            pass
    else:
        await message.answer("Не удалось забанить (юзер не найден или ошибка БД).")


@router.message(Command("unban"))
async def cmd_unban(message: Message, command: CommandObject) -> None:
    if not _is_admin(message.from_user.id):
        return
    tg_id = await _parse_target(command.args)
    if tg_id is None:
        await message.answer("Использование: <code>/unban 12345</code>", parse_mode="HTML")
        return
    res = await _set_banned(tg_id, False)
    if res:
        await message.answer(f"✅ Юзер <code>{tg_id}</code> разбанен.", parse_mode="HTML")
    else:
        await message.answer("Не удалось разбанить.")


@router.message(Command("grant"))
async def cmd_grant(message: Message, command: CommandObject) -> None:
    if not _is_admin(message.from_user.id):
        return
    parts = (command.args or "").split()
    if len(parts) != 2 or not parts[0].lstrip("-").isdigit() or not parts[1].isdigit():
        await message.answer("Использование: <code>/grant 12345 30</code>", parse_mode="HTML")
        return
    tg_id = int(parts[0])
    days = int(parts[1])
    from bot.services.premium import activate_premium
    await activate_premium(tg_id, days)
    await message.answer(f"⭐ {tg_id}: +{days} дней Premium.")
    try:
        await message.bot.send_message(tg_id, f"🎉 Тебе выдан Premium на {days} дней.")
    except TelegramBadRequest:
        pass


@router.callback_query(F.data.startswith("admin:ban:"))
async def admin_ban_button(call: CallbackQuery) -> None:
    if not _is_admin(call.from_user.id):
        await call.answer("Нет прав", show_alert=True)
        return
    try:
        tg_id = int(call.data.split(":", 2)[2])
    except ValueError:
        await call.answer("Ошибка", show_alert=True)
        return
    res = await _set_banned(tg_id, True)
    if res:
        try:
            await call.message.edit_reply_markup(reply_markup=None)
        except TelegramBadRequest:
            pass
        await call.answer(f"🚫 {tg_id} забанен", show_alert=True)
        try:
            await call.bot.send_message(tg_id, "Вы заблокированы за нарушение правил.")
        except TelegramBadRequest:
            pass
    else:
        await call.answer("Не удалось забанить", show_alert=True)
