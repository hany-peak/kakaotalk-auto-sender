from pathlib import Path
from unittest.mock import MagicMock

import pytest

from movie_shorts_worker.drive import DriveClient


def _service_with_files_list(items):
    svc = MagicMock()
    svc.files.return_value.list.return_value.execute.return_value = {"files": items}
    return svc


def test_ensure_folder_returns_existing(mocker):
    svc = _service_with_files_list([{"id": "abc", "webViewLink": "https://d/abc"}])
    drive = DriveClient(service=svc)
    folder = drive.ensure_folder(name="root", parent_id=None)
    assert folder.id == "abc"
    svc.files.return_value.create.assert_not_called()


def test_ensure_folder_creates_when_missing(mocker):
    svc = _service_with_files_list([])
    svc.files.return_value.create.return_value.execute.return_value = {
        "id": "new", "webViewLink": "https://d/new",
    }
    drive = DriveClient(service=svc)
    folder = drive.ensure_folder(name="movie", parent_id="root_id")
    assert folder.id == "new"
    create_kwargs = svc.files.return_value.create.call_args.kwargs
    body = create_kwargs["body"]
    assert body["name"] == "movie"
    assert body["mimeType"] == "application/vnd.google-apps.folder"
    assert body["parents"] == ["root_id"]


def test_upload_returns_file_id_and_link(mocker, tmp_path: Path):
    f = tmp_path / "x.mp4"
    f.write_bytes(b"fake-bytes")
    svc = MagicMock()
    svc.files.return_value.create.return_value.execute.return_value = {
        "id": "fid", "webViewLink": "https://d/fid",
    }
    mocker.patch("movie_shorts_worker.drive.MediaFileUpload", autospec=True)
    drive = DriveClient(service=svc)
    res = drive.upload(f, parent_id="folder_id")
    assert res.id == "fid"
    assert res.web_view_link == "https://d/fid"


def test_set_link_share_viewer(mocker):
    svc = MagicMock()
    drive = DriveClient(service=svc)
    drive.set_link_share_viewer("fid")
    svc.permissions.return_value.create.assert_called_once()
    body = svc.permissions.return_value.create.call_args.kwargs["body"]
    assert body == {"type": "anyone", "role": "reader"}
