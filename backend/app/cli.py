from __future__ import annotations

import uvicorn

from backend.app.main import create_app


def main() -> None:
    server: uvicorn.Server

    def shutdown() -> None:
        server.should_exit = True

    server = uvicorn.Server(
        uvicorn.Config(
            create_app(shutdown_callback=shutdown),
            host="127.0.0.1",
            port=8506,
            reload=False,
            log_level="info",
        )
    )
    server.run()
