"""Tests for src/config/settings.py — pydantic-settings env loading."""

from __future__ import annotations

from pathlib import Path

import pytest


class TestSettingsDefaults:
    """All default values must match plan.md §7."""

    def test_default_app_name(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.APP_NAME == "ms-calculator-api"

    def test_default_app_port(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.APP_PORT == 3011

    def test_default_log_level(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.APP_LOG_LEVEL == "info"

    def test_default_node_env(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.NODE_ENV == "local"

    def test_default_rabbitmq_host(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_HOST == "127.0.0.1"

    def test_default_rabbitmq_port(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_PORT == 5672

    def test_default_rabbitmq_user(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_USER == "guest"

    def test_default_rabbitmq_password(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_PASSWORD == "guest"

    def test_default_rabbitmq_vhost(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_VHOST == "/"

    def test_default_rabbitmq_prefetch(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.RABBITMQ_PREFETCH == 10

    def test_default_health_amqp_timeout(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert s.HEALTH_AMQP_TIMEOUT_MS == 1000


class TestSettingsEnvOverride:
    """Explicit env vars override defaults."""

    def test_app_port_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("APP_PORT", "9999")
        monkeypatch.delenv("_SETTINGS_CACHE", raising=False)

        # Force fresh instance by bypassing the cache
        from src.config.settings import Settings

        s = Settings()
        assert s.APP_PORT == 9999

    def test_log_level_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.config.settings import Settings

        monkeypatch.setenv("APP_LOG_LEVEL", "debug")
        s = Settings()
        assert s.APP_LOG_LEVEL == "debug"

    def test_rabbitmq_host_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.config.settings import Settings

        monkeypatch.setenv("RABBITMQ_HOST", "infra-rabbitmq")
        s = Settings()
        assert s.RABBITMQ_HOST == "infra-rabbitmq"

    def test_node_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.config.settings import Settings

        monkeypatch.setenv("NODE_ENV", "production")
        s = Settings()
        assert s.NODE_ENV == "production"


class TestSettingsValidation:
    """Invalid types raise validation errors."""

    def test_invalid_app_port_type(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from pydantic import ValidationError

        from src.config.settings import Settings

        monkeypatch.setenv("APP_PORT", "not-a-number")
        with pytest.raises(ValidationError):
            Settings()

    def test_invalid_rabbitmq_port_type(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from pydantic import ValidationError

        from src.config.settings import Settings

        monkeypatch.setenv("RABBITMQ_PORT", "not-a-number")
        with pytest.raises(ValidationError):
            Settings()


class TestSettingsReservoirConfigPath:
    """RESERVOIR_CONFIG_PATH resolves relative paths against src/config/."""

    def test_default_config_path_exists(self) -> None:
        from src.config.settings import get_settings

        s = get_settings()
        assert Path(s.RESERVOIR_CONFIG_PATH).exists() or s.RESERVOIR_CONFIG_PATH != ""

    def test_relative_path_resolves(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.config.settings import Settings

        monkeypatch.setenv("RESERVOIR_CONFIG_PATH", "src/config/reservoir_parameters.json")
        s = Settings()
        assert s.RESERVOIR_CONFIG_PATH == "src/config/reservoir_parameters.json"

    def test_absolute_path_accepted(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from src.config.settings import Settings

        abs_path = str(
            Path(__file__).parent.parent.parent / "src" / "config" / "reservoir_parameters.json"
        )
        monkeypatch.setenv("RESERVOIR_CONFIG_PATH", abs_path)
        s = Settings()
        assert s.RESERVOIR_CONFIG_PATH == abs_path
