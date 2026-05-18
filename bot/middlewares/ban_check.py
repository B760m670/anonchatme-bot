from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, User

from bot.services import db


class BanCheckMiddleware(BaseMiddleware):
    """Loads the current user once and exposes it to handlers via `data['user_record']`.

    Cached in Redis for 60s by `db.get_user_by_tg`, so repeat calls are cheap.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user: User | None = data.get("event_from_user")
        if user is None:
            return await handler(event, data)

        record = await db.get_user_by_tg(user.id)
        if record and record.get("banned"):
            return None

        data["user_record"] = record
        return await handler(event, data)
