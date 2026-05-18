from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder


def call_type_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="🎤 Аудио", callback_data="call:invite:audio"),
        InlineKeyboardButton(text="📹 Видео", callback_data="call:invite:video"),
    )
    kb.row(InlineKeyboardButton(text="❌ Отмена", callback_data="call:cancel"))
    return kb.as_markup()


def call_invite_kb(caller_tg: int, call_type: str) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="✅ Принять", callback_data=f"call:accept:{caller_tg}:{call_type}"),
        InlineKeyboardButton(text="❌ Отклонить", callback_data=f"call:decline:{caller_tg}"),
    )
    return kb.as_markup()


def open_webapp_kb(url: str) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="🚀 Открыть звонок", web_app=WebAppInfo(url=url)))
    return kb.as_markup()
