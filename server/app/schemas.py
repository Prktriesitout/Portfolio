"""API request and response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictStr,
    field_validator,
    model_validator,
)

_ALLOWED_CONTROL_CHARS = {"\n", "\r", "\t"}


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: StrictStr = Field(min_length=1, max_length=50_000)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message content cannot be empty.")
        for char in value:
            if ord(char) < 32 and char not in _ALLOWED_CONTROL_CHARS:
                raise ValueError("Message contains unsupported control characters.")
            if char == "\x00":
                raise ValueError("Message contains a null byte.")
        return value.strip()


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def require_user_turn(self) -> ChatRequest:
        if self.messages[-1].role != "user":
            raise ValueError("The final message must be from the user.")
        return self


class ChatResponse(BaseModel):
    reply: str
    request_id: str


class ErrorResponse(BaseModel):
    detail: str
    request_id: str


class HealthResponse(BaseModel):
    status: str
    configured: bool
