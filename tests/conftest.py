from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    from backend.app.main import create_app

    with TestClient(create_app(database_url=":memory:")) as test_client:
        yield test_client
