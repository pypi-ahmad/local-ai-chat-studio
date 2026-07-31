from __future__ import annotations

import asyncio
import threading
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
    events: list[RunEvent] = field(default_factory=list)
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    cancel: threading.Event = field(default_factory=threading.Event)


class RunManager:
    def __init__(self, providers: ProviderRegistry, vault: SessionVault, store: Store) -> None:
        self._runs: dict[str, RunState] = {}
        self._lock = threading.RLock()
        self._providers = providers
        self._vault = vault
        self._store = store
        self._tasks: set[asyncio.Task] = set()

    def create(self, request: RunCreate, session_id: str) -> RunSnapshot:
        run_id = str(uuid.uuid4())
        snapshot = RunSnapshot(
            id=run_id,
            status=RunStatus.queued,
            provider=request.provider,
            model=request.model,
            created_at=utc_now(),
        )
        state = RunState(snapshot=snapshot)
        with self._lock:
            self._runs[run_id] = state
        # A task with no remaining references is eligible for GC mid-run
        # (asyncio docs) — keep a strong reference until it finishes.
        task = asyncio.create_task(self._execute(state, request, session_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return snapshot

    def get(self, run_id: str) -> RunSnapshot:
        state = self._state(run_id)
        with self._lock:
            return state.snapshot.model_copy()

    def cancel(self, run_id: str) -> RunSnapshot:
        state = self._state(run_id)
        state.cancel.set()
        with self._lock:
            return state.snapshot.model_copy()

    async def events(self, run_id: str) -> AsyncIterator[RunEvent]:
        state, offset = self._state(run_id), 0
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
            if request.conversation_id:
                try:
                    self._store.add_message(
                        request.conversation_id, "assistant", state.snapshot.output
                    )
                except KeyError:
                    pass  # conversation_id didn't exist; the run itself still succeeded
            self._emit(state, "run.completed", {"output": state.snapshot.output})
        except Exception as exc:
            with self._lock:
                state.snapshot.status = RunStatus.failed
                state.snapshot.error = str(exc)
                state.snapshot.completed_at = utc_now()
            self._emit(state, "run.failed", {"error": str(exc)})
        finally:
            if stream is not None:
                await stream.aclose()

    @staticmethod
    async def _echo(content: str) -> AsyncIterator[str]:
        for i, token in enumerate(content.split(" ")):
            yield token if i == 0 else f" {token}"
            await asyncio.sleep(0)

    @staticmethod
    def _emit(state: RunState, event_type: str, data: dict[str, str] | None = None) -> None:
        state.events.append(RunEvent(type=event_type, run_id=state.snapshot.id, data=data or {}))
        state.changed.set()

    def _state(self, run_id: str) -> RunState:
        with self._lock:
            state = self._runs.get(run_id)
        if state is None:
            raise KeyError(run_id)
        return state
