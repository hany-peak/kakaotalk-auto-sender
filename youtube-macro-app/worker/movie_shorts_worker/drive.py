from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


@dataclass(frozen=True)
class DriveItem:
    id: str
    web_view_link: str


def load_credentials(token_path: Path) -> Credentials:
    """Load Drive credentials from a token file. Refresh if expired.
    Enforces chmod 600 on the token file."""
    if not token_path.exists():
        raise FileNotFoundError(
            f"Drive token not found at {token_path}. "
            "Run scripts/oauth_setup.py first."
        )
    # Enforce restrictive permissions on the token file.
    mode = token_path.stat().st_mode & 0o777
    if mode & 0o077:
        token_path.chmod(0o600)
    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            token_path.write_text(creds.to_json())
            token_path.chmod(0o600)
        else:
            raise RuntimeError("Drive credentials invalid and unrefreshable")
    return creds


class DriveClient:
    def __init__(self, *, service=None, token_path: Optional[Path] = None):
        if service is not None:
            self.service = service
        else:
            if token_path is None:
                raise ValueError("DriveClient requires either service= or token_path=")
            creds = load_credentials(token_path)
            self.service = build("drive", "v3", credentials=creds, cache_discovery=False)

    def ensure_folder(self, name: str, parent_id: Optional[str]) -> DriveItem:
        """Find or create a folder by name under parent_id (or root if None)."""
        q_parts = [
            f"name = '{_escape(name)}'",
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ]
        if parent_id:
            q_parts.append(f"'{parent_id}' in parents")
        res = (
            self.service.files()
            .list(q=" and ".join(q_parts), fields="files(id, webViewLink)", pageSize=1)
            .execute()
        )
        items = res.get("files", [])
        if items:
            return DriveItem(id=items[0]["id"], web_view_link=items[0].get("webViewLink", ""))
        body = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
        if parent_id:
            body["parents"] = [parent_id]
        created = (
            self.service.files()
            .create(body=body, fields="id, webViewLink")
            .execute()
        )
        return DriveItem(id=created["id"], web_view_link=created.get("webViewLink", ""))

    def upload(self, path: Path, parent_id: str) -> DriveItem:
        media = MediaFileUpload(str(path), mimetype="video/mp4", resumable=True)
        body = {"name": path.name, "parents": [parent_id]}
        created = (
            self.service.files()
            .create(body=body, media_body=media, fields="id, webViewLink")
            .execute()
        )
        return DriveItem(id=created["id"], web_view_link=created.get("webViewLink", ""))

    def set_link_share_viewer(self, file_id: str) -> None:
        self.service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
        ).execute()


def _escape(s: str) -> str:
    return s.replace("'", "\\'")
