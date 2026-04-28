import logging
from pathlib import Path

from movie_shorts_worker.log import setup_logger, notify


def test_setup_logger_writes_to_dated_file(tmp_path: Path):
    logger = setup_logger(tmp_path, name="test")
    logger.info("hello world")
    for h in logger.handlers:
        h.flush()
    files = list(tmp_path.glob("worker-*.log"))
    assert len(files) == 1
    assert "hello world" in files[0].read_text()


def test_setup_logger_idempotent(tmp_path: Path):
    a = setup_logger(tmp_path, name="dup")
    b = setup_logger(tmp_path, name="dup")
    assert a is b
    assert len(a.handlers) == len(b.handlers)


def test_notify_invokes_osascript(mocker):
    run = mocker.patch("subprocess.run")
    notify("title", "body")
    run.assert_called_once()
    args = run.call_args.args[0]
    assert "osascript" in args[0]
    assert any("title" in a for a in args)
