import logging
import subprocess
from datetime import datetime
from pathlib import Path

_LOGGERS: dict[str, logging.Logger] = {}


def setup_logger(log_dir: Path, name: str = "movie_shorts_worker") -> logging.Logger:
    if name in _LOGGERS:
        return _LOGGERS[name]
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    fname = log_dir / f"worker-{datetime.now():%Y%m%d}.log"
    fh = logging.FileHandler(fname, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(fh)
    _LOGGERS[name] = logger
    return logger


def notify(title: str, body: str) -> None:
    """Show a macOS alert via osascript. Best-effort; no error on failure."""
    script = f'display notification "{body}" with title "{title}"'
    try:
        subprocess.run(["osascript", "-e", script], check=False, timeout=5)
    except Exception:
        pass
