import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    notion_token: str
    notion_db_id: str
    google_oauth_client_secrets: Path
    google_token_path: Path
    drive_root_folder_name: str
    poll_interval_sec: int
    progress_update_interval_sec: int
    max_retries: int
    tmp_dir: Path
    log_dir: Path


def _required(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise ConfigError(f"{name} is required")
    return v


def _expand(p: str) -> Path:
    return Path(os.path.expanduser(p)).resolve()


def load_config() -> Config:
    return Config(
        notion_token=_required("NOTION_TOKEN"),
        notion_db_id=_required("NOTION_DB_ID"),
        google_oauth_client_secrets=_expand(_required("GOOGLE_OAUTH_CLIENT_SECRETS")),
        google_token_path=_expand(_required("GOOGLE_TOKEN_PATH")),
        drive_root_folder_name=os.environ.get("DRIVE_ROOT_FOLDER_NAME", "movie-shorts-raw"),
        poll_interval_sec=int(os.environ.get("POLL_INTERVAL_SEC", "30")),
        progress_update_interval_sec=int(os.environ.get("PROGRESS_UPDATE_INTERVAL_SEC", "5")),
        max_retries=int(os.environ.get("MAX_RETRIES", "3")),
        tmp_dir=_expand(os.environ.get("TMP_DIR", "~/Library/Caches/movie-shorts-worker")),
        log_dir=_expand(os.environ.get("LOG_DIR", "~/Library/Logs/movie-shorts-worker")),
    )
