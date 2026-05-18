from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove

from bot.keyboards.main_menu import main_menu_kb
from bot.keyboards.registration import gender_kb
from bot.services import db, matcher
from bot.states.registration import Registration

router = Router(name="start")

WELCOME = (
    "👋 Привет! Это анонимный чат-бот.\n\n"
    "Здесь ты сможешь:\n"
    "• Найти случайного собеседника\n"
    "• Искать по полу и возрасту\n"
    "• Зайти во флирт-чат\n"
    "• Совершать анонимные звонки\n\n"
    "Для начала укажи свой пол:"
)

AGE_PROMPT = "Сколько тебе лет? Отправь число от 13 до 25."
AGE_INVALID = "❗ Возраст должен быть числом от 13 до 25. Попробуй ещё раз."
DONE = "✅ Регистрация завершена! Выбирай раздел:"


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    await state.clear()
    pair = await matcher.get_partner(message.from_user.id)
    if pair:
        await matcher.end_dialog(message.from_user.id, message.from_user.id)
    await matcher.remove_from_queues(message.from_user.id)
    await matcher.clear_state(message.from_user.id)

    user = await db.get_user_by_tg(message.from_user.id)
    if user and user.get("gender") and user.get("age"):
        await message.answer("С возвращением! 👋", reply_markup=main_menu_kb())
        return

    if not user:
        await db.create_user(message.from_user.id, message.from_user.username)

    await message.answer(WELCOME, reply_markup=gender_kb())
    await state.set_state(Registration.waiting_for_gender)


@router.callback_query(Registration.waiting_for_gender, F.data.startswith("gender:"))
async def pick_gender(call: CallbackQuery, state: FSMContext) -> None:
    gender = call.data.split(":", 1)[1]
    await db.update_user(call.from_user.id, {"gender": gender})
    await call.message.edit_reply_markup(reply_markup=None)
    await call.message.answer(AGE_PROMPT, reply_markup=ReplyKeyboardRemove())
    await state.set_state(Registration.waiting_for_age)
    await call.answer()


@router.message(Registration.waiting_for_age)
async def pick_age(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if not text.isdigit():
        await message.answer(AGE_INVALID)
        return
    age = int(text)
    if not 13 <= age <= 25:
        await message.answer(AGE_INVALID)
        return

    await db.update_user(message.from_user.id, {"age": age})
    await state.clear()
    await message.answer(DONE, reply_markup=main_menu_kb())
