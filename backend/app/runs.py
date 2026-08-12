from __future__ import annotations

import asyncio
import hashlib
import json
import threading
import time
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from backend.app.contracts import RunCreate, RunEvent, RunSnapshot, RunStatus, utc_now
from backend.app.providers import ProviderRegistry
from backend.app.sessions import SessionVault
from backend.app.store import Store


@dataclass
class RunState:
    snapshot: RunSnapshot
    session_id: str
    request: RunCreate
    context: dict | None = None
    events: list[RunEvent] = field(default_factory=list)
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    cancel: threading.Event = field(default_factory=threading.Event)
    task: asyncio.Task | None = None


class RunManager:
    def __init__(self, providers: ProviderRegistry, vault: SessionVault, store: Store) -> None:
        self._runs: dict[str, RunState] = {}
        self._lock = threading.RLock()
        self._providers = providers
        self._vault = vault
        self._store = store
        self._tasks: set[asyncio.Task] = set()

    def create(
        self, request: RunCreate, session_id: str, context: dict | None = None
    ) -> RunSnapshot:
        run_id = str(uuid.uuid4())
        snapshot = RunSnapshot(
            id=run_id,
            status=RunStatus.queued,
            provider=request.provider,
            model=request.model,
            created_at=utc_now(),
            conversation_id=request.conversation_id,
        )
        state = RunState(
            snapshot=snapshot,
            session_id=session_id,
            request=request,
            context=context,
        )
        with self._lock:
            self._runs[run_id] = state
        self._store.create_run(snapshot, session_id, request.model_dump(), context)
        # A task with no remaining references is eligible for GC mid-run
        # (asyncio docs) — keep a strong reference until it finishes.
        task = asyncio.create_task(self._execute(state, request, session_id))
        state.task = task
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return snapshot

    def get(self, run_id: str, session_id: str) -> RunSnapshot:
        state = self._state(run_id, session_id)
        with self._lock:
            return state.snapshot.model_copy()

    def cancel(self, run_id: str, session_id: str) -> RunSnapshot:
        state = self._state(run_id, session_id)
        state.cancel.set()
        if state.task and not state.task.done():
            state.task.cancel()
        with self._lock:
            return state.snapshot.model_copy()

    def clear(self) -> None:
        with self._lock:
            states = list(self._runs.values())
            self._runs.clear()
        for state in states:
            state.cancel.set()
            if state.task and not state.task.done():
                state.task.cancel()

    async def shutdown(self) -> None:
        self.clear()
        if self._tasks:
            await asyncio.gather(*tuple(self._tasks), return_exceptions=True)

    async def events(self, run_id: str, session_id: str) -> AsyncIterator[RunEvent]:
        state, offset = self._state(run_id, session_id), 0
        terminal = {RunStatus.completed, RunStatus.cancelled, RunStatus.failed}
        while True:
            while offset < len(state.events):
                event = state.events[offset]
                offset += 1
                yield event
            if state.snapshot.status in terminal:
                return
            state.changed.clear()
            await state.changed.wait()

    async def _execute(self, state: RunState, request: RunCreate, session_id: str) -> None:
        started = time.monotonic()
        with self._lock:
            state.snapshot.status = RunStatus.running
            state.snapshot.started_at = utc_now()
        self._emit(state, "run.started")
        stream = None
        try:
            if request.provider == "echo":
                stream = self._echo(request.messages[-1].content)
            else:
                try:
                    adapter = self._providers[request.provider]
                except KeyError as exc:
                    raise ValueError(f"Unknown provider '{request.provider}'") from exc
                stream = adapter.stream(
                    self._vault.get(session_id, request.provider),
                    request.model,
                    request.messages,
                    request.temperature,
                )
            async for delta in stream:
                if state.cancel.is_set():
                    with self._lock:
                        state.snapshot.status = RunStatus.cancelled
                        state.snapshot.completed_at = utc_now()
                    self._emit(state, "run.cancelled")
                    return
                with self._lock:
                    state.snapshot.output += delta
                self._emit(state, "run.delta", {"delta": delta})
                await asyncio.sleep(0)
            with self._lock:
                state.snapshot.status = RunStatus.completed
                state.snapshot.completed_at = utc_now()
                state.snapshot.metrics = {"elapsed_seconds": round(time.monotonic() - started, 3)}
                state.snapshot.receipt_hash = self._receipt(state)
            if request.conversation_id:
                try:
                    self._store.add_message(
                        request.conversation_id,
                        "assistant",
                        state.snapshot.output,
                        run_id=state.snapshot.id,
                        metadata={"context": state.context or {}},
                    )
                except KeyError:
                    pass  # conversation_id didn't exist; the run itself still succeeded
            self._emit(state, "run.completed", {"output": state.snapshot.output})
        except asyncio.CancelledError:
            with self._lock:
                state.snapshot.status = RunStatus.cancelled
                state.snapshot.completed_at = utc_now()
                state.snapshot.metrics = {"elapsed_seconds": round(time.monotonic() - started, 3)}
                state.snapshot.receipt_hash = self._receipt(state)
            self._emit(state, "run.cancelled")
        except Exception as exc:
            with self._lock:
                state.snapshot.status = RunStatus.failed
                state.snapshot.error = self._safe_error(exc)
                state.snapshot.completed_at = utc_now()
                state.snapshot.metrics = {"elapsed_seconds": round(time.monotonic() - started, 3)}
                state.snapshot.receipt_hash = self._receipt(state)
            self._emit(state, "run.failed", {"error": state.snapshot.error})
        finally:
            if stream is not None:
                await stream.aclose()

    @staticmethod
    async def _echo(content: str) -> AsyncIterator[str]:
        for i, token in enumerate(content.split(" ")):
            yield token if i == 0 else f" {token}"
            await asyncio.sleep(0)

    def _emit(self, state: RunState, event_type: str, data: dict[str, str] | None = None) -> None:
        event = RunEvent(type=event_type, run_id=state.snapshot.id, data=data or {})
        state.events.append(event)
        self._store.update_run(state.snapshot)
        self._store.add_run_event(event)
        state.changed.set()

    def _state(self, run_id: str, session_id: str) -> RunState:
        with self._lock:
            state = self._runs.get(run_id)
        if state is None or state.session_id != session_id:
            raise KeyError(run_id)
        return state

    def _receipt(self, state: RunState) -> str:
        previous = self._store.latest_receipt_hash()
        payload = {
            "previous": previous,
            "run_id": state.snapshot.id,
            "provider": state.snapshot.provider,
            "model": state.snapshot.model,
            "status": state.snapshot.status,
            "output_hash": hashlib.sha256(state.snapshot.output.encode()).hexdigest(),
            "context": state.context,
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        name = type(exc).__name__
        if isinstance(exc, (ValueError, KeyError)):
            return str(exc).strip("'")[:300]
        return f"Provider request failed ({name})"
