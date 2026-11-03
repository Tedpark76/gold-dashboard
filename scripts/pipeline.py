"""매일 오전 9시(KST) 실행: 스크래핑 → 계산 → 이력 저장 → 시장분석 → site/data 갱신."""
from __future__ import annotations

import argparse
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill", action="store_true", help="과거 30일 이력을 새로 채운다 (처음 한 번)")
    ap.add_argument("--no-analysis", action="store_true", help="시장분석 작성을 건너뛴다")
    ap.add_argument("--force", action="store_true", help="일요일에도 실행한다")
    args = ap.parse_args()

    now = dt.datetime.now(KST)
    if now.weekday() == 6 and not args.force:
        print("일요일은 휴무라 갱신하지 않습니다.")
        return 0

    import scrape  # Playwright는 실제 실행할 때만 불러온다

    rows = load("history.json", [])
    meta = load("meta.json", {})
    if args.backfill or meta.get("sample", True) or not rows:
        print("과거 30일 이력을 조사합니다...")
        rows = backfill_rows(scrape.scrape_histories(), today=now.date())

    print("현재 시세를 가져옵니다...")
    live = scrape.scrape_live()
    row = compute.build_row(now.date(), **live)
    rows = compute.trim(compute.upsert(rows, row))
    save("history.json", rows)

    old = load("analysis.json", [])
    if args.no_analysis:
        print("시장분석을 건너뜁니다.")
    else:
        prev_dates = {r["date"] for r in old if r["kind"].startswith("spike_")}
        new_spikes = [s for s in compute.spikes(rows) if s["date"] not in prev_dates or s["date"] == rows[-1]["date"]]
        try:
            result = analyze.call_model(analyze.build_prompt(rows, new_spikes))
            save("analysis.json", analyze.build_rows(rows, result, new_spikes, old))
        except Exception as e:  # 분석이 실패해도 시세는 갱신한다
            print("시장분석 작성 실패:", e, file=sys.stderr)
            fallback = {
                "headline_reason": "오늘 시장분석 작성에 실패해 시세만 갱신했어요.",
                "common": "", "gold": "", "silver": "", "schedule": "",
                "factors": [{"icon": "ℹ️", "title": "분석 대기", "target": "금·은", "impact": "flat",
                             "summary": "시장분석을 불러오지 못했어요", "text": "잠시 후 다시 갱신될 때까지 기다려 주세요."}] * 4,
            }
            save("analysis.json", analyze.build_rows(rows, fallback, [], old))
    save("meta.json", {"sample": False, "updated_at": now.isoformat(timespec="minutes"), "date": rows[-1]["date"]})
    print("완료:", rows[-1]["date"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
