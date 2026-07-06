"""E2E tests for /docs and /openapi.json endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def full_app_client():
    """TestClient with calculate + health routes — no AMQP needed."""
    import os
    from pathlib import Path

    test_config = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"
    os.environ.setdefault("RESERVOIR_CONFIG_PATH", str(test_config))

    from unittest.mock import MagicMock

    from fastapi import FastAPI

    from src.api.routes.calculate import install_validation_error_handler
    from src.api.routes.calculate import router as calc_router
    from src.api.routes.health import router as health_router
    from src.infrastructure.logging.structlog_config import configure_logging

    configure_logging(level="info")

    mock_conn = MagicMock()
    mock_conn.is_open.return_value = True

    test_app = FastAPI(title="ms-calculator-api", version="0.1.0")
    test_app.include_router(calc_router)
    test_app.include_router(health_router)
    test_app.state.amqp_connection = mock_conn
    install_validation_error_handler(test_app)

    with TestClient(test_app) as tc:
        yield tc


class TestOpenApiDocs:
    """GET /docs and /openapi.json are available and correct."""

    def test_docs_returns_200_html(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_docs_html_contains_swagger_ui(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/docs")
        assert "swagger" in response.text.lower()

    def test_openapi_json_returns_200(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/openapi.json")
        assert response.status_code == 200

    def test_openapi_json_is_valid_schema(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/openapi.json")
        schema = response.json()
        assert "openapi" in schema
        assert "paths" in schema

    def test_openapi_json_includes_post_calculate(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/openapi.json")
        schema = response.json()
        assert "/calculate" in schema["paths"]
        assert "post" in schema["paths"]["/calculate"]

    def test_openapi_json_includes_get_health(self, full_app_client: TestClient) -> None:
        response = full_app_client.get("/openapi.json")
        schema = response.json()
        assert "/health" in schema["paths"]
        assert "get" in schema["paths"]["/health"]
