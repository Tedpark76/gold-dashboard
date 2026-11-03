"""시세 계산 공식과 이력 관리 (네트워크 없이 테스트 가능한 순수 함수)."""
from __future__ import annotations

import datetime as dt

OZ_G = 31.1035        # 1 트로이온스(g)
DON_G = 3.75          # 1돈(g)
SPIKE_PCT = 3.0       # 급등락 기준(%)
KEEP_DAYS = 31        # 이력 보관 일수
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def krw_per_don(usd_per_oz: float, usdkrw: float) -> int:
    """국제 현물가(USD/온스)와 환율로 원화 1돈(3.75g) 가격을 계산한다."""
    return round(usd_per_oz / OZ_G * DON_G * usdkrw)


def spread_pct(fut: float, spot: float) -> float:
    """선물·현물 괴리율(%). 양수=콘탱고, 음수=백워데이션."""
    return round((fut - spot) / spot * 100, 2)


def build_row(date: dt.date, *, gold_fut, gold_spot, silver_fut, silver_spot, usdkrw, note: str = "") -> dict:
    return {
        "date": date.isoformat(),
        "weekday": WEEKDAYS[date.weekday()],
        "note": note,
        "gold_spot": round(gold_spot, 2),
        "gold_fut": round(gold_fut, 2),
        "silver_spot": round(silver_spot, 2),
        "silver_fut": round(silver_fut, 2),
        "usdkrw": round(usdkrw, 2),
        "gold_spread_pct": spread_pct(gold_fut, gold_spot),
        "silver_spread_pct": spread_pct(silver_fut, silver_spot),
        "gold_krw_don": krw_per_don(gold_spot, usdkrw),
        "silver_krw_don": krw_per_don(silver_spot, usdkrw),
        "gold_krw_dod_pct": 0.0,
        "silver_krw_dod_pct": 0.0,
    }


def apply_dod(rows: list[dict]) -> list[dict]:
    """직전 기록일 대비 원화 시세 변동률을 채운다 (일요일은 기록이 없으므로 월요일은 토요일과 비교)."""
    rows.sort(key=lambda r: r["date"])
    for i, r in enumerate(rows):
        if i == 0:
            r["gold_krw_dod_pct"] = r["silver_krw_dod_pct"] = 0.0
            continue
        p = rows[i - 1]
        r["gold_krw_dod_pct"] = round((r["gold_krw_don"] / p["gold_krw_don"] - 1) * 100, 2)
        r["silver_krw_dod_pct"] = round((r["silver_krw_don"] / p["silver_krw_don"] - 1) * 100, 2)
    return rows


def upsert(rows: list[dict], row: dict) -> list[dict]:
    rows = [r for r in rows if r["date"] != row["date"]] + [row]
    return apply_dod(rows)


def trim(rows: list[dict], keep: int = KEEP_DAYS) -> list[dict]:
    rows = sorted(rows, key=lambda r: r["date"])
    return rows[-keep:] if len(rows) > keep else rows


def spikes(rows: list[dict], threshold: float = SPIKE_PCT) -> list[dict]:
    """원화 국내시세 전일 대비 ±threshold% 이상인 날 (금·은 따로)."""
    out = []
    for metal in ("gold", "silver"):
        n = 0
        for r in rows:
            v = r[f"{metal}_krw_dod_pct"]
            if abs(v) >= threshold:
                n += 1
                out.append({"metal": metal, "date": r["date"], "pct": v, "no": n})
    return out


def fill_weekends(closes: dict) -> dict:
    """평일 종가만 있는 이력에 토요일(금요일 마감 값 유지)을 채우고 일요일은 제외한다."""
    out = dict(closes)
    for d, v in list(closes.items()):
        if d.weekday() == 4:  # 금요일
            sat = d + dt.timedelta(days=1)
            if sat not in out:
                out[sat] = {**v, "note": "금요일 국제시장 마감 값"}
    return {d: v for d, v in out.items() if d.weekday() != 6}
