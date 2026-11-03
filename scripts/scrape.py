"""investing.com 시세 스크래핑 (Playwright).

실패하면 ScrapeError 메시지에 접속 상태가 같이 찍히고, diagnostics/ 폴더에 HTML과 스크린샷이 남습니다.
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

SELECTORS = [
    '[data-test="instrument-price-last"]',
    '[data-test="instrument-header-price"]',
]
META_RE = re.compile(r"([\d,]+(?:\.\d+)?)\s*(?:로|으로)\s*거래를")
DATE_RE = re.compile(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")
DIAG = pathlib.Path("diagnostics")
BLOCK_HINTS = ("just a moment", "attention required", "access denied", "잠시만", "로봇", "captcha")


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


def _dismiss_popups(page) -> None:
    for sel in ('#onetrust-accept-btn-handler', 'button:has-text("동의")', 'button:has-text("수락")', 'button:has-text("Accept")'):
        try:
            el = page.query_selector(sel)
            if el:
                el.click(timeout=2000)
                break
        except Exception:
            pass


def _diagnose(page, key: str, status) -> str:
    """진단 파일을 저장하고, 로그에 바로 보일 한 줄 설명을 돌려준다."""
    DIAG.mkdir(exist_ok=True)
    try:
        (DIAG / f"{key}.html").write_text(page.content(), encoding="utf-8")
        page.screenshot(path=str(DIAG / f"{key}.png"))
    except Exception:
        pass
    try:
        title = page.title()
    except Exception:
        title = ""
    try:
        body = page.inner_text("body")[:300].replace("\n", " ")
    except Exception:
        body = ""
    blocked = status in (403, 429) or any(h in (title + " " + body).lower() for h in BLOCK_HINTS)
    hint = " → 투자닷컴이 자동 접속을 막은 것으로 보입니다." if blocked else ""
    return f"[HTTP {status}] 제목={title!r} 주소={page.url} 본문 앞부분={body!r}{hint}"


def _open(page, url: str):
    resp = page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(2500)
    _dismiss_popups(page)
    return resp.status if resp else None


def fetch_last(page, key: str) -> float:
    status = _open(page, PAGES[key])
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
    raise ScrapeError(f"{key}: 현재가를 찾지 못했습니다. " + _diagnose(page, key, status))


def fetch_history(page, key: str) -> dict:
    status = _open(page, HIST_PAGES[key])
    try:
        page.wait_for_selector("table tr td", timeout=20_000)
    except Exception:
        pass
    rows = page.eval_on_selector_all(
        "table tr",
        "trs => trs.map(tr => Array.from(tr.querySelectorAll('th,td')).map(c => c.innerText.trim()))",
    )
    data = parse_history_rows(rows)
    if not data:
        raise ScrapeError(f"{key}: 과거 데이터 표를 찾지 못했습니다. " + _diagnose(page, key + "_history", status))
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
