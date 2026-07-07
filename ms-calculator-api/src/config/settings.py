"""Application settings loaded from environment variables via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All env-configurable settings for ms-calculator-api."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "ms-calculator-api"
    APP_PORT: int = 3011
    APP_LOG_LEVEL: str = "info"
    NODE_ENV: str = "local"

    # RabbitMQ
    RABBITMQ_HOST: str = "127.0.0.1"
    RABBITMQ_PORT: int = 5672
    RABBITMQ_USER: str = "guest"
    RABBITMQ_PASSWORD: str = "guest"
    RABBITMQ_VHOST: str = "/"
    RABBITMQ_PREFETCH: int = 10

    # Reservoir configuration
    RESERVOIR_CONFIG_PATH: str = "src/config/reservoir_parameters.json"

    # Health check
    HEALTH_AMQP_TIMEOUT_MS: int = 1000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
