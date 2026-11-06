"""한국시간 기준 갱신 (월~토).

- 시세: 10:10, 12:10, 14:10, 16:10, 18:10
- 시장분석: 10:10, 13:10
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import pathlib
import sys
import zoneinfo

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import analyze  # noqa: E402
import compute  # noqa: E402
import domestic  # noqa: E402
import rates  # noqa: E402
import spike_notes  # noqa: E402

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
KST = zoneinfo.ZoneInfo("Asia/Seoul")
SEED = pathlib.Path(__file__).resolve().parent.parent / "seed" / "spot_history.csv"
PRICE_SLOTS = [(10, 10), (12, 10), (14, 10), (16, 10), (18, 10)]   # 시세 갱신 시각(KST)
ANALYSIS_SLOTS = [(10, 10), (13, 10)]                              # 시장분석 시각(KST)
GRACE_MIN = 100   # 예약이 늦어도 이 시간(분) 안에 도착한 실행만 해당 시각으로 인정


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
    """day 기준 시각(엑셀 이력은 오전 9시)에 확정된 직전 미국 거래일 종가."""
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


def _parse_time(iso):
    """ISO 문자열을 한국시간 datetime으로. 못 읽으면 None."""
    if not iso:
        return None
    try:
        t = dt.datetime.fromisoformat(str(iso))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=KST)
    return t.astimezone(KST)


def latest_slot(now: dt.datetime, slots=None):
    """지금까지 지나온 시각 중 가장 늦은 것. 첫 시각 전이면 None."""
    slots = slots or ANALYSIS_SLOTS
    times = [now.replace(hour=h, minute=m, second=0, microsecond=0) for h, m in slots]
    passed = [t for t in times if now >= t]
    return passed[-1] if passed else None


def slot_due(now: dt.datetime, slots, last_iso, grace_min=None) -> bool:
    """가장 최근 시각이 지났는데 그 이후로 아직 갱신하지 않았으면 True.

    grace_min이 있으면 그 시각에서 너무 늦게(grace_min분 초과) 도착한 실행은 False.
    """
    slot = latest_slot(now, slots)
    if slot is None:
        return False
    if grace_min is not None and now - slot > dt.timedelta(minutes=grace_min):
        return False
    last = _parse_time(last_iso)
    return last is None or last < slot


def price_due(meta: dict, now: dt.datetime) -> bool:
    return slot_due(now, PRICE_SLOTS, meta.get("updated_at"), GRACE_MIN)


def analysis_due(meta: dict, now: dt.datetime, grace=GRACE_MIN) -> bool:
    return slot_due(now, ANALYSIS_SLOTS, meta.get("analysis_at"), grace)


def plan(meta: dict, now: dt.datetime, mode: str, backfill: bool = False):
    """(시세를 갱신할지, 시장분석을 새로 쓸지).

    auto: 정해진 시각에만. manual: 시세는 지금 바로, 분석은 아직 못 쓴 시각이 있을 때만.
    """
    if backfill:
        return True, True
    if mode == "manual":
        return True, analysis_due(meta, now, None)
    return price_due(meta, now), analysis_due(meta, now)


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


def summary_text(rows: list, dom: dict) -> str:
    """알림 메시지에 넣을 한 줄 요약."""
    if dom and "gold_buy" in dom and "silver_buy" in dom:
        return (
            f"금 살 때 {dom['gold_buy']:,}원 · 팔 때 {dom['gold_sell']:,}원 / "
            f"은 살 때 {dom['silver_buy']:,}원 · 팔 때 {dom['silver_sell']:,}원"
        )
    last = rows[-1]
    return f"금 {last['gold_krw_don']:,}원 · 은 {last['silver_krw_don']:,}원 (국제가 환산)"


def _append_output(lines: list) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as f:
        for line in lines:
            f.write(line.replace("\n", " ") + "\n")


def write_gate(run: bool) -> None:
    """워크플로의 다음 단계들이 실행될지 알려 준다."""
    _append_output(["run=" + ("true" if run else "false")])


def write_outputs(rows: list, dom: dict, kind: str, analysis: bool) -> None:
    """알림 단계가 읽을 값. kind는 'price'(시세 갱신) 또는 'analysis'(분석만 갱신)."""
    _append_output([
        "updated=true",
        "kind=" + kind,
        "analysis=" + ("true" if analysis else "false"),
        "summary=" + summary_text(rows, dom),
    ])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["auto", "manual"], default="manual",
                    help="auto: 정해진 시각에만 / manual: 지금 바로")
    ap.add_argument("--check", action="store_true", help="실행 여부만 알려 주고 끝낸다")
    ap.add_argument("--backfill", action="store_true", help="과거 30일 이력을 새로 채움")
    ap.add_argument("--no-analysis", action="store_true", help="시장분석을 건너뜀")
    ap.add_argument("--force", action="store_true", help="일요일에도 실행")
    ap.add_argument("--skip-if-fresh", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args()

    now = dt.datetime.now(KST)
    meta = load("meta.json", {})
    rows = load("history.json", [])
    if now.weekday() == 6 and not args.force:
        print("일요일은 휴무라 갱신하지 않습니다.")
        if args.check:
            write_gate(False)
        return 0

    do_prices, do_analysis = plan(meta, now, args.mode, args.backfill)
    if not rows or meta.get("sample", True):
        do_prices, do_analysis = True, True            # 처음이거나 샘플 상태
    if args.no_analysis:
        do_analysis = False
    print(f"한국시간 {now:%m-%d %H:%M} | 시세 갱신: {do_prices} | 시장분석: {do_analysis}")
    if args.check:
        write_gate(do_prices or do_analysis)
        return 0
    if not (do_prices or do_analysis):
        print("지금은 정해진 갱신 시각이 아니거나 이미 갱신돼 있어 건너뜁니다.")
        return 0

    dom = load("domestic.json", {})
    updated_at = meta.get("updated_at")
    if do_prices:
        print("금리 지표를 갱신합니다...")
        rates.update(DATA, now)
        print("국내 금·은 시세를 갱신합니다...")
        dom = domestic.update(DATA, now)

        import scrape

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
        fetched = dt.datetime.now(KST)
        row = compute.build_row(now.date(), **live)
        rows = compute.trim(compute.upsert(rows, row))
        save("history.json", rows)
        updated_at = fetched.isoformat(timespec="minutes")

    old = load("analysis.json", [])
    analysis_at = meta.get("analysis_at")
    analysis_ran = False
    cached = analyze.result_from_rows(old)
    if args.no_analysis:
        print("시장분석을 건너뜁니다.")
    elif do_analysis or cached is None:
        new_spikes = pending_spikes(rows, old)
        try:
            result = analyze.call_model(analyze.build_prompt(rows, new_spikes))
            out = analyze.build_rows(rows, result, new_spikes, old)
            out = spike_notes.fill_missing(out, rows=rows)
            save("analysis.json", out)
            analysis_at = dt.datetime.now(KST).isoformat(timespec="minutes")
            analysis_ran = True
        except Exception as e:
            print("시장분석 작성 실패:", e, file=sys.stderr)
            if cached is not None:        # 이전 분석이 있으면 그 문장을 두고 수치만 새로 만든다
                out = analyze.build_rows(rows, cached, [], old)
                save("analysis.json", out)
            else:
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
    else:
        print("시장분석은 10:10, 13:10에만 새로 씁니다. 수치만 갱신합니다.")
        out = analyze.build_rows(rows, cached, [], old)
        out = spike_notes.fill_missing(out, rows=rows)
        save("analysis.json", out)

    meta_out = dict(meta)
    meta_out.update({"sample": False, "updated_at": updated_at, "date": rows[-1]["date"]})
    if analysis_at:
        meta_out["analysis_at"] = analysis_at
    save("meta.json", meta_out)
    write_outputs(rows, dom, "price" if do_prices else "analysis", analysis_ran)
    print("완료:", rows[-1]["date"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
