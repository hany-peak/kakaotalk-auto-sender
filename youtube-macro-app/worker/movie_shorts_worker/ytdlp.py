import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


class YtdlpError(RuntimeError):
    pass


@dataclass(frozen=True)
class VideoMeta:
    title: str
    uploader: str
    duration: int
    ext: str


_PERCENT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def extract_meta(url: str) -> VideoMeta:
    res = subprocess.run(
        ["yt-dlp", "--dump-single-json", "--no-download", url],
        capture_output=True, text=True, timeout=60,
    )
    if res.returncode != 0:
        raise YtdlpError(f"meta extract failed: {res.stderr.strip()[:500]}")
    data = json.loads(res.stdout)
    return VideoMeta(
        title=data.get("title", ""),
        uploader=data.get("uploader", "") or "",
        duration=int(data.get("duration") or 0),
        ext=data.get("ext", "mp4"),
    )


def download(url: str, out_dir: Path, on_progress: Callable[[int], None]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(out_dir / "%(title)s.%(ext)s")
    proc = subprocess.Popen(
        [
            "yt-dlp",
            "-f", "best[ext=mp4]/best",
            "-o", out_template,
            "--newline",
            "--progress-template", "%(progress._percent_str)s",
            url,
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    last_pct = -1
    for line in proc.stdout:
        m = _PERCENT_RE.search(line)
        if not m:
            continue
        pct = int(float(m.group(1)))
        if pct != last_pct:
            on_progress(pct)
            last_pct = pct
    rc = proc.wait()
    if rc != 0:
        err = proc.stderr.read() if proc.stderr else ""
        raise YtdlpError(f"download failed (rc={rc}): {err.strip()[:500]}")
    files = list(out_dir.glob("*"))
    if not files:
        raise YtdlpError("download succeeded but no output file found")
    # If multiple, pick the most recently modified
    return max(files, key=lambda p: p.stat().st_mtime)
