from pathlib import Path
from unittest.mock import MagicMock, call

import pytest

from movie_shorts_worker.notion_client import (
    Card, STATUS_PENDING, STATUS_PROCESSING, STATUS_DONE, STATUS_FAILED, STATUS_REJECTED,
)
from movie_shorts_worker.ytdlp import VideoMeta, YtdlpError
from movie_shorts_worker.drive import DriveItem
from movie_shorts_worker.poller import Poller


def _card(id_="c1", title="", url="https://x", retries=0):
    return Card(id=id_, last_edited_time="2026-04-28T00:00:00.000Z", title=title,
                source_url=url, status=STATUS_PENDING, card_no=None, retries=retries, raw={})


@pytest.fixture
def deps(mocker, tmp_path: Path):
    notion = MagicMock()
    drive = MagicMock()
    cfg = MagicMock(tmp_dir=tmp_path, drive_root_folder_name="movie-shorts-raw",
                    progress_update_interval_sec=0, max_retries=3)
    logger = MagicMock()
    return notion, drive, cfg, logger


def test_process_card_happy_path(deps, mocker, tmp_path: Path):
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 5
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="auto title", uploader="u", duration=60, ext="mp4"))
    mp4 = tmp_path / "card_dir" / "auto title.mp4"
    mp4.parent.mkdir(parents=True)
    mp4.write_bytes(b"x")
    mocker.patch("movie_shorts_worker.poller.ytdlp_download", return_value=mp4)
    drive.ensure_folder.side_effect = [
        DriveItem(id="root_id", web_view_link="https://d/root"),
        DriveItem(id="sub_id", web_view_link="https://d/sub"),
    ]
    drive.upload.return_value = DriveItem(id="fid", web_view_link="https://d/fid")

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card())

    # claim called with next card no
    notion.claim.assert_called_once_with("c1", card_no=6)
    # title backfilled (was empty)
    title_update_args = notion.update.call_args_list[0]
    assert title_update_args.kwargs["원본_영상_제목"] == "auto title"
    assert title_update_args.kwargs["제목"] == "auto title"
    # final update — completed
    final = notion.update.call_args_list[-1]
    assert final.kwargs["상태"] == STATUS_DONE
    assert final.kwargs["drive_폴더_링크"] == "https://d/sub"
    assert final.kwargs["drive_파일_링크"] == "https://d/fid"
    drive.set_link_share_viewer.assert_called_once_with("fid")


def test_process_card_skips_when_duplicate(deps):
    notion, drive, cfg, logger = deps
    existing = _card(id_="other"); existing = existing.__class__(**{**existing.__dict__, "card_no": 7})
    notion.find_duplicate.return_value = existing

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card(id_="new"))

    notion.claim.assert_not_called()
    args = notion.update.call_args
    assert args.kwargs["상태"] == STATUS_REJECTED
    assert "중복" in args.kwargs["에러_메시지"]
    drive.upload.assert_not_called()


def test_process_card_keeps_user_title_when_present(deps, mocker, tmp_path: Path):
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 0
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="auto", uploader="u", duration=60, ext="mp4"))
    mp4 = tmp_path / "out.mp4"; mp4.write_bytes(b"x")
    mocker.patch("movie_shorts_worker.poller.ytdlp_download", return_value=mp4)
    drive.ensure_folder.return_value = DriveItem(id="x", web_view_link="https://d/x")
    drive.upload.return_value = DriveItem(id="f", web_view_link="https://d/f")

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card(title="유주얼 서스펙트"))

    update0 = notion.update.call_args_list[0].kwargs
    assert update0["원본_영상_제목"] == "auto"
    assert "제목" not in update0  # do NOT overwrite user-provided


def test_process_card_retries_on_download_failure(deps, mocker):
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 0
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="x", uploader="", duration=10, ext="mp4"))
    mocker.patch("movie_shorts_worker.poller.ytdlp_download",
                 side_effect=YtdlpError("network blip"))

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card(retries=0))

    # status returned to 다운로드대기, retries incremented
    args = notion.update.call_args.kwargs
    assert args["상태"] == STATUS_PENDING
    assert args["재시도_횟수"] == 1
    assert "network blip" in args["에러_메시지"]


def test_process_card_terminates_after_max_retries(deps, mocker):
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 0
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="x", uploader="", duration=10, ext="mp4"))
    mocker.patch("movie_shorts_worker.poller.ytdlp_download",
                 side_effect=YtdlpError("permanent"))

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card(retries=2))  # this is the 3rd attempt

    args = notion.update.call_args.kwargs
    assert args["상태"] == STATUS_FAILED
    assert args["재시도_횟수"] == 3


def test_recover_stale_resets_to_pending(deps):
    notion, drive, cfg, logger = deps
    stale = [_card(id_="s1"), _card(id_="s2")]
    notion.find_stale_in_progress.return_value = stale

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.recover_stale()

    notion.find_stale_in_progress.assert_called_once_with(threshold_minutes=5)
    assert notion.update.call_args_list == [
        call("s1", 상태=STATUS_PENDING),
        call("s2", 상태=STATUS_PENDING),
    ]


def test_process_card_reuses_card_no_on_retry(deps, mocker, tmp_path: Path):
    """When a card already has card_no (it's a retry), do NOT allocate a new number."""
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="t", uploader="u", duration=10, ext="mp4"))
    mp4 = tmp_path / "out.mp4"; mp4.write_bytes(b"x")
    mocker.patch("movie_shorts_worker.poller.ytdlp_download", return_value=mp4)
    drive.ensure_folder.return_value = DriveItem(id="x", web_view_link="https://d/x")
    drive.upload.return_value = DriveItem(id="f", web_view_link="https://d/f")

    # Card already has card_no=42 from a previous claim
    retry_card = Card(id="c1", last_edited_time="2026-04-28T00:00:00.000Z", title="",
                      source_url="https://x", status=STATUS_PENDING, card_no=42, retries=1, raw={})

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(retry_card)

    notion.claim.assert_called_once_with("c1", card_no=42)
    notion.find_max_card_no.assert_not_called()


def test_process_card_cleans_up_temp_on_drive_failure(deps, mocker, tmp_path: Path):
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 0
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 return_value=VideoMeta(title="t", uploader="u", duration=10, ext="mp4"))
    # Download succeeds — file exists on disk
    card_dir = tmp_path / "c1"
    card_dir.mkdir()
    mp4 = card_dir / "out.mp4"; mp4.write_bytes(b"x")
    mocker.patch("movie_shorts_worker.poller.ytdlp_download", return_value=mp4)
    # Drive upload blows up
    drive.ensure_folder.return_value = DriveItem(id="x", web_view_link="https://d/x")
    drive.upload.side_effect = RuntimeError("drive 5xx")

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    p.process_one_card(_card())

    # The temp file/dir should have been cleaned up despite the failure
    assert not mp4.exists()
    assert not card_dir.exists()


def test_is_paused_starts_false_then_toggles(deps):
    notion, drive, cfg, logger = deps
    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    assert p.is_paused() is False
    p.pause()
    assert p.is_paused() is True
    p.resume()
    assert p.is_paused() is False


def test_handle_failure_swallows_notion_outage(deps, mocker):
    """If notion.update inside _handle_failure raises, the worker logs and continues — does not propagate."""
    notion, drive, cfg, logger = deps
    notion.find_duplicate.return_value = None
    notion.find_max_card_no.return_value = 0
    mocker.patch("movie_shorts_worker.poller.ytdlp_extract_meta",
                 side_effect=RuntimeError("yt-dlp boom"))
    notion.update.side_effect = RuntimeError("notion 429")

    p = Poller(notion=notion, drive=drive, config=cfg, logger=logger)
    # Should NOT raise, even though both yt-dlp and notion fail
    p.process_one_card(_card())
    logger.exception.assert_called()
