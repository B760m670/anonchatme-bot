from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

BTN_NEXT = "⏭ Следующий"
BTN_STOP = "🛑 Стоп"
BTN_CALL = "📞 Звонок"
BTN_CANCEL_SEARCH = "🛑 Отменить поиск"


def chat_kb() -> ReplyKeyboardMarkup:
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton(text=BTN_NEXT), KeyboardButton(text=BTN_STOP))
    kb.row(KeyboardButton(text=BTN_CALL))
    return kb.as_markup(resize_keyboard=True)


def search_kb() -> ReplyKeyboardMarkup:
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton(text=BTN_CANCEL_SEARCH))
    return kb.as_markup(resize_keyboard=True)


def rating_kb(dialog_id: int, target_tg: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="👍", callback_data=f"rate:{dialog_id}:{target_tg}:1"),
        InlineKeyboardButton(text="👎", callback_data=f"rate:{dialog_id}:{target_tg}:-1"),
    )
    return kb.as_markup()
