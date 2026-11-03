"""시세 수집 (Yahoo Finance, yfinance 라이브러리).

투자닷컴이 GitHub 실행 서버 접속을 막아(HTTP 403) 출처를 바꿨습니다.
대시보드 화면의 투자닷컴 링크는 참고용으로 그대로 두고, 값은 아래 심볼에서 가져옵니다.
"""
from __future__ import annotations

import datetime as dt
import re
import time

SYMBOLS = {
    "gold_fut": "GC=F",        # 금 선물 (근월물 연속)
    "gold_spot": "XAUUSD=X",   # 금 현물 (XAU/USD)
    "silver_fut": "SI=F",      # 은 선물
    "silver_spot": "XAGUSD=X", # 은 현물 (XAG/USD)
    "usdkrw": "KRW=X",         # 달러/원 환율
}
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


def _closes(key: str, period: str, tries: int = 3) -> dict:
    """한 심볼의 일별 종가 {날짜: 종가}. 실패하면 몇 번 다시 시도한다."""
    import yfinance as yf

    sym = SYMBOLS[key]
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


def scrape_live() -> dict:
    """가장 최근 값(오늘 진행 중인 값 포함)."""
    out = {}
    for key in SYMBOLS:
        data = _closes(key, "7d")
        out[key] = data[max(data)]
    return out


def scrape_histories() -> dict:
    """최근 약 2개월의 일별 종가."""
    return {key: _closes(key, "2mo") for key in SYMBOLS}
