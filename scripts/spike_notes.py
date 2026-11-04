"""급등락일 설명 보완.

큰 분석 요청에서 빠졌거나 실패해 '작성하지 못했어요'로 남은 급등락일을
날짜별로 따로 짧게 다시 요청해서 채웁니다.
모델이 뉴스 원인을 찾지 못해 빈 답을 주면, 시세 변동 수치로 만든 문장을 씁니다.
"""
from __future__ import annotations

import re

import analyze

NAMES = {"gold": "금", "silver": "은"}


def _prev_row(rows: list, day: str):
    ordered = sorted(rows, key=lambda r: r["date"])
    for i, r in enumerate(ordered):
        if r["date"] == day and i > 0:
            return ordered[i - 1], r
    return None, None


def context_line(rows: list, day: str, items: list) -> str:
    """그날 국제 현물가와 환율이 얼마나 움직였는지 알려 주는 한 줄."""
    prev, cur = _prev_row(rows or [], day)
    if not cur:
        return ""
    fx = (cur["usdkrw"] / prev["usdkrw"] - 1) * 100
    parts = []
    for m, _pct in items:
        spot = (cur[f"{m}_spot"] / prev[f"{m}_spot"] - 1) * 100
        parts.append(f"국제 {NAMES[m]} 현물 {spot:+.2f}%")
    window = f"한국시간 {prev['date']} 오전 9시부터 {day} 오전 9시까지"
    return f"참고 수치({window}): " + ", ".join(parts) + f", 달러/원 {fx:+.2f}%."


def data_note(rows: list, day: str, metal: str, pct: float) -> str:
    """뉴스 원인을 못 찾았을 때 쓰는, 수치만으로 만든 설명."""
    prev, cur = _prev_row(rows or [], day)
    if not cur:
        return ""
    spot = (cur[f"{metal}_spot"] / prev[f"{metal}_spot"] - 1) * 100
    fx = (cur["usdkrw"] / prev["usdkrw"] - 1) * 100
    word = "상승" if pct > 0 else "하락"
    return (
        f"국제 {NAMES[metal]} 현물이 전일 대비 {spot:+.2f}% 움직였고 "
        f"달러/원 환율은 {fx:+.2f}% 변해 원화 시세는 {pct:+.2f}% {word}했어요. "
        "뚜렷한 뉴스 원인은 확인하지 못했어요."
    )


def build_prompt(day: str, items: list, context: str = "") -> str:
    moves = ", ".join(f"{NAMES[m]} {pct:+.2f}%" for m, pct in items)
    return (
        f"{day} 오전 9시(KST) 기준 금·은 원화 시세가 전일 대비 크게 움직였어요: "
        f"{moves}. {context} "
        "시세는 한국시간 오전 9시 기준이라, 그 움직임은 보통 전날(한국시간 "
        "전날 오전 9시 이후)의 미국 장에서 일어났어요. "
        "날짜가 토요일·일요일·월요일이면 직전 금요일 미국 장 뉴스를 보세요. "
        "웹 검색으로 그 구간의 국제 금·은 시장 뉴스를 확인해서, "
        "금속마다 움직인 이유를 한 문장(80자 이내)으로 쓰세요. "
        "원인이 불확실하면 '~했을 가능성이 있어요'로 쓰고, "
        "태그 없이 순수한 한국어 문장만 쓰세요. "
        'JSON만 출력하세요: {"gold": "...", "silver": "..."} '
        "(움직임이 없는 금속은 빈 문자열)"
    )


def call_day(day: str, items: list, context: str = "") -> dict:
    """급등락일 하나의 설명을 모델에게 받는다. 반환: {"gold": 문장, "silver": 문장}"""
    import anthropic

    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=analyze.MODEL,
        max_tokens=1500,
        system=analyze.SYSTEM,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 4}],
        messages=[{"role": "user", "content": build_prompt(day, items, context)}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    text = re.sub(r"</?cite[^>]*>", "", text)
    return analyze.strip_tags(analyze.extract_json(text))


def fill_missing(analysis_rows: list, rows=None, call=None, limit: int = 8) -> list:
    """자리표시 문구로 남은 급등락일을 날짜별로 다시 작성한다."""
    call = call or call_day
    by_date = {}
    for r in analysis_rows:
        if r["kind"].startswith("spike_") and r.get("text") == analyze.MISSING_TEXT:
            by_date.setdefault(r["date"], []).append(r)
    for day in sorted(by_date, reverse=True)[:limit]:
        items = [(r["kind"][len("spike_"):], float(r["pct"])) for r in by_date[day]]
        try:
            got = call(day, items, context_line(rows, day, items))
        except Exception as e:  # 호출 자체가 실패하면 다음 실행에서 다시 시도한다
            print("급등락일 설명 보완 실패:", day, e)
            continue
        for r in by_date[day]:
            metal = r["kind"][len("spike_"):]
            text = (got.get(metal) or "").strip()
            if not text:
                text = data_note(rows, day, metal, float(r["pct"]))
            if text:
                r["text"] = text
    return analysis_rows
