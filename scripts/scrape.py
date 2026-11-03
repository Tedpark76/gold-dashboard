"""시세 수집.

- 선물(GC=F, SI=F)과 환율(KRW=X): Yahoo Finance (yfinance)
- 현물(금 XAU/USD, 은 XAG/USD) 오늘 값: Trading Economics 표 → gold-api.com → (키가 있으면) Stooq 순서로 시도
- 현물 과거 이력: Stooq CSV (API 키 STOOQ_API_KEY가 있을 때만). 키가 없으면 이력은 실행한 날부터 하루씩 쌓인다.

투자닷컴은 GitHub 실행 서버 접속을 막아(HTTP 403) 쓰지 않습니다. 화면의 투자닷컴 링크는 참고용입니다.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import os
import re
import time
import urllib.parse
import urllib.request

YAHOO = {
    "gold_fut": "GC=F",       # 금 선물 (근월물 연속)
    "silver_fut": "SI=F",     # 은 선물
    "usdkrw": "KRW=X",        # 달러/원 환율
}
STOOQ = {
    "gold_spot": "xauusd",    # 금 현물
    "silver_spot": "xagusd",  # 은 현물
}
SYMBOLS = {**YAHOO, **STOOQ}
STOOQ_KEY_HELP = (
    "Stooq API 키가 필요합니다. https://stooq.com/q/d/?s=xauusd&get_apikey 에서 캡차를 풀고 키를 받은 뒤, "
    "GitHub 저장소 Settings → Secrets and variables → Actions에 STOOQ_API_KEY로 저장하고 "
    "daily.yml의 env에 STOOQ_API_KEY 줄을 추가하세요."
)
TE_URL = "https://tradingeconomics.com/commodities"
GOLD_API = {"gold_spot": "https://api.gold-api.com/price/XAU", "silver_spot": "https://api.gold-api.com/price/XAG"}
TE_PATH = {"gold_spot": "/commodity/gold", "silver_spot": "/commodity/silver"}
SANE = {"gold_spot": (500, 20000), "silver_spot": (5, 500)}   # 이상한 값 걸러내기 (USD/온스)
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
# 예전 투자닷컴 파서 (테스트와 호환을 위해 남겨 둠)
META_RE = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:로|으로)\s*거래를")
DATE_RE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")


class ScrapeError(RuntimeError):
    pass


def parse_number(text: str) -> float:
    return float(re.sub(r"[^\d.\-]", "", text))


def parse_history_rows(rows: list) -> dict:
    out = {}
    for cells in rows:
        if len(cells) < 2:
            continue
        m = DATE_RE.search(cells[0])
        if not m:
            continue
        out[dt.date(int(m[1]), int(m[2]), int(m[3]))] = parse_number(cells[1])
    return out


def _yahoo_closes(key: str, period: str, tries: int = 3) -> dict:
    import yfinance as yf

    sym = YAHOO[key]
    last_err = None
    for i in range(tries):
        try:
            df = yf.Ticker(sym).history(period=period, interval="1d", auto_adjust=False)
            if df is not None and len(df) and "Close" in df:
                out = {}
                for idx, v in df["Close"].items():
                    if v == v and float(v) > 0:        # NaN·0 제외
                        out[idx.date()] = float(v)
                if out:
                    return out
            last_err = "빈 데이터가 돌아왔습니다"
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(3 * (i + 1))
    raise ScrapeError(f"{key} ({sym}): 시세를 가져오지 못했습니다. {last_err}")


def parse_stooq_csv(text: str) -> dict:
    """Stooq CSV(Date,Open,High,Low,Close,Volume) → {날짜: 종가}."""
    out = {}
    for row in csv.DictReader(io.StringIO(text.strip())):
        try:
            out[dt.date.fromisoformat(row["Date"])] = float(row["Close"])
        except (KeyError, ValueError, TypeError):
            continue
    return out


def _stooq_closes(key: str, days: int = 75, tries: int = 3) -> dict:
    apikey = os.environ.get("STOOQ_API_KEY", "").strip()
    if not apikey:
        raise ScrapeError(f"{key}: " + STOOQ_KEY_HELP)
    sym = STOOQ[key]
    today = dt.date.today()
    q = urllib.parse.urlencode({
        "s": sym, "i": "d", "apikey": apikey,
        "d1": (today - dt.timedelta(days=days)).strftime("%Y%m%d"), "d2": today.strftime("%Y%m%d"),
    })
    url = "https://stooq.com/q/d/l/?" + q
    last_err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
            if "Exceeded the daily hits limit" in text:
                raise ScrapeError(f"{key} ({sym}): Stooq 하루 요청 한도를 넘었습니다. 내일 다시 시도하세요.")
            data = parse_stooq_csv(text)
            if data:
                return data
            last_err = "CSV가 아닌 응답이 돌아왔습니다 (API 키가 틀렸거나 만료됐을 수 있습니다): " + text[:120].replace("\n", " ")
        except ScrapeError:
            raise
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(3 * (i + 1))
    raise ScrapeError(f"{key} ({sym}): 시세를 가져오지 못했습니다. {last_err}")


def parse_te_price(html: str, key: str) -> float:
    """Trading Economics 원자재 표에서 금/은 가격(USD/t.oz)을 읽는다."""
    marker = TE_PATH[key] + '"'
    i = html.find(marker)
    if i < 0:
        raise ValueError("표에서 해당 원자재 줄을 찾지 못했습니다")
    seg = re.sub(r"<[^>]+>", " ", html[i:i + 2500])
    m = re.search(r"t\.?\s*oz\.?\s*([\d,]+\.\d+)", seg, re.I) or re.search(r"([\d,]{3,}\.\d+)", seg)
    if not m:
        raise ValueError("가격 숫자를 찾지 못했습니다")
    return parse_number(m[1])


def _http_get(url: str, headers: dict | None = None) -> str:
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")


def _check(key: str, v: float) -> float:
    lo, hi = SANE[key]
    if not lo <= v <= hi:
        raise ValueError(f"값이 이상합니다 ({v})")
    return v


def _spot_live(key: str) -> float:
    """현물 오늘 값: 여러 출처를 차례로 시도하고, 모두 실패하면 이유를 모아 알려준다."""
    errors = []
    try:
        return _check(key, parse_te_price(_http_get(TE_URL), key))
    except Exception as e:  # noqa: BLE001
        errors.append(f"TradingEconomics: {type(e).__name__}: {e}")
    try:
        data = json.loads(_http_get(GOLD_API[key]))
        return _check(key, float(data["price"]))
    except Exception as e:  # noqa: BLE001
        errors.append(f"gold-api.com: {type(e).__name__}: {e}")
    if os.environ.get("STOOQ_API_KEY", "").strip():
        try:
            data = _stooq_closes(key)
            return _check(key, data[max(data)])
        except Exception as e:  # noqa: BLE001
            errors.append(f"Stooq: {type(e).__name__}: {e}")
    raise ScrapeError(f"{key}: 현물 시세를 가져오지 못했습니다. " + " | ".join(errors))


def _closes(key: str, period: str) -> dict:
    return _stooq_closes(key) if key in STOOQ else _yahoo_closes(key, period)


def scrape_live() -> dict:
    """가장 최근 값(오늘 진행 중인 값 포함)."""
    out = {}
    for key in SYMBOLS:
        if key in STOOQ:
            out[key] = _spot_live(key)
        else:
            data = _yahoo_closes(key, "7d")
            out[key] = data[max(data)]
    return out


def scrape_histories() -> dict:
    """최근 약 2개월의 일별 종가. 현물은 Stooq 키가 있을 때만 가져오고, 없으면 빈 이력을 돌려준다."""
    out = {}
    have_key = bool(os.environ.get("STOOQ_API_KEY", "").strip())
    for key in SYMBOLS:
        if key in STOOQ and not have_key:
            out[key] = {}
        else:
            out[key] = _closes(key, "2mo")
    return out
