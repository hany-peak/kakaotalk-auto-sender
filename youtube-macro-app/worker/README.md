# movie-shorts-worker

Local macOS menubar worker that polls a Notion DB for movie-shorts video cards, downloads each video with yt-dlp, uploads it to Google Drive in a numbered per-movie folder, and records the result back in Notion.

See spec: [../docs/specs/2026-04-28-b-downloader-design.md](../docs/specs/2026-04-28-b-downloader-design.md)

## Prerequisites

- macOS (uses `osascript` for notifications and `rumps` for the menubar)
- Python 3.11+
- `yt-dlp` available on PATH (`brew install yt-dlp` or `pip install yt-dlp`)
- A Notion integration token + the target database shared with that integration
- A Google Cloud project with the Drive API enabled and an OAuth 2.0 Client ID (Desktop application type)

## Notion DB setup

Create a Notion database with the columns listed in section 3 of the spec. The `상태` Select column must include all values: `다운로드대기 / 다운로드중 / 다운로드완료 / 다운로드실패 / 반려`. Default value: `다운로드대기`.

Share the database with your Notion integration (… menu → Connect to → your integration).

## Install

```bash
cd youtube-macro-app/worker
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Fill in NOTION_TOKEN, NOTION_DB_ID, GOOGLE_OAUTH_CLIENT_SECRETS, etc.
```

Place your Google OAuth `client_secret_*.json` at the path you set in `GOOGLE_OAUTH_CLIENT_SECRETS`.

## First-time Drive OAuth

```bash
python scripts/oauth_setup.py
```

This opens a browser for Google consent and writes the token to `GOOGLE_TOKEN_PATH`.

## Run (foreground, for testing)

```bash
python -m movie_shorts_worker.menubar
```

A 🎬 icon should appear in the menubar.

## Run at login (LaunchAgent)

```bash
./scripts/install_launchagent.sh
```

To stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.movie-shorts.worker.plist
```

## Manual end-to-end smoke test

1. Add one card to Notion: `제목` blank, `원본_링크` = a short public YouTube URL, `상태` = `다운로드대기`.
2. Within ~30 s the menubar shows ⏳ and the title fills in (`원본_영상_제목` first, then `제목`).
3. The card status moves to `다운로드중` then `다운로드완료`.
4. `drive_폴더_링크` and `drive_파일_링크` are populated; clicking them opens the file in Drive.
5. Add a *second* card with the **same URL** → within 30 s it's marked `반려` with `중복 링크 — 기존 카드 #N 와 동일`.

## Troubleshooting

- **Token expired / invalid grant** — re-run `scripts/oauth_setup.py`.
- **No menubar icon** — check `~/Library/Logs/movie-shorts-worker/launchd.err.log`.
- **`yt-dlp: command not found`** — `brew install yt-dlp` or add the venv path to PATH.
