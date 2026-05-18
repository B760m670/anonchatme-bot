from typing import Literal

from bot.services.redis_client import get_redis

Room = Literal["general", "flirt"]
ROOM_LABEL = {"general": "💬 Общение", "flirt": "🍒 Флирт комната"}
DEFAULT_ROOM: Room = "general"

KEY_ROOM = "room:{user_id}"


async def get_room(tg_id: int) -> Room:
    raw = await get_redis().get(KEY_ROOM.format(user_id=tg_id))
    if raw in ("general", "flirt"):
        return raw  # type: ignore[return-value]
    return DEFAULT_ROOM


async def set_room(tg_id: int, room: Room) -> None:
    await get_redis().set(KEY_ROOM.format(user_id=tg_id), room)
