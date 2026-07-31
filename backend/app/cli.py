from __future__ import annotations

import uvicorn

from backend.app.main import create_app


def main() -> None:
    uvicorn.run(
        create_app(),
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
