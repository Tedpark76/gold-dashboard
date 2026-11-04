"""시장분석 작성 (Claude API + 웹 검색).

숫자는 코드가 계산하고, 문장은 모델이 쓴다.
"""
from __future__ import annotations

import json
import os
import re

MODEL = os.environ.get("ANTHROPIC_MODEL") or "claude-sonnet-5-5"
NOTICE = (
    "투자 권유가 아닌 참고용 정보이며, "
    "국제 현물가×환율로 환산한 값이라 "
    "실제 거래가와 다를 수 있습니다."
)

SYSTEM = (
    "당신은 금·은 시세를 쉽게 풀어 주는 한국어 시장 해설가입니다. "
    "주어진 수치와 웹 검색으로 확인한 당일 뉴스만 근거로 쓰고, "
    "원인을 단정하기 어려우면 '~했을 가능성이 있어요'처럼 "
    "가능성으로 표현합니다. "
    "투자 권유·매수/매도 의견은 쓰지 않습니다. "
    "문장은 '~했어요' 말투로 짧게 씁니다. "
    "금·은 공통 요인은 한 번만 설명하고 서로 반복하지 않습니다. "
    "출처 표시용 태그나 HTML(<cite> 등)은 절대 쓰지 말고 "
    "순수한 한국어 문장만 씁니다. "
    "반드시 JSON만 출력합니다."
)

SCHEMA_HINT = """{
  "headline_reason": "핵심 요인 한 문장(60자 이내)",
  "common": "금·은 공통 요인 1~2문장",
  "gold": "금 고유 요인 1~2문장",
  "silver": "은 고유 요인 1~2문장",
  "schedule": "오늘 주목할 일정 1문장 (없으면 빈 문자열)",
  "factors": [
    {
      "icon": "이모지 1개",
      "title": "요인 이름",
      "target": "금·은 | 금 | 은",
      "impact": "up | down | flat",
      "summary": "한 줄 요약(40자 이내)",
      "text": "쉬운 설명 1~2문장"
    }
  ],
  "checkpoint": {
    "icon": "이모지 1개",
    "title": "오늘의 체크포인트",
    "summary": "한 줄",
    "text": "1~2문장"
  },
  "spikes": [
    {"metal": "gold | silver", "date": "YYYY-MM-DD", "text": "급등락 이유 1문장"}
  ]
}"""


def _fmt_state(v: float) -> str:
    return "콘탱고" if v >= 0 else "백워데이션"


def build_prompt(rows: list, new_spikes: list) -> str:
    t = rows[-1]
    y = rows[-2] if len(rows) > 1 else rows[-1]
    gs, ss = t["gold_spread_pct"], t["silver_spread_pct"]
    lines = [
        f"기준일: {t['date']} ({t['weekday']}) 오전 9시(KST), 국제시장 기준",
        f"원화 금 {t['gold_krw_don']:,}원/돈 "
        f"(전일 대비 {t['gold_krw_dod_pct']:+.2f}%)",
        f"원화 은 {t['silver_krw_don']:,}원/돈 "
        f"(전일 대비 {t['silver_krw_dod_pct']:+.2f}%)",
        f"달러/원 {t['usdkrw']:,.2f} (전일 {y['usdkrw']:,.2f})",
        f"금 현물 {t['gold_spot']:,.2f}, 선물 {t['gold_fut']:,.2f}, "
        f"괴리율 {gs:+.2f}% {_fmt_state(gs)}",
        f"은 현물 {t['silver_spot']:,.2f}, 선물 {t['silver_fut']:,.2f}, "
        f"괴리율 {ss:+.2f}% {_fmt_state(ss)}",
    ]
    if new_spikes:
        items = ", ".join(
            f"{s['metal']} {s['date']} {s['pct']:+.2f}%" for s in new_spikes
        )
        lines.append("분석이 필요한 급등락일(전일 대비 ±3% 이상): " + items)
    else:
        lines.append("분석이 필요한 급등락일: 없음 (spikes는 빈 배열)")
    ask = (
        "\n\n웹 검색으로 오늘(또는 급등락일)의 금·은 관련 주요 뉴스를 확인한 뒤, "
        "아래 JSON 형식으로만 답하세요. "
        "factors는 정확히 4개(달러·환율, 금리·연준, 금 수급/안전자산, "
        "은 산업 수요 등 오늘 의미 있는 순서)로 쓰세요.\n"
    )
       return (
           "\n".join(lines)
           + ask
           + SCHEMA_HINT
       )
