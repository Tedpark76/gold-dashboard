"""금리 지표.

미국 10년물 국채 금리는 Yahoo(^TNX)에서 가져옵니다.
한국은행 기준금리는 ECOS 인증키(ECOS_API_KEY)가 있으면 ECOS에서 자동으로,
없거나 실패하면 seed/bok_rate.json에 적어 둔 값을 읽습니다.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
BOK_FILE = ROOT / "seed" / "bok_rate.json"
ECOS_URL = (
    "https://ecos.bok.or.kr/api/StatisticSearch/"
    "{key}/json/kr/1/1500/722Y001/D/{start}/{end}/0101000"
)


def read_bok(path=BOK_FILE) -> dict:
    """seed/bok_rate.json에서 한국은행 기준금리를 읽는다."""
    path = pathlib.Path(path)
    if not path.exists():
        return {}
    d = json.loads(path.read_text(encoding="utf-8"))
    return {"bok_rate": float(d["rate"]), "bok_date": str(d.get("as_of", ""))}


def parse_ecos(text: str):
    """ECOS 응답에서 (현재 기준금리, 현재 금리가 시작된 날짜)를 뽑는다."""
    data = json.loads(text)
    if "RESULT" in data:
        r = data["RESULT"]
        raise RuntimeError(f"ECOS 오류 {r.get('CODE')}: {r.get('MESSAGE')}")
    rows = data["StatisticSearch"]["row"]
    series = sorted((r["TIME"], float(r["DATA_VALUE"])) for r in rows)
    if not series:
        raise RuntimeError("ECOS 데이터가 없습니다")
    rate = series[-1][1]
    since = series[-1][0]
    for t, v in reversed(series):
        if v != rate:
            break
        since = t
    return rate, f"{since[:4]}-{since[4:6]}-{since[6:8]}"


def _http_get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def fetch_bok_ecos(key: str, today: dt.date, http_get=None):
    """ECOS에서 한국은행 기준금리(722Y001, 항목 0101000)를 가져온다."""
    http_get = http_get or _http_get
    start = (today - dt.timedelta(days=1100)).strftime("%Y%m%d")
    url = ECOS_URL.format(key=key, start=start, end=today.strftime("%Y%m%d"))
    try:
        text = http_get(url)
    except Exception as e:
        raise RuntimeError(str(e).replace(key, "***")) from None
    return parse_ecos(text)


def fetch_us10y():
    """Yahoo ^TNX에서 (현재 금리, 전일 대비 %p)를 돌려준다."""
    import yfinance as yf

    df = yf.Ticker("^TNX").history(period="10d", interval="1d")
    closes = [float(v) for v in df["Close"].dropna() if float(v) > 0]
    if len(closes) < 2:
        raise RuntimeError("^TNX 데이터가 부족합니다")
    last, prev = closes[-1], closes[-2]
    if last > 25:  # 금리가 10배로 오는 경우 보정
        last, prev = last / 10, prev / 10
    if not 0 < last < 25:
        raise RuntimeError(f"금리 값이 이상합니다: {last}")
    return round(last, 3), round(last - prev, 3)


def update(data_dir, now, fetch=None, bok_path=BOK_FILE, ecos_get=None) -> dict:
    """site/data/rates.json을 갱신한다. 실패하면 이전 값을 유지한다."""
    fetch = fetch or fetch_us10y
    path = pathlib.Path(data_dir) / "rates.json"
    old = {}
    if path.exists():
        old = json.loads(path.read_text(encoding="utf-8"))
    rates = dict(old)
    try:
        last, chg = fetch()
        rates["us10y"] = last
        rates["us10y_chg"] = chg
        rates["us10y_date"] = now.date().isoformat()
    except Exception as e:
        print("미국 10년물 금리 수집 실패:", e)
    key = (os.environ.get("ECOS_API_KEY") or "").strip()
    bok = {}
    if key:
        try:
            rate, since = fetch_bok_ecos(key, now.date(), ecos_get)
            bok = {"bok_rate": rate, "bok_date": since, "bok_source": "ECOS"}
        except Exception as e:
            print("한국은행 기준금리(ECOS) 수집 실패:", str(e).replace(key, "***"))
    if not bok:
        bok = read_bok(bok_path)
        if bok:
            bok["bok_source"] = "수동 입력"
    rates.update(bok)
    rates["updated_at"] = now.isoformat(timespec="minutes")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rates, ensure_ascii=False, indent=1), encoding="utf-8")
    return rates
