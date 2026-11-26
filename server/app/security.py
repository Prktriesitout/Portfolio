"""Request security helpers: limits, client identity, and safe text handling."""

from __future__ import annotations

import ipaddress
from collections.abc import Sequence

from starlette.requests import Request

from .config import Settings
from .schemas import ChatMessage


class ConversationLimitError(ValueError):
    """Raised when a conversation exceeds configured safe limits."""


def validate_conversation(messages: Sequence[ChatMessage], settings: Settings) -> None:
    if len(messages) > settings.max_messages:
        raise ConversationLimitError("Too many messages.")
    total_chars = 0
    for message in messages:
        if len(message.content) > settings.max_message_chars:
            raise ConversationLimitError("Message too long.")
        total_chars += len(message.content)
    if total_chars > settings.max_total_chars:
        raise ConversationLimitError("Conversation too long.")
    if messages[-1].role != "user":
        raise ConversationLimitError("Final message must be from the user.")


def get_client_ip(request: Request, trusted_proxies: set[str]) -> str:
    """Resolve the caller IP without trusting user-supplied forwarding headers.

    X-Forwarded-For is considered only when the immediate peer is an explicitly
    trusted proxy. Walking right-to-left returns the first untrusted hop, which
    prevents a client from choosing its own key by spoofing the leftmost value.
    """
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "")
    if peer not in trusted_proxies or not forwarded:
        return peer

    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    for hop in reversed(hops + [peer]):
        if hop in trusted_proxies:
            continue
        if _is_valid_ip(hop):
            return hop
    return peer


def _is_valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def sanitize_model_text(text: str, max_chars: int) -> str:
    """Remove control characters and bound output before returning it."""
    cleaned = "".join(
        char for char in text if char in {"\n", "\r", "\t"} or ord(char) >= 32
    ).strip()
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars].rstrip() + "\n\n[Response truncated.]"
    return cleaned
