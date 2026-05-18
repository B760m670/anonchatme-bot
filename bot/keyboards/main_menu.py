from aiogram.types import KeyboardButton, ReplyKeyboardMarkup
from aiogram.utils.keyboard import ReplyKeyboardBuilder

BTN_SEARCH = "\U0001f50d Поиск собеседника"
BTN_SEARCH_GENDER = "\U0001f6b9\U0001f6ba Поиск по полу"
BTN_FLIRT = "\U0001f496 Флирт чат"
BTN_PROFILE = "\U0001f464 Мой профиль"


def main_menu_kb() -> ReplyKeyboardMarkup:
    kb = ReplyKeyboardBuilder()
    kb.row(KeyboardButton(text=BTN_SEARCH))
    kb.row(KeyboardButton(text=BTN_SEARCH_GENDER), KeyboardButton(text=BTN_FLIRT))
    kb.row(KeyboardButton(text=BTN_PROFILE))
    return kb.as_markup(resize_keyboard=True)
