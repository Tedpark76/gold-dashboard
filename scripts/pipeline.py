"""매일 오전 9시(KST) 실행: 스크래핑 → 계산 → 이력 저장 → 시장분석 → site/data 갱신."""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import pathlib
import sys
import zoneinfo

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import analyze  # noqa: E402
import compute  # noqa: E402

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
KST = zoneinfo.ZoneInfo("Asia/Seoul")
SEED = pathlib.Path(__file__).resolve().parent.parent / "seed" / "spot_history.csv"


def load(name: str, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def save(name: str, obj) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def backfill_rows(histories: dict, days: int = 30, today: dt.date | None = None) -> list:
    """5개 시세의 과거 종가를 날짜별로 합쳐 이력 행을 만든다 (오늘 기준 과거 days일)."""
    today = today or dt.datetime.now(KST).date()
    start = today - dt.timedelta(days=days)
    common = None
    for series in histories.values():
        ds = {d for d in series if start <= d <= today}
        common = ds if common is None else common & ds
    closes = {
        d: dict(gold_fut=histories["gold_fut"][d], gold_spot=histories["gold_spot"][d],
                silver_fut=histories["silver_fut"][d], silver_spot=histories["silver_spot"][d],
                usdkrw=histories["usdkrw"][d], note="")
        for d in sorted(common or [])
    }
    closes = compute.fill_weekends(closes)
    rows = [compute.build_row(d, **v) for d, v in sorted(closes.items())]
    return compute.apply_dod(rows)


def load_seed(path: pathlib.Path = SEED) -> list:
    """seed/spot_history.csv(과거 현물 시세·환율·국내기준가)를 읽는다. 파일이 없으면 빈 목록."""
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out.append({
                "date": dt.date.fromisoformat(r["date"]),
                "gold_spot": float(r["gold_spot"]), "gold_usdkrw": float(r["gold_usdkrw"]), "gold_krw_don": int(float(r["gold_krw_don"])),
                "silver_spot": float(r["silver_spot"]), "silver_usdkrw": float(r["silver_usdkrw"]), "silver_krw_don": int(float(r["silver_krw_don"])),
            })
    return sorted(out, key=lambda r: r["date"])


def lag_close(series: dict, day: dt.date):
    """day 오전 9시(KST) 시점에 확정돼 있는 직전 미국 거래일 종가 (day보다 앞선 가장 최근 날짜의 값)."""
    earlier = [d for d in series if d < day]
    return series[max(earlier)] if earlier else None


def backfill_from_seed(seed: list, histories: dict, days: int = 30, today: dt.date | None = None) -> list:
    """엑셀(seed)의 현물·환율·국내기준가에 Yahoo 선물 종가를 붙여 이력 행을 만든다. 일요일은 제외."""
    today = today or dt.datetime.now(KST).date()
    start = today - dt.timedelta(days=days)
    rows = []
    for s in seed:
        d = s["date"]
        if d.weekday() == 6 or not (start <= d <= today):
            continue
        gf, sf = lag_close(histories["gold_fut"], d), lag_close(histories["silver_fut"], d)
        if gf is None or sf is None:
            continue
        rows.append(compute.build_row(
            d, gold_fut=gf, gold_spot=s["gold_spot"], silver_fut=sf, silver_spot=s["silver_spot"],
            usdkrw=s["gold_usdkrw"], gold_krw_don=s["gold_krw_don"], silver_krw_don=s["silver_krw_don"]))
    return compute.apply_dod(rows)


def already_fresh(meta: dict, now: dt.datetime) -> bool:
    """meta.json의 갱신 시각이 오늘 오전 9시(KST) 이후면 True."""
    if meta.get("sample", True) or not meta.get("updated_at"):
        return False
    try:
        t = dt.datetime.fromisoformat(meta["updated_at"])
    except ValueError:
        return False
    if t.tzinfo is None:
        t = t.replace(tzinfo=KST)
    return t.astimezone(KST) >= now.replace(hour=9, minute=0, second=0, microsecond=0) and t.astimezone(KST).date() == now.date()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true", help="과거 30일 이력을 새로 채운다 (처음 한 번)")
    ap.add_argument("--no-analysis", action="store_true", help="시장분석 작성을 건너뛴다")
    ap.add_argument("--force", action="store_true", help="일요일에도 실행한다")
    ap.add_argument("--skip-if-fresh", action="store_true",
                    help="오늘 오전 9시 이후 이미 갱신했다면 건너뛴다 (예비 예약 실행용)")
    args = ap.parse_args()

    now = dt.datetime.now(KST)
    if now.weekday() == 6 and not args.force:
        print("일요일은 휴무라 갱신하지 않습니다.")
        return 0

    if args.skip_if_fresh and not args.backfill and already_fresh(load("meta.json", {}), now):
        print("오늘 오전 9시 이후 이미 갱신돼 있어 건너뜁니다.")
        return 0

    import scrape  # Playwright는 실제 실행할 때만 불러온다

    rows = load("history.json", [])
    meta = load("meta.json", {})
    if args.backfill or meta.get("sample", True) or not rows:
        print("과거 30일 이력을 조사합니다...")
        hist = scrape.scrape_histories()
        seed = load_seed()
        rows = backfill_from_seed(seed, hist, today=now.date()) if seed else
