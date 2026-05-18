import logging
from urllib.parse import urlencode

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, Message

from bot.config import settings
from bot.keyboards.call import call_invite_kb, call_type_kb, open_webapp_kb
from bot.keyboards.chat import BTN_CALL
from bot.services import db, matcher

router = Router(name="call")
log = logging.getLogger(__name__)

INVITE_TEXT = (
    "📞 Собеседник хочет {kind} тебе позвонить.\n\n"
    "🔒 Вся ваша информация полностью защищена."
)
KIND_LABEL = {"audio": "🎤 аудио", "video": "📹 видео"}


def _build_call_url(dialog_id: int, tg_id: int, *, role: str, call_type: str) -> str:
    base = (settings.webapp_url or "").rstrip("/")
    if not base:
        return ""
    params = urlencode({
        "d": dialog_id,
        "u": tg_id,
        "r": role,        # "caller" | "callee"
        "t": call_type,   # "audio" | "video"
    })
    return f"{base}/call?{params}"


async def _check_call_allowed(tg_id: int, partner_tg: int) -> tuple[bool, str | None]:
    user = await db.get_user_by_tg(tg_id)
    partner = await db.get_user_by_tg(partner_tg)
    if not user or not partner:
        return False, "Пользователь не найден"
    if not (user.get("settings") or {}).get("allow_calls", True):
        return False, "У тебя в настройках отключены звонки. Включи их в Профиле → Настройки диалогов."
    if not (partner.get("settings") or {}).get("allow_calls", True):
        return False, "У собеседника в настройках отключены звонки."
    return True, None


@router.message(F.text == BTN_CALL)
async def on_call_button(message: Message) -> None:
    pair = await matcher.get_partner(message.from_user.id)
    if not pair:
        await message.answer("Ты не в диалоге. Сначала найди собеседника.")
        return

    ok, reason = await _check_call_allowed(message.from_user.id, pair["partner_id"])
    if not ok:
        await message.answer(f"⚠️ {reason}")
        return

    await message.answer("Выбери тип звонка:", reply_markup=call_type_kb())


@router.callback_query(F.data == "call:cancel")
async def cancel_invite(call: CallbackQuery) -> None:
    await call.message.delete()
    await call.answer()


@router.callback_query(F.data.startswith("call:invite:"))
async def send_invite(call: CallbackQuery) -> None:
    call_type = call.data.split(":", 2)[2]
    if call_type not in ("audio", "video"):
        await call.answer()
        return

    pair = await matcher.get_partner(call.from_user.id)
    if not pair:
        await call.message.edit_text("Диалог завершён.")
        await call.answer()
        return

    ok, reason = await _check_call_allowed(call.from_user.id, pair["partner_id"])
    if not ok:
        await call.message.edit_text(f"⚠️ {reason}")
        await call.answer()
        return

    partner_tg = pair["partner_id"]
    try:
        await call.bot.send_message(
            partner_tg,
            INVITE_TEXT.format(kind=KIND_LABEL[call_type]),
            reply_markup=call_invite_kb(call.from_user.id, call_type),
        )
    except TelegramBadRequest as e:
        log.warning("Failed to send call invite: %s", e)
        await call.message.edit_text("⚠️ Не удалось доставить приглашение.")
        await call.answer()
        return

    await call.message.edit_text("📞 Приглашение отправлено. Ждём ответ собеседника…")
    await call.answer()


@router.callback_query(F.data.startswith("call:decline:"))
async def decline_call(call: CallbackQuery) -> None:
    caller_tg = int(call.data.split(":", 2)[2])
    await call.message.edit_text("❌ Звонок отклонён. Можно продолжить диалог в чате.")
    try:
        await call.bot.send_message(caller_tg, "❌ Собеседник отклонил звонок. Можно продолжить диалог в чате.")
    except TelegramBadRequest:
        pass
    await call.answer()


@router.callback_query(F.data.startswith("call:accept:"))
async def accept_call(call: CallbackQuery) -> None:
    parts = call.data.split(":")
    if len(parts) != 4:
        await call.answer()
        return
    caller_tg = int(parts[2])
    call_type = parts[3]

    pair = await matcher.get_partner(call.from_user.id)
    if not pair or pair["partner_id"] != caller_tg:
        await call.message.edit_text("Диалог завершён — звонок невозможен.")
        await call.answer()
        return

    dialog_id = pair["dialog_id"]

    if not settings.webapp_url:
        await call.message.edit_text("⚠️ WebApp для звонков ещё не настроен. Сообщите админу.")
        await call.answer()
        return

    callee_url = _build_call_url(dialog_id, call.from_user.id, role="callee", call_type=call_type)
    caller_url = _build_call_url(dialog_id, caller_tg, role="caller", call_type=call_type)

    text = "✅ Звонок принят. Нажми кнопку, чтобы открыть приложение для звонка."

    await call.message.edit_text(text, reply_markup=open_webapp_kb(callee_url))
    try:
        await call.bot.send_message(caller_tg, text, reply_markup=open_webapp_kb(caller_url))
    except TelegramBadRequest as e:
        log.warning("Failed to send caller webapp button: %s", e)

    await call.answer()
