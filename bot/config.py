from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str
    admin_ids: str = ""

    supabase_url: str
    supabase_key: str

    redis_url: str

    webapp_url: str = ""

    webhook_url: str = ""
    webhook_secret: str = ""
    port: int = 8080

    @property
    def admin_id_list(self) -> list[int]:
        return [int(x.strip()) for x in self.admin_ids.split(",") if x.strip()]

    @property
    def webhook_path(self) -> str:
        return "/webhook"


settings = Settings()
