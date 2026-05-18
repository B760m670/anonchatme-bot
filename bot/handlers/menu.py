from aiogram import F, Router
from aiogram.types import Message

from bot.keyboards.main_menu import BTN_FLIRT, BTN_PROFILE, main_menu_kb

router = Router(name="menu")


@router.message(F.text == BTN_FLIRT)
async def on_flirt(message: Message) -> None:
    await message.answer(
        "💖 Флирт-чат — в разработке.\n"
        "Здесь будет видна анкета собеседника и премиум-статус."
    )


@router.message(F.text == BTN_PROFILE)
async def on_profile(message: Message, user_record: dict | None = None) -> None:
    from bot.handlers.profile import show_profile
    await show_profile(message, user_record=user_record)


@router.message(F.text == "/menu")
async def cmd_menu(message: Message) -> None:
    await message.answer("Главное меню:", reply_markup=main_menu_kb())
