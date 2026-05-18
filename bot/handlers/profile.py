from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.main_menu import main_menu_kb
from bot.keyboards.profile import profile_kb, settings_kb
from bot.services import db
from bot.states.registration import ProfileEdit

router = Router(name="profile")

GENDER_LABEL = {"male": "🚹 Парень", "female": "🚺 Девушка"}


def _format_profile(user: dict) -> str:
    gender = GENDER_LABEL.get(user.get("gender", ""), "не указан")
    age = user.get("age") or "—"
    likes = user.get("likes_count", 0)
    dislikes = user.get("dislikes_count", 0)
    dialogs = user.get("dialogs_count", 0)
    premium = "⭐ Активен" if db.is_premium(user) else "—"
    return (
        "👤 <b>Мой профиль</b>\n\n"
        f"Пол: {gender}\n"
        f"Возраст: {age}\n"
        f"Диалогов: {dialogs}\n"
        f"👍 Лайков: {likes}\n"
        f"👎 Дизлайков: {dislikes}\n"
        f"Премиум: {premium}"
    )


async def show_profile(message: Message, user_record: dict | None = None) -> None:
    user = user_record or await db.get_user_by_tg(message.from_user.id)
    if not user:
        await message.answer("Сначала пройди регистрацию: /start")
        return
    await message.answer(_format_profile(user), reply_markup=profile_kb(), parse_mode="HTML")


@router.callback_query(F.data == "profile:edit_age")
async def edit_age(call: CallbackQuery, state: FSMContext) -> None:
    await call.message.answer("Введи новый возраст (14–99):")
    await state.set_state(ProfileEdit.waiting_for_age)
    await call.answer()


@router.message(ProfileEdit.waiting_for_age)
async def save_age(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if not text.isdigit() or not 14 <= int(text) <= 99:
        await message.answer("❗ Возраст должен быть числом от 14 до 99.")
        return
    await db.update_user(message.from_user.id, {"age": int(text)})
    await state.clear()
    await message.answer("✅ Возраст обновлён.", reply_markup=main_menu_kb())


@router.callback_query(F.data == "profile:settings")
async def open_settings(call: CallbackQuery) -> None:
    user = await db.get_user_by_tg(call.from_user.id)
    s = (user or {}).get("settings") or {}
    await call.message.edit_text("⚙️ <b>Настройки диалогов</b>", reply_markup=settings_kb(s), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("settings:toggle:"))
async def toggle_setting(call: CallbackQuery) -> None:
    key = call.data.split(":", 2)[2]
    user = await db.get_user_by_tg(call.from_user.id)
    if not user:
        await call.answer("Сначала /start", show_alert=True)
        return

    if key == "hide_likes" and not db.is_premium(user):
        await call.answer("Эта функция доступна только Premium ⭐", show_alert=True)
        return

    current = (user.get("settings") or {}).get(key, False)
    updated = await db.update_settings(call.from_user.id, key, not current)
    await call.message.edit_reply_markup(reply_markup=settings_kb(updated["settings"]))
    await call.answer()


@router.callback_query(F.data == "settings:back")
async def settings_back(call: CallbackQuery) -> None:
    user = await db.get_user_by_tg(call.from_user.id)
    await call.message.edit_text(_format_profile(user), reply_markup=profile_kb(), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data == "profile:premium")
async def premium_info(call: CallbackQuery) -> None:
    await call.answer(
        "Premium даёт возможность скрыть свои лайки. Покупка появится позже.",
        show_alert=True,
    )
