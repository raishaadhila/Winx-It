"""
Configuration.

The backend is locked to **DeepSeek served via NVIDIA NIM**. OpenAI is not
supported. The only configurable provider is:

    NVIDIA_API_KEY    — your nvapi-... key from https://build.nvidia.com
    NVIDIA_MODEL      — default: deepseek-ai/deepseek-v4-flash
    NVIDIA_BASE_URL   — default: https://integrate.api.nvidia.com/v1

The base URL is the OpenAI-compatible NIM API endpoint, not the model page URL.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    # DeepSeek via NVIDIA NIM (the only LLM provider)
    nvidia_api_key: str = ""
    nvidia_model: str = "deepseek-ai/deepseek-v4-flash"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    environment: str = "development"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.nvidia_api_key)


settings = Settings()
