from aiogram import Bot, F, Router
from aiogram.types import Message

from bot.keyboards.chat import BTN_CANCEL_SEARCH, chat_kb, search_kb
from bot.keyboards.main_menu import (
    BTN_SEARCH,
    BTN_SEARCH_GENDER,
    main_menu_kb,
)
from bot.services import db, matcher, rooms
from bot.services.rooms import ROOM_LABEL

router = Router(name="search")

GENDER_LABEL = {"male": "🚹 Парень", "female": "🚺 Девушка"}


def format_match_message(*, room: str, partner: dict, viewer_is_premium: bool) -> str:
    likes = partner.get("likes_count", 0)
    dislikes = partner.get("dislikes_count", 0)
    lines = [
        "Нашёл собеседника!",
        "​",
        f"Комната: {ROOM_LABEL.get(room, room)}",
        f"Реакции: {likes}👍 {dislikes}👎",
    ]
    if viewer_is_premium:
        gender = GENDER_LABEL.get(partner.get("gender", ""), "—")
        age = partner.get("age") or "—"
        lines.append(f"Собеседник: {gender}, {age}")
    lines.append("​")
    return "\n".join(lines)


async def _ensure_registered(message: Message, user_record: dict | None) -> dict | None:
    user = user_record or await db.get_user_by_tg(message.from_user.id)
    if not user or not user.get("gender") or not user.get("age"):
        await message.answer("Сначала пройди регистрацию: /start", reply_markup=main_menu_kb())
        return None
    return user


async def _start_search(message: Message, mode: str, user_record: dict | None) -> None:
    user = await _ensure_registered(message, user_record)
    if not user:
        return

    state = await matcher.get_state(user["tg_id"])
    if state == matcher.STATE_IN_DIALOG:
        await message.answer(
            "Ты уже в диалоге. Нажми «🛑 Стоп» или «⏭ Следующий».",
            reply_markup=chat_kb(),
        )
        return
    if state == matcher.STATE_SEARCHING:
        await message.answer("Уже идёт поиск… 🔄", reply_markup=search_kb())
        return

    room = await rooms.get_room(user["tg_id"])

    partner_tg = await matcher.try_match(
        tg_id=user["tg_id"], age=user["age"], gender=user["gender"], mode=mode, room=room,
    )

    if partner_tg is None:
        await message.answer(
            f"🔍 Ищу собеседника в комнате {ROOM_LABEL[room]}…\n\nКак только найду — соединю.",
            reply_markup=search_kb(),
        )
        return

    await matcher.start_dialog(user["tg_id"], partner_tg, mode, room)

    partner = await db.get_user_by_tg(partner_tg)

    user_premium = db.is_premium(user)
    partner_premium = bool(partner and db.is_premium(partner))

    text_for_user = format_match_message(room=room, partner=partner or {}, viewer_is_premium=user_premium)
    text_for_partner = format_match_message(room=room, partner=user, viewer_is_premium=partner_premium)

    await message.answer(text_for_user, reply_markup=chat_kb())
    bot: Bot = message.bot
    await bot.send_message(partner_tg, text_for_partner, reply_markup=chat_kb())


@router.message(F.text == BTN_SEARCH)
async def search_random(message: Message, user_record: dict | None = None) -> None:
    await _start_search(message, "random", user_record)


@router.message(F.text == BTN_SEARCH_GENDER)
async def search_by_gender(message: Message, user_record: dict | None = None) -> None:
    await _start_search(message, "by_gender", user_record)


@router.message(F.text == BTN_CANCEL_SEARCH)
async def cancel_search(message: Message, user_record: dict | None = None) -> None:
    user = user_record or await db.get_user_by_tg(message.from_user.id)
    if not user:
        return
    await matcher.remove_from_queues(user["tg_id"])
    await matcher.clear_state(user["tg_id"])
    await message.answer("Поиск отменён.", reply_markup=main_menu_kb())
