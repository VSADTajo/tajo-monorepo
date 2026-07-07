"""E2E test: POST /calculate binds simulation_id to every log line."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

FIXTURE_INPUT = Path(__file__).parent.parent / "fixtures" / "simulation_output_e08_e09.json"
TEST_CONFIG = Path(__file__).parent.parent / "fixtures" / "reservoir_parameters_test.json"


@pytest.fixture(scope="module")
def client():
    import os

    os.environ.setdefault("RESERVOIR_CONFIG_PATH", str(TEST_CONFIG))
    from src.api.routes.calculate import install_validation_error_handler
    from src.api.routes.calculate import router as calculate_router
    from src.infrastructure.logging.structlog_config import configure_logging

    configure_logging(level="debug")
    test_app = FastAPI(title="test-log-shape")
    test_app.include_router(calculate_router)
    install_validation_error_handler(test_app)
    with TestClient(test_app, raise_server_exceptions=False) as tc:
        yield tc


class TestLogShapeHttp:
    """Log lines emitted during POST /calculate have simulation_id."""

    def test_post_calculate_logs_have_simulation_id(self, client: TestClient) -> None:
        """Use structlog.testing.capture_logs to verify simulation_id is bound."""
        import structlog.testing

        fixture = json.loads(FIXTURE_INPUT.read_text())
        expected_sim_id = fixture["simulationId"]

        with structlog.testing.capture_logs() as cap:
            response = client.post("/calculate", json=fixture)

        assert response.status_code == 200

        lines_with_sim_id = [
            entry for entry in cap if entry.get("simulation_id") == expected_sim_id
        ]
        assert lines_with_sim_id, (
            f"Expected at least one log entry with simulation_id={expected_sim_id!r}. "
            f"Got entries: {[e.get('event') for e in cap]}"
        )
