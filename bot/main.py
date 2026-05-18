import asyncio
import logging
import secrets

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from bot.config import settings
from bot.handlers import admin, call, chat, menu, premium, profile, rating, rooms, search, start
from bot.middlewares.ban_check import BanCheckMiddleware
from bot.services.redis_client import close_redis, get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
log = logging.getLogger(__name__)


def _build_dispatcher() -> Dispatcher:
    storage = RedisStorage(redis=get_redis())
    dp = Dispatcher(storage=storage)

    dp.message.middleware(BanCheckMiddleware())
    dp.callback_query.middleware(BanCheckMiddleware())

    dp.include_router(admin.router)
    dp.include_router(start.router)
    dp.include_router(profile.router)
    dp.include_router(rating.router)
    dp.include_router(rooms.router)
    dp.include_router(premium.router)
    dp.include_router(call.router)
    dp.include_router(search.router)
    dp.include_router(menu.router)
    dp.include_router(chat.router)
    return dp


async def _run_polling(bot: Bot, dp: Dispatcher) -> None:
    log.info("Running in POLLING mode (local dev)")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


async def _run_webhook(bot: Bot, dp: Dispatcher) -> None:
    secret = settings.webhook_secret or secrets.token_urlsafe(32)
    url = settings.webhook_url.rstrip("/") + settings.webhook_path
    log.info("Running in WEBHOOK mode at %s (port %d)", url, settings.port)

    await bot.set_webhook(
        url=url,
        secret_token=secret,
        allowed_updates=dp.resolve_used_update_types(),
        drop_pending_updates=True,
    )

    app = web.Application()

    async def health(_request: web.Request) -> web.Response:
        return web.Response(text="ok")

    app.router.add_get("/", health)
    app.router.add_get("/health", health)

    SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=secret,
    ).register(app, path=settings.webhook_path)
    setup_application(app, dp, bot=bot)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host="0.0.0.0", port=settings.port)
    await site.start()
    await asyncio.Event().wait()


async def main() -> None:
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = _build_dispatcher()

    log.info("Bot @%s started", (await bot.get_me()).username)
    try:
        if settings.webhook_url:
            await _run_webhook(bot, dp)
        else:
            await _run_polling(bot, dp)
    finally:
        await close_redis()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
