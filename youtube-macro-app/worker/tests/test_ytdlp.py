import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from movie_shorts_worker.ytdlp import VideoMeta, extract_meta, download, YtdlpError


def test_extract_meta_parses_json(mocker):
    fake_json = json.dumps({
        "title": "Usual Suspects clip", "uploader": "movie_fan",
        "duration": 60, "ext": "mp4",
    })
    mocker.patch("subprocess.run", return_value=MagicMock(
        returncode=0, stdout=fake_json, stderr="",
    ))
    meta = extract_meta("https://x")
    assert meta == VideoMeta(title="Usual Suspects clip", uploader="movie_fan",
                             duration=60, ext="mp4")


def test_extract_meta_raises_on_error(mocker):
    mocker.patch("subprocess.run", return_value=MagicMock(
        returncode=1, stdout="", stderr="ERROR: Video unavailable",
    ))
    with pytest.raises(YtdlpError, match="Video unavailable"):
        extract_meta("https://x")


def test_extract_meta_wraps_decode_error(mocker):
    mocker.patch("subprocess.run", return_value=MagicMock(
        returncode=0, stdout="not-json", stderr="",
    ))
    with pytest.raises(YtdlpError, match="non-JSON"):
        extract_meta("https://x")


def test_download_calls_progress_callback(mocker, tmp_path: Path):
    out_file = tmp_path / "video.mp4"
    out_file.write_bytes(b"fake")
    proc = MagicMock()
    proc.stdout = iter(["10.0%\n", "55.0%\n", "100.0%\n"])
    proc.wait.return_value = 0
    proc.poll.return_value = 0
    popen = mocker.patch("subprocess.Popen", return_value=proc)
    progress_calls: list[int] = []
    path = download("https://x", out_dir=tmp_path, on_progress=progress_calls.append)
    assert path == out_file
    assert progress_calls == [10, 55, 100]
    # Confirm stderr is merged into stdout to prevent pipe deadlock
    assert popen.call_args.kwargs["stderr"] is subprocess.STDOUT


def test_download_raises_on_failure(mocker, tmp_path: Path):
    proc = MagicMock()
    proc.stdout = iter(["[error] download failed: 403"])
    proc.wait.return_value = 1
    proc.poll.return_value = 1
    mocker.patch("subprocess.Popen", return_value=proc)
    with pytest.raises(YtdlpError, match="rc=1"):
        download("https://x", out_dir=tmp_path, on_progress=lambda p: None)


def test_download_kills_on_timeout(mocker, tmp_path: Path):
    proc = MagicMock()
    proc.stdout = iter([])
    proc.wait.side_effect = [subprocess.TimeoutExpired(cmd="yt-dlp", timeout=1), 0, 0]
    proc.poll.return_value = None
    mocker.patch("subprocess.Popen", return_value=proc)
    with pytest.raises(YtdlpError, match="killed"):
        download("https://x", out_dir=tmp_path, on_progress=lambda p: None)
    proc.kill.assert_called()


def test_download_ignores_part_files(mocker, tmp_path: Path):
    # Final mp4 + a stale .part should pick the mp4, not the part
    final = tmp_path / "video.mp4"; final.write_bytes(b"final")
    part = tmp_path / "video.mp4.part"; part.write_bytes(b"part")
    # make .part newer
    import os, time
    time.sleep(0.01)
    os.utime(part, None)
    proc = MagicMock()
    proc.stdout = iter([])
    proc.wait.return_value = 0
    proc.poll.return_value = 0
    mocker.patch("subprocess.Popen", return_value=proc)
    path = download("https://x", out_dir=tmp_path, on_progress=lambda p: None)
    assert path == final
