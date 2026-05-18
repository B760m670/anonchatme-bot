from datetime import datetime

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.main_menu import main_menu_kb
from bot.keyboards.profile import history_kb, profile_kb, settings_kb
from bot.services import db
from bot.states.registration import ProfileEdit

router = Router(name="profile")

GENDER_LABEL = {"male": "🚹 Парень", "female": "🚺 Девушка"}
MODE_LABEL = {"random": "🔍 Рандом", "by_gender": "🚹🚺 По полу", "flirt": "💖 Флирт"}
HISTORY_PAGE_SIZE = 5


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


@router.callback_query(F.data == "profile:back")
async def profile_back(call: CallbackQuery) -> None:
    user = await db.get_user_by_tg(call.from_user.id)
    if not user:
        await call.answer()
        return
    await call.message.edit_text(_format_profile(user), reply_markup=profile_kb(), parse_mode="HTML")
    await call.answer()


def _parse_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _format_duration(start: datetime, end: datetime | None) -> str:
    if not end:
        return "—"
    seconds = int((end - start).total_seconds())
    if seconds < 60:
        return f"{seconds}с"
    minutes, sec = divmod(seconds, 60)
    if minutes < 60:
        return f"{minutes}м {sec}с"
    hours, minutes = divmod(minutes, 60)
    return f"{hours}ч {minutes}м"


def _format_history_page(
    user: dict,
    dialogs: list[dict],
    ratings: list[dict],
    page: int,
    total_pages: int,
    total: int,
) -> str:
    if not dialogs:
        return "📜 <b>История диалогов</b>\n\nУ тебя пока нет завершённых диалогов."

    my_id = user["id"]
    ratings_by_dialog: dict[int, dict[str, int | None]] = {}
    for r in ratings:
        bucket = ratings_by_dialog.setdefault(r["dialog_id"], {"mine": None, "partner": None})
        if r["from_user"] == my_id:
            bucket["mine"] = r["value"]
        elif r["to_user"] == my_id:
            bucket["partner"] = r["value"]

    def emoji(v: int | None) -> str:
        if v == 1:
            return "👍"
        if v == -1:
            return "👎"
        return "—"

    lines = [
        f"📜 <b>История диалогов</b> ({total} всего)",
        f"Страница {page + 1}/{total_pages}",
        "",
    ]
    for d in dialogs:
        start = _parse_ts(d["started_at"])
        end = _parse_ts(d.get("ended_at"))
        mode_label = MODE_LABEL.get(d["mode"], d["mode"])
        date_str = start.strftime("%d.%m %H:%M") if start else "—"
        duration = _format_duration(start, end) if start else "—"
        r = ratings_by_dialog.get(d["id"], {"mine": None, "partner": None})
        lines.append(
            f"• <b>{date_str}</b> · {mode_label} · {duration}\n"
            f"   Моя оценка: {emoji(r['mine'])}  ·  Меня оценили: {emoji(r['partner'])}"
        )
    return "\n".join(lines)


@router.callback_query(F.data.startswith("profile:history:"))
async def show_history(call: CallbackQuery) -> None:
    payload = call.data.split(":", 2)[2]
    if payload == "noop":
        await call.answer()
        return
    try:
        page = max(0, int(payload))
    except ValueError:
        page = 0

    user = await db.get_user_by_tg(call.from_user.id)
    if not user:
        await call.answer("Сначала /start", show_alert=True)
        return

    total = await db.get_dialog_count(user["id"])
    total_pages = max(1, (total + HISTORY_PAGE_SIZE - 1) // HISTORY_PAGE_SIZE)
    page = min(page, total_pages - 1)
    offset = page * HISTORY_PAGE_SIZE

    dialogs = await db.get_dialog_history(user["id"], limit=HISTORY_PAGE_SIZE, offset=offset)
    dialog_ids = [d["id"] for d in dialogs]
    ratings = await db.get_ratings_for_dialogs(dialog_ids, user["id"]) if dialog_ids else []

    text = _format_history_page(user, dialogs, ratings, page, total_pages, total)
    try:
        await call.message.edit_text(text, reply_markup=history_kb(page, total_pages), parse_mode="HTML")
    except Exception:
        await call.message.answer(text, reply_markup=history_kb(page, total_pages), parse_mode="HTML")
    await call.answer()
