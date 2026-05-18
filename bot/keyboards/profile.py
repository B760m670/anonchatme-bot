from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def profile_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="✏️ Изменить возраст", callback_data="profile:edit_age"))
    kb.row(InlineKeyboardButton(text="📜 История диалогов", callback_data="profile:history:0"))
    kb.row(InlineKeyboardButton(text="⚙️ Настройки диалогов", callback_data="profile:settings"))
    kb.row(InlineKeyboardButton(text="⭐ Премиум", callback_data="profile:premium"))
    return kb.as_markup()


def history_kb(page: int, total_pages: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️", callback_data=f"profile:history:{page - 1}"))
    if total_pages > 1:
        nav_row.append(InlineKeyboardButton(
            text=f"{page + 1}/{total_pages}", callback_data="profile:history:noop",
        ))
    if page + 1 < total_pages:
        nav_row.append(InlineKeyboardButton(text="▶️", callback_data=f"profile:history:{page + 1}"))
    if nav_row:
        kb.row(*nav_row)
    kb.row(InlineKeyboardButton(text="⬅️ В профиль", callback_data="profile:back"))
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
