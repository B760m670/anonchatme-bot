from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.keyboards.main_menu import BTN_ROOM, main_menu_kb
from bot.keyboards.rooms import premium_wall_kb, room_picker_kb
from bot.services import db, rooms
from bot.services.rooms import ROOM_LABEL, Room

router = Router(name="rooms")


PREMIUM_WALL_TEXT = (
    "Общайся с 💎 <b>PREMIUM</b> без ограничений!\n\n"
    "👫 Поиск по полу\n"
    "🍒 Доступ в Флирт-комнату\n"
    "👥 Видишь пол и возраст собеседника\n"
    "💎 Твой PREMIUM-статус виден всем\n"
    "⚡ Быстрый поиск и никакой рекламы"
)


async def _show_picker(message: Message) -> None:
    current = await rooms.get_room(message.from_user.id)
    await message.answer(
        f"🚪 <b>Выберите комнату для поиска</b>\n\nТекущая: {ROOM_LABEL[current]}",
        reply_markup=room_picker_kb(current),
        parse_mode="HTML",
    )


@router.message(Command("room"))
async def cmd_room(message: Message) -> None:
    await _show_picker(message)


@router.message(F.text == BTN_ROOM)
async def btn_room(message: Message) -> None:
    await _show_picker(message)


@router.callback_query(F.data.startswith("room:set:"))
async def set_room(call: CallbackQuery, user_record: dict | None = None) -> None:
    target: Room = call.data.split(":", 2)[2]  # type: ignore[assignment]
    if target not in ("general", "flirt"):
        await call.answer()
        return

    if target == "flirt":
        user = user_record or await db.get_user_by_tg(call.from_user.id)
        if not user or not db.is_premium(user):
            await call.message.edit_text(
                PREMIUM_WALL_TEXT,
                reply_markup=premium_wall_kb(),
                parse_mode="HTML",
            )
            await call.answer("Флирт-комната доступна только с Premium")
            return

    await rooms.set_room(call.from_user.id, target)
    await call.message.edit_text(
        f"✅ Текущая комната: <b>{ROOM_LABEL[target]}</b>\n\nИспользуй «🔍 Поиск собеседника» в меню.",
        parse_mode="HTML",
    )
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb())
    await call.answer()


@router.callback_query(F.data == "premium:back")
async def premium_back(call: CallbackQuery) -> None:
    await call.message.delete()
    await call.message.answer("Главное меню:", reply_markup=main_menu_kb())
    await call.answer()


@router.callback_query(F.data == "premium:referral")
async def premium_referral(call: CallbackQuery) -> None:
    await call.answer(
        "🎁 Реферальная программа в разработке. Скоро сможешь получать дни Premium за приглашённых друзей.",
        show_alert=True,
    )
