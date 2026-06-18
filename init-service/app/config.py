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
    client_origins: str = "http://localhost:5173"
    public_base_url: str = "http://localhost:3001"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/yuvro"
    auth_cookie_secure: bool = False
    access_cookie_name: str = "yuvro_access"
    refresh_cookie_name: str = "yuvro_refresh"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    oauth_state_ttl_minutes: int = 10
    auth_secret_key: str = "dev-only-change-me"
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  
    )

    @property
    def allowed_client_origins(self) -> list[str]:
        return [origin.strip() for origin in self.client_origins.split(",") if origin.strip()]

    @property
    def default_client_origin(self) -> str:
        origins = self.allowed_client_origins
        return origins[0] if origins else "http://localhost:5173"

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.public_base_url.rstrip('/')}/auth/google/callback"

    @property
    def github_redirect_uri(self) -> str:
        return f"{self.public_base_url.rstrip('/')}/auth/github/callback"


settings = Settings()
