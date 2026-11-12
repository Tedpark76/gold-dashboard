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
  "indicators": [
    {
      "name": "지표 이름 (예: 미국 소비자물가지수 CPI)",
      "period": "대상 기간 (예: 10월)",
      "value": "발표 값 (예: 전년 대비 +3.0%)",
      "change": "직전 대비 변화 (예: 전월 +2.9%에서 +0.1%p 상승)",
      "forecast": "시장 예상치 (없으면 빈 문자열)",
      "release": "발표일 YYYY-MM-DD"
    }
  ],
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
        "달러·금리 이야기는 3, 4번에 반복하지 마세요. "
        "소비자물가(CPI), 생산자물가(PPI), 고용지표, PCE, GDP, ISM·PMI, 소매판매 같은 "
        "경제지표를 요인으로 언급하려면 반드시 웹 검색으로 최신 공식 발표 수치를 확인해서 "
        "indicators에 발표 값, 직전 대비 변화, 시장 예상치(있으면), 발표일을 쓰고, "
        "글(common, factors, checkpoint)에도 핵심 수치를 함께 쓰세요. "
        "수치를 확인하지 못한 지표는 글에 쓰지 마세요.\n"
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


INDICATORS = [
    ("소비자물가", r"소비자\s?물가|CPI"),
    ("생산자물가", r"생산자\s?물가|PPI"),
    ("PCE 물가", r"PCE"),
    ("고용지표", r"고용\s?지표|고용\s?보고서|비농업|실업률|신규\s?고용|ADP"),
    ("GDP", r"GDP|국내총생산"),
    ("ISM·PMI", r"ISM|PMI"),
    ("소매판매", r"소매\s?판매"),
]


def result_text(result: dict) -> str:
    """분석 글 전체를 한 덩어리로 (어떤 지표를 언급했는지 찾는 용도)."""
    parts = [result.get("headline_reason", ""), result.get("common", ""),
             result.get("gold", ""), result.get("silver", "")]
    for f in result.get("factors", []):
        parts += [f.get("title", ""), f.get("summary", ""), f.get("text", "")]
    cp = result.get("checkpoint") or {}
    parts += [cp.get("summary", ""), cp.get("text", "")]
    return " ".join(str(x) for x in parts)


def has_figures(ind: dict) -> bool:
    return bool(re.search(r"\d", str(ind.get("value", "")) + str(ind.get("change", ""))))


def missing_indicators(result: dict) -> list:
    """글에서 언급했는데 indicators에 수치가 없는 지표 [(이름, 패턴)]."""
    text = result_text(result)
    have = result.get("indicators") or []
    out = []
    for name, pat in INDICATORS:
        if not re.search(pat, text):
            continue
        if not any(re.search(pat, str(i.get("name", ""))) and has_figures(i) for i in have):
            out.append((name, pat))
    return out


def repair_prompt(result: dict, names: list) -> str:
    return (
        "아래는 오늘 쓴 금·은 시장분석 글입니다. 이 글에서 언급한 경제지표 ("
        + ", ".join(names)
        + ")의 가장 최근 공식 발표 수치를 웹 검색으로 확인하세요. "
        "지표마다 발표 값, 직전 대비 변화, 시장 예상치(있으면), 발표일을 찾아 JSON만 출력하세요: "
        '{"indicators": [{"name": "...", "period": "...", "value": "...", '
        '"change": "...", "forecast": "...", "release": "YYYY-MM-DD"}]} '
        "수치를 확인하지 못한 지표는 목록에서 빼세요.\n\n" + result_text(result)[:1500]
    )


def call_repair(result: dict, names: list) -> list:
    import anthropic

    client = anthropic.Anthropic(timeout=150.0, max_retries=0)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
        messages=[{"role": "user", "content": repair_prompt(result, names)}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    text = re.sub(r"</?cite[^>]*>", "", text)
    return strip_tags(extract_json(text)).get("indicators", [])


def ensure_indicators(result: dict, repair=None) -> dict:
    """글에서 언급한 경제지표에 수치가 빠졌으면 한 번 더 확인해 채운다.

    끝내 못 찾으면 수치를 지어내지 않고 '수치 확인 필요'로 표시해 누락이 눈에 띄게 한다.
    """
    repair = repair or call_repair
    result.setdefault("indicators", [])
    missing = missing_indicators(result)
    if missing:
        try:
            extra = repair(result, [n for n, _ in missing])
        except Exception as e:
            print("경제지표 수치 보완 실패:", e)
            extra = []
        for it in extra or []:
            if isinstance(it, dict) and has_figures(it):
                result["indicators"].append(it)
        for name, _pat in missing_indicators(result):
            result["indicators"].append(
                {"name": name, "period": "", "value": "수치 확인 필요",
                 "change": "", "forecast": "", "release": ""}
            )
    return result


def indicator_line(ind: dict) -> str:
    """경제지표 한 줄: 이름(기간): 값, 직전 대비, 예상 · 발표일"""
    name = str(ind.get("name", "")).strip()
    period = str(ind.get("period", "")).strip()
    head = f"{name}({period})" if period else name
    bits = [str(ind.get("value", "")).strip()]
    if str(ind.get("change", "")).strip():
        bits.append(str(ind["change"]).strip())
    if str(ind.get("forecast", "")).strip():
        bits.append("예상 " + str(ind["forecast"]).strip())
    line = head + ": " + ", ".join(b for b in bits if b)
    rel = str(ind.get("release", "")).strip()
    if len(rel) >= 10:
        line += " · " + rel[5:10].replace("-", "/") + " 발표"
    return line


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
    return ensure_indicators(strip_tags(extract_json(text)))


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
        dict(id="n1", kind="notice", no=6, date=date, title="안내", text=NOTICE),
    ]
    for i, ind in enumerate(result.get("indicators") or [], start=1):
        out.append(dict(
            id=f"i{i}", kind="indicator", no=i, date=date,
            title=str(ind.get("name", "")), period=str(ind.get("period", "")),
            value=str(ind.get("value", "")), change=str(ind.get("change", "")),
            forecast=str(ind.get("forecast", "")), release=str(ind.get("release", "")),
            text=indicator_line(ind),
        ))
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
    indicators = [
        {k: r.get(k, "") for k in ("name", "period", "value", "change", "forecast", "release")}
        | {"name": r.get("title", "")}
        for r in old_rows if r.get("kind") == "indicator"
    ]
    return {
        "headline_reason": by["h3"]["text"],
        "common": by["m1"]["text"],
        "gold": by["m2"]["text"],
        "silver": by["m3"]["text"],
        "indicators": indicators,
        "factors": factors,
        "checkpoint": checkpoint,
        "spikes": [],
    }
