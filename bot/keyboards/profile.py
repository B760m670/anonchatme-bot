from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def profile_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="✏️ Изменить возраст", callback_data="profile:edit_age"))
    kb.row(InlineKeyboardButton(text="⚙️ Настройки диалогов", callback_data="profile:settings"))
    kb.row(InlineKeyboardButton(text="⭐ Премиум", callback_data="profile:premium"))
    return kb.as_markup()


def settings_kb(settings: dict) -> InlineKeyboardMarkup:
    def mark(val: bool) -> str:
        return "✅" if val else "❌"

    hide_media = bool(settings.get("hide_media", False))
    allow_calls = bool(settings.get("allow_calls", True))
    allow_gifts = bool(settings.get("allow_gifts", True))
    hide_likes = bool(settings.get("hide_likes", False))

    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(
        text=f"{mark(hide_media)} Скрывать фото/видео",
        callback_data="settings:toggle:hide_media",
    ))
    kb.row(InlineKeyboardButton(
        text=f"{mark(allow_calls)} Разрешить звонки",
        callback_data="settings:toggle:allow_calls",
    ))
    kb.row(InlineKeyboardButton(
        text=f"{mark(allow_gifts)} Подарки",
        callback_data="settings:toggle:allow_gifts",
    ))
    kb.row(InlineKeyboardButton(
        text=f"{mark(hide_likes)} Скрывать лайки (Premium)",
        callback_data="settings:toggle:hide_likes",
    ))
    kb.row(InlineKeyboardButton(text="⬅️ Назад", callback_data="settings:back"))
    return kb.as_markup()
