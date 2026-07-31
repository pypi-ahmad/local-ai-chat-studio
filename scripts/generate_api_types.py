"""Export the FastAPI OpenAPI schema to JSON for openapi-typescript to consume."""

from __future__ import annotations

import json
from pathlib import Path

from backend.app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "openapi.json"


if __name__ == "__main__":
    schema = create_app(database_url=":memory:").openapi()
    OUTPUT.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(OUTPUT.relative_to(ROOT))
