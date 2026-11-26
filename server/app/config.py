"""Validated server configuration.

The OpenAI key is intentionally read only from the server environment. It is
never serialized into responses, logs, or frontend files.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(SERVER_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Portfolio AI Assistant API"
    environment: Literal["development", "test", "production"] = "development"

    # OpenAI configuration. Placeholders are supplied by server/.env.example.
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = ""
    openai_base_url: str | None = None
    openai_timeout_seconds: float = Field(default=30.0, ge=1.0, le=120.0)
    openai_max_retries: int = Field(default=1, ge=0, le=3)

    # Request and model budget limits.
    max_request_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    max_messages: int = Field(default=12, ge=1, le=50)
    max_message_chars: int = Field(default=2_000, ge=1, le=20_000)
    max_total_chars: int = Field(default=8_000, ge=1, le=100_000)
    max_output_tokens: int = Field(default=500, ge=32, le=4_096)
    max_response_chars: int = Field(default=8_000, ge=100, le=50_000)

    # Abuse and cost controls. These are process-local, single-instance limits.
    rate_limit_per_minute: int = Field(default=10, ge=1, le=1_000)
    rate_limit_per_hour: int = Field(default=60, ge=1, le=10_000)
    global_daily_request_cap: int = Field(default=500, ge=1, le=1_000_000)
    chat_enabled: bool = True

    # Browser origins allowed to call the API (comma-separated, exact matches).
    allowed_origins: str = (
        "http://127.0.0.1:8000,http://localhost:8000,"
        "http://127.0.0.1:5500,http://localhost:5500,"
        "https://prktriesitout.dpdns.org"
    )
    allowed_hosts: str = "127.0.0.1,localhost,testserver"
    trusted_proxy_ips: str = ""

    log_level: str = "INFO"

    @field_validator("openai_model")
    @classmethod
    def strip_model(cls, value: str) -> str:
        return value.strip()

    @property
    def origin_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]

    @property
    def host_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_hosts.split(",") if item.strip()]

    @property
    def trusted_proxy_set(self) -> set[str]:
        return {item.strip() for item in self.trusted_proxy_ips.split(",") if item.strip()}

    @property
    def docs_enabled(self) -> bool:
        return self.environment != "production"

    @property
    def openai_key_value(self) -> str:
        """Return the key only for constructing the server-side SDK client."""
        return self.openai_api_key.get_secret_value().strip()

    @property
    def is_openai_configured(self) -> bool:
        key = self.openai_key_value
        model = self.openai_model
        if not key or not model:
            return False
        # Refuse to treat committed placeholders as real configuration.
        if "REPLACE" in key.upper() or "REPLACE" in model.upper():
            return False
        if key.upper().startswith("SK-REPLACE"):
            return False
        return True


@lru_cache
def get_settings() -> Settings:
    return Settings()
