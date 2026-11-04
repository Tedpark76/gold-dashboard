"""매일 오전 9시(KST) 실행: 수집 → 계산 → 이력 저장 → 시장분석 → 갱신."""
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
import rates  # noqa: E402

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
KST = zoneinfo.ZoneInfo("Asia/Seoul")
SEED = pathlib.Path(__file__).resolve().parent.parent / "seed" / "spot_history.csv"


def load(name: str, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def save(name: str, obj) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=1)
    (DATA / name).write_text(text, encoding="utf-8")


def backfill_rows(
    histories: dict, days: int = 30, today: dt.date | None = None
) -> list:
    """5개 시세의 과거 종가를 날짜별로 합쳐 이력 행을 만든다."""
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
    """seed/spot_history.csv(과거 현물·환율·국내기준가)를 읽는다."""
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out.append({
                "date": dt.date.fromisoformat(r["date"]),
                "gold_spot": float(r["gold_spot"]),
                "gold_usdkrw": float(r["gold_usdkrw"]),
                "gold_krw_don": int(float(r["gold_krw_don"])),
                "silver_spot": float(r["silver_spot"]),
                "silver_usdkrw": float(r["silver_usdkrw"]),
                "silver_krw_don": int(float(r["silver_krw_don"])),
            })
    return sorted(out, key=lambda r: r["date"])


def lag_close(series: dict, day: dt.date):
    """day 오전 9시(KST)에 확정된 직전 미국 거래일 종가."""
    earlier = [d for d in series if d < day]
    return series[max(earlier)] if earlier else None


def backfill_from_seed(
    seed: list, histories: dict, days: int = 30, today: dt.date | None = None
) -> list:
    """엑셀(seed)의 현물·환율·국내기준가에 선물 종가를 붙여 이력을 만든다."""
    today = today or dt.datetime.now(KST).date()
    start = today - dt.timedelta(days=days)
    rows = []
    for s in seed:
        d = s["date"]
        if d.weekday() == 6 or not (start <= d <= today):
            continue
        gf = lag_close(histories["gold_fut"], d)
        sf = lag_close(histories["silver_fut"], d)
        if gf is None or sf is None:
            continue
        rows.append(compute.build_row(
            d,
            gold_fut=gf,
            gold_spot=s["gold_spot"],
            silver_fut=sf,
            silver_spot=s["silver_spot"],
            usdkrw=s["gold_usdkrw"],
            gold_krw_don=s["gold_krw_don"],
            silver_krw_don=s["silver_krw_don"],
        ))
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
    t = t.astimezone(KST)
    nine = now.replace(hour=9, minute=0, second=0, microsecond=0)
    return t >= nine and t.date() == now.date()


def pending_spikes(rows: list, old: list) -> list:
    """아직 시장분석 문장이 없는 급등락일. 실패 자리표시 문구는 없는 것으로 본다."""
    done = {
        (r["kind"], r["date"])
        for r in old
        if r["kind"].startswith("spike_")
        and r.get("text") != analyze.MISSING_TEXT
    }
    last_date = rows[-1]["date"]
    return [
        s for s in compute.spikes(rows)
        if (f"spike_{s['metal']}", s["date"]) not in done or s["date"] == last_date
    ]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true", help="과거 30일 이력을 새로 채움")
    ap.add_argument("--no-analysis", action="store_true", help="시장분석을 건너뜀")
    ap.add_argument("--force", action="store_true", help="일요일에도 실행")
    ap.add_argument(
        "--skip-if-fresh", action="store_true", help="오늘 9시 이후 갱신했다면 건너뜀"
    )
    args = ap.parse_args()

    now = dt.datetime.now(KST)
    if now.weekday() == 6 and not args.force:
        print("일요일은 휴무라 갱신하지 않습니다.")
        return 0

    print("금리 지표를 갱신합니다...")
    rates.update(DATA, now)

    fresh = already_fresh(load("meta.json", {}), now)
    if args.skip_if_fresh and not args.backfill and fresh:
        print("오늘 9시 이후 이미 갱신돼 있어 건너뜁니다.")
        return 0

    import scrape

    rows = load("history.json", [])
    meta = load("meta.json", {})
    if args.backfill or meta.get("sample", True) or not rows:
        print("과거 30일 이력을 조사합니다...")
        hist = scrape.scrape_histories()
        seed = load_seed()
        if seed:
            rows = backfill_from_seed(seed, hist, today=now.date())
        else:
            rows = backfill_rows(hist, today=now.date())

    print("현재 시세를 가져옵니다...")
    live = scrape.scrape_live()
    row = compute.build_row(now.date(), **live)
    rows = compute.trim(compute.upsert(rows, row))
    save("history.json", rows)

    old = load("analysis.json", [])
    if args.no_analysis:
        print("시장분석을 건너뜁니다.")
    else:
        new_spikes = pending_spikes(rows, old)
        try:
            result = analyze.call_model(analyze.build_prompt(rows, new_spikes))
            save("analysis.json", analyze.build_rows(rows, result, new_spikes, old))
        except Exception as e:
            print("시장분석 작성 실패:", e, file=sys.stderr)
            wait_card = {
                "icon": "ℹ️",
                "title": "분석 대기",
                "target": "금·은",
                "impact": "flat",
                "summary": "시장분석을 불러오지 못했어요",
                "text": "잠시 후 다시 갱신될 때까지 기다려 주세요.",
            }
            fallback = {
                "headline_reason": "오늘 시장분석 작성에 실패해 시세만 갱신했어요.",
                "common": "",
                "gold": "",
                "silver": "",
                "schedule": "",
                "factors": [wait_card] * 4,
            }
            save("analysis.json", analyze.build_rows(rows, fallback, [], old))
    stamp = now.isoformat(timespec="minutes")
    save("meta.json", {"sample": False, "updated_at": stamp, "date": rows[-1]["date"]})
    print("완료:", rows[-1]["date"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
