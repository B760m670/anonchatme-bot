from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from bot.services.premium import PLANS
from bot.services.rooms import ROOM_LABEL, Room


def room_picker_kb(current: Room) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for room in ("general", "flirt"):
        mark = "✅ " if room == current else ""
        kb.row(InlineKeyboardButton(
            text=f"{mark}{ROOM_LABEL[room]}",
            callback_data=f"room:set:{room}",
        ))
    return kb.as_markup()


def premium_wall_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text=f"1 день — ⭐ {PLANS['premium_1d'].stars}",
                                callback_data="premium:buy:premium_1d"))
    kb.row(InlineKeyboardButton(text=f"3 дня — ⭐ {PLANS['premium_3d'].stars}",
                                callback_data="premium:buy:premium_3d"))
    kb.row(InlineKeyboardButton(text=f"7 дней — ⭐ {PLANS['premium_7d'].stars}",
                                callback_data="premium:buy:premium_7d"))
    kb.row(InlineKeyboardButton(text=f"Месяц — ⭐ {PLANS['premium_30d'].stars}",
                                callback_data="premium:buy:premium_30d"))
    kb.row(InlineKeyboardButton(text=f"Год — ⭐ {PLANS['premium_365d'].stars}",
                                callback_data="premium:buy:premium_365d"))
    kb.row(InlineKeyboardButton(text="🎁 Бесплатный PREMIUM за друзей!",
                                callback_data="premium:referral"))
    kb.row(InlineKeyboardButton(text="⬅️ Вернуться в меню",
                                callback_data="premium:back"))
    return kb.as_markup()
