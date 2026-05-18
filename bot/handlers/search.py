from aiogram import Bot, F, Router
from aiogram.types import Message

from bot.keyboards.chat import BTN_CANCEL_SEARCH, chat_kb, search_kb
from bot.keyboards.main_menu import (
    BTN_SEARCH,
    BTN_SEARCH_GENDER,
    main_menu_kb,
)
from bot.services import db, matcher

router = Router(name="search")


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

    partner_tg = await matcher.try_match(
        tg_id=user["tg_id"], age=user["age"], gender=user["gender"], mode=mode,
    )

    if partner_tg is None:
        label = "по полу" if mode == "by_gender" else "собеседника"
        await message.answer(
            f"🔍 Ищу {label}…\n\nКак только найду — соединю.",
            reply_markup=search_kb(),
        )
        return

    dialog_id = await matcher.start_dialog(user["tg_id"], partner_tg, mode)
    bot: Bot = message.bot
    text = "🎉 Собеседник найден! Начинай общение.\n\nКнопки внизу: «Следующий» / «Стоп»."
    await message.answer(text, reply_markup=chat_kb())
    await bot.send_message(partner_tg, text, reply_markup=chat_kb())


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
