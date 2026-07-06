"""E2E tests for GET /health endpoint."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


class TestGetHealthAmqpUp:
    """GET /health returns 200 when AMQP is connected."""

    @pytest.fixture
    def client_with_amqp_up(self):
        from unittest.mock import MagicMock

        from src.api.routes.health import router as health_router
        from src.infrastructure.logging.structlog_config import configure_logging

        configure_logging(level="info")

        # Mock a connected AMQP connection
        mock_conn = MagicMock()
        mock_conn.is_open.return_value = True

        test_app = FastAPI(title="test-health-up")
        test_app.include_router(health_router)
        test_app.state.amqp_connection = mock_conn

        with TestClient(test_app) as tc:
            yield tc

    def test_health_returns_200_when_amqp_connected(self, client_with_amqp_up: TestClient) -> None:
        response = client_with_amqp_up.get("/health")
        assert response.status_code == 200

    def test_health_body_status_ok(self, client_with_amqp_up: TestClient) -> None:
        response = client_with_amqp_up.get("/health")
        body = response.json()
        assert body["status"] == "ok"

    def test_health_body_amqp_check_ok(self, client_with_amqp_up: TestClient) -> None:
        response = client_with_amqp_up.get("/health")
        body = response.json()
        assert body["checks"]["amqp"] == "ok"


class TestGetHealthAmqpDown:
    """GET /health returns 503 when AMQP is disconnected."""

    @pytest.fixture
    def client_with_amqp_down(self):
        from unittest.mock import MagicMock

        from src.api.routes.health import router as health_router
        from src.infrastructure.logging.structlog_config import configure_logging

        configure_logging(level="info")

        # Mock a disconnected AMQP connection
        mock_conn = MagicMock()
        mock_conn.is_open.return_value = False

        test_app = FastAPI(title="test-health-down")
        test_app.include_router(health_router)
        test_app.state.amqp_connection = mock_conn

        with TestClient(test_app) as tc:
            yield tc

    def test_health_returns_503_when_amqp_disconnected(
        self, client_with_amqp_down: TestClient
    ) -> None:
        response = client_with_amqp_down.get("/health")
        assert response.status_code == 503

    def test_health_body_status_degraded(self, client_with_amqp_down: TestClient) -> None:
        response = client_with_amqp_down.get("/health")
        body = response.json()
        assert body["status"] == "degraded"

    def test_health_body_amqp_check_down(self, client_with_amqp_down: TestClient) -> None:
        response = client_with_amqp_down.get("/health")
        body = response.json()
        assert body["checks"]["amqp"] == "down"
