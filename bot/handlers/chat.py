from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import Message

from bot.keyboards.chat import BTN_NEXT, BTN_STOP, chat_kb, rating_kb, search_kb
from bot.keyboards.main_menu import main_menu_kb
from bot.services import db, matcher

router = Router(name="chat")


def _has_media(message: Message) -> bool:
    return bool(message.photo or message.video or message.video_note or message.animation)


async def _send_rating_prompts(bot: Bot, tg_a: int, tg_b: int, dialog_id: int) -> None:
    text = "Диалог завершён. Оцени собеседника:"
    try:
        await bot.send_message(tg_a, text, reply_markup=rating_kb(dialog_id, tg_b))
    except TelegramBadRequest:
        pass
    try:
        await bot.send_message(tg_b, text, reply_markup=rating_kb(dialog_id, tg_a))
    except TelegramBadRequest:
        pass


async def _end_and_notify(bot: Bot, tg_id: int, partner_tg: int, dialog_id: int) -> None:
    try:
        await bot.send_message(
            partner_tg,
            "Собеседник завершил диалог.",
            reply_markup=main_menu_kb(),
        )
    except TelegramBadRequest:
        pass
    await _send_rating_prompts(bot, tg_id, partner_tg, dialog_id)


@router.message(F.text == BTN_STOP)
async def stop_dialog(message: Message) -> None:
    result = await matcher.end_dialog(message.from_user.id, message.from_user.id)
    if not result:
        await message.answer("Ты не в диалоге.", reply_markup=main_menu_kb())
        return
    partner_tg, dialog_id = result
    await message.answer("Диалог завершён.", reply_markup=main_menu_kb())
    await _end_and_notify(message.bot, message.from_user.id, partner_tg, dialog_id)


@router.message(F.text == BTN_NEXT)
async def next_dialog(message: Message, user_record: dict | None = None) -> None:
    result = await matcher.end_dialog(message.from_user.id, message.from_user.id)
    if not result:
        await message.answer("Ты не в диалоге.", reply_markup=main_menu_kb())
        return

    partner_tg, dialog_id = result
    try:
        await message.bot.send_message(
            partner_tg,
            "Собеседник вышел из диалога.",
            reply_markup=main_menu_kb(),
        )
    except TelegramBadRequest:
        pass
    await _send_rating_prompts(message.bot, message.from_user.id, partner_tg, dialog_id)

    user = user_record or await db.get_user_by_tg(message.from_user.id)
    if not user:
        return

    new_partner = await matcher.try_match(
        tg_id=user["tg_id"], age=user["age"], gender=user["gender"], mode="random",
    )
    if new_partner is None:
        await message.answer("🔍 Ищу нового собеседника…", reply_markup=search_kb())
        return

    new_dialog = await matcher.start_dialog(user["tg_id"], new_partner, "random")
    text = "🎉 Новый собеседник! Начинай общение."
    await message.answer(text, reply_markup=chat_kb())
    try:
        await message.bot.send_message(new_partner, text, reply_markup=chat_kb())
    except TelegramBadRequest:
        pass
    _ = new_dialog


@router.message(F.chat.type == "private")
async def relay(message: Message) -> None:
    pair = await matcher.get_partner(message.from_user.id)
    if not pair:
        return

    partner_tg = pair["partner_id"]

    if pair["partner_hide_media"] and _has_media(message):
        await message.bot.send_message(
            partner_tg,
            "📷 Собеседник прислал фото/видео — скрыто твоими настройками.",
        )
        return

    try:
        await message.bot.copy_message(
            chat_id=partner_tg,
            from_chat_id=message.chat.id,
            message_id=message.message_id,
        )
    except TelegramBadRequest:
        await message.answer("⚠️ Не удалось доставить сообщение собеседнику.")
