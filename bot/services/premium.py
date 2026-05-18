from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from bot.services import db


@dataclass(frozen=True)
class Plan:
    code: str
    days: int
    stars: int
    label: str


PLANS: dict[str, Plan] = {
    "premium_1d":   Plan("premium_1d",   1,   99,  "1 день"),
    "premium_3d":   Plan("premium_3d",   3,   149, "3 дня"),
    "premium_7d":   Plan("premium_7d",   7,   299, "7 дней"),
    "premium_30d":  Plan("premium_30d",  30,  499, "Месяц"),
    "premium_365d": Plan("premium_365d", 365, 999, "Год"),
}


async def activate_premium(tg_id: int, days: int) -> None:
    user = await db.get_user_by_tg(tg_id, use_cache=False)
    now = datetime.now(timezone.utc)
    current = None
    raw = (user or {}).get("premium_until")
    if raw:
        current = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    base = current if current and current > now else now
    new_until = base + timedelta(days=days)
    await db.update_user(tg_id, {"premium_until": new_until.isoformat()})
