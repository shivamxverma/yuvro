from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    s3_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_endpoint: str = ""
    admin_api_token: str = ""
    cas_gc_enabled: bool = False
    cas_gc_interval_minutes: int = 60
    cas_gc_grace_hours: int = 168
    cas_gc_batch_size: int = 500
    port: int = 3001
    client_origin: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/yuvro"
    auth_cookie_name: str = "yuvro_auth"
    auth_cookie_secure: bool = False
    auth_token_ttl_days: int = 30
    auth_secret_key: str = "dev-only-change-me"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  
    )


settings = Settings()
