from aiogram import F, Router
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from bot.config import settings
from bot.keyboards.main_menu import BTN_GAME

router = Router(name="game")


@router.message(F.text == BTN_GAME)
async def on_game(message: Message) -> None:
    url = (settings.webapp_url.rstrip("/") + "/game") if settings.webapp_url else None

    text = (
        "⚔️ <b>Тени Эдо</b> — аниме RPG про самураев\n\n"
        "Феодальная Япония. Пять кланов. Ты — ронин без прошлого.\n\n"
        "• <b>Сюжет</b> — 6 глав с боссами\n"
        "• <b>PvP</b> — дуэли против других игроков\n"
        "• <b>5 кланов</b> — Кагэ, Хоно, Коори, Кадзэ, Тэцу\n"
        "• <b>Рейтинг ELO</b> — стань сильнейшим самураем\n\n"
        "Выбери клан и начни свой путь:"
    )

    if url:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🎮 Открыть игру", web_app={"url": url})],
        ])
        await message.answer(text, reply_markup=kb)
    else:
        await message.answer(text + "\n\n<i>Webapp URL не настроен</i>")
