from typing import Literal

from bot.services import db
from bot.services.redis_client import get_redis

AGE_TOLERANCE = 3

Mode = Literal["random", "by_gender"]
Room = Literal["general", "flirt"]

KEY_QUEUE_RANDOM = "queue:room:{room}:random"
KEY_QUEUE_GENDER = "queue:room:{room}:gender:{gender}"
KEY_PAIR = "pair:{user_id}"
KEY_STATE = "state:{user_id}"
KEY_RATING_TARGET = "rating_target:{user_id}"

STATE_IDLE = "idle"
STATE_SEARCHING = "searching"
STATE_IN_DIALOG = "in_dialog"

_ALL_ROOMS: tuple[Room, ...] = ("general", "flirt")


async def get_state(tg_id: int) -> str:
    return await get_redis().get(KEY_STATE.format(user_id=tg_id)) or STATE_IDLE


async def set_state(tg_id: int, state: str) -> None:
    await get_redis().set(KEY_STATE.format(user_id=tg_id), state)


async def clear_state(tg_id: int) -> None:
    await get_redis().delete(KEY_STATE.format(user_id=tg_id))


async def get_partner(tg_id: int) -> dict | None:
    data = await get_redis().hgetall(KEY_PAIR.format(user_id=tg_id))
    if not data:
        return None
    return {
        "partner_id": int(data["partner_id"]),
        "dialog_id": int(data["dialog_id"]),
        "mode": data.get("mode", "random"),
        "room": data.get("room", "general"),
        "partner_hide_media": data.get("partner_hide_media") == "1",
    }


async def _save_pair(
    tg_a: int, tg_b: int, dialog_id: int, mode: Mode, room: Room,
    hide_media_a: bool, hide_media_b: bool,
) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.hset(KEY_PAIR.format(user_id=tg_a), mapping={
        "partner_id": tg_b, "dialog_id": dialog_id, "mode": mode, "room": room,
        "partner_hide_media": "1" if hide_media_b else "0",
    })
    pipe.hset(KEY_PAIR.format(user_id=tg_b), mapping={
        "partner_id": tg_a, "dialog_id": dialog_id, "mode": mode, "room": room,
        "partner_hide_media": "1" if hide_media_a else "0",
    })
    pipe.set(KEY_STATE.format(user_id=tg_a), STATE_IN_DIALOG)
    pipe.set(KEY_STATE.format(user_id=tg_b), STATE_IN_DIALOG)
    await pipe.execute()


async def _clear_pair(tg_a: int, tg_b: int) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.delete(KEY_PAIR.format(user_id=tg_a))
    pipe.delete(KEY_PAIR.format(user_id=tg_b))
    await pipe.execute()


def _search_queue_key(room: Room, mode: Mode, user_gender: str) -> str:
    if mode == "random":
        return KEY_QUEUE_RANDOM.format(room=room)
    target = "female" if user_gender == "male" else "male"
    return KEY_QUEUE_GENDER.format(room=room, gender=target)


def _own_queue_key(room: Room, mode: Mode, user_gender: str) -> str:
    if mode == "random":
        return KEY_QUEUE_RANDOM.format(room=room)
    return KEY_QUEUE_GENDER.format(room=room, gender=user_gender)


async def remove_from_queues(tg_id: int) -> None:
    r = get_redis()
    pipe = r.pipeline()
    for room in _ALL_ROOMS:
        pipe.zrem(KEY_QUEUE_RANDOM.format(room=room), tg_id)
        pipe.zrem(KEY_QUEUE_GENDER.format(room=room, gender="male"), tg_id)
        pipe.zrem(KEY_QUEUE_GENDER.format(room=room, gender="female"), tg_id)
    await pipe.execute()


async def try_match(
    tg_id: int, age: int, gender: str, mode: Mode, room: Room,
) -> int | None:
    """Try to find a partner in the given room. Returns partner tg_id or enqueues self."""
    r = get_redis()
    search_key = _search_queue_key(room, mode, gender)
    own_key = _own_queue_key(room, mode, gender)

    candidates = await r.zrangebyscore(search_key, age - AGE_TOLERANCE, age + AGE_TOLERANCE)
    for cand in candidates:
        cand_id = int(cand)
        if cand_id == tg_id:
            continue
        removed = await r.zrem(search_key, cand_id)
        if removed:
            await remove_from_queues(tg_id)
            return cand_id

    await remove_from_queues(tg_id)
    await r.zadd(own_key, {str(tg_id): age})
    await set_state(tg_id, STATE_SEARCHING)
    return None


async def start_dialog(tg_a: int, tg_b: int, mode: Mode, room: Room) -> int:
    user_a = await db.get_user_by_tg(tg_a)
    user_b = await db.get_user_by_tg(tg_b)
    if not user_a or not user_b:
        raise RuntimeError("Cannot start dialog: missing user record")
    res = db.get_db().table("dialogs").insert({
        "user_a": user_a["id"],
        "user_b": user_b["id"],
        "mode": mode,
        "room": room,
    }).execute()
    dialog_id = res.data[0]["id"]
    hide_a = bool((user_a.get("settings") or {}).get("hide_media", False))
    hide_b = bool((user_b.get("settings") or {}).get("hide_media", False))
    await _save_pair(tg_a, tg_b, dialog_id, mode, room, hide_a, hide_b)
    return dialog_id


async def end_dialog(tg_id: int, ended_by_tg: int) -> tuple[int, int] | None:
    pair = await get_partner(tg_id)
    if not pair:
        await clear_state(tg_id)
        return None

    partner_id = pair["partner_id"]
    dialog_id = pair["dialog_id"]

    ender = await db.get_user_by_tg(ended_by_tg)
    db.get_db().table("dialogs").update({
        "ended_at": "now()",
        "ended_by": ender["id"] if ender else None,
    }).eq("id", dialog_id).is_("ended_at", "null").execute()

    await _clear_pair(tg_id, partner_id)
    r = get_redis()
    pipe = r.pipeline()
    pipe.set(KEY_RATING_TARGET.format(user_id=tg_id), f"{partner_id}:{dialog_id}")
    pipe.set(KEY_RATING_TARGET.format(user_id=partner_id), f"{tg_id}:{dialog_id}")
    pipe.set(KEY_STATE.format(user_id=tg_id), STATE_IDLE)
    pipe.set(KEY_STATE.format(user_id=partner_id), STATE_IDLE)
    await pipe.execute()

    return partner_id, dialog_id


async def pop_rating_target(tg_id: int) -> tuple[int, int] | None:
    r = get_redis()
    key = KEY_RATING_TARGET.format(user_id=tg_id)
    raw = await r.get(key)
    if not raw:
        return None
    await r.delete(key)
    target, dialog = raw.split(":")
    return int(target), int(dialog)
