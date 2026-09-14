"""Export the FastAPI OpenAPI schema to JSON for openapi-typescript to consume.

Run standalone (not imported): builds an app instance just to read its
generated .openapi() schema, then writes it to openapi.json at the repo root
so the frontend's TypeScript types (see frontend/) can be generated from it.
"""

from __future__ import annotations

import json
from pathlib import Path

from backend.app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "openapi.json"


if __name__ == "__main__":
    # An in-memory database is enough to construct the app object needed to
    # generate its OpenAPI schema — this never serves requests or touches disk.
    schema = create_app(database_url=":memory:").openapi()
    OUTPUT.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(OUTPUT.relative_to(ROOT))
