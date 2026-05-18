import logging

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from bot.config import settings
from bot.handlers.search import format_match_message
from bot.keyboards.chat import BTN_NEXT, BTN_STOP, chat_kb, rating_kb, search_kb
from bot.keyboards.main_menu import main_menu_kb
from bot.services import db, matcher

log = logging.getLogger(__name__)

router = Router(name="chat")

RATING_PROMPT = "🗣 Можешь оставить отзыв о своем собеседнике?"


def _has_media(message: Message) -> bool:
    return bool(message.photo or message.video or message.video_note or message.animation)


def _is_media_for_admin(message: Message) -> bool:
    """Все типы медиа, которые имеет смысл отдавать админу на модерацию."""
    return bool(
        message.photo or message.video or message.video_note
        or message.voice or message.audio or message.animation or message.document
        or message.sticker
    )


async def _forward_media_to_admins(message: Message, partner_tg: int, dialog_id: int) -> None:
    """Дублирует медиа всем админам с кнопкой «🚫 Бан отправителя»."""
    if not _is_media_for_admin(message):
        return
    sender_tg = message.from_user.id
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=f"🚫 Бан {sender_tg}", callback_data=f"admin:ban:{sender_tg}"),
    ]])
    header = (
        f"📋 <b>Модерация</b>\n"
        f"Диалог <code>{dialog_id}</code>\n"
        f"От <code>{sender_tg}</code> → <code>{partner_tg}</code>"
    )
    for admin_id in settings.admin_id_list:
        try:
            await message.bot.send_message(admin_id, header, parse_mode="HTML")
            await message.bot.copy_message(
                chat_id=admin_id,
                from_chat_id=message.chat.id,
                message_id=message.message_id,
                reply_markup=kb,
            )
        except TelegramBadRequest as e:
            log.warning("admin forward failed for %s: %s", admin_id, e)
        except Exception as e:  # noqa: BLE001
            log.warning("admin forward error: %s", e)


async def _send_rating_prompts(bot: Bot, tg_a: int, tg_b: int, dialog_id: int) -> None:
    try:
        await bot.send_message(tg_a, RATING_PROMPT, reply_markup=rating_kb(dialog_id, tg_b))
    except TelegramBadRequest:
        pass
    try:
        await bot.send_message(tg_b, RATING_PROMPT, reply_markup=rating_kb(dialog_id, tg_a))
    except TelegramBadRequest:
        pass


@router.message(F.text == BTN_STOP)
async def stop_dialog(message: Message) -> None:
    result = await matcher.end_dialog(message.from_user.id, message.from_user.id)
    if not result:
        await message.answer("Ты не в диалоге.", reply_markup=main_menu_kb())
        return
    partner_tg, dialog_id = result
    await message.answer("Диалог завершён.", reply_markup=main_menu_kb())
    try:
        await message.bot.send_message(
            partner_tg, "Собеседник завершил диалог.", reply_markup=main_menu_kb(),
        )
    except TelegramBadRequest:
        pass
    await _send_rating_prompts(message.bot, message.from_user.id, partner_tg, dialog_id)


@router.message(F.text == BTN_NEXT)
async def next_dialog(message: Message, user_record: dict | None = None) -> None:
    result = await matcher.end_dialog(message.from_user.id, message.from_user.id)
    if not result:
        await message.answer("Ты не в диалоге.", reply_markup=main_menu_kb())
        return

    partner_tg, dialog_id = result
    try:
        await message.bot.send_message(
            partner_tg, "Собеседник вышел из диалога.", reply_markup=main_menu_kb(),
        )
    except TelegramBadRequest:
        pass
    await _send_rating_prompts(message.bot, message.from_user.id, partner_tg, dialog_id)

    user = user_record or await db.get_user_by_tg(message.from_user.id)
    if not user:
        return

    room = await rooms.get_room(user["tg_id"])
    new_partner = await matcher.try_match(
        tg_id=user["tg_id"], age=user["age"], gender=user["gender"], mode="random", room=room,
    )
    if new_partner is None:
        await message.answer("🔍 Ищу нового собеседника…", reply_markup=search_kb())
        return

    await matcher.start_dialog(user["tg_id"], new_partner, "random", room)
    partner = await db.get_user_by_tg(new_partner)

    user_premium = db.is_premium(user)
    partner_premium = bool(partner and db.is_premium(partner))

    await message.answer(
        format_match_message(room=room, partner=partner or {}, viewer_is_premium=user_premium),
        reply_markup=chat_kb(),
    )
    try:
        await message.bot.send_message(
            new_partner,
            format_match_message(room=room, partner=user, viewer_is_premium=partner_premium),
            reply_markup=chat_kb(),
        )
    except TelegramBadRequest:
        pass


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
        return

    await _forward_media_to_admins(message, partner_tg, pair["dialog_id"])
