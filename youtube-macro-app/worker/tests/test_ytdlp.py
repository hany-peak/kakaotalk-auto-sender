import json
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


def test_download_calls_progress_callback(mocker, tmp_path: Path):
    # Prepare a fake file that yt-dlp would produce
    out_file = tmp_path / "video.mp4"
    out_file.write_bytes(b"fake")

    proc = MagicMock()
    proc.stdout = iter(["10.0%\n", "55.0%\n", "100.0%\n"])
    proc.wait.return_value = 0
    mocker.patch("subprocess.Popen", return_value=proc)
    # After download, find file by glob — we mock the glob to return our file
    mocker.patch("pathlib.Path.glob", return_value=iter([out_file]))

    progress_calls: list[int] = []
    path = download("https://x", out_dir=tmp_path, on_progress=progress_calls.append)
    assert path == out_file
    assert progress_calls == [10, 55, 100]


def test_download_raises_on_failure(mocker, tmp_path: Path):
    proc = MagicMock()
    proc.stdout = iter([])
    proc.wait.return_value = 1
    proc.stderr.read.return_value = "ERROR: download failed"
    mocker.patch("subprocess.Popen", return_value=proc)
    with pytest.raises(YtdlpError, match="download failed"):
        download("https://x", out_dir=tmp_path, on_progress=lambda p: None)
