import logging

from aiogram import F, Router
from aiogram.types import (
    CallbackQuery,
    LabeledPrice,
    Message,
    PreCheckoutQuery,
)

from bot.services.premium import PLANS, activate_premium

router = Router(name="premium")
log = logging.getLogger(__name__)


@router.callback_query(F.data.startswith("premium:buy:"))
async def buy_premium(call: CallbackQuery) -> None:
    code = call.data.split(":", 2)[2]
    plan = PLANS.get(code)
    if not plan:
        await call.answer("Неизвестный тариф", show_alert=True)
        return

    await call.bot.send_invoice(
        chat_id=call.from_user.id,
        title=f"Premium — {plan.label}",
        description=(
            "💎 Premium открывает Флирт-комнату и показывает пол/возраст собеседника. "
            f"Срок действия: {plan.label}."
        ),
        payload=plan.code,
        provider_token="",   # для Telegram Stars провайдер не нужен
        currency="XTR",
        prices=[LabeledPrice(label=plan.label, amount=plan.stars)],
    )
    await call.answer()


@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery) -> None:
    if query.invoice_payload in PLANS:
        await query.answer(ok=True)
    else:
        await query.answer(ok=False, error_message="Тариф недоступен")


@router.message(F.successful_payment)
async def on_successful_payment(message: Message) -> None:
    payment = message.successful_payment
    plan = PLANS.get(payment.invoice_payload)
    if not plan:
        log.warning("Unknown plan in successful payment: %s", payment.invoice_payload)
        await message.answer("⚠️ Платёж получен, но тариф не найден. Напиши админу.")
        return

    await activate_premium(message.from_user.id, plan.days)
    await message.answer(
        f"🎉 <b>Premium активирован!</b>\n\n"
        f"Тариф: {plan.label}\n"
        f"Списано: ⭐ {plan.stars}\n\n"
        f"Теперь тебе доступна Флирт-комната и видимость пола/возраста собеседника. "
        f"Открой /room чтобы сменить комнату.",
        parse_mode="HTML",
    )
