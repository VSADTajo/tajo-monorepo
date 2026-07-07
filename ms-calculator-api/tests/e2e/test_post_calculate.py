"""E2E tests for POST /calculate endpoint."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

FIXTURE_INPUT = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"
FIXTURE_GOLDEN = Path(__file__).parent.parent / "fixtures" / "expected_balance_output.json"
TEST_CONFIG = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient with AMQP disabled (no broker needed for HTTP tests)."""
    import os

    # Prevent AMQP connection in lifespan by patching settings
    os.environ.setdefault("RESERVOIR_CONFIG_PATH", str(TEST_CONFIG))

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    # Build a minimal app without AMQP lifespan for HTTP-only tests
    from src.infrastructure.logging.structlog_config import configure_logging

    configure_logging(level="info")

    from src.api.routes.calculate import install_validation_error_handler
    from src.api.routes.calculate import router as calculate_router

    test_app = FastAPI(title="test-calculator-api")
    test_app.include_router(calculate_router)
    install_validation_error_handler(test_app)

    with TestClient(test_app, raise_server_exceptions=False) as tc:
        yield tc


@pytest.fixture
def fixture_payload() -> dict:
    return json.loads(FIXTURE_INPUT.read_text())


@pytest.fixture
def golden_output() -> dict:
    return json.loads(FIXTURE_GOLDEN.read_text())


class TestPostCalculate:
    """Tests for POST /calculate."""

    def test_valid_payload_returns_200(self, client: TestClient, fixture_payload: dict) -> None:
        response = client.post("/calculate", json=fixture_payload)
        assert response.status_code == 200

    def test_valid_payload_response_matches_golden_structure(
        self, client: TestClient, fixture_payload: dict, golden_output: dict
    ) -> None:
        response = client.post("/calculate", json=fixture_payload)
        body = response.json()
        assert body["simulationId"] == golden_output["simulationId"]
        assert body["providerName"] == "volume-calculator"
        assert body["seriesCount"] == golden_output["seriesCount"]
        assert len(body["timeSeries"]) == golden_output["seriesCount"]

    def test_missing_timeseries_returns_400(self, client: TestClient) -> None:
        bad_payload = {
            "simulationId": "test-missing-ts",
            "providerName": "manual-simulation",
        }
        response = client.post("/calculate", json=bad_payload)
        assert response.status_code == 400
        body = response.json()
        assert body["error"] == "invalid_payload"

    def test_timeseries_not_an_array_returns_400(self, client: TestClient) -> None:
        bad_payload = {
            "simulationId": "test-bad-ts",
            "providerName": "manual-simulation",
            "timeSeries": "not-an-array",
        }
        response = client.post("/calculate", json=bad_payload)
        assert response.status_code == 400

    def test_empty_body_returns_400(self, client: TestClient) -> None:
        response = client.post(
            "/calculate",
            content=b"",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422 or response.status_code == 400

    def test_simulation_id_echoed_in_response(
        self, client: TestClient, fixture_payload: dict
    ) -> None:
        response = client.post("/calculate", json=fixture_payload)
        assert response.status_code == 200
        body = response.json()
        assert body["simulationId"] == fixture_payload["simulationId"]

    def test_idempotent_requests_same_structure(
        self, client: TestClient, fixture_payload: dict
    ) -> None:
        resp1 = client.post("/calculate", json=fixture_payload)
        resp2 = client.post("/calculate", json=fixture_payload)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        body1 = resp1.json()
        body2 = resp2.json()
        # Structure is the same (not checking computedAt timestamp since it changes)
        assert body1["seriesCount"] == body2["seriesCount"]
        assert body1["simulationId"] == body2["simulationId"]

    def test_extra_fields_ignored_returns_200(self, client: TestClient) -> None:
        """Unknown extra fields in the payload are ignored."""
        fixture = json.loads(FIXTURE_INPUT.read_text())
        fixture["unknownExtraField"] = "this-should-be-ignored"
        response = client.post("/calculate", json=fixture)
        assert response.status_code == 200
