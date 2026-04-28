from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from movie_shorts_worker.notion_client import NotionWrapper, Card


def _page(card_id="c1", url="https://x", status="다운로드대기", card_no=None,
          retries=0, title="", last_edited="2026-04-28T00:00:00.000Z"):
    return {
        "id": card_id,
        "last_edited_time": last_edited,
        "properties": {
            "제목": {"title": [{"plain_text": title}] if title else []},
            "원본_링크": {"url": url},
            "상태": {"select": {"name": status}},
            "카드번호": {"number": card_no},
            "재시도_횟수": {"number": retries},
        },
    }


def test_query_pending_filters_by_status_and_sorts(mocker):
    raw = MagicMock()
    raw.databases.query.return_value = {"results": [_page("a"), _page("b")]}
    n = NotionWrapper(client=raw, db_id="db")
    cards = n.query_pending()
    assert [c.id for c in cards] == ["a", "b"]
    call = raw.databases.query.call_args.kwargs
    assert call["database_id"] == "db"
    assert call["filter"]["property"] == "상태"
    assert call["filter"]["select"]["equals"] == "다운로드대기"
    sorts = call["sorts"]
    assert sorts[0]["property"] == "우선순위"
    assert sorts[1]["timestamp"] == "created_time"


def test_find_duplicate_excludes_self_and_rejected(mocker):
    raw = MagicMock()
    raw.databases.query.return_value = {"results": [
        _page("self", url="https://X"),
        _page("rejected", url="https://X", status="반려"),
        _page("other", url="https://X", status="다운로드완료", card_no=7),
    ]}
    n = NotionWrapper(client=raw, db_id="db")
    dup = n.find_duplicate("https://X", exclude_id="self")
    assert dup is not None
    assert dup.id == "other"
    assert dup.card_no == 7


def test_find_duplicate_returns_none(mocker):
    raw = MagicMock()
    raw.databases.query.return_value = {"results": [_page("self", url="https://X")]}
    n = NotionWrapper(client=raw, db_id="db")
    assert n.find_duplicate("https://X", exclude_id="self") is None


def test_find_max_card_no(mocker):
    raw = MagicMock()
    # With the is_not_empty filter + descending sort + page_size=1,
    # Notion returns the single max-card_no row.
    raw.databases.query.return_value = {"results": [_page("a", card_no=7)]}
    n = NotionWrapper(client=raw, db_id="db")
    assert n.find_max_card_no() == 7

    # Verify the query was sent with the right filter and pagination
    call = raw.databases.query.call_args.kwargs
    assert call["filter"]["property"] == "카드번호"
    assert call["filter"]["number"] == {"is_not_empty": True}
    assert call["sorts"][0]["direction"] == "descending"
    assert call["page_size"] == 1


def test_find_max_card_no_returns_zero_when_empty(mocker):
    raw = MagicMock()
    raw.databases.query.return_value = {"results": []}
    n = NotionWrapper(client=raw, db_id="db")
    assert n.find_max_card_no() == 0


def test_find_stale_in_progress(mocker):
    raw = MagicMock()
    fresh = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
    raw.databases.query.return_value = {"results": [
        _page("fresh", status="다운로드중", last_edited=fresh),
        _page("stale", status="다운로드중", last_edited=stale),
    ]}
    n = NotionWrapper(client=raw, db_id="db")
    cards = n.find_stale_in_progress(threshold_minutes=5)
    assert [c.id for c in cards] == ["stale"]


def test_claim_updates_atomic_fields(mocker):
    raw = MagicMock()
    n = NotionWrapper(client=raw, db_id="db")
    n.claim("c1", card_no=42)
    update_kwargs = raw.pages.update.call_args.kwargs
    assert update_kwargs["page_id"] == "c1"
    props = update_kwargs["properties"]
    assert props["상태"] == {"select": {"name": "다운로드중"}}
    assert props["카드번호"] == {"number": 42}
    assert "처리_시작_시각" in props


def test_update_maps_known_fields(mocker):
    raw = MagicMock()
    n = NotionWrapper(client=raw, db_id="db")
    n.update(
        "c1",
        제목="자동제목",
        다운로드_진행률="45%",
        drive_파일_링크="https://d/x",
    )
    props = raw.pages.update.call_args.kwargs["properties"]
    assert props["제목"]["title"][0]["text"]["content"] == "자동제목"
    assert props["다운로드_진행률"]["rich_text"][0]["text"]["content"] == "45%"
    assert props["drive_파일_링크"]["url"] == "https://d/x"
