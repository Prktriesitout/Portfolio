from __future__ import annotations

import pytest
from starlette.requests import Request

from app.config import Settings
from app.prompts import build_system_instructions
from app.schemas import ChatMessage
from app.security import (
    ConversationLimitError,
    get_client_ip,
    sanitize_model_text,
    validate_conversation,
)


def make_request(peer: str | None = "1.2.3.4", forwarded_for: str | None = None) -> Request:
    headers = []
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode("ascii")))
    scope = {
        "type": "http",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "root_path": "",
        "query_string": b"",
        "http_version": "1.1",
        "headers": headers,
        "client": (peer, 54321) if peer is not None else None,
        "server": ("testserver", 80),
    }
    return Request(scope)


def test_client_ip_ignores_forwarding_header_from_untrusted_peer():
    request = make_request(peer="1.2.3.4", forwarded_for="9.9.9.9")

    assert get_client_ip(request, trusted_proxies=set()) == "1.2.3.4"


def test_client_ip_uses_nearest_untrusted_hop_behind_trusted_proxy():
    request = make_request(peer="10.0.0.1", forwarded_for="9.9.9.9, 10.0.0.2")

    assert get_client_ip(request, {"10.0.0.1", "10.0.0.2"}) == "9.9.9.9"


def test_client_ip_falls_back_when_forwarded_value_is_invalid():
    request = make_request(peer="10.0.0.1", forwarded_for="not-an-ip")

    assert get_client_ip(request, {"10.0.0.1"}) == "10.0.0.1"


def test_client_ip_without_client_is_unknown():
    request = make_request(peer=None)

    assert get_client_ip(request, set()) == "unknown"


def test_output_sanitization_removes_control_characters_and_truncates():
    cleaned = sanitize_model_text("hello\x00\x07 world\nnext", max_chars=50)
    truncated = sanitize_model_text("x" * 30, max_chars=10)

    assert cleaned == "hello world\nnext"
    assert truncated.startswith("x" * 10)
    assert truncated.endswith("[Response truncated.]")


def test_conversation_limits():
    settings = Settings(
        max_messages=3,
        max_message_chars=20,
        max_total_chars=40,
        openai_api_key="",
        openai_model="",
    )
    valid = [
        ChatMessage(role="user", content="hello"),
        ChatMessage(role="assistant", content="hi"),
        ChatMessage(role="user", content="projects?"),
    ]

    validate_conversation(valid, settings)

    with pytest.raises(ConversationLimitError):
        validate_conversation(valid * 2, settings)
    with pytest.raises(ConversationLimitError):
        validate_conversation([ChatMessage(role="user", content="x" * 21)], settings)
    with pytest.raises(ConversationLimitError):
        validate_conversation(
            [
                ChatMessage(role="user", content="x" * 20),
                ChatMessage(role="assistant", content="y" * 20),
                ChatMessage(role="user", content="z"),
            ],
            settings,
        )


def test_placeholder_values_are_not_treated_as_configuration():
    settings = Settings(
        openai_api_key="sk-REPLACE_WITH_YOUR_KEY",
        openai_model="REPLACE_WITH_CURRENT_MODEL_ID",
        allowed_origins="http://localhost:8000",
    )

    assert settings.is_openai_configured is False


def test_realistic_values_are_configured_without_exposing_key():
    settings = Settings(
        openai_api_key="sk-test-server-only",
        openai_model="test-model",
        allowed_origins="http://localhost:8000",
    )

    assert settings.is_openai_configured is True
    assert settings.openai_key_value == "sk-test-server-only"
    assert "sk-test-server-only" not in repr(settings)


def test_system_prompt_contains_untrusted_content_rules_and_public_context():
    prompt = build_system_instructions()

    assert "untrusted" in prompt.lower()
    assert "never reveal" in prompt.lower()
    assert "pratyush" in prompt.lower()
    assert "pratyush7340@gmail.com" in prompt
    assert "sk-" not in prompt


def test_public_context_has_no_private_marker():
    prompt = build_system_instructions()

    assert "internal only" not in prompt.lower()
    assert "confidential" not in prompt.lower()
