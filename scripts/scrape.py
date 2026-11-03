"""investing.com 시세 스크래핑 (Playwright).

주의: 사이트 구조가 바뀌거나 자동 접속을 막으면 실패할 수 있습니다.
실패하면 ScrapeError와 함께 diagnostics/ 폴더에 페이지 HTML을 남기므로, 그 파일을 보고 SELECTORS를 고치세요.
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re

BASE = "https://kr.investing.com"
PAGES = {
    "gold_fut": f"{BASE}/commodities/gold",
    "gold_spot": f"{BASE}/currencies/xau-usd",
    "silver_fut": f"{BASE}/commodities/silver",
    "silver_spot": f"{BASE}/currencies/xag-usd",
    "usdkrw": f"{BASE}/currencies/usd-krw",
}
HIST_PAGES = {k: v + "-historical-data" for k, v in PAGES.items()}

# 현재가를 찾는 후보 선택자(위에서부터 시도). 첫 실행 때 diagnostics HTML로 확인해 고정하세요.
SELECTORS = [
    '[data-test="instrument-price-last"]',
    '[data-test="instrument-header-price"]',
]
META_RE = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:로|으로)\s*거래를")   # 예: "4,180.87로 거래를 마감한 ..."
DATE_RE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")
DIAG = pathlib.Path("diagnostics")


class ScrapeError(RuntimeError):
    pass


def parse_number(text: str) -> float:
    return float(re.sub(r"[^\d.\-]", "", text))


def parse_history_rows(rows: list) -> dict:
    """표 행(셀 문자열 목록)에서 {날짜: 종가}를 뽑는다. 날짜 셀은 '2026년 09월 18일' 형식, 두 번째 셀이 종가."""
    out = {}
    for cells in rows:
        if len(cells) < 2:
            continue
        m = DATE_RE.search(cells[0])
        if not m:
            continue
        d = dt.date(int(m[1]), int(m[2]), int(m[3]))
        out[d] = parse_number(cells[1])
    return out


def _save_diag(page, key: str) -> None:
    DIAG.mkdir(exist_ok=True)
    (DIAG / f"{key}.html").write_text(page.content(), encoding="utf-8")


def fetch_last(page, key: str) -> float:
    page.goto(PAGES[key], wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(2500)
    for sel in SELECTORS:
        el = page.query_selector(sel)
        if el:
            try:
                return parse_number(el.inner_text())
            except ValueError:
                pass
    meta = page.get_attribute('meta[name="description"]', "content") or ""
    m = META_RE.search(meta)
    if m:
        return parse_number(m[1])
    _save_diag(page, key)
    raise ScrapeError(f"{key}: 현재가를 찾지 못했습니다 (diagnostics/{key}.html 확인)")


def fetch_history(page, key: str) -> dict:
    page.goto(HIST_PAGES[key], wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(2500)
    rows = page.eval_on_selector_all(
        "table tr",
        "trs => trs.map(tr => Array.from(tr.querySelectorAll('th,td')).map(c => c.innerText.trim()))",
    )
    data = parse_history_rows(rows)
    if not data:
        _save_diag(page, key + "_history")
        raise ScrapeError(f"{key}: 과거 데이터 표를 찾지 못했습니다 (diagnostics/{key}_history.html 확인)")
    return data


def launch():
    from playwright.sync_api import sync_playwright

    pw = sync_playwright().start()
    browser = pw.chromium.launch()
    ctx = browser.new_context(
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    )
    return pw, browser, ctx.new_page()


def scrape_live() -> dict:
    pw, browser, page = launch()
    try:
        return {k: fetch_last(page, k) for k in PAGES}
    finally:
        browser.close()
        pw.stop()


def scrape_histories() -> dict:
    pw, browser, page = launch()
    try:
        return {k: fetch_history(page, k) for k in PAGES}
    finally:
        browser.close()
        pw.stop()
