from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def gender_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="\U0001f6b9 Парень", callback_data="gender:male"),
        InlineKeyboardButton(text="\U0001f6ba Девушка", callback_data="gender:female"),
    )
    return kb.as_markup()
