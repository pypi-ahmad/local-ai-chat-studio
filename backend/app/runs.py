"""In-memory run orchestration: streams provider output and persists progress.

RunManager owns the lifecycle of a single chat "run" (queued -> running ->
completed/cancelled/failed), including the asyncio task that streams tokens
from a ProviderAdapter and the receipt-hash chain used for replay integrity.
Run state lives only in memory (self._runs); store.py mirrors it to SQLite
for durability/history, but this module — not the Store — is the source of
truth for a run while it is in flight. See providers.py for what "stream"
actually calls, and store.py for how a finished run is read back for
replay/export.
"""

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
    # changed wakes any events() subscribers (SSE) waiting for new events;
    # cancel is only ever set/read from the event loop despite being a
    # threading.Event.
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    cancel: threading.Event = field(default_factory=threading.Event)
    task: asyncio.Task | None = None


class RunManager:
    def __init__(
        self, providers: ProviderRegistry, vault: SessionVault, store: Store
    ) -> None:
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
            # Copy while still holding the lock: state.snapshot is mutated in
            # place by _execute, so handing out the live object could let a
            # caller observe a torn/mid-update snapshot after the lock is released.
            return state.snapshot.model_copy()

    def cancel(self, run_id: str, session_id: str) -> RunSnapshot:
        state = self._state(run_id, session_id)
        # Signal the cooperative cancel flag (checked between stream chunks in
        # _execute) and cancel the asyncio task directly, since a provider
        # call awaiting I/O won't observe the flag until its next loop iteration.
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
            # return_exceptions=True so one run's cancellation error doesn't
            # prevent awaiting the rest; clear() has already requested
            # cancellation for all of them.
            await asyncio.gather(*tuple(self._tasks), return_exceptions=True)

    async def events(self, run_id: str, session_id: str) -> AsyncIterator[RunEvent]:
        state, offset = self._state(run_id, session_id), 0
        terminal = {RunStatus.completed, RunStatus.cancelled, RunStatus.failed}
        while True:
            # Replays every event from offset 0, so a subscriber that attaches
            # mid-run (or reconnects) sees full history, not just new events.
            while offset < len(state.events):
                event = state.events[offset]
                offset += 1
                yield event
            if state.snapshot.status in terminal:
                return
            # Clear before waiting to avoid missing a change that happened
            # between the drain loop above and this wait.
            state.changed.clear()
            await state.changed.wait()

    async def _execute(
        self, state: RunState, request: RunCreate, session_id: str
    ) -> None:
        """Drive one run to completion: stream deltas, persist the transcript, record a receipt.

        Cancellation, provider errors, and normal completion all converge on
        the same pattern (set a terminal status, timestamp, metrics, and a
        receipt hash, then emit one terminal event) so callers streaming
        events() always see exactly one closing event regardless of how the
        run ended.
        """
        started = time.monotonic()
        with self._lock:
            state.snapshot.status = RunStatus.running
            state.snapshot.started_at = utc_now()
        self._emit(state, "run.started")
        stream = None
        try:
            if request.provider == "echo":
                # 'echo' is a built-in provider (used by tests/demos) that
                # never touches ProviderRegistry; every other provider must
                # be a registered adapter.
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
                    request.reasoning_effort,
                )
            async for delta in stream:
                # Checked once per delta rather than relying on asyncio
                # cancellation alone, so a cancelled run still closes out its
                # provider stream cleanly (finally block below) instead of
                # leaving it half-consumed.
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
                state.snapshot.metrics = {
                    "elapsed_seconds": round(time.monotonic() - started, 3)
                }
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
                state.snapshot.metrics = {
                    "elapsed_seconds": round(time.monotonic() - started, 3)
                }
                state.snapshot.receipt_hash = self._receipt(state)
            self._emit(state, "run.cancelled")
        except Exception as exc:
            with self._lock:
                state.snapshot.status = RunStatus.failed
                state.snapshot.error = self._safe_error(exc)
                state.snapshot.completed_at = utc_now()
                state.snapshot.metrics = {
                    "elapsed_seconds": round(time.monotonic() - started, 3)
                }
                state.snapshot.receipt_hash = self._receipt(state)
            self._emit(state, "run.failed", {"error": state.snapshot.error})
        finally:
            # Ensures the provider's underlying stream is released even on
            # cancellation or an exception raised before iteration started.
            if stream is not None:
                await stream.aclose()

    @staticmethod
    async def _echo(content: str) -> AsyncIterator[str]:
        for i, token in enumerate(content.split(" ")):
            yield token if i == 0 else f" {token}"
            await asyncio.sleep(0)

    def _emit(
        self, state: RunState, event_type: str, data: dict[str, str] | None = None
    ) -> None:
        # Persists the current snapshot and the new event together so SQLite
        # never falls behind what SSE subscribers have already seen;
        # changed.set() wakes them after both writes land.
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
        """Hash-chain this run onto the previous receipt for tamper-evident replay bundles.

        Chaining to the store's latest receipt_hash (rather than hashing this
        run in isolation) means altering or reordering a past run's stored
        output would change every receipt hash computed after it — this is
        for detecting tampering with exported/replayed run history, not a
        cryptographic signature.
        """
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
        # Only ValueError/KeyError messages (raised deliberately elsewhere in
        # this class, e.g. unknown provider) are surfaced verbatim; anything
        # else collapses to a generic message so provider SDK internals or
        # exception text aren't leaked to the client.
        name = type(exc).__name__
        if isinstance(exc, (ValueError, KeyError)):
            return str(exc).strip("'")[:300]
        return f"Provider request failed ({name})"
