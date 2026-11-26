"""Server-side OpenAI integration with bounded retries and safe failures."""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Sequence
from typing import Protocol

from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    OpenAIError,
    RateLimitError,
)

from .config import Settings
from .prompts import build_system_instructions
from .schemas import ChatMessage
from .security import sanitize_model_text

logger = logging.getLogger("portfolio.openai")


class ServiceNotConfiguredError(RuntimeError):
    pass


class UpstreamTimeoutError(RuntimeError):
    pass


class UpstreamUnavailableError(RuntimeError):
    pass


class EmptyModelResponseError(RuntimeError):
    pass


class ChatService(Protocol):
    is_configured: bool

    async def generate(self, messages: Sequence[ChatMessage]) -> str: ...

    async def close(self) -> None: ...


class OpenAIChatService:
    def __init__(self, settings: Settings, client: AsyncOpenAI | None = None) -> None:
        self._settings = settings
        self._client: AsyncOpenAI | None = client
        if self._client is None and settings.is_openai_configured:
            self._client = AsyncOpenAI(
                api_key=settings.openai_key_value,
                base_url=settings.openai_base_url,
                timeout=settings.openai_timeout_seconds,
                max_retries=0,
            )

    @property
    def is_configured(self) -> bool:
        return self._client is not None

    async def generate(self, messages: Sequence[ChatMessage]) -> str:
        if self._client is None:
            raise ServiceNotConfiguredError("The assistant is not configured.")

        attempts = self._settings.openai_max_retries + 1
        last_kind: str | None = None

        for attempt in range(attempts):
            try:
                response = await self._client.responses.create(
                    model=self._settings.openai_model,
                    instructions=build_system_instructions(),
                    input=[
                        {"role": message.role, "content": message.content}
                        for message in messages
                    ],
                    max_output_tokens=self._settings.max_output_tokens,
                    store=False,
                )
                text = self._extract_text(response)
                if not text:
                    raise EmptyModelResponseError("The model returned an empty response.")
                return sanitize_model_text(text, self._settings.max_response_chars)
            except EmptyModelResponseError:
                last_kind = "empty"
            except (RateLimitError, APITimeoutError) as exc:
                last_kind = "timeout" if isinstance(exc, APITimeoutError) else "rate_limit"
            except APIConnectionError:
                last_kind = "connection"
            except InternalServerError:
                last_kind = "server_error"
            except AuthenticationError:
                logger.error("openai_authentication_failed")
                raise ServiceNotConfiguredError("The assistant is not configured.") from None
            except BadRequestError:
                logger.error("openai_bad_request")
                raise UpstreamUnavailableError(
                    "The assistant is temporarily unavailable."
                ) from None
            except OpenAIError:
                logger.error("openai_request_failed")
                raise UpstreamUnavailableError(
                    "The assistant is temporarily unavailable."
                ) from None

            if attempt < attempts - 1:
                backoff = min(4.0, 0.5 * (2**attempt) + random.uniform(0.0, 0.25))
                await asyncio.sleep(backoff)

        logger.warning("openai_upstream_exhausted", extra={"kind": last_kind or "unknown"})
        if last_kind == "timeout":
            raise UpstreamTimeoutError("The assistant timed out.")
        raise UpstreamUnavailableError("The assistant is temporarily unavailable.")

    @staticmethod
    def _extract_text(response: object) -> str:
        text = getattr(response, "output_text", "") or ""
        if text.strip():
            return text.strip()

        # Responses API may return a refusal item without output_text.
        for item in getattr(response, "output", []) or []:
            for part in getattr(item, "content", []) or []:
                refusal = getattr(part, "refusal", None)
                if isinstance(refusal, str) and refusal.strip():
                    return refusal.strip()
        return ""

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
