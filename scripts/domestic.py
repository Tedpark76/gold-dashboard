"""한국금시장거래소(koreagold.kr) 순금·은 시세 수집 (살 때, 팔 때).

메인 페이지의 '오늘의 시세' 영역에서 순금과 은의 살 때(VAT 포함)·팔 때 가격과
변동 금액을 읽어 site/data/domestic.json에 저장합니다.
"""
from __future__ import annotations

import datetime as dt
import html as htmlmod
import json
import pathlib
import re
import urllib.request

URL = "https://koreagold.kr/"
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
PRICE_FIELDS = ("gold_buy", "gold_sell", "silver_buy", "silver_sell")
# 가격 범위 점검 (원/돈). 벗어나면 잘못 읽은 것으로 보고 버린다.
SANE = {"gold": (100_000, 5_000_000), "silver": (1_000, 200_000)}

ROW = r"{label}[^0-9]*?([\d,]+)\s*원\s*([\d,]+)\s*([\d,]+)\s*원\s*([\d,]+)"
UP = re.compile(r"(?<![a-z])(?:up|plus|rise|increase)(?![a-z])|▲|상승", re.I)
DOWN = re.compile(r"(?<![a-z])(?:down|minus|fall|decrease)(?![a-z])|▼|하락", re.I)


def _text(raw: str) -> str:
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = htmlmod.unescape(s)
    return re.sub(r"\s+", " ", s)


def _num(s: str) -> int:
    return int(s.replace(",", ""))


def _hint(window: str) -> int:
    """변동 숫자 앞쪽 HTML(클래스 이름, 화살표)에서 방향을 추정한다. +1, -1, 0(모름)."""
    up, down = bool(UP.search(window)), bool(DOWN.search(window))
    if up and not down:
        return 1
    if down and not up:
        return -1
    return 0


def _hints(raw: str, label: str, tokens: list) -> list:
    """[살 때, 살 때 변동, 팔 때, 팔 때 변동] 순서의 방향 추정값 두 개를 돌려준다."""
    base = raw.find("오늘의 시세")
    start = raw.find(label, max(base, 0))
    pos = start if start >= 0 else 0
    out = []
    for i, tok in enumerate(tokens):
        j = raw.find(tok, pos)
        if j < 0:
            if i % 2 == 1:
                out.append(0)
            continue
        if i % 2 == 1:
            out.append(_hint(raw[pos:j]))
        pos = j + len(tok)
    while len(out) < 2:
        out.append(0)
    return out


def parse(raw: str) -> dict:
    """페이지 HTML에서 순금·은 가격과 변동을 읽는다."""
    text = _text(raw)
    start = text.find("오늘의 시세")
    seg = text[start:start + 2500] if start >= 0 else text
    gm = re.search(ROW.format(label=r"순금\s*시세"), seg)
    cut = seg.find("백금")
    sm = re.search(ROW.format(label=r"은\s*시세"), seg[cut:] if cut >= 0 else seg)
    if not gm or not sm:
        raise ValueError("오늘의 시세 영역에서 순금·은 가격을 찾지 못했습니다")
    out = {}
    for metal, m, label in (("gold", gm, "순금"), ("silver", sm, "은")):
        buy, buy_c, sell, sell_c = m.groups()
        lo, hi = SANE[metal]
        if not (lo <= _num(buy) <= hi and lo <= _num(sell) <= hi):
            raise ValueError(f"{metal} 가격 범위가 이상합니다: {buy}, {sell}")
        h_buy, h_sell = _hints(raw, label, [buy, buy_c, sell, sell_c])
        out[f"{metal}_buy"] = _num(buy)
        out[f"{metal}_sell"] = _num(sell)
        out[f"{metal}_buy_abs"] = _num(buy_c)
        out[f"{metal}_sell_abs"] = _num(sell_c)
        out[f"{metal}_buy_hint"] = h_buy
        out[f"{metal}_sell_hint"] = h_sell
    return out


def signed_change(price: int, prev_price, mag: int, hint: int):
    """전일 대비 변동 금액(부호 포함). 방향을 알 수 없으면 None."""
    delta = None if prev_price is None else price - prev_price
    if delta not in (None, 0):
        return delta                       # 직전 기록과 비교한 값이 가장 확실하다
    if hint:
        return hint * mag
    return 0 if delta == 0 and mag == 0 else (None if mag else 0)


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def update(data_dir, now: dt.datetime, get=None) -> dict:
    """site/data/domestic.json을 갱신한다. 실패하면 이전 값을 그대로 둔다."""
    path = pathlib.Path(data_dir) / "domestic.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    try:
        cur = parse((get or _get)(URL))
    except Exception as e:
        print("국내 시세(koreagold.kr) 수집 실패:", e)
        return old
    today = now.date().isoformat()
    if old.get("date") == today:
        prev = old.get("prev") or {}
    elif all(f in old for f in PRICE_FIELDS):
        prev = {f: old[f] for f in PRICE_FIELDS}
        prev["date"] = old.get("date")
    else:
        prev = {}
    out = {f: cur[f] for f in PRICE_FIELDS}
    for f in PRICE_FIELDS:
        mag, hint = cur[f + "_abs"], cur[f + "_hint"]
        out[f + "_chg"] = signed_change(cur[f], prev.get(f), mag, hint)
        out[f + "_abs"] = cur[f + "_abs"]
    out.update({
        "date": today,
        "updated_at": now.isoformat(timespec="minutes"),
        "source": "koreagold.kr",
        "prev": prev,
    })
    unknown = [f for f in PRICE_FIELDS if out[f + "_chg"] is None]
    if unknown:
        print("국내 시세 변동 방향을 알 수 없어 금액만 표시합니다:", ", ".join(unknown))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out
