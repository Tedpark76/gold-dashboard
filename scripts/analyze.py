"""시장분석 작성 (Claude API + 웹 검색).

숫자는 코드가 계산하고, 문장은 모델이 쓴다.
"""
from __future__ import annotations

import json
import os
import re

MODEL = os.environ.get("ANTHROPIC_MODEL") or "claude-sonnet-5-5"
NOTICE = (
    "투자 권유가 아닌 참고용 정보이며, "
    "국제 현물가×환율로 환산한 값이라 "
    "실제 거래가와 다를 수 있습니다."
)

MISSING_TEXT = "당일 시장분석을 작성하지 못했어요."

SYSTEM = (
    "당신은 금·은 시세를 쉽게 풀어 주는 한국어 시장 해설가입니다. "
    "주어진 수치와 웹 검색으로 확인한 당일 뉴스만 근거로 쓰고, "
    "원인을 단정하기 어려우면 '~했을 가능성이 있어요'처럼 "
    "가능성으로 표현합니다. "
    "투자 권유·매수/매도 의견은 쓰지 않습니다. "
    "문장은 '~했어요' 말투로 짧게 씁니다. "
    "금·은 공통 요인은 한 번만 설명하고 서로 반복하지 않습니다. "
    "출처 표시용 태그나 HTML(<cite> 등)은 절대 쓰지 말고 "
    "순수한 한국어 문장만 씁니다. "
    "반드시 JSON만 출력합니다."
)

SCHEMA_HINT = """{
  "headline_reason": "핵심 요인 한 문장(60자 이내)",
  "common": "금·은 공통 요인 1~2문장",
  "gold": "금 고유 요인 1~2문장",
  "silver": "은 고유 요인 1~2문장",
  "schedule": "오늘 주목할 일정 1문장 (없으면 빈 문자열)",
  "factors": [
    {
      "icon": "이모지 1개",
      "title": "요인 이름",
      "target": "금·은 | 금 | 은",
      "impact": "up | down | flat",
      "summary": "한 줄 요약(40자 이내)",
      "text": "쉬운 설명 1~2문장"
    }
  ],
  "checkpoint": {
    "icon": "이모지 1개",
    "title": "오늘의 체크포인트",
    "summary": "금·은 시세에 가장 큰 영향을 줄 핵심 요인 키워드 2~4개를 ' · '로 이은 한 줄",
    "text": "왜 지켜봐야 하는지 짧은 한 문장(30자 이내)"
  },
  "spikes": [
    {"metal": "gold | silver", "date": "YYYY-MM-DD", "text": "급등락 이유 1문장"}
  ]
}"""


def _fmt_state(v: float) -> str:
    return "콘탱고" if v >= 0 else "백워데이션"


def build_prompt(rows: list, new_spikes: list) -> str:
    t = rows[-1]
    y = rows[-2] if len(rows) > 1 else rows[-1]
    gs, ss = t["gold_spread_pct"], t["silver_spread_pct"]
    lines = [
        f"기준일: {t['date']} ({t['weekday']}) 한국시간 장중 갱신, 국제시장 기준",
        f"원화 금 {t['gold_krw_don']:,}원/돈 "
        f"(전일 대비 {t['gold_krw_dod_pct']:+.2f}%)",
        f"원화 은 {t['silver_krw_don']:,}원/돈 "
        f"(전일 대비 {t['silver_krw_dod_pct']:+.2f}%)",
        f"달러/원 {t['usdkrw']:,.2f} (전일 {y['usdkrw']:,.2f})",
        f"금 현물 {t['gold_spot']:,.2f}, 선물 {t['gold_fut']:,.2f}, "
        f"괴리율 {gs:+.2f}% {_fmt_state(gs)}",
        f"은 현물 {t['silver_spot']:,.2f}, 선물 {t['silver_fut']:,.2f}, "
        f"괴리율 {ss:+.2f}% {_fmt_state(ss)}",
    ]
    if new_spikes:
        items = ", ".join(
            f"{s['metal']} {s['date']} {s['pct']:+.2f}%" for s in new_spikes
        )
        lines.append("분석이 필요한 급등락일(전일 대비 ±3% 이상): " + items)
    else:
        lines.append("분석이 필요한 급등락일: 없음 (spikes는 빈 배열)")
    ask = (
        "\n\n웹 검색으로 오늘(또는 급등락일)의 금·은 관련 주요 뉴스를 확인한 뒤, "
        "아래 JSON 형식으로만 답하세요. "
        "factors는 정확히 4개이고, 아래 순서와 title, target을 그대로 쓰세요. "
        "1) title '달러·환율' (target '금·은'), "
        "2) title '금리·연준' (target '금·은'), "
        "3) title '금 수요' (target '금'), "
        "4) title '은 수요' (target '은'). "
        "각 항목에는 그 요인이 오늘 금·은 시세 등락에 어떤 영향을 줬는지를 "
        "summary와 text로 설명하세요. "
        "3번과 4번은 수요 쪽에서 시세를 움직인 원인을 풀어 쓰되, "
        "오늘 실제로 확인된 내용만 쓰세요. "
        "(참고 예: 금은 아시아 장신구 수요, 중국·인도 소매 매수, "
        "각국 중앙은행 매수 / 은은 데이터센터·반도체·통신기기·AI 등 산업 수요. "
        "이 예시를 억지로 모두 넣지 마세요.) "
        "달러·금리 이야기는 3, 4번에 반복하지 마세요.\n"
    )

    return "\n".join(lines) + ask + SCHEMA_HINT


TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")


def strip_tags(x):
    """모델이 섞어 넣은 <cite ...> 같은 태그를 지우고 안의 글만 남긴다."""
    if isinstance(x, str):
        return TAG_RE.sub("", x).strip()
    if isinstance(x, list):
        return [strip_tags(i) for i in x]
    if isinstance(x, dict):
        return {k: strip_tags(v) for k, v in x.items()}
    return x


def extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("모델 응답에서 JSON을 찾지 못했습니다")
    return json.loads(m.group(0))


def call_model(prompt: str) -> dict:
    import anthropic

    client = anthropic.Anthropic(timeout=240.0, max_retries=1)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=6000,
        system=SYSTEM,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}],
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    text = re.sub(r"</?cite[^>]*>", "", text)
    return strip_tags(extract_json(text))


def build_rows(rows: list, result: dict, new_spikes: list, old_rows: list) -> list:
    """사이트가 읽는 analysis.json 행 목록을 만든다."""
    t = rows[-1]
    gs, ss = t["gold_spread_pct"], t["silver_spread_pct"]
    date = t["date"]
    gold_line = (
        f"원화 금 시세 {t['gold_krw_don']:,}원/돈(3.75g), "
        f"전일 대비 {t['gold_krw_dod_pct']:+.2f}% (국제가 환산)"
    )
    silver_line = (
        f"원화 은 시세 {t['silver_krw_don']:,}원/돈, "
        f"전일 대비 {t['silver_krw_dod_pct']:+.2f}% · "
        f"달러/원 {t['usdkrw']:,.2f}원"
    )
    spread_line = (
        f"금 괴리율 {gs:+.2f}% {_fmt_state(gs)}, "
        f"은 괴리율 {ss:+.2f}% {_fmt_state(ss)}. "
        "양수는 콘탱고, 음수는 백워데이션이에요."
    )
    scale_text = (
        "선물이 현물보다 비싸면 콘탱고, 싸면 백워데이션이에요. "
        "간격이 갑자기 커지면 수급이 한쪽으로 쏠렸다는 신호일 수 있어요."
    )
    out = [
        dict(id="h1", kind="headline", no=1, date=date, title="", text=gold_line),
        dict(id="h2", kind="headline", no=2, date=date, title="", text=silver_line),
        dict(id="h3", kind="headline", no=3, date=date, title="",
             text=result["headline_reason"]),
        dict(id="m1", kind="common", no=1, date=date, title="공통 요인",
             text=result["common"]),
        dict(id="m2", kind="gold", no=2, date=date, title="금 요인",
             text=result["gold"]),
        dict(id="m3", kind="silver", no=3, date=date, title="은 요인",
             text=result["silver"]),
        dict(id="m4", kind="spread", no=4, date=date, title="선물·현물 괴리",
             text=spread_line),
        dict(id="m5", kind="schedule", no=5, date=date, title="오늘의 주목 일정",
             text=result.get("schedule", "")),
        dict(id="n1", kind="notice", no=6, date=date, title="안내", text=NOTICE),
    ]
    for i, f in enumerate(result["factors"][:4], start=1):
        out.append(dict(
            id=f"f{i}", kind="factor", no=i, date=date,
            icon=f["icon"], title=f["title"], target=f["target"],
            impact=f["impact"], summary=f["summary"], text=f["text"],
        ))
    out.append(dict(
        id="f5", kind="factor", no=5, date=date,
        icon="⚖️", title="선물과 현물의 간격", target="금·은", impact="flat",
        summary=f"금 {gs:+.2f}% {_fmt_state(gs)}, 은 {ss:+.2f}% {_fmt_state(ss)}",
        text=scale_text,
    ))
    cp = result.get("checkpoint")
    if cp:
        out.append(dict(
            id="c1", kind="checkpoint", no=1, date=date,
            icon=cp["icon"], title=cp["title"], target="", impact="flat",
            summary=cp["summary"], text=cp["text"],
        ))
    # 급등락일 분석: 기존 기록은 유지하고 새로 쓴 것을 더한다
    from compute import spikes as all_spikes

    keep = {
        (r["kind"], r["date"]): r
        for r in old_rows
        if r["kind"].startswith("spike_")
    }
    texts = {(s["metal"], s["date"]): s["text"] for s in result.get("spikes", [])}
    missing = MISSING_TEXT
    for s in all_spikes(rows):
        key = (f"spike_{s['metal']}", s["date"])
        name = "금" if s["metal"] == "gold" else "은"
        kind_word = "급등" if s["pct"] > 0 else "급락"
        old_text = (keep.get(key) or {}).get("text")
        if old_text == MISSING_TEXT:
            old_text = None
        text = texts.get((s["metal"], s["date"])) or old_text or missing
        out.append(dict(
            id=f"sp_{s['metal']}_{s['date']}",
            kind=f"spike_{s['metal']}",
            no=s["no"], date=s["date"], pct=s["pct"],
            title=f"{name} {kind_word}", text=text,
        ))
    return out


def result_from_rows(old_rows: list):
    """저장된 analysis.json에서 AI가 쓴 문장만 모아 build_rows가 받는 모양으로 되돌린다.

    새로 쓰지 않는 시간대에는 문장은 그대로 두고, 수치로 만드는 줄(괴리율 등)만 다시 만든다.
    쓸 만한 이전 분석이 없으면 None을 돌려준다.
    """
    by = {r["id"]: r for r in old_rows}
    if not all(k in by for k in ("h3", "m1", "m2", "m3")):
        return None
    if by["h3"]["text"].startswith("오늘 시장분석 작성에 실패"):
        return None
    factors = []
    for i in range(1, 5):
        f = by.get(f"f{i}")
        if not f or f.get("title") == "분석 대기":
            return None
        keys = ("icon", "title", "target", "impact", "summary", "text")
        factors.append({k: f[k] for k in keys})
    cp = by.get("c1")
    checkpoint = None
    if cp:
        checkpoint = {k: cp[k] for k in ("icon", "title", "summary", "text")}
    return {
        "headline_reason": by["h3"]["text"],
        "common": by["m1"]["text"],
        "gold": by["m2"]["text"],
        "silver": by["m3"]["text"],
        "schedule": by.get("m5", {}).get("text", ""),
        "factors": factors,
        "checkpoint": checkpoint,
        "spikes": [],
    }
