"""FastAPI application for the portfolio AI assistant."""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import Settings, get_settings
from .middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from .openai_service import (
    ChatService,
    OpenAIChatService,
    ServiceNotConfiguredError,
    UpstreamTimeoutError,
    UpstreamUnavailableError,
)
from .rate_limit import RateLimiter
from .schemas import ChatRequest, ChatResponse, HealthResponse
from .security import ConversationLimitError, get_client_ip, validate_conversation

logger = logging.getLogger("portfolio.api")


def _log_event(event: str, **fields: object) -> None:
    payload = {"event": event, **fields}
    logger.info(json.dumps(payload, default=str, separators=(",", ":")))


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or uuid.uuid4().hex


def _ip_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


async def enforce_body_size(request: Request) -> None:
    """Reject oversized bodies even when Content-Length is absent."""
    settings: Settings = request.app.state.settings
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared = int(content_length)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid request.") from None
        if declared > settings.max_request_bytes:
            raise HTTPException(status_code=413, detail="Request too large.")

    body = await request.body()
    if len(body) > settings.max_request_bytes:
        raise HTTPException(status_code=413, detail="Request too large.")


def create_app(
    settings: Settings | None = None,
    chat_service: ChatService | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    if "*" in settings.origin_list:
        raise ValueError("Wildcard CORS origins are not allowed.")
    if not settings.origin_list:
        raise ValueError("At least one explicit CORS origin is required.")

    service = chat_service or OpenAIChatService(settings)
    limiter = RateLimiter(
        per_minute=settings.rate_limit_per_minute,
        per_hour=settings.rate_limit_per_hour,
        daily_cap=settings.global_daily_request_cap,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.chat_service.close()

    app = FastAPI(
        title=settings.app_name,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.chat_service = service
    app.state.limiter = limiter

    app.add_middleware(SecurityHeadersMiddleware, settings=settings)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.host_list)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origin_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
        max_age=600,
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        error_types = sorted(
            {str(error.get("type", "unknown")) for error in exc.errors()}
        )
        _log_event(
            "request_validation_failed",
            request_id=_request_id(request),
            error_types=error_types,
        )
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid request.", "request_id": _request_id(request)},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail, "request_id": _request_id(request)},
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        _log_event(
            "unhandled_error",
            request_id=_request_id(request),
            error_type=type(exc).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal error occurred.", "request_id": _request_id(request)},
        )

    @app.get("/api/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", configured=service.is_configured)

    @app.post(
        "/api/chat",
        response_model=ChatResponse,
        dependencies=[Depends(enforce_body_size)],
    )
    async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
        request_id = _request_id(request)
        client_ip = get_client_ip(request, settings.trusted_proxy_set)
        ip_hash = _ip_hash(client_ip)

        if not settings.chat_enabled:
            raise HTTPException(
                status_code=503, detail="The AI assistant is temporarily unavailable."
            )
        if not service.is_configured:
            raise HTTPException(status_code=503, detail="The AI assistant is not configured yet.")

        try:
            validate_conversation(payload.messages, settings)
        except ConversationLimitError:
            _log_event(
                "conversation_limit_rejected",
                request_id=request_id,
                ip_hash=ip_hash,
                message_count=len(payload.messages),
            )
            raise HTTPException(status_code=400, detail="Invalid request.") from None

        decision = limiter.check(client_ip)
        if not decision.allowed:
            _log_event(
                "rate_limit_rejected",
                request_id=request_id,
                ip_hash=ip_hash,
                reason=decision.reason,
            )
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again shortly.",
                headers={"Retry-After": str(decision.retry_after_seconds)},
            )

        started = time.perf_counter()
        try:
            reply = await service.generate(payload.messages)
        except ServiceNotConfiguredError:
            _log_event("chat_not_configured", request_id=request_id, ip_hash=ip_hash)
            raise HTTPException(
                status_code=503, detail="The AI assistant is not configured yet."
            ) from None
        except UpstreamTimeoutError:
            _log_event("chat_timeout", request_id=request_id, ip_hash=ip_hash)
            raise HTTPException(
                status_code=504,
                detail="The AI assistant took too long to respond. Please try again.",
            ) from None
        except UpstreamUnavailableError:
            _log_event("chat_upstream_error", request_id=request_id, ip_hash=ip_hash)
            raise HTTPException(
                status_code=503,
                detail="The AI assistant is temporarily unavailable. Please try again.",
            ) from None
        except Exception as exc:
            _log_event(
                "chat_unexpected_error",
                request_id=request_id,
                ip_hash=ip_hash,
                error_type=type(exc).__name__,
            )
            raise HTTPException(
                status_code=500, detail="An internal error occurred. Please try again."
            ) from None

        latency_ms = round((time.perf_counter() - started) * 1000, 1)
        _log_event(
            "chat_completed",
            request_id=request_id,
            ip_hash=ip_hash,
            latency_ms=latency_ms,
            message_count=len(payload.messages),
            response_chars=len(reply),
        )
        return ChatResponse(reply=reply, request_id=request_id)

    return app


app = create_app()
