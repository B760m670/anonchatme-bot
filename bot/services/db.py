import asyncio
import json
from datetime import datetime
from typing import Any

from supabase import Client, create_client

from bot.config import settings
from bot.services.redis_client import get_redis

_client: Client | None = None

USER_CACHE_KEY = "cache:user:{tg_id}"
USER_CACHE_TTL = 60


def get_db() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


def _sync_get_user(tg_id: int) -> dict[str, Any] | None:
    res = get_db().table("users").select("*").eq("tg_id", tg_id).limit(1).execute()
    return res.data[0] if res.data else None


async def get_user_by_tg(tg_id: int, *, use_cache: bool = True) -> dict[str, Any] | None:
    r = get_redis()
    key = USER_CACHE_KEY.format(tg_id=tg_id)
    if use_cache:
        cached = await r.get(key)
        if cached:
            return json.loads(cached)

    user = await asyncio.to_thread(_sync_get_user, tg_id)
    if user is not None:
        await r.setex(key, USER_CACHE_TTL, json.dumps(user, default=str))
    return user


async def invalidate_user_cache(tg_id: int) -> None:
    await get_redis().delete(USER_CACHE_KEY.format(tg_id=tg_id))


def _sync_create_user(tg_id: int, username: str | None) -> dict[str, Any]:
    payload = {"tg_id": tg_id, "username": username}
    res = get_db().table("users").insert(payload).execute()
    return res.data[0]


async def create_user(tg_id: int, username: str | None) -> dict[str, Any]:
    user = await asyncio.to_thread(_sync_create_user, tg_id, username)
    await invalidate_user_cache(tg_id)
    return user


def _sync_update_user(tg_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    res = get_db().table("users").update(fields).eq("tg_id", tg_id).execute()
    return res.data[0]


async def update_user(tg_id: int, fields: dict[str, Any]) -> dict[str, Any]:
    user = await asyncio.to_thread(_sync_update_user, tg_id, fields)
    await invalidate_user_cache(tg_id)
    return user


async def update_settings(tg_id: int, key: str, value: Any) -> dict[str, Any]:
    user = await get_user_by_tg(tg_id, use_cache=False)
    current = (user or {}).get("settings") or {}
    current[key] = value
    return await update_user(tg_id, {"settings": current})


def _sync_dialog_history(user_db_id: int, limit: int, offset: int) -> list[dict[str, Any]]:
    res = (
        get_db().table("dialogs")
        .select("id, mode, started_at, ended_at, ended_by, user_a, user_b")
        .or_(f"user_a.eq.{user_db_id},user_b.eq.{user_db_id}")
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return res.data or []


def _sync_dialog_count(user_db_id: int) -> int:
    res = (
        get_db().table("dialogs")
        .select("id", count="exact")
        .or_(f"user_a.eq.{user_db_id},user_b.eq.{user_db_id}")
        .execute()
    )
    return res.count or 0


def _sync_ratings_for_dialogs(dialog_ids: list[int], from_db_id: int) -> list[dict[str, Any]]:
    if not dialog_ids:
        return []
    res = (
        get_db().table("ratings")
        .select("dialog_id, from_user, to_user, value")
        .in_("dialog_id", dialog_ids)
        .execute()
    )
    return res.data or []


async def get_dialog_history(user_db_id: int, *, limit: int = 5, offset: int = 0) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_sync_dialog_history, user_db_id, limit, offset)


async def get_dialog_count(user_db_id: int) -> int:
    return await asyncio.to_thread(_sync_dialog_count, user_db_id)


async def get_ratings_for_dialogs(dialog_ids: list[int], from_db_id: int) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_sync_ratings_for_dialogs, dialog_ids, from_db_id)


def is_premium(user: dict[str, Any]) -> bool:
    raw = user.get("premium_until")
    if not raw:
        return False
    ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return ts > datetime.now(ts.tzinfo)
