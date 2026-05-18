from aiogram.fsm.state import State, StatesGroup


class Registration(StatesGroup):
    waiting_for_gender = State()
    waiting_for_age = State()


class ProfileEdit(StatesGroup):
    waiting_for_age = State()
