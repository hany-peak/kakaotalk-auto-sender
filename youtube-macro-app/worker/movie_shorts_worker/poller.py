import re
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from .drive import DriveClient, DriveItem
from .notion_client import (
    Card, NotionWrapper,
    STATUS_PENDING, STATUS_PROCESSING, STATUS_DONE, STATUS_FAILED, STATUS_REJECTED,
)
from .ytdlp import VideoMeta, YtdlpError, extract_meta as ytdlp_extract_meta, download as ytdlp_download


_INVALID_PATH_CHARS = re.compile(r"[\\/:*?\"<>|]")


def _sanitize(name: str, max_len: int = 80) -> str:
    cleaned = _INVALID_PATH_CHARS.sub("_", name).strip() or "untitled"
    return cleaned[:max_len]


@dataclass
class StatusReport:
    state: str  # "idle" | "working" | "error"
    message: str = ""


class Poller:
    def __init__(self, *, notion: NotionWrapper, drive: DriveClient, config, logger):
        self.notion = notion
        self.drive = drive
        self.cfg = config
        self.log = logger
        self._status_cb: Optional[Callable[[StatusReport], None]] = None
        self._stop = threading.Event()
        self._unpaused = threading.Event()
        self._unpaused.set()           # not paused initially
        self._root_folder_id: Optional[str] = None

    # ---------- public API ----------

    def on_status(self, cb: Callable[[StatusReport], None]) -> None:
        self._status_cb = cb

    def pause(self) -> None:
        self._unpaused.clear()

    def resume(self) -> None:
        self._unpaused.set()

    def stop(self) -> None:
        self._stop.set()

    def is_paused(self) -> bool:
        return not self._unpaused.is_set()

    def is_stopped(self) -> bool:
        return self._stop.is_set()

    def run_forever(self) -> None:
        self.recover_stale()
        while not self._stop.is_set():
            # Block here while paused; this also lets stop() interrupt us.
            if not self._unpaused.is_set():
                if self._stop.wait(timeout=self.cfg.poll_interval_sec):
                    return
                continue
            try:
                cards = self.notion.query_pending()
            except Exception as e:
                self.log.exception("notion query failed: %s", e)
                self._report("error", f"poll error: {e}")
                if self._stop.wait(timeout=self.cfg.poll_interval_sec):
                    return
                continue
            if not cards:
                self._report("idle", "")
                if self._stop.wait(timeout=self.cfg.poll_interval_sec):
                    return
                continue
            for i, card in enumerate(cards, start=1):
                if self._stop.is_set() or not self._unpaused.is_set():
                    break
                self._report("working", f"{i}/{len(cards)} {card.title or card.source_url}")
                self.process_one_card(card)

    def recover_stale(self) -> None:
        try:
            stale = self.notion.find_stale_in_progress(threshold_minutes=5)
        except Exception:
            self.log.exception("recover_stale: notion query failed")
            return
        for card in stale:
            try:
                self.log.info("recovering stale card %s back to pending", card.id)
                self.notion.update(card.id, 상태=STATUS_PENDING)
            except Exception:
                self.log.exception("recover_stale: failed to update %s", card.id)

    def process_one_card(self, card: Card) -> None:
        # 1. duplicate check
        dup = self.notion.find_duplicate(card.source_url, exclude_id=card.id)
        if dup is not None:
            ref = dup.card_no if dup.card_no is not None else dup.id
            msg = f"중복 링크 — 기존 카드 #{ref} 와 동일"
            self.log.info("rejecting %s as duplicate of %s", card.id, dup.id)
            self.notion.update(card.id, 상태=STATUS_REJECTED, 에러_메시지=msg)
            return

        # 2. claim — re-use existing card_no on retry to keep folder name stable
        if card.card_no is None:
            next_no = self.notion.find_max_card_no() + 1
        else:
            next_no = card.card_no
        self.notion.claim(card.id, card_no=next_no)
        card_tmp = self.cfg.tmp_dir / card.id

        try:
            # 3. metadata + auto title
            meta = ytdlp_extract_meta(card.source_url)
            title_update: dict = {"원본_영상_제목": meta.title}
            if not card.title:
                title_update["제목"] = meta.title
            self.notion.update(card.id, **title_update)
            title_for_folder = card.title or meta.title

            # 4. download
            last_emit = [0.0]
            def progress(pct: int):
                now = time.monotonic()
                if now - last_emit[0] >= self.cfg.progress_update_interval_sec:
                    self.notion.update(card.id, 다운로드_진행률=f"{pct}%")
                    last_emit[0] = now
            local_path = ytdlp_download(card.source_url, out_dir=card_tmp, on_progress=progress)

            # 5. drive upload
            root = self._ensure_root_folder()
            folder_name = f"{next_no:03d}_{_sanitize(title_for_folder)}"
            sub = self.drive.ensure_folder(folder_name, parent_id=root)
            uploaded = self.drive.upload(local_path, parent_id=sub.id)
            self.drive.set_link_share_viewer(uploaded.id)

            # 6. record success
            self.notion.update(
                card.id,
                상태=STATUS_DONE,
                drive_폴더_링크=sub.web_view_link,
                drive_파일_링크=uploaded.web_view_link,
                drive_파일명=local_path.name,
                다운로드_진행률="done",
                처리_완료_시각=_now_iso(),
            )
        except Exception as e:
            self._handle_failure(card, e)
        finally:
            self._cleanup(card_tmp)

    # ---------- internals ----------

    def _ensure_root_folder(self) -> str:
        if self._root_folder_id is None:
            root = self.drive.ensure_folder(self.cfg.drive_root_folder_name, parent_id=None)
            self._root_folder_id = root.id
        return self._root_folder_id

    def _handle_failure(self, card: Card, exc: Exception) -> None:
        new_retries = card.retries + 1
        self.log.exception("card %s failed (attempt %d): %s", card.id, new_retries, exc)
        common = {
            "재시도_횟수": new_retries,
            "에러_메시지": str(exc)[:500],
            "다운로드_진행률": "",
        }
        if new_retries >= self.cfg.max_retries:
            self._safe_notion_update(card.id, 상태=STATUS_FAILED, **common)
        else:
            self._safe_notion_update(card.id, 상태=STATUS_PENDING, **common)

    def _safe_notion_update(self, card_id: str, **fields) -> None:
        """notion.update with exception swallowing — used by failure paths so a
        Notion outage cannot leave a card stuck in 다운로드중. The next periodic
        recover_stale() call will clean up if this also fails."""
        try:
            self.notion.update(card_id, **fields)
        except Exception:
            self.log.exception("notion.update failed for card %s; will rely on recover_stale", card_id)

    def _cleanup(self, path: Path) -> None:
        if not path.exists():
            return
        for child in path.glob("*"):
            try:
                child.unlink()
            except OSError:
                pass
        try:
            path.rmdir()
        except OSError:
            pass

    def _report(self, state: str, message: str) -> None:
        if self._status_cb:
            try:
                self._status_cb(StatusReport(state=state, message=message))
            except Exception:
                pass


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
