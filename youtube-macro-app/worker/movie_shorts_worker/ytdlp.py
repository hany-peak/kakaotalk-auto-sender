import collections
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


DOWNLOAD_TIMEOUT_SEC = 30 * 60   # 30 minutes per video


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
    try:
        data = json.loads(res.stdout)
    except json.JSONDecodeError as e:
        raise YtdlpError(f"meta extract returned non-JSON: {res.stdout[:200]}") from e
    return VideoMeta(
        title=data.get("title") or "",
        uploader=data.get("uploader") or "",
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
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )
    last_pct = -1
    tail: collections.deque[str] = collections.deque(maxlen=50)
    try:
        for line in proc.stdout:
            tail.append(line.rstrip("\n"))
            m = _PERCENT_RE.search(line)
            if not m:
                continue
            pct = int(float(m.group(1)))
            if pct != last_pct:
                on_progress(pct)
                last_pct = pct
        try:
            rc = proc.wait(timeout=DOWNLOAD_TIMEOUT_SEC)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
            raise YtdlpError(f"download exceeded {DOWNLOAD_TIMEOUT_SEC}s and was killed")
        if rc != 0:
            err = "\n".join(tail)[-500:].strip()
            raise YtdlpError(f"download failed (rc={rc}): {err}")
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
    files = [
        p for p in out_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".mp4", ".mkv", ".webm", ".m4a", ".mp3"}
    ]
    if not files:
        raise YtdlpError("download succeeded but no final file found in out_dir")
    return max(files, key=lambda p: p.stat().st_mtime)
