"""Process entry point for running the FastAPI app as a standalone local server.

Registered as the `chat-studio` console script in pyproject.toml. See
backend/app/main.py for the app itself.
"""

from __future__ import annotations

import uvicorn

from backend.app.main import create_app


def main() -> None:
    server: uvicorn.Server

    def shutdown() -> None:
        server.should_exit = True

    server = uvicorn.Server(
        uvicorn.Config(
            # shutdown_callback lets the /api/v1/runtime/shutdown route (see
            # main.py) stop this server from inside a request handler, since
            # uvicorn.Server has no other way to be signaled from within the
            # app it's running.
            create_app(shutdown_callback=shutdown),
            # Bound to loopback only: this is a local-only app, not meant to
            # be reachable from the network.
            host="127.0.0.1",
            port=8506,
            reload=False,
            log_level="info",
        )
    )
    server.run()
