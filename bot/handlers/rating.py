from aiogram import F, Router
from aiogram.types import CallbackQuery

from bot.services import db

router = Router(name="rating")


@router.callback_query(F.data.startswith("rate:"))
async def on_rate(call: CallbackQuery) -> None:
    try:
        _, dialog_id, target_tg, value = call.data.split(":")
        dialog_id = int(dialog_id)
        target_tg = int(target_tg)
        value = int(value)
    except (ValueError, AttributeError):
        await call.answer("Ошибка", show_alert=True)
        return

    if value not in (-1, 1):
        await call.answer("Ошибка", show_alert=True)
        return

    from_user = await db.get_user_by_tg(call.from_user.id)
    to_user = await db.get_user_by_tg(target_tg)
    if not from_user or not to_user:
        await call.answer("Пользователь не найден", show_alert=True)
        return

    existing = (
        db.get_db().table("ratings")
        .select("id")
        .eq("dialog_id", dialog_id)
        .eq("from_user", from_user["id"])
        .execute()
    )
    if existing.data:
        await call.answer("Ты уже оценил этот диалог.", show_alert=True)
        return

    db.get_db().table("ratings").insert({
        "dialog_id": dialog_id,
        "from_user": from_user["id"],
        "to_user": to_user["id"],
        "value": value,
    }).execute()

    field = "likes_count" if value == 1 else "dislikes_count"
    new_total = (to_user.get(field) or 0) + 1
    db.get_db().table("users").update({field: new_total}).eq("id", to_user["id"]).execute()

    label = "👍 Лайк" if value == 1 else "👎 Дизлайк"
    await call.message.edit_text(f"Спасибо! Твоя оценка: {label}")
    await call.answer()
