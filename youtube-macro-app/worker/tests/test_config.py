import os
import pytest
from movie_shorts_worker.config import load_config, ConfigError


def _full_env():
    return {
        "NOTION_TOKEN": "secret_x",
        "NOTION_DB_ID": "db_id",
        "GOOGLE_OAUTH_CLIENT_SECRETS": "/tmp/cs.json",
        "GOOGLE_TOKEN_PATH": "~/google-token.json",
        "DRIVE_ROOT_FOLDER_NAME": "movie-shorts-raw",
        "POLL_INTERVAL_SEC": "30",
        "PROGRESS_UPDATE_INTERVAL_SEC": "5",
        "MAX_RETRIES": "3",
        "TMP_DIR": "~/tmp",
        "LOG_DIR": "~/logs",
    }


def test_load_config_returns_typed_values(monkeypatch):
    for k, v in _full_env().items():
        monkeypatch.setenv(k, v)
    cfg = load_config()
    assert cfg.notion_token == "secret_x"
    assert cfg.notion_db_id == "db_id"
    assert cfg.poll_interval_sec == 30
    assert cfg.progress_update_interval_sec == 5
    assert cfg.max_retries == 3
    assert cfg.drive_root_folder_name == "movie-shorts-raw"


def test_load_config_expands_user_paths(monkeypatch):
    for k, v in _full_env().items():
        monkeypatch.setenv(k, v)
    cfg = load_config()
    assert not str(cfg.tmp_dir).startswith("~")
    assert not str(cfg.log_dir).startswith("~")
    assert not str(cfg.google_token_path).startswith("~")


def test_load_config_raises_when_required_missing(monkeypatch):
    monkeypatch.delenv("NOTION_TOKEN", raising=False)
    with pytest.raises(ConfigError, match="NOTION_TOKEN"):
        load_config()
