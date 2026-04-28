import subprocess
import threading
from datetime import datetime
from pathlib import Path

import rumps
from notion_client import Client as NotionClient

from .config import load_config
from .drive import DriveClient
from .log import notify, setup_logger
from .notion_client import NotionWrapper
from .poller import Poller, StatusReport


class MovieShortsApp(rumps.App):
    def __init__(self):
        super().__init__("🎬", quit_button=None)
        self.cfg = load_config()
        self.log = setup_logger(self.cfg.log_dir)

        notion_raw = NotionClient(auth=self.cfg.notion_token)
        notion = NotionWrapper(client=notion_raw, db_id=self.cfg.notion_db_id)
        drive = DriveClient(token_path=self.cfg.google_token_path)
        self.poller = Poller(notion=notion, drive=drive, config=self.cfg, logger=self.log)
        self.poller.on_status(self._on_status)

        # Menu items (rumps mutates these by reference)
        self.status_item = rumps.MenuItem("상태: 시작 중…")
        self.last_run_item = rumps.MenuItem("마지막 실행: -")
        self.pause_item = rumps.MenuItem("폴링 일시정지", callback=self._toggle_pause)
        self.menu = [
            self.status_item,
            self.last_run_item,
            None,
            rumps.MenuItem("로그 보기", callback=self._open_log),
            self.pause_item,
            rumps.MenuItem("종료", callback=self._quit),
        ]
        self._thread = threading.Thread(target=self._run_poller, daemon=True)
        self._thread.start()

    def _run_poller(self):
        try:
            self.poller.run_forever()
        except Exception as e:
            self.log.exception("poller crashed: %s", e)
            notify("Movie Shorts Worker", f"워커 크래시: {e}")

    def _on_status(self, report: StatusReport):
        if report.state == "idle":
            self.title = "🎬"
            self.status_item.title = "상태: 대기 중"
        elif report.state == "working":
            self.title = "⏳"
            self.status_item.title = f"상태: {report.message}"
            self.last_run_item.title = f"마지막 실행: {datetime.now():%m/%d %H:%M}"
        elif report.state == "error":
            self.title = "⚠️"
            self.status_item.title = f"상태: {report.message}"
            notify("Movie Shorts Worker", report.message)

    def _toggle_pause(self, sender):
        if self.poller._paused:
            self.poller.resume()
            sender.title = "폴링 일시정지"
        else:
            self.poller.pause()
            sender.title = "폴링 재개"

    def _open_log(self, _):
        files = sorted(self.cfg.log_dir.glob("worker-*.log"))
        if not files:
            notify("Movie Shorts Worker", "로그 파일 없음")
            return
        subprocess.run(["open", str(files[-1])], check=False)

    def _quit(self, _):
        self.poller.stop()
        rumps.quit_application()


def main():
    MovieShortsApp().run()


if __name__ == "__main__":
    main()
