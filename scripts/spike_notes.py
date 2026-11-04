"""급등락일 설명 보완.

큰 분석 요청에서 빠졌거나 실패해 '작성하지 못했어요'로 남은 급등락일을
날짜별로 따로 짧게 다시 요청해서 채웁니다.
"""
from __future__ import annotations

import re

import analyze

NAMES = {"gold": "금", "silver": "은"}


def build_prompt(day: str, items: list) -> str:
    moves = ", ".join(f"{NAMES[m]} {pct:+.2f}%" for m, pct in items)
    return (
        f"{day} 오전 9시(KST) 기준 금·은 원화 시세가 전일 대비 크게 움직였어요: "
        f"{moves}. "
        "웹 검색으로 그날 국제 금·은 시장 뉴스를 확인해서, "
        "금속마다 움직인 이유를 한 문장(80자 이내)으로 쓰세요. "
        "원인이 불확실하면 '~했을 가능성이 있어요'로 쓰고, "
        "태그 없이 순수한 한국어 문장만 쓰세요. "
        'JSON만 출력하세요: {"gold": "...", "silver": "..."} '
        "(움직임이 없는 금속은 빈 문자열)"
    )


def call_day(day: str, items: list) -> dict:
    """급등락일 하나의 설명을 모델에게 받는다. 반환: {"gold": 문장, "silver": 문장}"""
    import anthropic

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=analyze.MODEL,
        max_tokens=1500,
        system=analyze.SYSTEM,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
        messages=[{"role": "user", "content": build_prompt(day, items)}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    text = re.sub(r"</?cite[^>]*>", "", text)
    return analyze.strip_tags(analyze.extract_json(text))


def fill_missing(analysis_rows: list, call=None, limit: int = 8) -> list:
    """자리표시 문구로 남은 급등락일을 날짜별로 다시 작성한다."""
    call = call or call_day
    by_date = {}
    for r in analysis_rows:
        if r["kind"].startswith("spike_") and r.get("text") == analyze.MISSING_TEXT:
            by_date.setdefault(r["date"], []).append(r)
    for day in sorted(by_date, reverse=True)[:limit]:
        items = [(r["kind"][len("spike_"):], float(r["pct"])) for r in by_date[day]]
        try:
            got = call(day, items)
        except Exception as e:
            print("급등락일 설명 보완 실패:", day, e)
            continue
        for r in by_date[day]:
            text = (got.get(r["kind"][len("spike_"):]) or "").strip()
            if text:
                r["text"] = text
    return analysis_rows
