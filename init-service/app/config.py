from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    s3_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_endpoint: str = ""
    port: int = 3001
    client_origin: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/yuvro"
    auth_cookie_name: str = "yuvro_session"
    auth_cookie_secure: bool = False
    auth_session_ttl_days: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  
    )


settings = Settings()
