from __future__ import annotations

from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import ChatMessage


class FakeChatService:
    def __init__(
        self,
        reply: str = "A safe portfolio answer.",
        configured: bool = True,
        error: Exception | None = None,
    ) -> None:
        self.reply = reply
        self.is_configured = configured
        self.error = error
        self.received: list[ChatMessage] = []
        self.closed = False

    async def generate(self, messages: Sequence[ChatMessage]) -> str:
        self.received = list(messages)
        if self.error is not None:
            raise self.error
        return self.reply

    async def close(self) -> None:
        self.closed = True


@pytest.fixture
def app_factory():
    clients: list[TestClient] = []

    def factory(
        *,
        service: FakeChatService | None = None,
        **settings_overrides,
    ):
        settings_values = {
            "environment": "test",
            "openai_api_key": "sk-test-server-only",
            "openai_model": "test-model",
            "allowed_origins": "http://localhost:8000,http://127.0.0.1:8000",
            "allowed_hosts": "testserver,127.0.0.1,localhost",
            "rate_limit_per_minute": 100,
            "rate_limit_per_hour": 1_000,
            "global_daily_request_cap": 10_000,
            "log_level": "CRITICAL",
        }
        settings_values.update(settings_overrides)
        settings = Settings(**settings_values)
        fake = service or FakeChatService()
        application = create_app(settings=settings, chat_service=fake)
        client = TestClient(application)
        clients.append(client)
        return client, fake

    yield factory
    for client in clients:
        client.close()


@pytest.fixture
def chat_payload():
    def make(content: str = "What projects has Pratyush built?") -> dict:
        return {"messages": [{"role": "user", "content": content}]}

    return make


@pytest.fixture
def chat_service():
    return FakeChatService()
