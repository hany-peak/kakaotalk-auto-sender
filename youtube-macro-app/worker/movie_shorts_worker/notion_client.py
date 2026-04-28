from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

# Property name constants (mirror the spec's Korean field names)
STATUS_PENDING = "다운로드대기"
STATUS_PROCESSING = "다운로드중"
STATUS_DONE = "다운로드완료"
STATUS_FAILED = "다운로드실패"
STATUS_REJECTED = "반려"


@dataclass(frozen=True)
class Card:
    id: str
    last_edited_time: str
    title: str
    source_url: str
    status: str
    card_no: Optional[int]
    retries: int
    raw: dict  # full Notion page payload, in case extra fields are needed


def _read_title(prop: dict) -> str:
    items = prop.get("title", [])
    if not items:
        return ""
    return "".join(it.get("plain_text", "") for it in items)


def _parse_card(page: dict) -> Card:
    p = page["properties"]
    return Card(
        id=page["id"],
        last_edited_time=page["last_edited_time"],
        title=_read_title(p.get("제목", {})),
        source_url=(p.get("원본_링크") or {}).get("url") or "",
        status=((p.get("상태") or {}).get("select") or {}).get("name") or "",
        card_no=(p.get("카드번호") or {}).get("number"),
        retries=int((p.get("재시도_횟수") or {}).get("number") or 0),
        raw=page,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Map our convenience field names to the Notion properties payload shape.
def _to_property_payload(name: str, value):
    if value is None:
        return {"rich_text": []}
    if name == "제목":
        return {"title": [{"text": {"content": str(value)}}]}
    if name == "상태":
        return {"select": {"name": str(value)}}
    if name in ("처리_시작_시각", "처리_완료_시각"):
        return {"date": {"start": value if isinstance(value, str) else value.isoformat()}}
    if name == "카드번호" or name == "재시도_횟수":
        return {"number": int(value)}
    if name in ("drive_폴더_링크", "drive_파일_링크"):
        return {"url": str(value)}
    # default: rich_text for everything else (drive_파일명, 다운로드_진행률, 에러_메시지, 원본_영상_제목)
    return {"rich_text": [{"text": {"content": str(value)}}]}


class NotionWrapper:
    def __init__(self, *, client, db_id: str):
        self.client = client
        self.db_id = db_id

    def query_pending(self) -> list[Card]:
        res = self.client.databases.query(
            database_id=self.db_id,
            filter={"property": "상태", "select": {"equals": STATUS_PENDING}},
            sorts=[
                {"property": "우선순위", "direction": "ascending"},
                {"timestamp": "created_time", "direction": "ascending"},
            ],
        )
        return [_parse_card(p) for p in res["results"]]

    def find_duplicate(self, url: str, exclude_id: str) -> Optional[Card]:
        res = self.client.databases.query(
            database_id=self.db_id,
            filter={"property": "원본_링크", "url": {"equals": url}},
        )
        for p in res["results"]:
            card = _parse_card(p)
            if card.id == exclude_id:
                continue
            if card.status == STATUS_REJECTED:
                continue
            return card
        return None

    def find_max_card_no(self) -> int:
        res = self.client.databases.query(
            database_id=self.db_id,
            filter={"property": "카드번호", "number": {"is_not_empty": True}},
            sorts=[{"property": "카드번호", "direction": "descending"}],
            page_size=1,
        )
        results = res["results"]
        if not results:
            return 0
        return int(_parse_card(results[0]).card_no or 0)

    def find_stale_in_progress(self, threshold_minutes: int) -> list[Card]:
        res = self.client.databases.query(
            database_id=self.db_id,
            filter={"property": "상태", "select": {"equals": STATUS_PROCESSING}},
        )
        threshold = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
        out: list[Card] = []
        for p in res["results"]:
            card = _parse_card(p)
            ts = datetime.fromisoformat(card.last_edited_time.replace("Z", "+00:00"))
            if ts < threshold:
                out.append(card)
        return out

    def claim(self, card_id: str, card_no: int) -> None:
        self.client.pages.update(
            page_id=card_id,
            properties={
                "상태": _to_property_payload("상태", STATUS_PROCESSING),
                "카드번호": _to_property_payload("카드번호", card_no),
                "처리_시작_시각": _to_property_payload("처리_시작_시각", _now_iso()),
            },
        )

    def update(self, card_id: str, **fields) -> None:
        if not fields:
            return
        props = {k: _to_property_payload(k, v) for k, v in fields.items()}
        self.client.pages.update(page_id=card_id, properties=props)
