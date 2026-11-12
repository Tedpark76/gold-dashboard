(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const fInt = (n) => Math.round(n).toLocaleString('en-US');
  const f2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fSign = (n) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2);
  const FMT = {
    gold_krw_don: fInt, silver_krw_don: fInt, usdkrw: f2,
    gold_spot: f2, gold_fut: f2, silver_spot: f2, silver_fut: f2,
    gold_krw_dod_pct: (v) => fSign(v) + '%', silver_krw_dod_pct: (v) => fSign(v) + '%',
    gold_spread_pct: (v) => fSign(v) + '%', silver_spread_pct: (v) => fSign(v) + '%'
  };
  const LINKS = [
    ['금 선물', 'https://kr.investing.com/commodities/gold'],
    ['금 현물', 'https://kr.investing.com/currencies/xau-usd'],
    ['은 선물', 'https://kr.investing.com/commodities/silver'],
    ['은 현물', 'https://kr.investing.com/currencies/xag-usd'],
    ['환율', 'https://kr.investing.com/currencies/usd-krw']
  ];
  const PAL = {
    bg: '#ffffff', fg: '#1b1b1b', mute: '#666a70', grid: '#e6e7ea',
    gold: '#a67c00', silver: '#6b7280', up: '#dc2626', down: '#2563eb', conta: '#2563eb', back: '#dc2626', pin: '#111827'
  };
  const FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Nanum Gothic", "Pretendard", -apple-system, sans-serif';
  const NAME = { gold: '금', silver: '은' };

  const GD = { rows: [], ana: [], latest: null };
  window.GD = GD;

  function fillLatest(r) {
    $$('[data-latest]').forEach((el) => {
      const f = el.dataset.latest;
      const v = r[f];
      el.textContent = FMT[f] ? FMT[f](Number(v)) : String(v);
      if (f.endsWith('_dod_pct')) el.className = 'gd-dod ' + (Number(v) > 0 ? 'up' : (Number(v) < 0 ? 'down' : 'flat'));
    });
    ['gold', 'silver'].forEach((m) => {
      const v = Number(r[m + '_spread_pct']);
      const st = $('#gd-' + m + '-state');
      const box = $('#gd-' + m + '-spread');
      st.textContent = v >= 0 ? '콘탱고' : '백워데이션';
      st.className = 'gd-state ' + (v >= 0 ? 'up' : 'down');
      box.className = 'gd-val ' + (v >= 0 ? 'up' : 'down');
    });
  }

  function stateAfter(parts, i) {
    const next = String(parts[i + 1] || '').trim();
    if (next.indexOf('콘탱고') === 0) return 'conta';
    if (next.indexOf('백워데이션') === 0) return 'back';
    return '';
  }
  function setRich(el, text, opts) {
    el.textContent = '';
    const small = opts === true || !!(opts && opts.small);
    const unit = !!(opts && opts.unit);
    const re = unit
      ? /(\(1돈\)|\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/
      : /(\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/;
    const parts = String(text).split(re);
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        const s = document.createElement('span');
        if (part === '(1돈)') {
          s.className = 'gd-unit';
        } else {
          const v = parseFloat(part.replace(/[(),]/g, '').replace('−', '-'));
          const st = stateAfter(parts, i);
          s.className = 'gd-pct ' + (st || (v > 0 ? 'up' : (v < 0 ? 'down' : ''))) + (small && !st ? ' sm' : '');
        }
        s.textContent = part;
        el.appendChild(s);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
  }

  function fillRates(rt) {
    // 데이터가 아직 없어도 영역은 보여 주고 값은 —로 둔다 (갱신 후 채워짐)
    const r = rt || {};
    $('#gd-sec-rates').hidden = false;
    $('#gd-us10y').textContent = r.us10y !== undefined ? Number(r.us10y).toFixed(2) + '%' : '—';
    const ce = $('#gd-us10y-chg');
    if (r.us10y_chg !== undefined) {
      const v = Number(r.us10y_chg);
      ce.textContent = fSign(v) + '%';
      ce.className = 'gd-dod ' + (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat'));
    } else {
      ce.textContent = '';
      ce.className = 'gd-dod';
    }
    $('#gd-bok').textContent = r.bok_rate !== undefined ? Number(r.bok_rate).toFixed(2) + '%' : '—';
    $('#gd-bok-date').textContent = r.bok_date ? '(' + String(r.bok_date).replace(/-/g, '.') + ')' : '';
  }

  /* 갱신 시각 문구: 마지막 갱신 시각(meta.updated_at)을 '오후 2시 30분 기준'처럼 보여 준다 */
  function asofLabel() {
    const m = /T(\d{2}):(\d{2})/.exec(String((GD.meta && GD.meta.updated_at) || ''));
    if (!m) return '';
    const hh = Number(m[1]), mm = Number(m[2]);
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return (hh < 12 ? '오전 ' : '오후 ') + h12 + '시' + (mm ? ' ' + mm + '분' : '') + ' 기준';
  }

  function spreadLine() {
    const r = GD.latest;
    const g = Number(r.gold_spread_pct), s = Number(r.silver_spread_pct);
    return '금 괴리율 ' + fSign(g) + '% ' + (g >= 0 ? '콘탱고' : '백워데이션')
      + ', 은 괴리율 ' + fSign(s) + '% ' + (s >= 0 ? '콘탱고' : '백워데이션') + '.';
  }

  function chgText(v, abs) {
    if (v === null || v === undefined) return abs ? '변동 ' + fInt(Number(abs)) : '';
    return (v > 0 ? '+' : (v < 0 ? '-' : '')) + fInt(Math.abs(Number(v)));
  }
  function fillDomestic(d) {
    const map = [['gbuy', 'gold_buy'], ['gsell', 'gold_sell'], ['sbuy', 'silver_buy'], ['ssell', 'silver_sell']];
    map.forEach((m) => {
      const el = $('#gd-' + m[0]);
      const ce = $('#gd-' + m[0] + '-chg');
      const price = d ? d[m[1]] : undefined;
      el.textContent = price !== undefined ? fInt(Number(price)) : '—';
      const chg = d ? d[m[1] + '_chg'] : undefined;
      if (price !== undefined) {
        ce.textContent = chgText(chg === undefined ? null : chg, d[m[1] + '_abs']);
        const v = Number(chg);
        ce.className = 'gd-dod ' + (chg === null || chg === undefined ? 'flat' : (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat')));
      } else {
        ce.textContent = '';
        ce.className = 'gd-dod';
      }
    });
  }
  function domLine(name, d, k) {
    const c = (v) => (v === null || v === undefined ? '' : '(' + (v > 0 ? '+' : (v < 0 ? '-' : '')) + fInt(Math.abs(Number(v))) + '원)');
    return name + '(1돈) 살 때 ' + fInt(Number(d[k + '_buy'])) + '원' + c(d[k + '_buy_chg'])
      + ', 팔 때 ' + fInt(Number(d[k + '_sell'])) + '원' + c(d[k + '_sell_chg']);
  }

  function headlineLines() {
    const r = GD.latest;
    const reason = String((GD.ana.find((x) => x.id === 'h3') || {}).text || '').replace(/^샘플 문구:\s*/, '');
    const d = GD.domestic;
    const ok = d && d.gold_buy !== undefined && d.silver_buy !== undefined;
    const prevRow = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    const fxv = prevRow && Number(prevRow.usdkrw) ? (Number(r.usdkrw) / Number(prevRow.usdkrw) - 1) * 100 : null;
    return [
      ok ? domLine('금', d, 'gold')
        : '금 시세 ' + fInt(Number(r.gold_krw_don)) + '원/돈(3.75g), 전일 대비 ' + fSign(Number(r.gold_krw_dod_pct)) + '%',
      ok ? domLine('은', d, 'silver')
        : '은 시세 ' + fInt(Number(r.silver_krw_don)) + '원/돈, 전일 대비 ' + fSign(Number(r.silver_krw_dod_pct)) + '%',
      '달러/원 ' + f2(Number(r.usdkrw)) + '원' + (fxv === null ? '' : '(' + fSign(fxv) + '%)'),
      reason
    ];
  }

  function fillExtra() {
    const r = GD.latest;
    const prev = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    const fe = $('#gd-fx-chg');
    if (prev && Number(prev.usdkrw)) {
      const v = (Number(r.usdkrw) / Number(prev.usdkrw) - 1) * 100;
      fe.textContent = fSign(v) + '%';
      fe.className = 'gd-dod ' + (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat'));
    } else {
      fe.textContent = '';
      fe.className = 'gd-dod';
    }
    ['gold_fut', 'gold_spot', 'silver_fut', 'silver_spot'].forEach((k) => {
      const el = $('#gd-chg-' + k);
      if (prev && Number(prev[k])) {
        const v = (Number(r[k]) / Number(prev[k]) - 1) * 100;
        el.textContent = fSign(v) + '%';
        el.className = 'gd-dod ' + (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat'));
      } else {
        el.textContent = '';
        el.className = 'gd-dod';
      }
    });
    const lines = headlineLines();
    [0, 1, 2].forEach((i) => setRich($('#gd-hl-' + i), lines[i], { small: i !== 1, unit: true }));
    setRich($('[data-ana="m4"]'), spreadLine());
    fillDomestic(GD.domestic);
  }

  function fillAnalysis(a) {
    $$('[data-ana]').forEach((el) => {
      const id = el.dataset.ana;
      const row = a.find((x) => x.id === id);
      setRich(el, row ? row.text : '');
    });
    const cp = a.find((x) => x.id === 'c1');
    const cel = $('#gd-cp');
    if (cel) setRich(cel, cp ? cp.summary + (cp.text ? ' — ' + cp.text : '') : '');
    const inds = a.filter((x) => x.kind === 'indicator');
    const ibox = $('#gd-ind');
    if (ibox) {
      ibox.hidden = !inds.length;
      const lines = $('#gd-ind-lines');
      lines.textContent = '';
      inds.forEach((x) => {
        const s = document.createElement('span');
        s.className = 'gd-ind-line';
        setRich(s, x.text);
        lines.appendChild(s);
      });
    }
    ['gold', 'silver'].forEach((m) => {
      const tb = $('#gd-' + m + '-spikes tbody');
      tb.textContent = '';
      const rows = a.filter((x) => x.kind === 'spike_' + m);
      if (!rows.length) {
        const td = tb.insertRow().insertCell();
        td.colSpan = 4;
        td.textContent = '이 기간에 3% 이상 급등락한 날이 없습니다.';
        return;
      }
      rows.forEach((x) => {
        const tr = tb.insertRow();
        tr.dataset.key = x.id;
        const pct = Number(x.pct);
        tr.className = pct > 0 ? 'is-up' : 'is-down';
        [x.no, x.date.slice(5).replace('-', '/'), (pct > 0 ? '▲ ' : '▼ ') + fSign(pct) + '%', x.text]
          .forEach((t) => { tr.insertCell().textContent = t; });
      });
    });
  }

  function spikesOf(metal) {
    return GD.ana.filter((x) => x.kind === 'spike_' + metal)
      .map((x) => ({ date: x.date, pct: Number(x.pct), no: Number(x.no) }));
  }

  /* ---------- 그래프 이미지 (화면과 복사용이 같은 함수) ---------- */
  const DOT = '\u318D';
  function chartBase(cv, W, H, dpr) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.aspectRatio = W + ' / ' + H;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg;
    c.fillRect(0, 0, W, H);
    return c;
  }
  function drawXTicks(c, rows, x, y, small, fs) {
    const n = rows.length;
    const step = Math.max(1, Math.ceil(n / (small ? 5 : 8)));
    c.font = '600 ' + fs + 'px ' + FONT;
    c.fillStyle = PAL.mute; c.textAlign = 'center';
    rows.forEach((r, i) => {
      if (i % step === 0 || i === n - 1) c.fillText(r.date.slice(5).replace('-', '/'), x(i), y);
    });
  }

  /* 금·은 국내 시세 (꺾은선) */
  function drawLineChart(cv, metal, rows, spikes, W, H, dpr) {
    const nm = NAME[metal];
    const kf = metal + '_krw_don';
    const c = chartBase(cv, W, H, dpr);
    const small = W < 560;
    const fs = small ? 11 : 13;
    c.textAlign = 'left';
    c.fillStyle = PAL.fg;
    c.font = '700 ' + (small ? 16 : 20) + 'px ' + FONT;
    c.fillText(nm + ' 국내 시세', 14, 26);
    c.fillStyle = PAL.mute;
    c.font = '600 ' + fs + 'px ' + FONT;
    c.fillText('최근 30일(일요일 제외) · 원/돈(3.75g) · 국제가 환산', 14, 26 + (small ? 16 : 20));

    const L = small ? 56 : 72, R = 14, T = small ? 58 : 66, B = small ? 54 : 56;
    const plotW = W - L - R;
    const plotH = H - T - B;
    const n = rows.length;
    const x = (i) => L + plotW * (n < 2 ? 0.5 : i / (n - 1));
    const vals = rows.map((r) => Number(r[kf]));
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const pad = (hi - lo) * 0.14 || 1;
    const y0 = lo - pad, y1v = hi + pad;
    const y1 = (v) => T + plotH - ((v - y0) / (y1v - y0)) * plotH;
    c.fillStyle = metal === 'gold' ? '#fff7e0' : '#eef1f6';
    c.fillRect(L, T, plotW, plotH);

    c.font = '600 ' + fs + 'px ' + FONT;
    c.lineWidth = 1;
    for (let k = 0; k <= 3; k++) {
      const v = y0 + ((y1v - y0) * k) / 3;
      const yy = y1(v);
      c.strokeStyle = PAL.grid;
      c.beginPath(); c.moveTo(L, yy); c.lineTo(W - R, yy); c.stroke();
      c.fillStyle = PAL.mute; c.textAlign = 'right';
      c.fillText(fInt(v), L - 6, yy + 4);
    }
    c.strokeStyle = PAL[metal];
    c.lineWidth = 2.5; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    rows.forEach((r, i) => { const px = x(i), py = y1(Number(r[kf])); if (i) c.lineTo(px, py); else c.moveTo(px, py); });
    c.stroke();

    spikes.forEach((s) => {
      const i = rows.findIndex((r) => r.date === s.date);
      if (i < 0) return;
      const px = x(i), py = y1(Number(rows[i][kf]));
      c.fillStyle = PAL.pin;
      c.beginPath(); c.arc(px, py, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.font = '700 12px ' + FONT; c.textAlign = 'center';
      c.fillText(String(s.no), px, py + 4);
      c.fillStyle = PAL.pin; c.font = '600 ' + fs + 'px ' + FONT; c.textAlign = 'left';
      c.fillText(s.pct > 0 ? '▲' : '▼', px + 14, py + 4);
    });

    drawXTicks(c, rows, x, T + plotH + 18, small, fs);
    c.textAlign = 'left'; c.fillStyle = PAL.mute; c.font = '600 ' + (fs - 1) + 'px ' + FONT;
    c.fillText('번호 마커: 전일 대비 ±3% 이상 변동(▲급등 ▼급락)', 14, H - 12);
  }

  /* 금·은 선물ㆍ현물 괴리율 (막대) */
  function drawGapChart(cv, metal, rows, W, H, dpr) {
    const nm = NAME[metal];
    const sf = metal + '_spread_pct';
    const c = chartBase(cv, W, H, dpr);
    const small = W < 560;
    const fs = small ? 11 : 13;
    c.textAlign = 'left';
    c.fillStyle = PAL.fg;
    c.font = '700 ' + (small ? 16 : 20) + 'px ' + FONT;
    c.fillText(nm + ' 선물' + DOT + '현물 괴리율(%)', 14, 26);

    const L = small ? 56 : 72, R = 14, T = small ? 44 : 50, B = small ? 54 : 56;
    const plotW = W - L - R;
    const plotH = H - T - B;
    const n = rows.length;
    const x = (i) => L + plotW * (n < 2 ? 0.5 : i / (n - 1));
    const sv = rows.map((r) => Number(r[sf]));
    const m = Math.max(0.2, Math.max.apply(null, sv.map(Math.abs))) * 1.15;
    const zero = T + plotH / 2;
    const y2 = (v) => zero - (v / m) * (plotH / 2);
    c.fillStyle = '#f3f6fb';
    c.fillRect(L, T, plotW, plotH);
    c.font = '600 ' + fs + 'px ' + FONT;
    c.lineWidth = 1;
    [m, 0, -m].forEach((v) => {
      c.strokeStyle = v === 0 ? PAL.mute : PAL.grid;
      c.beginPath(); c.moveTo(L, y2(v)); c.lineTo(W - R, y2(v)); c.stroke();
      c.fillStyle = PAL.mute; c.textAlign = 'right';
      c.fillText(v.toFixed(2), L - 6, y2(v) + 4);
    });
    const bw = Math.max(3, (plotW / n) * 0.6);
    sv.forEach((v, i) => {
      c.fillStyle = v >= 0 ? PAL.conta : PAL.back;
      const yy = y2(v);
      c.fillRect(x(i) - bw / 2, Math.min(yy, zero), bw, Math.max(1, Math.abs(yy - zero)));
    });
    drawXTicks(c, rows, x, T + plotH + 18, small, fs);
    c.textAlign = 'left'; c.fillStyle = PAL.mute; c.font = '600 ' + (fs - 1) + 'px ' + FONT;
    c.fillText('막대 파랑 = 콘탱고, 빨강 = 백워데이션', 14, H - 12);
  }

  /* 복사용: 두 그래프를 위아래로 붙인 한 장 */
  function drawChartStack(cv, metal, rows, spikes, W, dpr) {
    const H1 = 520, H2 = 400;
    const a = document.createElement('canvas');
    const b = document.createElement('canvas');
    drawLineChart(a, metal, rows, spikes, W, H1, dpr);
    drawGapChart(b, metal, rows, W, H2, dpr);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round((H1 + H2) * dpr);
    const c = cv.getContext('2d');
    c.drawImage(a, 0, 0);
    c.drawImage(b, 0, Math.round(H1 * dpr));
  }

  /* ---------- 시세 이미지 ---------- */
  function drawPrices(cv, r, W, dpr, opts) {
    const noHead = !!(opts && opts.noHead);
    const rowH = 54, head = noHead ? 6 : 100, secH = 52, EX = 120;
    const rt = GD.rates;
    const hasRt = !!(rt && (rt.us10y !== undefined || rt.bok_rate !== undefined));
    const H = head + 3 * (secH + 3 * rowH) + (hasRt ? secH + 2 * rowH : 0) + (noHead ? 8 : 44);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, W, H);
    c.textAlign = 'left'; c.fillStyle = PAL.fg;
    if (!noHead) {
      c.font = '700 32px ' + FONT;
      c.fillText('금·은 시세', 40, 52);
      c.fillStyle = PAL.mute; c.font = '600 20px ' + FONT;
      c.fillText(r.date + ' (' + r.weekday + ') ' + asofLabel(), 40, 82);
    }
    let y = head;
    const sec = (title, unit) => {
      c.fillStyle = PAL.fg; c.font = '700 24px ' + FONT; c.textAlign = 'left';
      c.fillText(title, 40, y + 34);
      if (unit) {
        const tw0 = c.measureText(title).width;
        c.font = '600 14.4px ' + FONT; c.fillStyle = PAL.mute;
        c.fillText(unit, 40 + tw0 + 8, y + 34);
      }
      c.strokeStyle = PAL.fg; c.lineWidth = 2;
      c.beginPath(); c.moveTo(40, y + 44); c.lineTo(W - 40, y + 44); c.stroke();
      y += secH;
    };
    const line = (label, value, extra, color, valColor, smallExtra, below) => {
      const rh = below ? rowH + 26 : rowH;
      c.fillStyle = PAL.mute; c.font = '600 22px ' + FONT; c.textAlign = 'left';
      c.fillText(label, 40, y + 34);
      const rx = W - 40 - EX;
      c.textAlign = 'right';
      c.font = '700 30px ' + FONT; c.fillStyle = valColor || color || PAL.fg;
      c.fillText(value, rx, y + 36);
      if (extra && !below) {
        c.textAlign = 'left';
        c.font = '600 ' + (smallExtra === false ? 20 : 18) + 'px ' + FONT; c.fillStyle = color || PAL.mute;
        c.fillText(extra, rx + 12, y + 34);
      }
      if (extra && below) {
        c.font = '600 18px ' + FONT; c.fillStyle = color || PAL.mute;
        c.fillText(extra, rx, y + 62);
      }
      c.strokeStyle = PAL.grid; c.lineWidth = 1;
      c.beginPath(); c.moveTo(40, y + rh); c.lineTo(W - 40, y + rh); c.stroke();
      y += rh;
    };
    const dod = (v) => (Number(v) > 0 ? '▲ ' : (Number(v) < 0 ? '▼ ' : '')) + fSign(Number(v)) + '%';
    const dodCol = (v) => (Number(v) > 0 ? PAL.up : (Number(v) < 0 ? PAL.down : PAL.mute));
    const spr = (v) => { const n = Number(v); return [fSign(n) + '%', n >= 0 ? '콘탱고' : '백워데이션', n >= 0 ? PAL.conta : PAL.back]; };
    sec('오늘의 시세', '(골드바/실버바 기준, 1돈, 3.75g)');
    const dm = GD.domestic;
    const money = (v) => (v === null || v === undefined ? '' : (v > 0 ? '▲ +' : (v < 0 ? '▼ -' : '')) + fInt(Math.abs(Number(v))));
    const mcol = (v) => (v > 0 ? PAL.up : (v < 0 ? PAL.down : PAL.mute));
    [['순금 살 때 (VAT 포함)', 'gold_buy'], ['순금 팔 때', 'gold_sell'], ['은 살 때 (VAT 포함)', 'silver_buy'], ['은 팔 때', 'silver_sell']].forEach((it) => {
      const has = dm && dm[it[1]] !== undefined;
      const chg = has ? dm[it[1] + '_chg'] : null;
      line(it[0], has ? fInt(Number(dm[it[1]])) : '—', has ? (chg === null || chg === undefined ? '변동 ' + fInt(Number(dm[it[1] + '_abs'])) : money(chg)) : '', has ? mcol(Number(chg)) : PAL.mute, PAL.fg);
    });
    const prevRow = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    const fxv = prevRow && Number(prevRow.usdkrw) ? (Number(r.usdkrw) / Number(prevRow.usdkrw) - 1) * 100 : null;
    line('환율 (원/USD)', f2(Number(r.usdkrw)), fxv === null ? '' : dod(fxv), fxv === null ? PAL.mute : dodCol(fxv), PAL.fg);
    ['gold', 'silver'].forEach((mt) => {
      sec(NAME[mt] + ' 국제 시세', '(USD/온스, 31.1g)');
      ['fut', 'spot'].forEach((kind) => {
        const key = mt + '_' + kind;
        const pv = prevRow ? Number(prevRow[key]) : 0;
        const cv = pv ? (Number(r[key]) / pv - 1) * 100 : null;
        line(NAME[mt] + (kind === 'fut' ? ' 선물' : ' 현물'), f2(Number(r[key])),
          cv === null ? '' : dod(cv), cv === null ? PAL.mute : dodCol(cv), PAL.fg);
      });
      const s = spr(r[mt + '_spread_pct']);
      line('선물·현물 괴리율', s[0], s[1], s[2], undefined, false);
    });
    if (hasRt) {
      sec('금리 지표');
      const cv2 = Number(rt.us10y_chg);
      const chgTxt = rt.us10y_chg !== undefined ? fSign(cv2) + '%' : '';
      const chgCol = cv2 > 0 ? PAL.up : (cv2 < 0 ? PAL.down : PAL.mute);
      const us = rt.us10y !== undefined ? Number(rt.us10y).toFixed(2) + '%' : '—';
      line('미국 10년물 국채금리', us, chgTxt, chgCol, PAL.fg);
      const bok = rt.bok_rate !== undefined ? Number(rt.bok_rate).toFixed(2) + '%' : '—';
      line('한국은행 기준금리' + (rt.bok_date ? '(' + String(rt.bok_date).replace(/-/g, '.') + ')' : ''), bok, '', PAL.mute, PAL.fg);
    }
    if (!noHead) {
      c.fillStyle = PAL.mute; c.font = '600 16px ' + FONT; c.textAlign = 'left';
      c.fillText((GD.sample ? '샘플 데이터 · ' : '') + '국제 현물가×환율 환산값으로 실제 거래가와 다를 수 있습니다.', 40, H - 16);
    }
    return H;
  }

  /* ---------- 복사 ---------- */
  const flashEl = $('#gd-flash');
  let flashTimer = null;
  function flash(msg) {
    flashEl.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashEl.textContent = ''; }, 3500);
  }
  function showPreview(canvas) {
    $('#gd-preview-img').src = canvas.toDataURL('image/png');
    $('#gd-preview').hidden = false;
    $('#gd-preview').scrollIntoView({ block: 'nearest' });
  }
  async function copyCanvas(canvas, label) {
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      $('#gd-preview').hidden = true;
      flash(label + ' 복사됨. 네이버 블로그 글쓰기 화면에 붙여넣으세요.');
    } catch (e) {
      showPreview(canvas);
      flash(label + ' 자동 복사가 막혀 이미지를 아래에 띄웠습니다.');
    }
  }
  function buildText() {
    const r = GD.latest;
    const byId = (id) => (GD.ana.find((x) => x.id === id) || {}).text || '';
    const out = [];
    out.push('[금·은 시세] ' + r.date + ' (' + r.weekday + ') ' + asofLabel());
    headlineLines().filter(Boolean).forEach((t) => out.push(t));
    out.push('');
    out.push('■ 시장분석');
    const indRows = GD.ana.filter((x) => x.kind === 'indicator');
    const cpRow = GD.ana.find((x) => x.id === 'c1');
    out.push('- 공통 요인: ' + byId('m1'));
    if (indRows.length) {
      out.push('- 주요 경제지표');
      indRows.forEach((x) => out.push('  · ' + x.text));
    }
    out.push('- 금 요인: ' + byId('m2'));
    out.push('- 은 요인: ' + byId('m3'));
    out.push('- 선물·현물 괴리: ' + spreadLine());
    if (cpRow) out.push('- 오늘의 체크포인트: ' + cpRow.summary + (cpRow.text ? ' — ' + cpRow.text : ''));
    ['gold', 'silver'].forEach((m) => {
      const sp = GD.ana.filter((x) => x.kind === 'spike_' + m);
      if (!sp.length) return;
      out.push('');
      out.push('■ ' + NAME[m] + ' 급등락일 분석 (전일 대비 ±3% 이상)');
      sp.forEach((x) => out.push('[' + x.no + '] ' + x.date.slice(5).replace('-', '/') + ' ' +
        (Number(x.pct) > 0 ? '▲' : '▼') + fSign(Number(x.pct)) + '% ' + x.text));
    });
    out.push('');
    out.push('■ 시세 출처');
    LINKS.forEach((l) => out.push('- ' + l[0] + ': ' + l[1]));
    out.push('');
    out.push(byId('n1'));
    return out.join('\n');
  }
  async function copyText() {
    const t = buildText();
    try {
      await navigator.clipboard.writeText(t);
      flash('시장분석 텍스트 복사됨. 네이버 블로그 글쓰기 화면에 붙여넣으세요.');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      flash(ok ? '시장분석 텍스트 복사됨.' : '복사가 막혔습니다. 브라우저에서 직접 열어 다시 시도하세요.');
    }
  }
  function offscreen() { return document.createElement('canvas'); }
  $('#gd-copy-prices').addEventListener('click', () => {
    if (!GD.latest) return;
    const cv = offscreen(); drawPrices(cv, GD.latest, 1000, 2); copyCanvas(cv, '시세 이미지');
  });
  ['gold', 'silver'].forEach((m) => {
    $('#gd-copy-' + m).addEventListener('click', () => {
      if (!GD.rows.length) return;
      const cv = offscreen(); drawChartStack(cv, m, GD.rows, spikesOf(m), 1000, 2); copyCanvas(cv, NAME[m] + ' 그래프');
    });
  });
  $('#gd-copy-text').addEventListener('click', () => { if (GD.latest) copyText(); });


  /* ---------- 한 장 인포그래픽 (시장분석 중심) ---------- */
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const INF = {
    bg: '#fbf8ff', ink: '#2a2540', mute: '#6b6785', gold: '#f5b301', silver: '#8fa3bf',
    teal: '#14b8a6', violet: '#7c3aed', up: '#dc2626', down: '#2563eb', blue: '#2563eb', red: '#dc2626', conta: '#2563eb', back: '#dc2626'
  };
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const ATOM_RE = /(\(1돈\)|\(변동 [\d,]+원\)|\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/;
  function textUnits(text) {
    const units = [];
    String(text).split(ATOM_RE).forEach((seg, i) => {
      if (!seg) return;
      if (i % 2) units.push({ s: seg, atom: true });
      else for (const ch of seg) units.push({ s: ch, atom: false });
    });
    return units;
  }
  function wrapText(c, text, maxW) {
    const out = [];
    let line = '';
    textUnits(text).forEach((u) => {
      if (u.s === ' ' && !line) return;
      const t = line + u.s;
      if (c.measureText(t).width > maxW && line) { out.push(line.trimEnd()); line = u.s === ' ' ? '' : u.s; } else { line = t; }
    });
    if (line) out.push(line);
    return out;
  }
  /* 증감·(1돈)이 본문과 다른 크기로 그려질 때, 실제 그려질 크기로 폭을 재서 줄을 나눈다 */
  function wrapRich(c, text, maxW, baseFont, atomFont) {
    const out = [];
    let line = '', w = 0;
    textUnits(text).forEach((u) => {
      if (u.s === ' ' && !line) return;
      c.font = u.atom ? atomFont : baseFont;
      const uw = c.measureText(u.s).width;
      if (w + uw > maxW && line) {
        out.push(line.trimEnd()); line = ''; w = 0;
        if (!u.atom && u.s === ' ') return;
      }
      line += u.s; w += uw;
    });
    if (line) out.push(line);
    c.font = baseFont;
    return out;
  }
  function fontWithPx(font, px) {
    return font.replace(/(\d+(?:\.\d+)?)px/, px + 'px');
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function softCard(c, x, y, w, h, r, fill) {
    c.save();
    c.shadowColor = 'rgba(60,40,120,0.14)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
    c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill();
    c.restore();
  }
  function pill(c, text, x, y, bg, fg, font) {
    c.font = font;
    const w = c.measureText(text).width + 28;
    c.fillStyle = bg; rr(c, x, y, w, 36, 18); c.fill();
    c.fillStyle = fg; c.textAlign = 'left'; c.fillText(text, x + 14, y + 25);
    return w;
  }
  function coin(c, cx, cy, rad, base, hi, ch, ink) {
    const g = c.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, hi); g.addColorStop(1, base);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, rad - 8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = ink; c.font = '700 ' + Math.round(rad * 0.8) + 'px ' + FONT; c.textAlign = 'center';
    c.fillText(ch, cx, cy + rad * 0.28); c.textAlign = 'left';
  }
  function spark(c, rows, key, x, y, w, h, color) {
    const v = rows.map((q) => Number(q[key]));
    const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = (hi - lo) || 1;
    const px = (i) => x + w * (v.length < 2 ? 0.5 : i / (v.length - 1));
    const py = (t) => y + h - ((t - lo) / span) * h;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0));
    c.beginPath();
    v.forEach((t, i) => { if (i) c.lineTo(px(i), py(t)); else c.moveTo(px(i), py(t)); });
    c.lineTo(px(v.length - 1), y + h); c.lineTo(px(0), y + h); c.closePath();
    c.fillStyle = g; c.fill();
    c.beginPath();
    v.forEach((t, i) => { if (i) c.lineTo(px(i), py(t)); else c.moveTo(px(i), py(t)); });
    c.strokeStyle = color; c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    c.fillStyle = color; c.beginPath(); c.arc(px(v.length - 1), py(v[v.length - 1]), 5, 0, Math.PI * 2); c.fill();
  }
  function scaledFont(font, k) {
    return font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => (parseFloat(n) * k).toFixed(1) + 'px');
  }
  function drawRich(c, text, x, y, base, opt) {
    const o = typeof opt === 'number' ? { chg: opt } : (opt || {});
    const hasUnit = !!(o.unit || o.unitPx);
    const hasChg = !!(o.chg || o.chgPx);
    let cx = x;
    const baseFont = c.font;
    const unitFont = o.unitPx ? fontWithPx(baseFont, o.unitPx) : scaledFont(baseFont, o.unit || 0.6);
    const chgFont = o.chgPx ? fontWithPx(baseFont, o.chgPx) : (o.chg ? scaledFont(baseFont, o.chg) : baseFont);
    const re = hasUnit
      ? /(\(1돈\)|\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/
      : (hasChg ? /(\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/ : /([+\-−]\d[\d,]*(?:\.\d+)?(?:%|원))/);
    const parts = String(text).split(re);
    parts.forEach((part, i) => {
      if (!part) return;
      let font = baseFont, col = base;
      if (i % 2) {
        if (part === '(1돈)') {
          font = unitFont;
        } else {
          const v = parseFloat(part.replace(/[(),]/g, '').replace('−', '-'));
          const st = o.noState ? '' : stateAfter(parts, i);
          col = st === 'conta' ? INF.conta : (st === 'back' ? INF.back : (v > 0 ? INF.up : (v < 0 ? INF.down : base)));
          if (!st) font = chgFont;
        }
      }
      c.font = font;
      c.fillStyle = col;
      c.fillText(part, cx, y);
      cx += c.measureText(part).width;
    });
    c.font = baseFont;
  }
  const UA_STR = navigator.userAgent || '';
  const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(UA_STR);
  const IS_SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(UA_STR);
  /* 고해상도 배율: 캔버스 크기 한도(가로세로 최대치, 전체 픽셀 수) 안에서 원하는 배율에 가장 가깝게 */
  function pickDpr(W, H, want) {
    const maxArea = IS_MOBILE ? 16e6 : 64e6;
    const maxSide = (IS_MOBILE || IS_SAFARI) ? 16000 : 32000;
    return Math.max(1, Math.min(want, Math.sqrt(maxArea / (W * H)), maxSide / H, maxSide / W));
  }

  function buildInfographic(want, hint) {
    const W = 1080, P = 56, TALL = 4200;
    const HH = hint || TALL;
    const dpr = hint ? pickDpr(W, hint, want || 3) : (want || 0.2);
    const r = GD.latest;
    const clean = (s) => String(s || '').replace(/^샘플 문구:\s*/, '');
    const byId = (id) => clean((GD.ana.find((x) => x.id === id) || {}).text);
    const tall = document.createElement('canvas');
    tall.width = Math.round(W * dpr); tall.height = Math.round(HH * dpr);
    const c = tall.getContext('2d');
    if (!c) throw new Error('canvas too large');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = INF.bg; c.fillRect(0, 0, W, HH);
    c.textAlign = 'left';
    c.fillStyle = rgba(INF.gold, 0.08); c.beginPath(); c.arc(W - 40, 1050, 240, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgba(INF.violet, 0.05); c.beginPath(); c.arc(20, 2100, 280, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgba(INF.teal, 0.06); c.beginPath(); c.arc(W - 60, 3000, 220, 0, Math.PI * 2); c.fill();

    // 머리말
    const hg = c.createLinearGradient(0, 0, W, 280);
    hg.addColorStop(0, '#2e1f7a'); hg.addColorStop(0.62, '#6d3fd1'); hg.addColorStop(1, '#d08a1d');
    c.fillStyle = hg; c.fillRect(0, 0, W, 290);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.beginPath(); c.arc(W - 40, 30, 170, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(150, 300, 120, 0, Math.PI * 2); c.fill();
    coin(c, W - 190, 120, 60, '#f5b301', '#fff3c4', '금', '#8a5a00');
    coin(c, W - 104, 168, 46, '#a9b8cf', '#eef2f8', '은', '#46546b');
    c.fillStyle = '#ffffff'; c.font = '700 54px ' + FONT; c.fillText('오늘의 금·은 이야기', P, 96);
    c.fillStyle = 'rgba(255,255,255,0.88)'; c.font = '600 24px ' + FONT;
    c.fillText(r.date + ' (' + r.weekday + ') ' + asofLabel(), P, 142);
    c.fillText('시세와 시장 흐름을 한 장으로 담았어요', P, 178);
    if (GD.sample) pill(c, '샘플 데이터', P, 204, '#fde68a', '#5b4200', '700 20px ' + FONT);

    // 핵심 한 줄
    let y = 262;
    const hl = headlineLines().filter(Boolean).map((text, i) => ({
      font: (i === 0 ? '700 32px ' : '600 24px ') + FONT, lh: i === 0 ? 48 : 36, color: i === 0 ? '#3b2a8c' : INF.ink, text: text,
      opt: i < 3 ? { chgPx: 24, unitPx: 24 } : undefined
    }));
    let boxH = 76;
    hl.forEach((o) => {
      c.font = o.font;
      o.lines = o.opt ? wrapRich(c, o.text, W - 2 * P - 90, o.font, fontWithPx(o.font, 24)) : wrapText(c, o.text, W - 2 * P - 90);
      boxH += o.lines.length * o.lh + 10;
    });
    softCard(c, P, y, W - 2 * P, boxH, 28, '#ffffff');
    c.fillStyle = rgba(INF.gold, 0.9); c.font = '700 96px ' + FONT; c.fillText('“', P + 28, y + 86);
    let ty = y + 40;
    hl.forEach((o) => { c.font = o.font; c.fillStyle = o.color; o.lines.forEach((ln) => { ty += o.lh; drawRich(c, ln, P + 84, ty - 6, o.color, o.opt); }); ty += 10; });
    y += boxH + 52;

    const sectionTitle = (emoji, text, sub, unit) => {
      c.font = '36px ' + EMOJI; c.fillStyle = INF.ink; c.fillText(emoji, P, y + 36);
      c.font = '700 34px ' + FONT; c.fillText(text, P + 56, y + 36);
      if (unit) {
        const tw1 = c.measureText(text).width;
        c.font = '600 20.4px ' + FONT; c.fillStyle = INF.mute;
        c.fillText(unit, P + 56 + tw1 + 10, y + 36);
      }
      if (sub) { c.font = '600 20px ' + FONT; c.fillStyle = INF.mute; c.fillText(sub, P + 56, y + 68); y += 18; }
      y += 68;
    };

    // 오늘의 시세 (대시보드와 같은 구성)
    const dm = GD.domestic;
    const hasDm = !!(dm && dm.gold_buy !== undefined && dm.silver_buy !== undefined);
    if (hasDm) {
      sectionTitle('💰', '오늘의 시세', null, '(골드바/실버바 기준, 1돈, 3.75g)');
      const gap2 = 18, tw2 = (W - 2 * P - gap2) / 2, th2 = 126;
      const money = (v, abs) => (v === null || v === undefined
        ? (abs ? '변동 ' + fInt(Number(abs)) + '원' : '')
        : (Number(v) > 0 ? '▲ +' : (Number(v) < 0 ? '▼ -' : '')) + fInt(Math.abs(Number(v))) + '원');
      const mcol = (v) => (v === null || v === undefined || Number(v) === 0 ? INF.mute : (Number(v) > 0 ? INF.up : INF.down));
      [['순금 살 때 (VAT 포함)', 'gold_buy', '#fff4d6', '#e8a600'], ['순금 팔 때', 'gold_sell', '#fff4d6', '#e8a600'],
       ['은 살 때 (VAT 포함)', 'silver_buy', '#eaf0f8', '#7488a6'], ['은 팔 때', 'silver_sell', '#eaf0f8', '#7488a6']].forEach((t, i) => {
        const x = P + (i % 2) * (tw2 + gap2), yy = y + Math.floor(i / 2) * (th2 + gap2);
        softCard(c, x, yy, tw2, th2, 26, t[2]);
        c.fillStyle = t[3]; c.fillRect(x, yy + 18, 6, th2 - 36);
        c.fillStyle = INF.mute; c.font = '700 20px ' + FONT; c.fillText(t[0], x + 24, yy + 40);
        const vtxt = fInt(Number(dm[t[1]]));
        c.fillStyle = INF.ink; c.font = '700 40px ' + FONT; c.fillText(vtxt, x + 24, yy + 92);
        const vw = c.measureText(vtxt).width;
        const chg = dm[t[1] + '_chg'];
        const mt2 = money(chg === undefined ? null : chg, dm[t[1] + '_abs']);
        if (mt2) { c.font = '700 24px ' + FONT; c.fillStyle = mcol(chg); c.fillText(mt2, x + 24 + vw + 14, yy + 92); }
      });
      y += 2 * th2 + 2 * gap2;
      const prevRow = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
      const fxv = prevRow && Number(prevRow.usdkrw) ? (Number(r.usdkrw) / Number(prevRow.usdkrw) - 1) * 100 : null;
      softCard(c, P, y, W - 2 * P, 110, 26, '#dcf5f1');
      c.fillStyle = '#14b8a6'; c.fillRect(P, y + 18, 6, 74);
      c.fillStyle = INF.mute; c.font = '700 20px ' + FONT; c.fillText('환율 (원/USD)', P + 24, y + 40);
      c.fillStyle = INF.ink; c.font = '700 40px ' + FONT; c.fillText(f2(Number(r.usdkrw)), P + 24, y + 88);
      if (fxv !== null) {
        const ftxt = (fxv > 0 ? '▲ ' : (fxv < 0 ? '▼ ' : '')) + fSign(fxv) + '%';
        const fcol = fxv > 0 ? INF.up : (fxv < 0 ? INF.down : INF.mute);
        c.font = '700 40px ' + FONT;
        const fvw = c.measureText(f2(Number(r.usdkrw))).width;
        c.font = '700 24px ' + FONT; c.fillStyle = fcol;
        c.fillText(ftxt, P + 24 + fvw + 14, y + 88);
      }
      y += 110 + 56;
    } else {
      sectionTitle('💰', '원화로 보는 오늘 시세', '1돈(3.75g) 기준 · 국제가 환산 · 최근 30일 흐름');
      const gap = 18, tw = (W - 2 * P - 2 * gap) / 3, th = 236;
      const dodT = (v) => (Number(v) > 0 ? '▲ ' : (Number(v) < 0 ? '▼ ' : '')) + fSign(Number(v)) + '%';
      [['금 (원/돈)', fInt(Number(r.gold_krw_don)), r.gold_krw_dod_pct, '#fff4d6', '#e8a600', 'gold_krw_don'],
       ['은 (원/돈)', fInt(Number(r.silver_krw_don)), r.silver_krw_dod_pct, '#eaf0f8', '#7488a6', 'silver_krw_don'],
       ['환율 (원/USD)', f2(Number(r.usdkrw)), null, '#dcf5f1', '#14b8a6', 'usdkrw']].forEach((t, i) => {
        const x = P + i * (tw + gap);
        softCard(c, x, y, tw, th, 26, t[3]);
        c.fillStyle = INF.mute; c.font = '700 20px ' + FONT; c.fillText(t[0], x + 24, y + 44);
        c.fillStyle = INF.ink; c.font = '700 40px ' + FONT; c.fillText(t[1], x + 24, y + 96);
        if (t[2] !== null) {
          const dv = Number(t[2]);
          const dc = dv > 0 ? INF.up : (dv < 0 ? INF.down : INF.mute);
          pill(c, dodT(t[2]) + ' 전일 대비', x + 24, y + 112, rgba(dc, 0.14), dc, '700 17px ' + FONT);
        } else {
          c.fillStyle = INF.mute; c.font = '600 18px ' + FONT; c.fillText('오늘 기준 환율', x + 24, y + 138);
        }
        spark(c, GD.rows, t[5], x + 24, y + 166, tw - 48, 44, t[4]);
      });
      y += th + 56;
    }

    // 시장 요인 (중심)
    sectionTitle('🔎', '오늘 시세를 움직인 이야기', '금·은 가격에 영향을 준 요인을 쉽게 풀었어요');
    let factors = GD.ana.filter((x) => x.kind === 'factor').sort((a, b) => Number(a.no) - Number(b.no));
    if (!factors.length) {
      factors = ['m1', 'm2', 'm3', 'm4'].map((id) => {
        const row = GD.ana.find((x) => x.id === id) || {};
        return { icon: '💬', title: row.title || '', summary: '', text: row.text || '', impact: 'flat', target: '' };
      });
    }
    factors.forEach((f) => {
      const tint = f.target === '금' ? INF.gold : (f.target === '은' ? INF.silver : INF.violet);
      const tx = P + 118, tmax = W - 2 * P - 118 - 28;
      c.font = '700 27px ' + FONT;
      const sl = wrapText(c, clean(f.summary), tmax);
      c.font = '600 22px ' + FONT;
      const dl = wrapText(c, clean(f.text), tmax);
      const ch = 30 + 46 + sl.length * 35 + dl.length * 29 + 34;
      softCard(c, P, y, W - 2 * P, ch, 26, '#ffffff');
      c.fillStyle = tint; rr(c, P, y + 22, 10, ch - 44, 5); c.fill();
      c.fillStyle = rgba(tint, 0.2); c.beginPath(); c.arc(P + 62, y + 66, 36, 0, Math.PI * 2); c.fill();
      c.font = '40px ' + EMOJI; c.fillStyle = INF.ink; c.textAlign = 'center'; c.fillText(f.icon || '•', P + 62, y + 80); c.textAlign = 'left';
      c.fillStyle = INF.ink; c.font = '700 26px ' + FONT; c.fillText(f.title, tx, y + 54);
      // 칩 (오른쪽 정렬)
      const imp = f.impact === 'up' ? ['▲ 상승 요인', INF.up] : (f.impact === 'down' ? ['▼ 하락 요인', INF.down] : ['● 중립', INF.mute]);
      c.font = '700 17px ' + FONT;
      const iw = c.measureText(imp[0]).width + 28;
      let cx = W - P - 24 - iw;
      pill(c, imp[0], cx, y + 28, rgba(imp[1], 0.13), imp[1], '700 17px ' + FONT);
      if (f.target) {
        const tw2 = c.measureText(f.target).width + 28;
        cx -= tw2 + 10;
        pill(c, f.target, cx, y + 28, rgba(tint, 0.2), '#3a2f63', '700 17px ' + FONT);
      }
      let ly = y + 76;
      c.fillStyle = INF.ink; c.font = '700 27px ' + FONT;
      sl.forEach((ln) => { ly += 35; drawRich(c, ln, tx, ly - 6, INF.ink); });
      c.fillStyle = INF.mute; c.font = '600 22px ' + FONT;
      dl.forEach((ln) => { ly += 29; drawRich(c, ln, tx, ly - 4, INF.mute); });
      y += ch + 24;
    });
    y += 28;

    // 국제 시세
    sectionTitle('🌍', '국제 시세', '단위 USD/온스 · 선물과 현물의 간격(괴리율)');
    const bw2 = (W - 2 * P - 24) / 2, bh = 312, EXI = 130;
    const prevI = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    ['gold', 'silver'].forEach((mt, i) => {
      const x = P + i * (bw2 + 24);
      softCard(c, x, y, bw2, bh, 26, mt === 'gold' ? '#fff4d6' : '#eaf0f8');
      if (mt === 'gold') coin(c, x + 58, y + 62, 32, '#f5b301', '#fff3c4', '금', '#8a5a00');
      else coin(c, x + 58, y + 62, 32, '#a9b8cf', '#eef2f8', '은', '#46546b');
      [[NAME[mt] + ' 선물', f2(Number(r[mt + '_fut'])), mt + '_fut'], [NAME[mt] + ' 현물', f2(Number(r[mt + '_spot'])), mt + '_spot']].forEach((p, k) => {
        const ry = y + 158 + k * 50;
        const lineX = x + bw2 - 28 - EXI;
        c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.textAlign = 'left'; c.fillText(p[0], x + 28, ry);
        c.fillStyle = INF.ink; c.font = '700 30px ' + FONT; c.textAlign = 'right'; c.fillText(p[1], lineX, ry + 2);
        const pv = prevI ? Number(prevI[p[2]]) : 0;
        if (pv) {
          const cv3 = (Number(r[p[2]]) / pv - 1) * 100;
          c.font = '700 18px ' + FONT;
          c.fillStyle = cv3 > 0 ? INF.up : (cv3 < 0 ? INF.down : INF.mute);
          c.textAlign = 'left';
          c.fillText((cv3 > 0 ? '▲ ' : (cv3 < 0 ? '▼ ' : '')) + fSign(cv3) + '%', lineX + 12, ry);
        }
      });
      c.textAlign = 'left';
      const sp = Number(r[mt + '_spread_pct']);
      const col = sp >= 0 ? INF.blue : INF.red;
      c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.fillText('선물·현물 괴리율', x + 28, y + 274);
      const st = sp >= 0 ? '콘탱고' : '백워데이션';
      const lineX2 = x + bw2 - 28 - EXI;
      pill(c, st, lineX2 + 12, y + 248, rgba(col, 0.14), col, '700 17px ' + FONT);
      c.font = '700 26px ' + FONT; c.fillStyle = col; c.textAlign = 'right';
      c.fillText(fSign(sp) + '%', lineX2, y + 276); c.textAlign = 'left';
    });
    y += bh + 56;

    // 체크포인트
    const cp = GD.ana.find((x) => x.kind === 'checkpoint');
    if (cp) {
      c.font = '700 26px ' + FONT;
      const tmax = W - 2 * P - 130 - 28;
      const sl = wrapText(c, clean(cp.summary), tmax);
      c.font = '600 22px ' + FONT;
      const dl = wrapText(c, clean(cp.text), tmax);
      const ch = 40 + sl.length * 34 + dl.length * 29 + 34;
      const cg = c.createLinearGradient(P, y, W - P, y + ch);
      cg.addColorStop(0, '#d5f5ef'); cg.addColorStop(1, '#e8e0ff');
      softCard(c, P, y, W - 2 * P, ch, 26, cg);
      c.font = '52px ' + EMOJI; c.fillStyle = INF.ink; c.fillText(cp.icon || '📌', P + 30, y + 78);
      c.fillStyle = '#0f766e'; c.font = '700 22px ' + FONT; c.fillText(cp.title, P + 110, y + 46);
      let ly = y + 46;
      c.fillStyle = INF.ink; c.font = '700 26px ' + FONT;
      sl.forEach((ln) => { ly += 34; drawRich(c, ln, P + 110, ly - 4, INF.ink); });
      c.fillStyle = INF.mute; c.font = '600 22px ' + FONT;
      dl.forEach((ln) => { ly += 29; drawRich(c, ln, P + 110, ly - 2, INF.mute); });
      y += ch + 52;
    }

    // 꼬리말
    c.fillStyle = INF.mute; c.font = '600 18px ' + FONT;
    wrapText(c, '시세 출처: investing.com (금·은 선물과 현물, 달러/원). ' + byId('n1') + (GD.sample ? ' 이 이미지는 샘플 데이터로 만든 예시입니다.' : ''), W - 2 * P)
      .forEach((ln) => { c.fillText(ln, P, y + 20); y += 23; });
    y += 40;
    const fg = c.createLinearGradient(0, y, W, y);
    fg.addColorStop(0, '#2e1f7a'); fg.addColorStop(0.62, '#6d3fd1'); fg.addColorStop(1, '#d08a1d');
    c.fillStyle = fg; c.fillRect(0, y, W, 14);
    y += 14;
    if (hint) { tall.cssHeight = y; return tall; }
    const out = document.createElement('canvas');
    out.width = Math.round(W * dpr); out.height = Math.max(1, Math.round(y * dpr));
    out.getContext('2d').drawImage(tall, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
    out.cssHeight = y;
    return out;
  }
  /* 먼저 작은 배율로 전체 길이를 재고, 그 길이에 딱 맞는 고해상도 캔버스에 다시 그린다 (메모리 절약) */
  function infographicCanvas(want) {
    const m = buildInfographic(0.2);
    const H = Math.ceil(m.cssHeight);
    for (let w = want; w >= 1.25; w *= 0.8) {
      try { return buildInfographic(w, H); } catch (e) { /* 너무 크면 배율을 낮춰 다시 */ }
    }
    return buildInfographic(1, H);
  }
  /* ---------- 웹툰 스타일 (데이터로 매번 새로 그림) ---------- */
  const TOON = '"Jua", ' + FONT;
  const INK = '#1a1a1a';
  function pth(c, d, fill, stroke, lw) {
    const p = new Path2D(d);
    if (fill) { c.fillStyle = fill; c.fill(p); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(p); }
  }
  function cir(c, x, y, r, fill, stroke, lw) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function ell(c, x, y, rx, ry, fill, stroke, lw) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  function box(c, x, y, w, h, r, fill, stroke, lw) {
    rr(c, x, y, w, h, r || 0);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
  }
  function poly(c, pts, fill, stroke, lw) {
    c.beginPath(); pts.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
  }
  function txt(c, s, x, y, font, color, align) {
    c.font = font; c.fillStyle = color; c.textAlign = align || 'left'; c.fillText(s, x, y); c.textAlign = 'left';
  }

  /* 캐릭터와 소품: 좌표는 시안(SVG)과 같고 w로 크기만 맞춘다 */
  function coinArt(c, x, y, w, kind, expr, arms) {
    const gold = kind === 'gold';
    const base = gold ? '#f6c32d' : '#cfd8e3', ring = gold ? '#d99a0b' : '#9aa8ba', tone = gold ? '#8a5a00' : '#46546b';
    c.save(); c.translate(x, y); c.scale(w / 200, w / 200); c.translate(10, 0);
    pth(c, 'M74 154 v18 M106 154 v18', null, INK, 6);
    ell(c, 70, 175, 12, 5, INK); ell(c, 110, 175, 12, 5, INK);
    if (arms === 'wave') {
      pth(c, 'M32 104 q-16 14 -10 34 M148 100 q22 -6 24 -36', null, INK, 6);
      cir(c, 22, 138, 9, base, INK, 4); cir(c, 172, 58, 10, base, INK, 4);
    } else if (arms === 'up') {
      pth(c, 'M32 100 q-20 -10 -18 -40 M148 100 q20 -10 18 -40', null, INK, 6);
      cir(c, 14, 56, 10, base, INK, 4); cir(c, 166, 56, 10, base, INK, 4);
    } else {
      pth(c, 'M32 104 q-16 14 -10 34 M148 104 q16 14 10 34', null, INK, 6);
      cir(c, 22, 138, 9, base, INK, 4); cir(c, 158, 138, 9, base, INK, 4);
    }
    cir(c, 90, 96, 60, base, INK, 5);
    c.setLineDash([2, 7]); cir(c, 90, 96, 47, null, ring, 3); c.setLineDash([]);
    pth(c, 'M52 66 A44 44 0 0 1 80 46', null, 'rgba(255,255,255,0.7)', 6);
    txt(c, gold ? '금' : '은', 90, 72, '900 22px ' + TOON, tone, 'center');
    ell(c, 52, 118, 9, 5, 'rgba(255,143,163,0.75)'); ell(c, 128, 118, 9, 5, 'rgba(255,143,163,0.75)');
    if (expr === 'proud') {
      pth(c, 'M60 104 q10 -14 20 0 M100 104 q10 -14 20 0', null, INK, 5);
      pth(c, 'M70 118 q20 24 40 0 z', '#7a1f1f', INK, 4);
    } else if (expr === 'sweat') {
      ell(c, 70, 102, 7, 10, INK); ell(c, 110, 102, 7, 10, INK);
      pth(c, 'M58 84 l20 6 M122 84 l-20 6', null, INK, 5);
      pth(c, 'M72 128 q9 -8 18 0 q9 8 18 0', null, INK, 5);
      pth(c, 'M146 50 q10 16 0 24 q-10 -8 0 -24z', '#7cc8ff', INK, 3);
    } else if (expr === 'shock') {
      cir(c, 70, 98, 12, '#fff', INK, 4); cir(c, 110, 98, 12, '#fff', INK, 4);
      cir(c, 70, 98, 4, INK); cir(c, 110, 98, 4, INK);
      ell(c, 90, 132, 9, 12, '#7a1f1f', INK, 4);
    } else {
      ell(c, 70, 100, 7, 10, INK); ell(c, 110, 100, 7, 10, INK);
      cir(c, 72, 96, 2.5, '#fff'); cir(c, 112, 96, 2.5, '#fff');
      pth(c, 'M72 122 q18 16 36 0', null, INK, 5);
    }
    c.restore();
  }
  function dollarArt(c, x, y, w, strong) {
    c.save(); c.translate(x, y); c.scale(w / 260, w / 260); c.translate(14, -20);
    pth(c, 'M85 140 v32 M135 140 v32', null, INK, 6); ell(c, 80, 175, 14, 5, INK); ell(c, 140, 175, 14, 5, INK);
    if (strong) {
      pth(c, 'M25 110 q-30 -10 -22 -50 M195 110 q30 -10 22 -50', null, INK, 7);
      cir(c, 3, 58, 14, '#6cc48a', INK, 5); cir(c, 217, 58, 14, '#6cc48a', INK, 5);
    } else {
      pth(c, 'M25 110 q-14 20 -10 40 M195 110 q14 20 10 40', null, INK, 7);
      cir(c, 15, 150, 14, '#6cc48a', INK, 5); cir(c, 205, 150, 14, '#6cc48a', INK, 5);
    }
    c.translate(110, 100); c.rotate(-6 * Math.PI / 180); c.translate(-110, -100);
    box(c, 25, 40, 170, 100, 10, '#6cc48a', INK, 5);
    c.setLineDash([3, 6]); box(c, 38, 52, 144, 76, 6, null, '#2f7d4d', 3); c.setLineDash([]);
    cir(c, 110, 100, 26, '#8fdcab', '#2f7d4d', 3);
    txt(c, '$', 110, 112, '900 34px ' + TOON, '#1f6b3d', 'center');
    if (strong) { pth(c, 'M62 62 l26 8 M158 62 l-26 8', null, INK, 6); pth(c, 'M92 132 q18 10 36 0', null, INK, 5); }
    else { pth(c, 'M62 70 l26 -8 M158 70 l-26 -8', null, INK, 6); pth(c, 'M92 140 q18 -10 36 0', null, INK, 5); pth(c, 'M170 56 q8 12 0 18 q-8 -6 0 -18z', '#7cc8ff', INK, 3); }
    cir(c, 78, 82, 6, INK); cir(c, 142, 82, 6, INK);
    c.restore();
  }
  function bankArt(c, x, y, w, label) {
    c.save(); c.translate(x, y); c.scale(w / 200, w / 200);
    poly(c, [[100, 20], [185, 70], [15, 70]], '#c7b8ff', INK, 5);
    box(c, 22, 72, 156, 16, 0, '#9f8cf2', INK, 5);
    [36, 72, 108, 144].forEach((cx) => box(c, cx, 92, 22, 66, 0, '#efeaff', INK, 4));
    box(c, 12, 158, 176, 22, 0, '#9f8cf2', INK, 5);
    cir(c, 80, 54, 5, INK); cir(c, 120, 54, 5, INK);
    pth(c, 'M68 42 l20 7 M132 42 l-20 7', null, INK, 5); pth(c, 'M86 62 h28', null, INK, 4);
    txt(c, label || '연준', 100, 85, '900 13px ' + TOON, INK, 'center');
    c.restore();
  }
  function shieldArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 140, w / 140);
    pth(c, 'M70 8 L128 28 V76 C128 112 100 140 70 154 C40 140 12 112 12 76 V28 Z', '#7fb2ff', INK, 5);
    pth(c, 'M70 26 L112 40 V76 C112 102 92 124 70 136 C48 124 28 102 28 76 V40 Z', '#bcd7ff', INK, 3);
    pth(c, 'M48 80 l16 16 l30 -34', null, INK, 9);
    c.restore();
  }
  function cloudArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 200, w / 200);
    pth(c, 'M30 70 a26 26 0 0 1 50 -10 a30 30 0 0 1 58 6 a22 22 0 0 1 -4 44 h-96 a22 22 0 0 1 -8 -40z', '#5d6b82', INK, 5);
    pth(c, 'M96 108 l-12 26 h14 l-8 24 l28 -34 h-16 l10 -16 z', '#ffe45c', INK, 3);
    c.restore();
  }
  function factoryArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 220, w / 220);
    box(c, 150, 22, 26, 70, 0, '#d9d2c5', INK, 5);
    cir(c, 164, 12, 10, '#fff', INK, 4); cir(c, 184, 0, 8, '#fff', INK, 4);
    box(c, 20, 80, 150, 80, 0, '#ffb27a', INK, 5);
    poly(c, [[20, 80], [20, 48], [62, 80], [62, 48], [104, 80], [104, 48], [146, 80], [146, 48], [170, 80]], '#ff9a55', INK, 5);
    [38, 80, 122].forEach((wx) => box(c, wx, 100, 28, 22, 0, '#bfe3ff', INK, 4));
    cir(c, 100, 146, 14, '#fff', INK, 4); cir(c, 100, 146, 5, INK);
    c.restore();
  }
  /* deg > 0: 왼쪽(선물) 접시가 내려감, deg < 0: 오른쪽(현물) 접시가 내려감. 접시 아래 가운데 좌표를 돌려준다 */
  function scaleArt(c, x, y, w, deg) {
    const s = w / 300, rad = (deg || 0) * Math.PI / 180;
    const px = 150, py = 56, half = 100;
    const lx = px - half * Math.cos(rad), ly = py + half * Math.sin(rad);
    const rx = px + half * Math.cos(rad), ry = py - half * Math.sin(rad);
    c.save(); c.translate(x, y); c.scale(s, s);
    box(c, 140, 56, 20, 118, 0, '#b8c0cc', INK, 5);
    pth(c, 'M96 178 h108 v14 h-108 z', '#8a93a3', INK, 5);
    pth(c, 'M' + lx + ' ' + ly + ' L' + rx + ' ' + ry, null, INK, 9);
    cir(c, 150, 56, 12, '#f6c32d', INK, 5);
    [[lx, ly, '#ffd66b'], [rx, ry, '#bfe3ff']].forEach((p) => {
      c.save(); c.translate(p[0], p[1] + 4);
      pth(c, 'M0 0 L-40 70 M0 0 L40 70', null, INK, 4);
      pth(c, 'M-52 70 h104 q-8 30 -52 30 q-44 0 -52 -30 z', p[2], INK, 5);
      c.restore();
    });
    c.restore();
    return { left: { x: x + lx * s, y: y + (ly + 104) * s }, right: { x: x + rx * s, y: y + (ry + 104) * s } };
  }
  /* 등락률에 따른 화살표 기울기: 3% 이상 30도, 1% 이하 15도, 그 사이는 비례 */
  function slopeDeg(pct) {
    const a = Math.abs(pct);
    if (a >= 3) return 30;
    if (a <= 1) return 15;
    return 15 + ((a - 1) / 2) * 15;
  }
  /* 곡선 화살표(배경). 꼬리는 가늘고 머리 쪽으로 갈수록 굵어지는 휘어진 화살표.
     (cx, cy)가 화살표 전체의 한가운데, L은 가로 길이. 모양은 고정이고 방향·색만 바뀐다:
     오르면 빨강으로 왼쪽 아래에서 오른쪽 위로, 내리면 파랑으로 왼쪽 위에서 오른쪽 아래로 */
  function curvedArrow(c, cx, cy, up, L) {
    const H = L * 0.48, headL = L * 0.24, headW = L * 0.3, maxW = L * 0.115;
    const col = up ? INF.up : INF.down;
    const th = 60 * Math.PI / 180;
    const u = [Math.cos(th), -Math.sin(th)];                 // 끝에서의 진행 방향(오른쪽 위 60도)
    const tip = [cx + L / 2, cy - H / 2];
    const E = [tip[0] - u[0] * headL, tip[1] - u[1] * headL];    // 화살촉 밑변의 가운데
    const p0 = [cx - L / 2, cy + H / 2];
    const sd = (p0[1] - E[1]) / -u[1];                           // 시작 부분이 거의 수평이 되도록 제어점 거리를 계산
    const cp = [E[0] - u[0] * sd, E[1] - u[1] * sd];
    const flip = (p) => [p[0], up ? p[1] : 2 * cy - p[1]];
    const N = 48, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, mt = 1 - t;
      const x = mt * mt * p0[0] + 2 * mt * t * cp[0] + t * t * E[0];
      const y = mt * mt * p0[1] + 2 * mt * t * cp[1] + t * t * E[1];
      const dx = 2 * mt * (cp[0] - p0[0]) + 2 * t * (E[0] - cp[0]);
      const dy = 2 * mt * (cp[1] - p0[1]) + 2 * t * (E[1] - cp[1]);
      const dl = Math.hypot(dx, dy) || 1;
      const w = 1.2 + (maxW / 2 - 1.2) * Math.pow(t, 1.7);
      left.push([x - (dy / dl) * w, y + (dx / dl) * w]);
      right.push([x + (dy / dl) * w, y - (dx / dl) * w]);
    }
    const body = left.concat(right.reverse()).map(flip);
    const nrm = [-u[1], u[0]];
    const head = [tip, [E[0] + nrm[0] * headW / 2, E[1] + nrm[1] * headW / 2], [E[0] - nrm[0] * headW / 2, E[1] - nrm[1] * headW / 2]].map(flip);
    c.save();
    c.fillStyle = rgba(col, 0.88);
    c.beginPath();
    body.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
    c.closePath(); c.fill();
    c.beginPath();
    head.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
    c.closePath(); c.fill();
    c.restore();
  }
  /* 등락 방향으로만 그린다 (기울기는 등락률과 무관). 변동이 거의 없으면 그리지 않는다 */
  function pctArrow(c, cx, cy, L, pct) {
    if (pct === null || pct === undefined || !(Math.abs(pct) >= 0.005)) return;
    curvedArrow(c, cx, cy, pct > 0, L);
  }
  /* 증감 수치를 캐릭터 옆에: 오르면 왼쪽, 내리면 오른쪽 */
  function sideLabel(c, pct, leftX, rightX, y) {
    if (pct === null || pct === undefined || !(Math.abs(pct) >= 0.005)) return;
    const col = pct > 0 ? INF.up : INF.down;
    c.save();
    c.font = '900 46px ' + TOON; c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = '#ffffff';
    c.textAlign = pct > 0 ? 'right' : 'left';
    const x = pct > 0 ? leftX : rightX;
    c.strokeText(fSign(pct) + '%', x, y);
    c.fillStyle = col; c.fillText(fSign(pct) + '%', x, y);
    c.restore();
  }

  /* ---- 요인 그림 소품 (200x200 안에 그리고 s로 크기를 맞춘다) ---- */
  function iconBox(c, cx, cy, s, fn) {
    c.save(); c.translate(cx - s / 2, cy - s / 2); c.scale(s / 200, s / 200); fn(); c.restore();
  }
  function goldBarArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 180, w / 180);
    poly(c, [[0, 62], [28, 10], [152, 10], [180, 62]], '#f6c32d', INK, 5);
    pth(c, 'M34 24 H120', null, 'rgba(255,255,255,0.75)', 6);
    txt(c, '999.9', 90, 50, '900 18px ' + TOON, '#8a5a00', 'center');
    c.restore();
  }
  function iconGoldBars(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      goldBarArt(c, 40, 20, 120); goldBarArt(c, 10, 96, 110); goldBarArt(c, 90, 96, 110);
    });
  }
  function iconJewelry(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      cir(c, 100, 130, 52, null, INK, 28);
      cir(c, 100, 130, 52, null, '#f6c32d', 17);
      poly(c, [[100, 8], [142, 32], [126, 74], [74, 74], [58, 32]], '#9fe3ff', INK, 5);
      pth(c, 'M58 32 H142 M100 8 L82 32 L100 74 L118 32 M82 32 L74 74 M118 32 L126 74', null, INK, 3);
      pth(c, 'M170 44 v24 M158 56 h24 M28 74 v18 M19 83 h18', null, '#f6c32d', 6);
    });
  }
  function iconBag(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      box(c, 28, 76, 144, 112, 14, '#ff8aa1', INK, 5);
      poly(c, [[60, 78], [76, 44], [124, 44], [140, 78]], '#f6c32d', INK, 5);
      pth(c, 'M84 56 h32', null, 'rgba(255,255,255,0.75)', 5);
      pth(c, 'M72 80 v-10 a28 28 0 0 1 56 0 v10', null, INK, 7);
      pth(c, 'M60 130 q40 26 80 0', null, '#fff', 6);
    });
  }
  function iconCentralBank(c, cx, cy, s) {
    bankArt(c, cx - s / 2, cy - s / 2 - 6, s, '중앙은행');
    goldBarArt(c, cx - s * 0.5, cy + s * 0.3, s * 0.36);
    goldBarArt(c, cx + s * 0.14, cy + s * 0.3, s * 0.36);
  }
  function iconShield(c, cx, cy, s) {
    shieldArt(c, cx - s * 0.36, cy - s * 0.42, s * 0.72);
  }
  function iconDataCenter(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      [0, 1, 2].forEach((i) => {
        box(c, 36, 20 + i * 56, 128, 48, 8, '#cfd8e3', INK, 5);
        cir(c, 58, 44 + i * 56, 6, i === 1 ? '#ef4444' : '#22c55e');
        pth(c, 'M80 36 h64 M80 52 h64', null, '#7488a6', 4);
      });
      box(c, 26, 188, 148, 8, 3, '#8a93a3', INK, 3);
    });
  }
  function iconChip(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      for (let i = 0; i < 4; i++) {
        box(c, 56 + i * 28, 16, 10, 24, 2, '#9aa8ba', INK, 3); box(c, 56 + i * 28, 160, 10, 24, 2, '#9aa8ba', INK, 3);
        box(c, 16, 56 + i * 28, 24, 10, 2, '#9aa8ba', INK, 3); box(c, 160, 56 + i * 28, 24, 10, 2, '#9aa8ba', INK, 3);
      }
      box(c, 36, 36, 128, 128, 16, '#2f3b52', INK, 5);
      box(c, 64, 64, 72, 72, 8, '#5b6b8c', INK, 3);
      pth(c, 'M74 100 h52 M100 74 v52', null, '#bcd7ff', 4);
    });
  }
  function iconPhone(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      box(c, 62, 22, 76, 156, 16, '#334155', INK, 5);
      box(c, 70, 40, 60, 112, 6, '#bfe3ff', INK, 3);
      cir(c, 100, 165, 5, '#94a3b8');
      pth(c, 'M150 76 a28 28 0 0 1 0 40 M166 62 a48 48 0 0 1 0 68 M50 76 a28 28 0 0 0 0 40 M34 62 a48 48 0 0 0 0 68', null, INK, 6);
    });
  }
  function iconAI(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      pth(c, 'M100 30 v-16', null, INK, 5); cir(c, 100, 12, 7, '#ff6b6b', INK, 3);
      box(c, 18, 70, 18, 44, 6, '#9aa8ba', INK, 4); box(c, 164, 70, 18, 44, 6, '#9aa8ba', INK, 4);
      box(c, 36, 30, 128, 116, 24, '#cfd8e3', INK, 5);
      cir(c, 72, 88, 14, '#7dd3fc', INK, 4); cir(c, 128, 88, 14, '#7dd3fc', INK, 4);
      txt(c, 'AI', 100, 64, '900 22px ' + TOON, INK, 'center');
      box(c, 68, 114, 64, 20, 6, '#fff', INK, 4);
      pth(c, 'M84 114 v20 M100 114 v20 M116 114 v20', null, INK, 3);
      box(c, 60, 150, 80, 38, 10, '#9aa8ba', INK, 4);
    });
  }
  function iconSolar(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      cir(c, 152, 40, 22, '#ffd400', INK, 4);
      pth(c, 'M152 6 v10 M152 64 v10 M118 40 h10 M176 40 h10 M128 16 l7 7 M169 57 l7 7 M176 16 l-7 7', null, '#ffd400', 5);
      poly(c, [[24, 176], [176, 176], [150, 84], [50, 84]], '#3b5b9a', INK, 5);
      pth(c, 'M62 130 H164 M43 156 H170 M100 84 L88 176 M126 84 L132 176', null, '#bcd7ff', 4);
    });
  }
  function starPts(cx, cy, ro, ri, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n, r = i % 2 ? ri : ro;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  function iconWar(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      poly(c, starPts(128, 118, 78, 40, 8), '#ff9a3c', INK, 5);
      poly(c, starPts(128, 118, 42, 18, 8), '#ffe45c', INK, 3);
      c.save(); c.translate(62, 66); c.rotate(Math.PI / 5);
      poly(c, [[-46, -12], [18, -12], [44, 0], [18, 12], [-46, 12]], '#cfd8e3', INK, 5);
      poly(c, [[-46, -12], [-62, -28], [-30, -12]], '#ef4444', INK, 4);
      poly(c, [[-46, 12], [-62, 28], [-30, 12]], '#ef4444', INK, 4);
      poly(c, [[18, -12], [44, 0], [18, 12]], '#ef4444', INK, 4);
      c.restore();
    });
  }
  function iconSupply(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      const cols = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7'];
      [[30, 92], [70, 92], [110, 92], [150, 92], [50, 58], [90, 58], [130, 58]].forEach((q, i) => box(c, q[0], q[1], 36, 30, 3, cols[i % 5], INK, 4));
      poly(c, [[12, 126], [188, 126], [164, 170], [36, 170]], '#334155', INK, 5);
      pth(c, 'M8 184 q20 -12 40 0 t40 0 t40 0 t40 0 t40 0', null, '#7cc8ff', 6);
    });
  }
  function iconStock(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      box(c, 12, 18, 176, 164, 14, '#ffffff', INK, 5);
      [[36, 102, 48, '#2563eb'], [68, 72, 40, '#dc2626'], [100, 88, 46, '#2563eb'], [132, 54, 62, '#dc2626']].forEach((q) => {
        pth(c, 'M' + (q[0] + 10) + ' ' + (q[1] - 16) + ' v' + (q[3] + 32), null, INK, 4);
        box(c, q[0], q[1], 20, q[2], 2, q[3], INK, 3);
      });
      pth(c, 'M28 156 L72 122 L106 134 L172 50', null, '#f59e0b', 5);
    });
  }
  function iconRate(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      cir(c, 96, 104, 80, '#c7b8ff', INK, 6);
      txt(c, '%', 96, 136, '900 100px ' + TOON, INK, 'center');
      poly(c, [[150, 44], [178, 44], [164, 18]], '#dc2626', INK, 3);
      poly(c, [[150, 62], [178, 62], [164, 88]], '#2563eb', INK, 3);
    });
  }
  function iconJobs(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      box(c, 24, 76, 140, 96, 14, '#a0674b', INK, 5);
      pth(c, 'M68 76 v-16 a8 8 0 0 1 8 -8 h36 a8 8 0 0 1 8 8 v16', null, INK, 8);
      pth(c, 'M24 120 H164', null, INK, 4);
      box(c, 84, 110, 20, 22, 4, '#f6c32d', INK, 4);
      cir(c, 160, 62, 26, '#22c55e', INK, 4);
      pth(c, 'M148 62 l9 9 l17 -19', null, '#ffffff', 7);
    });
  }
  function iconCPI(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      poly(c, [[52, 76], [176, 76], [160, 132], [68, 132]], '#ffd0a8', INK, 5);
      pth(c, 'M12 44 H40 L68 132 H160', null, INK, 8);
      cir(c, 88, 58, 16, '#ef4444', INK, 4);
      box(c, 118, 46, 32, 30, 5, '#f59e0b', INK, 4);
      cir(c, 86, 162, 14, '#334155', INK, 4); cir(c, 142, 162, 14, '#334155', INK, 4);
      poly(c, [[146, 6], [192, 6], [192, 36], [146, 36], [132, 21]], '#ffffff', INK, 4);
      txt(c, '↑', 166, 30, '900 24px ' + TOON, '#dc2626', 'center');
    });
  }
  function iconPPI(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      factoryArt(c, 6, 50, 176);
      poly(c, [[132, 6], [188, 6], [188, 42], [132, 42], [118, 24]], '#ffffff', INK, 4);
      txt(c, '₩', 162, 34, '900 26px ' + TOON, INK, 'center');
    });
  }
  function iconFed(c, cx, cy, s) {
    bankArt(c, cx - s / 2, cy - s / 2, s, '연준');
  }
  function iconDollarBill(c, cx, cy, s) {
    iconBox(c, cx, cy, s, () => {
      box(c, 12, 54, 176, 92, 10, '#6cc48a', INK, 5);
      cir(c, 100, 100, 28, '#8fdcab', '#2f7d4d', 3);
      txt(c, '$', 100, 112, '900 34px ' + TOON, '#1f6b3d', 'center');
      cir(c, 38, 100, 8, '#8fdcab', '#2f7d4d', 2); cir(c, 162, 100, 8, '#8fdcab', '#2f7d4d', 2);
    });
  }
  /* 분석 글에 나온 단어 → 그림. 앞쪽일수록 먼저 고른다 */
  const TOPICS = [
    { k: 'fed', re: /연준|FOMC|Fed|파월/, draw: iconFed, tag: '연준' },
    { k: 'jobs', re: /고용|일자리|실업|비농업|취업/, draw: iconJobs, tag: '고용' },
    { k: 'ppi', re: /생산자물가|PPI/, draw: iconPPI, tag: '생산자물가' },
    { k: 'cpi', re: /소비자물가|CPI|물가|인플레/, strip: /생산자물가/g, draw: iconCPI, tag: '소비자물가' },
    { k: 'rate', re: /금리|국채/, draw: iconRate, tag: '금리' },
    { k: 'dollar', re: /달러|환율/, draw: iconDollarBill, tag: '달러' },
    { k: 'war', re: /전쟁|분쟁|지정학|중동|우크라이나|미사일|군사|휴전/, draw: iconWar, tag: '전쟁' },
    { k: 'supply', re: /공급망|공급 ?차질|물류|해운|운송|병목/, draw: iconSupply, tag: '공급망' },
    { k: 'stock', re: /증권|증시|주식|코스피|나스닥|다우|주가/, draw: iconStock, tag: '증권' },
    { k: 'jewelry', re: /장신구|주얼리|귀금속|보석|혼수|결혼/, draw: iconJewelry, tag: '장신구 수요' },
    { k: 'retail', re: /소매|리테일|개인|실물|금은방|골드바|인도|중국/, draw: iconBag, tag: '소매 매수' },
    { k: 'central', re: /중앙은행|외환보유|각국 중앙/, draw: iconCentralBank, tag: '중앙은행 매수' },
    { k: 'shield', re: /안전|불안|위험 ?회피/, draw: iconShield, tag: '안전자산' },
    { k: 'ai', re: /AI|인공지능/, draw: iconAI, tag: 'AI' },
    { k: 'datacenter', re: /데이터 ?센터|서버|클라우드/, draw: iconDataCenter, tag: '데이터센터' },
    { k: 'chip', re: /반도체|칩|HBM|파운드리/, draw: iconChip, tag: '반도체' },
    { k: 'phone', re: /통신|5G|6G|스마트폰|기지국|휴대폰|전자/, draw: iconPhone, tag: '통신기기' },
    { k: 'solar', re: /태양광|솔라|태양전지|친환경/, draw: iconSolar, tag: '태양광' },
  ];
  function topicHit(t, text) {
    return t.re.test(t.strip ? String(text).replace(t.strip, '') : text);
  }
  function pickTopics(text, keys, max) {
    return keys.map((k) => TOPICS.find((t) => t.k === k)).filter((t) => t && topicHit(t, text))
      .slice(0, max).map((t) => ({ draw: t.draw, tag: t.tag }));
  }
  function iconTag(c, cx, y, text, size) {
    const sz = size || 22;
    c.font = '900 ' + sz + 'px ' + TOON;
    const w = c.measureText(text).width + 28;
    box(c, cx - w / 2, y, w, sz + 18, 0, '#ffe45c', INK, 4);
    txt(c, text, cx, y + sz + 7, '900 ' + sz + 'px ' + TOON, INK, 'center');
  }
  /* 달러·금리 컷: 캐릭터 양옆에 글에 나온 거시 이슈 그림을 작게 놓는다 (왼쪽 2, 오른쪽 2) */
  function macroProps(c, ox, oy, f, keys) {
    const items = pickTopics([f.title, f.summary, f.text].join(' '), keys, 4);
    const xs = [75, 555, 195, 675];
    items.forEach((it, i) => {
      it.draw(c, ox + xs[i], oy + 312, 84);
      iconTag(c, ox + xs[i], oy + 358, it.tag, 17);
    });
  }
  /* 아이콘 1~3개를 가로로 나란히 놓고 이름표를 붙인다 */
  function iconRow(c, ox, oy, items, size) {
    const n = items.length;
    const xs = n === 1 ? [375] : (n === 2 ? [250, 500] : (n === 3 ? [135, 375, 615] : [100, 290, 480, 670]));
    const sz = n >= 4 ? Math.min(size, 150) : size;
    items.forEach((it, i) => {
      it.draw(c, ox + xs[i], oy + 190, sz);
      iconTag(c, ox + xs[i], oy + 316, it.tag);
    });
  }
  function calendarArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 200, w / 200);
    box(c, 20, 34, 160, 150, 14, '#fff', INK, 5);
    pth(c, 'M20 78 V48 a14 14 0 0 1 14 -14 H166 a14 14 0 0 1 14 14 V78 Z', '#ff6b6b', INK, 5);
    box(c, 56, 20, 12, 28, 4, INK); box(c, 132, 20, 12, 28, 4, INK);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) box(c, 38 + k * 34, 96 + r * 28, 24, 18, 3, '#dfe3ea');
    pth(c, 'M64 140 l22 22 l54 -56', null, '#16a34a', 12);
    c.restore();
  }

  /* 말풍선·상자·글씨 */
  function paras(c, text, maxW) {
    const out = [];
    String(text).split(/<br>|\n/).forEach((p) => wrapText(c, p, maxW).forEach((l) => out.push(l)));
    return out;
  }
  const RICH_SPLIT = /(\(변동 [\d,]+원\)|\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/;
  function richFont(baseFont, p, i) {
    return i % 2 && p.charAt(0) === '(' ? scaledFont(baseFont, 0.6) : baseFont;
  }
  function richWidth(c, line) {
    const baseFont = c.font;
    let total = 0;
    String(line).split(RICH_SPLIT).forEach((p, i) => {
      if (!p) return;
      c.font = richFont(baseFont, p, i);
      total += c.measureText(p).width;
    });
    c.font = baseFont;
    return total;
  }
  function richCentered(c, line, cx, y, base) {
    const baseFont = c.font;
    const parts = String(line).split(RICH_SPLIT);
    let x = cx - richWidth(c, line) / 2;
    parts.forEach((p, i) => {
      if (!p) return;
      let col = base;
      if (i % 2) {
        if (p.indexOf('(변동') === 0) {
          col = INF.mute;
        } else {
          const v = parseFloat(p.replace(/[(),]/g, '').replace('−', '-'));
          const st = stateAfter(parts, i);
          col = st === 'conta' ? INF.conta : (st === 'back' ? INF.back : (v > 0 ? INF.up : (v < 0 ? INF.down : base)));
        }
      }
      c.font = richFont(baseFont, p, i);
      c.fillStyle = col;
      c.textAlign = 'left'; c.fillText(p, x, y); x += c.measureText(p).width;
    });
    c.font = baseFont;
  }
  /* opts.nowrap: <br>로만 줄을 나누고, 가장 긴 줄에 맞춰 말풍선 폭을 늘린다 (시세 옆에 증감을 한 줄로 붙이기 위함) */
  function bubbleDraw(c, ox, oy, text, l, t, w, tail, size, opts) {
    c.font = '900 ' + size + 'px ' + TOON;
    const o = opts || {};
    let lines;
    if (o.nowrap) {
      lines = String(text).split(/<br>|\n/);
      const need = Math.max.apply(null, lines.map((ln) => richWidth(c, ln))) + 56;
      const cx0 = l + w / 2;
      w = Math.min(Math.max(need, w), 720);
      l = Math.max(10, Math.min(cx0 - w / 2, 740 - w));
    } else {
      lines = paras(c, text, w - 48);
    }
    const lh = size * 1.3, h = lines.length * lh + 36;
    const x = ox + l, y = oy + t;
    box(c, x, y, w, h, 30, '#fff', INK, 4);
    c.font = '900 ' + size + 'px ' + TOON;
    lines.forEach((ln, i) => richCentered(c, ln, x + w / 2, y + 18 + (i + 1) * lh - size * 0.22, INK));
    const left = tail === 'dl' || tail === 'ul', down = tail === 'dl' || tail === 'dr';
    const bx = left ? x + 44 : x + w - 44 - 40, by = down ? y + h : y;
    const tip = [left ? bx - 10 : bx + 50, by + (down ? 26 : -26)];
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(bx, by + (down ? -2 : 2)); c.lineTo(tip[0], tip[1]); c.lineTo(bx + 40, by + (down ? -2 : 2)); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 4; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(bx, by); c.lineTo(tip[0], tip[1]); c.lineTo(bx + 40, by); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(bx + 3, by); c.lineTo(bx + 37, by); c.stroke();
    return h;
  }
  function narrDraw(c, ox, oy, text, size, unit) {
    const sz = size || 26;
    const usz = Math.round(sz * 6) / 10;
    c.font = '900 ' + sz + 'px ' + TOON;
    const w1 = c.measureText(text).width;
    let w2 = 0;
    if (unit) { c.font = '900 ' + usz + 'px ' + TOON; w2 = c.measureText(unit).width + 6; }
    box(c, ox + 18, oy + 18, w1 + w2 + 32, 50, 0, '#ffe45c', INK, 4);
    txt(c, text, ox + 34, oy + 52, '900 ' + sz + 'px ' + TOON, INK);
    if (unit) txt(c, unit, ox + 34 + w1 + 6, oy + 52, '900 ' + usz + 'px ' + TOON, INK);
  }
  function sfxDraw(c, ox, oy, text, l, t, rot, size, color) {
    c.save(); c.translate(ox + l, oy + t + size); c.rotate(rot * Math.PI / 180);
    c.font = '900 ' + size + 'px ' + TOON; c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = INK;
    c.strokeText(text, 0, 0); c.fillStyle = color || '#ffd400'; c.fillText(text, 0, 0);
    c.restore();
  }
  function chipDraw(c, x, y, text, kind) {
    const bg = { up: INF.up, down: INF.down, flat: '#4b5563', metal: '#7c3aed' }[kind];
    c.font = '800 24px ' + TOON;
    const w = c.measureText(text).width + 32;
    box(c, x, y, w, 44, 22, bg, INK, 3);
    txt(c, text, x + 16, y + 31, '800 24px ' + TOON, '#fff');
    return w;
  }

  /* 컷 배경 */
  function bgDots(c, x, y, w, h, color) {
    c.fillStyle = color; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let gy = y + 8; gy < y + h; gy += 16) for (let gx = x + 8; gx < x + w; gx += 16) { c.beginPath(); c.arc(gx, gy, 2, 0, Math.PI * 2); c.fill(); }
  }
  function bgFocus(c, x, y, w, h, color, cxp, cyp, a) {
    c.fillStyle = color; c.fillRect(x, y, w, h);
    const cx = x + w * cxp, cy = y + h * cyp, R = 1600;
    c.fillStyle = 'rgba(0,0,0,' + a + ')';
    for (let k = 0; k < 30; k++) {
      const a0 = (k * 12) * Math.PI / 180, a1 = (k * 12 + 6) * Math.PI / 180;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * Math.cos(a0), cy + R * Math.sin(a0)); c.lineTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1)); c.closePath(); c.fill();
    }
  }
  function panelFrame(c, x, y, w, h, paint) {
    c.save(); rr(c, x, y, w, h, 0); c.clip(); paint(x + 5, y + 5, w - 10, h - 10); c.restore();
    c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  }

  /* 요인의 그림 종류. 제목으로 먼저 정하고, 제목만으로 모르면 순서(1 달러, 2 금리, 3 금, 4 은)로 정한다 */
  function artOf(f, idx) {
    const T = String(f.title || '');
    if (/선물|현물|괴리|콘탱고|백워/.test(T)) return 'scale';
    if (/달러|환율/.test(T)) return 'dollar';
    if (/금리|연준|FOMC|Fed|국채/i.test(T)) return 'bank';
    if (/(^|[^가-힣])금([^가-힣]|$)/.test(T) && /수요|수급|매수|장신구|안전|중앙은행/.test(T)) return 'goldDemand';
    if (/(^|[^가-힣])은([^가-힣]|$)/.test(T) || /산업|제조|공장/.test(T)) return 'silverDemand';
    if (idx === 0) return 'dollar';
    if (idx === 1) return 'bank';
    if (idx === 2) return 'goldDemand';
    if (idx === 3) return 'silverDemand';
    return 'coin';
  }
  /* 컷 제목 */
  function toonTitle(kind, f) {
    if (kind === 'goldDemand') return '금 수요';
    if (kind === 'silverDemand') return '은 수요';
    if (kind === 'scale') return '선물과 현물';
    return f.title;
  }
  /* 분석 글에 나온 내용과 맞는 그림을 고른다 (최대 4개) */
  function goldDemandItems(f) {
    const t = [f.title, f.summary, f.text].join(' ');
    const all = pickTopics(t, ['jewelry', 'retail', 'central', 'war', 'shield', 'stock'], 4);
    return all.length ? all : [{ draw: iconGoldBars, tag: '금 수요' }];
  }
  function silverDemandItems(f) {
    const t = [f.title, f.summary, f.text].join(' ');
    const all = pickTopics(t, ['ai', 'datacenter', 'chip', 'phone', 'solar', 'supply'], 4);
    return all.length ? all : [{ draw: (c, cx, cy, s) => factoryArt(c, cx - s * 0.6, cy - s * 0.5, s * 1.2), tag: '산업 수요' }];
  }
  /* 한 컷(요인) 그림: 그림 영역은 750x400 */
  function factorArt(c, ox, oy, f, idx, r, ex) {
    const kind = artOf(f, idx);
    const who = f.target === '금' ? ['gold'] : (f.target === '은' ? ['silver'] : ['gold', 'silver']);
    const st = f.impact === 'up' ? { e: 'proud', a: 'up', say: '', sfx: '' }
      : (f.impact === 'down' ? { e: 'sweat', a: 'down', say: '조금 무거워요…', sfx: '꾸욱…' } : { e: 'smile', a: 'down', say: '지켜보는 중!', sfx: '흠…' });
    const two = who.length === 2;
    const coinAt = (i, x, y, w) => coinArt(c, ox + x, oy + y, w, who[i], st.e, st.a);
    /* 배경 곡선 화살표는 제목 상자와 그림 뒤에 먼저 그린다 */
    if (kind === 'dollar' && ex) pctArrow(c, ox + 375, oy + 200, 330, ex.fxPct);
    if (kind === 'bank' && ex) pctArrow(c, ox + 375, oy + 200, 330, ex.yPct);
    if (kind === 'silverDemand' && (f.impact === 'up' || f.impact === 'down')) curvedArrow(c, ox + 375, oy + 200, f.impact === 'up', 440);
    narrDraw(c, ox, oy, (idx + 1) + '. ' + toonTitle(kind, f));
    if (kind === 'dollar') {
      dollarArt(c, ox + 255, oy + 115, 240, f.impact === 'down');
      if (ex) sideLabel(c, ex.fxPct, ox + 235, ox + 515, oy + 219);
      macroProps(c, ox, oy, f, ['war', 'stock', 'jobs', 'cpi', 'ppi', 'rate', 'supply']);
    } else if (kind === 'bank') {
      bankArt(c, ox + 265, oy + 90, 220);
      if (ex) sideLabel(c, ex.yPct, ox + 245, ox + 505, oy + 224);
      macroProps(c, ox, oy, f, ['jobs', 'cpi', 'ppi', 'stock', 'war', 'supply', 'dollar']);
    } else if (kind === 'goldDemand') {
      iconRow(c, ox, oy, goldDemandItems(f), 190);
    } else if (kind === 'silverDemand') {
      iconRow(c, ox, oy, silverDemandItems(f), 180);
    } else if (kind === 'scale') {
      /* 금·은 각각 천칭 저울: 콘탱고면 선물(왼쪽) 접시가, 백워데이션이면 현물(오른쪽) 접시가 내려간다.
         콘탱고는 팔을 들고, 백워데이션은 팔을 내리고 놀란 표정. 증감은 +빨강 / -파랑 */
      [['gold', Number(r.gold_spread_pct), 40], ['silver', Number(r.silver_spread_pct), 430]].forEach((q) => {
        const sp = q[1], x0 = q[2];
        const deg = (sp >= 0 ? 1 : -1) * Math.min(14, Math.max(6, 4 + Math.abs(sp) * 20));
        coinArt(c, ox + x0, oy + 76, 92, q[0], sp >= 0 ? 'smile' : 'shock', sp >= 0 ? 'up' : 'down');
        bubbleDraw(c, ox, oy, NAME[q[0]] + ' ' + (sp >= 0 ? '콘탱고' : '백워데이션') + ' ' + fSign(sp) + '%', x0 + 100, 84, 220, 'dl', 24);
        const pans = scaleArt(c, ox + x0, oy + 196, 290, deg);
        txt(c, '선물', pans.left.x, pans.left.y + 24, '900 22px ' + TOON, INK, 'center');
        txt(c, '현물', pans.right.x, pans.right.y + 24, '900 22px ' + TOON, INK, 'center');
      });
    } else {
      two ? (coinAt(0, 130, 110, 220), coinAt(1, 400, 120, 210)) : coinAt(0, 270, 100, 240);
      if (st.say) bubbleDraw(c, ox, oy, st.say, 220, 30, 310, 'dl', 28);
      if (st.sfx) sfxDraw(c, ox, oy, st.sfx, 560, 70, 8, 64);
    }
  }
  function captionMetrics(c, f, data) {
    c.font = '900 30px ' + TOON; const sl = wrapText(c, String(f.summary || '').replace(/^샘플 문구:\s*/, ''), 702);
    c.font = '600 23px ' + TOON; const dl = wrapText(c, String(f.text || '').replace(/^샘플 문구:\s*/, ''), 702);
    return { sl, dl, data: data || '', h: 5 + 16 + 44 + 10 + (data ? 38 : 0) + sl.length * 39 + 8 + dl.length * 30 + 20 };
  }
  function captionDraw(c, ox, capTop, f, m) {
    c.fillStyle = '#fff'; c.fillRect(ox, capTop, 750, m.h);
    c.fillStyle = INK; c.fillRect(ox, capTop, 750, 5);
    let x = ox + 24; const y0 = capTop + 5 + 16;
    const imp = f.impact === 'up' ? ['▲ 상승 요인', 'up'] : (f.impact === 'down' ? ['▼ 하락 요인', 'down'] : ['● 중립', 'flat']);
    x += chipDraw(c, x, y0, imp[0], imp[1]) + 10;
    if (f.target) chipDraw(c, x, y0, f.target, 'metal');
    let y = y0 + 44 + 10;
    if (m.data) {
      c.font = '900 26px ' + TOON;
      y += 34; drawRich(c, m.data, ox + 24, y - 8, INK); y += 4;
    }
    c.font = '900 30px ' + TOON;
    const opt = m.noState ? { noState: true } : undefined;
    m.sl.forEach((ln) => { y += 39; drawRich(c, ln, ox + 24, y - 9, INK, opt); });
    y += 8; c.font = '600 23px ' + TOON;
    m.dl.forEach((ln) => { y += 30; drawRich(c, ln, ox + 24, y - 8, '#333333', opt); });
  }

  async function buildToon(want) {
    try { await document.fonts.load('900 30px Jua'); } catch (e) { /* 폰트가 없으면 고딕으로 대신 */ }
    const logo = await loadLogo();
    const W = 800, P = 20, GAP = 26, IN = 750, ART = 400;
    const r = GD.latest;
    const byId = (id) => String((GD.ana.find((x) => x.id === id) || {}).text || '').replace(/^샘플 문구:\s*/, '');
    const m0 = document.createElement('canvas').getContext('2d');
    let factors = GD.ana.filter((x) => x.kind === 'factor').sort((a, b) => Number(a.no) - Number(b.no));
    if (!factors.length) {
      factors = ['m1', 'm2', 'm3', 'm4'].map((id) => {
        const row = GD.ana.find((x) => x.id === id) || {};
        return { title: row.title || '', summary: '', text: row.text || '', impact: 'flat', target: '' };
      });
    }
    const cp0 = GD.ana.find((x) => x.kind === 'checkpoint');
    const kwOf = (s) => String(s || '').split(/\s*[·•,]\s*/).map((t) => t.trim()).filter(Boolean).slice(0, 4);
    const kws = cp0 ? kwOf(cp0.summary) : [];
    const kwMode = kws.length >= 2 && kws.every((k) => k.length <= 18);
    const cp = cp0 && kwMode ? Object.assign({}, cp0, { summary: '핵심 요인 모니터링', impact: 'flat', target: '' }) : cp0;
    const prevX = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    const fxPct = prevX && Number(prevX.usdkrw) ? (Number(r.usdkrw) / Number(prevX.usdkrw) - 1) * 100 : null;
    const rt0 = GD.rates;
    const yPct = rt0 && rt0.us10y_chg !== undefined && rt0.us10y_chg !== null ? Number(rt0.us10y_chg) : null;
    const us10 = rt0 && rt0.us10y !== undefined && rt0.us10y !== null ? Number(rt0.us10y) : null;
    const ex = { fxPct, yPct };
    const dataLineOf = (f, i) => {
      const kind = artOf(f, i);
      if (kind === 'dollar' && fxPct !== null) return '달러/원 ' + f2(Number(r.usdkrw)) + '원 · 전일 대비 ' + fSign(fxPct) + '%';
      if (kind === 'bank' && yPct !== null) return '미국 10년물 국채금리 ' + (us10 !== null ? f2(us10) + '% · ' : '') + '전일 대비 ' + fSign(yPct) + '%';
      return '';
    };
    const list = factors.map((f, i) => {
      const m = captionMetrics(m0, f, dataLineOf(f, i));
      m.noState = artOf(f, i) === 'scale';
      return { f, m };
    });
    const panels = [{ h: 660, id: 'cover' }, { h: 700, id: 'price' }];
    list.forEach((it, i) => panels.push({ h: 10 + ART + it.m.h, id: 'factor', it, i }));
    if (cp) { const m = captionMetrics(m0, cp); panels.push({ h: 10 + ART + m.h, id: 'check', it: { f: cp, m }, kw: kwMode ? kws : null }); }
    panels.push({ h: 484, id: 'end' });
    const H = P * 2 + panels.reduce((s, p) => s + p.h, 0) + GAP * (panels.length - 1);

    const dpr = pickDpr(W, H, want || 3);
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    if (!c) throw new Error('canvas too large');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    let y = P;
    const ox = P + 5;
    const rects = [];
    const pageName = (p) => (p.id === 'cover' ? '표지' : (p.id === 'price' ? '오늘의시세' : (p.id === 'check' ? '체크포인트'
      : (p.id === 'end' ? '마무리' : toonTitle(artOf(p.it.f, p.i), p.it.f)))));
    panels.forEach((p) => {
      rects.push({ x: P, y, w: W - 2 * P, h: p.h, name: pageName(p) });
      const oy = y + 5;
      if (p.id === 'cover') {
        panelFrame(c, P, y, W - 2 * P, p.h, (x0, y0, w0, h0) => bgFocus(c, x0, y0, w0, h0, '#1b2a5a', 0.5, 0.66, 0.09));
        narrDraw(c, ox, oy, '웹툰 스타일');
        c.textAlign = 'center'; c.lineJoin = 'round';
        {
          const t1 = '오늘의 ', t2 = '시장', f1 = '900 72px ' + TOON, f2 = '900 100px ' + TOON;
          c.font = f1; const w1 = c.measureText(t1).width;
          c.font = f2; const w2 = c.measureText(t2).width;
          const sx = W / 2 - (w1 + w2) / 2, by = oy + 210;
          c.textAlign = 'left';
          c.font = f1; c.lineWidth = 9; c.strokeStyle = INK; c.strokeText(t1, sx, by); c.fillStyle = '#fff'; c.fillText(t1, sx, by);
          c.font = f2; c.lineWidth = 11; c.strokeText(t2, sx + w1, by); c.fillStyle = '#ffd400'; c.fillText(t2, sx + w1, by);
        }
        c.textAlign = 'left';
        txt(c, r.date + ' (' + r.weekday + ') ' + asofLabel() + (GD.sample ? ' · 샘플 데이터' : ''), W / 2, oy + 316, '700 28px ' + TOON, '#ffffff', 'center');
        bubbleDraw(c, ox, oy, '오늘 시장을 볼까요?', 40, 340, 330, 'dl', 30, { nowrap: true });
        bubbleDraw(c, ox, oy, '쉽게 알려줄게요!', 390, 370, 320, 'dr', 30);
        coinArt(c, ox + 40, oy + 410, 210, 'gold', 'smile', 'wave');
        coinArt(c, ox + 500, oy + 420, 200, 'silver', 'proud', 'wave');
      } else if (p.id === 'price') {
        panelFrame(c, P, y, W - 2 * P, p.h, (x0, y0, w0, h0) => bgDots(c, x0, y0, w0, h0, '#fff3c4'));
        const dm = GD.domestic;
        const hasDm = !!(dm && dm.gold_buy !== undefined && dm.silver_buy !== undefined);
        if (hasDm) {
          narrDraw(c, ox, oy, '오늘의 시세', 26, '(골드바/실버바 기준, 1돈, 3.75g)');
          const chgPart = (key) => {
            const chg = dm[key + '_chg'];
            if (chg === null || chg === undefined) return '(변동 ' + fInt(Number(dm[key + '_abs'])) + '원)';
            const n = Number(chg);
            return '(' + (n > 0 ? '+' : (n < 0 ? '-' : '')) + fInt(Math.abs(n)) + '원)';
          };
          const pctOf = (price, chg, fb) => {
            const base = Number(price) - Number(chg);
            return chg !== null && chg !== undefined && base ? (Number(chg) / base) * 100 : fb;
          };
          const gPct = pctOf(dm.gold_sell, dm.gold_sell_chg, Number(r.gold_krw_dod_pct));
          const sPct = pctOf(dm.silver_sell, dm.silver_sell_chg, Number(r.silver_krw_dod_pct));
          pctArrow(c, ox + 194, oy + 401, 300, gPct);
          pctArrow(c, ox + 556, oy + 401, 300, sPct);
          const gk = dm.gold_sell_chg, sk = dm.silver_sell_chg;
          const gx = Number(gk) < 0 ? ['sweat', 'down'] : (Number(gk) > 0 ? ['proud', 'up'] : ['smile', 'down']);
          const sx = Number(sk) < 0 ? ['sweat', 'down'] : (Number(sk) > 0 ? ['proud', 'up'] : ['smile', 'down']);
          bubbleDraw(c, ox, oy, '순금<br>살 때 ' + fInt(dm.gold_buy) + '원 ' + chgPart('gold_buy') + '<br>팔 때 ' + fInt(dm.gold_sell) + '원 ' + chgPart('gold_sell'), 14, 84, 330, 'dl', 24, { nowrap: true });
          coinArt(c, ox + 79, oy + 280, 230, 'gold', gx[0], gx[1]);
          bubbleDraw(c, ox, oy, '은<br>살 때 ' + fInt(dm.silver_buy) + '원 ' + chgPart('silver_buy') + '<br>팔 때 ' + fInt(dm.silver_sell) + '원 ' + chgPart('silver_sell'), 376, 84, 330, 'dr', 24, { nowrap: true });
          coinArt(c, ox + 441, oy + 280, 230, 'silver', sx[0], sx[1]);
          c.fillStyle = '#fff'; c.fillRect(ox, oy + 600, IN, p.h - 10 - 600);
          c.fillStyle = INK; c.fillRect(ox, oy + 600, IN, 5);
          const prevR = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
          const fxc = prevR && Number(prevR.usdkrw) ? (Number(r.usdkrw) / Number(prevR.usdkrw) - 1) * 100 : null;
          c.font = '700 24px ' + TOON; c.fillStyle = INK;
          richCentered(c, '달러/원 ' + f2(Number(r.usdkrw)) + '원' + (fxc === null ? '' : ' (' + fSign(fxc) + '%)'), ox + IN / 2, oy + 646, INK);
        } else {
          narrDraw(c, ox, oy, '오늘의 원화 시세 (1돈 = 3.75g)');
          const gd = Number(r.gold_krw_dod_pct), sd = Number(r.silver_krw_dod_pct);
          bubbleDraw(c, ox, oy, '내 몸값은<br>' + fInt(Number(r.gold_krw_don)) + '원!', 36, 96, 320, 'dl', 34);
          coinArt(c, ox + 60, oy + 262, 230, 'gold', gd < 0 ? 'sweat' : 'proud', gd < 0 ? 'down' : 'up');
          chipDraw(c, ox + 54, oy + 520, '전일 대비 ' + fSign(gd) + '%', gd > 0 ? 'up' : (gd < 0 ? 'down' : 'flat'));
          bubbleDraw(c, ox, oy, '나는<br>' + fInt(Number(r.silver_krw_don)) + '원!', 392, 118, 310, 'dr', 34);
          coinArt(c, ox + 444, oy + 280, 210, 'silver', sd < 0 ? 'sweat' : 'proud', sd < 0 ? 'down' : 'up');
          chipDraw(c, ox + 436, oy + 520, '전일 대비 ' + fSign(sd) + '%', sd > 0 ? 'up' : (sd < 0 ? 'down' : 'flat'));
          c.fillStyle = '#fff'; c.fillRect(ox, oy + 600, IN, p.h - 10 - 600);
          c.fillStyle = INK; c.fillRect(ox, oy + 600, IN, 5);
          txt(c, '국제 현물가 환산 · 달러/원 ' + f2(Number(r.usdkrw)) + '원', ox + IN / 2, oy + 646, '700 24px ' + TOON, INK, 'center');
        }
      } else if (p.id === 'factor' || p.id === 'check') {
        const f = p.it.f;
        const bgs = [(a, b, w, h) => bgFocus(c, a, b, w, h, '#cfe8ff', 0.5, 0.34, 0.10), (a, b, w, h) => bgDots(c, a, b, w, h, '#e6e0ff'),
          (a, b, w, h) => bgFocus(c, a, b, w, h, '#ffe2b8', 0.5, 0.42, 0.10), (a, b, w, h) => bgDots(c, a, b, w, h, '#d9ecf7'),
          (a, b, w, h) => bgFocus(c, a, b, w, h, '#e9f7ec', 0.5, 0.36, 0.08)];
        panelFrame(c, P, y, W - 2 * P, p.h, p.id === 'check' ? ((a, b, w, h) => bgDots(c, a, b, w, h, '#ffd9d9')) : bgs[p.i % bgs.length]);
        if (p.id === 'factor') {
          factorArt(c, ox, oy, f, p.i, r, ex);
        } else {
          if (p.kw) {
            narrDraw(c, ox, oy, '오늘의 체크포인트', 26, '(핵심 요인 모니터링)');
            const cols = ['#ffe45c', '#ffc2c2', '#bfe3ff', '#c9f0d0'];
            const bw = 330, bh = 84;
            const pos = p.kw.length === 2 ? [[30, 150], [390, 150]]
              : (p.kw.length === 3 ? [[30, 100], [390, 100], [210, 204]] : [[30, 100], [390, 100], [30, 204], [390, 204]]);
            p.kw.forEach((k, i) => {
              const q = pos[i];
              box(c, ox + q[0], oy + q[1], bw, bh, 18, cols[i], INK, 4);
              const tp = TOPICS.find((t) => topicHit(t, k));
              const room = tp ? bw - 100 : bw - 36;
              const tcx = ox + q[0] + (tp ? 84 + room / 2 : bw / 2);
              if (tp) tp.draw(c, ox + q[0] + 46, oy + q[1] + bh / 2, 62);
              let sz = 36;
              c.font = '900 ' + sz + 'px ' + TOON;
              while (sz > 18 && c.measureText(k).width > room) { sz -= 2; c.font = '900 ' + sz + 'px ' + TOON; }
              txt(c, k, tcx, oy + q[1] + bh / 2 + sz * 0.34, '900 ' + sz + 'px ' + TOON, INK, 'center');
            });
            calendarArt(c, ox + 315, oy + 288, 110);
          } else {
            narrDraw(c, ox, oy, '오늘의 체크포인트');
            calendarArt(c, ox + 265, oy + 50, 220);
            bubbleDraw(c, ox, oy, '발표 시각을<br>꼭 확인!', 20, 80, 220, 'dl', 26);
            sfxDraw(c, ox, oy, '두근!', 540, 70, 8, 64);
          }
          }
        captionDraw(c, ox, oy + ART, f, p.it.m);
      } else {
        panelFrame(c, P, y, W - 2 * P, p.h, (x0, y0, w0, h0) => bgFocus(c, x0, y0, w0, h0, '#fff0b3', 0.5, 0.45, 0.08));
        txt(c, '오늘 이야기는 여기까지!', W / 2, oy + 90, '900 52px ' + TOON, INK, 'center');
        const lw = 540, lh = logo ? Math.round((lw * logo.height) / logo.width) : 90, plh = lh + 32, py = oy + 118;
        box(c, W / 2 - lw / 2 - 16, py, lw + 32, plh, 18, '#ffffff', INK, 4);
        if (logo) c.drawImage(logo, W / 2 - lw / 2, py + 16, lw, lh);
        else txt(c, '한국금시장거래소', W / 2, py + 62, '900 44px ' + TOON, INK, 'center');
        txt(c, '한국금시장거래소 용인수지점', W / 2, py + plh + 52, '900 40px ' + TOON, INK, 'center');
        c.textAlign = 'center'; c.lineJoin = 'round'; c.font = '900 60px ' + TOON; c.lineWidth = 9; c.strokeStyle = INK;
        c.strokeText('031-898-1355', W / 2, py + plh + 114); c.fillStyle = '#ffd400'; c.fillText('031-898-1355', W / 2, py + plh + 114);
        c.textAlign = 'left';
        const boxH = p.h - 10 - 390;
        c.fillStyle = '#fff'; c.fillRect(ox, oy + 390, IN, boxH);
        c.fillStyle = INK; c.fillRect(ox, oy + 390, IN, 5);
        const nText = byId('n1') + (GD.sample ? ' 이 이미지는 샘플 데이터로 만든 예시입니다.' : '');
        let nsz = 20, nstep = 27, nlines = [];
        for (; nsz >= 13; nsz -= 1) {
          nstep = Math.round(nsz * 1.35);
          c.font = '600 ' + nsz + 'px ' + TOON;
          nlines = wrapText(c, nText, IN - 44);
          if (5 + 14 + nsz + (nlines.length - 1) * nstep + 6 <= boxH) break;       // 박스(84px) 안에 다 들어가는 가장 큰 글씨
        }
        c.fillStyle = '#333';
        nlines.forEach((ln, i) => c.fillText(ln, ox + 22, oy + 390 + 5 + 14 + nsz + i * nstep));
      }
      y += p.h + GAP;
    });
    cv.panelRects = rects;
    cv.toonDpr = dpr;
    return cv;
  }
  async function toonCanvas(want) {
    for (let w = want; w >= 1.25; w *= 0.8) {
      try { return await buildToon(w); } catch (e) { /* 너무 크면 배율을 낮춰 다시 */ }
    }
    return buildToon(1);
  }
  async function downloadToon() {
    if (!GD.latest) return;
    flash('웹툰을 만드는 중이에요. 몇 초 걸려요…');
    const blob = await infoToBlob(await toonCanvas(3));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '금은-웹툰-' + GD.latest.date + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flash('웹툰을 내려받았습니다.');
  }
  /* ---------- 웹툰 동영상: 컷을 차례로 보여 준다 (첫·마지막 컷 3초, 나머지 5초) ---------- */
  const VIDEO = { FPS: 24, BG: '#101828' };
  const VIDEO_SIZES = [{ w: 1440, h: 2560, bps: 12000000 }, { w: 1080, h: 1920, bps: 6000000 }];
  let videoBusy = false;
  function videoSeconds(n) {
    return Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? 3 : 5));
  }
  function pickVideoType() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    const list = ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return list.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }
  /* 긴 웹툰 그림에서 컷 하나를 잘라 세로 동영상 화면 가운데에 맞춰 놓는다 */
  function composeVideoFrame(src, rc, dpr, size) {
    const fc = document.createElement('canvas');
    fc.width = size.w; fc.height = size.h;
    const g = fc.getContext('2d');
    g.fillStyle = VIDEO.BG; g.fillRect(0, 0, size.w, size.h);
    const m = 6;
    const sx = (rc.x - m) * dpr, sy = (rc.y - m) * dpr, sw = (rc.w + 2 * m) * dpr, sh = (rc.h + 2 * m) * dpr;
    const scale = Math.min((size.w - size.w * 0.045) / sw, (size.h - size.h * 0.125) / sh);
    const dw = sw * scale, dh = sh * scale;
    g.drawImage(src, sx, sy, sw, sh, (size.w - dw) / 2, (size.h - dh) / 2, dw, dh);
    return fc;
  }
  async function makeToonVideo(src, size, onTick) {
    const type = pickVideoType();
    if (!type) throw new Error('unsupported');
    const secs = videoSeconds(src.panelRects.length);
    const frames = src.panelRects.map((rc) => composeVideoFrame(src, rc, src.toonDpr, size));
    const vc = document.createElement('canvas');
    vc.width = size.w; vc.height = size.h;
    const g = vc.getContext('2d');
    g.drawImage(frames[0], 0, 0);
    const stream = vc.captureStream(VIDEO.FPS);
    const track = stream.getVideoTracks && stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: size.bps });
    const chunks = [];
    let failed = null;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => { failed = e; };
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start(1000);
    const total = secs.reduce((s, v) => s + v, 0);
    const t0 = Date.now();
    for (let i = 0; i < frames.length; i++) {
      const end = Date.now() + secs[i] * 1000;
      while (Date.now() < end) {
        g.drawImage(frames[i], 0, 0);
        if (track && track.requestFrame) track.requestFrame();
        if (onTick) onTick(Math.min(total, (Date.now() - t0) / 1000), total);
        const wait = Math.max(1, Math.min(1000 / VIDEO.FPS, end - Date.now()));   // 마지막 한 칸은 남은 시간만큼만 기다려 컷 길이를 정확히 맞춘다
        await new Promise((res) => setTimeout(res, wait));
      }
    }
    await new Promise((res) => setTimeout(res, 250));
    if (rec.requestData) rec.requestData();
    rec.stop();
    await stopped;
    const blob = new Blob(chunks, { type });
    if (failed || blob.size === 0) throw new Error('encode');
    return { blob, type, secs, size };
  }
  async function downloadVideo() {
    if (!GD.latest || videoBusy) return;
    if (!pickVideoType()) {
      flash('이 브라우저는 동영상 만들기를 지원하지 않아요. 크롬이나 엣지에서 이용해 주세요.');
      return;
    }
    videoBusy = true;
    flash('동영상을 준비하는 중이에요. 웹툰을 먼저 그립니다…');
    let lastSec = -1;
    try {
      const src = await toonCanvas(2.5);
      let res = null;
      for (let k = 0; k < VIDEO_SIZES.length && !res; k++) {
        try {
          if (k > 0) { lastSec = -1; flash('해상도를 낮춰 다시 녹화합니다…'); }
          res = await makeToonVideo(src, VIDEO_SIZES[k], (t, total) => {
            const s = Math.floor(t);
            if (s === lastSec) return;
            lastSec = s;
            flash('동영상 녹화 중… ' + s + ' / ' + total + '초 (이 탭을 닫거나 다른 탭으로 옮기지 마세요)');
          });
        } catch (e) {
          if (k === VIDEO_SIZES.length - 1) throw e;
        }
      }
      const ext = res.type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.blob);
      a.download = '금은-시장동향-웹툰-' + GD.latest.date + '.' + ext;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash('동영상을 내려받았습니다. (' + ext.toUpperCase() + ' ' + res.size.w + '×' + res.size.h + ', 총 ' + res.secs.reduce((s, v) => s + v, 0) + '초)');
    } catch (e) {
      flash('동영상을 만들지 못했어요. 크롬이나 엣지에서 다시 시도해 주세요.');
    } finally {
      videoBusy = false;
    }
  }
  /* ---------- 웹툰 페이지별 이미지를 ZIP 한 파일로 ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /* 압축 없이 담는 ZIP (PNG는 이미 압축돼 있다). 파일 이름은 UTF-8이라 한글이 그대로 보인다 */
  function zipStore(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, f.data.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + f.data.length;
    });
    const cdSize = central.reduce((s, b) => s + (b.byteLength !== undefined ? b.byteLength : b.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }
  function blobBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then((b) => new Uint8Array(b));
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(new Uint8Array(fr.result));
      fr.onerror = rej;
      fr.readAsArrayBuffer(blob);
    });
  }
  const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|·・\s]+/g, '').slice(0, 30);
  let pagesBusy = false;
  async function downloadPages() {
    if (!GD.latest || pagesBusy) return;
    pagesBusy = true;
    flash('웹툰을 그리는 중이에요. 몇 초 걸려요…');
    try {
      const src = await toonCanvas(3);
      const dpr = src.toonDpr, m = 6;
      const files = [];
      for (let i = 0; i < src.panelRects.length; i++) {
        const rc = src.panelRects[i];
        flash('페이지 이미지를 만드는 중이에요… ' + (i + 1) + ' / ' + src.panelRects.length);
        const sw = Math.round((rc.w + 2 * m) * dpr), sh = Math.round((rc.h + 2 * m) * dpr);
        const pc = document.createElement('canvas');
        pc.width = sw; pc.height = sh;
        pc.getContext('2d').drawImage(src, (rc.x - m) * dpr, (rc.y - m) * dpr, sw, sh, 0, 0, sw, sh);
        const blob = await new Promise((res) => pc.toBlob(res, 'image/png'));
        if (!blob) throw new Error('png');
        files.push({ name: String(i + 1).padStart(2, '0') + '-' + (safeName(rc.name) || '페이지') + '.png', data: await blobBytes(blob) });
      }
      const zip = zipStore(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = '금은-시장동향-웹툰-페이지-' + GD.latest.date + '.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash('웹툰 페이지 ' + files.length + '장을 ZIP으로 내려받았습니다. (가로 ' + Math.round((src.panelRects[0].w + 2 * m) * dpr) + 'px)');
    } catch (e) {
      console.error('웹툰 페이지 ZIP 오류:', e);
      flash('페이지 이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      pagesBusy = false;
    }
  }
  async function previewToon() {
    if (!GD.latest) return;
    flash('웹툰을 만드는 중이에요. 몇 초 걸려요…');
    const cv = await toonCanvas(1.25);
    const box2 = $('#gd-toon-box'); box2.hidden = false;
    const dc = box2.querySelector('canvas');
    dc.width = cv.width; dc.height = cv.height;
    dc.getContext('2d').drawImage(cv, 0, 0);
    flash('');
  }

  /* 화면(제목·헤드라인·시세·시장분석·30일 추이)을 같은 구성으로 한 장에 그린다.
     hint가 없으면 길이만 재는 작은 그림, 있으면 그 길이에 맞춘 고해상도 그림 */
  function buildDashboard(want, hint) {
    const CW = 1228, M = 24, CWC = 1180, GAP = 16, COLW = (CWC - GAP) / 2, PAD = 20;
    const dpr = hint ? pickDpr(CW, hint, want || 3) : 0.2;
    const HH = hint || 6000;
    const cv = document.createElement('canvas');
    cv.width = Math.round(CW * dpr); cv.height = Math.round(HH * dpr);
    const c = cv.getContext('2d');
    if (!c) throw new Error('canvas too large');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#f4f5f8'; c.fillRect(0, 0, CW, HH);
    const r = GD.latest;
    const clean = (s) => String(s || '').replace(/^샘플 문구:\s*/, '');
    const card = (x, y, w, h, top) => {
      c.save();
      rr(c, x, y, w, h, 12); c.fillStyle = '#ffffff'; c.fill();
      c.lineWidth = 1; c.strokeStyle = '#e1e4ea'; c.stroke();
      if (top) { rr(c, x, y, w, h, 12); c.clip(); c.fillStyle = top; c.fillRect(x, y, w, 4); }
      c.restore();
    };
    const tint = (hex, a) => rgba(hex, a);
    c.textAlign = 'left';
    let y = M;

    /* 제목 */
    c.fillStyle = '#1b1b1b'; c.font = '700 28px ' + FONT;
    c.fillText('오늘의 시장동향', M, y + 28);
    const titleW = c.measureText('오늘의 시장동향').width;
    c.fillStyle = '#5b6068'; c.font = '600 13px ' + FONT;
    c.fillText(r.date + ' (' + r.weekday + ') ' + asofLabel(), M + titleW + 28, y + 28);
    y += 36 + 16;
    if (GD.sample) {
      c.fillStyle = '#5b6068'; c.font = '600 13px ' + FONT;
      c.fillText('샘플 데이터 화면입니다. 실제 시세가 아닙니다.', M, y + 13);
      y += 30;
    }

    /* 헤드라인 카드 */
    const hlFonts = ['700 18px ' + FONT, '600 15px ' + FONT, '600 15px ' + FONT, '600 15px ' + FONT];
    const hlW = CWC - 6 - 1 - 2 * PAD;
    const hl = headlineLines().filter(Boolean).map((t, i) => {
      c.font = hlFonts[i];
      const lines = i < 3 ? wrapRich(c, t, hlW, hlFonts[i], fontWithPx(hlFonts[i], 15)) : wrapText(c, t, hlW);
      return { font: hlFonts[i], lines, lh: i === 0 ? 27 : 22.5, rich: i < 3 };
    });
    const hlH = 2 * PAD + 2 + hl.reduce((s, o) => s + o.lines.length * o.lh, 0);
    c.save();
    rr(c, M, y, CWC, hlH, 12); c.fillStyle = '#f9f3e1'; c.fill();
    c.lineWidth = 1; c.strokeStyle = '#e1e4ea'; c.stroke();
    rr(c, M, y, CWC, hlH, 12); c.clip(); c.fillStyle = '#d4a017'; c.fillRect(M, y, 6, hlH);
    c.restore();
    let ty = y + PAD + 1;
    hl.forEach((o) => {
      c.font = o.font;
      o.lines.forEach((ln) => {
        ty += o.lh;
        c.font = o.font;
        if (o.rich) drawRich(c, ln, M + 6 + PAD, ty - o.lh * 0.28, '#1b1b1b', { chgPx: 15, unitPx: 15 });
        else { c.fillStyle = '#1b1b1b'; c.fillText(ln, M + 6 + PAD, ty - o.lh * 0.28); }
      });
    });
    y += hlH + 16;

    /* 시세 카드(왼쪽) + 시장분석 카드(오른쪽) */
    const subP = dpr * (COLW - 2 - 2 * PAD) / 1000;
    const pc = document.createElement('canvas');
    const ph = drawPrices(pc, r, 1000, subP, { noHead: true });
    const pScale = (COLW - 2 - 2 * PAD) / 1000;
    const leftH = 4 + PAD + ph * pScale + PAD + 1;

    const indRows = GD.ana.filter((x) => x.kind === 'indicator');
    const cpRow = GD.ana.find((x) => x.id === 'c1');
    const items = [
      ['공통 요인', 'm1', '#8b5cf6'], ['주요 경제지표', 'ind', '#8b5cf6'], ['금 요인', 'm2', '#d4a017'],
      ['은 요인', 'm3', '#7c8ca3'], ['선물·현물 괴리', 'm4', '#3b82f6'], ['오늘의 체크포인트', 'c1', '#0f9d8a'],
    ].map((q) => {
      c.font = '600 15px ' + FONT;
      const wd = COLW - 2 - 2 * PAD - 13;
      let lines = [];
      if (q[1] === 'ind') {
        lines = indRows.reduce((acc, x) => acc.concat(wrapText(c, clean(x.text), wd)), []);
      } else {
        let text;
        if (q[1] === 'm4') text = spreadLine();
        else if (q[1] === 'c1') text = cpRow ? clean(cpRow.summary) + (cpRow.text ? ' — ' + clean(cpRow.text) : '') : '';
        else text = clean((GD.ana.find((x) => x.id === q[1]) || {}).text);
        lines = text ? wrapText(c, text, wd) : [];
      }
      return { label: q[0], color: q[2], lines };
    }).filter((it) => it.lines.length);
    const noticeRow = GD.ana.find((x) => x.id === 'n1');
    c.font = '600 13px ' + FONT;
    const noticeLines = noticeRow ? wrapText(c, clean(noticeRow.text), COLW - 2 - 2 * PAD) : [];
    const itemH = (it) => 2 + 17 + it.lines.length * 24 + 2;
    const itemsH = items.reduce((s, it) => s + itemH(it), 0);
    const headH = 4 + PAD + 23.4 + 4 + 17 + 10;
    const rightNat = headH + itemsH + 16 * Math.max(0, items.length - 1) + 10 + noticeLines.length * 17 + PAD + 1;
    const rowH = Math.max(leftH, rightNat);

    card(M, y, COLW, rowH, '#0f9d8a');
    c.drawImage(pc, M + 1 + PAD, y + 4 + PAD, COLW - 2 - 2 * PAD, ph * pScale);

    const ax = M + COLW + GAP;
    card(ax, y, COLW, rowH, '#8b5cf6');
    c.fillStyle = '#8b5cf6'; c.font = '700 18px ' + FONT;
    c.fillText('시장분석', ax + 1 + PAD, y + 4 + PAD + 18);
    c.fillStyle = '#5b6068'; c.font = '600 13px ' + FONT;
    c.fillText('금·은 등락 요인 (공통 요인은 한 번만 설명)', ax + 1 + PAD, y + 4 + PAD + 23.4 + 4 + 13);
    const noticeH = noticeLines.length * 17;
    const free = rowH - headH - itemsH - 10 - noticeH - PAD - 1;
    const gap = items.length > 1 ? Math.max(16, free / (items.length - 1)) : 0;
    let iy = y + headH;
    items.forEach((it) => {
      const h = itemH(it);
      c.fillStyle = tint(it.color, 0.08); c.fillRect(ax + 1 + PAD, iy, COLW - 2 - 2 * PAD, h);
      c.fillStyle = it.color; c.fillRect(ax + 1 + PAD, iy, 3, h);
      c.font = '700 13px ' + FONT; c.fillText(it.label, ax + 1 + PAD + 13, iy + 2 + 13);
      c.font = '600 15px ' + FONT;
      it.lines.forEach((ln, k) => drawRich(c, ln, ax + 1 + PAD + 13, iy + 2 + 17 + (k + 1) * 24 - 7, '#1b1b1b'));
      iy += h + gap;
    });
    c.fillStyle = '#5b6068'; c.font = '600 13px ' + FONT;
    noticeLines.forEach((ln, k) => c.fillText(ln, ax + 1 + PAD, y + rowH - PAD - 1 - noticeH + (k + 1) * 17 - 4));
    y += rowH + 24;

    /* 최근 30일 추이 */
    c.fillStyle = '#0f9d8a'; c.fillRect(M, y, 6, 23);
    c.fillStyle = '#1b1b1b'; c.font = '700 18px ' + FONT;
    c.fillText('최근 30일 추이', M + 16, y + 18);
    y += 23.4 + 10;

    const CWD = COLW - 2 - 2 * PAD;                 // 그래프 한 장의 가로 (화면과 같은 540)
    const H1 = Math.round(CWD * 0.8), H2 = Math.round(CWD * 0.62);
    const cols = [['gold', '금', '#d4a017'], ['silver', '은', '#7c8ca3']].map((q) => {
      const sp = GD.ana.filter((x) => x.kind === 'spike_' + q[0]);
      c.font = '600 13px ' + FONT;
      const tw = [36, 62, 86];
      const textW = CWD - tw[0] - tw[1] - tw[2] - 12;
      const rows = sp.map((x) => {
        const pct = Number(x.pct);
        return {
          cells: [String(x.no), x.date.slice(5).replace('-', '/'), (pct > 0 ? '▲ ' : '▼ ') + fSign(pct) + '%'],
          pct, lines: wrapText(c, clean(x.text), textW),
        };
      });
      const tblH = 10 + 26 + (rows.length
        ? rows.reduce((s, o) => s + Math.max(1, o.lines.length) * 17 + 10 + 1, 0) : 27);
      return { id: q[0], name: q[1], color: q[2], rows, tw, tblH, textW };
    });
    const chartsH = (k) => 4 + PAD + 23.4 + 4 + H1 + 16 + H2 + k.tblH + PAD + 1;
    const rowH2 = Math.max(chartsH(cols[0]), chartsH(cols[1]));
    cols.forEach((k, ci) => {
      const x = M + ci * (COLW + GAP);
      card(x, y, COLW, rowH2, k.color);
      const ix = x + 1 + PAD;
      c.fillStyle = k.color; c.font = '700 18px ' + FONT;
      c.fillText(k.name, ix, y + 4 + PAD + 18);
      let cy = y + 4 + PAD + 23.4 + 4;
      const a = document.createElement('canvas');
      drawLineChart(a, k.id, GD.rows, spikesOf(k.id), CWD, H1, dpr);
      c.drawImage(a, ix, cy, CWD, H1);
      cy += H1 + 16;
      const b = document.createElement('canvas');
      drawGapChart(b, k.id, GD.rows, CWD, H2, dpr);
      c.drawImage(b, ix, cy, CWD, H2);
      cy += H2 + 10;
      c.fillStyle = tint(k.color, 0.14); c.fillRect(ix, cy, CWD, 26);
      c.font = '600 13px ' + FONT; c.fillStyle = '#1b1b1b';
      ['No', '일자', '변동률', '당일 시장분석'].forEach((t, i) => {
        const tx = ix + 6 + (i === 0 ? 0 : k.tw.slice(0, i).reduce((s, v) => s + v, 0));
        c.fillText(t, tx, cy + 18);
      });
      cy += 26;
      if (!k.rows.length) {
        c.fillStyle = '#1b1b1b';
        c.fillText('이 기간에 3% 이상 급등락한 날이 없습니다.', ix + 6, cy + 18);
        c.strokeStyle = '#e1e4ea'; c.beginPath(); c.moveTo(ix, cy + 27); c.lineTo(ix + CWD, cy + 27); c.stroke();
      }
      k.rows.forEach((o) => {
        const h = Math.max(1, o.lines.length) * 17 + 10;
        o.cells.forEach((t, i) => {
          const tx = ix + 6 + (i === 0 ? 0 : k.tw.slice(0, i).reduce((s, v) => s + v, 0));
          c.fillStyle = i === 0 ? k.color : (i === 2 ? (o.pct > 0 ? INF.up : INF.down) : '#1b1b1b');
          c.fillText(t, tx, cy + 5 + 13);
        });
        c.fillStyle = '#1b1b1b';
        o.lines.forEach((ln, i) => c.fillText(ln, ix + 6 + k.tw[0] + k.tw[1] + k.tw[2], cy + 5 + 13 + i * 17));
        c.strokeStyle = '#e1e4ea'; c.beginPath(); c.moveTo(ix, cy + h); c.lineTo(ix + CWD, cy + h); c.stroke();
        cy += h + 1;
      });
    });
    y += rowH2 + M;

    cv.cssHeight = y;
    return cv;
  }
  /* 먼저 작은 배율로 전체 길이를 재고, 그 길이에 딱 맞는 고해상도 그림으로 다시 그린다 */
  function dashboardCanvas(want) {
    const m = buildDashboard();
    const H = Math.ceil(m.cssHeight);
    for (let w = want; w >= 1.25; w *= 0.8) {
      try { return buildDashboard(w, H); } catch (e) { /* 너무 크면 배율을 낮춰 다시 */ }
    }
    return buildDashboard(1, H);
  }
  async function downloadDash() {
    if (!GD.latest) return;
    flash('대시보드 이미지를 고해상도로 만드는 중이에요. 몇 초 걸려요…');
    await new Promise((res) => setTimeout(res, 30));
    const blob = await new Promise((res) => dashboardCanvas(3).toBlob(res, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '금은-시세-대시보드-' + GD.latest.date + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flash('대시보드 이미지를 내려받았습니다.');
  }
  function infoToBlob(cv) { return new Promise((res) => cv.toBlob(res, 'image/png')); }
  async function downloadInfo() {
    if (!GD.latest) return;
    flash('인포그래픽을 고해상도로 만드는 중이에요. 몇 초 걸려요…');
    await new Promise((res) => setTimeout(res, 30));
    const blob = await infoToBlob(infographicCanvas(3));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '금은-시세-인포그래픽-' + GD.latest.date + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flash('인포그래픽을 내려받았습니다.');
  }
  const onClick = (sel, fn) => { const el = document.querySelector(sel); if (el) el.addEventListener('click', fn); };
  $('#gd-info-download').addEventListener('click', downloadInfo);
  $('#gd-toon-download').addEventListener('click', downloadToon);
  $('#gd-toon-download-top').addEventListener('click', downloadToon);
  $('#gd-toon-preview').addEventListener('click', previewToon);
  onClick('#gd-video-download', downloadVideo);
  onClick('#gd-pages-download', downloadPages);
  onClick('#gd-pages-download-top', downloadPages);
  onClick('#gd-video-download-top', downloadVideo);
  $('#gd-info-download-top').addEventListener('click', downloadInfo);
  onClick('#gd-dash-download-top', downloadDash);
  $('#gd-info-copy').addEventListener('click', () => { if (GD.latest) copyCanvas(infographicCanvas(2), '인포그래픽'); });
  function drawInfoPreview() {
    const key = GD.latest.date + '|' + GD.rows.length + '|' + GD.ana.length;
    if (GD.infoKey === key) return;
    GD.infoKey = key;
    const cv = infographicCanvas(1.5);
    const dc = $('#gd-info-box canvas');
    dc.width = cv.width; dc.height = cv.height;
    dc.getContext('2d').drawImage(cv, 0, 0);
  }

  /* ---------- 데이터 연결 ---------- */
  function clearCharts() {
    $$('.gd-chartbox canvas').forEach((cv) => { cv.width = 0; cv.height = 0; });
  }
  let lastData = null;
  function render() {
    if (!lastData) return;
    const [rows, ana, meta, rates, domestic] = lastData;
    GD.rates = rates;
    GD.meta = meta;
    const at = $('#gd-asof-time');
    if (at) at.textContent = asofLabel();
    GD.domestic = domestic;
    GD.rows = rows.map((r) => Object.assign({}, r));
    const stripTags = (v) => (typeof v === 'string' ? v.replace(/<\/?[a-zA-Z][^>]*>/g, '').trim() : v);
    GD.ana = ana.map((r) => {
      const o = {};
      Object.keys(r).forEach((k) => { o[k] = stripTags(r[k]); });
      return o;
    });
    GD.latest = GD.rows[GD.rows.length - 1];
    GD.sample = !!meta.sample;
    $('#gd-sample').hidden = !GD.sample;
    fillLatest(GD.latest);
    fillAnalysis(GD.ana);
    fillExtra();
    fillRates(GD.rates);
    ['gold', 'silver'].forEach((m) => {
      const box = $('#gd-chart-' + m);
      const gbox = $('#gd-gap-' + m);
      const W = Math.max(280, Math.round(box.clientWidth || 320));
      const dpr = window.devicePixelRatio || 1;
      drawLineChart(box.querySelector('canvas'), m, GD.rows, spikesOf(m), W, Math.round(W * (W < 560 ? 0.8 : 0.52)), dpr);
      drawGapChart(gbox.querySelector('canvas'), m, GD.rows, W, Math.round(W * (W < 560 ? 0.62 : 0.4)), dpr);
    });
    drawInfoPreview();
  }
  async function load() {
    try {
      const get = (n) => fetch('data/' + n + '?v=' + Date.now()).then((r) => { if (!r.ok) throw new Error(n); return r.json(); });
      lastData = await Promise.all([
        get('history.json'), get('analysis.json'), get('meta.json'),
        get('rates.json').catch(() => null),
        get('domestic.json').catch(() => null),
      ]);
      render();
    } catch (e) {
      $('#gd-flash').textContent = '데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';
    }
  }
  /* ---------- 로고 (한국금시장거래소) ---------- */
  const LOGO_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAzYAAACrCAIAAAA7PZ4WAAEAAElEQVR42uz9Z7dkx5ElCpqZux8ROq5WqZESigAoi2RVV/fMmun3Zt73+Y2z5sus1f2mq6u6qqigEyK1vlqL0HGEu9l8OCfiRtxMgATIIgEyrFBE4uaNiHPiuNhutvc2FBGYxCQmMYlJTGISk5jEdylo8hVMYhKTmMQkJjGJSUwg2iQmMYlJTGISk5jEJCYQbRKTmMQkJjGJSUxiAtEmMYlJTGISk5jEJCYxgWiTmMQkJjGJSUxiEhOINolJTGISk5jEJCYxiQlEm8QkJjGJSUxiEpP4Wwv9nbkSOfNvAAQc/wm+6kWY/1sAAHjwDyIozACovPQWOHwxD94CM7Qq+S+N/JXQqz545GJx+Krsj6M+c2deiK+69pHLH32nr/7QP/eDEcn+FxEBIPvfv50YGgeO3nj2w7+1r2ISk5jEJCbxNwDRxiCTnMKUU4SDgACC46BtDLeI5K8WAMlRFQPEAJZAgQSINPw4Gb5Whu/BACmgABCAkgyiCSCAACNaAAeiQIxIBk3GUdPIxcoA86Hw2fvEV4Oz4Z0PUJ0AsIADAMjBpfquQbSvQiov//yvCZ8N0dgQpA5/OEFpk5jEJCYxib86iDYGV0b/GYU8OIbn8BUAbxS9CWYQLQWwmP2XjP+OvPzRDsQBaEEaf0sGsAAOIANw9KqXj93A8M8I8vugKb4qLSgv5dK+o0jlb22GTNDYJCYxiUlM4m8Iop1FVmdqjgggOKxPnuahTjGbDH4jS1QJAKAgIQMqAEagwevH0J6cuQZRkCeuIN9/kUFAgEUEUAAYwWX1vcEHIo6DK8xuIs/34Vn4iGOZQIHTCx/f8XGEF0jfnSrnKDo5g1HOFEAnMYlJTGISk5jE9xuijfO3RHJ8xgCAyAAqyzPJSDUUx9JNIsAgMlJgFBRAzEqDGlChEGbvPSS0jWChrCoqggIEYgAVCWEOtVgwSxmRCCKAQgfIKChAAghAGYQExOFNZC8VRMEBShtAMhTIfzy40pGa6yg+QwAZVGa/i/hs9A/DxNLXVz9f/v3vLJj7Rp1qX/5CJjGJSUxiEpP4a4BocFrSG0Ur2R5JA84XZhgNYYw9P0JYYxhXC1COl9Q43V5eITvI/wsZFAChIAABZ588eOf8/USQEZwgCYAIQYb7EDMYmRPKTv+NfFab8Hv3fnzpD9+t+CqVwDeCNd/feCUOm4CzSUxiEpOYxF8lRBshXQkIYC69BATEvMyHeApuhlJJHqTcsuohAg8hnAwwHYMgimBOoAIBYUDOk1n5m4MAsogDgCw5JgN8RU7ACaAIMSABMKJkSb0RltnLya7BJwEPyqHZVeOrCHV4elujX4oM4N53S9H5LRDMXx9Em1R1JzGJSUxiEn8jEI0HmCQj4wsA4UjGDCFjcZ3mwESEWUQYUYgECUSIMS+JamASEWBhABDHxCTC7CARTgASAFRgFCgADYwMBCQWCJAwBWBiBoEUdILITChgALQTdgJABAikEQgox4WjG3WuK+XsAkAQAQEpL1tKVnA9vTUc58fBMGPoBBxAVupV+B+s6Px2xcczmbO/YhuO0SrtKEr7GwGmk5jEJCYxib9NiJZhEgYhEDxrnzs0sICXskySm2IgIAIKEgAKIqIAEALnUAeIQOWEM1C5FBGAUBN4IDrDhYLoZQjDADpABwAKtAckeTJPKMdcWWqLZHClOII1ZXhp2b9xcEuEwxvDwQ0hvuTdcQp+gAXSjJaH3wdL4b8Rm7SJHdokJjGJSUzibwiigSCKAkEQkjGrs5wKBiB4FswM0xpZxRMk+3VEpCxfpYdwaOSVBrB6FgIOfifPU6nhn+gMXsQxd7L8LTnDUyxZeXTwA0FEAhQhlAyiDbSfp0y4DKKdenTIqQCUv9ai93sTf90EtQlEm8QkJjGJSfw1QzTMkBnDqRgghy0i4EDcwHuDBtz/QaUwK3+yOOfAATsQUGAIAQa+Zn+O2yEA65xLHVshQEIL2qICBINoQHRGhRtYiGDOrBuFenLKPAMUkMyIAwH0aKuD7w6E+kOqoi873H6PGhK87CcyQWOTmMQkJjGJvzmINkajzwlag+4A4kRctjcK0JkcGikcpLzMYCvNQd/AZpb/PF1HFRF5hDoDIApIAdpci8CDXgcyML4d3OgrUM2Y8W12d98nrcBfcbwSlU4Q2yQmMYlJTOKvG6INcRUDCiCP8M8EgDJbMs559iwgIEIEiGevdgj0Eqfb3bTf7cZRL43j1No0smlqXcJxxC5lBwliLFpANFMAaJQIogVMhKxTwgzABKkmIE+R8ZTvo1JofDLGGOUHQTEMCqWiHxQ1ZtqGsUKpB2ABeCAkHVqHSJ5JG7nc0dLnCCgYURF8x6DAX6vD/u+9r1EJ59f4w02g2yQmMYlJTOKvAqJh1rmSASygHViRaYBMBImImPP0RdhaBgvARiNpA+C/8i2PGrKz3trf39/f22w2DzudVrfV6nV7nVa/edKLeol1qUAKSISGpYDKQ2LSCekUdCpIjp2NgRNBplKoKjWvWvOLgVcohcVCqVSpT00vzM/OLSzPLZ2fDr3Cy3cFwMKJOHYOgIhAIylAzpQHp7a0wwYKQIAD6zfJXD1GWqv/x2z63wJMjNZGv8Z14szPs0Lnd7lcONpq8/eitNG67Su/mQlKm8QkJjGJSXz/IRoMHWIzIaUb/NQIoKACoNzAH0ArBWgQGMAJCII70188Bdg/aW69ONje2N3b3tjffXFyst1sHTZPjlutTvO43Thu9ruRcILIWmkC33EgoEFLhs9QOyGyVpLIuZiJpRjqqemgPhUUi0G5VCoUa5X63PzCxV7nXGxXHC0vLs6Xw+mXiqqEpNEDgtxBV3KJp4iwAGBmLJLn1BDOtD6QV3Qj/e7HmUzSXzFS+Rp8NolJTGISk5jEXwlEy6t/oBBEgASYhTL3VwFBFESk3BlsSJ/XANBqNRqNTvO41evHcZRGNkqTfq/X7Df3os5+Gu8W9ZaqHIW6VTLtqt+vB51+JbEWPAV+AEUDiOBiSC1YBEeZoxo4AGfBpsApoAXPQLEAhSKQ1kYXPaqS202jo8bJlnULB4eLD8IZT1eMV/RMIQgKpVKlWi1PTZfC0IwCLEQATJkdixNBRE25F8fAA25klx/ITOX7gnHO6AO+j/jsq1DX1ycOX77xSUxiEpOYxCT+9JvUn3+nkcw1AwXzRgDCIlY4tewYAdAQKa0MqTPmrY7Txw8fPXr46OnTJ1vruyeHnaSfBMh+2C6XjqanGlNTrWq55wWpJuesc4lzLlUASkO5AIUSlAyAg34Pkj4kAKxACBjBMrADEQCXNSOAlME5SGLoJZBywFQAU4+53OuVG81as+m3W5olCIvluan5S5cvX79x7ebrV5Yv1M7eLKSpi1ObOlGolUeGUCEqGu00MJCzDsHaWU+4vzQUGy1ZnmFiDccPEX3vUNorbWnPALXhLWe1TgBg5jNfxaTKOYlJTGISk/iTx1+uR6dgZpUxKHk6VqIUKkKNRAOX/dOXOFh79vTZw7uP79++//Cz9dXVo60md23JYH0mWjzXCz2olsAg1EKYqmC9risFKhQ9E1goMBQAQgAGaAIcg+uB8gCqABUAIkgIUgIkQALHEDvp2k5P2l04aUKjm5x0+LiR7B0eHm7rjS29tysnjdQylUrlxdmVtPOWsR2PnNI355fL49u1UYpQeTzw2GAQBAZAGhcFfGc3+VEs8jLE+Zps0/fggPLV/Te/5pZHa7sTcDaJSUxiEpP4a4JoMjA7y2UBDABAgcJRLUAvhd2DZvPguNlsdlvt5slB6/jF8fHzo8ZjTY/q9e1QHHQgIChWICxAlML6NuzvQr0IF5eldNNVZwWWAQpZnVQBEETY3obtNY77MjfHC9MCBQBACIa/owAELGCfy5ErW5jrwP4xq420sQ/RMSTHoGI3VXK1CpAP5fCoGnQKwocv+p+3Dp8/WytOLRbrtel6UJ8qzc5W67VQgVIDtJmCs+DYOQI0RIQ01kjgu2ReO0ySZemxr4JuWUrplbjtrwOxvYzP/uM0EGcUDN/omv+Qiz99OiIvq4a/HeL8rhV8v++38D2aNV8/or7D5FQR+T0P/Xt0+houGpL5cX4Hn8LXftdfVZYZOIt+Lx/K9xyiYaZdFBbHIk7AMSCBT2MX0z5s3/303p1P7zx6eP9obytJDgtBc2Y2nV1ov/5aww9BO+AWRB2IGGINR13YeIpHmypA9cZrjEk6U+RKDQABLECHtg/o/iN1+1N89oCB3c2b8J8j+9ZPBcoAjuHEQTSgirED4AyzaR98BRxh/0THR1olbmkKqgtufgWqc1DyAPonrZ0nO2tHjz66v9ef6dN0aWrm0sXFN9++8tZbN+tv3xhvUCCWkzRNFRAZD5XJ21kJjFmk/aVRmowEAuAISjuTLSOi0an1SpDxnVV0/oEXebqi5+AMBrvSnzJxKCLM/I0hmggQ/d6FePg0nXNDVE2jT5Hom5aqv4OcvOzRfH9vYXD98N0XDZ2OJ5FXjiilFCHCd2/ui0A20ZgZmGHUTpMonw2Iw2n13X8OzGytze7jzKQe5Wn8xS7xdF84a1yKI6zs4RLFDGMj6vv3UP4asmiCuREFaaDcR2wkOu149emDFw8/efDF+3fvfHy898woOLcC5+fhyop39aaZmy1pkcae296W/SYdxXqvbw5a6vka69h5El05DwdX08oKgAJowfM1+uie/rffeb/5rV5ddaG2Pzq2hTmqTqcXlhlSgYZIXwAQCSAQCBA8AQuNBmxvmp1N7+TA7/eNUlCppRfPp9ffsucuu2rRpcewcf+Ym0fPn/HOmtrtlExhtnt02Zftgu4XPDp/5TUTDlYA0B4FxtciTEjZcpEJCMYSad+BM88r53a2HND4PPn+zpk/MOHHzICoiAbfAIyj6T9Z+kSdpV/+Kd88u8c/4Uf8FWh4/0b6zP4Hjigi9T288v+4ifbnvxsiJCKt9Xd9qACccWMYz9vA7/2dv834CzzX/PhCoFDhUMgIAACHO0dbuwcHB0dH+5vNg2fNo8el4qPXzq/aeaiW4MISvH4Lrr+ZrFyFagkbh/7emt47xJ2G6ophoFIFZxdTL5X6DGlfpcKAAAFABM0OrT6B+7fpyapOwAfrOlF6cBRtb2NZpyXDYAU4a4SOno9URnB4tE8P75hHD9TzDd3oYYLMSNIzBwd6aj+p1dOyB4ViMrcAl65B2wJUXPmwmdpmqPuN/d69262d7e3ZhSuzixfml+ZmZ2enZ30fNaDObtlKlLpYkSFQmSfc0DjtLwxcMHfnHUZibYZNUCmXppYZmLXWWuvT7Mt4OmKYgH95No7C0T/9ivAVbz7YjTG3PnnpNc65NLXCggqN1kRKhJ1zIqg9dbrcEMFL5d1JTOI7mmP56jnyXcCm36K4PwHif/IsF7zqEYxYdI6s40PrAXnF6vo9niaj43BkCxnk+bJGjn+BG9R/9u8CmCWNLWnS3tgNdw+PPvvkk9/89sPHTx/F3Z2ZWvf8UnTzZqP6HtXLbqoC00WYnYbaMsBsAh13tOPu3NEffW722xxWk0JVFuZlqcaVwC3P8PwKUEBgBAoAgoLSOeDuXhoCVkFduKKXFhBS3t/lWshqWiqBQCgiwBqojlAFOMKNDfO7X4WffKIb1paX4spimqT64FBvHXjbe7C1wdeuJhcWoVKEa2/D/GV4swFru9A4gW7zuNWMnjxePf74QzJL84vXb735zjvvvvvuj94o109PCc7F/Tj2jfZ0gUDjUEKAf+HBema+NVqtZrvpLHvGeEGAIkmSGKWCIAjD8JSshggjGkkRYXac9VQdxGia+z8I5tBXvDkBEGmlkUidoTVkRwXnXBRFSRI7J6iQiNg565wxplAolIvFkcWIRHgAZ8f97SYxie/MxsOSddRjAAKCwdGCkAb7zV8UuWTHdZdd4R/bvY/PLjDMWZ1MKfUXQ2nyFcfT0R3x9Kqy5eTPjnW+BiXj4CJH7mYI2c4yRV7FcP2+zBRrrbU23ykIAIiZCQgIMtK4IvUXGUJ/boiGCIoU+URqbDr2T5r3793//LMPPvnwvz99+plRKbwGF5anlhbCS+enFueSSiHxJULjoJI1W3LdY7e+qh4+gsO2TC+4cxd4egZqszBdhdkahjW0Ch2LAgCCxEKvK7YvJZClJb58UU1XsdsxG1tp6Kl60VWnAULAFMgCGACGZoeevNCf3A4+u0OFGZ65mSxdjvt91WsX99egcUDtlsR9IIEb13H5Mi3W8QaDHMHunqyt2Xt3jhpNaOxvnrTu7m4+TnpNn6Bc9N9894YJ87tW2guAFREiA/B3h4AySj5rtTurq6vbW1v9ft/3/VKpVCwWwyCoVCrGmK8/s373CwpnyrhpmrTb7Var1ev34yiK4lhESqXS3NzcyspKuVTKE2kIzAOQJ5OWqpP4jo5thZkeaTANv2PzMas5qr/i0hb+/q/gK1ajP+tT+D0fPNJSG86ca/8qgog8z/M87zt4bd8Qog1gc9ZNc+jpNUJvfQXjXfLjnBN2WmtEgyr/q06nvbO9v7F5uL2xvfbi/tqzj5R8eWk+DQswNwXM/cNDn1N/f8/T5Aj8eqX/2kVbWLEAUgulUhTfAFobdbl9zOx0v6sTq4SsCeMpZ6PEFR1CF3td6ibUBxKEoJj6nov60ulyL8JikV57TaAEUAXoALTAtqHfkqeb+HSLto91DGplJrl13b31HkQ9V3b8MIZOG6yVbg86PWBAKCvQCoBx0S0uwuJiWi6B50HZg/V16ESrUav28GHQjTpPX7y48Nq5haWZc+cXNIRaZ3gtdo4JMPPiwPFd/+xx5czfcTaJZNBZCyTvEArj8OMVi4CMsOBh4G02fHJpmnS7naePnt67e+fp06cH+wdCOFubuvja5es3bkzV657nEZETJyxZaup7c2x6+b8RlCIi7HU725sbL1ZXd7a2jpstRFyYnb1+7Rpad+Xqa8b3X3EOHjMs/gM+Ln8egojDp5m6tNvuRFEkziGRHhz9z+h8EUAEnTgRQRCljDHG8zzjGaXMsKWYcOacnL/UORfFUafVbjYb/SgCZt/ztNHOCVtLigqFYq1WKxSLKofdIiM3gy/dsQAjEjAICmF2rkZhHjDwAREQCUiy4ftH17IQgAFOWauIuc+z5MkYyQbwqJ0iD479+NXbZS7UYXe6miEB8DCfgVmzEwBAyG9QBpQEovwCmCFjB5AAEDAPFCY4+B4GH+ecDN4BEZEAgUD41MkaUQQBs2w0wlc9jGwAZUnrkTzun4bL+pK0/GVljE2Sfhx32u1uux3FfWbWyiiiTEKgjalUKvWZmSAIRsc84iAFk385f4EVI0mjZqPVbbWTJHbW5UfKbPKDCJIxplwulyuV0T1bRIZfs5z9riQf5ePDfDxPD3K6mo8My3yOj5FiR5RJY9W1bCZBLogZ7KHt5uHhYavRcOyM9oznIYAT0ITa88MwDMMwCALjeTSu+oIzNKM/xaI6vEcc2aXYpnGS2NSCOCCliZwggkXSxvOM8QDAWtfvd7u9XtTtRnFsUwvASimldDbPjeeXisVqreZ5pyswZ935YCzVd7pQjo5jGXyBZ7U48sdAzdPS6Nkl8nTX/iMHuf4WT0AQsn5GIgMDjbMoTU6dWSUT0LiU+y7phxQoqg3f8umjO7/98JNPPn+2vrbHdm+h+vSt16Nz0+D70OjA3pH5eAP6HY77rpuIaHXlgvnPP4O//5lMzdjFWbn+mlvfi0lLP0qP99XmlgdUqM/qS5cSFluruU5LiofSPIR2x/RJpUUjWrFJ+rFLuthoU6ON84vQswIhAAGEAMfSbONOk56+gO0TdD4vLuMbr7ufvYXvvQVxDHXLBUl3dlPj2bAErCBNGXopBPb0O5qH1w3MTcMbr8HGc1hdh82jzd1Dfrb6CH9dv3Dlyo9+/qP/6//jvyzVZ06XvChROiA9nIEwMs54OPpJSIYDQkAYxGYbhqBiwMzK5FR/MHRmzcuXAHJWRDMEcEJIw5R3HPe2t7dXnz+/98Wdu5998fD+vdXVtci5pfm5X/zDP6wsLZWLxWKxCACJTVxqtR+ogYDre6CDOpvIF+ecUsr3PeZ0b2/3s9uffPHp7Y3dfUK6vLJ4/MMfG5GCUYvnVkyhBKe9O0E4Aw5fidLkVUCNAYSzBGr+2+1WZ/X5093tzajbV9oUgpAUsbjxUw8qABZJrLXOKa0LheJUrVafmqlN1YqlktIm3zFkDMv3+729vd2nT588fvBgZ3vbWVcpFguForU2iSK/ULhw/sLrb755+dJlVTVD9I5AMljvziJ7J5bjNElTlzprHTMNT2PWMqAmIoWkkBGYhQXk2xeyEEBYXNa4FwAowzeoMglkmqbWWaVMEBTKlZIZLOIuc40BpFc9HCeQJmmaRIlN0yQR6wSEkBQSADixwKQVkaIsz+OcYxZn2QkDglaEBhFJhCUVYEBCVIiE4kScsDAzKkVKKVKIAMLOOZemjoWRQGuNClEAmQFQK6U8ozyjtVFaI6qRYTPCPpDTw5W8tEV8O9+ecQgoI2+Uye/lDPJjazut5s7Wzura6vNnz/Z3d9MkCoKC5/tsU+tspVq9fuPGm+/8aOXCuZHDJANRxlkdHFH+Agm0VvPk8YNHL548Pdjfj3qRE1YIShvjewqVDrz61PSFS1du3Lw+NT19OmGZCSk7PgsM9j/JjwfCjtFBdlAYVssEUOVfG+VzHlgk40iAEGpF+VePzNkrAIhQhFEISBGNPfXsm2OrlB5kRt3W5urH73/44MH9bqdbLJYq5RogMVvf96dmZs6trCyurEzPztXqdX/keDl4pEOgjK9cJFlA8pPkYPLKV65yPOAxg4gaLhns2s3G3v5eu9F0aaKM5/nGOWGXen44NTMzPT3j+37c6+5sbK6ur25tbh4eHvTaXWut7+nAD5VW2vfq0zOXr1y5dv36zOz88BMdsyaCwZA6e13DVMeAEz0kR596FYn8kU7x+YFtrF59OsKzgzKe4V/jfxBEewUqHftUHDmUDi9k8NhEK9C+ViPOGtvPn9z/8qMvPvmXe3ceHBw3Zmfi+Svdn7wDNy9CP1affFm696T47JlqH9tm0242pQ+4+MCQyMU5niqLmZIrV+TFHnf6vLktewdw1CKLKmVTKvJBnfanYLsEtgPHx7C/j12rpWC0x6bgROJmi7b2vaMOLp1Th8caeikEAAjgoHcCO9u4vonHLWeqycwiXL+a3LqM1SWAHl1elN1ZGyeSMmnltIACgL7AkUAEEAMYhMBAiLM3ePayfWdPVp/CB3fav/ns8YvV5PDQHB9c8oLewqWZ+i9+GUJ2UDOeB0gakOSlhMXgn2zQySs6ezoAneXT8gP+SwNPvmp45MtMNh0V0OCo1W13Xjx79slHH3356e2nDx6uPnm6Zy0AtJqN165eBWfL5eLgEl3qLAkT0PcljYZnAFPeMIDCMAjDIE2irc2Nu3fvxQIA0N7f04DVMAgDH4mWL1wgzx+WZ0QYR5m1Xz1vzmgpnHOj59p2u/Xk0cN7d+60T048P6iUK0orYZvpSbPXZ9YYzrl+FCU2NZ43NTVz4fyF8xdT41EQBhlEg9x18PTUFCfR0eHBk0ePf/fb3zx69CjtR9O1erVcjpO41+uWq1PvvvPewsLC5YsXz5yzT1fzkXWGEFN2/V6/0WgcHR92um2bpFoRoQIBl1oRUUSkkQgZgQWc/DEFYcxHOTOCZIwAFCSllFIiHPXjOE2DIJydm10xF2sDiCYgThgRs5XyTCrI2rTdaTVPGq1Wo9NpJ0mMIoRKK4UAzjkQUJT/H2AG0TgDakCAhGQIMe+OAiKIRIqIiB2zy6wokIiUIkUEgCLWuQzQMipUWhEBOwfOEapCoVCpVSu1WrFSCVVxbPbKqzNboxZ9MnI4/ibfMw+T7i8lQ+ClBNgwKZt2O529vd2H9+998tHHL5497fe6pVKlWCikaWLTZHZhQRxfuPwawLnTT3KO8qyQAAj9hVaLfrezubb6+e1PV589bzVamV2F9rwgDI3nFUul5XPnSalz51dGIZoIZ17rp19Tdk4ApIxMA/qVyeIzzWJGaOmI+AoLiTwrLC/5TebJaGZ2I7Vh3t/b+fTjD3/97/9+cnxSr09Nz8yiUGrTYqFw/tKl+O23Pd8vlspSq40/YcHRsfUqrCwAjPn5c+yvs0sbf0XuzT5yVMhPv9Y2jo9WnzzZWF+Po8gLgjAMkySJ07hYqly58prv+Z4xNk0OD/cfP7z/4P799fW1k8PjNIozXo3v+4VqaeX8BWP0yrkVeKkKhF+d/T3d9GQ8az6YJoj0x4CzEaD7NaWTP4oK8+24aJk/frYLULb80eD0lT+wgdUXi4BlZVBjAcgAQOrg+erR9ur6w3sfvHj4fnx051x57eIMnDsHP3wdLq+A5xc2d4MXa4XNbRK258+nAFY/wwc7ZvdQv1jngwMHCUMZy1NYn8FiVeG+RqRyESr1ZHGJ56YdJri3Eeh+vFeGRsutreLhEdkYikWsliAMwR7R7jHFe2q6qp7d4HfOYVU7AAYnaQzNBh0fYrfrUHVLValPc6VIoHyIsdPCoyPZ3aWUfUIjy1z2LfgOOrD+VO2uqYPIw7I/f4Fev5wGyxFU+hdL0MO42QdO4KAcMz472ar8+p/Lhwe9W1duXb5wvlo1aPwh9M8tZEQAUV7hmTa+edHIcB0/Skhe9ZSzqy28QuaUt0gd/KDZaDx98uSTTz9+8Pmdw729zoBK6RMVCmGhXAJlBgd4AuDhmpK9vtfr7e3vNE8avX4PrEOlAClPNSiErLjD2TUzEBJqAmQQcCwCSIikCFFEnM32QEAghMyrhAGZRJgy4xLMp5oMDwYMoARYMjNiRGZGgCAoVOu1ufn5jPsvgyIgOyZNAKCUNzMzU65UtFZ28LX1AdbX1j4JQ1DK+H5tero8NXoe5a+f5/KK5Ddkm73WmoUzoNZqNZ4/ffb5p58eHOyFfliv1ZTxrE2EZZjrQ1KeotS6bq8XJYlX8JcXVqx1YaFYq1er9SnPB+YcczMDAmSQLrVpr98/Pj7a2tx4/vRJ3LeNymG1Vu122u1Wuz47t7S4bJPILwTj96WGu0pOwRvKWZi77e766urjJw+2t7ajOPJ9P/ADTSqNY8eMAERAChmJWU6pEd+KKwLAgJJl0YRFWEBEKWV8D5k73V6c2Eq5cv3WzWq9XqvWRwAIAxJm9WGW/I9ZwSvpHx7sb66vb+/sHh7s9npdYEYgoz0FkjoHIoQZURhFUMSyk9y5DgEQRGe1VgaX5zqIkICYgSWrsmJuTkUgjCIuE9AIMBJqQ865NEldmnrGm5mZuXDp0vkL59EoPwh/r5vFUGWGebJdWEQQ9WAOuzRtt5pRrytsFWmlDSCyMCpQyiiltTHKaKODcfbDHwDr2EVx3Gq1Dvb2NtfWnz971u32ysViuVJJ4simURzHRzdvpUky+irnHCgkUMPOy/1+v9k86XTbaZqiMA0a441nHlBACYC4IT0gqxHns46dDPFT9giExYlzIoSotdbGq1Ur5XJVaZVdfK/XPTw82NzaOjk8jKKYbaqMDgrFIAxrU3Xj++12y9r06zdBGksKI/xh2ZjfaxWHOXZTY6c7yZypBER4DAdSt9vZ2t588vhZy0H18LjVbLPjfr9fLpdRqfMXzqdpqkYIAAN8NhS4D/MAeCbLPajFvAylz8oCRpUaPD6CrHVHBwf37z+4f/eLbrtTqlTCQrHf6x23mvWpWhwnC/Pz01NTSNTv9Q729zc21tfW1o72DqJOVxtTrZYLhVJ1ZrpQLPd6PWb7xxRNsinDmXUUZqltAIB2s7G5sXl8eGgT6/me7wcAyOgAARUpYwrFsFKu1auvzESOsxEQztSss315uOH+OSAaAgOkCMKoBFAwGzljS4cIOgAHYkUgTYrKG+7oW1ud//Offvvx7363s3a7ik9fW9r7xU24cA6WzsF0HazoF+v6dx9773/Ku/v22uX0H38Zn1tK7jzS/+2fZG3DcIInLWp0VM0Ha8gvk1ckZahQxJUpuXq1f+kyGMTjAzzc8TsHqlRy/dRubmHn0OnYzUzJ/AwWS95BS1lnUmdWn8qTu/DiHL5hYl0TcEKIihGdVs5qTAFcHONxwxS2zPYGfHEHPr9DL9aUNsZXCIktmj5QGjX5y0f6N7/1Hm0VqOBfuSo/f9f94w+lchGgAleugFi4sgTdBmzv8r3VJx/+r84nHz9/5wd/97//17//xS/eHj4LFgZhBCsiIGpQacpoNwg4GBfDAaEAaMD2EQZQw210kB/Ls63y0okYESlP/AIL5nwLAADY3dt9+Ojhvbv3XjxfRYCCUSGhXyxdvXb16us3ZmZnR7mWSAocD7xEAAAODw8/v3377hd3Nrc3+62uCBAAE2ttjFYCmPleWrZiGQDJGAJ0IJw6ACatPPJQITuX2DRJUwFQRAqVIsIM6gmgQh64NwKAIiJFGSHIObEudey0VghkRXxlFpYW33zrBz/72U/KV65gzvsRZy0zaMrH59T0wrlz5y9dunTlwvLztS0CCI1uNptffPll36alSuXi1SvlqenR5YlgtOXq6alptGI0oKxIVh5xqbOp84ww5P0bOu3uzvbus2dPt7e2Qz+oT02bwLdJ4tgCAjIwiFLaaJVa7rSakU2DMIh6cbVeX1xaWmgvJElSKDIzD07cjI6Y2TkrThiEBdhyGtkIoB/3Tc9rtTtNy16n48R5QYjeEKKhdewhIIEAsGUkRJXBXcxGaafbWltf/eB3v7t7736v1y0Wi1P1Kd+YOIqdTUFAMCv+CeCgYPqtEmj5loIZ9UycczZOxYrW5IchCDea7SRJ5+bnWeS1G9fPjewx4hyixsFkGAWKadw/3Nt99vjRo8ePNzbWGs0mp1aRCrxAK4zTVFhGyEKSEcZybEDgmFnYAQOAAkKk3HUmG+oDFva4wJkHCyUDESlMk7jdaqWxDcPipUsXe/3IC4JStVatyVgKUQBRUE7lKaNdJfLqm4hlxszhMztltVovnj7d3dyIo77n+UFYEADrrDK6WCxWp+q12lS5UlFlT6PK0xGn9L2v4yllMu0kSW1iExtHSRID+Ekax3GSJM7ZNMs1jmjCMgRJzKDU0NKn2Ti5e/fOk8fPGs1DYfaMUYTMQIhKYY6CMJvj4JwgCwMrIkHUgyycZRbnsstWRJ7ni0jU70VpqrWulMvzCwtXrly5fPlypTYFAFoZZQySZpbUcRwnUdwHxIJ1jFDicr7KfM2A/AOR7J8w358TPIcJodOMtgikSdp3GaMZ4iRJkqTV7lrhKI5JqbBQKBSLnjGnOSSRoauwOBv3enGcAIP2NCmFpCQ72WOWjoEsOwwCLk2ddcJCiL7ykTBxaZIkjKg8v1AqagQEcKO5amf3jw4ePnzwwQcfNZvNqampSqVyfHKyvX8wMztdLFffeeddIBUEPimVJkkUJza1qXN9y8rGShMpUwXQWntaK2VekcvCM34YmXHVoAA5rG0OyXciiU197Q1f9PzZs3/+p//52SefthvNcrlcq1dRUWIdKPACvz41de78uWvXbt64fmt+fm4khcb5SD7tr3EK2zC7ggxUj05b/A+FaDjMojkAztwHcvR8SgnOiFHZb6BRioLwlMObwP0v79z++FeffvLPtvP07QvRlRX6+x/q6zctzAGg7m6bO4/12ia+WKVexN5NvnQlee/tZGrG7e+hpOhYVrfp7qpathIxFqtYqir0tCUMiunycnL5PKc909n3eiemR9ZhTD6EocxX06oPly7KzatcqIJTuHUAG89dJUBJsNPUrp3oAEBBqQKzM7g0A8cHkvTSfg9ebMKn970XO+rFc/rVh/D5F9hoqblZn60AS6dDZpeev6A7D/Svbvv3nnva9za2bdRW3Mdf9GH2PPhz8HoZXu/77qT4+R3ZO2h8/OXJ9qO1uNtYnA2W5iqXr10d4ezn5OuXhAKniVMZnNpO+4ALgNAoCXXk1UP5oYySdcdUAgI4WFKP9nbXV9c21td3d3b7AAQwW60uLi+fv3jh9bfefOfd92bm54dvrUgZZfLJfEr4aD568PBXv/rVg/v3GgcnIpwRLTyjPE8LEDM7dja1mQ+AIkJCAWDHiKCN8bRBRc652KY2TRlAa1SoERBlkFskFBC2zuUQDT1jUClhTpnTNHUCngYASi2HQXD16nUl+MaNa6PLn3XuDHH5/IULb7759tHBUa32tN/t9Lr9vd3drXZHHj66fPnK5vrmazdeHyMF49ApCL/+cDyco8ojRWBGDCcJIIr6zUarEdt+3AGl/chLkkTYAWLmhq6U8rROnWs1m30HhSiu1ztRHDMzkdJaA5DWp2lVFBQUESZFhrSntR8EYei7Xmw8HxWR1pQ67Xl+EAQDV5FsLAhnPF1EyNKRMGCm5RtF1Ovt7mzdu3P3g9ufZ69anK6FYRhHUZokwOwkLx8TIhF++z2NBQiJSJQCAHYsqeWUSVMYhiJyctKwzMvHJ1cuX457/ZGvFJFhAO1ErIy6RKdJ1Dg+Wl9bffTgwdMnj49PjtMkVYRhUNCKrGPnrOS8/0HuDEkpUkpnOaEkTZ0wKjRKk1IobFMWx4iEhFrngo8sY5ph86w4S4SkiAiiqH/SjFKAECBK4oWl5UtXX0vTVEaM907THqOMFjxDJQcRsc55IymPdqv16OGD+3e+7DZbxXKlVCqJQJRE2vdmZ2fPX74kgn4QFJjhNKHwh5VlEAFRKVLGGM8PgsDZrh8EfhCQIue0H4Ym8M/4qQqLdXZUBt5qtR49ePjB++9vbW2KcCEItNZsWSEqrWCQh+AsQThaISDM6zZEzMzsmFkEPG2C0GeRdrvT7/e1MfPz89evXwuMXpyfyyCa8Xw/CPxC4BUCPwxTZ1OXighpbTyvWCqXq9Viqai8M2jglGSCg8yuiBPJ1k/8CqblGeYP/b6RztY6RfRqmasMCwU4wk41xvN8gpSh4CsvCJzlDNRqrYulUq1WL5XKo2NptHzS7XV3N7eODg5taj3fC8KQtOKs1EKDauAg7+KcE3YsrFD7pEWoH0W9JFLGVOtTC0vLtVoZs7SbnFa3263u9s7Os+erPYFmu12r1fb3D/sCJ+3uzs5unESglBcWPd9HpbXKV6O4H4GIUsbzg2KpVKpUgkLhlR4C4yXlP3hJOfXLl52trQ9++/7/+O//vc22BDA/PycE/SgGRZVa9eLli72oV6tPX7505aXqv5wqPE45bzAU8ciASfStvZm+DUSTIQ7LK54OMesXkP0N5WUScah0ALnSu9+HtRcHjz6/d/v2/4r3Pjhff1Ja7t26DCuXdG1BQQkgYPCliHLxUrqybCpF3W2ak6N0a4cWF6EbuTBICwVqdOjjhxR58HbCl8/JwqybmwIHtHOIscWZGV3wRVLdaOqUVbkoc3NUnYJzS+7igrPOnjsPV9/AQhlnZ7hi3MYFrBbx+s20uuS8qoNAQEPdgwsoXQvtFp4c6INDeztRuy0sFHB7Q9/9XO3tYaWoZuZ5ZsGmmDx+wVEPnzzBh4/x8ATS1CmdtFvy5JnSEKYp/SO72R+kUHUApFAbj2tVuXIezGFX4ju3P5wXG7zzTv/GrStzi8VBnZ8FnJySaMbYIjJC8R0ZIXhmnOIrTl2n5+AsrSYi2XIw5EV1jo8ePXj47MmTg4ODKOpniSJGnFmYe+OtN378059ev3WrWq2PCGpIKc3Wjn5GktjGycnu5vbW/uHYB6cOUvfKg/mplZkAxAnEyUtaLAFIf8/Ee+lVkc0z8f0o2lhdPd7fT+J4/JOZ1NhEmJmbu3nzZvPkxFNma31tPdpOJU9L7OzsPH/+/Orqi7nFJeN5I3ntEe62wBkSN74k+lGKlBoTh4aFgqd19mI7rHMDChEgonM8sGbJisrZNq219jzPC4JisThciEexIwIa43nakFaKSCtFSlHmSq4UKqUBPON5nmdG9WunUhVBFCTInZUH98bCqU067c7+/v7wVTtHjQAbsfwHmhLjoJMuAGAMaZK41HVAAKDf7SZJMto0FjNq5yB1cIYpZK3tddonx8d7O7tbW5u9QQnlpJdogG9YUEn+8F/1ARSC1mi06kd5Oa0P0Ot20zRl4dFamGQILzuvD9ZfGS+qyUAPJI7RnI6yTqv9/PnT2598enJ0XKvV67Va4lyn1/ULwYWLF3Xg1WpTs/NzOJ4wGif3jIsShl8sYUaLxEwMQVlukQBQKUUg2hhlFL1EYSLm0Q9Iovhw72D9xYu11TUgqJSKSml2TgFqpTJRmmNnhVkcg1D2JWReb8BKAJUaTVFrrYPQt05arVbUi7zAT5Nkul5tNRtJmp5Kbogkr+QhEnFeISXf80qVcrlaLpbG0ICACPMIoQEBIOn3Dg8Ojo5P2q1Wt9t1jgGBFGqtFRLkBe2cdsDAiJgT2LLKN3BWIUciUpQ61+/14yRVWk1PzZw7d35+fj4shAOsNihJZrT8EaiH2UnLI4hYGy/7fQvgrFNKFYvFarXiBX6+jDMLyKgt+eHB0d17dx8/fNxrt8MgLFdKxvNcxlDL0uUiIA6EUDizvmRhAlKobWo7nV4Ux2G5dOnyZQAol64pTTQKfwDSNO32ej0BAOjFNojjaFBfsJYH9Fn0PI9IDZTOlOEbRNRGGd8Pg8ALgpcbRmdf71lKX3YeytNJp0UlHvxYq9OjjLNJp90+PDhoswWADgDv7TuAbJOIkmhpaUEp8j1PazX2yZnE4yXW5lhV9TQh/S3LCPpb4DMBFFG5MhyYRnKLg8QEooikiUKEAaXi2dO9//b//afPfv2vUeOTc0trP/u7ZH5RVaapXDVbXW48lZkKT58DmHO33rI7u+r5M93vmK1N/1/+PVnfSklxu+sKRW708PNHar+HypeLC+78rN1ecoHPeyfe1rEWUZ2mqoTKOiwWeflCeuOWO7/sNCWdLnIq9TlcugxeQBfm8LUpPNgB5cHMeVm46LDOgACCqggrBRGyjSN89sx/+sx7viUPtsB43DrGw4OgAHRuJX3j7d7Fq/1I0t/cpvVVtb9L7b4szyeLi2kQoNKq3zef3Sm0W0Go+//P8w4WHEC/tYXru6pYxf/8j9JN4OmLvQePPlh7Hj19sv+//W8//+U/XitVslSqFnG5aT8ICA4E6zKi0Rzs/TiUaY4/hSFgG1YtxsoumQJJlFLDUd5oHD28e+fjTz568PD+ycmJIpXtVt247/vB+UuXbrx+69z5yxkPxDmrtM75MESji7unyPeCMAgLSL0R6mumRHKD+mBWEuIRp1kDYAYSCBmwcBUCEdis3sH5y4c3bF/yennZ+iX7SRD4nqdQjS5w2WYzRoguhIVLly42G412u3V0cBDH/Wy6esa02+3HDx9NT89cu3lj5dz5crU6wC4gLKcr54hEDv8wlWsYhMVisVKpNk6aXuBXKpVCEDiXfQ15JgYAtFLWOSQM07RcqdSq9XK5XCoUgiCAr6bEaVIaQECstc45B5CmKacWUTSC1kopdaZjQkYVzBZbUgNmswCAA1QgQgBKkfG90a9aISh5Bb75dqRcgVMdKA7IMUZDYAKFIAKKlMWkn6QEUC6XwkI4mpgcZDvkJV7xkDIr2WFTjYyabFB9DUqjl8ihavBDO/5DHBnb2fUrAI9AK/I84wW+Mv2klVoAD6BQKoXFMAxCrc2pkwAID1NINCSNj6oEcgJ6Rj8c3X273fb6xsa9B/eP9o9mputTMzNxv3/S7oTFAjOvnD9vnSMiPbrNZJ4uQEN+eg7M5azvz9ARxjmbWmfZWZs6duyy5KnAmc4imRUM4xkEmCZRvxslUURasWOFAtaykLPMgk5swjZ1iWUnCBoVAopzCTOIJSCljdE6694IKAAc9dlZG/W7aZwqQmetSzOnEzcCGmwSx3EUJ2lsrWVmYBARbUzgBaVCKQzGBlKWLkNmNZJubLe6q89W79+7+/zZ8+3tnXav49IUFYWhb1ROUFGAQijCzrGIc8zEhCTZdEIil4lAFUZR3Gy2UpuWS9Wr12789Kc/efvtt5dXzlUq5YHgkrJsLgOOLlbMTkDyHDUzO5dYawFSmyJREIalcnkEVDCA4Mit7e7ufPzxJ+//9nfHBwelMJiamQnDwGZsT2JwzjKzS8EhgpBCrbQACAsy9PvRSaMRWzs9M/PDH/64Wi0vL8+Xq/XR5S4/Vg2u1lMQeF6BoMtgAIqlYlAqDE6tClHEOpvaNEkS6xCAWUSQBm2Ex9LGICIMojJx7diokoENCg6JyiiQK26RUJPCAYpsnJxEcWyMyjYmA1AqBFEcx04QoFoqzU7PLs7MTFWrvucN9TWSi3pzgDhq8Zt9OskwCZm5aOUbOcg3s+HQ32rdRIZsPxYCoOFcHppyICqiovJxoPo4abovP//sg1//j8df/NNK7eDCO/CLd4pzy37TyfaxPH3smsdetRC//Sa/9xOAKfvmreRHb3sHO+rhc3z/Q/34uX9uJT0/J1cuO6dx65G0n9FrFyDu8tT59MIiXDxv5+flYB/ixG+1tK+xWrPLy8lrN5Kb1+zKEoMHEnEUgy6IqQAYrs1BDSFeBuuB1MFUIEXACLUghIDT7jzC8b5ef+7v72DXJc3EudT2YkcAMzV16XJ8/Xq0sNhfXYPbd/WdO0YTXb/C715LpqedVm7/0Hz5oPjgceX4wMyU1dvX3fmChUP55EH6aFNm5oOf/AhL5fS376dbG88/u9ft9TrTU1yfcW+8AaXqHABqFeTV/IERk3ylQBAGA2Fc//UqPyhEHK7pMlCADwfNydHhvft3P/30k6ePn0S9frlc7sQn2eD2fH9ufv78+XPZYdKBdeJIFLxKsx0EQa1aXVxY6LTa7VaTkAgExSoFSMjOMYPSSitFSNa5JE1FxGhtgkAhxtYmaWKtJaVCz5jAz1SEzqXOCgoSMwEikqA4FsvsONvFECkjWxAzI6HxfBHpdbtKqYXlhUq9ZgJ//AtRatAMnsUpIkS1sLBw9erV7c2tu96dOIoAwAOoVCpRFD169EgZIwi1er1creYiZQEWQRkK1hDg61WerzgBTU1PX7x40fc84/vT09O+7w+fsmO2NkVArbW1ttvrpdaGxcLyuZV6vR4EATCDs6C+YkaLyxbKYb90pZQ22ne+BBwEgVYaXyFBlVyMQZjlSEAEGEAxABjfVGu1xaWljfX1bso+wOx0LfD9OE2ds8MtHOHUmudbJs+IIN+dGIiMNsYzipCdKME4TajbVUT1qXq5XDbj/pM0lGm8lNlTShUKhVq1Ojc322k2/eOs0ElhGGqteUBwBBwnQGfO4yDsXObGZozW2hApYU6tc6kDBIWKiLISHQOTJqWAiDK/EhRQWoVh4DjU2Op042K5PFWbKpVKQRB4nje6iLNIJn/56gV51BIKRzLZUfOkub9/FAHA0Qkgtrud434StBpL51ZEJPAD3/e/boSe6r3PriGEqJTK0mk4Xs1HAjX245FL47HJwc6lcRL3+1Ev0kYlvg+GXZqKAAGySMb2s5IKCimliTKAw2nKGbGQma3lAVq1iIowSW2/20kTJqVsklqb2jR1IwYleWM352AwKQBBK+37fqFQ8IMg8IMhYeBUwDl+iIm6va2NzTtf3Pns9mfPnj4+bDUTAAQoKvR9w5J9RRoQRNjZXA+czYUs96j0YGwhdXu9yOXj6/DwcLpeX1penp2bh5EeECL4qgMDISpSpIGVMUqpYUc+pVTg+eHAmk6ArWMCwdO5zoeHh/fv3//db3+bnUJnC0GpWLRsLQsDMzvrUussONCInuf5xsecdyGdTrdhGQCqqy+qlcp7P3w7jfsA9TOT1xgTFgpljW0rlUqlXKlY57pHjenpar1eLxZK+Y0opZRCym0IiSA7BGpNxpi8JfzZsYp5Fg1eUmvImEwgQ07sGCmTYufrZNLv7e7sddrtQiFcqtc6nVa5Ui0Vi71+37Q62ujp+nS1VCwGxTAIgsAHAMqfBQvL6KF4zOFugJoHeh4EgG9XXfhWphuYoTRUOSsIs39yFaJYAiLQGT7jPtx/sffxx59/+sE/99ofLS8fvLYMc7MgiO2m2juJH67JvYe4uuX7gd46sWyS168646VXr0W3NuCwSXdfUKurp+ty+ZK9eM5Nz+FBkza28Hgfm8cCDlYW4Bc/ceAljROZrfJSTZdLUKqk09P23Eo6NQ3gM4BihjiRVh9Uk4lEpWAsCAEjxBF2LKUJcQ+KWqopm2kHRbl1FaXDMzX9cAu3unDccccHNj62c6Esz0f1QqwsnBzCiw2zte9dOo83X4/+y3+KF5eZe3D3vjvcNw/Fbe8Fn90Nf/W+/WmKh634syey3eCZczQ/Z+or8m6SbmxKFO0eNOSz24jkjo/gx++UZs4VTkehCAAh0oiWR3CQ+8axPJG8zKSUl9z5hm7SiGdVx8dHR4+fPLl379721qYxXhAGtYJ/0ouz01itVkc8VZ5y5giUcf9lLOFstKlUynMzs51Op1IuZ2wkAGsUCKB1qTDm3uKEAJBmKSKtldbC3Ov32t12HCdEFAae7/ssgknqNJmC9v2C7/kGiQFE2DrLDFZEBGggnFEKMzGf9nx2rtfvKYK5+blSrUpj+WogUplxloAwszBr7Wm/ePHipUdLj8NCIUsLhEb5QdDudJ48eZzYdGZu+s233xo9uTkrWU+zQSuUsxIedhz1+91+30aRY4ciQTEkNEgYeKbTak1NTd28dWtpcRGVqVRKyhjMhYHghJkdAWhtHHOcJEmaamOqU1OVSoUdNxoN43lhoWAZMra+0koZ7XtGkURR5JzNqjnZ09dGa609Y1LntDZKmfET6pg6fQyFi4AIEvpBWJ+aunjxYrvVbDXbxUKhXq8a7aVJkuX5iAgH58pvl0ATEkVaK5U6a9Mk6kVJmjpmABR2TEyCAhL4PpHyAm/YMfb04SKDUL44joMGrXS5XJmfn79w4YICbLSaaZSSwiDwifTpfkyAxDn3gEEol244YQQhQdJZPzGVCQLYCiPo7KhgkcUCgjFGe+Qs93q9Tqvd63YRQBORMp7ne1Y8z/M83xijlYLxbAEhghB+Hd7PHg+ekeQ5Z5MoibJzHoB1LklSAIgcAHCxWJyamgrD4gixBr6R0WbmE5ZVpQiA8j8TZMrZ8dwbAhAQjzdmi+P4uNnY2d09SWNIodvreUo7Z+HUZwUIAD3wfc8PfaUzDhoarZ0Tm6T9OHY2tdZZC1mWTCHEkvMhmict4++sHC/3Op1hoZMG2k8EUkpprY0xbDnr+TY4wsCwYj5MypzpKmdd2u10To4O9vd3t1vN4bDtOOn0fl/h2zF8ReKfARrHx1G/h+LopdM1IJ5JJmUOyoSEACqLwYNUSpHS+iVaG45Q37qd7u7OzpD5cdCLmr0o+SonhzguQDwEeK3BRTcT22430zge1g9PvQFESCnPGM/3jY2yb1sbExCEYSEIAmP0qPBl0HCCiFABKqVQZ3TWrzQ6frljYZavkLP0V2FmNa6U3tvbW332YmdnJ06SsFAQgsD3tDGhiEIFCsDxyeHR7vZWs3E8mqJmZuucGf9uxy4yQ2bjMoYxA8I/PUSTUcntoJ2kUI7PBBmE0VkXGVRDcs/a04P/z//7f/76N//s4o+unX9+6yrM18FZ+Oyxi1rdViNe24VHz4LHOx4HYTNyVvr7u/HKLNem4jfe5L0TtXuie5E3V5f33uQfv5OeW8HjY/WRsCfSakC3h9Mz8g+/gNd/YJFtJYhDVOwgts4Ba4JWC5tNFUWq06ZWEztdiVMRdgBsPNaeNoZIawBMUiCU0LP1qizOQ63mvAq881P1+i3caclqA9Z3YX3NHqz3dQLz9YhS1zmB5r7XaYbaBCsr7gfvRr/8e4Y5gG1on8D8VDxdiU4a3tqW/tcPinsnmBJu7UeoYyKVxhaEL78G/8f/AbOz8O+/2bv/7IP/+f/rN490xZv9xdKt7NjMLJI5Pmaa6wygI1COzygX3QEPj/uZ77oMJQev6sWXnXGJxqqCLon2dnfX1tZXV1eP272pgj81PV2tlLTnzc7N1aemTnPmGQ18QI7Ik3LMww4z2tOVWm1ucSG2aa/bIUAkRcplazdzmuUgsjGtFUm27LAkcdTvxbGNUClEYOAoTa2wtTaxFkGoWA4KQaVSD/0QCTP6qmTae8ip6aQUDUCoUoqZ4zhCovmFhdp03RuHaEplSYGMFu7MQDTkF8uzM7PlSjksFLxOzxjPOddqtdu9TmzTqzeuNVsno8tE1mVwBP6enYn9KDrY39/a3Dw6OnRpopAKxaJCA8iKVKvVMFpfuHAhXVoCgCyVIswjWSAkQqV1RgxP0pRFtDEicnh0GMXR7t6eMSZJrY0SIAwCLyyWqtVSqVzmNLZpInnJLHMqFEQUQWGwA4uIM5XOMXoy5qTGgRujCsLC7NzctavXNKlev18Iw1KpRKRckjjnQCuNmf6TQVC+YeN5RgDHiOj5gdIqjaNOt3tydHLSOG43W/1+lKSpsy47ezCLoHWWh1yTUaA3tIDC8RXTGFOv1S6cv4iI9Xq92+6maQoERmut1GnTDso6AACjZHv0gBqc/0fWIWBgeIOjjdyyFpSI5HmeIor6/b2d7dV0vdlqujQGcKR1EidJkpgktTbNVAUop8kwBCSknJWMQ1Xfae0cR5ptnoGnzrlc9AHgAfieZ4wBlyiAYrE4Ozu7uLjgGe+UkZmJQU/ZOyg42p/x9KSXyScyYtOQxcCDRAWAsGPn2L3qoY9mmJ1Lu71es9vO/rMH0HOvKC9TAuISQiIP0XhZgg6BHHMcRX0L8Sv3qezMeXLS6bT6UZ+HFFga+ERk5hZKCSIDW+fSNE5t6qxN0jRNUxgYkeU1Whq7fERQGr3ALxaLVa1bNjMGghCANKR2YDb+KgHGsLxBBEaT74e9OG4l+b1XSqVKtVQulYcJsJGjUr7cvyywdQADYeswaeSy6oL6CnxPSEOLgOF34yE4AfcqrOAD+AoUkVJkvIC6nROX1/R9o3zfeEMC3+CeeVCvyao8zDaJ4yRJLENOuhig1cx3cNB0BbODbn7mcY6ZQfgV6oCsnJc77J4yS+QVvlJZTxQFA4uWVqvz/NnzBw/uP3v69PjwKE1TcS6KEsdCRNrTCHLSOI4f9py46bn519/6QTDI+Tlm55x5iT+Ro7SBs/nZ0sQ3bxn4bbJow+QNZvkzpqz6IYRIotHoIdcnSb/84rP3f/vP9+/+0/XLO+++Cf/wc5WkwW8/gE+/gM6hLaJzFjzgwEArUevr6ncA3SN4543ktSvp+cv26l7wdE0dH+qZqj6/aMNr8KOK29uzPomvuBBImiIYmTsHc37mHcgQMfTBdeG4BQdHcLBPxyem21H9rkoiinvc63JiVQKSGiBDgVZFbQqKlBETpGFBamXXPISlKViaFz3N3pK9sCLLPbl4wJuL6e6iRG0oGVspQ6MFNtHCJvT19DQvrwDM5SPdxaBJ6rW02u73kvDBU93u+6W684vx4oyUyjaOAHqg5uHaLM1PsWPY3W88efbFl6p++fzKuZX6hZuLoIBIE+lB+ZJH5rcM+dwjfTdcZgQ2Iiv4GkkWnTnp7u7s7mzvHh8fd7o9AEiSBAGKxXKlZs6trMzOzfqnpgxjfWhelqB7vj83N3/pyqVSqRhFUUaSBSWkEACds8zCzCKitA4D33iG2TWbrZ3trWhn12WYQBMwO2aXsLVJklillHWOgfxCYWp2rl6rBYFvjHJOrLWcZ56zQ2Ve48oqnqlNUOmpqamFleWgGL5iUiGIMDggc7rPlUqlWr0+NVXvdbtBVjDt97qWD48P9w/2jo4OT8k6AyEPIn6VID/u97e3t7788su11WdRr18IwnKprEg56xhYa2U8Y4zOeuacejRks4sGhkmZ/gaRRVJr4zju9aP9/QNEJEUgkMRJGsVKq2K5NDU9NT8/t7i4WCwEIkJEpEhGljoWzp4CM78qjYWn3UNO7eYlQ75hsbi4uNi/eXNqaiZJE9/3wzBERBunjl1GiUaV2VyIfDOEBiwsLEQUhoHWJkmS46OjtbU1WlMZ+ziJY2udyTbsrCiCw1kxKiIc7k9nILPzPH96esY5KZZLS8sr/X4/tWlmuquIhAciXMopnUOINlbJRhh+f5k9AZ5KrEGEHTORKgSBImqenPief3h8vL3D/TgmTUbEMVvLzlnHjINcGI4ITYiIhUeLGK+oIOIrOi0yg/G8IkJHoFwtF0ul2KaNKCkVvHqtNjMzUyxVxvDciEvIWObmJS7aMGv+ShVzVqAUZgF+BY9v5NeN59enphYXFtZ2dwGgTEYb5dIYAJTW2UzOelRorVSWIkXMagpa6zAIlVJBmjrLkjENEBApTuK2y4mtC4vz9enpUqk05JZx1uwCAAkVUSYCsJmZi8u1tzIwNUXMGw2LEcgo/8OjnSY/DMrVyszcdC/qVno9YTbaGN9DRGutTW3mepglGvE0i5szTEQYAXw/KBTCJHUHBweNVqdcKszNzdRrtXK5FGaUDMmzUjg8KI3jLBF2GTQWN/qkMn/sNE2VH8Bpx7LR/oJUKBRmZ2eHNKyV2Rk/CPpRP0oiAUYApVAbrZVRpMAJOM5yUYWwWCqWYH/vxEk1MMViKQhCM0D8Z4ZFjloAXOrSQcdy55xzTtxItpKHKo6MWjg8U3L+P39wrTA7R57lNhANkowZC+34+fPnDx48ePHixUmjkVnDWecgBd/3Pc9Ym/a77eODQ8vu/KVLGxsb8wvLMOAlMzMS4cuZTnhFt49vHd+Ui3Yq+cVB8kwEWMACKyBDCiAEAJfAxvr22p3bH3/yr53Oh0tLO2+9AW/dgHOz3rO1cHMTnrxwPuPKJbmw4i5bOL+fbO3S/gntrePd2JQ8WVi09SlZWJSFebARkqgoIrAE0/zjd2yp6IDlwiJXKwCOoKWSBPs96Jxwv88WwBns9nF9yzx9rLa3VNwjQ+IbCRS4VMWpaiZwlGInVshYUlQLsFxztWkqVVWr5R3u8LrGetlMT1O1iqogzheLrh5C6QKQw1LReSGsb2F4H53DbhOaDWk3BXoASNv3vQf3YW/PgHKletxrcy8Omy2uVuXCgly7CueWIQgAbJYLpeplfu8t2FwDiRudzhcfflBB2Pvxwd+//e67XlWd7ja592bedl2GypWM9EwZb4bgK3p6ytiBeKgfGLgoHRw+f/Zse3Oz2+1mPVStFedsIajNzM9cuXRleXG5UCiO0N1O+cRZdnp0/QoLhcXlJWNU5/yF1KaZqZToQZU8TWWQfigUw0qlVikXer3O4yfP+v3+5uZWt9eLU0ukBFS2WyNqz0NBtJb7cWSZq9PTb7z55qVLFwqFYhInvV63H8XMNnUC4AgIiLJyFTsRENC6VCrOz84WiuXx0/CpOXvuwTzI0oeFwvz83MrKShKnNkmsdTa1AJBGceOkubW1sb25Nr+4rJRRSmktIyZYo8LsfNtL0+Tw8ODBg3t3vvi81+lWiqV6bUorHUdR6tJCqVgqF0ulktI6J684l1upZa4IiCrzcSBCFOfQsk2TNEqSJLWcWkax1sbdfpKkxphavba0OB/1u57ve2ZOG+N7fp6cG91lv24ZyXNmw5Z7ObVMUCldLBTn5hcVeYtLKyLOmMDzNAI6m4qTjLKRQzT6xhBNRKy1Wmvf940xjnl7a8Myt5rN4+NDQMyNGFhQoTJGGfB835gxRh2DMLAaNd0duTVj/NrUlOeHU9Oz/X7P2iR1DmXAopIBRFOY+dI5HJiPACABDWwJso1GhAFhWGayGacYxVk2pIPQN0S7u7u9XvToyWNGSKzznRitBh1AgQiVUkbrnJFzpiw1yKQivqwdy7vMjHfJFZdaIgo8L44TrY3OWh4CeJ4XFsJSqXRmL8/Fg+NHDBxvIvmqmsrQAATzdHSW+SMcpaNlwIjGCV7TU1PvvvcuM+/v75NgoVBAQpvGhEjaAIBnVNTrNU8aJ63jTqsTRXGSJrFNlKDvh5VaqVQqlkrlYrEUFgtae1mPY3a202tbJ2EhnJmZvnTx4pXXrpWrtaGSN1PeUJ4+p7wGJrlxj1IqCLwwHDvIGa3POP4jKeN5QRCExbBYLpEiEdFG+16IBHEcp6nNysdKZaaCGU0WgUScOJs6lyKzb7zQ8xWx7/uhF3m+HwZ+GPie54HW2bWNLuNshc1pbwZCBUA5hh8ctGgEW2c3O+RFnWGkVKuVCxcuvH79euPkeKpSnZ2f9/2gH/eTNBFgAiBNQeAbbdLEdjud1nGz32sjKuN7ynilctRvNHwv0NoTVC+nTSlL/FFuzMkut0g5LVDK77d4+bZaI4CRhqeZPcroDDk+PHzx/PmTx482NzbSJC2EgQ61sw5QiEhrcozMHDloHB+vra7ev3t3eeX8zPSs8QwihkGQnUb49HhDZ3xw8qP7aT/U/1DrWpRh32LKSh45/wwYOOEkVKcplv3Vw//53/7HZx/8j/XDT+cW1m9ch5//AK6eB9dym4+TF4+9owN1YUXdeEv/5587rrq9g+TJl+nvPlZffu7tbaoXs+rmG35tOq3VcWGR444Qy+42Xl8nmpW5Fa5OiacFA4AE+g2ztuG/WNNPn8LWBnQjV6hSdR5VgHt76uljtb/JGu38NC/PS7mMoYfUVyd9ap/o3QbEPQk9N1WxcyKpwb7oY1bcVb0TsBEhQhBCWIbqDM8vyNIyLc3h7DwtLCsouzSU0iyDShuM6y/svXuyMo9J5H/+2/CDD9WzXekbF5Zi33cFcgtTcP1c9O5Nd+MmFGcgRAAHcAJQYUjwtQvyv/8jTJfh/Y9XHz7sbG7/evdot1Asvf7jm8NCunBKyqOBLoDFZVAJeaw55nDbHSm5jTXjzE66o2X0xnHz6aOnd+/cXVvdSKKoEAT9bmQBkjj2fe/c4rlrV69ePn+xVqoOzyjsJGuWSIAZX2Z0XwkKhcXlpampKefSgTe2MILjzI+FBcGgIlLlaqlcqgGASNSP7e3bnzbb3aOTBooUCwWjdMIC4pQhhR4zR3GUHp8UijVF6uKliz/+yU8y94o07bfbncSmaZI65xQhYZ7fBc78K8j3jOd7hUIIIw6+ufVyXpYYMzYvF4vLS+euXbvpUt7d3jk8PrQDGlOn0Xz2+NmduS+iJFlcPBeG4RCkMkuWshqpH2FW1mk1W5sbG48fP26eNOvV6uzMrPG8frebJon2vSAMfN9DQhZ2qeMcogEgZDiDMd/MNREonXVfsM6miXPCDJimcb/bc9Z6XjA9PW1dXKqUV1a6QBj4fhgWjPGUIAA46xw7cS5zqaRXrB30yh7BAkggqFQQhlNKFYulNBUiViYTRQE7y4LEwFneAF8+Nfz+I7BzzlnreZ7S2mitlDZab29tB2EAQFlazrE4toRaa+OHXrFU9AOfRuS6TtgRGcTTkTlSaFDGL5Z0GFbq4qy1o1sXAmX3CZnnslB2TpCsKQ5BBpOzroriOINohIBGISIJWBFFxMLOslbKeJ5H6Pvh87U14wfMEqUQOhAkJJ2NPa0p8P2wEAaBPyrOlVEbgcGp6iyLPyPx6FNMFHW7URQ5azOpNWc2gc4xACpUmkYZmS+lUQVeskrHV/e4QSIBASQZdf4jyhtfjWbpWJxRY0qI+aWlv/9P/3jrzTeSKFFEnucxsI0T4ythIyihpzY3Nh/cvffg/r3V1dWjw4Nu1O91++KkplQYzly8eOnylSsXL19ZObdSrtWzxmMALkoiFFRGGW3CMJiZnatP5Q2RbZLkBWUkyjhnzNkqighEpJQ2ypgzvmh4hooGpLQJ/KBQLBYqhXITiVhYkwkCTxC1Mda5rKZGihQiDcgpTji1SdJnayObxOxYxFnH/X6/m1idJM6xAA5HcsYIUQNrVCui+BSiocKRAc7MnGXr6Kv6GMigkyYAANTr09evX496/U6zWSgUavW61jpl55wDZGQmoqAYeNpvdzqbGxv9XnR0cgwuMcbXWmcMCcuSOmcTm9jUgzMjJzfdZJeVwEWcQ3e6DZ02z6PTLCy4YTdeRHy1p6Kc6V6MYzlKQMlsO3L9ad5++vQl/XZnc31948WLjfW1w/0D39eZIiBJExChjOxoLREFCkBwZ3vnk48+9oLwjTffeuONN0eoDC5J+kRKKUMEWbM4GHTxGlZg6dt2rdffDJYi51SFPIUGg603a7Vx+qtrTx5/+rt//+jj/+HXGz97A375i/Bnt1RNp0dPZHeNdze50fLOGzW1bC6/l8Bs7zWIfnYZfMb9Nbj7LFjd0KubPLMIxQJeOS8lsDM1x04ODmDeABTErwoQQB9O9unFc/PwYXD/vvf4Caxvul7qvBJV5skrqJMW7m1x2pPFKQlLPDXDUxXlLHZianX14YE+OmGtkmo5qU25Ug0SVPsN3W/pxr6c7GDrSJyznueKJZlbwMuXda+lweqggFWLIVgxXKy5+Xl3suNczC+ewvuB6bfMl7eDOw+D/a7V9V5pNq3VouWavbki79yy793i6kWAAKCH3EZ3DKYhYLA47b33d4XF2a5IsrZ/8PTFQVD+n2/cfPvGlRtqGgFAGQUudy8TydKXwyPCqKHi+OkD8WXLlmxFHnVHbDebT188ffjg4ebWhrO2XC5HURQ5iKPEaDM3P3/l4pXlpeWwUBjTIgyOzvBSfUQrVS5Xy+XqNxlfFPXjVrPdbLa67Z42JvAEWGyasHNEaALjnCT9JO3Ex4Wjk5NGkqRKeQNqUTg1FX4TGDBmNDDIZIxZh/hhsLy0cunCxeZxo3XSYGYCCACKhUIcR2svXtTqNT/0a7XpMAyHiyYPzogw4j+XIYY4jlrt1tHBUQwQHx2BgPH9uN+3aZpRDXNpdnZFAzN6GtRJOFfdQyY71VoRKSTijO4FlKZx1OtZa8MgRMBqpdjptJMkAQCltNZaEyESD7gUknHeMfP3GVOhDup7Y8ujDNRCWXs73w98P4A/S5SrdeN7ImLZWccMwuJSB8qx1sYP/KAQhoXCqHfR0BlJ8OXWtIQISuekWf/PcgulasX3A0ZILFsBASKlgYgBnHNE6AdBGBay/jNneuqeEo3HDBJldIManYP9Xi+J42GDV2dtmqbOWgIwyigyiPJS4fIP19jiKypug287Ww4yg94zl6rGndIKxdLVa9evwvWv+axrNxrs3M7OttnaAiBhyXoXpJZJqWKpsnLu/Ds/fO/t9374NaLXMZq/dY7dgDI0InUSySBzZqHFboyO5awFodFP0MZUKvX5xaV+P/IKfr/fZ3ZEyvM8Isq9PAbaYZUbLyAAOXbdbrdxdHCwm/TbHZCMHI1JEiUAaZo6ESKlR1s2jZUvz9Sd6ZV5J/wKgj3RGLiZmpq6detmMQi73a7neWGhoJSywCjIyJKmpFSpVNTaNBoNrczuzm5qnY0SP4wLRALiANixdWId86BqOfbBOc03k8yPsV5fKhPC8JHwy25nX5FiGzs/nCkOjJwxtKbhCOm1Wo8ePHjy4MHW5ka70UwBTHYAG/DnOEksiHNWkS6VFCndOG7c+fJLARSB2dnZ+fkFyK1AkDl33RlcNZ2WKQZJQoE/h3UtAzgAN2IemfUNRIWocs9E6XQ70c7R88efnBw8YNcohlCtwnRV1coegAvAQSr9GI67aqeJmycgMSNYAKA34Cdr8m/v208exuu76sWmXHwN5itw4zLfWLDVur1wztZrDpz0D7HRosNj2t7Hgz19tOed7Jtem+oVR5eSZuQaPdreM52eavUcs52bTi5cdTfekitLpIA2Nmn3CB+v0ZNNEUivrSTvvR7fvObQx+d7/v1ntLnqH++ppC0akkrRFmuuXGBFutPSm5tGRLW7tLHfK9Rtq5do4rdfl7kyGEAXqUcPqHNCG7vUiand086ZFF29KAtL6c1b9tYtqC4LFAlYgJEdxF2JBAoFVBWCOVoK6RcNWDsG/gJ68Yvbt39VL83dfO+t5QsL5OWsCM44yJQLxvONFIeyu5csMOSlSS1whnsURb3NzY0nz59ubW2xSzzjBb4X9RLnUt8zc9Ozy0uLc3MLyjN5I52B9CZTdQ37Tw1abgN9k/a0qXUnR4ePHz/8/PbnWxvbcb+vSBvlgWCapJ12J4oio5HLpczIAAV7vf721s6dL+6EfuHypUthoVyqFL+9rcNgCo23khTfD+fm5paWlza3toIXQUaMNb7xPL/f665vbISlwuLi4rWbb4xzgE4zZ0QjNqRZN8FBnzkL0O10PGvTJBHmIUQjUkqTUSrPPVEG0Qgys0sRy8JZY9HE5aRQQBF2gqlNoiRlABUniY0Tm6apTdOUXUYbP5UASN6reXTpd0MrBAZk60Sp/CgAIiinXKisieqwj8+fJZiQWVJxWXaRUZwwOHHWKs9orY3nq1G7USdO2DqnNZPkPQZGaXZnBZB/hkC04PInku3cpIHQZf0rATPTB88Psxw5DJb7r6r3YN5xRuBsX0uIer0ojoemTc7lHTgMQeB7nvGIvv3d07AR1kja4gzKQ6Bxh9WBA+FIAegPWSUKpZoAtNvtZqMZxwmR9jzPshXBbq93dHzSaLaJ9B+Iz/LlkPOkTd7wdSSrlKZpHPV77W6z0fB8L4kltWmSRigYBmFoTheZIPTnF+atc9PTU612I07SLHdutAZEHvaGYRhUv7OuYDrl9Ojw8PmjR0mv2zw6TpJYeZ7Onwhnb+L5fhAEY5zKr4AseeOKMzzjEYEkvZJcODi2VCvVy5cuVSs1GyVklPZ9RcQIBOTE2TRSpIulovH85slJp9O/d++uAMY2tc5lZAMHkGZ5PyAk/TKplIWBB+6G2SUpyvGNOh3g4rI8NZ8hsqHwV9ZCZeAwN0LmOcPfkLGWhzkn+MG9u+//5re3b3+6s70ljgOEIPAAIUmTOIpim6CgIlIIShttlLC0O51kddUxFCul+YX5UiksFrMEBHpekYUzZTEoGRhRyahxwtC/5uXT1J80iwbpiO1odjoT0piV8AGg0T54dPfe9sN7q2vvVys7b7wOhRpICtsb7qASz067YtlNzepSHeyWrO3yx1/Gv/kk/eVKvjcsnoP6HFPoOjEfNbnTgYtzvHwB54qusuBwOgVm3ofVp+aLO+qLB/r5Nvb6quL5C1Nw8YKdX4xMKdpvJp8/MJ/edjub3Gc7v2TfeCf9u5/xD9/w6kW1ta6OH9LDdby3aQFAQ3LtUvp/+3nygzf5oKn3G7Czg4+fKgDtgVxZSG697i5fSEoedFp+uxXuH4bHDbz3xOnAeYU0LKT1Kr5xA39wnXottb+nDw6525WwlMyfw3RX7R2rzolxC1yt2vkVNzUv4CmIEKxAzOgynipaxaqTQMAQuDdfx//Kqrxo791PHj78Tfc42t3/L/+X//p/X7o6P5iu1rlEo0+kEFGytEZ+AqAxY7x87soZ6pUMN2s8hWh7+7uba6s7u9tFPww8XyFlhcwgCKam63Oz816GgVIWEFQKiVRmRAY4lAqOzszMGQoBvz65u7ezfffu3Xt37j589PDp46dbG+tipVqqKkWKKHGxy4QACcTdyA+CUIesSRyuP1//F/svTx8+PXdu5cKFC1evXr1x9XpQL3+zEY05MsNTL5vh94JhWJyamZ6Zm6/Xp/wwzKgMWmsi6HS7SZoEob97bbff672kR1QDiDZcIVkYPD+o16fmZmYODg99VMVSyTOe9TyFqLRBjcZo45vA+FoZTZQxx0/Pwwgg4KyNkiSO4jhNnBUGZkERZ52kLgmjPguGYaFer1bKlUIhNEqxc87ZJE2Zbd7rEUfoCwCOObV2ICa3VtC5lEWRoLBYzvjfnCFO4Qw4qoy4k605A65UVmEZqc8h8Dc/PjJzYm3geXrQs7nX6/X6/VzLmRWHhJlFucQDPzMQIYWZO2UaJ85xAplPmSNwGWTGwWTI3DMQ/4wYE6DZaXe63SiKbJpmMzFr7C0A1loi9D2vVCpkyIYdWxajDQ7bRIxkxUfbyQyaYJ/ejbBtd7tRHFtrsywui7C1yKKV8pQxyoxWhMdT46NqOXm5KwOcttHOROO5m8BpOio7A2Ra9FPdtBqhq+brxSuv4UyctA6ePH369PHT7a0dBvaDoFgqZVWz46OjxyxeWLh45cqb77z3B6cAiQgJEARs1jcq8+JCcWna73VPjo+3t7YKxbBxchLFrh/3nXOlYnFhfiHwPdQDxXcQLq4s16fqcXLVpYmTXA6AlBmG8tAiC1UuukcEY7xe3Ntc21AiW6tr1nE/ckGRPZU1fbKIqJUKfL8QhKfInh0JUZaKwjE/HJfagS+zZGqVjOJFQ7PXARbPskQ4oFpmi15QDObnF2rVOjOgJlQm/3VCZ20SR9qYYqHk+V5/pr2xulEIS+IkEkmtc5YTywKQWivMqJV6qUETM2eHPMydWRQpRUQKQGmtUA1xPDuX1TdxzBZkAKJfSvMijJhxyKl27dTKGQUJnQC6FPTpB22sPn//d7/91//1Lw/vPzg8OjLGC4sF42kkEmDLLJYBCZDQkCalNFjrkjjuRZEDLH1erJYrCvj1mzdnFs8NtbEWIE5jZjRKIxpUA+UxDLo0CIMACtI3WXj0H3EizCQioEakE3u7+19++uXDT3/j+vevXOrWZ4vdhPdO6N6XWBf+h3ctzMqVm+7m6+mTEzrpyKMn7l9+zbNVvPELBCN7TcWaihXwUUohl32ZreK5KTJVgIqAYtiFJ0/hiy/Uh596n9/zNg7BD/HaeZiattevp1evJ14terEN+434vo++4nKV334r+k//IP/wd3BlWfea8PS52thXzzYzIpi9NJe+eyv68Rt8/hK455JEcHCQY5p6yb3+ZvL3v0yuX7OQ6seP1Zdf+Nv7XrMN/ZijWIzBpUV6/XV6602cm8ZOkzodUE2uTvOFWWG0s5vekyfU7irFut/XJ12335IllXWjBkhBiQQGxANtAPoO9h1opcqld96tY4ni+Pi3Lx7ubjQIves3rg0hGpCwzeyKFY5YVsmgtfoIwxhGzxNDEfIpBXjw4Hq9brPVOG6etNo9DeR73sAYGXzflMqVar06km1xQnkvlqEp26nPcrYy5J/KAm6QmVIvYTV58fTxZ7c///DDDz/68KNnT5+2my0CKBaKypCzjsEhYLVSrTgLufQdhESTSuJoc31tc23t808+XVhYuHnr5g/e/kHr8Pitt96srSz+/nQwD3zraWy7O2ulo6lYKk/PTFdrFc8zmSY8MyCN06jbaZfKpaPjozMQLVdfjUu+hVkbMz0zdf369SROjg4ODGKpVA79AJXSWmUUNICs26ZSqFAA6NRKfhjCHKdpHMeptYCklAJUiCACiU3iKHLMvu/Xa9X5+fmVc+eqU1NK6ziOkzhOkzTLlmVdaIZVaqXI971sZfc83wBoEq0NIjnHJMAkRimjiVT+cEUARw0bR8onpxBwQJH8psomQRjISXFQn0p7/X6n0+71us66rNaWyVG10oVCoVar1SrVjAVvfM8AGPCiNAEkhtxVeNh0fMjaPNuIYrQTppz+wvhEG/hiyshd4pikUUSQSI3g/V6/d3Jy0m42s/5jNKjyZHkIEFCkC4VCedDFSynFkNOQMzIfwqu0Yy/ZjwFAt5sDWmstjYivMe8WpJVWCGd6bODXHGTO7I6UUxvy4weznBGgZOFYRuprpAb2yMO+p6mzirInkvnvZ14ezvcLw4u7ffv2/fv3X6y+ODg+LgRBEIahX2BOoyhttponzRYjnTt37o1bb954640B2yzt9/tBoaCMFgbn7KiOhAgp61LAOOTsZhINa2271d7d3vY8L4ljLwyjKOn0u4C0tLjgaVUtl4JShkLYGG1MtfKNuBxDNZUfrr14EYQFBkizxkSEWSdrBFBK+55nCqe2+yr3JyKlwPPM0EtsZEUb5qjy9GjOsXtV5nXQU1AAUGtfV/3CV9yEdYkeMElKtfrUVD0IAgawAGmaWmbOB28O/oZtzkf2liGWx0wfqrIywcuCSxlRpRAR/oFdfcf8GmVIws5bE5KCDKPkA+pwZ/Pzz25/9MEHX3z++f7evtGmVq+RotSmcRx7vletVZVSwpIkiU0SZkHGrMWBWOl222urq8VCgUDE2XeNV5mZH2g8fRoep07bfA1vf7Qj0H9QdwFBAAOiBIkl44jnArgczkO8vXV49/bqg9sPLyyvn/9xfP1WaXVTP1vFtcdc18l7N1XpSvqmcr84TPYifvBYJV384rYyqf/uEy6W5eFTtbmjK0U1M2tfv+yuX0gvX1RQAUhVb0etv/CePLBPXujtPdXsU7mGV4oyPS03ric/uGXPX3JeITlqwNo6bG5Sr431Cl+5xv/wU/lPP4M3r4J2vH3IT57xg2fmsIsAvFTjX/7YvnmDiwE09+Hpc9pYx+ZJht7c8lJ87bXkxjV34TweH1FqYe/Ere4mrY5LXGSTVANbp5RvRKvZBUCRHrqpxXh2US5epkLR7O/aJ49p9Rm1O/D8hY4F947duzfd9WVnPBEGdKhDgDKBAehL8xii2KOyp0tmZormZlypKO2jnePDJxvrD27tXvSnqp4XKtQKeeAGM96t7ysHwHBzyvf7zIqCcj6vtJqNdqvV63VTAGabG3dnWVzjlcqlYKCHyqjcMChxjulGEUZ1nQNuXDZMXRz3o35kI9frdVvddq/bOtg/WHvx4snjp/fv3336+PHewYEDKGuTpmnc73f6PY1qaXnx8oVL9XolSeLt7d2drZ1OrytRlDrXSSMLgB3ottvCLk2SVuNkc3NzcX6xMlXzSwVPa2O8MAiM7xnPM76vlELLLAyCQOR5Go0eS6oP2t1kbh0AEBSLc3Nz9VrNeJ5zzgpkvY+sdZ12//j46OSk0et2z9KDcJiNy/GJMPt+sLi0+N4P31taXGi12shQLBaLxVKxWPCUTtK40Ww0W42o10/ShBNO0sRxds4XymAUgNYaiUSQFBrPK5Yq1WolLBSzhqFxEvf6/SSOlaJCoVitVafq9YWF+cD3+71emtoktcyCAApJK0wRUUArDAtBvV4bXfY84w9ohaTUy1bxZ6wivzJ1j394CWoMG5PvjTHEKpWyONdrdTrtjk2sIq1QObFIFIbh7MzM8tLSyrnlpZWl08wNUNEEAJCKQ5ah3mp01MpXK8fGGqzCWN/MkVPqsE/u2b89Q23udbvtdqvf7QmLIm0gAQDnrE3S7L2M5xULJVOoDL5SpdUABL3sTv01i7xwr9vrttv9btc6RwAmR0h50jP3DBxtZvq1VWsZzIjTk0xujJC9bqwYNwrRmMe/DBqk5XK/N2ARsDYzhkiTOHNb9n0/e8tmq/lk/dlnn322urraarfTQVNgzzMAxtkug/TiZHd39+GDBx99/HG1WivVq+VKWXvGWJsmSZSkNkkFuFQq6hHbfcqHQuY3h1qpTChg07TVaGyT6sfxweEhKNXr9drdru8H3WvXZqemFucWglJlAEG+faXY932j9bADg8BpjwhUShvjhyGMdARVWg2cLMkb1zEYo4Ypu8HpOM+LZ/+MwmsauKn+ge4VQ3yWo7RSUWudvaFzTji3VFZakT5tDDAK0c5kjCj7f2YH4Kx19rRKi4N29AMCFaFI9qS+qrUdAosQ52epYbUdKPPNPhUJaQCIo+7q02dffnb7V7/+9d07dw4Pj1ikUAiDIIjjfqPREITllZWr165Oz86k/XRtc21jbaPf7fuGlFLG+KSEEVqNxrMnT8RZmyb9bv/mrVtzy+cLxSIAaO2NzcPBl58TEr6VA8c3gmhq0FgVXOaZKlniJrOAtruHO2vPt9ef7x7vHb+21Fmeh/Mr0cFx+Wjfe/iQZqq020lfC1K4aH/6U7vXSEIobLzwt9fN/7nN73+YBkXudXWzU5gtq/duRD97I337msCyBaH0Gf7bb/WvfqXuf2HafZhbwsuvuXd+CNNVnpuS5Qt2aY6jxD55ge9/Fn5ym54+om4fLl1wv/wx/OOP9VtXnEbZW7Nffkwff2gePwUAmp6hf/iJ/P1PeXEOXqzDk3X4zWd47zHZFAHi5Zn06qVkZSEphRL1zPaOebomzzeizeMIyQaFpFB0CiQW9WhVrR3rchlmpuz5xfT6Zfv6m3DtupuquzTRBxt49zb922/Nh3f92w9xbSstBL0Ly84E6GLRToFBmELwEXZo84g2tiklW603UnYhdi+ch0BRUDjeXP/8k48KS5dfO3fhcqE8hZi3GBNmVDjoowdZ0QHPrOl4uoEOvf1IZW6iClgO93cPD/fbzbaNk5wqDpwd3bXWXiEslKugTomXWd9AGMoF8gMLjJZaXqLopu1W62j/4GjvYH1jY219bXdn5+jw6Pj4uNlqtRoNBKhXygjom8CxbbSbEYAndn5u4Ze/+Pm1Gzda7dann3ySJB921vtxHDNw1s0zUNoPTK/Tff782dHe/p27d6uVSq1er01PzdSnK7VKvT5VrpSrlWq5UvY8jzJfUIXG87Ba8Tz9Mo1DBnyy7LuYnVusT00bz3PODvYJEmtjgU673Ww0Tk6aoxCNgPJz6uAcyGwZsVgIz1+4MDM1k7wVJUnsGAI/qJSrlXJRAbVaJ2tra6vrLw529o4bJz3uScJpmjjOtXLInLHTjPGCwK/UqjMzM/MLC0uLS1Mzc6VSSRmduLTXj+IoYsfG9zxP+54X+H6/1z06PHSOrXVZD2pFqFApAiIAJKV0JnT92oPqXzJKhaK1ttPp9LtdEPR9XyvFSimtwkJhanp6cWFhYWbulWuaQeXyVq74De4O4ZU6xqyxLOGrXzxsyqdG/p457fc7vXY7iSJC9H0jLgVgmyTOpQCgtfGM8XzvlXXHszK2cbklC+iRSZ+maafdPjk+6bTbaRyTQk+j5/lKKVIICXLmCOr47AHutNfgGEfz9Ozx0uzO0gVE49KDzOvh5cqU5O0Nc2YaipKBNoaRidDTvgl8k3VCdM9fPP/4k4/vfXnv6OhYERW1CgNPKUOkidAYr+CFbJnZbm9vfXb7k3Kx8Ppbb5Vv3QSAoBCy48Smcd8BjVPsOX+wGZuOkLRWKKiUSq1tNpvdfv/45GRnZzdh12gcd7u9SqXqK/Xa5SvRlXhoM/RHTAs5PDhqNluJTVBlOAIdCyIqAD/wCmHBG7f8EGYRHDQXHhvGdObQMTDYZefswBx2dDj/MXNZMqOn3NdWkEAZjX0wniatAME5e0Z7o5TOFBjMzFmtVzBzcUuixLp0eHk5mBMcZuYHh4CsCfVg3xmromasEsjE75nEigW01qjO+iA+evDg3//tX3/7q1/fvXNnd2eHEKvVWqVSUkbHraiZOg9gZm7uJz/72Y0bN1qt1gcffNBstPr9yAlqpUOlRSBlZ9P0YP+g3+ufnJxs7exsbG29/e477/3gXR0Wz3AEk8Q6ZxWizrrSIbzSevBPWOhEAJWdg1IQAvAo65KunIu39nfv33/87OmzXm+/XkuWFmF+Foqhcwk3T2hrx3u+6Z7vqtcAAGBuDq6ek8amRIfqaNd/tusScYVQahVcXqBbr6mfvUXvXAeYAojB7sqvb9O//lr/5je4tSHlmpy/am9d5x++4y4vij/FUE2BOXoI95/4//Kvwe1PgzSVa1eiH//A/edfwo/eIihRvMZffAi//Vf58ra0IheE9M4t+dl7cP0KJQl9egd/9ZH6/EF40NBTBVlZTN641nv3jeTcAiR9s7unvrxHj17I7nHaS2yxlIQh+wEq1kmqW106bLMfcJzY2Vn2SlCsQrEIhRqDn1TPwXIVDg/h07v+7qapleD4BAUACqJjgBRAIzBBm3a21RcP1d0nEkduppZMVxKt4MY1s7RcbDa7mzt3ur/jW11XrswUylOZJ3jOQqJcmjTkQwtI7nF+po/68HCDMCCxSa/b3d3dPTo6SaJEoVLApDIBPRgAz/N8P/TCYLTI4QSGLh4gv3/YHZ8cHB0eHO0f7e9sb66uP3367P7D+xvr6yeNRhInSitjjNG6WCyQ0gopjskjnbBdnJ27+fqtn/z852/94O1msyVEjU7HoZwcH6dJ4pwjImOMMqYXdZubzRdJ4pg941Wr1fmF+aXFpbm5udm5uUq1Uq/VKtVqEASayDMmLJVqU1NeIfRGcMmAVZq18LN62O/SUKFQNEpn1knCnGG5jELU7/VbrWaj2axVq8Mk/bD39KgU3A/DsFiC6blXKxbBBb6vlXbs+r1+s9Vst9vdbttaN6x3IKIxJgzDarVaKBWJyPf9QrFYq1XL09NfO3UFiTKIxpwbiBKBIiIicS7q9xsnJ1Nzi/BdjaP9vdZJo9/ppnFqlCFATxuXOo1Ko1KAnNpetysuQvUKkan6iu6l32LHkvEE26vfc/yv0jjutNqtRqPf64mwbwxrjSJsU3SMAH7gB2HojTcYZXEZmYHhVYzOrzApt4ntdjrNZqvTaadpikjGGGMUKcUi1to4SdIk5m9qVfeHiAi+9ktjZhzsnPl+jAKCuc+FCbQ53d339nbv3rnz+UcfP3n4qNNqBr7vaa2VcmkcR0iI1qa+MVAsIGHj+Oje3Ttaa1J6Zn5+anoKAEhRoHwEZADjnRpSnzr7AyADAmilCLQiYuc67Th1DtSxMSZK4oPDEwtQDvYW5+abjUacJMPKxWm5fCCbHas4Dzo5MlsiRTQ0zrXbu3ubm5uHh4dREiGi0tnviQgaAj8I/ULgj4+EJEmVIiW5bNCMfFECPE4/HnjD5P3IWOSP8U8dG2SdbitNEskN5EgRakINoHWmZHMDKdTIvMsUbXkLmgxrDhygmNkOJY9ASpHKe/GN1scxd6b+KgVOVj9VQwgEgKjODMXk+bNnn3zyyb//27999LsP9g+PDUG9VisVS9roKO53ul0AKATm3MrKD979wQ9/+KNGo9mP4/2DA2ttr9N1jgmQFPlaA3MSxwe9XqPROD5uNE4aSRKXAv/1t34AI0lHpZQxYIwethT7QzLgfzQXbdjJUFgP0pYAcHyUfP7Ji48++vT5ky+Klc3zl+PX34TpGtg+9NqSWIlS2Tuih0/o5hewOA8Hu2BjMBr9AIMiBiXQIHPT9rWL8Pa15Cdv2h++nRRmBFqwvQ0f3JHffuQePDSs1JXreG7ZvfOGvXGFr15wekXAMABDBEcNWNs0T56XD9JgwYvfvB7/w0/tT37EsEjQUk+f6Q8+wA8/xp0GlMjeuiHvveEurQCy92TN//fP9D9/ZNqRJpBri+nP37F/98PktauACp5v0Wf36IuHtLEHFjgIwCeDFlwfe6wQsFqBmXIyVZFyjQNtDvbh0UNIe3zjgpu5CuBBeAN++mP7bD2pFHBh3s0WIEAEA1AXUCIx7L6ggw31/hfmd5/Lsxdi27JYwqvn4dob5vJrfqLxwaPGF59GD564lBcvX/vB0vlR2i4Mmg5QTv7OenHliqpTuuJQcZnXeggJyNm03W7tHx6enDSsS5XWJk6z3uRKUUFDqVAMC6EeSa1zBgUHhR8ZP+gnSXJ0dHy8f9Dr9fpRNyO1t9uNbrvbbrYOD/YOdvc2NzfXV1d3d3fbsbUDebBvwDO+9vxCEISFQvnKxWqlev3G9Z/9/S9uvXlr+tzK9ELa6nVSkJmF2a31jZODvePj42az3Yt6cbcTRXECMFwejhrHnW6r3eucNI4Ojg9KxZLxvdD3tPFCz6vUavMLC69dfa02PVMcl3oNbWzPKF59L9Seyep9CpEQzcBXKoqik0bj6Ogog2hEJEryHgODxMPAKerV0y2Jk43nzzY21jfW1nZ3tg8ODw739xuNdrfbbjabcdxnyyyilYKMR1wo1Ov1KEniOG62Wvv7h7PzWyvnzp2/cjEMvkrWitmKnTXJyhzbQFijIsI4SXZ3d7+4/anSuhOlcZKIpMBQLpcr5WKpUPT8wLJtN5v7h4fNRjNJU2O07/kIJGJZBoklyIXn2SYsoHKSMDO+1Jgpa3X50jZPWZKFrbXOen6AgEppP/A+/+yT9bUXUb+nFWqlCFATBZ42RGkSHx0dPnn61IHsHx2Wq5UolSiKlKapev3i+Qu1+vRANcbOuUFvsdywJreRokHtT1BkUALNEPvICissDhhEFIDKsmxEcso7ECFicWnqQGs9MAbrdHvHJ8cHh4ftZitNUk3oKSIQZNZEIbpSqRSEoR4xLnLOxnGsPNRa5yIgGc+Og4w7xQ+GU5q0251Gs9FudwZ+K3mNz1nbS12v14uTmMd8HPhsUfKlvCCcTV8IjGuEBv47NNLCZywheLo9nb5OAJFI0SCbBADg+Phw//ZHn97+6JP7X97b2diycRRqLdqkaRz3e3G/n8v0AH3foEDUjzbX1gDEM74Jw/d++F61Xg38AAD8M4nJoYxUgEWYHThRmPvaMHMUx91uN3WiNHVt/qW0o/Rwb6/f6bJNQMa4T8ziUguEWd6Qhm6ClDlIiLWx0YaUAIDS1Gl3To5ODg9P2u1OnCSCQASZCQ5o8kOvWCoVCoVRV7YkTvv9HiIpg8Li2BaLHJgQEFIb96OIhZUiSpn5VOCpBq0uxzOwQ1FhzsGwSdzvx2mSwLA3BpKAy+ZnapPQCzzP87ww6TePGydR1M/8GY3K1AiAAMgC4lisiD17eMmLO0POR3bCzUEMgQy7CwwGZG4nyZnQKOvawV+l/FBKqa9CPKlzx0cHJydHOzubjx49+uj9D+/ev3d4eCwAhdAvhD4h9Lqddq8Tp1wAOH/h/JUrV85fvDC7cG56Zr7RbMVR5Cnz6P7DnZ3tNE58zwsKgSZlEYG52+nt7uwAoSZkdju7+0srK4XydLUSFkpl3/NHp/O3PhB+Y+varBck2oQgGEK07Y3G+7+99+H776P78s1ruz/7Yfr6LVAKtjfwYI8FbFDCXuIePMCpgj87zZ0u7Gxjo6PQl/lzduZcMj1tX7uQvn7F3rhoLy9iUGOI3dM1+vcP4d8/lscvbMFP3vsxvvsGXVmBxRoszbA2DpwACPSgvQHrL/DwwLAL6sZ//ab9+Q/5Z+8lsAIAurNtPr+rPr2n1w/FALx2xf34bXvjkmiW5+vmo7ve7ceFdmQAYFr1Xz8f//2b9u9+BNU5eLIOT57TBx/T4zWKBYolLDvUjiDCdoJ9C7Wau34+/bs33YUF1+7r57vegzv+gy9gZSFdv5n88iA59x5AGd74gft/cf+XbyWehtcuiocakCFwEPHuFv77Z/jxbX37LqzvuG6DTQd6pPx+uLwi1RpTvbO2lzY7sP7Mq1a2d7aP335vjJY+3E0ACTHrAcVymvSm3FlhUKnPE+tEAGBjbjSaR4eHrVYrSaxWWikQQXFsjFalsFopl0sFbUa9poQp53NI1qJvZJdotVuPHzy6c+eLF8///9T9Z3tcSZIuCJq5OCJ0BLQWJKiZiqmqu7q7bl/xzM7d37ofdp55Zu/u3J2uLpklMplJLQFCqwiEPMrdzfbDiQACILNEd93ZXXyoYoIgIuIcP+5mr73i7fHhYRxFzmVETiA6ojSOoqgfxTGzLVcKOvcKTzlmyAyASYMk9QN/ambq5q0bd+99dO/+ndu37sysLOWcixt371WmGjfv3Nh69frNyxcvnj9/+epVb6/fT9Ls8mOgfGmB+oMuI0VpTILTJLOWhIBquby0vHzLptOzs3Q5EPBcuvZ+36l87Xm+7/keRFLqvH8UAIwcJ0mz2Tw6PJ6cmKpUyzhC0TCPcRwLVP8g7nF0fPIv//IvD3//zfbWVr/bdpYyY5LBIE7TJI563V6SRiazOR1NKuX7fiEI2mdnzWbz7du3gEL7Qa1RX1tb/+jTj+7du3/t2oZ+T1dljHXO5g74ucaUHLF1IISUMo7j16/f/r/+239/9OTpIDWDNBaIpWJxeW5uZXlpaXGpVq9FUfzi5cs//vEPz58963Z7YRhWqhWlFFmiC2ZLXvYM86qYxZBJw8SXspvH/+/SBFEA5F7I+SYtlAQQQgpPq1brdH9/LzNZ4Ac58VyiEF4gBUa93rvNd6enrZevXlTrdWY4Ojvrtjvleu3Lzx781//6Xz97MCzRuq3OIBmglKDyKwoIKBFzh1pizgNFAfg8pyNPIb7UoQIDgAQQgDI38SZgABJD3aUjzqzRUoeFQEttTHJ0dLi/t3+wv9dsnabxAIG1QMksJfq+x0oWi0UpZZxGWdLzvEIv6nXa3cxav1AshKGvPV97Uopz0cBocMfwHsclSuN2u33WbrfbnTRNgUhIgRKZOTVpBjAYDAZRlGUpXIJexr0bxgxWLqZOOE5L5rGvvLwbMtUZL0o0eYWjN5xbERE55ywxMggVBpcwkq3Xb77/7rtf//abh394uL+5HUV9X4Iq+hJRMCVZmlnjCBDY8wItlBAiTbJ+v/tu8x1Z7ifx6enJ/Y/uf/LJp/ghYE+cc+LIkbPOWSFBIEiUjMzn8VDMcqzrs84CkIRxv6n884BUEgUgypxvNM7FJSYBKJU6H9k5R4PeoNPudLsDk1lmwYjGOY2gtNaertVqlWr1PGrPkTk+OWq3z1AIqRSRM1mWy1r9MOyeNU+bp8ZkSp6zG521FgG00p7yxsnBF5JbvLC7HwwGRwdH7faZSY3SUvs+oCB2IAQBO5P5nlcoFn3f63XODg4PorgPAB6A9BQi5snEzllnHJLDC6O+i3kfjZlm0FDZKiSA52kQ0tnhNTaZcXloGFFujgYMw3E5EvMHssbEnxwZHp+cPHvy+Onzx0+e/PDmzeudra3WyUmhoApBoRQUtFKDOO51unFmCoG/uLLw+eef37xzY6LRAAChvHsff1YuFrXWNstaZ81ut+dMlpsaB76vlReQYcTWyel3339/eHT47bcPl5aXltc2rl1bv3bt+srq6t8Em/7rSjTO6zN2SpAa2xh29w5ePH3+7u2j5cV3y2tw9yPRqHkHW/TwoXj+glKTlioWFO3uw+9ZlwvsHA5i2Y+lQ5hdMMvz5s5t+9Etd20FoGQhAzrFF5vy1w/lz3/Dj54Rg71xTfzsn8R//kdVn2boEQwInIMIIIPjQ3j9At681r2OrJRhdoa+/MJ+/sAWlgEcuHfwy1+L336rt/Y1g5ufdDfW3OqcEwBvd8XLN+LRa++s74GSk0X71QZ9/om7vQHTkxg52DvQz17JR8/FSQ/DEKcbWPAlpB45UdQUFszCvLm/QV9/lM3V8M2ueP7Gf/ncOz7i6Wra3kHXx39yZvkjgkn66B+yj+4DJDKPKIGWAIbOCX/3TP7it/ibb+ngmHzlZmrkeUoMVBqLQd/GcRZUjBDgKZCi1+8eHu5tH+wezC3OAYCQSPnZwJBHpI7sDwDGw5zHhMhX9PPGmF6v12m3+4O+cyZ3rOGh0kdrT1eq5bAQXm7FhhZHKAQQ02UXmyzJ2u3W3u7uo+9/ePLk0cnpqQXwACqlgudpZhIClFJaad8P/SAE4CRNBlFkjBNSl8rlhcXF23dvf/n113//05/eun0T4KIJLhQL62vXV1aWF+cWJur1MCyAlMrzg+OTOB7k74oRpFRSCkbox4MkS7rddppmrXY7iq2SsDg/X6nXUUhUEt/T/POPCvXBD4JiqRh2u1LKfJvTCrTUzph+r5fz6sIw9Dx1zujhC79CHEsy5fPe5mB/519//ov/+//yv/z6V7863NuTzOVSSWtNzjEiAjtLzCikzKNdHFGaZcaYbhQdnZxkxvQHkSUuFArLS0ubb9/s7+w++Ozkzt2P6pP18SlbNrQsZxAIUjCAJbLEUgqUwmTZwd7uoNsR38leEg+SWCo1OzV189r1uNfTgOBsp9d79ezZz//3//6L3/0xn7xWPekHnrWOLwMwxMMQhPNviyFEcwEB4QcUile7zIuhAKIQQmulAqWV1koOm3EGQLCGkrRz2j5zjlAKP/B6g8FpZyjgsHHy+YNhT2P68fb2u9ZZk4BBAjGIkXUI08jd67xE47ES7Sr+N2z2ZR5qw+AIzi2GAdERZcZIKYvFgqd1liaHBwdv3745ODhotZpJEjM5zJNFhfA8jeApKaMo2t3de/r4aVgodHq91lnbMpUrtUa91qhPTNQaMvTHHTrxvG++fP1dZjqdzunJSbvdTpIEEKWUSigYYcNpmiZxmsTpVY3Ljz8DV9IFhoLNERaWF/04prh5n/zAI4xy6GorUKkcx7r0Qp2Do0fffvvrX/7yu4c/7G29iwcDctYSOGu0H4TFQhAGxpkoyaw1uSdjPstzznV7nTdv3wzSuN/rpmlcKoYbN29/YBBMjvjSF1kQmhFYSun5PgqhlAoLhcykB0fNFEAD1Bv1QrFwOXJgSPIAkWeH4geuHiNIkFKeXzxy1Ol0Tk6Om61mEme54IKYiFl5qhCGjYmJRqNeHOUId87a2+/enpycWiYphDE2zTJPqUq1GoRB+6y1u7MTx4nSypOZlDIPvkQAKYXQ8tygcdRC0chyZ5T712lvvX37bmsriiPP98JCQSplyXGeMOusUqpSKXme1zlrb22+7fd6UqCvQEkJwNZZl0eV2GFM6JUn2Y0sM87zq/ICTg6Fqzrwh5dUK6WkGIkw6DwOZ5Rl+gEQatgNfrA+Ozx+8eTpd9/+8fd//N13D/94sLdrUlcKdaPeKASBYI6jpN/vp5kJwmBxefmzzz/74uuvNjZu+v5QSBsGwa17H0eDfvPouNlqEVEaRTnyikJoT3qoGSBOkr2dvb3dvcKzF7Nzc7dv73RazSxJEGFpeQlR/p9XovHQqQAFCIkCQDKAddTrdE6bbwbxG6336hWYbkBBq9ap//s/0C9+jc82uRVZ7Tkdct/xzpkI2iisdFZbC6poK6FbW3Cf3oLVOwC5mGkfHr3iX/xefPNQ7my7RpHW1+jBV+7Tj6i+QqAZmCAb4p+U4smJ2HoHOzsqjXl6Illeju/dj1evGwgg3YL//t/E//r/FN8+wsjg7DwuLkGjhlFbPDmFd/tia49bfbM4O1i4jx9dt59dj+9es1Mz4qgTvtgSv38oXr0VZz0BgHEs+l0FnvQAS2VanLBTc+nyvL2xYoHg3a568VZtHejDM33aA4pxM6BKCWQBH+hs4zaJKYAqADjoAhyLw01xcCSfbuEfHuGTJ9Af2OV5d3vNrU6jzLh1AFkmUgfbb9lvQdKEpQaE6zas7B0efPeH7wr37KeLi8taCSHQETASk0MWyGLEf5J4oTQbU7xc3kKsM/GgH/UH8SAaejUBMjEASiV9PwhLJb8Qjge5IMC5mJPPpxYjWybf9ycajZXV1c3NTcdsAAAgBTjpRyORHSgAX4Lne2EhLJUrE6XKzLxfCovFcrk+ObG6uHrzzq27H31069bt8/XJYHH0Zym8tfVrAiAolmpTUzdu7h0eHp6enERRlKTxYDCIk7Q36HU7vThKc59lc15BOtBSLczOb1y/MTk17fnBqKQQQ97eaGO4QqsVSgTFQrlcaYdtEGiMIXJSgpYamKNBr99uDtptOzU1rj/g8SEjkxSCGZidlKIfDXa3Nn/4/vtf/uJfH377x63tneEG1u1JBMsgECrVcmOiUSmXg7BAgq21LjNJmva63V6/H3W6g9ELdKLo7cuXLonsIELrwrBYKn+sfZ0/tM5aujC8Gm6TFtgCSCUlK5vZ3HPMZFk/igbWaQVgTKNc6SzMRVFkM2OzbNDtHh0enXuudzIHWfxX8lr+knr4g18OUlOJoVwuCs9HELk/IwtwLksyGydJTMN5fzr2z9qnp84O7//h4cHzZ092tt8ZZ2ioKgMlhFSSifK6I49zzYNwh+npOVRFl90ucrxICGBixy5HS4WQWgoUzrnMGEQMwkAr5Zw9Ozvb39s72Nvr9brWWaEECIVK5/I9yQiMrdPmk8ePT06anpadKOr3+yDk5OTk4uLC2upa0Q+C0L9YUJQzkPDct318Qtrrdk6Oj5utVpwkgMLzdM5xHJqjEmRJ1uv2XRZLLxxq3lRusvj+IfsjZwEzscvTbaQciUSZmEkiALAQV8hpTGSZc/BxWL2de6BHvV67241PTx8/efzNr3/z8IeH+3t7Jhsoic5QL0kyMlNT/szUVLValQrbnX6zddrvD9IszdLMEaMQgBjFg8ODXQYnkKxN9vd35mbnC4VSsVQslSra9wEgs+mwmkAEKUCAc4TWSq2U1iVPa88rl8rVeg0Q5k5brU4nKBRW1683JqbGWLn8YxTBq2JYR6AvMQWPj462320fHh7GgzhPZWUCJhf4fq1SnZqcbDQalZH3ysHB/vNnT/d295MsRQCTmTTNlJLVctnzvcGgv7e73ev2pPKCgHLCZb6wLyTHlxXrV0YEnVbr2bMnP3z3XbvTKRSLtUZNKmWcGa4qJilVsRAE2uv1+/u7e0kUB37gay/0g3xkPOR+wCUr5IuZPI7GqzRm0slMAEpgISxMNobNZL1aDsKCkuoc+8xHpHw5EHb8JHLODCchxM7YzNhB1O+0WkdHR3t7e2/evn315sWbly+Od/cHA6cFBDrwlDbGxv1Bt9/PrKuWSwsrK/fvf/T13339yacP5pYX/OCSUGN9Y+PLr79G4U1MTb978/rsrNkfxNYYrbXn+4goQDBxlKT9QZKlqRISnOu220cHe9Ozs/VaIyyVPa2EUoHv+1oXiqViuTwe7cN/MkfhryjRCMAyIEo15EqLXpQcHx3u7745bn5fa2x70lxfh2oA/abceef98aH7/fe0fwI6dNUZ8AIgn1MtGZTPShqlgAKmArqqTw0fQCgAgia9fg7/+nv1L9+o3V2cKtFXH8PPvoaFe7Qw52CAwAw9AkvgAXggErSZaHfkoCsCZRrznds33fV1E1YMdOCP34n/7b/Jf/l/i24Ki+v2+i2eriM6fLct3hzAmxMYOLswYb64Q//hE/f1Z3Z5GYQHu4f+Hx6qX33jff8Ejo+pqLBrBYPo9dD6WClnc5Pu7v30/u1spm5MhI+eeo9eeC931W5PxMDFIoRKZEZtHXH2BNqCO9Z8eZNgHgAByhTt0w9b/q9/7X/3WG/uOmOy1WXzk8/sP30Nt9ekMfDitXv6Eg+O3bMnrAWUQri7gvIaN+O909Pf/vpXcbeX/cPfB8srs8OdVDjrEkkegETO6SAX8h3Gi7j1y4a1QNakSdLP9flZBkxAuR80KFTKD/xCUfuhvODaggCUY3svIlBuek9Oa12ulG/euT0zO4cCu4P+r//1l52oP66Dy+MpUgcQZXXCWn1mYX55aWVpeXF5bnFxZm5mdnZ+ampyYmoyV0qPjqRLGZLC85dW16oTk9du3U7a7cOjk+3trd29veOjo8Ojo8OjQ5NmraRl4OokrYB48/rNr7/8+u9+8pOgVg0KRQAgS0KiABSA9CGjTgBQShYLYbFWCloFax0RWeMES4ECrMt6Ub/XjaMemQSgMEZVGd4fx+ycEcITYuig2Dk7+/7bb//15z//4eHD7ulpWQlnSQvpa23JgrFhoTA7M3fj5s3lpZWJ6QYqFcdJNBh0O52ddzvb21v7e/tRFDNAAcBXmq092t59zliv1FZW1lZWVyemJ/MNWkuRk6IYmIEcEwFYBCeRpWAntZc7ziIweVoTO88PCp7ve57SvvY8LwhC54qVUq1aBdjNP2AA4AtIaHhSqdG6cqOdVIxtHed/EGMT33FvJB65KX/wcHEAHoAnPcGCHUo1JBBbJMcoUHrKQ2eElL6nu/3BuU9do1qtjU67nZ2tRz88fP7iWTToM7O1DpmVElJLoJxZRY4YgBFzW2gcShqHqEsOAAjMyzc5RNucYccOAIRQ2lOIgshlSebYSaV9rUCiycyg3+8PoiyKEFFqH5ClVkIqwcgOydqTo+MkiT3ft9bEWZZmqe/5M3OzZxs3PSXnZ2drUB+Hsc6HVTQcNQ83+ixJmqenB/sHzeOTJI7DwFdSCyXBslJKgFVKpUnSOj452N2fX1oWWkspc+Tr3N7uEmZ2xfw693RgcsMLgkJIFJibG7Ozuajs6vx1OBv9AKsoPmu9fP786bPnW29ev3z18s2rV8fNE2tsEGpLKrVpP4U0NjN+uLi2tnHjeqlUbJ6ebW6+2dx6t7+/N+j1iKgQFsIgYAQie3p8+MffD/Z2t7/9/e+Wl5aWllbW1taubVyfnJ2TUqYmI3C5LYFUylhL1mTWKatVIShWKxMTU9MzM7OzcyrUUT/p9nsS5bUbGzPzi7pQGiflwrnJEeLVGgLPcR6CMTf/QTQ4PNh7t/n2cG/PxJEnFQltjAXHBc+fnJhYWFiYn52t1CoAkMX93Z2dl89fvHr5otcfsHUmy0yWKa1LYdHzlHVuMOj3Ol0pZBgUfM93RDm9yzFZ68bFAqME4Uu3oN1qv3z27Jvf/Oak2azUK9MzU9rTaZI66xCFliilCvzAkyqzNo5ia2ypWAKGQqFgHeVOaDLwlaeF1Oe8/gv7b4mEQOdUMx4yQBiAGJVA3/fPjUiEACFACJRiRLMe+iMiIIqr5n3O2TSN4jRN0zjrd3rNVnNnZ2fz9evtd1tHpyft7tlg0O91e6GUXijCgl8MS+zgrNc96/QNQK0Yrt648elnn3/+xYNPHjxYW1vz/FBIyUDWUG4+V6tNfP71T2aX15fWVn//2199/913m1ub3V6PsyQ0JgjDwNM1VQm92JLVKLtnrZfPnu9t7zz89g/FYqFUqVXr9Xq9PjE5MTM9Mzs3szC/6PmeDAuXaZo/WqX9NSgagyMQUgAKlIAA/W78+tnb509/d3L0eHamObEB1+agXoK4g+1TiGOBkqUGLaVkBsfkpGXpCxGEWAxJoy2EbqbqJktUUAB9AUfi5Wv4+R/wm+/Euz0RaLp1i//Lz+CrnwJMMcQETZfFRM5pzXK4faJEoYQsFkSx6OYW7e1b6fQUJBmcnMCrl3JnS5gYFufd11/x/QfkKzjcFM0T7PYxMbZQckvz2Udr9rObcH0NoA4nJ/4fX8r/9efBL3+ljo440HaiynUHiQFACIpZfTKbXzbra+m11SwU+OLI/90j7+ffeHuxkgHXG1mlCBWBDuT+MR+mcBhBnKKX2U/YwiIAslFw2ITvHuvf/NbrpG513mysuL//gv/57wGWEAacaN5s2t47bu5CSYnZm/jZrbA6LX9423z9zeDdq2SQ1TfW7+UlmshpP2BhmJ0qAMRlIxmGc7/3y9umszZNkmQQp3HqjDsXFjjH4Evp+doPtfbFZRRNjD2C59t6Pm3xPG9qenpqehq17A8GCPji5ctep5PrydE5dmyy1BJpz5ucnlpdu377zu1bt2/dunlrZXVlem5WXUkvtm6YbYc8rhpTQdgIwsbUNADcJtp5+/bt5ub2u3c7Ozu17Z1iUAz88PTkNO7HKBiltNYGnrdx4+YXX3755RdfTS8uXZryjIT051yKKxoiIdEvBGFY8DzfuZgcEVEOKBKRyZIsiU2anPMqzou0cxans8Rjn+ysdfr48eNvf//77c1NApqemBAgHBGiAAFBEEzOTF/fuHHv7t3rGzcnZ6elllGSDPqD5unpu7ebtac17Xn+3h5ZVymVPKk7Z612FB3t7b3bfPNua2v9YL9ebwgtQIDUSil1ed4BhMiInNfxKBBRKuUBOEsCIPCD0A99T0slhVLa9wLmer0xOzc3+fp1M06rWk5MTgZapdaStUIJgSqXFrNzOQU4r2OGBvS5tGUYhTKc06FEce6Dm5dHDnjEWBLnozIGtrlNBJ1TLoRAQmZCISUK6fkahfA93w+CSiXa3j/Ii+WFhYWJahUAOIn2DvZevHn5/fc/9NtnZKx1Bpi1p6WWTG7M1mvoCXExIqLRsAZy7ppAlCyEAyJg55xjRmCttFIKBZKjLMksGUChlZSeJ6WEkTPhEKwSaMGiY2RAC2mUdNpt2qEkTaM4tuwEYhCE88cLSLy4MBvHV+yRiS8zrc7fbBqn7dbZ6clJp91GhFKxqJRGRgaQQgUAntZZkh0fHe9s7xZL5fr0NAAOw+VyT5nL8gAGeC/AU7yv4+QhM5zOx/qXyzG+MLQe+xqcHr9+8eLht9/+7nd/ePLsyd7B/qDfRSl8TzMiIDtgAvAKhYmZ2eu3bn/24NNGo95sntUmJoQXJFnaGwyiKDbkAgAlJAIkcdRpn+3u7jx7VpyZmF5fXf34k0/IWe37frFI4PLyXwhUSguRWWKyVvm2JFW93phfXrx2bWNldaVUqZjMDaIoj2Wcmp/3Lk7WkaXOqFLmyyXaex57I5Pwfv/45Ohgf695ehJqrcJASZkkiTPWU7pRbyzMz8/Oz4PQANDt9Y4OD9+923rx/EWz2XSZccYQkaeVr3wpcrq8cIgopKel9jxK01z6Qewcu/GOM09uu1I6x9Hg8PDw7da7GKDZ68dpFPheHCXWZMgoczkMoMRc/C1RCUbUShnr4iQZRFEKkBlj6VKOFo9zRK7iayxRCAB21O8Pjo4Ol6s1ADg9OR4MImMNM6EQYpRKkmPjQ43TpWWIxmatVqt1cto6PT0+PN7f33/18uXzZ8/29nZ7/R4gBUHoe365UJaMQmkEkZgkTjJGKBfD1WvXP/n8y5/83U8efPrp9Zs3pfbGDWJsZpSnQciJqZmJqZlqrY4ImbUOANVuHMdITM6h5wVa+1paR4hokvSwt5elqbWWmKXW1UZ9fmHh2vX1e/fuB4E3OTF5dbr/Y9rsv94XjclZLS6sPqN29vzh5nfffIvy2cat9sf3YXUOQ4K4TTPT9uOPySvh1q48a4tBJgYnmHaQK1BsQGnGzk+7RtlVi3Z2wq3Ms6owxPLVC/kvv9G//IPcOeTJmr19w331Nd27xzCD4AH0CTJKDTt0LCAAQAvgINAwWRduWRRLbmUdVpahFMDZERxsQxbh+grOzcD6Tfrip3bjjmMLm3URKCjX4aDnhLZzDacE7OxDP8M+eK92/V/+Xv3853LnCAEArJyfoGqDw4CCoitXbKmaTU1kxcB1zvCwp5+89F9u+QexD8CIJlAu9FlYHER41tfRnjhuSmXEhCeqZViqkSpREECgATI2KSKIUiDrFb9cikmg6FBzjx89g+cvxN4eyRTrk3h9A2/cg3LVvm3GZ9349eZeWDw6PRmMP/9S5IMZHp2FAJeM0EZk5yszEWviOI4HkUnTcxEQM+YETyW18jyl1FXN85DLyeMHA+Alc8vVtdVPP/10MBiUisX9/f04jpG5EATFYsnTSioVFgqTk5PLK6vLK2vr6+trqyv16YnLky1wSUbWSqGEEozAzlkABFRKXBLLCLG0vq6DoFqtT87MzC8trV9bPzk+bjfPev2+zYxj56zzPW91dfXu/XtzCwsXxYojIsrD08cJN1cTDAWikCKnQmUZM0gp2RFz7n9jsizNMsM/YmSAeHXk0DlrH+zv7+7sNrv9asH3tCbmLMqk501NTW3cunnz5q3rN28sL6/MzM1VKhVUMjM2TdNup7u0uFSpVZRUvuf1Oh2NSI4YwQAMnDs5bW6/297c3JyYmJqbnwMBILVQYpRMKaSQeBFgPAT5yNo4jtMkiaLUAiRZWiiW+oMoTrI0S60jAKG9oFipVGt165qVSqVarWqlPWvIuZE9HggEJkAGyslow5xRYAAlBQjMt/LcUXNUBDFc5NcBE+RjE8kMQuSHBBM564yx1rlcZ3Ae5E2khEAphUTheb4fBtJTlV4n6UWNyUa9XgsLYY4tdXrdo6Pjnd3d2PG4nvbfQBD5kbwE+4H5LDiADAA0gJagEIVGZAkCSfAQ63ZgMmucSy4/ZgMTwd7e9NRU5+zMZtmHKWKI40MTAOh2u2et1tlZO3I2yNXbQgIwkZNSer5WSqVpcnp6srO7OzU9Xa7V1JjFAzHL9xp6uqwdRcxN9SQiEo8sOsVQJ36emsCXQSWttdIKKDs+ae0dHJwdH0XdbrfdPjk+fPPm9dMnT95uve1FAyXRl16apnE8yIxLUiqHwcrq2q1bd2/fuXvv7keVeqXT7VWrdaG0syZLzO7eXhIlzrjA8zwtkBmIU2uiKG0dto729rqdTlAMp+fmZlaXvMDXvhajsEghBDmXGaOMEYilcnlubn5tfX3j5ka9MUGO0zTLrAv9YGJiUo/ZKY+ilnCk1zoPj7vMkZBiaLI45H51zk6brWazH8VeEaUQGXNmrNRWB97U1OTCwvzs/HCDGvT7Z+2z5knzYH+/NUjGxYoIae69VwIolkthqai0VkolSUI8XjH/OQKBc1kcx6PFmsYxAqdpbBJjzHD5ulFV7gH4ArXnK09p7fX7g55xANAZpP1eL83Sc1rkObefAQTmiQISLTERAHueF8iImHZ2dn7xrz+/0zxNs+yHhw/fvXvX7/WstZi7oI/VviIv6uwleZFJzdlZ6/Xr129fv363+W5/d3d3d3f/YD+KUwegBAiRKVQo2Dk0g9iyM0xBGMwuLSyvrd67d++rL77+9NNPb9y4AeLSQ6S8q6XR6spS57PPUMDU5OSbt28ODg5Oj07aZ2fdTgcBpZKeUohoctQjNRYgAYDUnPSjXrdbKIS379ypVKqFYkko9Wfnm/+WEg2BkZwcq/j6R73NH7Zefft0avpt/SO4vQYrC2D7MAjN9DSvb+Bnx+rRC/n94+Dxc72/qaIYdNWgTuobZu1GurbMUyUqBzzdYNDcOsCHz/1v/lB480qV6+bvHmT//I/Z+l0s1hn6AhzCwIEAP+BMMmogBGkBiKsBL8xQuSwrVT2/DLUadDvuYMs1D0W9IP7pZ3JmFlau8dyqg1oCKTRCnJ0Un51ys0PtAZx18PTUe7mp2wPZbHtHLbGzg0cdAjAAwgcR+Lgwyyurdnbe1etWiSQZcLeNb1/pnV1va8c/6frlQEjPFQpU9IwEZ4wYRKo3EDF4sM07oXw6AROT7E1lC+vo+7w8ybfXspM90U/k3LRGhJ0jgO9NmtHjJ/CrX+Grl9JDuHON7n0MH31mG9dTSI0TkBIkadrtxO1Wh3uA5aFmTgt/KCXHYbQHAwi+ANgRkZiuUCutdWmaRXGUJSkgaq21pzkf7QBKJbw8We+yrplzO7axYCIGIkQmBzgUECHz0uLiR/fvaSGLxWLn7EwJNTk9Mb+wMDU1Va1Wq7VatVqt1GrlUqVcLZVGpuqjk40yN8z4Y3CC8lhRyssMw4QEUlyq0mqNhg782uzkWnQ9ieMkiaJ+3Ov3+93uIIqyNJVSTjQmFldXePRxnCOXZUQMisdddui9WhZRABMCCxRKKRDCWuVsxuQyY9IsTTKbve80RQyCEUEgaiXH7ciTOE6yzBpjc6qdtYMkOWt3y+XyxtTEg88f/OSn/7C2vuZ5BaVlbhIdhgFRpV5rrK+u+IEXx3GcRO+23kX9XpwlyVDGJTKyh82Tnd3duYXlcr1eKgYAoKXO6VYIIKTUODSMyMt2a63NsixN+4kxQ9Ie9wb9XhzHaRpnxhhLiFLrQqlcrtcsU6lQLhQrnq98m+fC56nmJFGgQCEkUx4EPmSSSGQldT7yy6yN4zjLMnLM5GC0SoUUWkkpldRaCiGVlEO/9CHbmokdueH/5kxhOcLbhABmIYTyfJlkxUqtBqoxMVms1LQXAEDG5AhY4L/HJOrfRqM7L9/YAQMjMQ4HPRe/5/wgvLrr5uDW1dp/mMM4LFXVRTBA3O4cHR6etk77g44dkSqFEHkdJYTwtZZSRkm0f7D/bntzamZ6YnqqPjl5bqBDzPIiAXqYysNMjoUavYxEVEIoFAiY89OHzqtCggAc6XevPERKeQiQpOmr1y//j//+88ff/fHstMVIWojBYHB4cuSIiqVSIfCJqXfWPouNBSgqvLa2/uCLr77+4st7t++urK6BlNX61OTErFaeZECH4Gj73btBYrLElAKvUq2EhSIRJHHcPOvutHr8+MnKtesP/q67KFQYhp72xTCsR6AAx2wdOWtBiDAIarXqzPTUwtzC5PSMZbbGOWOYIfADecF5x7HR8HBWNT7gBD436RLkhiVat3l2dLDfbjWjQd8ORc3sRiuhUCzNzMwuLy1XqvWR+ip1xlE+yX4Pw8xd4xOAIG9azrvKIbonAP58AIKQUmutAQwAAvi+7wU+OQckgFJ2F0ReAkgALLFKEm2k8swgTcc6ndgZeyERIh66nTsSeVSGUiI1xMAMSutysciOXr18Fafx//EvPydynVbr8OSk3+um1gCiUBIdwnBsKwCYkNxlZYyxrt3u7e7tP332/MWz50dHh4N+n8mWSmEQ+jkbmy3HmUmjZOAsAJRKxaWVpU8/f/DJZ5/dvfvR9Y3rc/Pzf2EAyo0btyYatVs3b75+/frF8+dPHv3w+PtHu51O7FgBFLQM/JCRlVIl35cASZq2UpPTIQrF4vzCwtra2tTsnM7NmYmFuDB//5uUaKCABdL55+m2zk73D9rHB40yNEJYmgY9K3THhYGDkCAU6z2cmlUqhDgTcVN1BiD7LrDUKGfLa+m9u1CqAhiAGJuH/MfH8O1jsbWrUMgba+Y/fEk//XuGGYYOuGN0CWjBqFgqUOcsUwaQVK3QwizVMw7KWKoo4+DsDA4PoXeG9QbeuA3XbwFMMgBBBJCAp3h+jmYnORnAaQtebOuTpr95FL7aVIcHIk6IwJYgK/lUCLBaUZNTYnrWLS3bpWVbLxsT8XZP7O6oPz5Sr7dUZyA9DfUK+6EFIMxcai2QIMSiFBWQhYLgVO9su8fPeWKS50sOC3xrnX7yuZEEJ01Phdok4sVzePMO2m3z7Ck8ewxJH66v4eqauHVPLt1yUHfQBuVDrQqNuvBk3Gmd7O/uL2zMgwIJgoXKQ5uImfHcPOIiTmBYflxB0YCNNZkxhijXMSmlRl6pjOfieb4k5sqbwguLtfxXKzUeriOlXFlaDD1dL5amJxqnzabSem5hfnV9bWl1ZWZ62tMf8Bd17AiG+5GSUoTeFYP3UcIHMbOljAHEMAtNBoVCUChMwNSV39ntttuddhzHCOj5XqlS8gr+6E0K4XmKeRgVcs7ueY+OlkM2ubm2GGq4hsC7dS6zLsuso3F1+SVOFQCgUGPB186SZSLK5W9SshCJMTGAdllQKiyurtz96G6pdME9cmSluBiUblzfeP3q1ctKRWiVOZs46xRqFn6xBEoNoqjZbLXbrSxLoRjAyPsr94sQ+bENKM9BRIAwDCuVct1RHEXGGt8PpmfmJieny9VaGBaF9rSQlVpjcXn5rNvtttthEFYqFa010RBGydX1uRnTObWBnANiAFISPe0JKbMs67TbxycnrVYzSxJyhAKdc0Tgecrz/FKlUi6XC4WC7/tSKimEkHLIDxMi1+5Za5gYEEUumRnZhObXOctspVHvDfoLc7Nziwu5UTshFkqlqenZheXl9nHTGSMYtCe8MGApTJYaSzkaJ4QgR+wsOUIUUg45MMSUm5YMvd4cs3PEw5/JmdpDC9LxI1XkJoQIY8mtTExMLvd3QBjZqwGiYCJHpLQSSkntTTYaU9PTpXJVa++qQeVYjzRcJZnZ3d05PNzv9bq5aXse5OwcWZsaY5hZKSWlGESD/YP96mZ9dm5+48aNvETLNwgBhFfNKpjGmaHDzzR8BPI7Mubywyjo/VCG82PIWNdunb198/oPf/jj9u4uA5QCz/c95twoOwhCP01TEEqCCSSsrK4++OzB33319ScffbK0uAxS5oVpqVy8ffueyzJwzJaAcX9/32ZGSC2E8nSAQgJjoCJrLYBEIQWKIAjTNJNKMSAxQZ4FR3TOg5RSekr7gV8sFgFQISpPgKfHMA/+EFvyvaR55lFe8bB37p21Xjx/vvn2dafdzo3BlZTMYK01AIAYFgqTkxOzc7PjnWGpWJ6cnplfWJQHh9YZJaWn/cD3BVGUJDbLpJTa95nZZpn0EXFE+wX4SwKqtNZhsVjxdTM1FQ9KpZLvB0ioJXGBAICds9Yaa9k5FCiUzu0/tFbSi087fQDQCKVyRQfBB+yLmYByhllueOaYKQhCRJFmZmdn5/Xma+ccSvSVVtrTWiolc7DfneehD+OhxHsuilIqjUJmxvYGg063Yy2HoVcolQqF0Dkyxli2ErQMKDTgh8H88tInn376j//4T19+9eXatetaBX8JCz9/4TAMFpdWF5dWl5YWp6cmA9+zmQXE5smJYwo8Xys18r8SSimvWNRxrHxveWV548bNtWsb88srF7HxlI/+4U9jaeov7RkRcrbKxVrs2XZzP7WnstAvVaBSBj9EkAgFBMugGKSDAs3N23sfRaklae2WRpm6QsEWA9MoQ2kKIABwkBzB7/8ofv47fPyaMMxu3hCff5He3XBDdiyhydBalpKFAgAkEuRQSQbpQINXslUjZewIud/jfuaO2txOMHXCs6I94P0j0i2IetjtqDgGIiUk+oo1WkNYrcr1aww+Vcpur0JRl5RMG3VTm3B+IFBYPxT1BiOafseZAUU9ubunt/Zxa1/sdgHAlAUyYRa5OIY0kwDoB1AOeXrazTayki9jKwd99eI5zdZ5dRbmr5vasn3wgDwF25t4eCKbLXl0oC1Q7LgXYWOKKiv29nW4to6zkxLykqJkZqdpYw16XRPgaff09daruULoVWYnZQAIMncjdUN26qU9csTkgnHi6hBzy5nS58aFow1/ePS+l+KSz6PGwp5GXohXGzb0CsXFtfXFmdn19bWzTkdp2ZiemZ1b+BMLTaKUf7KhGclUxV9uAlip1CqV2o/+QimusCdGVk80DkQPC0GB5wZzNLLJJibnyDlrnHP8wcjH/BdeelUGSLIkiuM8lkgrHQSBHMQglWU2zl5B8cbrMwAolUrOuX48GMSRY5Ke1qEPAkBJQrBE1lniC5jm/J0765y1RCBQSIFMjomCwJ+dm19bW5+YnEjTJM2slqJYrM4tLiyvrc3OL9ZqDSnloiMH1JicjpOBr/0wCISUQxYisyUHRELmWYiCGYgpN9O05AJPSqm10s7Z7e2tR48fJ2mSJAkBI0BqrXMOBQRhODs/v7S4OD09XalWtfaElHllBmOO7dY6BAIUKOVF3TOKUHaOev1+ksSNWuPW7buFcg41y0Zj4saNG8jYbXWcswggJWjPBwk2NTav8BQKAHYI4PJku+GQGgGG/oIjhrhjHB4/w0OFmZxzw7TEMR4djzxveQgYMtu8x3BMjGI0fpYopc7d8IUSUkipZblSXV1ZmZmd88f4xfmlcOwky/H9vXly+m5ra39/PxoMpBAeOM/zBKK1WZpmaRIzoud5KMRgMNjZ3taeXl5aGfQH44/35TTSsTNy/NBCJrq6OYzUAITD+gDxQw+DlGqiMbGytLS4tNRstdpR1E4ySDIFUC2F1roojojYC/z1memFhcU7d+9+8dnX9z/+ZGVtuVS7FPddnahev75B1vrar9Xrb16/OTjY7/S6g/6g2WwZRwoAhZirN+7eu3v//kcTkzO+DhG6eSdLwwedRK7iGZZTuRTjKtXhog7+Ub7ZcHfCvAS3hHrMdsSarbevf/+7b54+eXLWOtNKlwvgB0FetRCAELJQKNYnJqcmp8dwR39qavr69Q1AXFhoOrICUQoZBH6gtCPb7/V73d5Z+2zQHxCRHOaoKwALf1moAAqUSmnPU6nxlCfzZ41AClGpVmsTE+VSSXmKHVtjiBglEpOQSksZZVmr1RoM+vV648atm41GQ474J2NxB8jMlp0jlxuvIGIe9Oksd6Jex2Sjuj+thl6pWpY83Gydyy1RSGD+qEt5+aaEYWFyavr6xs32WbvT6SRJcnbWMtb0BoNBFDsmARj4fqVWL5eK5WplcmpqZW317v2PPnvwYGPjBoph2xMnSafdSfo9YlJCSKUAkZiFkEIKVLpQCCqliznP7MIKETGKYrGyfm19f/+g3T6L+9EgGgz6vX5/0Ov1MmO05zXqjfWNax998ukXX361srr2l5XNf22Jxjxy3xRCaAJMTZo0O62dvdPmq6DSXLhOi9ehWgGwI0OuFPtNTGJhDHNg5tcyvxKXi6pWFa0DqE3YcsjBudArgbdv8Te/Fb/5PabC3f8k+tnf81e3bWPCQhtAIKSoPVCKBQIiMAkizU6RyEBQTkrNMu52XDfmXmp6xnX72LE6Y9lpyd0W8jeQpZj2vUEEWSaYhPRUWKBi2U1Nu/kFunuHHnwcDfp4soutFjtyYZCpossAegMdRSLO8PCAtrc4i72or0474uAUMgZPOwEUaGdTkQywTcKBBBAVydNzfG3D3dugYuB2duSzV3Jnx3tUoeUlNzXNegYWbzktqCzRxur4QHRaiqULa7yxzvVJnp52s3WcqYCJFZwCVCQosbYQP7gFnA2ah9u90ycvH5eU8td9PTVXzbXPBJwRKXHhs3kpZB1y7eWFSQ8KzOdKQkgxOkTORynWkbWWiBjxioXSeYWWb3RSih8lPBYKSxs3luD/P74u+yXxWCQ8KqEQBTM7Y/IgHWZGFAKAiJxjtu5KNHXOkx2S4dmNP25KayZIjcuHAp7nhVAsJYnydafbefX29ZOnj7/88iuB3gff58np4fb29vbOzmnrVAnpBx47z5qMiVDIsBiWq5VypXyeuEwjXa9zLs2sG+bbC8eUq+Fu3rz5n/+n/+nTTz+N4iyzVrjUOihVa8VyrVwqFQqhlFiqVqemZ27fHbBz+UASQOQZMyNK2cgQSwgYDTodkbEmDDwpPU9ppeC7h9+2O939vf1cFyeYjTFRGguBnu/Pz8/f//jj6xsb07PThUKRSCCCc9Y6py6W2fucn+F6RgBmYUxmTOoHYbXWKJYr+UBnemb6o48+npmZHfRjcKPMQIGjhiTn7rAYJm1fgFWjQgSBMa9aBDMyCAYh8DydfahoIJJKSCEQBUPuvUnnhoIjy6c8vI0FIQpCKRAJUSBKyqs4gbk1fFgsTs/MLC4thYXC1bXqHAkSQhCzFKLf6W6+e/vi5Yu97Z04Gnieh4B+6As1Cn3IISLPc0SDdq/ZbDPzxvrG6enxTbhzYTTFdF7y8tCZmq/0+kRAlpy1uZ++klKMVhcw5TUtX3bkAkRyTkgZesGNjQ0BOD09PTc//4t//fneyWk+CE7SLBrEKUMh8K5fu/bFF1989tlnd+7eu75+vT4xHZbC9+94Y2bqjlZTUzMr62vPnz1/8uTJ48c/vHjxvD2i7k2HlY8//fQ//5f/8h//039ZWFsFwMxmmckcEztHziExolBaeZ6HUg5dda2xZP0fkc2NKQbO99chnUSMHrfM2kCKc4pI+6z1ww+Pvvntb54+fdJst/zAE+hrJZlRSl2QtlatTdQnpian0b8wfQgK4dzCwn1LM7OzvX6f2ZIjJtJK18oVpWW709588+aHR486Z+00yxBAaf3jfvsfxl+YnLXWAhjrssQ6l0bRwPOCcrl848bG+rVrtXpdCLSZISKQkoAQhRIyNW4w6MVxWiiE66uri0tL56TGsYoWHDty1tqMRqwyJZQTjNJoTymT5RTOgoIgCDyppJI5J4DI5W3mkAghhLoc41YuVVZX1yYnpqrlclgIC8Xw2dPnB4cHzd5QWxNqrNXrK6srN27cWF+/vnZ9dXFldXp6dmJq6rw+y0y6v7vzbvPd8eFBEkfK85RCR+wcBb4/OTU5u7DgL15NxpubXwiKlbX1jd5Z6/Bgb2tza2tra3d3e293J93ebzfPGABssrhc+uTTz/7DP//zJ598Oj0zewmPkOcV/L8bRRsJvFGgZIB4EO3tbL998sPJ2ZvqZG9y3r91PZqaBGCAmMFiNMB3O2JnBzMD86v21qduaRUaDfCKuPVMBRoaExgCQo8BAHbgxSvx9Jna3xdLG/TxffMP/2iW5hj6AKcCLIIPUjIrPj8FhFMIQoIE4cC5dh92DnHnHRy2uBO5BMBpZiGzTLWb8nAXjg+h1wGbobPCWilICY0q5Po0XdtIvxB2ccnc2zBYZTAIPbCx60d8NoDjHuyfmP0jdXgid97KowPdPpNRKi2LDJ0DqtWdJ9lHkFZKEDIVDqX2sTZFC4u0es1du0m+xH7q4VtstdSLt3rxmZudF3dLBHWYuc6U2JNWtneEZ11BKOplubxK1+7Q7CwpEvGp2N9HdGrdSGxwPcjuXnds3FNzcrTz8lmvzHq6trIyNVc9P4mdcxKUwA/fdhzSHkbjSCGkUkprqYd7Uz4fyXnzzPnUhd4H0kbQxRBRco4R3UXPiPgXTvcJMmstImrp/xs6jA8baI1Up6M9wmQmE1JoEV4RFl16xTHX9g8H20nIBYuWyNmLCyXyVmuYlMrvDTnPQ9MusYmKpVK5Ui6VwrN+bJ1L0hSIfF+DFO322bMnTwp+YDPz5eefe2HlyhvJou4P333/+uXLg5297lmnXC56WpNzJk5FgL7nTU1Pzy8tTkxNBqP0G3aEQiAK4BHnFhEQrbXWWs/3FxYXv/zqq9VrN/7ElfV8v1wp//vv0MbNm9/+4VuttRtCNOiczVIyvlGeqjcmVlZW7ty5PTGz8DcsvrXSM9NznvZWllezzEAeJc4khtnGIp9SWrbALJXKJ6xEuVDBAYDIrWopT3MmiVLlEeIoEJhyo8+ha6hSUqCQDGDJOXL5IzGcH9KQLTrURyOLEeOcAS2xHc5PUUjh+V65UmlMTBbCq9Fe50Bvzu7v9Xubb9++efVid3c7iRPfC5RUApGZhNJBGHi+h0IoKeMkSTOXAJw1WweHB3u7u71Ws9yYAAApFCocjvWZGS9imy6nObFjlwtshRQiD9QiIiIg56SAkbvK1TdMLLVqTM98OT2zurrSmKgD0C9/8avD4+NAe6VS0Viryc1Mz9y9f/+n//CPP/37v1+/vgHjeggGIoLcW0CA9v2JudmJudm1a+vLq6sT09Ne4Kcme/js2cjX6vo//Ief/V/+63+9fvfucIMwzhmbb23GWkMOAGSO1iI459I0jeM0TdNicZy2ay9G6uPKqSHT99JBmxMrxZgz9v7B/rOnT548fryzvY0Ky6VyrlVyzkkhJxoTiwuL8/MLjUb9MkpUnJufLxRLyyuLmcmYyVqTJZmn9USjUSwWWmetMAh2dnZeOxdFSRgE2vMkSgQDfxmMlj8H+W6Wi59MZqJBLFEWi8XVa+sPPv98YXFRa51lGTkCiY6ZgZVQRJykqTVGSFmrVKanp5TWQ6YeXhL85mSI83LWkbPGImK5XA6DwDFJKbWWUiohUKKwfJkzSgAEAi4pYwhASFmpVirVSr1W9Qt+GIaeH4pHantnJ86MljA/P3/92vX79z/66OOPP/7kk42bN/xC8XKbY1unJzvb248ePnzz+nUU9b3A932dZmmSZOVy+frGde3ryekJBof5oUYEQqD0Go2JRmMCANikr16+ePL4cf1VvVytKD+Is/TgtFUrFdevb3z64LOvf/KTxsTU+UKSSuGfm2/+FSXa0L1aXhw7/W53693bJy+/bzVfNSqdtSXvo9vJ6hJDmUEyZNCNcGdXPH+GzkGxzCXfgQ/LtyBNuVI0wojFGawWJXS5d8LvXvPmtuzHXqki1xbTm2tuaZ6hDJAKl0nKQACLkM75VYgswSJKKRlQ9DOxdyIevVSvnuL+IfadEgF5RQ2BtkY1m3L7HezvQT/K1Wb53kEIDMg1i0ZL3+eyzyWma/cIZgkmSTHX3sDZKfaPoXmEBwdq653/8rne3dZNHrVJwAUfKhVVCKhcduWAKiFVCxAGoDQKD8MST1bJWdvtw1lX9jPRTjDZF6VHqlj1ix6v3nPQgLkb5los+hZ0SfVjKFSwWpQlDzVAnMBRE+MmnB7TWZNn593UHC9PAK/B2fbg1cPdk2ZDFG/f/6dsbOu07DIUWiCIvyARTOT8M+3lsiNrDVlCiWLodATsHBGx4yvg0FgtIpSEOIrbnbNOu9Npt3q9rskyINBKBn7gKSUlMgpiMo6MIwLKKQlZlpksI2Yhhef52tO5F2LO1DkfseRuyTjmGsLAgIyYV6JIuUKQHDsi50CgFFIqAYDWGOfIkVNSelpLpXO3RSLnDAHKsFCamZ5dWJwvlUvjZ8kH0TWi8/FOjisIKYXUWnva87TWnrxMxRjakgw9HC4FQFXLleXl5fX19bevXmeZaTZbqJARPN8zcbrzbkexSAZJ++RkeWWVhS8QiFJgdFm2vbP98NuHh7v7NjOSgSwlg6h9djYwAJyGhXBxcfH6xsb05KRSOYrmyDgpUEmppVJSSkcIQMzOGGsME3u+X59o/J8DVYZhQUiZ29OPEFmR500KQK11EIZBWPjbvqhUqlqvF4vFEewncs8qiahyCoyUxExkiZ2UUg2vEzlrHeUlmgIUkId6EaAQapiDhoxDZhkRiTxUSw4/lHXk2F0Iq3PXVzEKTQAQIke387kbGGfSzBpjiEgIFEpoP/D9wPP8q3M3utQSJFG0u7394vmLd1vvsjTV2pMS0zRNsywMw2qtprV2zkWDaBBFQ64qUavVfPnyxeLS4keffloq5yGzcoi4O0Y1PEgE8/ubST79HxU3eJ6uKCR+MDqCiMQYHWJ6YfHTB18cH586y1vv3tnMBsXA07pUqaytrd3/9P6nDx6sXbsOl/WqkKsf8GpD51dKdz/9uFAuVeu1qdnphZXl3Z3darX65Zdff/mTv9u4d3dcxk7OknVMlLcoRJTDlhIv2HXWuJz1zuQAwDqrh5PLDyhOcIynmyNq+kJyzumg/+r1y7ebm0fHh73+oFwpAAI5F0cxOQjDcGl55dadu9c3bjQmL1Fptec1JiaqtYq1jogZnU1NkmS+59Xr1WKp0O10DvcPCoWCcy4FyE1/xJDW8Nc/IygFSnKpc8zEvu9PTUwuLy+vrF/zPG1MZq1DCcYxM0nUiGCsA7LEqKTwPJ8JQLC1Tgih8kp9aAyCKBEM5+Fbmc2yLLNMfhDUanXtaQTIjEnTON9kh7itGJL58pEOXY6AIr5YTmGpeOfefQQhpA78wuT0VJpmE5MT19dXV1fW19bWNq7fuL6xcbk+A2Ky1saD5OTo6OXz59//8EM06BWrpVKhOIgG/X6/XK4Au+WVpSxN8wtqjCFmrdT4HBy1f21jA6Uo16oLS8vLq9dX1q4dHR2Vy5UHn39+/95H5/UZXRmz/G1KNGbHPP6UdNtnrzbfvHz7RJrXt1fObi/ivVXfn02hwEBAfTw+we1dsfUOhYClIzQ9oWsOwG6sgnLgM5WrKhQyOuVnb/nFS9w/VfVpb25Nfn7PLdcNWAcGAIUMJAsAaTmn1SAIBBQklFFogUQUi/0T+ey1+v134skP2Goxa1moQVBCiypzutcXpwPOFIoCStCaHZCVbB07kOAATpri2x/E6a7eeyX/46n78mcWZh1kNDiGzWfi2VuxdSJ3TvXWXnBwWGixGknoLQDYVCoSoceNCbG04G6tuVsL6XSdEORJVx41ZfcM3ryQxyf0Zo+PzqhPrtWV7rEnWJQFV/2sftvCPFyXWVDmxjqdHMpBJBDF6YE6O4KzLhwectQhH+zeDm2smvtECzdhaQbqRYg7zZ13x9W5Vr+fje0UGZIVMNQsjhPQED+AqEopfc8LA39IDjDWOKPz3BAp8iRHyuuesYUlLrRaOc9epkm0u7Pz8sWLly9f7mxtdbsdJud5frkYauURO3IuDwpyI28rgUCjUKqLBXseopJzdSjnRQybeCHywVju84Yopc4T6NiRY0du5AMiAFiAyDFDMXShHyIVCKiVJOYky1D40/OzDz598FPvp3mJlvthDRu+S5MdyrLMGGutyznXzkpiEkJopcMwLJaKQejLsXBM5nHTkzy+8OIGVCuVO7duHR0eKMC3m5u93gABwpIX6LJCGLS7W9mbXqu98+pVtV5XOpBCEjtnTZqmndZZq9nqd3vloCgZCTiJosgAAISBPzU5ubK8un5tvTZi4Lksc9ZIEJ7SgedprVVmhEC21joy1mSZSZKk3+tVa5P/Q8bHY/TH3O0pTpLMWrCEAqUQCoQHkPt0mywdRINuv1es1P+G70EIEQQFDEMJAkSeCzCMA/0z+6P373pd9Vf+fABQBgACIsuMjDSE6vBSYvoQxR4TuJ2dnW3v7Lx5/Xpv7yAMvEqthojWWqVUtVa7du1avVrtDfrvtrabraYEKAB4QdBut588flwICwzw0aeflMu1EdsSmDh3zCMYBV2dhzzliQLDIO3zQM58xC0IIWe4XkXR4FKJBgDT09OffPqZ9vw3b9502h3P96anp69du7ZxY2NqZnpyagpHhQ4xDwO7YCw25b2vtevXZmZmb9+99fmXX+zs7pLj5dXl6zeuX4LZM+uMRWDEUa8lUWJOgR82W0qpnFYlEPJUYyXUuSnPCErLzWvHqHtENsuEUKjEOd6zu7O99er1D9//cLC/nySJECAlAtksTQeDgVTebH3hxs1bnz14cPvO3XpjcswOA6RWvvRRAjLmrkZkKU2yIPTzt1epT5aqFakUETkAci5PS/urKjS6UHcqJaUUMm8aEKXWXlgo+GEIIDypNBMgeMSWSEmJgCEjsc29NtiBdUSWksRoXynUIISUrJX0lOcpT0AqpCTm1CSDOEKhKtXq1MxMuVoha9uddvPUpXGUK2SRQaFUQubwgXMm33svFVjEanSd6/XGRx9/LKWuVmu3j+94Wi8uL62vrdZrk+VysRSWglLpvR5D+n6AAnqD/u7h7uu3rwa9/tTkRKVa7fe7zVazXCrPzEz1e312Lo+3EVIi81VLJgDphcur1xqT03GU9KP+WbPZ63WFENPTs8tjYZ35vcH/ARvIJVChO0je7R68292ZLhzWi25luhBWBGQC9rnfE/vH4vUbub0jD45RMLx+A48f4qcFCzVBqZmocKUIUAXow8kr8egRfvdM9DK1tCJu34Q76zhTAWgDJAiEoAWIEUckT+STIDUL7YDBZeqgpZ+91t8/8b5/Ll69xoFlLVw1YS8Ay9ISZAAORFASiMITrJAkk7CGyTpk1CKJ9esj+e6p3tviOLOiAA8+BrRwdALNE3Gyr44O9Ek7iPt+WPJmfUiNTbNMgg19qFdlY0LXJ3lqHldW6MYNvrtCM1VylsM96LZx60S+2cR3e/Koh4kAUJxmtHskfZArFX1n1tanAFagsMA3iqY0xwd7tLetTg7FwZ48bcLeERy1HGVQ1txpuNCz164DaPBLUCgCCx6kvU7UGwz641p89eP4Gb6n8pFSBGEYhqHveYzCOuec83KonJGsdcY6a96v/a/gTJkxx0eHz54+/f3vfvfk8eOTk5YB8BHKZU9JmaaZzRwRYN5hCpFv8bn2DwQQMTnrhvQgyJMOxblnJhEAj5A0wfnEBGBYogmRc8FyOeUwqZPonLU9DEUZvoJD5sAPGCFKMuH7K9eu+dq/d//eOOP3/S6HyFpj0zR11o4SSjHPKJRS+oHvB4EfBFLJK84Mw2gsuGpeVamUb966EUWRYLREW5ubcRQzEZksJY5Mr3V0vLO5hQBKKc/zldZAkGVZHEcmM1LJMCwIJX2tjbMKRVmC7wfra+sb16+vrq1OjikkLDlHBAhSCCFyrgcMVboMTGyt6ff7pycnC0tro/rSJUnieUH+ts83RjwXvJ7b8v54BE7+I46cSZMwLOBo7UVRYrLMWcvAEoQAVCgVoAQBjqw1SRQPBoMkiYKgMD6OGcqLhxwpEsCI5wcn8lgWLQ5jAC40eIgoBeaRP6Pt8v+HSZECxNBTRo6rWS7Go0Jozx+hpJCl2d7+/tHBQbPZHADIzHAuXnBOaz0zPX337t2ZmZn9/f3Tk2aWZQ6gWAjK5WKaJq9ev0SBYbm4sLiQl2jjFMycAIzv65QRBQrA3IInL3SEEIJGN4Leyxe4TCPPearFGzdulCuVuYWF05MTpdTS8vLHH300MXVRqVhjUeAwsfwvON0K5eKNW7eX11b3Dw4GvV5QKFQuiwy0Ur7nBzrwta+lziCz1lqGLMusNUQ87Kjw0j4wbpp4pf99T2WYa5ABADpnzVfPn//+d988fvTo7OxMay2K4HmecxTHcWyppLAxMXnjxq37H320ur46FjAFACylEPI8ABURQGiJQsqxESoKCTiMdaJ/36KTiBLliMIyjsThsKTBXENPEoXM0ycRBHiQA68SQCBRjlkP878YQCCIHGsdmslxZmwUx0FYqNRq69evL8wvmCzd3n7njDnNMmOMc5R3CEOFNXM+jR0v0ZAhyRJfe3r0FJQqlTv37pZK5U6vU62WV1bXSmNlGTtiptyTjJjPjSGFUsaawaB3dtbOGMJ+X2vd7w3akTG2PRgMHDvfD87Zruf+N0QXpkJCKj8Ir4RHXTyyQyQC8+MP/keXaJ2E9g+7RwfNxmJaqUJ9ygCJ/afw6I1oNlW7pw5O1btdPOlCZsk8B4v4dlsuLGK1IiZqrtIgKDDEdNhUj16qh0+96iR+8pl78Em2uGirgiCCLAVULNCRIBy2dGAdSgTwGDyADAYtev4Mf/9QfPtIbh+ojsUMCAld02nNKFgo4ICVzyhZKieQFXAALJUA61myliBLIOqDAYRd/N1jUZqSvYSWJ50TbnIO5nrQHui+UX6Fi5NxpWakzDhJIWMN0itiGJJf4LBItQpzhoeHfueUs4T3jtW7HdzcE292xMGhGLAISiLwwEhOoizqurMTah8gnEqYZCgSVHjed2GJPQ39GM524ckmPnspj0+xoOTSNEzUwKtQqcFQAkhtUORiA8Ja7PRZt3s8cElRBgAgwQOFYgTXXyGkjUq0i28KqQLfLxRLQRgqLS82UARizjKTZGmWGWL3Z/hfzkb9QavVOjo83DtpDScvDEk3+8CKdQQAYN2f5JN9uMTk8b8y7i9bvVffQyceJUvG0eHh4dlZO/uQL+jlD+gyk+8dI64eoHPOWgsAnqe9wNeeP56UdaFxo6v8WQQXFopLy6tCSImKALRWuzs7/X737LRlDCR/wW7rdTplpb3AC8JCo1FfWV5eWlq8efvWg6++Wl5evvoAMzvnnLP5NsdDu2MpMBeKoLWUJCkAWOectcw2TdN88ooip38DMQE7opwEInMG0p+R3+axSOGl/rVWLAVBqNUw5HkYRp4jL4ASROD5pULhvD7LD4JzMVd+YskPLQ9EdMxpmiECshACVN4GDL3T3j/inTHOZMZkzpFh55jdyHECeZj0dK6CkOcnBEPuyjvyaGXHBCiFxDwKaSgYHJpToXw/n5RHZC92jMwChRAolVSe53uBkPL9T5e7AROTELn7wfBkSpL46eOnL54+Pzo+NHnSrkQUKFhopSrl8vLKyicffzw9M6M9/d23DweDQQJQBJBSZpk52j8QKOYXF0+ODlbXNy5eTw4X8LlC6P0TIXchJueYCFEKIRgks73CjhhuRwSgRuIMACmEF/hTMzNhsVit1ZrNpkCcmZsbr88AQOmrh5TNX5PIpFlmjLOGiVAKP/DKhVKuffZ9v96o+55mIZwzl7qjcrlSrVZr1VK53O32BtEgzmwKYE5PC4VCb9DLTOaY32c7jKk5x815hs4Q+QOuPD1OQdvb2Xn0ww/f/PY3r1697rbbWusw8FDInJWBAGGhMDMzfe36+sb1jcqIiJbrb4ahR/h+ISWuMpHy4fvf7uucKSVEDgde6HFzUqbAD/0jkZeo4PtjjDFHxhpmm589Of5knLOGVFnNzsx88umnt2/eSpK4+H0pjgZpFHd63dyyB0EIEDl+PCICXJr1MzNZZzjX1iAAlCvl9WtrSZZUyhWp1JULZZ0D51AIC6SFyhG4XNljHRketgTOOJNlAJBmRACFQqFaveDgOsrhYbbWkLEALJXypPrxazlskmW+48JfB6OpP81CywdM8vLd7yeu006jzkAsQqkBXi2Jut5v/gj/2/8hDvcVigCU7lnupC4y5uANvd7i3/0B72yIT+7gx5+I6SkDNQOxOziTWwdq79gPK266Pri1HOt5hi5BEzhhDhwo5tzHiQEJIc/6yt91xPv78uF38KvfwOstiCJZKKKXQmptBsSGfI1KiJyK6xjQ5DprsAIlagmIrMmRdBz67JPlEN6dwM9/j82u+PI+37vpNj5yhbpUBS4fAFayxVvx4lpU9gl7lvvKOp+kzNhlKcV9N+jz26fyj22/H6k4pSii7oBPTvGkhxFLQOVJIZlY2iCwZd8iUb+L3QNdKRHULYQEBapPAyR275izl7TfV28PGEANDCyBmphzizdwdtVBhaHFftlOrcJcFIflk1Zrc/PF6uLMUqVYEr4PUqOQ+RFxngZ9aToy9tBrLcNyuVqrVGu1MAyFRAYWKJg5yzJm6vf7cRQ5Q1dIJXBVkS6FVJ5SYaFQDVUntufL0xuVSOJyeSguh+PyyIkx3wY8AAUghcyPu/MUyPzHDIAdnRL8I0vXDU8ZkCOfoNyMmEe/J3+tUrkcFsIrEBfi1bBhY22WZmmaZibTQ2CJybGzFpCVHxSKRT8MxXubAhA7dGN5QsxEKEDpYGp6rlwqB15BBV6pWHj8/Q8vXz49PG6nf3Hh2bamYUW5XFm/tnL71q37H39849bNxfVrk9OXpENCSgY2jlLrMpvZ1OTTGSGllEqhklIoJXNIJp9fMAhNILUWQpyrggUgg8yVEULJf/MBUCmVi0EQeJ6WiokQhmKK3FxXSRF4fqVQ+jciAUL4noc8Sr4b0zS/75kfDaJ2t9tunZ21mv1ez2QW0SmpGIEdsRBCYO6VlhflDDmWR8PJzmj6zo4ZGFFKiQCYSwdyyhnmjMVhlA0LQBrqcPLMKyJHCkBp5Sm/UArLlerE5FRjYlpp+UFqtzFWa3keiRNF0aMfHn7zq99+9/DbHIgq2sz3PCmlUJ5XCOYXF2/cvHHv7t3G1FSv3yuERUsEAMZY5yhNkt6gp471/u72uzebq8trU7OzIPWowYARde/SxcvBSkeOLA1NsxiEACklsCMeCr2vWHIQkRqNey72ASkqlYrv+7VaDRGD4M/4VLV77TgaZFmaZTaOBv1BlKYpMwkhPd/zPe15Hgp0xhlrmRxKDHQQxYN6rV4IK/lmFYZhsVSqVCrdTrfX6+U7yYBgkAyMNfmN4w9V1SP4hocoWv4hLVlnpRJCCjX2XBztbj998vi7b//w+NHjw8NDJWS5WlFaCVRMrlAo+YGYX1hYWVtZXlupz06N0ypyLuMHW6AhbWNs3gd/o/KMmM7ttxEEfrAS+yu/rLNZbrw5TAUZtrwE4Hve/Pz8xx9//OUXX0XxgMidHB40T0/jNIkGA2udGCbW/AhciUIKhULipUMOwmIhLH6AySqkkKjzO4ljGG+uVFBKiNGpAexybg8DeJ5XrVX84ByIRWdZakaBSqmhS9+fm16OkhKQeHjvEP8WJdpFQT12HvcB4tiAwUDIUghBAcDnjqP9Ju5sqddvlHVaFpQLyPqUEg46QBE390FkOFdRgxXKus4L4PQUWj0YGCmVrBbdVM3puoMiQARM4CwKxyRdfn8EAkrQOjetRSCEAe7u4cuX8OI5H3eh7IuJupQ1imN2zijhPC20lqAkgXCEzpFzBglBapYS0EMkhcbXTvkktHMSziJ4+BTPOsILxPI6LC6DXzKptVgwFKaLy4PFZdMIwR8AxJxZ6Bk4i7h7xtGZax24l2+8J5vB3omOU5bC+J4BCRkL9JSnpEKQjKEgCGzgZWmG+yfqxRauSFeapsIUgQfgU71MpSKD5mT01BVBTU6K+XkxM49YNQAMZHUR5pehlVrCs6i3s/tmsyCLgQ6CQOX9NxM7vrqxXghszm+/8mrV6sTERK1a83yd78iMzMzWmiRNer1eHMdXUDRivuqBJoT2vHK1Oj011VtcClutLIsRIAwCXyvncpG2ECRzRhiPCi/6wCRkZPmYe5blS5oYmIabIoDLqTEuP+B4+OALZLwUlieGRenFzMJYS84KREcUW+cVCgtzc/V6488eDOQoTpLBYJClmQoDKRUiGgKZGQQMC2G5UimVikrqD/Td467jlwBNEZQqt+7cCYrhRL02OTlRLhdevXhxenqamVQKxcTWGADUypNKC0Sy5JxLs8QAeAKL5fLk9PS1a9fvf3z/iwefPfjiwezqet7p0pixphSSAHIJnnXOknMAzEMHXsw1VOKCPSOlYIDcNXYs4OviM4gPb900Poi7jEFmUl5Qus5OT5MoZkcChoQgRJAAiEDGDfrRWat1eny8XKqA1pex1b+oLsybY3aj0O4xx7uxaRWncdxut/f29nZ2dra3Npunp2maSIGe9gCRnaNh7pcc2Wogj3Qj53qRMUs2Hv/PHK0ccraGMbqXcjVzew5rrXVOCeF7XhiEtUZjdm5uJc2059cbjfNCPy8Mx66/OGfDnB4fPXr4/Te//c3LZ8+jKCoUi0JJBsiMKZWCqempm7du3bx5c3ZlBbRfb0xUG7VyudRrdRy5ISpMbLKseXzy4tmzRqN+x92bXVwGoXLHFiI7mmx/4BSi3Aour7B5FNXz56TZeKXqQfAD3w/8P9uV7O3tHRwcdXvdJI7TNO33+/1eP0kTymlzw2vLxASASkqlldY6CIKJxsTy0sL01KwS8ujwuN/r53rJRqMBAFrrJI6CYmFhaWF2br5Wr4eFgviRgdTIJ264WwlE0CjUeR0+knDubj1++P3D7757+fzFydFRktpiKASic+woY+JisdSYnL55+/aNmzdnZqcvF+IsBI6HBeSYKwAys7PG8z0cm2Bc4dH/G3GzccuhUVGdg+9/OkTyz/7qHP/O/Y0RQOQBXbmCp1ZbWV4Wvi75taWlpXq9XigUtBoKhEdeMXAlMve8kVZS5t9nZqAPT8KvAG8CkRjEWFoHCuEpHfphydP9zAS+rz0tpQSwgYelUrFSrsA4ssDMQ+NDARc5izQ+7Mn5OaNUwTwZTTAP0XPEv+Jiqj+tFIBhgsXFztjpRrbbK2uaqfv1ykBrUBr8CVy6KT67o0wsX76jnb7hPgGw0BAgNAJYneZrC7A4R2EI/RT1EWzuQ6uLQQgLs7Qy56YrDHoo1yGBJEEIl38golwlADoAUACIMMDjY7FzhMdN7vTAAdpUaScrNZqYABlYITK2wqS+yaTLdOoUEgEjIxFCCkCAIIQDJQQLQdqnxHAUY78vDenFbd46sDMzTksIayY4hVbfbr7Ao32oBaImOZCaULUS2eyL3hk09+X+Dr3dhe0DPuzn+DiVEghLoEPwJCtlBbCxzlhCB92+3joSQSiNh4nmVV+E9VFZTeAZl6sQShPOM25j3q6vyGpRcypcB6Ukm7EXwswMnPVMr9fJosPW0d7Z5OLkxFRwcUPxwhT5PSrIueGE5/kTU1MzMzPVWlUrbZ2zNDzJjDFxHHU63cFgcCV2g4muyKxQoPa8sFCoVmoTU1NKqyxLgTnwfSWkI4eIEpUCgUKSI4bckTwP8YFhBAailgqVsNYak5nMkLUid25HQeSYHFlCJaTnyRGlIA+FwlEW0PDtCcHDWME8iUXkj7gjImsBgRzFxniFYr3RKJdLWupLExlE5y5VpY5cNBh0u91+FPueziOFCcA5J7WulMsTk41GvZ6zIs4j+cZMSMZLncsbiVKr1zaWF+bXrq/fun1z6+3bs/ZZmqbkOImiTrsbRXFeLeSNNQDmuHIY+mGp3KjV5xcX16+v3b5ze3b12oV1NQ/9vcabTiGE0toPPDuwSmuUUkkllZRKCnmVOc98Dm6OIveGk3LhnEniJOr3z87OTk5O+r2+dVnO8sGhRy5ImW/N6KxNUqeUrtfryg9cNHjx9OnW281oMBgecQy+5zkKPM/PsnR/b//xD4963d7Mi9dhMUSljLVxljCxp4dJ7cRkLQmhlEYiTLPYpi4Ivdm5hbW19Uqtdk4rdC6P7RrGeYIQeZqWEJwZ0+m2T46OXr968fTJ48Pd/TSNtfaKhVApZZ1xNLTRH4pkhpz5fPdlIJYgUfBQjjq633kfMRqIS6mEFOgcWXLsSCBirpYmxwwmNalNJQrteaViaWp2JorisBBOz8zmJRoR5d4oUsqcwJDbgZzfpt2d7WdPnjx7/OTwYE9p7QeBYdfrdAmg3phYXV25d//+9Zu3QfsAUKlV5xcXVtfWkvQFIxtrnWOlNQKcHB9998dvyVpmVyyWyhPTo3JQOZfluJ8Q4jxNLpet5sUiEzkAZ607twsZKsLf23mYh5zCEdP0x8RtJjXdTrvX6w2SOEsSk/U7Z62j49NWsxXFcZKkWZYOokEcRUmSWkd53XRuEiSECHyt/cDTXhD4lUp1e3O6UW8giXave7i332o2pRQzMzMLCwue9gqloFyulBq1icnZ+cW5Wr2mfX0ZPRvOIEYSJx5dB7gSv5tl8bvXb75/+N13f/zjdw8fHhwcEHMx0MViUUiZRNGgN1BKLS4v3rl/54uvvr738ccTk5OjrTWXaFycwMMxKg3JTMxkrFOapPjbUynPqZwMQLn/riNrrbOJVL61iXMErAgcWTdUt+feNY6J2FrjDMVxPIgjL/CmpqanpqY8rcJCwdNeXsfnXgF5v+WIhJThiL9VKBR8XyslzwmnNEx6BSlRKCGkuAIYDrcnHjkNgpND7xQgImOttQQClBxKrHnUExKzGP2qnBSrlfY8z8/MUH4qMN/QlNLnvSvnSbfO5h0TXuyNo5uUey0Su1F6oZRCaz/fty8T+/DfW6JdWHeOCG5kYXDWaW3vUvtwshCXFtT0JHgCQIrGsvzH/yTvFPXUJP7f/vds7+3wzZCBlTn4aBW+uMdffEw3brugwX2Cwx398g2e9cTspFufy+7ftI2ygFRBJMEhBqgUo2QQDhxQBiwAfEDNIBEi3DsUL9+KzQPoJaA1QoYMgmNZDnBykUvTBNJ12q59LLqngU1CNCEaJyQ6mVkkYoogVTkTMd+zHbE14DSDijO9fyx+eIqeNFN1mxpjiI4OxeZb//Q0VCgmG9yoCRHIbuoPYpEkJo2436F2n4WfVskay4gcBC4MlB+C0iwkWWeco4SAjEpS7Kaya0VPkWqI2ioueQACwAD0QCaiirgyAVXPTlTctXleauiicP1D7zCAmmEhXejDVAXaVQtpz0RHrdZh++w0SVcqEF5eBUPZ0XgfnBdGzCRQSKkmJ6cW5uamJiaCIHBMLq97AKyxg9T2Ot1oEBlj3utKrgw6RVAolMqV2uTEIIsCP7DGAIKnNaJwzgAPSwQECQyOGEaRifl8KPe/DYJQSRElSfvsrHnaHAwGgBD4ge/5NjPGGEs2EGHF90uVsvI8FACOgTmXIMBli928yCDKBaBCKgmcnybgLKXGKD+s1+ulYnE8NJc/REPJ0mwwGHS73QzAOaeUEkIwgJSyEBYmJiZnp2drtToAkHU0Cs4SQpwLO89dCvFDZAQRFG/d+fjWnY/jqBVFgziOB53B2enZ8fHR2VmnH8WOSCqhhFSeFxaCcqFUqVWLpZLvBYVisVAOq/Xa+E3JW8vzjV4ASCmDICiWioVikYC15ylPZVZIpaVSSsnx1B8GpCHRgZkYiDC/d4ggwGb2rNna2nz74sWzx48f7+/uDuJESVEIC1IpIsdAMpfWIpDjzLBAGeZ8R2s7ndbRwUmv0wVmgagFYOh5vhYo0yjZ3tpqNZsPv/8+DEOhJCAaR5bcKIuSiV0+N0GBnq+tsZ1uO4nt1NTEVz/5u//5f/6/5iUaCgQCZ51UyGK4kQo8r5cREUyadc5ah/sHW6/fvNt6l2VpGPrVSlV7ylrrKPd2kAxDKDYve4FzZzNCEihYsBiS2XHUYucwMeCQCQdgbZZl1jknEHKTCgBAgsxkcZwQO6V1qVweJEmhWFxeXT4Po8hXdU75yjlIF+WMs3u7O69evNh8+2r/YKff6VfrdSklOUgdKGMrlcrNm7c+//LzxfVrI2+C8rWbNz777IGQav/wIOoPAK3vBVLIk+PjTvOsfdYUnpyZnb83MT2OG1lyjKDFEITMz7zzLxSCAKy1zjkAkhq1klKK8fN06OQ85gOcyzl+LEy63+u8evn89as3W1tbzePDwaCTxHGcJOTYGmecsSZLrbUmx4WJaJTcwHn0oZRCaE9ppbXna6VKxaL2PGddkqaZsYK5XC7Pzs6ura5dW7+2dn1lcnIKAj8zLITTvhf4AQytuc8v+yg8IA8VIRDDPmSsl7Pp6+cvvvntr3/1y189+v77/b291JhyuRwEge/7zph2kvaNLQmcmZl58Pln//Szny2trhVzB7YLUY4AwBETfTgXG+q0GNVlT2CttJKXyY7i316jDd2aAZiddSaOol6v0z47A5RpHGfGIKI1uWeGMcYRWTKUmSxJsijud9u946Pj01arUi199umnP/367woFv1otB2GYV0gAKITMeSaZMWmaxGmcK5vshWQ+p3HmXuqACFIqLQTKSxLmYbkvcr/wHBgBB0Ndv8v9c4AECRIsLJHIHWEkALA1IBUxMNk0SW1q2DrEIbHvwiiOwFmbpXakXDEAYK1RKu9EnaOcBUhCjAUvAUp5blPDzjkCEpx3hlJKZJZ/o0Hnuac2AgCkSXZ8dHK09ca0d6YqA1mV87Mi9AicBCEay6Ih4O8i93jXPNpxXSMAxEJV3FqGT+7wV5/Rl5+Td53AwdlbfLUtHr8S3Q4szpiNJbOxwuUSwECDE8A519UNvR6ZhQCtAAOGACDDVhvfvJXfP5dbeyIxUCoJ1eYC2VqJZhrZ4ootz3FKTAidFjMBZxIzJViw9AgNIcXsHAvFHAjlgUJ2YBkJAs1CCM/XnbZ+8hgpwo3rMDNpCkWS5O2/8b5/G7ZBloCqIasQMysdMQkhUQgllSQ/sH5IxGAtMEghpQSBDqzj1LjEWZAyKCp2OknVdluIPTu/au4bgJyRmQAkUGCxXEW7zuDT4oJdnIbAkWmDHfDgjCoTzqtxowJJHaIqRK34pNdqNo9OTk/jNAKonj+k+EF0+kLGR4xD1vXk9HSt0fCDAPKJZo6oE2UASRzHcZyl2RUauLhk8gVa60qlMjM7mxlTKITRYMBEiKi1BgBjM3aEue0OiGFryDQk8+QOUsxKybBQkFLFUbS7vd2Pomar6awVUgkpM2eieACIhWq5Pj05Nz9fqlSkFDlb+7y8yF03z6n6OW871z1JKQGBiKUAa8lkBrWenpqdnp4J/PCKQcPVEi3LkjRJ0wxGadOjXYGDIGg06lNTQyqJY8pTk4dcEkS42jThh0afIyJFoREWGgAASy7qdDrdzqA/iJKMmISUUivf80vl8kS9nqeDXxo6QZ7IjEwoxHk00JBKnB8t1rnMmiTLdBpjjHEcR2mcZlke4PijGwE5zHM9R5+x2+ns7ux89+13v/jFL148e5kyAEA1VNrzrDVETpxLmRiJZB5QIsUQXZOolJBaSSEF4TDbhQEG8aDVbZuhpssRk2PIk0/FMMpy1K8yCSm9wEuTtJsYAChq7eng6y+/Hq8LLJMY0vIZ6Crr3VgTJ0mv2221zs6azdRQIVRMHPg6s8Yax5S/1vCsZDHKOctLNJt7zyKq4dVmd86chHNXp9x/y+QhV4h5Eq6SUqK0WRbFccYWpUxtFpbK/X4/yy7uxehgGy7LC9GJtdvvNr///runjx8d7R+YJM3LTkfDBsPzvKmpqevXr13f2LiQmPjB+vp698svLNk4i3vdrrE28EOlVBwNTge9OImrE43V1WuT0zOzS6vnXEaFwBeD7OE487wPyUtOphwho9wS+xxSHN96Rt3iJdzsapVGdHpy9Prl62+/+/bR9z+8ePp0591Wr9t2xgohtO8JVI6sY0IYXeFhJcXjgPV5aFgeauRGabIEXAyLjUZjfn5+ZmamXC4vLC7cunkLCuUfQSpgfN2cMyfymOJLP52lr14+/+7bP/7ut9/87ptvNt+8MQ5q1VKpVPI8zzmXZJlztqjF4tLCzdu373388a27d883AmddPhMXiAx4IaMeIe+IAISElwgs+LeA00ZHPTMwSpE7IsVRfHJysrX5bhAlxBxHgyzNECHLTJZmSZZa46xzxtosSZI4GQx6zePTt5tbuwcHExMTCsWtaxura8uFsOhrPQK8hkQaADDOxknS7w8dCfqDQZZmwxQ9PN95eFihSiGGi/Ci6M/9ycT7gWXMiKgCCXjxxeem6wCsRkWSzJH/oTyDR3KN4V0nGveYzY+z0A98TwshmKViGgYivjeHHVtAwHzxRv7aW/Mn5QKX51lRkhydHB/sbfV6B8WwO1Gl+WlRDgkyyIOFIBWsXGPSXb/mDs9gsgA3VnBlmmXIZylF1nlFCwBk1OaWePoSQkV3l/n+DVpYgkIoIEXrSOgc5iFiRgStQGsAH6AAgJAMaOdIP3upHz3Vr96qszNSGqan7VSxt7xEq+tmasGIIjXbkCWQ9iDpEydGuERIFmgZHaJhNgySORAkBQjBglkiU8ETIUoUanAKr3rW9WTRk4sztL7MMuXmjjvasV2jeuD3YoA47wQMgEPgQItiEcrSeZoJhAOdGZUkOh5IdpQZzIilB40GL8yyp/ikCcdnot1WJ6ci6ud58AACwReTNXFjgRtVDmu8uIyTE2wHorXnbELlMpSKDqtQK4Iywp7h8V663TltRvuliaNu3AUY5VQgCXLAV+s0HEniLVklhoSGcq1WrVbCMFAjMTci5vbOzrksTZJocEm4M0KS8z9DPjCdmGCiWr3e77ZNluW7pZKSOHd4YsjBBhAXMihgxDzNG3I/wKBQ8JRnbPL9tw9P263Dw8MkjY0jD9g4m2aJ9oNKpbpybf3OnbvTM9NCKXYuj+IeBo2OJTae4/bAQ6ePoQhGABOQcwyiUqosLi2XSsVxjDBHxccfhSiKnHVCIhAjYN5m5RYige9Xq9VKtX6+2TnrchnaxS8ZgStDhGoEHrCzzebp8fFxFPV1ENTr9Uq14FLb6fXiOFFSlsrlydlppTypFINALQIV/MhTLiwbIgM8tNc4l8oDAhOlmRlEg9Nmc795RgCD1lkpGkRJZgC8k2a327M/rpC9QkVCIGtMNBi0Ws2D/b2Uz6WyFkZKkcv/+ioqGQIUQ9+Rl7Oih6gkQZKlg8GgZ91fJNY1TibZ+U8OjGl3zoyxcLnRvpiyifdIRcTO2jwrwjqyAMbYLEmBXRwnSZI565yDHEO2730MHNHu5BCfvpChiLHpF43+lgAUgALwtPS1DvwCOEvOOLLsXJalxpjcSXWcM5qP7a6sycODg+/+8Idf/eqX33/3sHlyooQUgZASnbMSRCn0pqZnlpaXl1ZWCpULR2Lt+4tLywB8dtZ6+ea1tW/jNCuEVspAex4Okl4vfvXq1a9++SuQ8rPPP1/b2Aj8ghIKhHJsL07OoTp4GG+QZ8gLeR6EBURwmRwBYzXnpbFgfsLl3zFpcnZ6urm5+ebNqzev3755/WZzc2tna2v/6PBCQ5Nkl81JQI+uP15erjafpn1o4cRRIoQIw/D4+Pjdu3dh4LGglZXV2uzC1RUCPEqeyCcPuXcLjLtMJnHU6XS6Jyc7e3svXzx7+uzZ02fPjo6OEge+hEKhoJQaRFG33Y7TtBiG6+vrnz34/Cf/+A8bGzfH6zMmByOYN+9FxmvDc/XeFbMYZ904Ef+vJ6GJ4eoCK5RUWnngh4VAStnv9be23kmUxUqFnInjOIe4nCNnnXHGWXDOJMaaNDaZMSZtt9qv3rx9t78/3Zj46N79dqft7HyuShox58g4d26uxIDGjTAqyg1PcmmoGL8FPHx6Ln10HLFOLx1viD/GxcdLzBMxpl4qhkGglcKLESSeP+pa63LpkuFtGPpjRMQ/R7tEwH8fS/BPDTqvOL/043jv9PDd0U7U364HzcnJaHrSVosAme1vYavJzU1+tQNa86d3MSjC4iRPVqnXg70T7j3nUoP+wypAAyilg33c3OT5SS4VaX3ZFhcAnHQDpDwCGsAwJ8RSsvQBPIAAQIHrw/YhPH0rH7/0n78KN9+pKDXVelabT5ZXzbW1bHbeyhDbfXF6oE53oHUCUdv5ZuD7sRAg0DkwEoxCi2w9khK0ZsksHWoGlKgUKray16a2QYzx+pLQqG+t08YCTRSzeo1+8wf3w2bpxPkABiADSH1ggaglSiGI0BpkVA6UsX408CgVDsiBAIAG8HzD3L/jymXe3gF8qrJIph2d9BESAAugBBT0xAxIzy2mpAtQm1WqhFCAgmSyNigDlhh8gFCW5r21lnzxwvTard1otzi53x10Lut+HICCc5h+pBPPdSVDCfPIGqZcrdXqjUqtmiSpVvp800TENE7bZ61Bd1CsDNF4qRQi5nRIGJqCBtMzs5VKZXFxwVqbDx1GrADBQ0bBMBCJ+NwxZ8jsd0wmc2HgK+37nqckAeLLN2+eP3uZdduZNYFTxpg0sdqDWr1+4/rNL7/+ydLqsgLtOCNLKIAdE5GUFwO7US14cUlIEMCw68o1d0roYlg8t8/Jfzof35w/CUdHB+12m5kLfiE1AyHQWuuIFEChVKxUytVKdfyZJKYPlDjnY0fiizdJtL219S8///nTx48SY6YmJ6q1SpZkrU5bSrGyvvbpJ5/duXNneqaqpf/nH2aUJHNH4EsIHWJOm7NRFHW6XRpx77tJlr+nfhSl6aWyCAGRzmlzeIVtgyCU1NrzC2GxXKyetC8qeP9yKYMXbinDbyKABvB9X3kaEC0BO3JgJSKAZAaUwnPO8lCEmxNxxdgv1ABKwJBX5+t+FPUyyoXAhWJB+5dm1sgjXXM+4MerniCAQint+34Q+hyluUbMODapNZk7D6L/oLSFR5/LvcdNfr8y0KO6jfIMIiUAAT2FTgpCVKCU1FKq3ANgbOtnYoGXBmppFD17+uTnv/jFL3/+L7vvtoE4DAKUSEBENiiGM+XZjVs3bt24NTs7P/4egiAMgrBQCLa2t6anp4MwjKLYOofIQRg2nEsyc3x0+stf/OKk1TxpNn+WmU8++yQ/JiSqMfTRmcxZa/L5Ym5xqIcJDcCOnXXsLjl85rg55rSZIdpxCVoga0+Oj75/+PDXv/zl9z98f7C7H0UDZ4mcCaRgR9mPnLsCQCv0lZdrX3KbbAJWjoyj+EP/SnseEXU6na23W61m6/GjR5O/nFxdv/bJ55999ZO/q1YnrtDSR2Jeygeo43+bdHtvt94+ffJk8/WrN2+3dne2TpvNVquFAI1KMQzDQqFgrW23281+7AHcuLH4z//pP//zf/yP9z97MDU9M/Yyw23xIkB5jLN0LoPCHL8c65isMex4zLKN/zp7NESZZ8xAqrXUoadDPxeyDPrR5us3p8fHnuc5Z7PUWLI8LA2GN85ZGztLJhOISukkTqL+gAGiOIn6g8FgkCRxmqRMlD9uRM6O4jq0lJ5WeiQJUlIrISXK3IrvnPyVq284nyf+DzAzDAPfH6YF8GhFifNFq4TwfR/+v/f1Z0w3LnUeSXLaah+fHXF6MlVtVxrJ1DTU6wCCbZtOtunNLvYSnJ+DO7dgeYGX5wEEPXrO+x067NDeMbsuyBKkEXbO8KwNUxUOQio2GOoAfYIIyYBAEoI9BJIgxQjFiyBN4N0hPHmpnzzXr7fk4bHoJMKCLrPxS1SZSkuTTvjQ6/PRrtx/6x3viW4TbcxCploSSuAcJgb2EBhAEkty6BQBsBSMSglZUGgdtY3rgWuecusMbSpKFYZJ+lktrTZwYo6rf9SPn4vTM+eBLRWN9CBDSSCRER2yEyCF1gp8IRwyA2QsAUuhXFoRn3xEn36RhWWsljFu6ZNdrSyaCPsxlAYAhOCEKFKjQMAEQoASYBVoKkwZQAIEF4PMEIoCAl2egqDo+lH36Oh06qQdx+n4A++AkPlSkPEoVz0XiY3f3GK5WK/XpyYnsyhVSuVcfgUghDA2a7Vax0cHa+Xr+Umd77y5uVG+SoSQhbBQ+NuF9qyurTXqdaUUOSZylijLshSgBFAqFOfm565fvz4xMfU/gi075ngKADAYDA4PD9vtM+ecF3h+NHDMxhgEKHhYr9Xr9XphTOM9JvH78EuQo/P6D4U4PDz89S9/+d/+2/+jn9qar+r1+qDfP+3HxaL+6idfh2FhYWHhfCvPN2YDnNuI46g1xPMABsjp8JdgLyFQSqm09sPwPGRTAFTLhTROE+sajclyqXzugzo6CYa/lQFZyPFZlJTCC/xKuToxOTU7P9fpnvV6ceCJeq3m+cHQ/xMY8uAjgYgaAPPpJIyIenmR71we7MIOUQiQSpd8UeTcnBXFKIp+SCl0DnNnUKWlEFJJrVWcJIfHx/04m5uZbDQafuhf7jMBxLBEy/048ZIQWWrthWFYLJVLpYqAfk4QRkTnOe35vu8XCgWttWWK0zQzxhGLnFEMwHkiJ+IwNIkuWCzDZ4TZOScRvSAoBIGU0hiTpKnJMkD0/ACYWIAkJ6UoFIthGHieL69qIi+N0/rdzpNHj377m9/84ZtvXjx9HhNPFoNi6GdE/ShiFJOT1Y2bNz9/8Pm1mzcq9dpV9RdAoVRdXlpeX1vffLNJzlljoiTxtC5XKqGjdqfz+u3maac9SFOppBBw/caNQqFyWeDsrLPWWnKUV1pS5tWlIEfE7K6aWME4535oCXchsQAAOj09fPn82R9+/83P/+VfHv3wQzfJilI0Gg0/COoTjbLNrddyZSznyI/WOvB9Lwh83w+CQEmJiI7IGUNMzlGapv1er91ux1HEwEp7XuArrfMEkU630+v2zJYZDPqo5NLK8vbuO0D46T/+YyGswtDpa2zhE/HlqWLz6OTtqxdPHj/+7uG3L54/297eOTtrEZFSKghDT2ulNRClaWqM8QDm5mc++vSzn/7TP/3jP/1MjXZL67IhQXUMev2TyAudP93Ebsja/7cqLpnIWWOyzADEWWpsppWPApm41+kMer0hOwvIOXZMyAwglJRSKSEEOWfIETlPq0KhZJ2L4kE+8U+zrN8ftNudfr9vbDYUEsHQbyZXmudE2DGduMhtp4dN2f+HvD/9kiNJ8gNBEVG1y+8j7gMI3EAiz7qrmt1sziOXs8N/dj/sh31vhsMhOdts1plVeQAJZOIMAHGHh59mpqoi+8HM3c09PAJAZlaz+NarXr7MQCDC3UxNVeQnv4MACDMqpLUOBPBHsAGZfw36/SSOnXMoOdszM9ABsEhorBsMBn+jJdo5iU3aP+51T44DOg2qg9aqWdkAWAIQajhYbnIvkUYLGyVcX4HtbYFlBIuo5WzgDo54ZUmUIhhSt69HQ2JG5UGp5KACEAKMAC1wCqBEK9AhhFmsdgrDDhzs4+s9/fh58PA775vv9O6BDEwi4DwgImL2hiPv5ET6Z3DW8fdehcdvdP9MW8NM7DxjlHMKLZAREvEyZh+hQhAWIxOCASF6jMYwOAs8dHLch8NT7ve4suZgEz4zgpgoX7VbcHjKmpz2IbF42pWzrsR9NCPMCv2SZ4Ka85fTsoZa4JaqvNoy2zvp7Q/N9t10BGhG3ptHDs6o5IOxdNwD/wD7I7Cxa1bYW3UQAowEOpJ2nfaZGgwE8RF89xQGQ9rexPU7AE3n1W0CcNbp9jsjSabL1yKmUsCL31aCl8vl1dXl9fX1ZDCK48SyY+cIgJRKk/T09HRvb6+9vJz5dI/ttknmcIkf71UqlT1SAOIm6YUsLncMUlEQzIHPP0J9lhs5zdBiBKTX7x0eHp6enSY2zRtH58Bx6Pu1crSxsb66shyVoqK4lZDyEVumtimEb2U84+lpSZTE8f7BQT+xANBJbG/vMANgegNz+GZv1BsAy9iski0LAlrn0iR14kBAIWQpDTrjZIw56wy5mpUUsbOksFItb1/Z/viTT8IoGowG5ahcrZbTxFjnlpfXrt+4Xp4N6iatAZEhz0OdwetReb4flsrVaqPRbLbby6Hfi0K/WW/4YWCNZcc54zEv0TJLDXCZAgyEmR07JyzOurFFEVJuQU6kiLTKRkoKJyCkEucyMTAiOIektad95iiMBF2pXA7CWdPXgjW+ILj54A3MeZVKe56ntJf5a2RaxUpZVyqltc3Nq9vbraUlhzBKkjRNrWPlKU2Yzfoxk8pOb66MSzTEzNyYnVbk+1EUhRrxtNN5/Xrv4ODNWbfHLCZNga1G0Fr5Wms1GcfPcG7YcWpst3v2Znf34YMvP//DH3//+98/ffKtYYkAKuWS73ujfr/XGyjPr9Zq9+/f/+UvfnHt1q1KtZpR7vKkpvF+sLF15dOPPz3rdAnxybffnZ6eRmHYqlZLYeSMGcbx4dHpH/7wB2vTg8P9n/705598+tm1azcKFKEchp8T1sh8YYbnWLAwMS4pbk6nx0dfffXlb3/7z7/97e++ffS4E6eZL4lYy0ojqaAU1uu1lZXler1RKZejMFJaedrTvu9p7WkdRCGRIkJmsc6wFedMam2WbBaPRtYZk6TDweD09Ozw8OD05CROEkJKjBkBgOX+N99V69X1K9ulev2De/er5bqn9WQ3IMoBA2EZjob9bvfVy+cPv3746MGD77799unz7w73jzrdzmg4UEopihQCMw/6PZsaEW42mmtbGx9/9Mnf/cM/fPjJp5P6zDljTOJ5HqLCOXvg2Qnx9ApO5w9AOE4DKBRu77UjmyQZDYa9xADA6dCGnbMgitI0TpORidPEQnKB9yQVNZUACBBAh8cumMN0NOj3Op2Tk+Ojs+5ZYpLsbSlSOBaP85j2AePdzTk3NrShLHkMCqQVmB1hDpPh2WkvGaVsE+dYESGRQiUokEdgZSm2DgtENSBCQOusQgi8gG3y+sWr12/eDIdDANGQs6y1VpSC0l5/MPju6dOdmzeTmI0xNrVJEnueVppYuDhcRwLIPAFdRlRQmHPoAERSY1zqlFKVarXdbvvhbCd5cWTnZSXa3ONnYzc8HQyOe6rWDctJfRXUCkCE4AhaeMWD2oqwlUYIVAGoA5QJrOxcdeS414OVFkBJcVcfnQaWqVKCej3xyw48BwDgEB2BFUkIPAYfoATgEE7h2bfy56/040fRt0+ruwf+wak7HcWsh1GNSDzSutf1Xz6ns0NGgeFQDzr6rO9ZSypgjRY8SDUKCjNaoIz+lFlKCoIjHk+VAVCsuBgdh4KxuABOYvnulXvwrf1p6KgJUIM71yy7eHnJng6URTKsTs7g1SvZe82nAiNHwuwF3Ki65RW3siqby3Jlja9vyJUVWVoRbyWFGrw+kDCypcjUquT5PEzVm1P/rOs6HZCUd7bk6gpCWSDhg0N3vO+qNdkKGBQ8e6r+83+iN/v00afwb5dMa9VQA6wHcTpKBw7TKQqSAhkC/6K5fJYpX/iTSrWyvbl948YNl5g3+/snJyfZ8QMIw+Fwb3//xcvdxtKSFwRRFKIiySz4ZlG6H/FlksRkwVN5oakIcp6LtWyMSUeJH/x4SducqYdkLk1yFMeHh0ev9/YOD46HvYETZifGGEFoVBury+3bN29tbW+XC/UiIaHKTedxSvWdTC0yL97JXIK074elKfF/SdGZ4xgAAJrleq1cLYelzFQsCxImQMrKHlIok58pbKezOEdMTEAahZ0Fx0YRNZdad+/dq1Qrn/3k0zhNPKV9XztGYalWa9d3dgoO2hlpeOwzd874FZE87UelUq1Wa7XaS8sr5VK5FIXNetUPApvazFcFskwumKZECUouGM6Vxdk1z8laCJkvPhIAcg7AESELZrRFcWyTZDgadIeDwXAEANr3rHFJkqQZbcw5KebJZinlCC6fl8iM7SchADKLtWxSThMTx4mnPN8PPFRBOVrf2Pj4k09//atf3bp1J9FoUsPOpGmqPC9D0TgD6RDGTMPsPJmYf6ITZ431tac8z9eB1vj8+bPP//jnr7/+8tmz5yeds8TFSZKCOIVhpud3zjiZ+RREZNj0e4NnT5/8/ve/+6//+T99/qc/vnm9y2naqoTlSrlaCsVJEsdGoBSEGxsbH3380U9/8dNKs53HNea9x7QkWltb/+Uvf6O0RoCz006n0036I590qVSuNxoU+Mdnp4dHp//5v/yXFy9f7O8fen6wurpWGvsJMyFm0RRjVCkLr8jkOflTQHhO0Tmt7lhEF0JHX++9/sPvf/+f/6//8vVXXw0Gg4pCjeB7ATDHaYxaV8u1tatXPvn4wzs3b2+sb9RrDe17WmtUiKARmLRGQIXIiCLMbJ3JzIIkTW1q4mQ4PD7Yf/rk6cMHX8fDwcnhsbUu8FQpijAZDRm0huOT0y+++DKolJndB3c/WmotTSZrSEigkDAZxUf7+989+vZPf/rdb//bf3/06JuT0yNrne/71Uop9DUKC5A4TuK42+2DSKPdvH//3r/6h3/8zb/6u9v3PlrfWC9UOqg9P4u8y1KuZnvoeUf9cY83hci17yGOlePvb2DG4qxNJ4r9wbAHhNammdVs0eoQCyAenJv7C0A8W8Ax83A06Jyd9brdZBRn2govyO4aZVis42kGhZMMm2URRgAkIBkji5N3QVPSyuHR0cunL1+9en16fBKPRoowDEJFiqdOZZl2R7LJpYC4HFRAYeuR9j0PHZ8enzx+/G3n9IyQPF8jIjvn+X4lTYLAPzrp/OGPn4+MAVA2ziJmjPY0EXJmWyzZWZq15sD5BpDZejhUSpFm5n6/n46SKCrfvHXz059+trGxWSy06GLNx3ugaM7wqB8Pu8MoiEmBFwEgwhAgRhCEEBvB2J0XAboCvZzceGWTQQB8AMSjDp0Nte+rpTa0Wuz7FhyCAzCIQpoYNIACsABnBB369in86c/yh8/1g4f+yxdRd+gZjKXEYTmJFIADBOz3vNFQ7wuIA3ZoLTEoQK0DFkLxrAV2LAzIogiUFoUoiCzIQoJT+B0SEYtCJYkUBBEMrbw4cF984zySW1tQLkNUlTs3klorOe6HZ6PgpO8pT9g4T7iiJa6JCIeBXVoy61vxlW3ZuQLXr8DVDYAGgo8gYvuwvwdHR26UWtGKlfRS3D/WkuLxG0EDRLi0heVQTvblzw/4zUvZ3oJ6C8plb29P/+6P6tF3MLD8wc+5vmK9EnghEDkEQDd9OB0QX2x5jIikdPFPo6i8tb19+/adQX/QOTtLkzQxjACaVBzHb968efH82dLK8srKShSF0w3XFQG5mSDHojvlVMYFsxnI4z9jdmmaROXSpLHu9fpxkmQiZwQiRIVZNyImTUbDUbfbrTSaGRdDgFF5mTvoRb1I0et8TH/Jc42yQ2MiB5qlFQ/39vZevXy5t7c3HI1AxAE445IkKa2Wrl27dvf+/StXrkThzKBTa51tpgU51piQBTC3k0alsNlsVkKvH5u1crTaaEe97mG3W46ileXVldZSu9EaczU0jh9mL5d9Y4GRP2bWInhZ4YCZ/BE8VJ6nw1LUbi3dvnMrTY11DkEyjhoBae2VolKlXC3265ndlxQ43kUUzQ/DWq2+tr5x/caNIAjSURyFfrVa9TyPnRWbTS9zj6VCeTeZjecGFhnlbXJ1JGPaZN1v5nmByAJIRCjO2l63e3iw19+N43hkUhuWIgB07KyF3Hdhti4AGmdXLKDoIAAygBO27FJrU2spw4YJwyBotdu3bt3+zW/+VfvK1o/VC2zvXLWWTzqnh8enp92ecS42RrFznpc7OSxCpwDApGmv13u1u/vNw4ffPH7iAKoaokolCn1rTRKnLNKoVq5cu3b73v1bt2/XCjSAMQRRXHl45cZ1ROh2urvPnh8fHJz0BsPRsD8clkqlKIrqwoPhQWrg5cvdV7uvT05OkiSZlGh5gaYKVr1j+TSwEAESzPnsIc5Y4cwe8bL3+s1XX339xV/+sndwXCsFzUbbIzKJEecwCJrLy5vXr3308Yc/+9nPP77/4dWrO6T097j4pwdvHn75deB5/W53GMfqpKMU+r5f5pJxRgjjUfzt48fa92rl6ubG9lJrJooqm7IxSxLHJ8eHL549f/z4m0ePHo0ESgqWlpb8INKetqnhzM6Xwff9Uim6fv36z3/xq3//7//9T371m8lHNiYlRYC5+DpTFC5mO84hkrNLQyutfkCjrJQXRqUSwDDX/EYZHVi8QCIum9RZh4Ce9jTprMN041fm1qi1lsxyhZ2xJmFAhJ2r19Y318ulMoikaWqtEwEFoCjXMgOA42lNP5kwiLgxD35OETwXmuzOjk+ePvnuiy++eP7sxaDX97WuVMqe8hwzgxRLNMzsz0EmcmsE0aQDT6NAOkoO9g/6vS4R+p5HgMDsKV0ulbTyzjqnX3715d7+fuD7NrbJaCQipDUiWHbi7DhERKmJrDv7IMzCQop8r2RsenJ0PBwMmo1GHA93ru0US7RM6P19ULT5PYJdb5R2hnEYx8aCiaF3iP1D6Z6ABQjLFIbgIfiAbGGY0NASetioULuEFAmIkz4fd1yc2HKoV5vUrnu+F4MFSAFSARA/EqgKK+ie4Oun6tl3+ptn+OAJfvtSv9rXJx2x4LQSH0F7SD5yKmxdbIETEAuZHTERKdLKIyIAckAi4iRjcgGSAApgDpZkxJ0xq0dALACDhwA++BqtwaND9eQFBwjpSLZWeaUN5TqsepBaPjqA0zdqcCoR8ta6rC+zsNNKotA1GklrSVbXYXkJyk2wAvrYHw3o8Mw+3TffvISvHvKLQ06NkJOTIUTHaEbqdB84xVIFl19DNZaH37j/+4+8v+s+SeHOXV0q6dh4r0/9hy9k6Up6epxCDBFAyYcwAFLO8pSLpgUc6EUZnflaV6hyt3QAAgzDcOvq1VE8Ojw6fPT4cX80iAEiAK28eJS8efmyWqmtb6x/cP/uTAPGJkN0M4YBi7AAjaOXc2lCHrLMEyamQK4HJQBGIhAnLjVG2xRBa62z0QyPbSAy2bzKzARZnGNrbGJScRZJGWuAHXoAOGlHit4542xDRgBGQc7szzPeQ74GMiUQwrmjMR4Mdl88f/zNN69e7Kajka89ADAA3cFAhcHmtZ37H314Zed6mI0txk9/Dl2Mz6WZsg8l///kThH6nheFoYmNH5RUGNIoBgDtBVFUaTValfaUvFzIqcT5YkMtGnHk235mfhYtCPm9RIRf0IzMzzgIw6i0vLxkrQkj/9qNG5zaIPACz9Oex85mT+LEjW/m449r+THGeP5dY74uMxgSUQQISaEk6ehwb//hQ3140nFuP0li5fue0oq0QjMe6+NiMddcPC0ACBIqTZryXdUJCGlQWpMCUKh8r9qotjc3fkR4uFprLi0tlys1P4iEiHMXAuYs1h7Hbi2zXXVmL1Kv11eWl1dXVpuNF6edLgv2B8PuWceMrFJQbTav3Lj12c9+8fNf/Wr76tVZQSiOs7HFMVPm2AewdfXKh598/PrVq95o+OjhN53OyZujI0XkBYEXBK122w/8K1e27937YHl51SskPSAhZXPoPC5kppRXABnyiYuIFXn5X4D0zGjQOe0c7h8cHR1bAKW8SrniknSY9BFxfWX5k5/+/KNf/uyDD+7tXN3Z3r5C39f4q7myfv8jNM6M0kSH4fNnz09PT2xqAYRUgEhxbA5e7ZXC0t71W6PBqHANmVmAlELQWkVR2F5ZWt/YWN/YODg6ckcnzNDt9+Nk5NhlD3cURI1Go9FqXdnevv/xh7/45W/uffhRQYZp0iT2w4CUzkc4+SJ9lyyn2ZxlyOUMcE7TOp9gdV7hDxBVyssbmzvXrx3un0T1YGVttVyKrHPIQAIgTgC10oHna+URKgIQYJdVQQp93w+DQGmd0eFExCEqX6+ubnz04QfXb970iJRS4hCZCIAECZBm0gzctAIeY2bCmROgTMzhsi16cuuRXTwaHB3uP33y3TcPv+mf9UqlqFmv+dpLU8fiMIuOHOdSc27gIWPREnpZnYDkrB2NRs7aIAh831dEipRS4vkaCG0c77981Tk4zvX9eAABAABJREFUCnzfps6kCSIAaRSw4pAtixCBIClUGVAtmaUbO2bWygvCKI6Tvf03/W5/eal95erVeDS6ZFz5ziXaueMqddxJRseDfmUEZgTDjto9o8cP+OkzGBms1qhaVYEPPiE7HKQUOwxCXG3KzppaaTnfk35iOx1rDVXKnkfUrkLoATgBiyAMWqAkEMlxD778jv75P+nPf+8/e0OdBAxSLCLByHOkA/Y0AZckt7hzoFImBM3iHAEy+HkssygEi84gGQVAEGR2RiQ2z/4SlT0amcEEMpKgcuBbVsjKsRlS50TvRuijdWxHMaYsjQb0+rC3i4/+gk+ekBFY3nRr27K05KISR76EJeMHon3wAogFnu3BoBMc7oUHr/TBkTk6gb0z8+ZYDvugfeaK1M848gRG1O9ql+iDQ3z2HarX9k9f2n/6E58cSbkmZ2e0vKRFRyPln4H0EjI9Rz2IDNQUlCNQQRpzZ6J+8zJn4/On37iNzmSNDCKOSWnPD9c2t5RHz16+LP/2d5mJs1KoPD0cDYcvX2jPu3796nDQL4AhzjpLSiMoAMlNI7PjJT8PAEAoC77If3ueYZIr2RF0XhuhEk2kaawaU0qBylOrMafR5A8vZUa1SqPSGdAPIqhUZhx9XtJfeMSLlQ1OJlOZfxMiCCBbLmJc/dPO8ydPHj34evfFrufpwPNDX5vUWpZSrbx94/qdjz5aWd3KqA+OnSKVC7/Hvhq5A2XmMAIgwEhS8LoCthaMcalJAVInQ8sD4wYAQeoY0Hv3qupHpOWNES0s6B5xtkSLokh7y+VKdWt7K0kSENFKkSZEyvIeCr65802CLKIqzX+X5MsJcn2BUsj9Xvf50yeDePTtk6fiODUSOiafVP59gMAzXilZV5YteEEQpMIcGwFQoVI4LusFEZRWpJFRUpsOk2F/OEiSYfB9A0MXvpLUOOeYXQYTirDLTAWyJBfUiJTBDPlxzqI9XavVbt68lZjUOleq1r/55sHe7qvjbjdzLIgc3Nna/lf/+I9//2/+l89++tPW0tIMZE5qnCEvM9YDSt+8dbv/r0foeaVq7Y+//+Or/T0AB4lZanp3P/jgs88+/eTTzz788P6VK1dLpSlUnInuUFFO30bOpJrZYBrEoQiy4EyzJDCm7gkAI4/tNqA/GCbxyOWiPyEiY82wNzjp9sphsLy8+vNf/OJf/6//7trWVSio7b7fq7a8dOverdgk2tNa60cPzd7eXhInnq89HaBjY0xyNkz7iUztXECYE5sq5Snteb6/vLYeRpHv+eVK1Gy3Hzx88Gr31Wnn7DSz7AGoRH5rqXbtxo2PP/7op5999sH9j9avXo0q1QJ2pYIwJFKY+/1NWFeT5u5c+zKxzpUZYqjL2CACWa+MAEwFtXzhgcvs+udmao1W+9a9D4exOTvthRW/1Wx6vmaXTSRIoZAiTdrzPK09nalCFAGBVr7ve1EUlaJSGIZeEASe5/k+ekoUVaqV5UZ7abndPToqlSoaFWWCVSNoKOtHsp13WmYoUFqhpqyGdZk/dDYYyNyZJsTSjJpiXTIcdE6Oj48Ohv2etdXAQ6O9NE6sswSiCEARABCjFSiquBAxLWRrsnMeKVWOsm4QZkz6xAyGbjBKtMoS9PKKOqv2xAlnrixIk4/FOV6QJazbxKRpPDg97faHEVE86POsp1ARSvxhg05xozQeJrExAAYkpu5AffcE//AX6AxUpUzVOvo+KADjsB+rJFWliHY24Oy6ubqZVivWCHR64MSWS7YcUqPCYTYsYwEPQIkxeLAPj17hbz/X//cf1Vd/oYOuhgBLLQgjKSmjOWPhgLCSBEAsgkM0PklWlYCgMAojMAkwskNw4zDW/MpiFg4p2aRPS66RFxEkRuWUL1aUMJBN4aRDvkclHyplroSOFBwcweGR//iB/+AhHe5xVJWldVetytKyq5ZdEIj20IIaJnDa4ZMz3tvzXjyLnjyu7D73usdxMsRUBj1HfaJyA/2yrHah56FnVBrrJAm6HTx8IxbxyXf43VM+6/KbQ+n0MTXEGjFCDMABpUPluqhjKWuoVrQXuVQG/dFpJWpnKBoBjk8uQcFZp4EpD9MJ66wmQVpe3VjbXG+2W1G53I07nucDwLDfH42Gke8fHe4PB73JX86x3LFvzWSSkvc7BRQG5PzMkacTR0RkIaWKqcFzyp3JGAB5OmnJn2utM/BsbLSGuCBjYPyuZqQA03/imDCWOQJMvmvQ6x3t7b1+uXt4cNBo1MuViu/7kNpytdxaWl7b3lxZ357aATsRlEyOXvTDGfv6SE7GmoMXWMRleQtgHRsRiwgAFjmx6WA4+B9VouGl1GOlUKkgDIKJW/K/wGtlfY3ZPX78KAgiydaCgCatSIGATLnGMDtRRsqjr+c/zmTaLeMSLevxBSQ16WDQO+2cvNrbvX59Ch6nwv57Kf9nYYvDg6Pj4+NBf5AmqTiHmfkpZqQfBMr4SGrWrgIQQHu61qj97Gc/q1QqjWZ7aWn597/7Xfzw614cA8DKUvOD+x/+6le/+vWvf12v1Sa6y0w8Mck3PH8ONFqtjz/7lLQyzMeds4PTE5OmALCyvv7zX/ziP/yH//B3f/d35xNsx7nVPMkokonvVMYbXHQnxjUG5tTCCcvZWGYgIuUpSCwisZM4SYYAvuOoVFrb2Lh25fqkaDXO5ppoGQuoYZbGAFP0WkSsE1+r8e/TyysrG5ub+3v7zZcv/dB3zqVpqonIQyWIDOgEGWZrfbHGMioFoBHCKAqjqN1ut5eX2strzfbS7/77fx9+8006HAFAuVxaXV29fuPGp5999pvf/ObXv/xla21CPhNnDClCJK08wLeR+3EhjXgGRcvG+1gw5yvKPmfRtDxcsvjz6q2lO/fuh1ElHg6D0CuVy1qRtSwiSEpryjLitNae52tP+9pTWimlgiAIgiAMo1I5KpfKpVLJD/zzn8ADjMKyQk2OIE/OFZwhN/BkUaHOLWCnoogxGku5+AcnZY01JomH/V630zkZpszsAq3DQCeJdSYhzEImCICAUYRmH0WZGcDnsAUVSDgwdk4cl82TkQDiopskMyfd2D1ZeR77ZjQa9fvDIUC3czocDJy1fxVFp7CVNAY7CABqAVQjYuc54M4Q9090p0/BGYJyzvJwhCcdNRiWyoE6uu7QOUBot8UhnA7QCPllFypbKVsPx+HIJYAR7O3Sb7/Rf3ioHn5DR8cQVmzDg5Q1ogZg7bFHDoHAghMEluxYRlIZgyXbXBlIRMsY/kVRCIyiETSAEmCZsAgBALXk+ilByNEd5YH4IIQDowYdYnBrS64USDWCUQcf74WPn/t7e37K3Ng27RXXWndewGkCZzGyVYb1INGdIR53+eDIvtxTz577z56EJ90QwMv7BWAA7B/BWRX6XYpDslaNYpXGGI/ADNgimx6nfUkGMBxCry+9gYvTWJgRgS0nIzUahGxHvg9RWelQnKSDNK5EY8o4FVRUOYpTrFEkjzNnLnDkaWV5eWtrc31jk631lA8Aw9Gob+zZ2dnZaafXKVqvCWkEBGaXJZwXhDOXSVQmvPlJbTPBn+dQ3Lk1T3nptmic97Z97nzskszKkSayXmCB8X4+6A0Gg/5wMBgK6MEgiKIwipaU2tze2tm5urq+UWSDMTNl1Ce8FCS6bBNmRPJ9TyMpRf1+7+nTp1//6fP6cjtNjUuMMcYLPBTIEr55SnufPaWyUpxzzCG7uAS5YdtYDEZ5SLITUuj5fqlcKpci3w/8IPQUMReZbgh/Ey8VhaHn+6RUFpqtkAgpM2TOyMdz9GqCKRyBcx9FxtJCHmNY468ioggbk/Z73cP9/e2tbWMkTdNRGo+SNPBDpT2UPFYKEAQ4ZyQXliwBOmdNaj2tvcDLwlD3Xr/qdE6S4ZCtycobApDMXgTGXjazA4xikIfneffu3tPkEZIIlEvhwZs35TD44N4Hv/7Nr+/fvz+pz6xzkDmznHs6JpTzrNBpNZt37907OT07PD4WgYOjw0at9tlPfvKLX/3q008/PV+fTbaPLMmAHbssND4TJUwf1kXzuanz/7QT8v2AiIwxSWKzK6CVCqIwHA6056dpenp6cnJyvNzKJ/7ehIhWbDzx/MQgbxnneGvkqeFoeHp62ul2kiRVRL4XeNrP4H8neecKRd3J2JJXCiZ95Pl37t0Lgig19qxz1huOjo9PqtXK9pUrO9eu3bpx88MP73/4yceF+gysMWmSBr5HmhZvZd9Hin7BmGysapTC5kow77Zar9V2dq43G03rnK+1H3oIyJaZAJF8rbMA3yz7UnvaUx5qpYk8z/M93wt8fakRhheGWnmU52yDIqVRKVI07dDHihPMyjTEvE5DoDEHiWfm5ABgjBmMhp2zs8Pj42HKANCNbfxqL/LRmExJPmOmeFH3NMcTIcAJ8D+VNcGMbAJgYfz1ogoNwAOIwmAQJxm2cSxwfHSUxMnc8/h9S7TZW4/WKpMEZlhBqJWg3QYdepWGlCqkBp5jGFq2CcexdM9k/wgT9hR41TC9uc2DgdMRpOKdDPXQKR1JOUpLNedpASHwGEKAU9h9qv/r/yf6pz/4Q5eubZjrn6Qj5t09OjgClypWwphhny4LEcwsm4ADJC1OM1K2KY/ZsYxAKBpBISjMbahNZoopmT4GWSADPyT/F3SkACJIhXoj6PdJQERwcwWurcOr597Tb4M/flEyGq/fiW/eNksrqVYSp7D7QvVO9LCju4OgF3tnQzwZmaOOOe7C0Qn1BwpAj++sBxADMDixfTQ9GlVQMyWGWRJgAWYPXZmkFQAnAI47Z7x3xCcnaEbWY1SCsfEH1htBggF7gdaeGJAkHZfn6HLsAFByFrUACggVibsgMo4Bzl/tVvP27Vu7u6+iMOiedga9fmKMBYjjuHN29ub1Xu/0sNpcztR2WgeAmBnzZFbLOEXUcUpjwhl/+rFnB47bXBABnNtoGLJowvEeNBZBIiyk1RbWekYqG//mQgrNJYXcpEhVROAsKA9Ezg4PD48P4/HjFKfWWNOo1+rt9p27t+99cH+1ME7KTiWZ5AfM9mdTRE1wwck1TmUWZxVw4HvlMFCAJ0eHf/7Tn4ajflQqWWttap04L/AIiYHBYX6SU87NtjaHlmjCvQdCAEJBoBzBz5IVEBDAWE7ikWXRvm7U6+sbG5vbm6ura0vLK54KcFqzABahxf+hr8QYZ53kallQpEhhBoNbFjOL3cxnb7EAFcJlQNhZdo7FEqNCBCDhrDegTEDa6/b2X715Wv9WqTBJk/5wkBijPV8pjSwCQpkfus5IlixWnPC4eScrzhpDpKIw8LRyRl7t7p4cHg3jgbNGhFEks6olUJky140NLYqQFfM0Nlt7+vq1HZMmvq+vXd1OR4NWo3blytVb9+5ubm8XaYvjk0aKqFKhppleqOXl5bt3b6dpvLGxkYziZqt5fWfn7r0PWq327DM5ZgIByTjLUMSK4yyuI0thyhzyZdKEjascocn+IOymn6hcrQZRiIguv0tGaV2pVq2zhOro+OjzP/6xVK3+6he/3Njc/OFL6Gjv4MGDh1/85Ysn3z0963VJ66is87w2TYGOglLkhz4WLGoRSWlCQnFiwRIQKcoE2deu3zw4PN7fP3CAg+Fgc3Xtxu3bN27d3L5ydXtjs9VuznHzg4iySNdZ7fh7vOiinjc/1Tjbf7IsqawPL8ikJjchf5Urle1Nvbq8DAhakfJQEMDm01aliMbxxxl/MKedvHOSEVsrwpPpBmqFniLtZTSD3Ptw3NLkWIkgZawJAlIKEQQyp57pJmSsHcXpMEnjZFrupABpKt+31C1qmX7M1zBOChHX0BsMEpP8VVA0BeALhJJXOoAONClfqcBXnma2SCmJaGWjEGsVGfSlGsHKkm21bbmcKII09oYjPzEYahOVXFhm8gQQcxUnQu+MXj/z918G1RZc3bZ3PnQjA/i5PziT/ghBU8YXyhORgUmIRIFokJBRA2oBAgBEC8CIac5CEQDQKN7E3FtQCwCgk0ynAALgZMxxRU3oITuKmSDlXuyAoFmh1ZrqBF4y8o/PCCtCAZdaLqjyoEcnh6q7p0536exI9Qbe0HgDi90U+iMZGVEOaoH1yEQelAIBwGGsRjGjlooGMDQaYUAAxF7ASJwYl1nEVysqYXAOdvesaPt6D9C6VonqZQ9Iuob6FkFDGGKgQcQlxqZgfPBgskPKpBPIDydc8MhPz61KpXrjxs2zTlcTPfz6Yef0NB73ZIPe4OWLF4++eXTnnqrUm0CBAuYsTUpYK5VRgCc4xgLsZRJpMsk6GOPJF7U6UqgmC/z3S4CoIpYEbwPzpmBKtvNkHDiw7vjo8NE33zx78WIYj7wggN4gBUiMqTUa9z/44Kc/+cndO3cqldps10qXQmUTZtc8mOdAXB5dnwCbSKMJAxHpnp48ePDl3v4rT2vnnLVWAJSnICvRePxRcSZNYdoAjmeqk8Z0CqIgIFBq7GAwMNZFpXBtff3uvXsiLgqDZqMOQVDU3QL+Sxdo45sy6+Q+OBv2e3EyMtZybriWa7EdgHWZCbkskj6AwPk/ABB21kr+3BMCsGN2rJDRYRqnJ4dHTx59m8ZpGJUSY3r9nrFM2lNEWeeAwkplKZWYOfE65/ISjShzaUfCKAg9pZIkPT4+fr37ots5SeIhsCWEsWPZmHXPLLP2YoSQGguFxIugFF6/ds339fVrVz3CpVZzqb1UqtfAC2eAnzHncaY4w8VyivW1NQS4trNDRI1Go9ls1mq1aWK7MwBQNNbnzG6fmcfWDDx+ThkoM9LjWTkeYd4fzklWte83ms3lpaVGNTrpjdLUDIYDIhWEvjCcHB//+U9/StI0Hgz+8e//fuPqzg9ZV4Pu0ed/+vyPv//9n//y59evXgtz4AfOOWNdisbzdbu1tL1zdW1zdcbsEMlTXuaAzOxMaoLAJ62y7XP76pV7H3zgh6Ewb29u3rpz5+rOtWarMeUIGSsspFUmZfvRy4BsbfO42czMcvDcei+EhUzF71qrSrX8veG8iZfkZLdlEOssKdKgACBOY+OsFWvFOQDnOI+PAuDMA6NYMk7SPARyl8dJoF8enCmTjxyEYb3RWt/YPDo+ybCJUEMpijL3W7ZijXGOERA9IlKEyCB/hRrssovjeV4YBsPh8GSYl2Xt5WVvFpm+fHN9nxJNKc8LFEVpOjjtwOt9dzyQF3ve3lF02sVQu3LkSr7TkegW8VWnVbLUNvdvDj+6l6y1pDeCwRtIR2BiVy65yLNRwJT507p81FypwvYmdPpQWVZbO6q9pk9OUCsh6yBh5TJvGmLRWUJNhoyBgAM7pkNAjp1iFlyfd6QijMAASjAXcgKwkBWw+d8TEcg5CEI+gSeS0dRswjwc4vAsMAmEZVq54tY6pju0nSP3+C8UlfyR9ZKhMj1IhuJEPD+tRM5HHRrXNGgdaM1ROKpWRlGEpcgAutGIhwMZJgCMSnAwEAjF8zgMOVX88kT6A3zZ0SPU4tPRwHz+2L08coeHAEKry2qlDahdL7H9RIAgDMj3RSRNk1Gcxr6fOfDNozgz4bvTsU/uCyvMWuuoXLl2/QYIjAaD3Re7cTLKlnQYBKNk9OLZswdL7WqtdqtaQfJzayl07ARUsTGXOW5mYbiaz5/G70HmRjmTc2nSqyEiokLSBECKgIBnVTB4rkBDfLcx45hDysy6UA04Y589e/aHP/zh4TcPu72e73sawAJYZ+r12gd3P/j5z3++vXMtS1Ow1ihSOIbox2yYwl5yjvMwx+vJpEWQWgBRKIHvczmy1lprDg/2To8Px1b1zICkslE+Z4NLySCNsWppNvqKM79sJJSMx537ADMAEenU2H6vn9q0XC6ZJGm3mv3tTZOOQOxciXN+D5HCa3IziCZNPr89hYbesrsxsyKdeX1nFbC11hnHmXW9cOY7S0rRBa4DOU2Kcy2LzKtgCYE0ZAZfSIQZETpj7QvDqD88eLP/EPDNm70oKqXWjpLEOkaVGd8xs1MkpCjzTRARZmesIxQCyM2fmBFQa08DpSbuDwYnx6edzqlJY4XgK2XVxHMBFKJSighRFlwNESDKQtWg0qhd9a4m8Wrk6aBWm15NFmsd5hqI84yAmeiLLMMt+85araa1cnbN97ywoAzIlA3OpUr5E1dgpNw0VSmlPE9prbJcWCLJ6cI0w+xZfPunf7q6snr37t3nz58/fPB1rzvcff3G871yGEZR5Iw5ePOGRYDZjkZ37typNJva8wKtgcDXfuZZmoM9uTOVMLAzjkHYsU2t4zQ1dtDrPH/+/M9//ss3D785OjqK49jXKklNv9cdptYD2NzavHr92qeffXbn3t16sznbgCkEAhRGAuJsTWXXc6m9dPPmzXq9rrReW1na2LpSjBthgNQkwOJRCN8vSfutSNW4QdTKU8pTWqlJOgdmxtHFtkTmw+x/WH021mVmsAIYdsakOlQlVVaKrLXWOitsnE0ARnHsjfx4lGRIGLupF874Lk6pYYigM32CUji2hh4Px8OlpeW7d+5ZlqvXrvc7XVJYqZQCz4Nx8AJb45wgEHhZSYBwQYmWE37G8v/pJgaESijXmn6f66OU8n0/SZKjo4N+d9hsN37xq18tLc/k4uiCQ/J7lmjzR4kHftlS5SwevD6Ex0/l9Qk/fKS+feL1B7DUcLXA1iLXrlFzCdurbmmtv70ld3aSK5sppvD8Geztg4ysjFj5LtLW94B8AIWQAiQAAFtb/Pf/S7J5j2KCqKk7/dLrfTk5pWTEnCIxKkUMHpInSKBEo1FsmB1DwoAiqaDOtg4iJ0rACYNlERBGESRPACV7jlEALYAbj/8AwDFYRBRW6EKypEQcOAF32sNnL72Nphe17Ce/Nq4df/NQ3jyAF3/SKXt+K6ot62pkyqW4Wk9LpVhFWpSyjiAlYPDIlUtJuZ6Wys6LBIidoeHAOznVe/vq+Ii7fdFKmi0uVbk/gqd79GJPnZz5qQvRp+NBEj/myAN2RKDXVtXKqvNCM0rTOGVCCH30FDOP0mRoTOL8igJ/cmQXLe7HLF3MVSggAo5z21YGwCAob2xfrZajg729z//8OXk+QFwmDKNoOBw+ffY0LEXt1ZWNK1uVij9hWaID9IqnAE7s0ObM+gsDy8J3j/n6MxuiUlprj8D3fa01aSIARIWkcO45my1Ax8X67K/ONJuFjQkneBMDGwt6+iwMh4NHDx/+/ve/f/z4Ua/fQ0+XSt5waKrlysbaxt27dz768GOvPI31FMiyIHEqxxhXaVJIUKcpkxmn0zaFOvCCIFDDxA88z9dh6KFCa41zLGxHaYoEBAqUAIAkmdWPEExRisxJWAjHMnPIjhCeBLQqpGyYnLOAMNAgbISNs8aalF0KwiyMAguYgRcc9lldsgg//IHCu6zLn6Jo2b9oz/N8Xysvd6YAAUKtlda+l+3mCknRuSOEWRBknuqLAIrI87SnvCym0FfK87XWShEKwGg03D96Mxj2g5e7yvcdgzWWRURIRIQdgEPKwogwux0ZMQsgG1+OVS+IilAJOsvGpnGaJklqUqMAlFaB7zNLVqQpX/mep7Sm2XxoxII16fgVlStRKQKcLfoJs9JwrkGaac8mhVoBW0XEcrly3llwLMSZcywhhag8T3la+34QhiZJ/TDyPA+shczTB5HmD/8Jvo1zBKbV9bXPfvLzQX+AQp//+U+9xMSJIeFKteoHPoicHB1+8fmfDvbe/Paf/7nWbDaajXqtGoalMAyznCWttdZZoczM7KyL4zQ1Jk7jeDAcDAdnZ2fHx4fHR0dHR8eHx0dIqlKrKcQ0ToapzTLX683G/Y/u//KXv7z/8Uf1drtIgcgpj4iKkHyaKDAAwA+87atX2ivLhFirVIIomjtF/SDMZn2Zbxwg4Q+oijKcdbrdESIBKtQA5Osg8NUwZ3plgTnFuGHJytcpFwh+CIGhWHAK4nihEBJqpTLMlXNQFVERMFi2qbHW2vG2X+BvZX7HpGHMU8vGrJ7yPO0prYRZxk63Yal8Zfuq74U3bt7sDQYuNVqrwA+UAmHBbFsXEEARFMUAwEB0QePIAvNP1+wI5PvlTmV+BJqQmQeDUZomQRCsr29uzc7rf0CJNvdOlQLtOxWkAv0ETs/g+JiPj/ms45IUOGJPuOxBI6LVBm5s8Po1d3XHXr1ioAVwBrU90gBgBYxoER8h0EAaLILOEskZWmv8kW+bO8nrU/36SL18Tc+ewuExpAaUCDKQzYwyiFETgiMkcAzWQeyEHRBCiODlOs2sNAMWMACac/6FhqkDjQVIEQTBQ8imqCIgwAKGMeVAbOrbQJvByHu557/eVLevuA9vmtqVUcmD3mP18I3aA9/fD1b7anMddCtt1LjetFHdKq2QPXKaLPjkSlEcllNdAvRBFBA6a3TlCNIUjg4hTcQP3OYGN5fk2R4efYePdlWcBu2m16gAW33WVx2nyz5ttIOtNdxal1bDeF6qEDSAh6CEITcUBMfZLk0zNczs4ZSDyMCYIwzT0QMi1dprV65e3dreXl1diUdxoLV19vDg4LRzmli7tLZ26+7dmzebk+6nKMCc0Fxm3GJhVkpZAGZyMHsW42AGEXbOWYbUWGOtsTYFMC61zjiRyymWFzPV5p+hhU5Eu69ef/XgwZ8///zJk++UVuVKqVyq1Kvq2rVrN27d2tm5NqnPMs8EKHhtFDn2UoDmL3gEkZmNtalJHUAcJ/EoVojGsbV2YhGJWbQJj7Eb5szPF5Ayst649JzEi+KUC599nXP/D3HMDEorFLRsnXPsjLMeWwtsMcMGRN5FInD+7P9rDzq1UhlD0aY2SZKYwaQmyWJZBNw4+29m82WeTsnPfwTJeVHWWpum1jqyyJYZODXGGNPtdvdhXwQBCQQFUTjbU0TAQm6hMskzBebcBjmPuy7ydmRit49IqJT2FWU2+JatE/GNccbJhfVxHlkBDFM6ESoAB2zGTxJl0eTT8dPFqM3c1yd/hVlm7WnGMPbM9/ME/GZm65xlts5aY5gZRVJnmO3FD2mmyJ7+wFaz9cEHH6RpEifpWe/swYNvDIBzbK01xjBL0jvb33vz8OEDT3v1en1ldXV5aalWq4VRFPi+5/uB72ntZbw9ZjapSZIkjuPBaNjv9Tunp0dHR0dHR4PBQAA83/PD0PM8Ugq18gOURFZW2jdu3frgw48++Oh+axJwLgyoQAozt0XXs1qtVqvV8wsvR7GUyqp6yRukH6S/4YxoVLhx1jmTmgTAOmestc4ZAGNSa9y4vJ65zRMWigCgXEgZed9ybazoRU/DpFNCyb1kUBEYEETC3AyKSKOanhzsmJmtNca5JE3TJEGksJQaY1wez+cmJmqEuLK62mg0s6w4wr8RPdO7lG3nbSbpxxl0srAgA4nvQzmEZhWGI9esjhplGLEqK9GiIcXRSE7OwO1JD2lkCRO1s+4ghX5XW6OECQk0kVKoM68eRGABJ+AEgEmziBt04c0uvXyKe7tq2FMEqAMmZFEMmAI4EZ9BGwQmAiQHko0sM9MDFoU8Pi8ps8I0ACT5YqXcGTPDIwBIMsa1AtCSUXXSlKzxxUWeKQfMKJ3EnSTCyq60XbUO7gTOvnNHu6a/F5+C/+olpjEmMYnzGcC36GlSCJ6wJ+yRS43VMUgPLIF4KvRV4HmpoTSlNAVCWVqSD+/z2rqjB/TfP9dxFx1Le5N31kXEnZzJaAi1EDaW3JVV3Flzm6usPeifQqhBOYMpo9UkPogvRaVibvI+synjXBs0dcyYMoI3t6988MGHr1+/Bsajw/2Dg8O+YwDo9vora2v3Pry/c/Wa9oJxT0w4NqObTPsW1EZTehNPCE4ZtDS3SJ1zaZLGcWwA+oMeEfa73RgAR2kySp1l+V6n/rnDKVe5aq2yb0iTJE3Ml199+Zcv/vzlgwcWABLoD0fbW5vXr1//6U9+8ulnn61vbcEsfFWwGylMpqZbIc4aUxbfu8SjpHN2dtqPAaDn4PDwYFQuG2NNPmBi50AIVFYHCLicwAGkMlL2uBDkonwRKTNqlLwQQZV7wIoTZlAaAi+01nSNcwD+6KxWO+n2enEcm9SwyN/m9saOrXVJko7ieJgYC9Dt9QCw1+tnihZjzAIfyOkan10PzMbaOImH8XA4GA4Gw5Gxlo2nfTI2Hg6HoySRPHPwR3wpAB+gFFA5ihghjlPDFlED4nA4ikexTe18oSb50CqrsV1mUZHv7MgizC6re/I41Ak2fXmLAjOtFE4NbvOGbVKVEM2Ueln2aGpMmqaD0ag/HPRS61wPmJ1zCmQ4GCRxYmfNBSa14+REn+DbSvvrm+vGmDRNnbP1RuP17u6w1x+N4n6/Hw9HMU+n72+OTw/299vtZqVa8/0g8APP037gEWokFGZhduzS1CbJaDAaDfr9s87Zabc/JWmPEjrrlwNdrTfKldJO40a9Ubu2c+OXv/r1/fsftacaTJ5jhoz3VZlsq1kjMVfvZszRLE9dZYPssfjpxxlrFn8XuyRO+5YZ4KzX8/yg1+8zwGBkkiS2xvCloPjY01/m5FyXN2YXkKhkoufCwpyEAIlIa00AfhAEoR+mYa/X93xPe3qCUMVJOhrFo1E8iuPhaNQXEXHYOSuVolEcZ6XnDH8CwQ99+J/s9d6l5PuYbji2NkYalsuwvgI3d6De4JevRqeH7vTEqwcQoBqlOOq4N32OXxB4tNTSn1x3P71tNmrupKsGA+WUp3xHviAKCiiHyiEAAzlmOevBq5fw3TN++C08+s692VNnHWVdoJXSASOMmAxjCgAomiEU8B1pQIfkAToNgg6BGcSK6Gy2RIpyfIxZ2OXiwbF1LaIQkAKFoLM8nDEs4cBZ7VxEECjyPAY/dZ44azGWig/3diD+12Aw9v47/OUbPEpLe4doE0rj4OjUJw1EopXzyCp0nmIfPUFMwLOoRKtyhdoVUCKHhzgYYbUk66t4/7ZsbLvBQFYrUiXxtLvT5o9uWPLd/rHrdFkLtKt2uSxLNbexLL4PZ4cQEkjKbACtp7GkMMx6v0mi9nyy8dwgA8Z+r2rm68srq5/+5LPhaISifvfb3+6ddif74/OXu0+fPn/+8vnm+lYYRQIOFeF4uCkTtx/EGSwNM01hBvZLVszR5HGe7STGWdsMAMZyamzGibMADEIks8ZRMofoLAIPZP77MT8eCLNzE5IkOT46ev7s+cMHD16/ejM5EoxAq9n6+c9+8W/+zT9+9rOf1gsytyz5Y4JLzjKHMuU3FacB5511nLNxQYM9TAV5mFg245QcB1nQGRQjlJFBcT6ndQs27/ks6+ybefzXyUJq43T8N1KA/mg4Go5MklhrReBvxmVj7jRidjYrR7NPbYyzqTHWFZmFM7WZUpSTU3muTGO0ho0VZ0xqrDHWWgBlwRqrtEqt+2vUZwDgAEYAmLCmVDRaZ5wDQGutNYlNU+uM2Dk1PY1THOfFMDmHZ+zce/FM89yVuQgNLY6wJzBcJogo3ojUcmo5NdYmSZqkABA78U3q2GlB65x1zLMlWj5gm5aD2QLO5MUUlkqbV7c832s3W7du3vrqq6+++vKrp8+edg675/Vvo3h0cgqDwZCUVkppTUQ6G35zpsDPPEGcjZM0juPRcOTOFTq9xNaIVtc2bt2+c/fe7bt3P7h969a1a9fnz9SJmEkmqZnjL9HM413ERbRWIqq4EZ3/l3dGp97yLTzeBBKWxKZxarNl5rIWz7rJLKWQGJK/8knuxC6lQKh9W387xzPOuCT5eGZCdPA8FURBvVZbarUU6eWVdr3ZDCslOjppLS1ValVP54HiJjHWOuskI91mT0BsTJIkeZTn2ATg/69e72Vday3HAiPtQ70Jq6t+UMatDbOy4oDBF82gh7Eb9t1pDHsdOh0EtYj2bhvu8N0dEUUD6znliVLiWQZmJ+QQmHLzb8F4iIdH8uIZP30kz5/IySkYCzoir+yR7xiQWYStsBO2DOiIgH0AD8ESsSKnQBCdMLFDdgqJUJF4HoBkgvvsgEMAFCLwUBQBEmTdp4+5nZQRsShMDhSTzyr0pFq35ZrzPUcJA0CjDFduwv0YhpRKSM+fYq+r2dLxkXd8ouMEHTPpkVasNGsEYs85b2SjGDRo3ajKVttUAzvqy2gE9RqVy1CrM9SkVcF2GdZqUA3svS3++JoTzWXfvUAY9dAZSEZgDWhCHYDvAwhY46xBEE9hoJWPCE5AjdsiKWiJ5x8wmMRtziei6yC8ceOWTa1J0k6nc9LpHHW7ANCuVcvlkk3N2enZytJKGIXA+U4lk1hGPFelZRsBjiUCPMbbL9iBCMD3/SiKTvsjP/D8yA8TMimHmoIgUMpXF4DD7zt3yzcVhQBgnRsOhgcHB3Ga1JuNpUbtqNMFgKVG/dbt25/95Cc//dnPWqtrY1DZESoAJNKzg9wpi3Yqd5hWEPO/PwyjpfZyOfAHSRoCrK8sRVGYxKlxFgkQVL7X5fVHwbqXcsmey5m6hVucH39I2aATCFFynyThzOlXERlru72esbZUrqxvbLWWlsuVqh9GROpvdEjAIohKe0EUlYOglyRhEAZBGCZpatIoigLfh9mZu0LEsWtAfrZO2TMCCoCQfOWHfhgFMkrC0PPDUCklAp5vM7g9G8G4cfGKylN5hngu4mTHzEAEWntEmHGhxEnuLKBU5i0gAgIZvIqeVkHgCwkiaRYiL4pKgRdo5SHBrC9/7tGKlDv2jydmksGDeUk90e6+o1bmgqLhgqZuthCRXCRMSmnf9z0vcSbQ6IWBZlZAfhCQUnIJhQfneYcAUi5Xrt2srC0vb29vr66sel4ISErrfrcDwhkSpbSntc7eomVmG8Oi4KSMfYEALKI9XalV6oo8rY11g+EwNQYJa/XG9tWrH9y//7Of/eLnv/jZrdu3y9MYCbf4GkpBXj6Z7V0wyp2pXr7X7vROR7hSYRBECEMBX4PydRB6JjaRh0EQEGIBV7548I1TkvLlBIYLP0LmOIvztBatvUajsXXl6t0PTgaDUavdqjZq3UFv7fiktdReW18PonBS9yvPC8IwispRaTRMEwPgecoLfc/PCGne3EDTWksZBlNoTHEhJ+x/WiTtfQadKBZNipwSJAgJ6hT8GHDIPGRJHfuOneWBkd4AzjpoAI8NHh3J6Zn0EtGhGIXsozAZIOvQGHZWwGWKLYUImkRrAXTOUjykUUwOAIXBSykUy8KGgDWwQofMlJAYYGcQ0kAj+L6JAqOI2YKJ0STKgdI+kwcUcI43ZzIwGevigVEQM7cwZKCcu0MqABuIEceCiZTItWtudZmXmhZCAQODHvW6ihE2rugglNs37cEB7O7p/UPv4JgGTgE4AA+AATJaPUluLqIAVK8D0JdmKVOFsQM3NHxyJmEIvT6hxlZbbbTlxnV3dcOcdiHp0pvndHyqg5AAePUQt46h4bA/lGEKiRNPUDJJU+bjO1H3LTYSk1nC/sS4LJtUOBDx/KDWbN64cytJDAMura7uvX7NAqvrq7fu3t7evhpFpSxPc2w/mE+TshkfnW8fES6GuCYTj/zffd+vN1ur6+ugqFapVsqVfqncOe3U6/X2crtcjpRSl+wgC2cK53/p3IUhIt/3a7X69Rs3tKevX7+2v7efWrOxvvHzX/ziw48+mtRn1qYAkmGHRYgMznG0Z0UMC7j1a5vrv/rNr4LQPzvrVEulVr3l+16aGiduTPid+sLLuKadMNElV7DB+H8wnTPLZAngxFE3k7shkkKyzg1GI+NsGIQrKyvXb964dvNmq9XO5tcCReXD30aJhqg9v1KtLi0vb25v9ju9WrVWKZcq5Uq1319eW603Gp72ZvEnmqs/JvecSHmhV6qUG+3W6vpaatPRIPYCr1aqKK0BwA+Ceq3WaDbKpZITcNZm0gNSWislRJnHnFhmdgxCQForUlmJJiKMDKAyIF8hMFseDoe9waDf7ydJ7NhZmxpjhEHrICqXV9bWms1mqVQqLu9JxYTT5Z2ZXOTBntMS7Qdgn8U067eO5JRSvh+UyuVGq7m8vNxZX68O+qVSuVqpOnYKYGV5pVatZ/Eki/uiGWYs5KpdIACI6o3bd0qktRAtr7R3X73sdTrGJEmSjIaj1JjUmCRJ0jhJrUnjOHVOrHU89mhFQgAm0ULo6UB7QRCEvh+VonKp6msPiDxP+1FQazY3trZu3brzwQcf3rl3LwqmNH/rhHA+42TmAxT5pmMifvHJH/NMJqaHY67qDz7d5zaQMAzby8tb21tHx0ftpXat3ixVKp3TTqNRby8vh6VwdgukhcDqZF39SHSr6WRDaX91feOTTz9rNpupsdVaNYrCURp3zs7Ktert23ezstikiVJUbzRWVldFnOcFUSkyxlSq0eraWqu9VKvWwjAi0sXlapxVTngc+YwggNl3EAOz5EIAyp0h364y/2u85n6vylyA33kl6MsuM8zTIRgxQehbOI7hoOf3esHxEE4S6BiKkFEbRTYibgI6I2dDWy3h2lrSbttK3XCgNDpKdJpAYmAwkjh1zmYHgQb2AbFStStr9sqp3T/y9/Z0f6hjJu3HFAh74BJ2rLSUVEZeVWgBjLMuUZwogSAQ5/kSeimgJCkNRYtTjrVzqMVRCKSy2DGNKAoIwSoREHGZwz1aRgeIQBpUBMZzIgZSidMSyWqdtpex3AIgsCfw5Bk++C54feKFJfj0E44iOdh3v/8T/unztNuTwSgfKI2vMI8hlBTAAVpfaRtLLAq1Q88aZY9O+eFjPj7CJy9pYLCyhBs7bn2Hqw3YP8YXL+hPf/J2e1Ep0H1jqytpazNeGeKbEzmLYWgpQAIlpFkTayDJbWsBM2HVTKEwbYTn/LkzlMUxo7A4g8prtVc+/om/urn567/7zaDfc8xhKarXqs3mUqPRDMJo7GAyrkiyQyyzySeaqcYQzs9W5kIzJ69ypbK5tXX33gdrG+uVUqVSKg/63d5Zt1Qu71zbaTRaWuvzDJuLUIGFtVqhhslfgfZb7bZSamtrYzT6aZzEo9GImUtRaWV1ZXNjcxZFOJfZPQELx3vhOFB+solnv11l9vXZX752/cb/9h+CX/3q19akvvaC0FekrWORPG6SstIZc+ptFrBNLJL5C+TfoWb2ARYkAM6k4kiZ/e84ywEYAYkUiUiaGusMAUWlqFar1+u1UqXi+WEeOjzuuv/lq7SFv1FrHZVKyysrN2/dEOZ4MKhUa1EQ9AeDXq/XaDXXtzaicnQhFVeg6LyhPFUtV5ZXV67s7Bhja83mcDD0FJVKZV/7vu+3263tK1eu3ri2urrqWIE4YGOsKE0KvQlEJE7EOQAGAqV0ZsDJIsJCAA5EaY2kkJ2J487p6d7e3t7+wfHpUb83HI36aWoQyPeDqBy1m+2tq9tLy0t+4M0uYIZxmGPmul50qpm4KlwE6ixqTvCi3qZInLqoVlPKK5XKrVZrc3v71slpGEVJHJeiUrlUFmZgXlpe2djYLJXLM6zNmQ1hVvk8+ySi71+9tlOqVD7+8P5J57TbPT3rnB4dHR7sHx2dnvS7veGwP4qTeDQcDEZJkhhjnDMT0UxWIynU2tdRKazW6tVKtVqq1Ku1eq3ZajZX1tday61ao1GtN6q1WrPVKtZnAoCZ8W+RQzszIpyIgYQn+8h4pRVEjoWoldkKWt4ZTZnf37K42sLtq9Rq167vnH72afesU6k1KtXaIB52e/1KuXzj2o1ms5URbYslWvHmzo5iL3z03mkHmNR5Y1McUkSet7G9HZUrH3z0IbBoP1CestaM4pEfes3GUqVSAQBrbKlS2d7eNmnaaNTOOt1+vwsApXLYbLXX1tdW19cqlZryZowDtNIguQch5rKE/I9I1CTuAgn/dvpMfM+mV7/XT2cgJ5gaGMUQp5CA9kvSWhbt24pnG4GLiLWAY+rHMDJQKcvdG/beB2Z9HYZs++xO+2JGkiYYjzBJ2CIACQCDA0CqlnFjww0SOTji3V066uh4JImzyhpEdIkSp7X4JJ4CJHKIqSY2gYh4IWGjjs0lrtUcgUkGutdz/SGMUhc7sYIuAdFZFGTWXBOJzqkLwAxOwAqkAArQQxWIFxmQBNCmNiJcruJqDUEjdOX5K3j8RD17qntJsLGFzUayseFWllmcVcyV0L56rU4HFFsUhVorEoQUmIE1Y8BE1rcmMqRElHI6dEjupCffPKI3kXpzSIMEy027tOnaq65cZz8gIBwkqg+6n3jwHJe33fY1BIJuH4YppOAJKaVIaVEqcwOUcY2GuIiSgouDxiZMMJdaCBQC6Fq9Uas3bt2+9VbgNitJpjYT5yhiAPNA2uSPsrT1yTdWarWd69fS1AwHg1JUDgM/TeJBr+cH/vbO1aXltud5P/zUn/uK8lTVq1Zr1bdQMp3kBLrz6pxxy4xzBLS5CMHCq1Zv1urNv7WR4ozt3N/M7kZaV6rV1bW1e3fv1at1kyRRqexrnSRJfzAolUvXdnaqs5Hn45javJadud2kK9Xa8sqKda5UKm9sbcejoQIMgtDXulwuL6+t3rp56979+6h+PFbyKH65+/Ll7qs3B29OTzrD/iBJU0IMgjCI/Eqlsry83F5qB34w0x3TTCdF8zo8fJcByrvcx/O9zcLtQikqlaLl5eXRaAhOVlfXnDVRWAp8H0XYuWq1tn3lSrlQohX5T/O7B86M8kWYlPLDaHN7O89LcMnR0cHr169evHi5v39w1j0bDodJnMTxqNfrx3FsrbUuz/3JxvQsrFFpX0flUrPRqNfq5bBcKVeXGu2t7Ss7168219fPnW4uyxMc484iIHhRe1dAHHEaPTpXr8g7wh/vdcDPmQDWa7Vbt24rxNFwGJXKfhilxgxGwzAMr169urS0pGcCsKZEw5kt6cd8xqfLJhunROVyNLsSFpUWXKvXr+5c9YNgbWV10O+nSYyKwigol8u1WmNtda1Wr3uzT2IRZcBpPzl/G/6WKrS/JhdNGJBBGVAGIoCVKK23059/bFebHI9sNTC1IA2UeEIsFBsvNhIGsrHGN65AuQRHZ2444O6JGAGO1WioRql26CCzKrMOWPzQLUWcGth9hY0GAGGcOrbOKaN8QAm0iDAKIIIKSSohQCBKuYhcPZKlpXRp1TWb4nnijOuepccd2T+Wg2M5OKKznk6HGjSEgaUAgEiYhBWLYwRBFrSSqRIRWAFrsShWAAQCkoonHgF09atn8vW3uPtGM3M5MmzU3ivkFMu+3Fq1y7+Wn9zB18fqoEsnZ9gfQRxjPFRmSNaiRSees44lBhyQ58CPnF9z5ZJwgsd7uivUGaA4W6+adsu1Gry87NLb3k9/rd7ELv6dO+ziSdceHJv+yAqy1pm5mU/k+8oPtfJztbORidnYIkjp3F6MOKWLKlAgwsY6T+u3NnnFtKXzKebnaS4LjZqyjXXyp5Vq+fq169Vy1Rjje37g+8YkSZworeqNxvLqauD7Gfvnx9lURN7tIWZrXOZgBYgX5uq+K+9H/jZZ+ZcfMP+DS7RKdX1zQyu9ubFprQ2CUGltkjRJYs/zltdWatXazFmBeRgtZO02TOc5RFQuV1bX1oIobLWXhv1+mqYEqJXShGGp3Gy3dq5e/THrMwCIwu1bt8r1xvL6SqfTGw1GxqZE6Gnt+V4QBuVSpdasT6VqMk9sOg/GSO6dsGAZXsKCehtBavECmMBsYRg0m21AKJcqg8GAxfk6jALfOcvMYRA2W+3yxJtGcr/4GVbAHJY0tokREJp7NFSwtLpdqVUq9cbqxvFgMEjT1BmXpEm/30/T1Dkn50TeRKS08gO/UqmUolLJC6Oo0qg3VtdWy83G+U9mnXNOlFKZEfH7s4amHVqhFZspQCe8YPxhbmSzPV795q1brVbLmNTzfM8LLNs4TT2tm81me2k562YLVhtwyfzhLRjee71DAWEG9U7EVqVVo9FQiuqNev+sZ9KEnUWlfV97nud5QaVSrdcbM525AGaeHjL/hjO4fN7n6W+KjfbO91+/BRgpfsWh5yh0WANY9uHacgIbdGPVDe+KEy6HaeCN6S6WraU4RUGslgEqAAbWQYZl6UcyEuqMdJ/sIPUsEvgOtAAbcAChRGXYZNhYlaWWlCtWdcSwpEPQVhBYe0yU+hpKHtciV2tCqcG1ml1q2nbTrq26lRXTamGpgiB81k/3DvjbZ+mj7+Sbh/6zZ+HZKbkErHKBL048YS1MgCTKAIlk1kfiiYCRVNBSQN4o9iMXhM7XbIdyeqj+8Bf9x69UCry1YaoVc3Kq/vIHzVZfWzc/u+/+/uOkXJeTxH9zrF4fwcERHB7Q2Yk3OCuliUqEDNphYkZdGZ0SGgwqXGm5Wl2qASqrOUEesY+u5KehciRAZdi+J/+2qdSKUY3hf/5v3uDUKElqoVlugB2Aj8DGQxv5qlItlcZYgRMRRCrIBuZZArM11pjQj6S1BlHjh5MvsYFnEXYOpukuuV/iwvlI7vMOlymD8rh3pEqpsnPl6trqWoZmZ1M5Z62gKK0DP/I8H2UaTfRegvaL6tR32INI5TUr5tPrgp/J3AThIhCxOHTGv90KDd9vI/nrzzoFQKEqlcva061KPTEGgcjThIrZWWsAIQzD8tjYfTKkGi+q8Sh+PKESlCgqad+r1xp201rjxDkQQgJgVpqCIPDDyl/jo7WWl8rVyuq6sdawcwBChKSAlK+10p6XowU8aZ7mc8NwLJ3OrfcWiW/mWGWXaAIWAMzZpZuFhEWEIddje15Qr6uwFC21l51ziKCVVkQijp0AYhCEfhZ0I+NsWpy1pcnLTygS1QUulDuEUXN90281l5xzgoKC1to4jY1xmQtkpiJkYGHATD9OpJHII01akdJeEAWhHy0MhkdFmnA8cxUp5CUV5NTTgKJJ4O60MRUoOByNl1vOF8TCAz81IXr7AHr+j4pB9CIAUK3V/J1rm1sbGTCMWgmLcwaRlNJhFGnfy+mLMtVwzVFfFmKlM0vk3DdcrvHE3MNPWBzpt1dpWvmNer1aKbuV1cxdT0SQSFF+/YmU9gN/zG6cEP/wnCn1eLQsIJjPP/+mKrT33FPfA0UjRu0oFFXRsFwCqDmopJ629ewEjzJafH4ttHAlNxBWwAixkGCt5Nrl9MDTRwmeOdXrgzEAKEAOwGVJeaAhrMDaKly96q6/Th3QWQ+d+IkVZxSL+HW7suRWW9isY6sBjQY3WmZjI1ldMUttWGpBVEeoAiiB2HUOzfKaq1bBo4REv1LUG4gDy45BgFkBIBADCRADIoonrFhATMoiXiAauL7kKg3RHg+G8OQ5/f7P/p+/pY3N+CerydYqf/GFfvSw9PRburujVkvyyV32tmA1TFeH6nqHj474YA87J6XhmZ+mGBvuW+4O3OmJO9nT8RCVL6UGt2rQKGNNg4vBoJz1uNd1u7vwpAFln1obqr3CN+7Ya0/g628cDF0tSlfabnMV4i4oATMEl+pAR5XSBE+2wizknbMFv7hoGeP1ClU+7HQuTS1K7vIM8zkBY0OdnHgxpWFdZAI0ZWYs3pumPDmlvGq9Wb1sEjclfv1oAL1MIuY5Cw5DnIoh8u2NClBMAUGcfIqFPNxLmtSC7nWsc8V3QuaL+zxePkkpBpyOz4gJ/Dm1VhWYNRr+26ofc2YeqTAshWGp+pa5yRRFm3AEcZIrnZsmkFZaKx/8S37MWHeTZwRmozRaWDbJxdcZcveV6UIJomjOhv58A3T5EsIpNJOb5coFaNlly2/hHwnM/eriiZ5fBCTfD3w/gHLlbVOvc80JTK0bJxL7eTHgpP8puMVGQSkKyj/WOG4ijJ340o6f35w9diG9f9b5ZME6KJRUgDOl0I/7UIhAGARhEL7t23j8QQuPd2GXvnglyPs/p5NzgHP7ISNZyFqxtsPZZGGt9fvSriY1/4zUWAqLauLP9j+zU8f7lGgoWinf16UKhBUAhRBj7zG9eoLDVEc1LJVEkQg7jdYLlecr9BQyJnFg4sSJcGBKS+Ad2tEbb9iDpRNMBwQWQQBIQAEzkENQuLwKH37k2IOtbb2/r/ePaPc1npyCCNdb7s6H7sO70mhDRWOFuFy1Kyuu1YRaFaAKEAFEAAQQYIP0LQZgF5CUI9dopruv4PiE4xEaQFSgPQTNjNkmrgk1oCdsmS1QGpUgquLqujSXMSiroZWXe/DlY/76iYvqplbjK1tw8MamRp4cQ68DWxuwsgkfCVRXBX1bDsFfh3ZDOEk4RWv8UcqnsemcuN3XsFuFk2OwDnQg9RpvrshKQ4yh+Cl8c0K7L7y9V6q7r3df0toVgJo835e9XR51QYk0q2pjBZdW5PWuszH0T3nUVYoiHY1PLiHJek1chI4sFFTCTF5TtsDZOcdMRgjJQjatAK11Fl+9oK+a5f8vJOoXm/JCNZPz2GZqpUtWI+Ffw2B1HLTgjEmzJJ88c0p7Sun5HIWL1evviOrJOBwuTxbKDwckAaEcvyQAybY3BGYW5lyIAkTZNxbMgrLCwI3fGAkIICFk1LJJmZ27dIxLtLwEh3GoH+HfEgPtvV+u0FYjoFwwZpiRy1ywyhxbY41JDYxzGgBQ4eS5mlkMIugc50tZEYFk/q+5UbMiVOArT2lF8I7k63fygbp8Jvd2YObcmG7CbZfz8BvI1FbwvWvsibX94hG/TMedIMLgxDJnzqeKkJT+sVoyx+wsW2tRBAiUl+W8FuDtaUjKJZ/mgnvxtifnR3yw3t1gpYj+wSInvL9OV4UAwsJiOLO/m1BcCUgIFCL+gDgsfAtZRP4Kl/xvp0TDeXGv0sov+VEtCmunLgJIgqMD+qf/i/75n+jgNPCrulwnrSy5tOS7Wo1qTa9UVsw6jkErWFk3m9tOL7PaVwOSw1O1dETxKcAIIETwAQ1YBjsiX2GzLT/5id26wnuv1cuX6quvw98hDkesVLK0kn76s/jf/WtTWlYwRH0G7KRSwSBAAIERgBEYCGgEUMC6Eakb265RkpUVt7zBX3+Ff/kzvRro1JAXEJYYPBELlpEw8z9UAMyGtecqZVhu4ZWrtL6JYY1Gjvc68Gwv2d3nnU7qLFTKsLZKqxui/uheOPmPv6Oew1sPZWOL1rdwZdUtLUGjAkHbgk4ADAhcSaW7D+VIoShF1BtY0tyq261tuHIFU+fvWxV/qb557ptu8OKZ//VDbLQsBkkntk+fwdketuq0sYrrqwRVBBwN+tA5dcMBIBaactHs7GzIykx9Nvd8zsDd40dfEZHn6ZzoAmrsQI2FqKEiXCQgc96CRcOIonBh8tsLMSnjqvCdxU7vuLNc9m1FtECKno6C6Ete1+SoVvbJs+1bZqVPiDMo2gxacl5LO7v5Z1uUF/iFDPTsQs+QefNuMCvoxnyghckhAqIK9KT5LGvMFkcBRaPpHpm32Tkl87xB/f8EL8nFqGMscurQh7MQ4TtVGUiU5/cQEClCddGhmEWbKiUwiX6aQdfGuj565+pmHDMrIAvnSmOMKTekwkJG9kW5nAv/s8gxmFmki2bN37PSmE6hICfY4/wdKZYQufGaRh/UJL0LfzzupiIiD5UimJnkohSvwOS3zaazFKQZ+R9IPhVFLEQ7FT1dizvk3LbwY9EA3vLNUrBmnJ2ZXDQHh3MtyCWEjfMj8vwbiDKKAeYBi4Vgm0taqPdGEuee64l6tsi/+1vayN7nvbwHiqY8HVRKQb2qyjpG1+mpg9f41QP5r7/Vj18EVnl+RQWeLWlqltN2C5pL6Ic4imnQCypV+uxnWFsf1dqianZg9f4prVQkGQkwTGImTYrOAWsIK9LedO11un2NX72ickkdndDTlzZOxfd4a9Pt3BfwLADALrghKSRwig1T5iHOIizoESgFWrcaprVsNnZce5MV0t4rf+8lpTGBj6EnpMFaBJc1apkTLIwSiBjDBm+swfWrvLEOUQQnZ9gdcj/l2JlOl9/sw8kpaF9vXIHtG+7hd/jlnrf7H2n1C7l2Te7e4ds36fp1s7UBa22oVwwEABWgJjY8vdrFF7s6o7+VI2q2YWUD2usSp25pVbWXVLUcHJwGe4d+0gdCMGIcoDFSD/D2Dt65jWsbCiJjDQyHMBzYNBWYcRzVIiSLQbQLgJ9zzxuOPQHn2A9wTpI53qvgIqoZLNqZpql14xiomcnc1AJqYhVZ7Brxr/fYZIYhuRhh8hulSOh7C4q2EJxb/KdjVwuEmVmSLCzRsgGY5Jy/hSUajwkxOE5fWcAixwWDzslw6W81/wnmI19lPLQc+5swjIfvl8XU4CzBCDj7SzBf+Apk3kpASmWVmrrY1Fckz/DMFyrNgAMyGTVlfmaF243nFsn0+cKFc+uLH6sL/GXe8YyXS/5rdoyVC7fHV1my5iFzrc6t6GjxJYJp0tBFpeqEAEdjw+GsL3GOsxFzxsHIHZiVoncTDZ2/vEqdK0DlHXcJnA9zuzg9SRbDtz8KhDarRJAi6prPAOd+9XsXed8PaZt5E7jQs6+AYM8wd6WQWAhvM2KWc0hZ4bsnjS7+j2bV/osNOgM/rNaiRhNVdTTo9TusEqyXpNEU2pfjgUDCmmS9hZUaGuKzkR2d8KtX3uGboF73axX86ScuWkl9hMEADw7xpAKpBQgAIgAHDsA4ABBQAk6AAEJWFb4Scb/Lf/5CAs90Ts2o62CIuS8sAASgjIATQGRB54AdOCvOsKetF7ISBRWAZSkDf9bi3pF89Qd5oMAAgAOLoAkR0BfSAAG4lCVNpNtHZqU1LLV4Z5M3lsQnSGM0FpUmQP/o1H3xlTQrEIbUbsO9+zJy6ttn+iiBo5d4OnRDY7t9e3Ck1pdNqy71Mqw04OpNqdwAKIGnZNjjo31EJRvbtLGpqjVORxCPVDvC33wELY93X9puh/s96Z4ZMaYcuEYNttfxJ5/K/Y8FVgSEhyNIEhA2SDwzkgfid2KhvaUlettZORMXs/j7LihZ5kuURRPAbFNlFBzzckhN0BGaGSvM8XDf5fPKRc+8nC/a3jdr+BwyIe/QTsmkK4eZdlMKW5FM0hexgLSd/xBjqpTg7ME3a/EEM1za2Wbzb3BPG6NJks1LWISYgRkQhaigYJ5bUDMQQmZXVVyJeaajuMzbSik1aRmmEauFqegluRhFte641Mi/XlwQIjCHN0seKCDFESziv8TZMrNAcUZ7CHOquFkdyaTFYhB2lgWBAQF0Zj9Z1HfPPu9yOZK4UE0sICKOGREsO2cNsyCiVkqRYpya6BOAUGEfBBISAhJgZsnaTiKaqzqkwBXDCxDWmWJgKkEpAoCXPTb417p9wMIiTqYpaMAMShGNy9zJ2n1/Ztnldfzbqtlxb8syuwONocfzLYqIiHO5E+CYv5n9g+btAuZqsiIUKzCzPc7ir/i2WejcrZQf9V6+5z3Ql2L8M92JF4bV1lK9sYl01D1OBodpLXA/+xgwxNpa8ru/JG+OVaUqO9fkxlWpVuwodm92Vb+H+0k4OlDdfdQDVzVcMgADGvRVL5bUAegshgUcgJD4SjwESAAMQABQY6ia7Q3a3pR2Iz49MEmHu7sEz324zpA4iAUkJ/vnV4AzIMExshgEQUizOy5QhfUlaFYk0CAgKYtxQAoIUBFGIFqsc2hTYKbEaeVBs8bLdW5EVjG6mBToWtXzAzw4lv/2R5fGfOO6BBW4fxeAFEjw7XMFAIPY7h2lNlWvX7vI176Ar2BzQ371a/575FpDTs7k5XP74gktrUGrQRubviLYfQ7dA4p8/MeP5N98kh4cJ98+hUfP+fU+x0ZqVdhax5s78sldvvoxgzZwajp9cABhVZcqWvvT+8WIjIvces4DEsVs9cmegyDFkwznJyzTgKOLBygyK26aq8wmzOs83GaGwoaTIxCzioym/rfF4QJMAS28ENc6R1CdQY2g2M1JsTOeAzGmOwy+h0yhyBKev1yTMjGzpRUWYcg/F06kSIBFWzUZC2eLZcfMppX5AMm0T50WNsUabeyeKzC9koW9/G+y7RwvixyjIclTraay5HF9JtNRh8yArjKRRUzxEIVESEpUPh2e1GSICkQUTirjuQU819hMk7fk/HxM5vCTYo+QB+oKIsiYkZl/JCrc6jli2kJAduGCv/S8mGj9cIbPX3hypw8FZoG+haMVEQQIkNCT8fuf+d/MYz8msSHg/JE99xGmj3MuEi/k2ClSylOQRcRkKe+Zeu88YlKghgkQ0mL0ew7Op1msS+auikwB9amu5nwPJxfCVz8yRSqXNWosGK9MfZRkFk8WuCSFQt6hMhN4C1I7UznhJLgm34FoOtYeb+HjvOQx7p/HgVHhZ08YNrMHUAFCLrgfTuqz6faK7zlzxL9mcf3XU3QGQdhutw5bq5gudY9Pzo5GS9fkow9g5YpdWodqjR98i6j19hW1ug5EaNgxOKVUCWzTo5UqLgWqrfwGQhmVjyjCIwtgAFjAgRNQBB6BEpAYTAJKgXIOamklchurcnPH2oGtBTjs0Kvv1CY78MSyA4TMCxoVEIEC8D0B64hBHDiDqi8wACgDDGDUJ7HaI9KATlyWqK4ANAAKs2HjgIUAtB9o3weNDsU4Y4wBl+rQ1826Xyn7J8fwxYOUkxTRfvyp3L7Gnu96Z3jW0Sdn6CydncigQwDsEkn6AIxX1jg1pl6365vu0Xfy+LE8fymVJraatLoE3TN8+QxePsb1FdhelrXr7tqOaS1xZYnXD8UKLjVpZ1vd2eH2FkPbAsDwWHo9QA8a7VqtXSJ/ZpIFi2dc70FxEJk/DyY9sZyzloBZBsxFaNwMfjbFJxb1XwXTink7JZF3aVvfBxcsbEXzP/YHPaBFuPFy79xpwGmBHFOA88/5TBYFhOd2gNm6pDi8xLke9/yV/Nvln83ZVeHMnj0eYeYQmrz9Ts/fmolKt3C8T+aVMxMYeJsJezHGY/JmERbcKZk4aOD0rfPYGF1Avvdc7J18ZGSmmMALjmE4Jx2YozTkZNKL/tqUN1comd55AptxyifXHyc5Ruff7sVt6aRckbkatFCk4aWxm4sux48Ak/xoD0YBPV5EJjv/2C+Yifz18O+3juunEMEPmgS/78Djf+ZB59zni8Kg3Vpaaq+NTtpno+hN73QlhXYNdtYkKDnktFmDvROfJXq9p/s96Hal1zFeYHY2hne27Wef8PVrDC1aqeF6g5br4GsYxtA7hWoZxIgT8AgJCBjBCBsRZoidCgxqu7ONf/dzXm9iqKBUgeM+hyfsV0AFuTceghABBgCZepcBGDAG7MpwAN2nkACMDuCrL/2jIx8wLHmQepbEEQApRAbLYpxNrGit6z626rrkK2vo5FQdViAKIGGrtEQh+soDUENHb/ak02OFSbsBowTbjST0SUAPE+GEABQAOoAEAIBpz377SL76HA4O4KuH8PQVng6JNDSrEJVhcEqHR/LFY3ryEqzIvQHoEp8MUEe4ts5hwJvL7voOVLcRSgwgMITDfej1wCvVm+sb9aW2F8zcTUINF/tVLtjNJ9TZ7wF/vzsKMvvf84DW/LRldleRC3ZAKWyZs5vuRZv+RGs/+xMKrke4gCp0UaP8Lrzzhd+E863nuPmc9XTIYJwCDRnHqMqczcIs/3qC3wksJvDhtNydKx9k/oPK9771cukRhxfDuu9ygaXAaxoX9ueqh/kfgIVPJUUUdsb3ZR6IQsRLHp8575WFY5K35DtPbrmMqzSVj0AvE0lfUi28l+8ozo2DcAFIVGwasnJ2wjl/L9QVz/HR8qUql+XjFGiouAiYmkhkoAgfF1dZ4fLJ9Il7F7ruBXtZwbj7B1U3PyRnfSwER1jk/vNuHey7/P53z6yaX/E4u6xw/n7ihSfFrMQKF6LICxwDz//7eVBwAYL77tjze3z4whjm+91jfUlZPsc1r0bh5spSd23ltV05HdR3Tw9bp+n6GgRNXN+Un92X1IB9AI+e0IvX/t6hZguNKqwuu50rw198MvzVP5C+TkDYrOPVbbh56PyA+2fy9CmuCIRlQIIQCcUD9hCsHxjwGIghSQHx6pb2f4Mf38MkFhU4V5IeSBU58oA0iMtaJAEGUADRtD9NevCyA08O4NUbOHgJzx/r5y9LzEE5Mn6QKooVoNYeCMWpJAJMUqvbZg2X29KsULejH79gxGBtPWENOnAIDhgBFIDHaExq4qHEfSOpCxVUAw7BSwAtoAbtBVjyqGwBYlv2uH9K3zygl2/Us9dwMiKvivWWVCMHliHlYUJPDuXgCL/epa0/qkbLK9Wk2XTLddcomYpvq75AIAAMMfR3Ye81jEalcv2K37y5tLkWjE0782kXLdBACYiwzMUATPCwGaAbZ58rOTfxxAInqgCeFdG1fO+aghxzDxPCOfx8gWmq4ESrPeedhAXnq3wmI7nuchJhtNAcRCbqVMTiEKkoLyoatmNmYJazhfAczIgXFF94+UE14WUgzFxRnOMRIhaGq/kbZpn+x1xQfaFUmVgSZwyf83mpOItBABQN0mCiXJPCeA7fFbaXIoFuennzRNxzlgHzhknnWIFztegUVpnQh3K7himFrDBUnAcJZXw8TV1Fc451xhXLfjwtEj9OLvK0j5gDNKfTFykIpedWfcH2KweYpj9XqICwFY4yvKhIk9lRfp7Ak9l+LLTakbl3M43KWpCcK/O8odxWVybZoe+IzOfLYr4DknHNVyybpLiSLibaY4GMMLelyOyAdbqcx0PLSXgTznvmLipbcIoFCnBmNwaAAtMc5PEEF3HBLGJhlzOrJZK5W4wXo0L5BxSZfsbzV10ueChlYaEr5yl6s79aCtDvvOXFXB+NhetAM7FZxTPk4jq1OMuceCmf5+dMrzNe0CBdiFNIYVc939JfVrdeWIcV/k1m5RCzCwF/eIw6QJ7WW0DR/NXlVm9j6+zs6cuTSnpIrTbcuQIrAuBjOSAFMBx4R0dqfw/7XdWoetur5uNP7Cef2p98DDduA0Q+dDRq2dmxvUROO3B8hF9+QVdiunaHV1dBa4SBglgJAPkWNAiDDABJKhW5dZduOewM5LjPI+sSBSUCUqAUMiJYEAGMBSxAjAAEFu1Anu/Tg2f89WP38CHsvvA7+3489BG0HzpSzGydRSvapRinlCaqFMn6kty+bleXKI3V8Yk67fiArtxIalWoVpyPTlKbBdiHEcaGXr1RIlbYNavDeze5GtrOoR4l2mmlKqQDAQc0At9hd4CPn6Au0ckQ0VfLy7S+aiNlIXZoxAvI+erlqfp2l8IHXrOpNrfg5jXeWTVpFzCGQNstHyGE+BTevID9fUjSRqW24de2VtbWohknTIvEC+jo7zB/PD8Iw/mhzYWM2oW9+/dbmhed/jOP9hwMNVfaXWSZPUnWm2/Ci9yV2Q1Ovrc4HN/eckmhPoOZ4/98qynTKgqn1fSiNJBxbVUoVvDtc10pmoYivDug9b4zjuIPnN6UedeSd2hZCxWMTGMTYY4zdfkweuqWkF8rKcItM6XPpT/rAnkMwvlbeK70PA/0IeC/wOzsAiQb344DS0FxUoSm8F3X/MyFmzgKn8OEFoioRWZw2O+D/cxghohvh4nPxzvIOIYSF97e74OH/QAYS+Yw13eBbr8nGo6F637RnFRmULSpCPu9txERWAB2vuNmeyk7+YdTbuUdULS/3qCzONdGxDDUa6utNN55vvvkrFs/GNBmA5IUABk6+stvgv/2R/X51/7Rqa5V+fqmvX0t/emH9uOf8I3bsLIGQBi/hMGBnA3d9lWmEnzzkF48oeMDNUplY9Pp2wKhgHOuS46tBiFCcCgGBJEihIqAL40yO0/UEJDBA1IOyUP0wCIMRzI4k7SHw5FKBmoQq+MhvDzBZ/vw5Ak8+w72971k6GuCUuCUcoqEhUwCQ0PpSI8GQEB1H3fW7C8/5dU1990TefoM9w9UKVSffqSXluzqGZYCZmMAIESH2h2e0FcPw+NjvbOe3Lpibu8MjzvBi1fBs1dw0MHuSIYJxEMlAyIH3RhPDZSr4JdheZVuXoHtdY58hjTVmtttdeWqPujKwS4mI+4cKXToRnC4qx+X/M01eHWM90fcakra51ev4OA4Sl29Wms3VturS61KaYKiWYAYkAEiADXutaao0kK78Heqn966TUzyOOBtu+I5/Oz8bnXxbOctE1RYZPx2Tka68IkubD5S4NtNf9Qlg7spWoKzHpYT17k5F1CQuYMaYTpxFZyfxM4dgNO56Fy/Xqz0cNEUq3gsFo9fuXB7m/qoztsgvRsnHc+NYieBOhc1rwvOmwsn7sIis65TF5pWFB3VZ854XIh0Fc7OWRjuomU+o49cGPUoiwS0MJdbOUO4h+/DFjrfm7xfjzSB1hc+Km+xQxj/Spw7s2bZbueeSpj9vLj46i78sykEjbDAEmOBigC/Z+s4Ga9nMMYMy1Tk7cbbl9zMBfPXwoO38K3iopnlZcnoix6K/F7KRWtoaqq0uBorpKRMf5Jc+stlIZ1xAVgwMTTO7aEXqhNwwbaGb7V1fAeP9Evm0PL9p5c/0qBz4vQuwohKe9BaqQJea3y53T9rHLzyj1aGJgFwdve1/7//k///+j+C3X21tSk//zj95UfJL+4nn9wx9SsANQV9/fxbevQIhqdSa7rNG/ZGQ46Owz/8Ue3vKu3TL3/hwLdADL4xbI1FBEFCdAoRgQEMQCzADCBlXwIBYfJEKacyxXoqcjSQZ89x9zm92lWHB95Z3+uP8CzFQQL9PnW65EShBwDsdAJoPA0gnrGYJioeKQcUgV4O6cYKf3THttfsUYc6XX7xQm+taB+9rSUZ9qBacgQJgCEN1sHuPr18GWyvuFaVfv1ze+8OjzD54rH+pz+qLx8lyXN33OHTU80QAihyqoJmteSu1OnOjv3gprqyKkqcGXBsoNl0H96WSMveOnUOsXfKSQz7u/BkiM7q5RV4fQqW+PqOcMqvDvTBcTWxzUaztbnSXGtXa+G0RBOIEQAwgIkd0USvVBDqLrQ6m1mZuAjPlZlp0Vy9cN5KZ1GRVBQewIJB5NjSBgEFBQkvK9QKdUxR1lAEw3MHjwxfmWi5i2O+7As0o83Oc0XzJCgab0E4w2Ca2xlm95BxLM88RCRSKE6KHkYFgtRkFCrjCJdixBYVI/fmA/VmMCQZB+4UzaqkWPJhXlrjLEdjzu11BmE73zReuEkJTtARnMB+2UCHWfIZ4WT5Td2MLxy6FN3RxxgcM8t0gj+zmPE8kDy5woQ0Vz3Ml7YX//qZoevM6SMXSi9lqnQRnGFNFRmV07nbWEZaNLya10dPBmQz62nB1I5nipOFngI4N0eGMSQJNNMJINH4Hp7D5s9FOxYwMJxBTpknwyxQWb4FjgEyyRxXsTjcnxzVUyvpArw5NwuVKRiKc7ucXMJqW3hAz4xJJ/FVSJg9U3g+7+silfms6ARndLRSuE2TrwsKFu14cH6IWfjrxbn2RZ9ubmkjTsf0F1vqzgWQQhFNni6AQuzE+Hac6wxx8UDn/Iy+mEbKY+4CAZ6TWM01TlL44ltIgsVAHbz02Jo+3jhfacpbusdzQ6kfi4s2g6Kxm9iitpZLYdhKR+HpAXcOIYkBDBx26btX+vm+BsCdnfRf/13y//j16PY1By0Aj6Dnf/dd8M+/hS/+4uKhvfeBW74qjQZEFRim9OZYvzqAszMFiQUtoBx64AAZQRyhEIACEZc669gqpwg0QOgDCIIjEJQUB8xHPXj6Er/8hr76Wj157O2+jno9bSyKEi8E39MkKopI2LBLHRjrnEVwqB2Tp1RYhhLBahnu3cAbO7DSBEAYDfjkDDsxpLHyNQVValWlFDhPGQD0QnFKn555g1FoYvjsQ6jXhqu3GQI2Sl534GzomIc+mmrgJwNJXTA0kIAkgpWaXL/K93a4XpJX+6o/1P3UnhloVdi/zltt7hy6w33e25OXb2C3R0Pwj5/r5RU+6zg7ssMhvN7nVwfKi0qb5cb6WnulXSsHfgFFs0V7oXyrffe0kLei4hcD1pcyTgXkPF3gkhUoixmf8pYHYtHbGD9rc2e/nBvrnnvPMuH5XODWAbIARilm9E1cGOZoOQUjjwvgysIpOHF2gIsIynPbFc7PgWcmBnIOuoALRQH4w+ckBeOt4mkHBfeWuYTT4mYsF8Cx4wMmr9KA6CJH3/lDdyqhxMtBqHdWBMs7NN4XzkKKqEPRyUre9XrjQrC6QJ67yKNw9qbPmBhLgQ707kOkt9EnitX+1AGlKMWcZjHMYS+yYEp87n7BbFH4DgDjO93bC3yqvx96cj7bt9CdLpiownSvuPCzLEwHfseV87bvlQWDaSx2BecKujnK5TkPM3kHej6ODV+mde27ldTyXqfMu62Kd7bcPN+h/qDBp36XXybMxS8HZU9I4th2e9AbADBUq3Btx/zyp1hvwP/z347+139Ibl53QACH0D31vn2j//jI+6ff4YMvnIigp67fZE3AglRCDqnP6uCEYA9gHcCCH0DiCSgQFiec2SCxk5RFGEiDJgAPQDNYBxYHA947kSev4OF38Ocv4ZtH+OIFHR1jCsQAHtiSEQghDBUCIDIQW7bDWIQIiXyFyw1YaZudDdnZcFfX+OpVN+rjy++8h18FB8fagVaeICKwaJDIN6WS+H3SJQIPLWoA1Yuh24f+SGAEkMDwjJTRG023WndwX2ySjPq4f+S+fuo9fgbdMzKpNKq81ILhEP/4F/+bR/4gdeW6abVdpUyNCMurUC9xvW5LFRFUr/ahUoXNJdlZoa0WPBvC4T4/exY31z2/srJx5crSctMLsowghwiIGoEQ5hiUcslYc0IGumyxTvZKEZl9uC/8se8/MZ1F14vb0yVy8ZkZ63k+3BRWwQsYPoi5Q3pekI1dHycXZMb4Y7E1xwSUK3r3F8e/i49JvNCJp3jDxu/mkif+wjnsWLMhszyMYj8t71KJFVC74vjygrFA4djMr8a5kgQLo/d3LwGmOtXizSVaMMFfEHQD0/oO5/uHt8+JLhnqvWOr/C7uwDg/JkYsWD+9pWqU2Tqg+JbwwsYJZ6p3KUwHzw+MztMG3lLbjHOspvLD2QJn7vm6YJqJRT3FLG4+8d8qgI7ju3iJdfQ7FTSy4NPArDh09jq/bbKMcBHLAt+WtFpcmQjn8/bw8tUr78NZH8sqcoOxQnOYA9dZiTb70C0CDucw4EXG4Zc2Qpd9rkUZ6oALnu8Fl3OuIbz0aZTFiPP5MhAXGOm+Z2vzziXa5JycrdAgjKBcV37ZSxhOz4AT78oG/2//zn74UbKyAp/dt8ubFlLsfItffeV9/Vx/95q+ecUPH+PeGyj76vlL/5sHmAyh26VaG9evS9CQNx38/AGuDGClCtoHH4AcsBVhR8iEgCQhSC5hyL2HBQInIqMhHLyS7x7gg4fw7SP1+jX0eoBKSoqJLIHVyqFYNgykELMfiABgHISBrDbk7jbfvWM/+9jeuGnDSM6O4PED75//Ofjt/9c/6AclkGo9ZRKIXWxEayiVISwFyvNAeZ6vkiEEnkusfXUoDx9C3NN//lrv7Xqlmty8hzeuQaMOST/+5qH7f/9HONn3Dk8pHRhfOeXBq1P9T78v/e//p39m7c7K8M5ds70Jy00ql7G17NrLvL7hNrb4cE9qJfj7X8I/fIbNtpzsQ+cQXr6KsRqElc31azdKUQUAgIGdJaUIS4CIoAqrKDcWcs6dHwZJPtKbYapNUY3JcZjpJWcQKSzStnBWWTbb0Z4Xj83C7Of6J5Qi1wGnHlHF0V4RcZk9nsdBSTlYQkQ8dksseGtMm2/OxmUgCKiUGruk0oIw6Tk0bey5lM9WBJh5Ehk/+dvMMhl1jsMXF4TuFMWALDw9iMY146Jtd4Zdfk7bBWMix2RuO+NINz6kpyn2F5xp4/CfbAgFF0ZdTe5UxgySacAiFkdWc9vu3FcQF5+jMgkYmFbd0/H95HsmA9PiJ8WJv6fMxHRK4TX5gRe1K7OetFMn57m51UXHT6EWOkc1WzT0H9/+sdh0PFXKPFZn816L8MQcd2hxYZjfiHHybPGCjMW7SOd+C7Mwu+wiXgRbFub1Eylq0X4MiQiJZN4+uniew6ILh4JTkgDOShPH+5jkCtkswu6CEKCi9nyGgXCeiiGTJS+zHEfJIsJkxitn+tfGOuqFHQLkeaVFzcP02Z/ln0x7O1y4ksbUK7p8Hc4x/+aYXTIvyRDnsv0QiPKWde68AEClprucnOO9jpkRnJf8RbPL2ZSP4uN/TkZNuIiZOv/mc3AcLrJXE5mvr2ZmmItYbtNDqvCAFU1ccNEMRgqCdFmEiuKPUqJd9IrKtLJWXltveOHZUQ9OOnppm//+Z7Fx4FcBIoCeev7I+/1v1W9/T198Sy+OsJNwmkKlhCt1Eqe+e4RHhyABLq+4UlvE8Kt9+uffhXdPOfyAW1sS+gwjsak4FtEgBAigBEgABNgBZR9UCZIzAkkMcY+GJzQ4oWSgEKhSkahsPc+JNeIsCqIIsAKHmZ945Em5xCsrfOeK/OQ2//wj+8lncW2b+z14tae/fFD6b/8U/Xk/BKAgSMt1Vj5bFhZQCvxAeb4CVEKkfQi0iyLjmA+P8fG3cPxaf/EXdXyMOzep8rG3c8WWNwB6gKn75hu+viYlhVttWGm5ep1B08mQXlkPQD08YNQQx9JdguVlWFqDRhvW27K8yjKw7Qr84hNo3kMA62mIRzAcsLVBUG2Vs/oMgEHYWiSPhIqyGwRApHGkklwwcX+HfmJmJ50AQFgkkl+Eol0Sy3eBlB6nfu4Xpn/KJQBbvq9K7kafAWMy6wQ797CwcCbRIqHzPZLAxbOnIhe60JzNWvsunkPNmk1NK5kp/2NcZF48eJHLgf1zxcSst8U5s4NzwvGLWscLut85L9zpKTn9jcX55uIC5S1zh7wezr5/rkqYq7fO/Xw8T1Ar/hV4J99XuShWZ2Ei9eXLfeGtE5lfpzIzIbrIzK6AUsoMkHwRH2f+dMmpi4AXAjKTO/gOQx+cD4yaeUsI50f/l8UozZL3zksxiujpW1GLy8JzF1+oBSHDxWenICUZ11/n1YgwT0E8N5iWBVXau83p3vqd8/qMy7BqYRFhJpoGqxVIWMKSc3cLzs/nx7EyE9AyEwnwTiNaXESuPF97zZqEv41uMaP4uVCbcsEM/fsAYotya368Em1u+6uXy9evbCYH1wOyZ73O81dQqialBvghwBB2v/O/euh/9ZX+8oF69Fie7uLxwEUlvnaV71+XjRYmKe4f6MevaGXL3vrQ7jTk8BU9eaCfPwyTjttcTVq3LJQZDKABy4AekAeKgRjAAjCxU0wIKSt2KBKWoLkMVzfo4I334oV36HxgRYQ6ED8AsVpMFgdl2YhNlQD5vm4t89pVe/e2vXOHP9iRT7dcaYnBwOvX8OgJPnrhvdwvMfgAVoSDwEUlo0vgBaCUB+Kz08QETkCMiAAwASjWLoF+V+3t8Ys3NkZZuabqK3qlo0Y9t/vSI8QPb7mPbttf/NT+5MNkeZsHKX74yeDRrnv2SkWeGwk+36f9Y27sSesY17fV1iasN2BjBbZavL7toEJwCr0EHEAQRuVypVQpTysMdEYYmRAUzMd/zGefLzi3cg4vT/EcOV+mTLAYRpkF28YH5oWndvEIXOR1NC4T8yTm2UQdmXuS83cxdp0t7snMOYgCAMwuQ0SICMZJUjLf7gsLMDM7x8xAxPNEqOI/ZOqkNOMqUvRZx3G6tJtjbU9C83B2EgjnfaEKw1nES5wNZqpYGVNECvHFkzD6WULxeCY0HXDDjAqkaGspUIDGigsmJ/JO0crpO5JZUtMEipXvwwiZMP0n7UQxv2+ByZ/I+a9fEnI/d1pnyd3nPWkLBPYJSZpl4rEmuBDjuJygKRNPsCmmJIVHFgEyG7JcwDOngBPmyU3M2DvnEqhmF+b/j7n/bJLkStNEsfcIl6FlikgtSytUFeT09EzPzO5eu+Ql7X7jj6QZjTTj5e7O9jTQDQ2UFqlVaC1dHcUPHhEZWVWNRs/2LhkwgxVQmREe7kc8530fcRUWTcfJZeZm+FARYISnGpPprZh+lzDIXEoJV4fFe0LW8a2VSkopJwIEBWFi1MzgvZI0Nakbw+zwVZf/NT0sTIYUUrNPclJLvaK8+DUdvssq5TQ5Tc068qgZX9XLHjGaLDBTGsC4zKRmLdfeFerO3Jyr9Kn36VTvlK8m3dW/SKWEX2C1zI6wK8kPl1s/upTeSiln2f5haevPwMfJaqNmoPzMx+GwuvnOYew9w8Jph+CKQPu9e6euZEMAxpc21pcl6KvLw3S0h0VQhD6slpvthMxUv2b0yHDF/ejKRjFpDl1aaiIF43Q+/LfxRftzED6XyN3YvIaGzV6HdEbHr07aCjnr80AJHJ3pX/5g/fF7+7REgkAKziSRlEImIT+6zv7j34mlHHpxYPw/y9reGZa2eBwLdtc5dYynLfv80DSJvP8ItpkEBCBB8RB2gCAABEgQ3iECyJIKq4CrwNMIjyZhw4KUhQOmVRtWo2kMusj3OQ2EpBhxjIEgLAgSIKSUGEsSj9PtleDhx+LTx97iDZWJI5uD7MCrc/j2Kfzws16sWVw3wCcAjIsAIW7aApKgNylggwVW4BDQpE6k9FUgpGRgEpSOaPNJPEggSUWp41dd5Zv4pGIaOg5conxkU3ltS+xssAf3gtR1CTHYxd6//AdmJN23J7TVwp0mbldQpQ7qApklyNfwrRFo12AlC6kMgMahyctFOGsBiRjLK6try3PpqDUD0ZQAkApQuDThsDl4eZ7FGH94r0IIYyQlUkoIAUJIhABjghAAkKkMajxXlVRCCimklJTSd3tM7yYyo0sHC6mUkpzzccXqyqkJA4AQYXMKU0o0TZvWjaZLeQgfJSgMSggpZdjznox8wJNGzHT+CiEkQhhjbBjGOCD7KpVTqhCaKcGFEByUEkoCKIW5lGO7knGHdMqiwUgnBBFN4auu15epgmFbWUouuBTTmx9erVKIUoIxDRcfNTXuvKKOmGkITDp0l6sWmhaQ1AzHUCoFkksJSkqFAQPGGI81klKOAy3D53WJbd8vKIYyWjX25hSKgwQppwI8hBAgijFgAKW4woARJYhqiMzy9qZQKsQ6UnIllMIYMKKYkFnwfRm/+QsH+vFLXK1LSZhpdYZ5bjBWDUzJaWjWdO19eKtmtqwQzYcfxxgPUcjl9EKYEEIIwXjcvplI8MY9LylBShn+D4UVJXTaB3yn+4+uHkuUkkpyqabvozBGlOiEkLDfJ9X4yIERxjPXL6VkLBBCAKjwJAIh4xZAyvGmEQ47pBBgTClBiMwWRCe3aHyThWBCCKkUwkQnBBM6ewiZNtHClxBCSImkBKXC3jAhZKZ1N+muS6GE4kooKUEqwFjIUE2reLh5XXb0AQAIJRRhRKjCU8QjRPhhUmIYN95Cc0qsxjbOl616KQGBkBiIQghhShFCGIVzFc20NdGHiFMQLhsSYSklKKGkAqTwpO87gcQwhgModJrGGIfR5ZPdV6rwcqfcK0wxAYQImXrvofEuL7mQXHKQgHE4PccXi0ABYHW198gDzgQHUBhQOOPC+xB+b4yno3g68ML1YibMUimlFOc8vDxCCKGEYIIQmXEvUwhBGKGsQE72BQUAhIRviTHC74CNGYcQORmZSgGQyW0Ju9vhev1ONxNjPMVmSo1PywhEeDcIwQgRuNrBVUoJzrkQ4fKGEKIYAxAMSCGA8fFRTXKfp87WCsbn8eligt/BOdOl8spkganh8XhUC86lAhU+i3AXUzL8SXkVFcrxJgvaeFSjv2UVDZF3qmiJrfVtxEf7b9nJebfTaQhHUQ4xCw4PtT/8Uf+3b6kv8eamWlmVWZfX6yoZkUtZeWODz+fReV3vOOSiQeZXUCYmrhUUtPn3tjrwyEWVHJxpO6f+PEPAFDXBxMA14AikmDqVI4WxAqoESIbBAj0GegHicdQfkLf79OCQNgfKUypQCgQiiCpASPlScsmFkMigkEqonTX5yV3+8SMOcwCAoYnOTuGbr+H338PBMXZdbMQA+VIBB8QVDnRTgQ1EI4xr7kjzBdaDAHOJBQAooUCjkIjiTAqaadAi0PVVp68a38CLPay4LoWeT6AH19mNHXd7m6UWJADACECHWzeFHRfbZ/joRD88oCcUUwKDPjhDVTyHiIk255GmETumfK7OjuDpWzioEzO5vDN/7dq11XTSulJ4xViq6cn3A7k0f0aJPSaVAJAP0SLRbJ8PI4w1rCHtz7Q1lXq/xRkuSxgDIHK5Pb9LSAo3p/d7TJdKbACEEEUYY0R/BZFyMg/ljNXGTGcw3MAQwoRSAqBpH6A9zZzRPiA+mOVWz/Z2xgQSjCjgCcZFU+Aypc+9S9p7t4f2AV3qOxSf2eoOIgAIKPrgWRPer76oq7ays7TnUC8BCAAo0HB1kuPHIxHCmODQ90PRd63R35NHIIwpQgi0KySPWWnHX3SnD1EvjNN0/yzde1Zv/46dwbs9xw/KE6bFEACMMSEErig7FcAsOfqyQjDZmNFfpvK/TwBAgEkYJkFm8ejk3IRgAjGnLqlX9xKk6/pUPPFnYO6Vptlswew9rjOiVKOUopkgzKk9xnQNCXGnpmkAf9kMByGECQUC2nQEzFyQ9qGm3nsHSEBAMSaUhrU3NBNiq+CDUVezJY7ZNtyVifA+DxAwQoARYDxTFVFTvxgILfjk1PoDj2eJeveLY4z1KTR/P/v0spUMCGENYw3obO68vNLkvvIHTLGGKb4qXn6vSzhrCK1mi5xheRJjRAi+WoX5QGslTGQcLywAGp3mzl0C/A8pOsJJgXTdGC8lk2PhtLnx4brfzIMnBL/v1TiJHUNXu3wIYw0TOi7OTXE2zAR7TOt0IdBDBH6N59T7HdKZYwpGiEycLq5EJ39INnLVMvNv3eicXLpUIBFQO2IWVpbBkOfVdvmHt50a1wXc2IClAsQSEhOh6cF8Hv7+N8HNG0Gjrn78GbXrqtXCFyXkevjwHB8Xse9jwWjGxAs5qW3xeze9cpWOGH76EiIR/OgW3VgPUA6ojqiPvSH4AWhIClCAFSiJEFdCSKlAAlAADJBRyZSIx1TUlpapJJaUSqIhjARILFzBOFeCEw0iCTK3SNeW/fUCg+zkAbjorIxe76s3e1CpKdPmuuHHDNT3mRkRminDCggPlOerwEMcgEqwsPKpAlCIgtIkaArpCBuI6FQoABC9gRgMAENgYmIRzRfEE6Q51NkZZ0fSYVjTIWqrjIHwHNhcZTR2bRH7HvT76LQExaqyGZgMJyPYTpBGF54dwJ9eQbMzP5e9trV298aNrUwiOS0oYIQJ1rD6tVXUCQFNYYw/GMD9gZaMUoSSX1yUr+qMJpgCvzef35/gGMO0ZiGlCOttGCOMyXT+hBvnr3uFewl9/5B8VY6K/xxN6C+bH07ietS7C2X4b4Leu9rZ93xXXoUu31LBLyvm1OwTDKnRv6CQ/WBrW018Nidry1jPOj4jv/uGCIeFs3dWZHLZ/BCCw9hrDE8zg97nks+CW3WVLv6LRNoPjMxf97zUh2nsM2gU3kPe7920d26hnKK0maP2X2TQfeCa8HvfC6EPDHIE6J2+UoiVL3Pe/8Ia/oElfYwEpvvO+MF9YPwQQoQQMCmPzD7TX5Ekjn/hen59JCb68zm3H1QDo/dS6yXI96QbHyASvkfvvvrf+Iq/4Afughovdh+k105XN5i2ayelsCsDAIECISeN8+mBCiFEKX3/ln7w3I0QAAgpOQAOTXbfI3d9GMvPNFHRewKF2QqwmO4hV0FeCKPJBwfSpBkye2D7oD/yB+f7uN+KJosU1TT0oSQMjJCcsdGdNh8QwtO798vL+0zfVUolp3wANFkYP/zr6MPv8+92tv1VjU41pf5IHxEBthG1k4spzfjppNVNXRxpy2kXMGRX4TbiHx+P9Aje3oX/7X8Vu9vsxRvcaOilU/z0DaHUTKXhpzek3MAAJG5hC2mg8ewyfPGJ33b4k5fa3hEeOnjkEDNFC6sMKAKBsUvBldxkSlMYCQQuAgxKCSwFBhI+bo8L4Lrm2TZEbQFYYk1QHQGSKlCe4kHACIhYXOaX5eo2Wlrm8YgAH8AGcHCtgi7qqNxS3T6MPEaJa+gqGgVGeTonTVMFAUAbWg3RH8ggYBgoRWBQFLcVYyqektQWHhZ9jhyuCzBNA/UDF0BGdC8Tw9mUKiwYiThpDrWvX6GhJ9s95buQssnWAlnKgklZFrP8sp/6SOXnMGP4+XP1zbeo15RLEZKLENChNcCvDuWLt0lqr+1s39+99dHO9RupVBoUAAcggBXWEZ34KX5Y1fIeRBPjjj0mf2FLCWu78pcg2rs8y7AVpKSSgOgVwvtffAkhfN9DgAxTn7aK/rtNnMeazUuKwt/AFHqySUyUZr/ejucy7AZdiXpSH2Kaz3Kr0TSLdHLeJgT9teuAUmP5KgakYHzAlSDH9hUE/qrnJQUPPE9i0ImGKIWw0f6LoOGKxemHMg3/ux+PFGISvjlTiJWgQAG+lEoCGhMAEPwqocC/hzP8jtmb+tVOS5d5VuO61rQIKv+cj8avffqzfn0IYUR+kZGMJg1Z+IvOc78+GOR/5gsjLEB8mK/9V6SE/w2GQyjyDJ/An1t3ERAMYmKsqJTkCkLyCfmrnrLkktAZXfcvT5jJ8oV+pe3+JKz1coH6FfkK7/jAwa/OLw9boIAn+vY/z7xHABjhkOGLxgU1qZTC+K9dVJCUUkqGEEUTHsH/zEFL/4pBp5SSDCaIP6ZHrNQc1tI+iw5GfccHMGFpnX/xqVpbgWs7cOdzAAsWa1KnqDMgJxfI8SE3B40BSmV53BYbBWEAwABBUt27E3QCGDHx/U/m2zdU19HqhiosSZgDAKRTAA2AhA4tEiNJEBIKJAEFAAGAB+BInwfExHZcWjYeeRB4KuAKU1BCeZ70PWLpKJ6UyxtsdVflCxxTBR2ALu63yetzfNqA7ogzjpSkLFAgg2hMRdNidVVE46TfFxfHcHaG+12QIBCA4KA4tk3QdJmfU9msJAZ3GB54wCTChALoGNxsUl3fEDvL7sICEEPv9snxgXlchmZDKI4WEqS9Toarai6JI5ZM5Ug+LtNrGDT8GKToiEpELGdl3CYgVa0pj87gvGQtLi0ks9sbO9dzS/MQ3oEx8zdsqr+TDPQXJtmkGE5+eQiEZyCioV+xFF5uhxghhAmQv3poEoI1TYPxuUf9VXDhlzYaDGJMDvu19+hXTI9pxrqaOYeSv/Yd3jEP+IC7G8CMI7GCSynPv+fmEEKmPLCQJhiqtwjBGJO/9s5ggqmuwcQDC71j9vtLpz+YxC6/V4/4q9HSexdF5NWMrCutplmL+ZCP9cuUuKuVIfHv8UBVCv56R02lFB5bbLwzQuRfNcxmLwRjjDFRSkgpQyYA/OIsRQgjJAH+2oGB4f+fXlfDhZX6/xGIHI84/BdOrQiRCYsJYUJDZvBfud5puolnvqUMc+//PHZU8KubMGFRayYrQU3qvOTX9eVmwPGvc6ZFV/0Bf3kovnMEJ+FV/fXzBePQiHV2ofqfh9L+GtONsFRDL0d4IpteXJtvF+eR1q02/G4Rklm5uwGrc5DPAQQANXjzQr84p60u7Qe4OYD4nFhak2s3nLmkvLsqAIRbAQsBpOD2Tag2RLWCDvb1syP1zdcQwWrjJp/LSsgIXQL4KnBBMiAEACkkJ+bzHMADCABrIppi0bSiVeq0cHuAOICug0aR8HUp9IShsplgbS3Y2gnmV0C3AFzwB/isSg/O6HmNDAZIcQSK+B4OmMpmeW6Rba7xRAI1G2b9nOztkU4XIwIKlOsjx8HJFORzsLUmt5YhE1cIpMeEy5jHEQCVYOuILOXdR7fl8rLfddTPr2mpZO7vkX4fmVgZgWzEVMnmrsOohoymUezjQg3HIuD2OCF+YUEsFKSW4B6HehdaTfAHSkORbHJ+sbA8UxwK0XMYYYTekQHN8JfQ1c1vQgIDxQPPcZx2t9NrtX3f1wyaSiQTyZRp2kTTTN2EmQNEv9+r12vtdsd1XakkJbptm4lkMpNKRaMxTddnK97TEcSZ22l3u73uqD8YOo7reYHvTymrpmnZETuZiMWS6VQyadtRw6BX+0oAAL7nt9uNfq/n+4GSXAEGBEKKMbtdcKkQQQhTiikNWbOWZSaTyVQ6RYkOgAlGQorpd3f7g1ql3Ol0GGNE1ymlgLHgXIW874n5FMZYChkwXwhJCIlFo5lMJpVMGrYNhFxZfSZ6K86DQb/fH3QHgwFzPQFKI9Swo4l4PBJNRKIRcjWMa2oy9xfAHJp1SLn8aH/Yb7U63X5v6Dm+4w5Ho8D3hFIUY8u0YrGYFY3GYrFoNBpPxk3dfscHA0AiAEq16XvywO+0mt1eb+Q67sBxPcf3Ayk5SKCaZlqmbcdiiUg8kUyl05YV0XQStj/GKr/QfdAPOu1mu9Xq93ssCDTTTGcy8/Pz0VhiQnNWUkogs07L6FJpgLFk3Pf8/rDX67VHo5HgHBNEiQaghAChFIAiQDBBgJGu6VbETibi8XiSUv0diHB5f9+N21NoBgYPh4N6rdbttVnAMaa6TjFCCClNM5LJZCKdNg0LIQIgMEZBwBhzXNcZjUaO43qe67ueBGXoRjyeSCXTiURCM/SpamHccsEYlCIIBSLwBr3RoDvsD9yACQmYUNO0YtFYNBazozEaUuKuluIAgBAaBP6g32i2WsOhIxgnlGgalUqKgEshJEjAlGCsAFMSCgWwpmlWxEomUvF4Ihw/mCApBIAUkjPGu51Oq9V0R0MAFIlF4vFENGIbhmla9uzNdD233Wp1u33XGQWcC8aJRqIRO5lOZ1KZSCQy3UFH3V61Wul3uwFjmFLN0EFhKdh7mkQkpQgCnzFOdT2VTOaz2UQsBggNXbff7w1dl3k+Y0xwrtRYikEowQhjjKUUSiohlUJSCsmYUEhRQgzdjMTsWCwWjcYsy8KUzmh+x4S/aYtdKRX4vuuNRoPhoNd1HY8LDggjghDCKBQPIQQIJAIlx8OJc66ktGwjn19YmJvDVAdQzXqtXK0MBgNAYOimbYdjMmEaJtYIRnQqkJacNer1eqPR6bZ9n2mmnk2n5+bms9kMQhQAjzval+0F1uv2+4P+aDB0RoPh0PE8l0tBCDItK2JHTTMSidrJRCyVSBNdB5hyEYSSkjPGmN/t93udrut6AGCZZjwWt+IxOxIxdEMpOZuoFzCv2Wh1Go1hbwAIzEgklU7G4olYNEJ1c5pjNubAzMwq1x3WavVWq+E4DgKwLDuZTKUymUQiTrA2i85mC65c8kF/OBgMhoO+P3IlUrquRyJ2IpGwIhHTNDDRhGATboaQUjmO0+l0Wq2W7zPTNLLZZCqVjVg24BkxMsazXvzNZrPZavV73eFoFHi+EAwAE0o0quk6taxIMhFPpFLxRNIwTEAEEwKhLTzGLAg4Y67jjgbDYa/ne56QElESYmgp5URxO2bDhRuCVBJRYhlmKpXJ5PKWbV6iZil/oUH067ho091HUhB0+ktzC4nbH62Bf50wflZq/Pzz6Ma2l88FOI7Bw6XvyQ8/k//yJ+3VS41xFIuQhUW5c43v7vLCapCyA53BoA8vDmFuBKtbkEnB7Ruk3cAQkGoZPfkW3JZ83JKffx7kbgBQgA6gAeIeEKKQBiABKcACQAAwAAm2rZI5llmASAnkmcYAAyA/ABkgCnoU9HwM1uadrQ2xtQbZJQAJ0ICBg4tNctY0a23DcwiRBAB5oILAT8TZ7gbf3g4StlYqGaVT++RMtfqKaBIDDAFZLl6YQ5sFuL8DN1YgY6t6T40GwdBBnghTzGMGtRaz2o1tZ3vDrbWhXGVxoiLIxATbBo9aXFHWDYIuw4OR1umbI9/UdZpJyLU5b3dZbK4FyQJwTVbaotUBJCFl63PxaC6TMqbsWxII5QAQwBoCgsNSJ7rCvglJRxNdG8xYEhBMEGNev9c/Pzt79ebN29evuu1OLB7Z3ty9duP64uJiPJEyMpc7d+C7L18++/Gnnw/3Drv9LsIoFo3NLyxubW7dvL67srae0PUp2WV2IJXOL97uvT08PLo4O603Gt1e3w08UAi4IpoWjUbSmcxSYXFze/vmrZs3b96afuKsA1On3Xz57MXbvbe1Wi1w3bAgxjkHhEORTXhgojolmgZIGbqZyWY2tzdv37y9trY+lUaAGk/gWqX69Z++fvHseafbJRqNWDYmJOAclFASJsmcSKOa73v94TDw/Ygd2dzYePjRR9evX88XNEzIlFc1/nGMAKDb7e6/eXOw//b8/GI46EupTNtIpfOryytrW1sbG1upVHK2ranGnHs1awJ3aQupZkIzAUJLiKmSRwXO4dHh61evDw8PLyqldrPT7/cDFmCEiUYilp1OZ3L5XGFlZXV1dXtrc2Njg1Jj9vyFINyKLjFf8fzs1atXR0dHxVKx1Wj2ez2fMSUFKEQ0LRqNpdOZxeWFzY3NG9dvXrt5nRBtfE5Fcoq3Wu3Wi6dPnj99erC/1+33UunsvY/u//bv/2H3emKyQcrQzG/2201klUpJ7jpetV45Otx/+fz5+flZ4LqGaViRCELY9/2AMQDQNV3TCCFaJB7N5ec3N9d3d3aXllcQXOVTT5SjaEbEEi6gZKbhVKvW/vinPz578azdahtUjyeiGqZU0+bmsju7127eurVYWJniY8/rVRu10nnp7Oy0XKrUa7VOq8M5y2Yy2zvX7t67d+3atdzcXPhZUkkhJcJIgzFl1Bk4p0dHpwd7x6cnzWbPZ4xqWiadXV1b29rZ2draTiSTE6NjkEKGp4VQFhcE/uHh0ffffXd4sD8YjCzLiEZjCCHf8wLGlFKIEoqIQtjQNNMw7aiVTGUWC4ubm5vXr4+fFwKMCSipAsbq1dqrFy9/fvZz+eIcY7q8sry7s7O2tjqXn5tf0IBMB4w8OT56+fLV4cFBo9F0Rk7AeDQaWVlbuX3z9o2bNyYQDQCgUip/883Xr56/6HQ7hGrRaAQRwoNASoUQwiQ8+SEFKgiCQb/vul4imbh94+bDxw+3NrcQwZVy7eD08KJYbFYb/X7PczzAYBoGpZQgjAgmGCupuOAh7OKMuZ4nlbIsM5vJrq6trG9sLK+uLhYKJh2z8pUMVZtjItiYt8V4r9suFUsnJ8eHh4fVctVxRgqUYega1UKlgsJYgORCCSkpxqBUwBjBeGFx/vHHn8Si0XhCV5KdnJ1+/c3Xh/uHjuvalpWfz29vbG3ubBUWC/FkImrHp7O5Wqr88NMPP/744/7Bget5uXz+1q2bn3/+RSQStW06gRgzq2i5dPR2//jk7OzsrFmrtjod13WFkhgh0zSTqVQmk1lZXtncWL92/frqxuZs8Uow6ft+o15/++bNq9evS6USUmpuYWF7a3tzZ3t5dc3UjdCsO1xtpJDddufNmzdPf/rp7PiEc57Pz29d375+7frG5kYqbWJCQ4TBRWiXMC1SyvPjk2++/frnJ0/L5TJGamGxcG332s1bt3evX8/ncwjR6VlsVsbkDJ3z8/ODg4Pjo8Naucp4EIlGl5eWNjc3NzY2FhcXI7G4UqGeFXjg9UejYrH4/Nnzly9e9nq9bD577+69u3fvFArLlmVPNzs0c7qolMvPnj599erVyclJs9l0HIcxTgjWNF3XNduy05n0ysrK9vb2xsbG0spqNBab0BAJAAS+32q1q+XyydHx6eFhvd4MAg8TzbAMSinnXAkhpOJCCsEUgKZRAJBcEEPP57I3bt1+9OhRYWXlV/YK/irrWgxYB3W5kGXT5r0HaxF69/QNPy1xfzgSLPiHLwDncHCuPflZ+3//H/T7F/rAQYV5WViXd27yjx6I+3f4ynKgAjjdh9f70GpAoQ3SgvV12NlCiimLyu+/xccn6NkToghNpdhvsgrlAQA0oog2BsQqrLkjADYmBRoGZHNqeUVUqqRRVd4ZGgLYAEkLRUySsrSNVdheocvzKJ8CiAAwAAR9ByotqNbQoEsRNyxCNEAOCC/gpqVWl9nGkmQOHNfps7d6qYzdgFGDUwxcIl9CIqVuX4PHd9RCVvWHqHyqjo54tQ2BwgBGJmLubmg3tsTulmutwUYi2C7B7jIetlGTGhhDxOSAR45QIx8umuT4jFQrBoAeQfwfPhUb6yS7DGYKyh3+ah8qDUjY0ej6/I2tfD4dnWlZSSECjOhEeYnVVYQ264IzgwfUDGsUjUajSrX6/OnTP331ZaVSTqdTvYdd2zaTiVgylZ5lqh0dHf7ww/f/+l9//+LFi16/F7EjC4sLN2/cTMajg+UCF2y2OTL9c7NeffP69ffff/f06dP9vb1qrT4cjUKVeOgdZhhGMpVcW1+/VS4HPIhGomvrmzMF//Gr3+seHO5/9+23R0dHw/4gdK3mnIcWIaFoCAPWDA0hJJU0THthcb5WryouEULzc3OaoU/vVYghnj999q//+q/lUolqNJFIaFRjjEuQeGwzBQgjXdd912u22+5olEgmHz54kE4mCoXFTD6Pjam0bEzqDt950O/tvX371R/+7e3e3qDfxxibppnNz924fkMhNDc3n0olp5wdISUi6Kpd+KW6bdYZbqLfxKEhAgAI3zk8OHjy0w/f//DTi+cvjk5Omq22FzAA0DBCCGmaFo1G83P5jc2tm7dveY5DMFlbXyNEn7btEEKEXmruWo3aq1evvvv266dPnx4eHtbrjdFoFGJQJZVC2LKsVDK9trZ6+/btwA/siLW+uT1tr0zfZ9DrHO7t/enLL7/79ptad1CYz0klbt68uQs3ZxgwksyYDl2W05SSSvm+32q2377Z++NXX7588Xw0HNmRSDKZogSPPDfwAwDQdZ1SgjCNxmILhUK5dMMduSxghcKSYVpwJXlawbthzIpxRvTLMdbtdJ4/e/af//P/Ubwo2qaVSaU1SjWDrq+tSqmWl5dCiDapFri1cvXtm9cvXrw43D88Pzsvl0q+5y8tFj79vJ1KJleWl6fWvUopLgRFl4Wx4Wh0fHj09Z/++PL5i0q9GTBOqZbPz9++fQdhPD+/kEgmJ+BSSSEBX1LBBBfVSvn777790x//2Gm1Y7FYJpullHquGyJXRDACJKWilJqmFYlG5xcWd3a3OWPJZGJpaXUCijEgImXQ7Xbe7r/96t/+8Ob1K0LIjevXBWOxiJVNJoHolyihWHz+7NlXf/zq6dNn1XKVMa6b5uLCAiBYWFzwfH922+i0Ws+fPv39f/t9qVSkmpZKJjVKGedSqakXQ2is57pOs9kaOMN8NucNhnPzc/lsnupatV7Ze/v25cuXpyenrUbDHbkYY9syqaaNnakxAoUmjjzAgmDojLhQkai9srxyp3sbE5JIJnP5vGnN0HakxOgKNUkwNuoPa+Xy6xcvv/3+h8PDg36vhxBEo7apG+MyBWAJMuBCSKkRCqB836eUbm9vZ9KZ2zdvxRMppdBwMDw7Ofv+h+9LxRLCeH5u7u6duyPHwYBNywL7EjKcnZx89/XX/5//8l9fvHzBpNre2qAE7+7uhuKb6XlvOiv3X7/96ccfnz979ub1m0ql0h8MhOCAkZKKYBJO892dnda9ewAQj0ZT+bkZBgqSQnQ7nf39/S//8OXe3luk1M72tmAsnkzMzc3PHJLGU3MwHJwcHX/zzTfPnj4NPG9tbcP1R/FobHFxfqYPOGWNoElFf3B6evLdN9/8l//6r0dnRQDYWik0PmkQTBPJZDQSiUTjV7gmk6fg+n6tXnvz5s3PP/54cng0GvVtO7KxsdF9+BAjlEgkIrE4nSxTjLPRcFgplZ8+efL73/+3arW2urZKCV5cXMhm87puUkoQQpeaLcEr5fLTJ0+++uqr73/44fDwsN1uM8aUUhgTjVKEkK7r6XR6fX29crfc7/Y44xvbm3YkdjlIuBj2++Vi8eWL5z99/8PJ6eloNNI0LRaL6bouhBBcCCkE55xzpUAzdcCYB0zTtLXVVUq0nd3dwlXW9X9vFe2y8UypRFgpISXDRE9FzGu763FTDTrDV8+OTg76kQg8fASphEC6We2R87omGF5fVru3xfZttr3Lb26J7VUJFvGL0CySl6/UeVWu9CA+rxbXkbEkb0eCiC6pohLwaRG93ddNm3ieuH5NLM0FOKGwpsAHcAECAAlSgWIAHAFCBoVcDrY3kGIQN9R2QfX7SqMqGpNRM0jF1MoK2tkJFjNSC0+PBADD0FettmjXA6erYUksQ2oDAsADxQ1d5FNyIQ1VX9Q78uBcVhs4amNCiW6A5ypiq+U1/snH7N59Bn1xcABff4f++AQOm4ANsVQIPt2h//Fj9fknzFoXkALQYP0aPGoHrkuevtKaHdIboEgM6baSCBTimAYADAAnbLm6ILZ31MYGDDx4/Qa+/xEuiul0cmd1+cHtB9fn51OXVVyEMSYIMIBEly4QaOpuoD5Eu5zVzykFnPPhYNBsNIoXFxfVRq/XKywU+r0epTSVSU3qZ0GpePqnP/7pu2++f/7s2dlFKexrGdpqPpOen5tPJJO6ZrxTgR2NRu1W4/XLlz/+8P2PP/zw4sWLs3JdTaABVSABmALm+cNKbTgcBswHkEjCaDhYWFxJxhNYu9w+PeZ3u71atXp+dt7rdkM5qlJK0zVd06SUjDGQChHCAiYEo4bVbDZGoyHzguFgcPPGzZX11VQqO7PFOvVm/fzirD4YAECs0zFNg3MBALpOORecC0KIaRqe57c9FwAGzfpyvTYY9AMWqIkRzqxOYnypI+fs9OTF82dv3u4JJg1LJ4TUa3UpZWG54LkPZm9T2Ox7R0T5ATdzKQkloT3WuORTvjjYf/v86fMnT5+8evnq6PCo3huEf2UAUKIFLBgKf+j5tWar2+k57ogHDEkIWLBUWIrEkhgBxghk6CgKo8Gg22m9fPnix+9++PmHn56/fHFRa06JRTpRQgID6Q9H3eFoOOgHgS+kUEoOBsPlldVkMo5mVLSe57ZbrdL5Rbk7AIDzaqPZbPmu+2F+tVJSKRS6LWFMCCgulZC+53Vb7XKxfHJRUQC40x8OBrpuer7LfIYwohqRUgZMUE0rFouNWq3TbNVq9bt37uxuX4unk7Nj/311vWBC0kuhYuD7rWbz/PR8MHJ6/eGw31dKKiQ9z1tb3/BcZ/bXfd9rt1rFi4vz07Pi2UXp/HzIOAAcl0trpdJoMJBCXAmQkBKhy/vjjJzjo6OnPz95+fxVd+ghDAhBo97EGC+vrjgj9yqbW870/EEpNRyMKpXKyUUFALqO7wwd09J912NS6pOWve8zqaSQoJv6fKU8cvoEoWg0ohGSSGZN0wQEIdHUD4Jup10ulc7LNQCIWNa13d0g4HY0ekly6LafPXny048//vzjj8+evXR9n2K6vro2l8+vrqzmcjnTNGevOeBBo9U8OztrOsPwiGWYpgh3L00DKbhUBGGqUdfzuoEPAMVmo1avj4ZDzgKJleu53V632axXypVGvcoCZmja0NAJJizwpQj7RARhhTDBCAUBcwI/ALD71DSMXm/F9RzG2GxR/8MmxqAY40PHaTabFxcXx8fHTAEAxAZdUzeVlGELXwEwISSATg2ElOe5lNJ4NNZuttyRCwCY0HQ6NZfP6dTotNuOFxSL5UFvaBh6LptbXVubfmKvUj3ce/Pm1av9vbdMKgAQPNA0qmtE16eDBEupPNfpddt7b18/+ennn3764cWTZ/unZ/LyJ5QEAMndbrfR7bquo0Dqhm7q2u07d+x4yrRMACBUo1Rjvt9uNosX54fHJxggGo10u23PdSUXU94MTM67gef3u+1SuXhyeiYAKKWt5pY7GnEu3qeXTe9po14vX1wUz87Pzorh/zk5L+XnTs7XNpZXV7OZjGVZmGiT+ullg0By7rper9Nt1JvVSqXdaWEF/U5HozSXy21ubuTnF2bAjRRMOKNRs9E4Ozlt9wYIoNlsjhxXSAEgZ6l7o37/+Ojw+bNn33333ffffbt/cNgZjsJrNinCSAXM97gEx2l0u41mvdvrDUeDIPAUkru713VzbG5FKQGAwPU67VaxXDo6Ow1rEumOaZmmkFIKoaRknDPOFQLDMABT3/MNnZim0el1gyC4MqnfSdj8d0M0hZAioYmiUMolwKN6NJpfTpjxF08qw+BP50VYOoPzBqSE8jUJMZlaUKmkvHVT3H8cbN1m6fkgExOgNChZRy+05z/ip8+CSpe7SqxV1M2+XFwWMC82BOGSMJOKn+jxgfmHL7XiqfzsY/93/9BfuR9AAiAAaIBkIBQAB84RIIQophrkkxDTUSGjbm+obps7PSWFolQaehCJQCoLuZxIRRgIBAwBBqAQgPTdgA2kcJQSDBOq6QQCYVhuJMJjpjQJcK7aQ17qeq2hARgnYtg00VCIzDzb3AnuPPBhmcEevDnC//YNeVnBALiwqz7/yP9Pj4L/8EjmdxhEOXAAA5Z3Qeey54jTGpw1kNsxYlGRiblRWy6mWSLiX1tRljSvLav/8A/uxw85yUL/GTz9EX76Jgp08/Hjzx9++sXNu/cz8/kpclaKYjDRTMpwWD9+J+polmcMk3DcmY1LYQVkErEppQw4k6Asy5oO9IO9N1/98as//Nu/PX/5otNuA0AsYu3u7Hz8+NEXn31+//5HsWzGtqOzHzcaDd++3X/95vnzp09fPnl2dLjfbLQAwCZocS6fn8tbdowzr9nplivVwdDxXPf8+Iz5frveLl5c3Lv34O7duwtLS1eJzoAwKMWF5Jhg3dBs04omYlHLEly4vieYkEoOhgPXVVLwdqvhjAatRqNSrgx6fcsyZyGaRGqGgw9YQ4ZlRjTN0KhhGAFnvhsQjdiWxQKGms3RcBRPRBPppBmxiUamx2GEkJBy1jdi0O9VS5VisTRiUgPQKGVB0GzWi+fRcqk8HAyviqnkX6KCKqUkFwyTS5+FXrf13Xff/fGrr54/e3J+dt7p9jzfj2o4GkstLS2kk1lNo/3hoFarFS+KjuCNep1irLjkQeC4jn/b29jajscTCNHwIXfbnf29vbdvXj1/9vTl8+fHR0edZgsATASLc3PpfMaORBlj3U6nWq0PR47jjk5PTzzfb7db5VLl3kcP7t25nV8ozC5AswZsJDSW/YCpRNh9UkpKiYAQgpQKCWqYYKRASaSkIgAcQEcQi0aj0aiUCSkkoQSUHDhOfzjyPb9WqTbrzeLZ2fHJSbvRJIjcvXeP6NpV8VNojnBZUFFCTskrBIXWVuNf0ChxRr6noNlsdttt1/GuAHHP77Q7rUZr0OuBEqahhxBtPJwU6OTSmASUQoDJTHW53+udn54d7u/Xhh4BiOnYY7Ld6V5cnJVKxV6/+x6SvSTtUUQQUupSdQGaTqPRaCIaw5hYlgmgXC8YOoPRyO32R0PXPz87F5yDUAgjHrDda9eXFpfMaCSsRIZtPxwafwKIIACpDMuKJ8cYt9GoPvnhhz99+eXPP/10cnLq+j4AFBYXHz766B9/97uPHz/OLcwl4okrqhSKMcYKT4zQDN2ORjRCMCW6rnHOfS+ghJiW6QcBajS6jpeJ2fFkTLd0ohNMqKbTaCyaSCTTmSQCgRBErAjB2Pe9TqszHI1ASqKBpZmmbdmWpRAKfNcNmGYY2blMJpuKxeJ6yMqaLVGT990uFCYYj1F7EDriWgRlUhnTtKTgTIjQblooBQh0w0JK+Z4LGCeTSUqoz8P9Gm1u7Xzxab9Rb7Zbrdd7ewCwd3iQy6R2dnbu378fmj1J13v16sWrF6+KF+c8CABgPpe6d/fezRs38vmcYVwi3eGgc3pyenS4//LZixfPXuztvy1Xy+F6kYvY+fk5Ox5ngddqNSvVFgfotFuHR0cEE+Z7Q2e4tXt9dX3dNCxAyLYNTLBUnEsmJwUzSihCY/g/NXQNSbUo9KwWXE1KepQiwICvRqhhjEObHRawdrN2cnxcKZdHwyFFEP4mJeA4TrVSOj89zmbSsVgsnkyPuQbv+PNJRQgxDcOyDK0HjoBypXqwt7exsX779q2N7d2ZGYFJaLM5PXdJqaT8kKkRnJ4c/P73v//Dv/3bT0+elIplDmBRnEln5hfmUqkkKDQaOe1Wq9ludXqDdn/48tVL5rssCBBGhqavrW/olg0Ahm5YtkkNiiiWMHZN1gEs24pHo4AIKImwYlxxHkiEDNPEGLuuq2OcTCejEZvq9D05wt9ELoDC+AtQUnIZaGPfIxyPp+bmVhOZBXlhVjre62OYWwLHlbEMu/tApSL0o1vsozsMVn3QFfTBOyVvnpnffGt99x0cnmAXe/EeFGvy9ALmkoLEJRhyZZ3dJ9QjphvA8St97w22CCzk6VwuMDAAB+CgMGg6KAAskZRIYUQwWBbEY2guD7Aupac8V/meEJJjIjRDmSZQAlIiGCEwEJgABIihNCIoCBCKCYRBGhbKaGI+x9IRTiRyR6rfl67HA84BiOPReIzE4xBPy911Pj8fAPXBhf1zeHNCynUMQNJ5eHhTPbzFrm2IeJyDJ8FRigBKA81C4Z76qC/enAXnNdypU2dgOUOaMFg+5Scz7lwymI8HO4tw/46AFQ4DOD+FvVdwdhItrG0sLj+6de/jXGFhuq0jhJQiCBkYBAI5MeqaHaToL2plECCKia5T0zIikUjU0hPxRDyeiESiljWmlXRbzWdPn/7bv/63777/vtVqUUrXlpY2NzcePXr0xeeff/bJJ6nL842cMou7nc7e3ps/ffWnJz//VDw5dUcjyzQXF1Jra2tbm1sLC/PRSJSJoFpvnJyenp2eNpvN/mDw9s2bSrnW6bSUUHOZ7CxEI5Tath2xbcs0HUM3DCOXyy0tLRUKhWg0yjl3XYdzzhnvDwaddrvT67VarUa712j3hoNBIh69cWN35/pll41oxIiYdiwCgyEFSKbTS0tLcwsLmVRK07Qg8D3XQxhbliWl6HV7I8exbWt7e2dpeTESjUyNnUOz86sQrdvtdZzRCAAippaIx0fDYac37HQ77XZrOBj86ol6+USlvLLulEsXT548+cMf/vDq1UvXF/GIkcvn5+fmNze31tfXc9k8xtDr9Yql0t7bt0fHx91Op9loOCOn3+s5joMQSiSS8Zk9td1qvH3z6qsvv3r29OfS+UXge5FIZCmZXFpZ2dzczM/nLTsihGg2m2dnZ+dnZ612qz8Y7u29rdWqnXZXgZrL52YhGsJENwzbjmoADCARsyLRqH4pKLl6y0BJqRC+lHcRhAgmlGi6Rm3LjFlaELCFhYXNzc1sNqdpmkYp0TQuWLfXbzSa9XqjWql2RqOj82K709WptlxYLhQKc4VFgHfb/2GCGcyYmk4OytQyjFgkNhw4qUQsFrWFFJ7jB77vuK7vXYFojLF+v9/ptD3H0ShNpVKe5w+5iFM9YlmWaepTk2UpESBCrnjF9TqdRr3eaQ8AIKZBOpUeOqNWz+31eq1ms9ftvSOqnN0bCcG6ptumbevYCWTcoIWFwmJhMRGLReMxy7RB8KHrDkfD/nBUb9RKpXKn06nXKkoIAKCYRiwrnUyGEA0B0Ymm60bEjsQNAkIm4vF4NBaLxIgelhDU0f7br7788k9//OPB8fGg17d1vVBYevzo8T/97nf/+M//vLK++oE9xtLNiGlH7dZwZBOUm88vLhVy6UwikSCU+H7geR7GOGLbUspOp9Pr92Ox6M07t+cX582ITQhNZdMrqyuMsXgiNhqODKrFolFQslarHx0clitlz/Mty8pmMnPz+fzcfCQaZUHgsgBhnMvntnZ2FgoLsUR81i0IIUTQZKlEM6pkjWqGoWm6pmu2qWGMl5eXNzY2kskkCumfCmGMpQKEQDdNpJTnugogPze3uLioTZ51NBr7+OOPm61Wo15vNRu1VhsAjo+PL87O283m8uoaAFycnjz56ac3r1/WazVdIwuZ7EePH/3DP/z2wf37iwuLs4Cy1+sdHOx99/U3z548PT056XW7GsaFVGJxYXF9a2NhqRCPJwLG6vXq8dFJsXjR6/VLF+edVrNaLjWbTd/3k4m4ubAEAEB0Q9d0qlmGaWtY07R4PBaNRUM5BbxnPGlHIrZlRWzb0gljIhaLRiIRyzTojHX4GKIhAAA/8MrFi6ODg2q5zBlLJRKtbg8TSKfTSql6rXZ2cjI3N7+yshJCtHEazOQzCSa6ptm2nUomc9ks8xyn1Q0AquXS2cnJ+dnJ9Ws7idx4o9F1U6e6pumWYUTtaK/bj0aipmGGy8LsLBu06m9ev/76T3/88qs/NLtDAEjFrO3t7e2t7fX19Vwup5TqdbuNZrNcLp2cnB4dHfVd7+WrV4z5lGDLNC3LXF5fByDEMCLRiGlbhmFYtmVbOmN8YS6/vrYeAmtKCCJISGCcAYBmGAjA9z2kIDc3t7K+Fo1E/8dAtKlGPYx1mxnZy0uLN29fGzi3FX7z6g0zqJ+I81QMLX8s04vs2qaEPANQIEGW4ckz8uWf6Nc/0FfHsuehWBJTjHotfPAGyAjlE2BZklo8m+N37wYYnFycNIp05MHPL+gwoAsrOJVSqaTKJRVKANIUFgh8gGCSKEQBiAQbsEI2V3YgQPCwpwkYwAc1AvCRdAETAAWGBhELbBsUJiMfEIChy0xari/LhbSSHKoNVG9h5iEdAQA4AWJMrS6I5SV2bZdFdP7TM3BG8ORnfFEnC4t4J47uPJT3bql8StVr6vdVQjUSScBiQa7ZEmwFCXntGv/kXtBpqVfCCkZmrWJy8JYzsLbi3NyWGzm+kEaQRRAg5wKdnKpmA5SMp9ML88vrl/hMKCkVIjhUiAEK8Zm6LJDNmAqg99pw7wQYI3zp+48xjsRi6UwmkUxiTACg32r//NOTn3/88cnTp6fFEgAs5fLXd3c/+fjjjz/55Oad2zP4bBahQbvdPjw8fPb82YvnL9yAJ3W6UijcvXv3wf37i+sbuUzaNAwBst3tVkqlFy9evnjx9PWrN92R5zZb9M3blaWV0u3b91kAmj7dlighGqVKCsEZsaxcNnvv9u079+6Z0Rjz/SBwuQDOOWfBxcXF0dHR69evG+1eSBStVsqtRuOdGYJ1CtoYX9mJ2Nr2+sOPHu/u7CjAQeAz3xNKGoaBAHmuEwQMazSXTi8tFaLxKMJjdzN0lTUyajdazaYzHAouQtmUZRi+7wuAkeP0er1ep8MDPj1REULQNNdtEjyo1KyWYMapf6KQPT09PTg4ODo6Gvki3Bh2dq7dvXPn3t2780tLiVhcSTl0nVqttrG5+cP33z998uTg5KTv+9VOezDoR217Y319fXPrkjLYaBwdHLx4/uzl85eeUilLW11ev3v37t179+aXV5LplKVrXKF+v1urll++ePXs+fM3b990Bs6wWsfkdWF16U7l7t37l6sDQZhQSnUthGih8efsjQo7A2RCswtTm64wYBHG46M2UKKZMb0wv7i7s7O2up6IxyORCDYNxoPhcFQqlk5Pz16/ev3i+UsfZGcwPDo+Pjjc39jaiESj0UR8dtircflp6gN1xbIfY0IJ1SkxDEPTdUIpgM+CwHPcQX8wu7ELyXu9XrPe6HbbFFFKiGVZ7mCo6xrVNHLFHA4jrGYdaPpDv9lsDgY9IQEAoqYRsW0uOIDrum6/3+20W6PBMBKLTk1ErizfCBHAFBGNUIAgFo3Mzc3tbO+sra3PLc5jooHgnuf5nLk+6zarT54+e/Lzz2el6nm5SjUtn8tvb205npee/eISsAJKiG5aiWQyloibhi6Zjwk9ONr7+ccfv/n66yc//9wPuEXI5sbm448f/+bvf/Po44+v4LNZ1E0QpghRDADE0BLp1Nbu7t3bt9c31yRHQeD7gSe5iESjGMHIcV3P0wiZn59fXV+LxCKY0NxcXiiVSCY2Nta4EDrRo5EIwerl85f9waBSq3l+oOl6JBZbXlu9c+v24soyC7jHmFLCitqFwtL84nw8maAafbc3p6502UJfoWkCGCEklohtbm589PDh0vJK1LIQIQoQAhxugBqlSCrX96SSESuaX5izY7EZbGpf2925eePG0dFRrfU9ADRbrdOzs+OTk/zCPJHqxfMXz58/33v7ttpsmxopFAoP7z/44rPPC2vrycSVSmS/3z05OXry9OmzJ89a/X6U4uWlpRvXrt+7c2dxcyObz1uWKSR0uu3KxfkP3//w3bffHpWq7YFbrLXqtWosEtnc3JxbWJpUhSnBmODxQmoaesSyYtFYIpl8f9NPpdOxWELXDYwxxkIjRNc0jWr4HUn0tK/tebVK5eT0tFQsjYYDTddSyaimWxHLCny/VC7ppllYXvGuUB3e8wPCWKfUNHRD00PVd6c3uDg/3Xu7t7ay+iCVDqVOumlohh4WlUM5M9U0jAhFWKd0alruB87h/v6bV6/39/ZCfGZr6NaNm48fP75x48ba+noyk5ZC9rqdbqfbbNbfvn5LMfrh+WtfwvO3hyJglm5kUslUOhlNZAHAMA3AiEkhlaKaFonF1jbX7965t7m1lclkLNMETIRSQjJQihIaKoWlknYkUlhajifj72xAfxu5AAJAITcbMMHGLJ1iaTn3xRcPdX1wdpw+Oztlver2unP3Jnt4R6BNBFgBSPABTuHJU+3L7/F//Yk/P2Y9RyYiMpODdAyBqy4OSa+IDEKicTm3xOdX/cV8kPyN2N6Uh2/p/lv8dB//8NJO59XN6+rhfRG7paKmhAgAKBgBDKRwQElJGBpbdmMMSgJSAgOZmoZwAIEUIPAVUAVcWQbKZmkqR2lJHzZ14NpiRuwWxO1NWMmB5+NOk5QqRDpaHJMOEAkgQM5l2ed32cZqMPTFf/lX/OoA1xtEB/rZY/TJffXwI5lJyL1D/Ps/aS/fYCDo1nX5xScikxSxmABN2nn5m0e+GPrUI0+fW5WG7utkDng84xWW5UJeAVXgoV7RePrKPikirFsr6wtb1xYWltKXT0SB5AphUJem4AIUBYUuU8WnMdxTcefEX2YWo2EAPE7JFL7vM8YoIeGJpNvvNRqNvbf7P/30408/PymXKwBgE1pYKty7c/ezTz999PhxPJO53HEFv5y9UjSqtbOTk5PjUzfgAJBKpu/cuv0v//i7z774wszkdE0jSCiiBQFjo8FcLocJ6vX61VZPAXS63XK1ViqXqrXa/NLydFvCCAsmRiN3GEjN9aORyLXd3b/77HNsxxgPROCFthuaht++eWmaZq/TKRaL3aFLCWaMj4Yj5vQ1Oz798koBYxwABAAmdGGh8NHjR3/3+ReeL4KAKel7vm9oGsJYSKmEAAQEE02nBtUQxYJzTLQQXgACyViv1z0/PS4Vy4PhkBISA5GMJ2PRmB8EGMBnfrfdKZWL5VJxsbBMdaLUxJBcwdUw+kv1NsYIAFOKALAEORj0L85P9/b2K5WK67oAEDHI+sbGgwf3/+7vfnP//gMzYhNCpOf7SK1tbNy+eTMSiTiOU7q4GHAOAG8Ojq4fnbTrjemOqgJWr9TOzy/Oz4ueUuPndefWP//ud59/8QWNp6hGNSQEooKLwBvOzc0hgrvdbrXRCeF4pVIpli4ajWpuctLFmBCMlVLBhHrled5s+10pKaQAJQEIhLFTs6hGAmAQUjEuXNfnLLCMWD6X3d7YuHnr9tzCfDqdlroVWkYULy723h4kYgkp5MvXrwKl2p3WweHh6pvXsXh0bX3DjsbQZexjmKgUGrxfcvsAgEvFGecBE1xIISCsuABILp3RqNNsjlrNSCY3oQ/zXrdbqVfqjUYidFVAgACkkJLzMM52prs2/m5Mql5vcHZxcVG8cEYjg4AuIJlKJeNxzgWFbhAE7U63XCkXL4prG2uGaV4euC+jurCUUgouwvM61VLJ5Nr6xt2PHmxubQVSglQqcCU1MKG830kl051Op1Sp+hKa9Xar1RkMR2ymLQsSeOB7nuf7LLSKME2TBV75/KLd6T599vPXX3/78tWrfsABIJvNPbh373f/+I9/99vfTLd/AJDiSvyAlIIJ4bMAAAIhdMtcXl5+9MknDx9+5PqC+YEUXuAHpmkSTROMMc4VSJ3qpqVToiOkiK7FE4nCUsEbObqmU2qapmkaRCp48eKlH3guAHKGVKOFxaW7H31059491xeMB0L6UspoIhqxoqZhve+5reS7CRqAsQLwA9/zvYBzQzfn5vLXr924fed2Jps1DEtgHDaWw4UOhawjIRDGmqab1iwTF9Lp9M729u3bt5vN1t7REZPqolR5/vylQkh43tMff3r98nWxUg0AkoZRKBRu3Lhx89YtYkXfOel2Ot3zi4ujo8NGvw8AhmVc27n2H//5n//ui99EFhc0Q6dKSqpxxtmgE7XserlyVKqGv7t/Xt7f329Va5cACJBUSgohOOcIK84RAKWUzqiFpi/LNKlOQ7IyE8A5l2H5+WrC5nRMDkbDcrl8dnxSLBb7/QHBEI/GI5EopqQ/6Ha7HalgY2t72O/PILIrn8iFYIwxFgRuwBinAGE6d7vZfvPyVSadsWPxnevXddMGAIKREIIFjDHGpQp5YEgpY3Kkdwb9k+OjH3/88dnz57VqFQFEdXrv3t3ffPHFZ59/tr29k5uf160IZ4HrDH3GAsdZXijIIKhVaueNFgC8Oj5bePr02rXd7evXQ4iGKfEZG7mO67sKpGla8/ML127cuPfg3tLKcjKW4IgqqUAxwQVGSIIUgnMmCMG6btrR+LtefX8biDZJKkNAELJmPXLSKfvBw2umpb4B86c/itcXPUP0HuwAysrxT7Wgf4BfvtS++5l+/Yy8Lakm87UoRJKQiGNLw8JXzSrUAsyYHomipZ7vKVjd8JIZYRijQGgXVbP2mpyfGbELpaTIpdBcXO0qBUkFmgQhwVNcSoIkIMBMIQlKgUSK60piwAiIAiwBBFYKIwJIKWAKQCWiaHkFb7bpaU0/Odf9EYkYansZ7l5TsTRctFGpimt14jvEoMQE5ABwJjQi0hEW01Wlgl+/wj++JIDJvevk4QP1v/5OZe4C+NCpoFoDf/3UGLq40+W2KSIm2/VVeh5BTM1vy9+MoNPg50VV6+PhSBdcNylNxAJIAvjQLKofnno/PcVn5XR2bm1x5eade8vZvH3V5EkqIHBZsB+boqlLi6m/ZPD3vihkbEeFCcG+712cnV2cXzx78vz5i+fFiwud0lwisb6+/vDhwwcPP7p3714in5+ueIwxkAJPpke/263Xa81GY9DrhQ379fW1O3fvfvLZp8s3br770dnsY0q7g0G9Xq832uflKpLQ63WrlWqpVJpCNJ1SQ9MQQMjeUEIkovHN9Y3lnWvvf5uIbTZqzb23b2PRaHfo6oaBEGKcB76v2VfKidP+oabRRCK5XCgAUNOgpmEARBO/1IPkl1swDp3A/Hq1sr+/d3Z21uv1dF1PxONrqyvpTMaM2L3hcDAatTudYrF4fnoWjcSS2QzGYYITSDU1e0dTfDbhcmGExmUUFgStZn1/b+/k5KTT6VJNixG8ubF+5/btjz766NHjx+npQ4ldnust0/Rc1xmNvv322yFji7lcIhEnlAIXQCkAdFrNer3ebLZGg0GoNlhfX799594nn3+++IHbm3tMabvbq1Yq9Vq9VG9KIbudTqVcKRXLU4im6Zqua3TC+xES1DRwd0LQmgb3hUQf/K6fJ0JICcG5YFIqXdNSyWShsLy1tbW0toLMy65BYXk5l583TMP3Pc/3isVi4Hqlcunk9HRhaTGXm7ejsekzV/KSxYXRleZjmBotpcSYmKYZjUR5wPq9IUbId712u1Ov1dYnEI0zPhgOuu3u0GGJuLIs23N92h8CAhkGyM+kbUyBYMBYo9E43N8/P7/oDwaGSZLx2PraejqXN+xapz/oD4e9bq9SKl2cnycSiVx+jmgY4dm8sYkYWIbuVMrUjUQisbS0dPPmzfSljm/6Wm00Gt/98L1h6r4T+L7Hg4AzJqR6R64hpQSlKKW6rkslGvVGs9Y4P7/46enPb16/7vV6ALCQzTx++OizLz7/4vMvltcvnR08JxCSzZpuSIFmslNB1/REMlEoFBBotqGBYQLEf3lNithWxE5k01fr8wCr6+vRWCxkWzMBmqZl87nN7e10bn52x5+x21Uf8BKeURCP+YcT9zoMoGlaNBbL5rKFQiGazPy1vqORSHRzc+NR99FgOHBdp95otJr1V29eeZ7jDof7r9+UymUGEEGwtLKyvb29ub09wWeXX5Zzp9PuNOr1dqsd/sXCQuHm7Vuff/HF9uNH737k3Nznn/b39w/2Dw7Om+1wj6cYS3nZ00UIaYRqRCOYIKU4F57rjYZDZzS0r/bgAMBxnMAPpBy7wCGMQYX5HO/k5o3v4Wg4qlbrpWKx1WpxyaOxeCqZikaiXHDHGQ0GQ0C1eq026A/ecfK9qt8RjAV+4CspI4YWIyR80EeHR4ZhJFKp/MJcft4Ol2sphBASAaIYoUkODda0CY1vcLS///LFy8P9g+FgmLSMnZ2dzz/97Ld//9t79+9nFxdhUmwbN14B1haXQKqh6335hz9clCqpWMS2IwohMVnoQ7dnKZTkEhTouhaLJ/L5fGFpZWFh5d9hp/w3a3ROOXp4HK/LheSUYKzpCwtLOjHqF4MXP+43z1GjAd0uwAAghjt1aL1ET59oz3/Wnu+T4wZGWC3MScNAtoaZxCNPUZAmlUpKCTIQtNklcKI1e2BFecBQs0F7fbBsNT8nbVtSUJUi/dFVpy9Q3JZaVCazPJJS0aS04gAmgJDAEGKKKCAUIFSrcTROhTAQYAlEgVSAIJWBHRt8BOcVtf8KdwYQj4iNDXHzhsCGaAzoaIS7HTJ0kRgDH+SOoFqFvUPijlSzJyyK1uaxZqGVRZVJQzqJwMRgos01dOOGfHbC3xzQkzPy9deYuzDoiQcPUHZXQRYKW3DzhnhywCpDrOmKMiC+pikEFgEpzhr+tz/Bdz84BBcePL776W/+fm1nM52JA0DAfYIpQQRNGAAIECisgABgNYFq6M/GY7xT4J8OOyAIEUoxQpyxQb9bLhaLqHi0t//i+avzs3PO2OLCwtLS0p379x4/enTz1p3shCUmAKTgQkoCZJpp0mo2GrXqoNWSQQAAi/m5ja2d9Z3twuraB68qV1je2b1xdnpWuah63aEfBINOr1apVUpl4XnENENSs6brGKNQwwQYzKidm89/8A0z2XzEjhJMQmuG4dDxfF8hoPrMeVEAFmrC6AYNsOLCGzpXufwMLjPm35kOBKErTH8/CCrVyuHh0f7hYa1alQoWFudv37m9sLhwcHRca9S73UGtWj0/Ozs7O5ubm4/Eo4ZpzC5Q04XrvURBmJEc1i/OLi7OL7rdDsE4k83u7uzcvnnzxrVrl/js6mtla+v/+r//77l8/vHjx+1eN51OX79+Y219Eya0kka91u60ut02FwEALC8VtnZ2t7Z3CivLH3zD/MLy9vbO6c5J8aw47A855/1ur1qulIqle/fvhbdL13WN6mHXgY13S4zk7BE8jD9GoNAvDFalBEgJShFCNNMyY9FIKjGLzwAAUX1zZ9f3nPLF+dHRUaNWc4ajZr1Rr9U6rXeFVEpJqQADDtOgZqeKkJJzLpU0DC2RTORyOQTQ7XQV485o2Gm3GvX6+o3LZ+EMHNdxFIBlR9PJjBSq0+5IpTgXApTEH6AWBJ7XqtfODg/Ojo9qtSaXODu3eP3WnUJhOX52Wmu0Ot1+vVa/ODu9OD9bXJhPxhMkPFXMXudYZIIIJhSkrukR285lsh/CZyGvKKpREmpCwx0GKYlmBpkAgRCE+dAIEPP9TqtzjA57ncHx6fGbvbeNesOORFay2YcPP/7tb//+0aPHK1ubM7Q8znjwLhISgBUQhQFAQ5goED7z+iNYgKtA6tdsRleweywa1XUt/DoIgGJiGVYsEf/ze9wVfg4gUPhqLCwCkAophQEoIRQTrJQIeOB4ruNEEwlAVwN/J2FEV9cKAKxCg2srEl1ZWwOEO+32+clpp93uNBunhwfesO8Mhhen571eL2oYy6sr9+4/uHnnznyh8P587za67Uar1+ozLwCAqEHXVtc3treX1j+8im5eu/bZ3/2dGwTPnjztBXwll7t7/2F6cqIAAAlI03VNNzRNU1J6nt9pt4vFCzsRKxSWleBSSs59TTMopsWL80atznymEYoRp5QKUPzdLPTLWzjoD2qVarVS6XW70VQilU3Pzy8k4glnNOr0ukqp4WDQaTbbzdYl3kZXVIkYYYyQFCLwPKlkKpnMzc1ZkWi32ynVar5gC8vLDx49zM8vAQDFSAgulSAYNEIIweMz0eSY53hutVI9Pj4pnp4PAj6XsJYKhZu3bt+9+yC79OFljSZS/8v/+f8STaVu3b1dKpUpoRtrqzdv341P4rBFwDVMdE0nGINQkvEgYIHnByMHuAd0RtEsA5AABF8dOf+D0gUub2Xo1BSaFrkAFEAHIJn8/PLq+srq/KgdYQid1tXrl6a8wNWKOn2Nnj2lr17plSbSLdhd4YmscgLaaBitLmIB6HMskwxScUoQYkKNArx/pDWf0G4PeY7SABIxtbyobl9nUQuIgn4bF/ew06ZIQSIrd26q6/fk9nUSywpIABAAKWGEgCMAAIFBYEAAMrSpH9ODIQAwACVUbkHexvJgjz/LcxiiRIJn5oP8ii8UGIaSPvZ97DDkYoU0oTOEMD4vkX+TZGVRLS3Agxvqs48UR0qA8jx0cIp3IghyUl+R//xPwjVk4vdy7zl9/ooO+jjgOJrE2TkJEYA0Xt+Q1+84Xc6YBwnK1ACP2lZ0PjJ02HGj/vIATs5hbSW3tvXo0af/HM8YhmEBgIAAIwyIEIon/UsEgFW424z7nDOOGpMa28RkS41tBi9Pj6CUUFJgRHRKkVLDQb90dkYxYb5/fnZRvDh3nGEsHl9dXrr/4MHf/eY3Hz18aMVSM7uaAIQoneZDqcGoX6/Vu63GaNDHChIEr6ysLq2tZuYXkWH+uSG2ML+wu7V7un9cOj2vVavDTqdZqTbq9XarlSsUAADrOsZYKanGa7OSSvniw3LIXqvZabe67U630wMAXwIXXDcMY8bnRnEhuMQShXU+CESrVn/76rVJNUz1wA88b+QzX9c0wDhgXEqpG2Y6lZpbXNB1KzTCDSXq4Q0djkYXlcr+wcHh4WG5008a2vzC4v0HDzbX1yOR2Os3e28OTyuN1sH+4ebm0dJSITuXm4VoEiQZQ4bQtw5JKZW6InH3XLfd7NSq1Ua92ut2pRCpZGJ9bWN7e6cwP/8LM3hlY+P/trHeaTZH7sjQDMOOxibn5kGnU2s22u3GcNgDhJK2ubq6sb6xmZ1fgA91QMLXfH5hZ3Pr+OCofFGqN+pOu9cq1ZqVaqvezOTnAMDQ9ZDdM46sJ0CuBrRjhDHCCPC4DR8ysWd4/TIMhhRCCSGV5EIEgnmceUx8aBNHhaXC3MJ81DalHziM9TudYa/vu+44CHy8E4AARUDJcazqFXTIOQ+YxyWnGo0lEplMBpRqNhqDft/13FarWalWBr1OLJECgEHfGQ2dwGM6oHQiPTc3L5Qslkqe77uB7wuupvW5mQ9xB4NauXRxfHJ8cFRudaIYpXMLN+8+2NrZslOpN3v7r/cP6s3W6eHJ+ebJ8tJSPj9vxux3KkFCChEmcofGtgqkUkLyP3cuOy9eNBvN8Lhi65pl25Zh0JlINy4lEEw1DWHEvaDb7Z2dn5YrpUatWapUqpUS42w+n7//4OG//Kf/8Nvf/jafX5gKXyUoQEA0IqS4UpiSCAlAYqxv9R23Xq68evZUMk6pJpQKfCfgAdV0APADJqXUdD2dSs0tLOiG9QuD2fcZY1zJ8ZoOUjAmPDeA1J+teM/mb409bK9QqoSUHKQgCOmYIADf8xq1+tHhPtVIqlQyLQMjHYBzFniuL5UgRLPtSCKdSsQSphnBlMx65SBKE5ncrUi8eHL288LCwZvXvf6wWrxgnjMaDBrVhlKwXFj76MFHjz/97NadO7HkbL2eAABzg1a92W60Rv0hAdAAlpeWl9bWM/k8Mj48K/Vo/JMvPl9cXf0Ptbrr8YhlFQrzy0vLU0c4oSQmVDM0SojP+WAwLJZLkbevBsPe2dwRQUhwITnXqE4IrVUq5ycnTr9PCSEaRYQwoQIxUXi+xzxs1BrlUqnRaLhekI/Yi4uF5fXVqB3rt7uNetM0TM9xuq1OqVRqnJ/nlhfCIsoVIhrCCDBjbDTsc+bH5/Lb17ZTmezRwdFFsXR8cvZ2/6B0Ubp+6y4A8CCQgiMpsAKEFAIlpeAgZk6zQbfXa9arLd8PLWRjkXh+bjH3Z46d45dh/Oaf/uWTzz/rD/uSSytimUZUM4zQ6oP5jGLN1nUNEc65Mxw0K7Wzw6Ooafea7Ug0BoQIyf3A9RxXCEw1EolEEtlUIpE0rcis0gKuRob8LSCaml1sVMjeuWw0LGVv3llBctsdBEcXjZ6rLFt5Hmq2tLajOxJ0Wy4vipvXRDqLzqukXcODIbIMnMmpnRtiPi25T0pVqJ2ivRO6d4LqNYQACjF180aQTYm1DRG1YNiFi75qtlW9iHwPJ3sKRbCVIVZCGVSlPAkmgFIQKGAEFAGJQSFACkBCmBsFCjhAMHUQE7m0WFoQy/Pc7yLT5K5gjQH4HrSapN8l/R7pOthXKJKU80YQMSXnstLBSMebG+qLR2J7Tda78NNLOK0Q1wFnSG5sST0vl5eDTx5Atw6tC3J4gN7sUytOcgskl1LbCIGJk3m1e933UcAGqBBBNoFmFfVBlHrs7SF0+mDb0eW1na3d27nFMYQPwBXANDDCeuYEoo2dU8ODIrxXOVbTNWmmNjH7A6E5AqXU1HWK8WjQL56fu+7I91mz3ux2ugqAaiSdSW9tbd69fy+zsHhJjQ88iUCnGsZjfSPjrN/tdbrtXq/HPc8iOJnJLC0vFZZXoomUw1lsoukLJlrIsEIVjyWWFgvLi4VsMtWqNwPHG/R7vXan0+2FEC3MwwGlKCYAAhDu9nv7hwfb13btSAIAAqevaxQ0o1Ov/fjdD3tv3tRrtXDKZhLRxaVCKpe9Ug8TAFyFvWEdwPfc85PTP8Ifjvf2Tcv2fX/kDLmUmqErAMd1OJPJVOr69RsPP360vLIGcMUdO4Ro9Vr9onhRLpcBwLTMldXVe/fv7+7uKkz++PXX+jfgA5SKF+enp5Xtra2d7VQmPT39SKkUVrPvOY2PnD5XFgSD/mDQ7w16A9d1DV1PJJKFxcLq0lL0Q5zfd6ZxKptLQe7KyT/wu+12p9MeDPqMBZpOM5nM8vJyobAcjcUdn0U1IywQ8NDNblKIiscThcXC0mIhl0p3Wx3fCwa9Xr/d6XbaIUQLFa9SCDX1icBkdmMMXf0urV0/fM0SJoJZLoQb+APH7YxGMc+NmRYAMAAhuEkoACSS8WQiamq6UlIC+CPXc7xxs+Y9oey4VXj1r6TkQgmlJKHYNIxYLBZ6vYZuXoPRoNFoVIsXsVjMGTmjwdAbOUqqiBXJ5+fmF+a9wNcNY+i4Pgu4EjMazMs+nesM65Vy+eKsWipJAKpbiyvrt+7eu3X7JtGNP379jU6oK3jxonh+fLy1uenu7ALkJ5WgMQTiIMc+vAoJAM/z2u3m2dnx4fOft27eCs1mvX47YNzz3P39g59++qlarRKMIlJtbW/ubG3OLcxFTGvGgAaIrlFdIwh7vtduNDAhTIhWs9loNkfOKBKJZHO56zd2Hz1+vLK2MbsRIoIAIUKJEu/UfhFS45AOLOSw2z/a22dD5/Wr1xHbZox7gSeVxJRKpZyRw7lMpJLXr9949MmjpeXLQpHreT4PotEInUzeQX8QeD4IGcIZKZTve4N+f36xMJnZ0vNdgxoEkzBQ+2pBTUmAK8YbUkkulJQhKZ5i4gxH5ydnPxlGsVSyLAtRQgnBSDHGnJEjQVLNTKfTK6try8urhYXlTC5nRMx3KnbINNY31jY3Ng723oI4kyzotVr9ft8RMmlZa2trDx8//vzzz9a3t4lmXGnlcjUaDNvNzrDT4x4zNDOq6yuLK4XFxWgi7nJmX1UWAx6f2ucXl+cXPwxBPNfhSmFCMEKAEOe83+9XKhUJ8qJ8EYlGTE0XQiguKSISUL/TOzs7Gw4GlFDNMAilQsqAs5mk48ttpdnu1mr1ZrM1cjxNw7l8dm1zfefa9YgdqVeqzVbz9PSk4fmDfr9SLJ+enZqxSCQemxJjwjUFY4IxYkEwdEdCsFQqfn332uLyCiDy4tXrVqV6cnKyt7d/68at+eVC4Pm6Rk3L0ClGUgrGwsl7eVuEdB1nNBxNRKC6HYsmrkBh4EJQ8oEOiW5Fs9a7nV/BGGccAzZ0IzRPHvWHxbPTZ5bVrrdisZhu6JggAcoLguFoJAQYhpHOpJfXV1dWV5eWl7LZ/Kyjyt8wXQBmtwk0dujRlSKgxmXFfD5958HtWAxe/Gztvf7u6evSfAqWV0hmPhpJacmsPxoEC1mxtcE0HTebWDFJAS1mxUd3gs8eg22o40O8f6wVa+i8JLtdaWmqkFJbS3gxr7hAlToxbUmlsJJidRfNLXDOkG6haApaA/zslXZ0RC2dG4Y0TW5ooFNsaJqh6ZomNZ0hTVBNYqwoVpQh8IE6QCkQUENH6rrM5WS3RTiog1PkShh00YvnZO+tdlEx+gzrcbUwF1xbZfNZzoTquDgdQzdvwL07Egp85UT76Tk+L6OjM9Xps0qHzRe4wrLTQAaobAI3I2Qwwofn9JuflWlhheXWKlBbLq9waihdaQsW1ZCqdkf7B93XF+r0DKKR5Z2PP3n0+W82dtZnHkOAJzWJ0HMclEJIhigNoQ8RLq4OBRT2lmaGheRCgcKEGKZhWRbVNN/3mo2G4zoBY8PuYOgGCIFl993RiGCcnBniPmOB7xOqAR0XlxUA58x1RkNnOBo5gR8ghSK2nc5kMplcNBYFwAEAYkwhFDqRU6UQxiYhtmnGE4lEImnZNsGYc+6MRs5o5LqjKd9LCiElGLqhOwEmpFytfPnll61OJ5/NuMPRcOQYOrGtSKvV2n+7//r163anlU3EUpn07Xt3P/v0s+XlK3SBkF0BcpxBOnJGZ6enpYsipdSyTT8IRo6jlKKGLqXsDvpKqMXCiud561ubIUR75zXoD2rVaq1aGzEJAPm5uY3Njd0bN5Bh71y/vrqykkzEar1BvVo7OzsJ3YNmWRkzSY6XsE9KKeUlC1tK6Xm+63qj0chj0tDBNM1UIpnNZEA3ACDwAikFE2w0GLXqjVarNRwNLctMZ9LpbFbXNBEysk3bikQIAs6Y544cx3FdlzGOMLJNO5FIJBIp27YVgC84lkoi5AMQUEKBwthAYFtWMpFMJZO2bWOEBeee5ziu53jutHIhlOSzK/ov8jI+QBhCYUoexaEjnFKCS8aY7wee7xumhRkLADgPDJMiBEAt07B0bVwdch3HHTme779jthk6y1+tK+PLwh5GhCCEkAKJELIikXQ6gxTYtskYa3VapWIxm80NHbff63ueB6Ai0Wg2m5vLz/eHfcM0FCgmuZBiohCQYdjihLLTr1cq5WKx444AIDc3t7W1ff3WLd22d2/cWFtfS6VSbrNRadaPj4+vF0uOM5wtBl2qfwgKQ8oUwGg0LF4Uv//++2qlmv/mm0QiEQSsPxwKITgLzsqVV8+etzvtZDxeKCx98cWnn3322cbO9Wh83BlkimGCNU3TdZ0g5LKg0+txANfzm81GL+AAgDwXYxx6IlzugpwFLNCxPrml+D02NKaEEACuRK/XOzw8Ojs5QYTYpuFz7riuAqXphpSi1x9ICYtLBc/zNrY2xxBNglTS84JABLphKJCapoWgREmJJ+niKMwqDimqSnHOGUjmcw0opnjKeArzE8N/kLpChJIgpZIKga5rhmFgjIfD4enpyXDUN9/YQkqOlI4QoYj5/qDv+IKblr20tHzn3t2PXF83zFgyaYA5OVZdbr0LhcUbt25VqxVD1zqdVn/QG/oiADBNe3l5+dbt27fu3R8PDOnpilJCECAhhed4w+HIGbqBH2CEwjufTCUitq0QApCMSQQKEPI8HwgAJjHzl0qPnHGpVMg5FkIxoQb9Qa1WGw77AgEmYJiGZBIJgRRWCjzX6/eHnu/qlJqWFeYvS8YFf3dCC4BKuVKplHudjgBIJ+LLK6s3bt24fed+NBI5Ozlr1Br7b9+26o1ep1e6uDg7O8vNz1FDt2YgWjgNEUKcc88NMIF4IrG5tbW1e90P2NfffHNRqZ4Xi8+ePV9bXbvLfEpxIh5NpVK6aUohGGOCi9nePefM81zPcSZmKNFYPG5Y5vSaCUC73R4M3eFg0Ov1vMBFGMUsK5lKJOIxTBDnXKfUtOOxaBwAiK4pAMY5KKUbhqZR1/GrlYpg/PjoJBSKE4qBIMcNBsMBE9K0IkvLS3fu3fF83zDNWCzxPwSihbX0sFA87lQogpAd+qRKwQjRI8n4tdsP8/nddsf67ofawX7JX4KN6+L2fZpOknYjaNUDInxdh3YXu66G/CAbxbe2gy8e8Z2PAHro7Wt6VjROTmWv72Qz3o0N9ugaXp3X+g59e6o9P0KaHqyvip1V79Z9SEURwcjx9FqLnJfJ/gvaqoPnSky8aIqnc5BKkkTMSESNeETYEWGa0tKlTsHEyGCIcEQIqIFSNdUPxMCR8YzIzGPPxa/28cs91KyR4jmpNrU+UAo0b/GtVfnpA29nx9UNGPiWRsndNQVZCUIOe7LbhVoddUai57Fq1zdfAHMhGJLApQtpbN6C8xpqj/QXe4hazI5zasp0RmXSIhFD2YSKJLSg4e1/FXzzNfz8Cqxo6tNH/+l3v/vfrn10f2FpWrvnCDDBFM0YmgJIAIHCbidgPDllvk+RnUFpMxBNidAjilI6rqIR6kk1cl0ZklYQAgSuglq9fnZ+dnZ2Wq/Wl7emKE0RRAhGUyGnAikEYzy0J2Mu830puAKMia7rlmEYmqYDAKVcKYoAK8AAYaY41TDGWI3lHEIKyVjABBOSXXJJOQeQhmFE7QAjUi5V/jD8w9OnT3VN91yXM2YYRtSOMN+v1WqNZhMULC0tP/7k0adffH777r2VwpXzJSJUYiWxCiW/ju97zeZgOAh8RihifCxFnMUOveFw+9qO43xYN95sNWr1arvdDjunhcJiYWkZGTYAJHPZ+aWluVy+1hu4oC4uzivF0qDbeW+uqavZukoIRYi8irkl5yzgXAEwzkBKTJAxMXbXDX04GvW63Yuz81fPn7969eq8WFRKJVPJRCIhhXA9LxVPXr9x7e6DjzbX13SNIoKF4EEQPjTOBQOpKGBd03VN1wlFWHGl9AntkWKCADSdEkpBIcmVUEIKKcbh5hMjNyUkF1yMc8FEGLd6lQQppKRIzZKEZuHI2IpDIwQTCogijJQKmfcEYwqANU1JqWPzcqFDoQmuAgBfctd1A5/xmVJZaPKIMSGYSCGluGpdSwjVdEwIZ8z3fd/3DUPP5XKWaSJQnIlapXZ6dppIJrhQvX7XDzyNaolEJJNLZXKpeitmmiZCoKQAoS6PSFKgSWZXq90qVYrlakkAUIDV1aW1tVUrYgNAMplaKMzl8+lysxEAnJ2eXBTPe73uLIsOEAl7ixgDxmMoPxoOzi8uuv3e9z/+SAg1LAtjLKQM9RCD4bDVaLium01lbt+6+dlnX3z2+WfpwvJUnMGE1Ag1DFOjFGHgAKPRCFPq+QGbhBG5Hu90OvVqrVIuzy8uTW+mHhrUYqKkgqvWfYRgTEnoE8slDNzhyHdDEjrG4IlxU2p2fnWGg53dXXeC8gGHqVfIwLpGqTaJg5t6cV2aF2BEJoRxSikopTSFCUUYTfg5IJVSUo2TcNW7e+PYWZgSSihSKOCy2e0NnJFCyvFFKD3QEfjqMuWh0+lHk4ml5dU1z5222DBCUl1W7exYbH1z62ajxnlwcHQ4ch0xFtPokVg0n8tdkVuCEoAogOCCCcZDWQcLGGNCCKQUxVijRCfh2MdSSkBI03RM0F8wwAQAhJVSQkjOOecBAwh8zxkMfd/zAj+QgmoEpEBcKaGkBMGE4Jzq1LAsXdMpoeOEYHEFoo0ct9nuHB8dnF+cdXtdApBKJZcWF7Y3t2/duKEbER3Tw7cHiUQCAfS67dOL4snpaWF5KZKMW9EZ2okQGGOEiFQqUKBLiETswuLizvaW6znbW9tv37wd9PpPnzzLpFNK8s2tdcuOJpMJwzS5UEHghyHCs/pixvyAjUPJzIilG8bUzDIcSe7IOT06fru/f3JyWK3VPW9ICY1HI5ZpchZwEeRz2fsPPv78i9/MzS8AJkSjHg98zqlGNMN0XL83HAaMgVTDIGAAGEAD8OFykHQHvXg6sbSy4l5lXPytuWjq6paPMAr5T4oL5RNCAbAdSdgbibXtz3LzLy4uTgIoMwUR291al+bWaNARzQacX0D3FLodiWSQTaGVeb5aAIgB9LVOWy8XcbspMRLzc96Na+rBA5hPyb1j4uxBsUiwRuNxRnZgYQU2VpRpqk43EG+N0zKpN/HpKW13hAQezdJcV2bSOJWgqQRNJlQsjmwLbANMjG0gukQ6B6SUoNJDMJIwdFQsIeeXRK2ualXcqtNOB3sORCwV1yCRlGsb6s62uL7NtrZAN2HgCd/FQsLoDNgIvTlArSYSAYwc2S+xsxr4Q/A6NK6Z1zbIjevSigZ75+SbJ6pUx2/2yMqiLMzLeBRycdBNBXEO1O2V/NMqHBxCowo3b9366ME//fM//SecnPhgKR8hhRHFCCGFJ9FOakyyQxIhBfBua/+DEpJxzuP0WKnkdI1DhGCMFYBUEhNiRqIRTFzXb7WaI6FOz85fvnr15MmTfH7OiMcBwND0EPDhWQNSpRCAUkgoJGUoJlBKSawUUYqOhaaIIBTy6PCE3qkUSCm55IHkIpSWjdOALv2suBBKAiVU13WJ8XAw6LbbUkoppM+lAjAIRKwISNl3XAaQMLREMrG5uX3z+s2N9Y1I9B1bGoQJBoQkAFfApdB0rJsGpkRKqRBXTCoAQkAICHcq07IN05ji5NlXt9NqthrdTifMOMqmE/lc3rbtKbXcsq1MNosPjyRAt9NuNOqddntWuzGt5YS1tMtAcXXVyw3TablC8HEy3JU+jpTuyKlVy3t7b7/99ps3e3uO40QiEcs0u92ey3ncMP/5X/7Jtq35XNrMZHRdCz3wlEJCCMYYF0xKjpXSQz0mQgQhCRIAkcnowYAUSAmSSyG4QBQpHLp14elQECCnNtzjrXE2InMme1S9R20Zd8ExDqMYQ2UBVoCVwqG3SrjVYTxj48E5D9UvEzaGEkIKJdX782Baqpy9v5hgiilBxGeeMxx6nmfZVjabiUUiruu6rttoNi4uLtLpjG6arjNCGExbj8VjsVg0ErENQ6c0hAoKQL7PLRD+qNNqN5ut/mAAAOmYPT+Xj8Xsybnfs0wzPTGy6XS6zUaz321fVdePGaR4fNgKwSj0er3eoN8fDj2uCAJdp+FUJ4QIxgOfmYZmLCzm5ubW1teyS6uzwmQlJMKEYEIIAlACwA8CWwjbtq2I6blet9fzBVSr1Vdv3nz/3Xe2YW3ubFPDpFSbshWF+hDFHyPAOOySSwBCiWGbVNcYY8QLwl/REEg1nl+WbWqm8Y4JHCFUgSRo1n72CrCDmUzbca8AIUQJesdpT10Oudkm3eQdESCsEJKgwkFLATRdA4yE9DEXhICmYRVIb7LP6oah6zrRNExnXPDC/sbUPA8pzTaj8bgdj1NDn7gzA8EIQHHOZizBSHi0UAAyjFEOJeeguJQ81DULDooTfGXFoJSEE0RJif68GyohGAOSKkwqEgogzG81o7alJAOFMCCpgEsQEhRivu+4rpBCKimEQArIGOxewRnOyCmenx0dHhbPz0ejkUZxPJ5IJlOJREI3omH5KhKxTNMEjIeeXymXLi4uSpVK4ardsVKhPhlJIQWAUkAwMS0rls5tbm7fu3t3f29vf//g9Oz0u+++s0zDsq2obRmGRQiRCpSQIN8N0ZvVjBJCEQJ5FSQFflCpVt6+efnixfOT05Nepx34ASUEI+iPPAWwMp8aDZ3d3d25+QUA0EyTCR5wJpTClGANU4SJroECTXLFJcGg6RQJ4bDxMDNsS9d1Sum7vo9/Y4g281XDmto4JAKElIpLQScjY2Nr65PPf4NN1q5/d3Z2+MOfOqaA+3cgswYWJcVTrdUg3TbBSMWiXDPU0KPGANXLRrOGnb5Agtu2NA3kBOqijoYObQ/AjIiFeYWVNBRq1+jhgfQdadnguKrVUSBlJi0QQH6ElES6Te2ojGjIFFL53BtJTDAThucJTRFNIE2BDhJLCQJ8DgEGbKh0QugW6BGJsNKpzGVRxJKppJeIy2QcZbJscZ5nkmg0QJUaqjRps4EDB7AwMVe+D04fpUwx8tRFD9V7pN3UsW9sZfVcTnzyKV9Y4nNvcKMP9Sb0mlA5R506phtKTxOwBQzk6Wv/yz/Bjy9BiNzO9vKjh/9y987DKT5jgjEZaJRgRBBgUJNq7tjjLOQFKriSzPEBUfSHRb9ozMgJ560UXEpAiFiRaD6bt+IR5jPTMosXF4PBaP/N3rfffBuLxT56+CiezYZGGHLaCEcIAyIIYYSRAoQx1iglmFJCMEZKonDLBhJK58LjqARAGGEgoXskISFnFIECQjAm5DKOZ1wLGXvxIoQMTTd1g1CCMfaDgAcBIcTUjcB1w98RQgaePxo5w8Fw5LiGYekz/HeFgGAc5sRzAM3QFxfm09lsMp5kXHDBOWNCCM3QlZSO4ypAiwuL165fj74nUAdQ9VqtWW8M+0OppIUgnU7HYzEpRKdZS6XTlXJZgUqmkmnbbDqe57mdbrvVbg3brWgmO7VtDJUC4eMI60yzkPqSwEVIGBgXYlhMEMw6R3DOfN93PdcdOaPRYORIgNFw5HmuxyUA9H3v4uK81+0KwQghuq5RSgkhGFOMMCEII0TQWApxWfFSAoES44huigmhVNOIRjAeJzih0CNETfvIGGM0pfwQJAHEZVqiklJIIaWUXAqlQChOECXhBgsIMFKghBRCCSnHDhOglJRCci65nG0Ej3m4QoThTpggEEAQaJpGNIrxFbAkx3FnV+LqZ8wXMEJYCBkEAWfcNIyIZfOANxr1brszHAwj0djc3Hw6nRaSG4Yei8Vi8ZhtmCT0zVLqPVE9wWgsKa3Vas16vd/vCikpQDabSSTinPN2q5pKpsvFspQynUlmInZr5Egp+oN+s9l0ug07mYMrkkRQM2UrAmAYBjV0ouucc6rrlJAgCIIgkEIEnDEAHLAgCHzP810fOJtCKwQ4nFtSSQCkQHEALIFSurAwn0glQKpyuXp8cdzp9J69eB2NxhACIeWNOzcAadPbKi6xMVzKCDAAGhO/7EhkYWEhk0vF7bjHuOf7nHlSSNMwFUKO6yrAc/Nzu9d3ojM2sKAUQkhK9G6cnVRCqbBjpT5EZJRKqtkj60SE84GCbThkCEaAhRQBY0IKQ9fmctnFpaV4MgE4zNVDGqWcseGwH3Bu6PbCwuL12zeWVlZi8fg0XUCqK9nIruc1Go1iqVQqVxqt9sgZTeMwR6NhuVzavr6NtQjVqAY0AA4TbibFCGOgFIe+ZQih0BGGczGNjAtPskpJJXFoCcoY44xzzqUQhBJMsEaopuuAEB2PdKkUAAYNIJ5IFAqLC4sFOxnXo5HxyZ8zhAiRaDjonp6cnl2cd7pdGI0CP8AYEULekV/7rlO6uDg+OioVi47j2pZuWTalGucchA9EHw6HnDOqUY1qPvi1WuX05GR7d8cZOe+yTpWSSighQgWMEDwsOy0sLT188ODg4GAwcMrl4v7+QSadWpifX1xccBxPSokwhFvHlWdKsKbp2qSX6ge+EIxchbB+4LnO0BkO3dHId1x36ARSAVzi5vNqp1ouuZNwXt0wAKOAMT8IuBC6bmTSqfm5+VgsHi7UiFCi60oJZzTyuTAMc25h7sa160tLy7FYXNO0/yGmG++eQ0CqcLENRetIv5yoAMtr1n/8P/125drSV/957qc//t+Lb18NyhCjsHUPsIoM+ka3iYUn47EgnpA+R29PzWSHXByRcl0gKVMRTuNIgX54hs8vcNwm2QxaWOQbGwoH4PRR/cI8PwREFDGloYNlyWiE39gGO8oNDWkIlMAiQMoFN2CekgIrJbD09ZELIChwwEpQwqgCjQFmQCjSMJhJEUupRFIs5KXwpK6pXILMz6n5HItGBSA17ONSWX/12tg7xodnqFxF3R52Gc4lYHterM+LlbzQLRhJvdYlQlgYWckcWtp2bz1wk5sOjZH9E1wqY96jxEeyjzWGwSZA3OoR/D/+X/Cf/wDtztL61j989vjTx5/+ZuPaDAWNYIQ0QBhCfCbxuBgxPmahywongqtSzvGqdLXnPVOqQAQjAgBcMhYEvucxzpEC07LymdzG5npuYV5wmUgkQaFysVwslb//7ltdNzCmjz7+2E7Ew6NyuCohhCCsBVNKNd3QDcuOGJZJKRKc+Z7ruW4QMFPXgiAAhKTiUqrQFdbUdcHDRV4hBAQB1TTdNE3LnNpkqDFVCHMmfN83LCubzy8tLxUWF+PRqBcEo+EQKYUQ6jRbZ+fn5XKVBUGlVn/+9IVlWYFQ125eKyzNOqFLRCiZVH2ikei1a9c/++zT2zdvuUxyIaUIAh4YuokQBAETQtoRO5vNZbLZ2dvIWdBsNE5PTmvV6mAwAECRWCQRj2ua1mk2916/Nk2z1WqNen3LspKpVM+pSKF63V6pVDo/P1vRDTsSwSGgmdI7hJgUeDCarR8AUEoNwzZNmwJooVGcEG7gm5NflFJgSizLyuXmNra2FCFBEEQsSwh+dnrcdQIAsC2TEkyIRig1NN00TdMyTVPXNC2c8EJyzpgIONVo+Lw480JfaB6ApSHJRMh+QAQDxZQAwRqlGpl09MIwREI1EjI/CFFKhVarSgFjTEgWCIYZ0QECzgVnhFBLNzCMe+dKCim44IGQPOyKKiWlEFKGNj1jh7yAeVFkA6HC93nApFJhOyMWtyOJqG0bs9F4E33M+AoJIVcKD0KqMTAUnHGMIGJFcrmM4GI4HLiu12w3NdOYX1hAGEsF0Xg0m82mkmnTspRSIbKfVghnKxiB7/R7vZOj41KpNOoPCSZxiyaTSUr1Vqv16sUr3TC67c6g37et6Pxc3j+70Cl1h6PiRfH44Hh1i1hRm84s8ZKHVFQEAKalz83PLxQK8UQyGotYlsWF6La73V6n3+83Go1KueQ6Xq/TOT+/ePt2b36hsLK9RUOdGmCEcUhQCNnWIW89FottbGzs7OzourZ3cOAL9vrg+LxYxH9iFONoLD63kMvkFydYQUgevFPGCMFD6L6GEUpnMjdv3/z40aNrO7ueQIwxKYKABYahI4S9gAkubMvOz+eyuSyAkiDDQiSl5D3+ExIAYSdXAoyLyLMFWqVCHBOuJyGFH4UyqzGguwrqsCJYA4QDj7mOw7lIxmLXrl9//Pjx+tZmLJkwDF0CRRgp4XmeB4AIpoZlJ1LJTDqbzGQMY6yqkVLOvnm9Wn/54sV33377+s3rbq/DfEYBKICQolatvXjxworaC0trC4sFO2IjFZZFEcFIMzTTMkzTtC3TMHQCIBjzPdfzfC8IIgBBwENvVCmFIjoBzKXgjHme73ke8wNMsGEalmEQTLBGp1XF0B0NU5XLZLY3N2/ev7++vT1XWJQKgRDhqmhgUr0ofvnVl4ORV600XCdwPAdhrGkauco4HPYH5WLx5PioVq0yJQ1No4S6rluv149PjjHCp+cnnW5HKWWaJgyHbcc5OzstFi/6vd47zGAEEgQPBUYKwA+C0SgkIuM7d+8dHp00W53BoNfpdI4Ojvb+v+39Z5MkWXYlCN5HlKtxzpyz4CwzsgiAQqHRg2lglsqK7G/bX7Ai+2V2t2VlZhqNAqpRNEllcOIRzom5uXGq7JH9oGbmZh4eSVBZXTPTfiWLpIeFuZJHzrv33HPKZXc4rJ2djZwRJVgzDKqos09eVRTDMk3LnBKFh4ORYGyelooMU8umU8uLC5au9wcDz/clZ8Ne96B6LgAUAELVKbLXVFWllHPuOCPP8wxdX1hcevjg4fr6aiqRMC0LVBMhDBB4rssBUYI1TUvEEolUIhlPqbPtET+gdO2lE0fIhpHgAZKAFCxVhMI6EaOEqgqsrGXLa9lRW7z8cu/ty/3fyWG5CEiC54l2BwghxQKKxiCdFRLjN3vE89SzPby7J3yXx2wRzQG2aaNNdk5Vg5IHd/y7t9mtTZ8wtPeOfv01ffteOajiYSCiUba+Fty9GSyW/EqFZlM4YSEVMBvKQVe220Gzz5oO7vlk6Cuehz0fcyYlAsBcAWkIZAbEpMAIuJrUUiybFskVGTFBV7CCZdTikQyDOAMP+Ct6eGz97vfG8zfovOF1B6LhSgGk1cGpKLobZYsFUQikGsVAlfdY446qWFIoWFAJCpQr/O4NPmiA05KLORrXIRgKOBbeAP711/CLX8LTF0a5cu/Bp3/7H/6P/371VmH6xAWABIQRnaAxNO4YggvzobCr6cpsGZpH61M2+sxRgwDGnEvP913PCxgjFMWjscrCwq07dxaWlziXkUh0OBg1643zweDZsxeqqidjiVKxuBa7NR3o0y9VqGIZdjQajUQimq4JKfuDYeP8vFY967TbmWwOwAyNGiWQ6SEeOOv3+o1Go9VoDPp9JrilGFbEjsRi9oSvIIQgGCMEfuA7jq/qejaXffzpp5988kk2mx05Tq/bCYFVrVp78ez5kydPd/f2z6pnX/GvuORU09PZ9CxEk0LimUliWdbm5ubf//3fL65ufVvZX0gQaML881z35Ph4f3f39OR0OBphjCmlLAjq9fqrV6+OT04QQiPHaTab/X4XI6xRjDEeOsPz+vnB4YEdjytqUdMMfNVrCksYF/MWY8MwbMuyLUvXFITQaOTUm81a7SyRzQFgQkgkGg2YX1lcFACpdPp2ve4Mh0HgNZtNStCrN280VYvEYoqmUUqBarppRSIR27ZVVeVCjIajVqvZbDX6/V4ql6UA4fsKNe8oxgBYMt7v9xuNZqPZ6A+6nDNNNyzTtG3b1K1p1hONGe3j0UooVjUt3ExVVQWgEpCmaIQQSikXCsaYYjJXCRV8nGuTgBAQijVN1TVV0zQ8uTBCwv9Aq9lstVqj4QCkVADsSCyeiNtRS50Rw5Nhf9/08SI8+3hDtpKQSArJucAIm7qeiCeFELWzWmjVSujp0dGRoqqu65qmlU5nU8mkqqjMZ57jcRbSnUIgOE0Zqq7TOz05fvf+/cnxieM4CqUKVQSX9fr5y5cvDw4PACHX8zrdTrfXI0SxTYsi5Lhu9fRs+9073TILlQpV9GmRjgsuuZBSIgDTtPKFwt379zbW10vlsm3bjuvWarVGvd5sNHZ2d18813bf73T7vZ3dvefPXmSyec3Q86Ui0Q0AUCgRUjDms4BxKTGArqnZbHZrc/PTx49Ny4zF49Xz2va7XQawf1qzn35drJTW1lenEA0TijGW86kuKUNeoAhJfslE/M7NO//w9/9QXFz9TtwaOZNsGLeuo5m0wfiXifFH0VyudKpCO1MQHSekQ/7AZXUvTAjBgP2Aua7LeGBH7Y319b/62c8+/eyxEUt+L06QMjmleO7o3fb2H7786quvvjpv9zQC8XgMCcE93/O9/f1d1VA85j/6xLNjEdMylUmFl1BsGHosGrOjEVVVBeeDUdBotRrNVr/fDztw1PDgEZYdEQEAzliz2ayfN5rNxnA41HU9m80Uc3nbMgEAqSrGKJSxCclw8Xi8srR07969B48fXxK+B4DbG1vtdvvLz78KgsAF4TmelJIQguaTVaNBr147q52edjodH4ALMRgO9vcPqK4fnZyAkLXa2d773U6nE142A+i0W+1ms9frXkJLIe0ATYlijtfptEO9sUyx+PDho+OT08PD/X63e35+/n77vee6p9XqaDCklBqGoajK7CZIKTUM07DGLRTDYb/X7Qx7c/7I0Vh0eXFRQWRpYXE0coaDQafbaTXOj48PWeCdNrqZuBmNRKYGYgqllFAuhOu6vu/HotGFxYXHnz3+6Y9/XFxe/V5S8fCDSteGEtFyxj4olEoIj/gAwKWQQeBKUClRQ670nQf3fvIXf4P9HnN+//sv6622MOxB4Aer69GYjZNRoAr0XDhpy50DvvMGTnaw8CFXEqUSxLLQbILKCQ5oPiKXMuzWCkKaMGyOGW714aSlt1t4GATxxKDZZrUTKTwU9LFWQZmixBmR4SJT57WaJFXqNaHnkGEPeSMRCMkwZwgowjYgITFHUo44H7KYy2O2rOQhm1aGA3KwR44ORDYllpcBITiuyrc7yrsddTSU5ay3ucZbHgwHSLPxwnJQXOBrC5zoorRI0hkWN4N3O7jVQ8+30e/+QH9MQUWwUgTrJyA5z0eoZch2x935V3h9CL/5Cur1RLFw7+H9nzx6fG/19sSIE1jgMURVicNc1ThTL9FMO4BAgBGgqREpusTnuSTBMu0ZnOFtYIppqDfGhQCEDF1Pp9OLS4t37txe37zhc04w2X2/hykFgPqgv7Oz8+bt243N9VKxbCSiITFkes4ghEaisVw+n0ynFFUdjpzByEm+e7+4uLKyurq5ObcszqQZaKPZeL+z/W7n3dl5zQ9YStcT8UQikUhN6oCc83CJ5VyEzq+xWHR9fe3TTz9NZ3JDZ9TvdyWXIES31VYUtdXqnlbPar2uUz2NxOJrm9XJmWxGzgEuLLR0Xc/lct+Kzy5fOYDruicnx3t7e9XqqTMaSimDIDg7rweMnRyfYII4H+OMZqvVare5kIQi1/Nq52eHh4e5fCGZyWraVXo56LLcPlWpHbEj0WgkFjNN03GdZruzv7+/826nUCjF0lkAoKqazRejEbtQLo8GI88dnZ2e7u3vPH/+Yn9XUxWqKEqY0wqHgRGJJeOJWDSiqtTzgvN6Y3d3b29nZ3VlZWV9fQYdKjNSsfS8fr79/u3bd9vVs6rHRdIwk6lkKpNMpNPTdj+QHM3wp3RdT03+NPyRqZvTIu+lGkQozY/oWDoNIVAVxTKsaDyWTCQsy5xJUakAAN7g6Pjo4PCg1WkxITQKsVg0lohFo1F9RkcKfUjYRJfk1RAey4UIjJGua/F4HADi8biiab7nndVqO7s7mBBFVTRVs/JmLpO1LIsxxhhDk0xNWHGa6S/zT6snO7u7pycno5GDAPzAr9ZqXuAfnZ4ijDjnXAgmg36r1+v0JOdE0zzXrVZP9/Z207lMPJOZivphhCf4DBEA3dDjyfhCpXLz1s3NjU3NNB3Ha7XqnVa72Wql0mnfc5vN9tlZtdFoHh0fn1ary+1OMpMydAMAKKLjWjYXIEEFSMTipVJpY3Pjzp3bpm0jhJ6/fp2Mf3He6QPAWfVse3v7+dNn6XSmVF4Ktf1UTZsVsh/npiYACWNsmlaxWPxu+CzkOxNAEKrbj4mMF/qcYWs6BikIAMbkUqP6NIs2J0kwQ1a7nEWTkiCCMJITwquhG9l8dn1t7bvjs7BfcnoZvu+9evXqyZOvX716dd7uAUC5XCqXy5Lz8+pZu9k8ODwceY7HeSKVXr2xmYP8TCcTMWw7k8vGolFC6NAZDgEOjo5WTk663c5cHmsmxc6CYH9v7/mzZ2/fvet0OqlU6t6d28anWq5cGrdHISSE4AETQhBMdF2NRaPpdOZDfAYAYBnRaFRVVYSREBCyYvGMT8akQ7nfabU77VZIyx85zunp6cj39o+P7JgNHPq9XqfZ6rQ7vYn1kx/4Q2fU7XadUd8wIxdUOUwwRgql6pgBzEd9x3NcLaIDwOaNrfU3bwqFwv7u3mAwOK1WBYhmozEa9AnGuq4rikYInY5AQrCma5qhKxNpnn6/X6/XwXNh0lZZrixEIvZiuRIwiTHxh72329tfffXlea0qOYQzy9CMaWNNeIkgBGOcC6HqaiqVXFlZKS6vwQ8d3weiSQmSgxSAMJJkQu/Wx6Q0kAg4RlKjZNZgdWUt8n/5v//d0rL91e9yr5//y/beu3wB7tz3Ht93b64YcRX32mT3RDR6rNvhxzX1pGHoVM2qbibP1rd84arrKcYGeLmCKwklZnHIOWtJvhANmEb6CLsvdc/DUnE7XfKmL14HOB1XHjzA9EdB5SaHmLAjQhBRHyJeg14Lddqc+SCRDIj0pcQISUIIVRkgx3UGNRbts2RConUFGD3aV//xPyuv3vBsVv7kMyeXh5fb6M0uavYgnxM/+xG/f9fxdeI1g1YAtgrFjIikZC7FNzb4YpmZRAzb/ptd5Xe/B5WqTs+6uRzELX/5HhhJAAPJOvzq9/Cf/xW+egmdUam88Mm9R3/xyWeP79xdmCNIECoh9HgBNDFFR2hM1R4vMgIDloBnm+XkBQVt0rz0UYgGYdsVBUQAIUwUwzaTqdRCeWFjY3Nl8yYAGw2GxVIhFovX+z0A6Pd6h4cHz589iyUSy+tr+XJxZteTgLAZsYulUjaXMy3bkyAB3u28rywubt3YcIYj/Ur5LhkcHO49ff7s9ZvXZ622ChCPR3O5bD6fj0xkcn3OpJQIo5DdIiVompZIxPP5PFAtpum2bYMETEilvNBsNF88f2noeshWGY0GrudcEsGSCCSSaMKtwAQj9G+ZS6PR6OT0dGd35+zk1HEcjBDjrNFqdnpdTSHBeEFEhCq+63mBAAyYYMfzarXzo6OjUmVhYXllmiyUUnIhKCF44kkzL6xoxBOJdDaTy+WOkkm/dt5strbfvi8VX5UqlfvpC3cB3YrmrfHKWyzkB8O+EKLbHwxGgQ3Y8zzf8ybuSzidSSeT6UgkggA8CTvvd95WFjY2Nu7cv6vY1lUd/P7e4c6TZ09evHp+1u1RgFQ6WShVyuVKLBKb8DyCIGB8oouGJFY13bas77zqcMBYIUoIKCnGCqWartmGMeXXz8ZJtfbm7dv3u7vNZgsjHI3FM9lcNpOJx5Oqqs0VF8jFPiovVf4RIIIpJqGQg5TSNIxEPKFqar1ei0WjAqDZ7qK324BQLptLxOLZTKZULseisW6nDQIwhjCfxHw/mHE1cFz39KS693735PR05Dhhq0ej0ej0upp+JgTnjEuEBIjA8SQHS9OEVJ2RWz2t7u7slcrlpbX12bVBSgkCwrYJRVF13bBsK5lMWIk0AEQ007C1VDpTGI4oVU6OT99s79TPG57v94fOYDh0PIdNpG5R2FUtQQiBAOsKSqaTxXy+XK7kSmVQtOX14ebGxvrmZv/rrz2fg5THh0dffP4FVbSHj5wbN29ThWJEEAaQ4qLgiNDEGi2E4B8cOL5DjOfkJeyHEKGKomrgORrCiqJiPFVmnHnTU7nICT8MzVKq0YzOLh73TJFxA1SoAB62yHz3fVJihEJatu/5L1+9/NVvf/PV11+eVE8UBEtL5ceffra8suIOhq+eP385HJ00WoP9Y0U31jd2Go3z1eX1GRULgijk8vl0JmVaRjiMThqNw8PDWu3cG42uvIB2s/ni+bN/+qd/+uqrrzqdzuLqsqKQrc0bs0xLxgLGWBAERMNhAnLatPvBuuaMhkMAoapq4DoIERAgBdCZM44/6DWbjW6nPZqcfiVCnV6v1W3DPsEqBZDCZyzgiMNU+wZhPByN6o36ycnx6vpGWI6glFKFYEypquoqBYIAYyYupHKjifji0sJCZXEn9bbVaA6Hg/MadDtt13FUzdRVTdNUQi7EsTEhlmXEE8lkVG32fFXVBoPBweHBm+23m7duo0m2PhZPxuLJmdIKf/7sab/bbbS7PgDigAme7hEgwgYYTAgiFFOiEKJgjOFPEN83iyZAyPBQhCYjetywEv6DwkQzAiGFQJiCpsCN+8XK4t9hVdk5Gb077g2hVtkARevHokxTIQlo6Itizy/nZDUDTk8VkoBCAgCMZSwWRJaJ4qFcEqcsBASBCaYpTAvuDv0Xh/yogYcjkkphy0JuGzeruNdAiYTc2OAVEKAJSAm1AxyLXg/Vz1m/jzQd7IgUFFwfSSC6TgyTUgGuS86buDNCmQycLqDRAH/9RP2f/lH58mu5uMgU3d/y+MEpOjiFZl+ur/HPHrKf/w8MMgwC4Cewe4RO68pZH1tRUiyxmzE+aA3fvmUHh2q7Tt+/JZW0kouKwho1ygxSHHyveyi39+Hz5/B2L1Oo3L3/8Of/8A8/vnV3hdomgAeAABQJgBCW416jSY0zTAKEdEopJq1DeEqin5Y/L2HsbzqtYoQQllIGnAnJESaWaSaS8VQy7CyjhXJpaXV1bX2102n2B8MgCA4PD778ysSUMsENU48l05eIbplcJpfPpzNpnRCH804QvN3efvX69dbNG5+VCh/m+Xbev3v6/Nmz58/f7+4wAFMhqVS6VCzlC4XZMyJnTAjBAhYuglIITdWAapNM3KTSr5JsvhCJRMikcBB2rV8+9XIZ+L7njbuyA89r1BsHu28XVza/11zq9bvV0+P9/b3Ts9OAMcs0dWJwzkOPYUQYF4ISqqnUMEzfC0K676DfPz4+icVilcWlwWCQnlj3hPacYU/AVFh4urWoqhpPJsqVcqlc3tnZPa+dNxqtd9vvU6l0oZAv5LK5heUr4c5gMKjX681mkwMEQSBCp6PJM0kkEtlsNpXJGKbuD93zYf/NmzdLK8trm+ufXuUptPNu++nTJ18/fbKzdyAANIqz2WxloVyqXJhqe57nej5n4yVWCOE4TrNZL5UXvtvejCdaWxgBcCGCIHBGTr83aLU6lhmddT7otptPnz37+unTN29eV2s1IXgsFi+Xy+VyJZVKz0O0cVsGCDktw13aaBlnPhOO4zHGqKLE4zHLtlOpjGlZjAUcoNrsqHt7uqYXcvlcLp/P50zLbLWaHvMCPwhbjLkQs0Ou1xucVqsHRwe1szPfDwxNUzVVlYJQSiiVE6UQAZwrqmRCIwoC6A26/klg2ObS2kq/37/0TscEspCAiAATQmfILpSadtS0o4l+r5/JZk3DBIS8wHe8kRd4XhBcMubgnAeMM84JYNMwo7GYFbFB0QAgnclubG5+8ugRZ8Hp6anruMfHJ4ILLiQlJJlOl0rlibadnCX6h8MsnLyDwbBaPTs93i+Wl75vNeiqklCoTwxcSiEnehrwjQnScUUUycsGnSAlcM7CwjRCSAo5ckdntfOd3b1EJmtG4t96mZyzKQsTAGrnta//8Iff/vo3T79+Wm914xFjc2Pz8ePHW1tb3U5HBKxWq500Wh7AabX67t2799vvVpaXM+nijCIEUMtKpNOJZMIkuMuFADg6PNx5v/Pu3fvi4iLAHPdceO7LZ8+/+Pzz3/z6V9V6AwDo8VG/359ttJBSMJ8FgR9wIL7ned5wNOp2u+1mIzEpVkxlnU9PT1vNZrg84rBRnHMAwDOFzpOT49PT42ar4fseAbApSadSWKEjZ+TygHOBESJUMXTTUHTuB91uz/M9KaHT7RwdHe3s7qYy6UQ8AwAaVQghAJJLIVEo4CQ5n2tozxUKmxubp8dHe+/f+77baDbbzUY/kHHKSSjYIRBjPGyl0jQtlc4sLS2eHp2Ig0POefX09MWrF8l0EmO8ceMm4CtEa53hsN1s1s8b7uSJkQljO+zEYgEHKTEiSKLA99ut1tHRUalczhYrf0aIhgDhsDcnrA6hi3IBmRppoDEG9X0vUFWKVR0A7ET0zsNP3x91A42Our8/rb/5/CsYdZxyFhIx1U6h26aw45DJ+K9fOkdV6QLfOYShryRsmVZYKS5UC2uqABSMC1M6SBn4TsBGzCZ8sSC3lpHviNoxU4UsZqWlMmAMQACSnkStIRxW4aAqAcmljCguck0HZ0A4R7Yp4nFgDLlUQV3W6qk7eywWl5Ylv3oiX7/HbcB5rqqmZ9hcYOgO0XlLdvucUn+s0K4AWYKiK//wiu4fqrVa8LeKjGd5OQObFXayjEe+WMqTfIon4yiSpqCI4amovWO//xz+8Jy4bKmyfPfew88+/dHjW3fWqJ0AkABDxiUCkJiiOQLaxDMdje2PxlhtLFWHJ7UAgO9TEkdjbQIRcOZ5vuf5AWcIY6oo0+xuKp29c+9evXoW+P722+1Ws/lu532312NBYFpmNpebgWgX1adsPrewuFSpLGzv7wHA/t7+l19+GYvHPO6VFlcmbmyIMz4adn77u999/vnn73bejwQAgGXb2UKuUCzni8WZUhELWMCCwPN8AHAdP2AMX6UNDQCGbqqqOn0OoX4pvuT2w7njOs5E5GzYG+2+3/2XX/zybr3lMcE4lyLwPV/BGIcGUEgqqqqZpmnZpVwpnoyHELDTaZ/VasdHJ43eUEOQzWVLpVIqk4nH4kHAOfeF4JSoqqKoGJ3XG4cnx8cnJ41Gq9frU4yXl1enJYCZXCSa1Q8LtyiMsaKoyURqbX3tYP8gmXyBAHwpDk5PrBcv7YiNETz65KEWSWi6phAJSBFCcGf45Okfvv76q729vUZjToltClDMWCxfKFQWFgr5fHdnHwD29/e++OJzO2oO3WFpeUVRNYoEl9R3vWG/8Ztf/ea3v/vd2zfbYe9TLJEslkqlcjlsTZ+UMwLPd4MgwGHbnRC1s+oXv/+9aRqey4KAceY5bqBpCsLI8dzACzRNS6UyhXw2Fo8jRBSEJRecMS55wKHT658en7x984Yo9OTwOJFIBIgIxiSI1y9ffPXVF1988cWb7Tddh2sA8UR8dW1t68bNTC4fEuC4EHicWZlRNpHiEpGI8cDzPAbQ7w0c1yWKGk8mk4lkInFMqTpyxomxVrPBGItErFwum0ommJCu7w2Gg+Fo5DMppEBIzpZu2+12tVo9OTmp9QYaQCqVLJZKqWwmmUqF2tNSMASEg6QIGuf1Zq12dlI9q9eDbpdqykb1pNvrzK7IQrCABZ5gHMDzfB5wIYHQKxZ2VdOpQsIZJKX0fC/wA8a5mINTMghCDS6uhGwgggLBQQaAFKrZ65tbP+20fXcQBMH22+2+1280WgAkl80ura4WcjkcIubZ3jIumM9Cg1Qv4O1We/vNu3/+xS9u3rrle5yxQHDmB56maIBxEARCCkIU07YSsUQikTQty9CNMOWJKZlHVJIHgR/4AOCA9Dz30hkMheJEV4tHTUQJ5vtDA8YCxkIJIiah0+nt7O3//osvWv1+LBpVNVUKLJEEzqQUCFMpped5PAh03Uil0/liMTNzmDnY3X358sXTJ0/3Dk4AQFO0Uqm0tbV1//693mDkD53jo8Pj4+PaYNTuDt6+efvFF18m04kHDx6l0xmKL04UyWS8XK5UFivd3QMAOK2eff3k60Qy4TN/eXVDoSoAl4hK5m+/fvuP//SPv/31b0J8BgD5XDZfyE0FisMOd855SBTBDDzfdQPPcd2R6yYAfN+XAEhIDECkdD3PDVsXfT8AGZ49MMbK9GgknN29vb39g/Na1XNck+LKYmVjdT2WjDMhQgM0hBDBYKi6TtRet7O7s7d3sOc47snJ0du3b4vl4vLycgjRVFVHCHPGHdd1PIYx+EFw6fyUy2bv3Lvb73exFNvbb89OTrtcAMC0CYlx5jpDOxIFANO2V9Y2es1G67zVbDcPTpvD7XccASDpuF61Wi2WK4ZlabqOhQxA+r7fOjr89b/++u32drPZnOOcTCay7/vM96XgBBBwGAyGx4dHT77+gzMaJTMZwzJBIISwBM6DgBIquHD9QEipaWYuny0vLkRs+9LC/kMYQCEEiIwlWpCYeCJPGDmSjBM7SIIUCEtFlRjzaUJldaP0f/i//ofKnfLTL3K7X6P/9J9ef5WAzS349EfiwV11bUlZ2+B3bognq/5vv+Sfv8Jv3qPnb0ksItZL/PENr1DGUpOAJ9PvGLbfyr1tr3vqLFTEZon/zU+FGmPdOsLDIBqRubSAQEJHgpCdATppoO1j/O6IJNJyPSJKqyJpS6cFgYsjURHLBIEkSIe+T70DcdqU7CsmEd/eDfqOGtXQnXvw8KFcX4N6GwyLeUCqNbZ/xP+yBTBJjjo9+vyF/puvtHJWUZD82QOPEr6+gLmQVOXLy8HGFiysEBTRqw382y9Gn/8CXj4D3y2trf3l7Ud/ee/Te7furtCIfcH5GdcHxulVNCa6yonvFgMkIVTGBzKua0qQ48/Lq1wG0EzxAV1aswSSEgTnXArBBUghJcZciKHnRcZtLNqDh4+AMyFE4HmtRt0FOKyfq0+eFkvF1fX1hcqCMfYwvlgW0+nMjRs3jw6OWMD2T45GIF68fB4Idlo7rSyvRCM2wcT1gk6306hX3719v7d/0O30AMCkpLSwsLC8Ul6uROOp2WY7Ed6yRGMmGUcfyw9ywTHGdL7JGS4VWqTgnIuJzI/revt7+0Hgv3j+TEhgggETIAWlmpRyOBw6vqdqRiabWVlauXnn9s2trUQmLZnfbXXarXan0wl7ZAu54uPHP3706afr6xue7zMWSOFjrKuaYqjk6dNnv/zlLwf9frXeCgK+f7B3cnrSbjcv0XDQtE491zqAAeFIJLaxZh3vHz+tPIlEo+3BUACcnp58+eWXrWbj1ZvXuVwhFk9oOvW9oNPuNJv1nZ2d/f39g4ODYEKkpcr4zDoll+WLxY2Nzf07+85weHpWH7LgxfPnjjPaOzhYXl9Lp7K6obme16g3a9WjV6/evN/Z6fZ6ABDV1ZWVleWV1WKlbOgzWpRCMJ9jjG2N9DyuKEr1+PQX//k/vd95hxDhAQ8CjwVCUWnAWKvdHoyGqXjywYOHf/nTn969cxdpRMGEMwYAlCgCoDdy94/37SdPGs2WZdmqrvsBd11nNBoeHx2eVo/29/a7Dg/ltYrl0tbWxs3bN2w7FT5LxrmCx0ol40d6Zd5FopDX7AZ+EAhV0ZPJjBGPJZMpTVPZxfIqTVNPptO5bC6WTHb7fc/3h47j+4EEUIiiGYY6IRhy4TbOG41Go93phMIeuVzu08efPH78o/UbWz6XnHPBHEINhLGmklfPXvz6v/yX4XC0W68DwHnjvN5odDrdmRRjqLcyHv9cCM6lkLMqwDCLlf2ACxnOHwlhQ6wUaFbnUyCJZJixD4UXuZAj1xsO+lYkCQCLy6sKhmbtfO/g6PmLVwAQAByfHO+8f//u9etsOl0oFgzTvMhkAwgpuBhPUQHQ7/bfbW+PBv2nXz+VQgQBYzyQAjRVE1IOR0M/CDRVzWZzq+vrm5tb5dJCrpDVDJ0QrEhl/s6EHJtmg5jkyGftpxAgwPKiswpN2zonzJ3LVDQU8CBgjGCs6RrFpD8Y7e7sKQrd2dsnCgkzeVgCcCERwpiwIGi3O6PRMJlOffLok7/+d387hWjn1eq79+/23r8/PTwKfxKJRLPZfLFUzpYWswBsNDg8PqjVz4MXL1qOf3h49OXnn9sRSyHag0cPU4kLukIsEV+/sfng9BMf4d2dPUfCy9ev/MA7Pj1ZXVuPxxKqpnAmup3Wu+3t3//u89c7O+Ff3Fxb/qu//usHDx5kc5lZiIYQJYQqABiF/adSShnWiFVV5YIjAZiSUAOMEAKAxTj5CJgQTVM1bfyKqyfVvb29vb3d83qdS5lPp+7cuv2jn/50fWPdiFiIEoRUkBJjrigalXJvZ+83/+VXjjN4+27n5OjUtCOLy0vVWm1tYx2DQjWdEMxYEHh+AIAFAJKUktncZCKVunfvnmDMHY2qtdPRJA9MKKWUIgQsYM5oZNoRjFAkGtvYumkqqN5ovdvf3T1tOhJevXkHUjxgCggAADtVSURBVHa7/ZevXuZy+XQ2HYlGgfFOf9A4r53s7r1/v3N0dOy63mRkYDljze4zFjBOMdU1Q1FUf+geHRyplB7uHyiaTggJ9QXHrCNKA9dttjvuyI0nE48+/eRv/+7vNjc3ZiHaJQ7lHwHR8ISgPlbhQjO823BdkAhEOBPGpVnmSimRYuo63LuVXbj17ywTtQ+bX73q7x4e1x3AcRxNy3ic6xmZi4q/0jlCqOfqzY5y0CKuI5NxPgImVZAUgAO0AQJ49QZev0Yn+8zvjSIKLJXZzbsC8hJYAHUAByAAcAA4+Ag6fWh28VmLnnWoNIUjQWAhiRAIC4kwkqrKTJMvYsQJwio+OkS7R9Bu8ZOaYFysLJP79+HhI8hW4LwhVxbE21fQaZPnL+m7X/vrfwNgAYzgzbb65Knyuy+VSh5tLStbSzyXhM0NlC0I2+CZLLdi4DN0fICevIV//iV88SvoNbJbGw8f/+Qv/v0//GzpxgJAyGh0J2qP6AMZH3khVDvu8pQToiiangrlXLlxTodjVtdxzgBqrDQlASGMCcGAMZJCuL7X6XbtWC88kViW9ejRo06jdXJ8fHBwOKyfA8DZee39+/dvXr8uFosbmxuqZc0eouOx+PrmRr/Xp4DMJ8rJyVG3P3zy5Em1dlYoFZOJpKoqo5FTr9fPqtVury8l0nUjkUjm8/nbt2+vbqzn8sW5YSgAIQwYE0KBcQzAJfgz3fjSd5GqT6tsCCFd18cNFJgKIfm8/TYCwAhCSUwFIPCD6mm1Wq0SghGGkOOvEEXT9ICJTrczGA503VhaWXYGo0g0UsznYzG7Xq81GvXhYBgwDgCxWLyysHD/wYO//e/+u2Qy9eFkSqZTjUb9zatXsLMPAL2h3263mo0WDxhRKEzl0RHMEtHCktxUVgdTuri4tL6+vr+zyznr9fpc8IPDg5Pq8evXrwrFfCqV1jTdcZz6+flZ7azX64f85emKFm7ws3mUZCq1tr7RajQRF29evTmrVtuDwddPnh6eHC+8flUolQzTdFynenp2fHTUaLaklIZp5aPRxYXFu/furq5vZDO5S1pTEgATapkWBkdXtXaz+eUXvRcvXimKIoQMAh8BwpQ6jnNWq/WGbiGTEYFYX1m9eeOmomkYMHCJEFI0BSvgBFCr1ajyplZvEEy4lEHAhoNhp9MeDPpcBr7vKwCGQdfWVzc2N1fW1u1IasLuEUIIifA3d1FJwJig8NAcFr2oqhimGWZ2TcNQYSyyqqqqZUWSiWQqnYpGIkPHEVIwFnDOw1ZTXdOnmkznZ+dntbNur+sHAQBEI3a5Ur5/78Hf/vt/n5wf5GEUcvlus/X+7bb67r0PMHLcXq/XbDeHTtcyYuP2WKIQOq45SQFciICzYGY6cB5IKaXgfuAJ4AghQrAQQkjpex4PQrW5mRYYRDChmEAoweUFQX8w6HTHEA1jXF5ev3Hz5rOXL3K5N0fVcwBwXOfw+Pjli5eRaFRwli8VYvH0LI4iCIWZZgLgDt2j/aPT46NQ/oExxjnHiCiKxhnv9Lqu5xqGsbC0NByNNFWL2JFkKqEZOgJEQhbNvF4BvmAshLc1r2UL+ArtqI+8fCkkZ1xIjinVdV3RVNdxq9WqH/iauct4IATHUmIAzAEhQlXN8dzT02rXGRXTaU3RPv3sR9Nve/vm1dtXr6qnp77nAYAOaKGykM8X4skxrXZ1Y/3+/ftn1bOh43jb2wM3ePP6TSwez6Sz5XJlFqJZ0ejaxvpgNMCEGFQ5ODro9pyvn7w4rZ6VX73KpbOGYfi+X280Do+ODk/OAEDF6NbNmz/7m5//9c9/fv/+w/S0QUdwLiRRqKKqqkYxjAWPxAx9kGAyfWyKohKiIATjxmSMMSWKqmpjT3H/8PD48PDw8PC42+0SgjKZ7NbNGz/5yU/uP3xAzciHD3l5cWnQ6b16/ertux1HwMnxydHxUa1W6w+GMTsOGBFCQAIXPJQnQJhQVZlKYY9P/rnsnbt3a9WTV69emq9ed30+XtAIAYyE4L7v+Z6n6zoCpOvG2tatO3cPnr18sbt3dN7ucoDDo6Nev28YRjKRyGSzkWhUcN7ttE+OT2rVM2fkKqqiG6YzHAYAgBDjF44pknOMkEoUXdVVQkej0XntzA88bVdhjEspCaEUE4QIpoSoynA4PD2t9kbDXCqDMX74ySdzZRzGLiml/Rsh2qwLLRrva2jKhwrLnxNxBwxjcXkpWBAwplMCSAOABMD9O/fOf3SOPGX/4CkXR+/edbEcNo7EzVVYLoMRgcf3QVFQJkXfH2Cfs0JJVkoQjQJSADwiPdzroJ09Ua0Rz5O6ESQSkE5xSAsAARQgPunT8xF4kiFgvpCAuFRcprU6/OAA2ba0Feg1qAxwPoUWhrJU4am4jN4WqSh/ooo/tFHjHNcHiAIkY7JclNmSBA1ubYj7N+TOC9Rpam/f2P/xf/F+3EByWca67F9+r7x6h5yAey5HGKIJHF8n8SUEXcl96btwdgDbZ/JVbfRqH/b34oqxduvu3UeffXL/s0+XbixPka4vEA73EIkuRGenzZtjxuu0FSBMXo7PzTMQLXz8lyHaXEoUzWWbBBcSSUIUw9BN0zQMg1IKgFzXdRw3hGhh39/a+tqtW7eODo8G/UHTHUmA02r16dNn0VhMYlhcWo7Gp3ZVYFrW0tIyxkSj1DT1F8+e7x7sNrv93YPjWu08EokolDqe2++GiQ9IRiPFUml5aXlz68bNmzfWNjdS6TnDb0IooYQqVNN1GHjaxNl3ssiCYBwRPil9St0wIpGorej9wEUEe77fGw5mv1AhRFc10zRJr6dTigFcx3U9x/c9hBHnTARcpZpmmJyxZqftgKTdbiQaGQ76zmg06PebzfrJ8XG9fj4ajVRKJOPlcmVxaXlxaelKfAYAxWKpUCgVisVMzKp3hwoB13EajcbJyWllsRICaDyzIc0q4IcdfOGf5AuFBw8e+J6fzWX29g5rtbPz81qrNzhvdo8O9+1oTDcMycVoOBy5nmma2WxWValx3mh1WoSQMFHEZzbpSDS+vLIKUpiGEYvEXr96tbu7e97rH9Wb7U5z7+BQ03SPeb12d+AxAEhFo5XFhdXl1Zu3bt64eWtzayM5X+8mmBCsqIpm6RbBRFHUgPFev8e50DQNEAjBMSEYo9HI7Y08AKjV661W03UcEUINKTEgRVF0wzQs0+2M3CDodLtewKWAgDPf813H7fe6HEQ0YmXSmVg8ViqXbty4+cnjx6VyZR58oYmk/EVK+UOmL1UUzTCg19c1VdU0ShWgGAAM04glEqlMclRvhX0bpmnGYvFUMhmx7U6vF9oSUEo14KZp6LoxRRGnp6e12nm/N8AI6QClUnlpaWV5eeVKfAYA+VK5UlkoFcu5ZOqo1aRUGTnueb1+Uq1urMQAQAhQFNXQdUNRncCnKg19MtiMqCkXQgqBASmaYpmWZdu6YTijkes4g15/0B/4rj/LyieUKqqiagaApFSRCDhjYTFxGovLK/fvPzxvNOjXT+r1BqbktFZ9+uy5oqmapqm6NgfRECgqtQxDa7cVQgEhZzT0fCdgASVYcM6EpJgQovmB1x0NAwC90zFNs9NuD4fDwPen2hiXgTVCVFU1zRh5DgZQFAVjejX8mm9wRzOL5GUdHSFAgqoopmlZlsV85vtep9NBva4bBJz7SEiMgHBEKVV103G9rjMCgNNGo98bTDnjteOjp19//erFi/p5XVGUtG6urq3cv39/ZXk5MmmcVKz4zbt3Tk5Oa41Grd4c1s6bnf7+/sHu3u7J6cnG5taU/GRFossrK6HbtKJqmmm833nf6g2Pq41GvZGIRlTN8H232xuMAhHOyq0bW48/++yvfvazhw8flUqlqTaQ7/lcAlEURdc03cAgFKqSi5Ty5SeGJApbZRVKBQuorqqaGhoqAMBoOKxWq0fHx7WzM8cXUdvIZbPLy6ubG5tX4jMASBYrlYWFbDZn2daoP2x3B+e1Wr1+3u8PYnYcAIiiEIWqVFEBiAKKolCFTBPDnHFCCQDky6Xl1dXVldX379723u9JAFVTEQk51VhKxGedLoi2vrHx45/+hesHL1+8PK/VPNc9Oa0xABX2oxHLsEyVUs7YaDh0fd+yrEwmo1DFOK81Gy1EaUjRnOxBRFVVw9ANw9A0beSMXM/rdrsYg+cFknOMCUEYECEKpbo6Go46oyEAnDXr7Qmx70OeyQ8A0UJDDBSetSa09VAdSl6cUcI/IqHMPSZEQXy2tLRQSP3d3/38/lblxfON7Te/PT159pt/OX6iDdeX8OOH+MefoOyS+vOC+uC2cnomO0OECIrbkI6DphFgSr9HD09RrS48H9lxlEyJXEnqUQGBBAoQADQAXACOASOgnArQCJgKsi1KsdrriNevZauBeADdloIxrmT5vVogfVb8hFVW+FqBa4CbJ+TdWyqB6ICjGjdo6LUH0YL89IY8vg2vXiqtOv3Fr61Xu1ItCYN7z9+iZtfXEawvsdUlXlgASGEADDGB9rSjI/jD1+5vnsmXp9CXkM2sfvLz/+GzB3+zdmd5cSU7rQwGQEPzDnQBhS+zmCdt53TiDYLH+OyiPQ1B6BAcWm+G/3q5jWrOKBEJwIBUqkdj8VyuCIAT8VgymTRNQ1EIUeYuI53Jbm5tddptTdUOT46c4YAJvn+8H30RM2O2FYnOQjRN04vlYjKRilq2bZmRWCQaj77b3a03m77ntlptQhBnnEnQMURiscrCwo1bNx/cf/jJp59urG9aESsSnZvqiqKYhhVPJnLFHDvjqWwumUqomiYlR4ggDFhTYEJNM0wzmUoXS6VSpVqvn0dsGyHkDIej3sCMjmvKlmlmM5lysYikVKkaj8WoQvzAZwELvVk45wpRNcPgTCia2hsMLNssFArpbNa2bT9gjfN27bze6/UoJblcTjftG7durq6vp1KZj80mJlgqmVxdXa2fne0fnqoq1k170BtUq1XTNmPxmEKVSynPKT4TQgAgEuqyxqMPH3+aSedWV9eePXn24uVzRaEnx8cD1+/7st/oGKRjWpZpWrlCaXFhcWFpSSF4/+BgZ3fHc11NNTClsx37qqqVywupVCIRS0QjsWg8FonE3+++bzRbjuuc11vTXdLSlHgiubi0sLm1dffOvUcPHq6ur0cTMcuw55tPdduOJmKpUXrgM0YVEjDWH40454qmhCY2lGKEiTtyaL0xGA5z2Xw6lVJVNeQ4SyFVRYvGEtlcvtVpa1ZbwYodiWqqLrjkjDGd26YVidqEkGQyUarkl1dWb96+sbF5c31tLZ3Nz1a+CKbjDPLMgRMjOuvBRSmJJeKFQk4KnojHMtmMaephVUzXjGKxuL6x1fdfuI6bSqVjiUQikUyk0qphRJqdaDSWTKZyubzPglQ6a0ciGBEA2Wm3Gs3WYDAgGCdTKVszbm3d2ljfSGcyH9dv4OlUan1jvXZe096/lwqhqtofDKtnZ8VC2TZsQBCJRDPpTKFYUNvtTDYbT8QNy5hq3COECSGYaghBOpnMZHOlUumwUGg1GghT1wvckcNmGk51XY9EoslMJpPLYYSSqXQsGjd1U5sX28wVCo8+fQwYZ9LZ19vb1Vp1OBidnJ5G3yXyxVJpYWF+wtJkPJEvFEBKhSixaAxjcHyHBQFWCIwVXhEhNPACc9j3fWZGzVw2m0gkLMMglAK6BK2m0jNaPJEolArs9CQRiaazmUgsconVECLycQphouM9U1bAlzAaJUQ3jGgsks1mBoORZVoSSU3XJYJAsNAiE3MgIBVFMwzL8315IlqDQS4WS6aT0QnH6N279+/fvqudnUkpSsVSoVi4/+D+jz778er6+tQODgAW11a37tzePzk9Oq32h8OABRLksD9q11u16nk6laYKRRiZlqVpeiyZ0HVd1XTLtC3bev/ufb1x7jOot/oE+hyAA5gqLeSLt2/fenD/0cOHj27fu1epLMwex7kQmBDLspOpVCaXIxhSmXQ0GlMNffakMm2kQAgMXUskE5lsLmB+Kp2ORqOGaQJWwg7lwXA4HAykFKauZHO50kKlXK5E0ulvwBLJZLK8UKksLA3fvpGYBEwOh64zGneD6qoWj8Wy+VyhfY4ITSWTum5OxfZmi/iFYnnr1u3z2hmier/XjsVikWjMsGxd0wlRp17VYVSWKn/9859nMtlnN549e/Lk3bvt48OTruP5AI3+kPSHEUNPJuLlxYV4PJHJpBOpJPPY4cHB8cGuZUVVVYcJzVGh1LbtRDKRSqc73S5RKcbIss3QZk2Ej04gIaVCFdXQPM9Bx7I9HOSS6UQypc9KK804/v3xEE2G3YNh18AEPUyKbmM7IhKeVGfaogWhBIQUEAguqKKpAKtrudW13OpG6l9/gf/1F/JwX99pto9Ogu7AI9L5a0XYS0F8Q8RXEPgcfAls4tPXJ86AHtdw7Vz6XCQzMpUUhYpQNAF9CRygBf02AMeGhqkGoCLKpIrB1MDSkKFixvCoo7UYcgPZHVBFlZYK3S7nIxZXPaMEBoLNpvh9WlF1QoBoBBQhenVRfScLtwC43FrmP3kkFAFv9pT9E/z2RJi73LCQ73lLpaCYYj/7Ebu5BmCNTyK8Cm/eKy9fWc9eWm/edo87LFqorK48/Lu/+5u//qu/BGPS+AaBBMIBh5n5y45NckpthnldOjTTxTnbv4TmHFW/tXEAAaVKLBqrlMr9rW42m4lGrIWFhUQiYZqmpswNKc00F5eWgiCIJxKHR0fn9Xq72wGCRq7b7fcuHbgBgGBqRejmjRuUYMO0EslUtlg8PDputZqe74GEsBYZtSPJVLJYKW3euPHg/sOHn3w6lWaYlv8AQDeMdCa9tLQ0HA6ypXwskVxYWYrYESFEWExBM6wFw7KKxdLa5qYbsPN6zYxEMtkcVpW+M5xCNNu2F5aWbt+9k8lkMCIR29Y0JZRQlFIyxjhjBBNN04WQ/f5g5Lq6qS0uLW9ubWVzeVVVvMCXEllWZGFhwbYj8WT63r17KyurpmW5I1c39Yn82sXMGPSHdjS6ubkphVhYPOVSptIZwzI9z3VGTiQSATqXM5gtTEspASTjkhICAMl4KvkwlU5nIlbUsqxEPHZUKLRajXa7EwSBoeuJZDKbLSwtLW5sbCwuLkopC+/exWLxVrtVLJVi8QRVFZB80nECiqIoSvLG7TuUKqZhJhOZYrl8cnpSq9U6gx5njFIasSOZTDqbz1YWFtbWN27fvn339l07Fpt2BU67aHXDzOfyK6trlmlywYlCBUg/CBBCRCEEI0wwwQgT4vtBt90ZuV4ynty6cSOdTo5bVRC2IpF8obC6vk412u33KaKGYStURRKE4FxIDAhhRBWSSMRK5eLG1ubtu3cWF5emlidCTsQDMZqdJFMBjtkRa1pmpbxw6/adXC4fi0ZWV1Yi0agQAhOgmlJcWLj/6BGmdDAalEuVSnkhkUyphgmUWradyWRXV1Ydz2OCr69tJFNpTEnA/cFwyIWMRCOVhaVoJJaOJ+7dvru6vGJHosxz6ViiSUoppjYSg/4wEktsbm55fpDKZB3mJ7MZ07T8gA9dxzZsQCSZSC0vrXWa3c6gly0Vy4sLyURCm+wBCAGetJxEIrFSsbS+vtHrDurnNduy48mEpmlypiVFN/RcPreyuqYgihBaXlrK5wvxWMzQ5/RNNMNcX1vXw6FVyL/dfnd8eiIYUEUJAiHmfTpNyyxXKrdu3cpmswomth2hFDPBAWR4pBrPDoRYwB3XYUIYppHL5VbXNnKFgm3ZlF69T5mmWVlcuHP3bjabiURj65sb2WxO1cxL+x+6KqUm51sHpp/WNT0ejxdLxX5/aBrWcDjCBGm6jigJm11ASuBAQKqqauhmwIOV2nK90Uin05tbW7FEAgCY53V7PQEQTySiiUQun19bW7t79+7tW7dDR4rZLo7K4tLW1lar2dZ1w/HcTDabSqUB4X6vF4/GKQnVLTCh2LJj6xtbIJGmGfFEPJ8rHB0ftlpN13WlkCCFqpvZbG59fePe3Xt37t5dX98olMpzdgtMAiDTtDK53MrqOlVUgmF5cSlfKESiMfWq50wUmkgml1dWvCBgnJeXK/lCwZwgUS6krmvpTGZ5ddXzvXKpvL6+mclkZ9okRcB8AFCoOs1EWHZkaXnl7r17hm15QVAqlyK2PR32hmnmioWNzU2iECB4eXUlnkhc6ToaiyfW1jdGg4EZiTQaNUVVKwuL2WwuEo2rmoEVIi5WXEG16NbN2/lCvlQupVOpVDL1Pr3baLRcZ+S6HkhIJOILlcry6nK5VMwWcrZl9bq9TDadTMQxJtlsVp2gf1VVE4lEsVzp9AdUUwajgapQ27Y1TZvSizgHIQQhWNM0xlhrtdnrD+KJxNaNrVg0dnmI/lDuAjMJ0AlDFWGY61tGcjL6JyADAwppAsx3PGwAnrS+5yobt+53ugPNR0v7B1V3VD+pHf36N3u9tntrFRaWIVHUIIkgFgI/DACg8uCIVDv0pIEHPo8mgoWKLOeEQSUfAGKI+ZiF/obTKyWAKEgALISKRUrHSxW8XMFY4SPfV9SgkGAbC2xrw8+WAXQAAKopHsUjjHyQEoM7QHvb8C8a2jqBhSLEI+zRfQcrSJhs+IZUW4ACMHW5tQgrRb65ENzeYosFEOdwuAf1Y9h/D0cHqNXQOyyVKK0Zy7Hyyspnj396996dKT4DgMBjkiCMZ0RUxw9QytCI74LTPUZmUqK5VQZdto9F39LEOVs9JIZlZbL5rU0vGokMBz3T0HP5bK5QtCNRShUYU0oFIUQ3jEKpqBlGNp9bOa81W+16o+EGXtSO5XJ53TCu/H2qri0tL1OqJNOJytLi2Vmt1Wr5rs8lJ4SaphmJROKJWCKZLJZKa+vrs9JZkotpa7lp28VK5W4QpHLp3nBoWmZlYSGbyUxG+TjXFP6raZmlSoUJkc7nOp22omq5fL5QzIdM2DFbLh6/cfOmruvdbhdJqes6pQRjQimWQgSch4VFqlApked5fsBURU1n0/liKZlIaJoeBE6aZTe3bsQTCc8L4vF4ZWlxsbxs2xEhhDtyACPEpQA5lrEnCABnslkEMpVOd9otxpmimelUNhaPKaoyj8ZghkKAMMYhRAvTadMTWGmhHPiBZmiVxfL5+Xm302512r7rqqoajcVSqWy5XFpaWsrlMkKIVCqdyea7nVYilVpcWLIsWyDAAFKKabZVN8yl1VVFUdPZ7PLaynm9Xj+vt3tdHgRUUaLRaDqdTqaSyXSqVCwtLy1P8dklFbeIHV1dW6OUdDtdKQRRiAQQUoajGIXGCQgpqsIZdxzX831TNyqVhWw+T6kKAEQlyVRyZW1NNdTFlcWh4xAgmmpgTMbKgBJC30BFIaZlZrLphYWFyuLSdEtgLACEMEJX7NcTi6rZn8STyZs3b5mm2R8MTF1bKFdy2bxEGABUTVtaWfmp5xULhaHnpOLp9Y2NdCYLlAKAZdnlUuXBw0/ShTwXolgqFStlzdAlACEklU5vbm0lEinm+fFIdHFhcXFxMRKNciFE4AqJuORSCAx0LB6GcDKT3tjcsmKxldX1UeCqppnMpOKJBMZEgKSEZnOFO/cfRGIx13ftRLy0UC7kC8bFHLzoBSBUzecL9+/esy27024rql4uFouVsmEaMy/LXllZE0IsL6xQBJlsurK4nMlkDUMPp5bgHCHAlEaTqRVNMwwjFk+UKovVatUZuYl4fGlxMRKZS3vHE4kbN2+Ztt3v9QjGuqaFtHSEJgRsPPboZVxyzoSUqqJEIpFMNpfJ5eLJ2FTV/VLRMhaP37h101DVXqdt2HaxVF5cWbZsc3ZVHEO0D1zUx97AM+TdsOZj2ZFsNg8gI1a8s97xPY9QTBQVETxpMpBIIASgUKwqqgDZ7/V63b5pW3fu3gl1DaWU8UTixq3b6Uxa0bRcPl+pVJZXlkvFgm7YQnDGAgAUQs9MNrd16wYmdGVl2fF9y7KyuXw+X9B0DZPLw9WwIssrK4qqpTKpxeWl87OzZqvlOE4o7qMbRjqTWVxY2ljdWFhayObyQKYrCaCQmU5ILBZbWVkBBCurKwggl81WyuV0JqPq2oewVTeN4kL50ePHxXKZg0imkstra7GJqqWmauVK5dEnn+RzOQGQTqW2NrYyk7x1aO/m+B5IodEAEFU0TcE4kUrduHVb0bTVjQ3X9zLZ7PLqimmYkzNzZHlllXOxuLqMEBQr5XwhTy8M5calJIywFbWXVpcpwfl8ttVpSEDxRGppeSWZShqGTknYbCCF4AhJjDEAjieyt24rhOJkKr2+ddJpdxzHGTmuZDwSjRQLhXKlUirm4qmEqmmD3iCTzS8tLnMuFpaWI5MlDhElm8lt3tgyI5Hl1RXX9zWF6LquKiogGbZgCI4kCISQqqicidFoOHI80zRWVlYSqeSlzfcbIBqS3yiWNdccB6FUs0SAscRkOlfQmB01EYEY9x2iy05tXDBOKIYZqN4Z9k+rzZOj85ODg6OdtwdvP2/s/RaCRiYFW3fgwSPl1m01t8QgwcaQg8PBr9T/8Z/13z+loxFbyvv3N4Nbq3yxJLMZkBoIKTkHEIAlUJDIlALJ9/vwP/+T8f/9j/q7t3o6QX72E/jJj4JcLuDCx9iJ2iKblMUcwCKAQsEhv/pn8v/4f+H/6R9Jq0orUXqjAKmYo1mj8iL77FP49C6OxtTjOv39M/T5c3xaxSbFCyV0f4s/uukuLTGwhezy12/h11/Bi2ewfwh+EM0U1yprW7mlteTCjfLS6nKutLhYnH24XHCBQ4lGhMPdYAyyhBRCCCalDKUfp2p7Y3OUSe15Ro5x/Gph4rUu0UXnwcwmimBGPI0FzHP9Yb87HA6DwFMIMS3TiER01aCailDY0iJDDUnJue97vu+ORsPRyBs5oyBghNJoLJpMpicdxVc4HHjeaDTo93uD/mDoua7gUkoghFCVqqqqaKqqqJZtRWNxOrNrCi4wweH3ccZGg+Fg2B85I9/3CaWWbSVicdOyQ/tnCTKsnmCMme87I2/kDkfOKGwd0HTdiFiRSNScHBWY6/X6/cFwEPgMYYExxjLcP2Bshz0uIxMJIALOJWCMNd0wTVNTVYSB88B1Pcd1fc8TAum6ZkVsy7SJQjEgIfncDJQSU8wD4fuu73uu5zLX4VJIwKqia7pp2qamqiEUm0K0i2TAZMaGlYjZb/bdoNfrDkYD13V8z/U8lwUMY6ypqmroUTti2xHTNABgMBr2uwPX81RVDZX3KVEmcqNzs9Zxhu5oNBw6zmg0Grqh8C/GRNc03TQ0XVd13TKNSCQ6m64fY8fwfQVBr9sfDQaMMZAABEsEUvAJyuRSAsWYKhgwYj4PggAhbFlWIpE0LBsQgADfdYfeYDQcuL7DhZQCU6ygmVNJCF4Bg6JQw9AjEYtQfZaQOybC449YboSK8JP54Ppup9UZDgeBH1BCLNOMRmJWNBL+ttFw0O12+t1uwISu63Y0Gqrahv2ig/6g1+sNHReQMC0zGo9bliUQOKPRsDcYOSPfD4gETVMjhm1ZhqIaSEESA+ehZZQct2liAlyKgHmuMxw5rusEnAHBVFN107QjtqFoQnKv7/S6vdFwwARXNc2wddMwTcuiRLkQl5hAVXc4ajeb3V6P+T6i1LCsWCRqRWzd0MNh7jE26PZ6/b7vugRA1w07ahuaoWgaphiEFFIgQGgiD+u77qA/6Pa6/cHQZ0zFNBq1E8lkLB6fjiPfdbrdwWg0CIKATKlCIFB47Lw40GOJkOSCS4kRUhTFMAxVMzRDVakKE296OSP1NHRGvUZj0OuzgFFVNWzTjEQsy9JUjYeQBBBIieXc/BNhxklOnG/RtHkEAYDwA8/zPHfkDN0g8LiQmGCMCZAQ4YSKauHyLMPjEmN+4PtEUeLxeDqdAUwFC84b5+1m2/M8VVVM247aVjQao6oOAJKzsNVu2qXY73e67c5gMOScY0x0Tbdt27QtwzTDvv5LA9Z1R8PBcDgYjAYDx/EYZ6HLFVWJoRuxSCwajdmRCCKzUzK8Z44Q5pwNh4P+YOB7HmCkq7ptmoqhq4ZKEA1zLtMHJhgb9Hrdfs9xHCmlqqmWbUfiUUM1AYAzv91udzptZzACLHXDiMfiyVia6Gp4qucgAs64YBRRjBClKkHAPL/X7vS63b4zZEJohh6Nx1OJlKFrYQ5y0O31B/2RP0IYmaYZiyUjEylsIeWkfw4BQOB7w8FwOOj53pBLUFXdtiOmHVVVDTCSYRZNCjS/sg36rVarOxoMXJ9xzljgcwmaopghA9EydUNTFNVnvtNzev2e4MIy7VQqpU0OAO5wOBqMHG/k+p7gghDAhGAEUsiJbcVkz5U41LLhghFC7EgkmUqpmjq7/vwwEE2Mm5QlkghJhKdPab7bcPp9087vCxgfFmgAHJCIUhVgepmdfvXV02e//s+/+vX/8s/bb15y3llYow8em/cfyBtrzuYyMysACkAH3v5B/affKi92FAz8xhK7v8HW8iIZlYqJQEOgIgkguZS+QEJgAwSC7X38H/9/2v/4/1b33qnLC/T//Pf47//7YGnR43Iogdkm0AiAAaATCOj5Hvn//JL8P/9n/OXXWA3I7QJaTUqv7x3XPSPq/+yv4P/2f4K1BwAYdvfh+SuoniLk0XwCbi7D+jqDjAQPTrbhv/wWfvkv6MlTo9lNxtL5e5+t/+Tf3bv/08drtz6Jocg0OwRuAJICxpJMqP8hHgj7m9GE8st9KSVCFBOKMZ0+zulChGb3Kzn3QmB2uKDLMrbfUUk/ZDQi9EEF9mOdJWOHKjTmmkwymn9UyG/91UKM7RclCMAAiJKPEyslCEn+NJLQH4owzXX2f7eHLuVEiRNN4oobFqEFECUEyA9wL1NY+M3mvj/Q+/pTBxMCJj4akwaMS+DsUmIZoT/dGEDf+JREuMaG7sEIYUDfxgwG/E0PeFYf8VtS6mFXJ/5mUoyQs08MXTT4f4wWI9ClpqQ/7gnKmZa1K/y75reqsQvTxMUTzd1HqDYi5USwe0pNxD/MeBXfUMOQIMdALzxXfAenhUnOXAKEEmP43zCpw4mAEJCPrxISgE/WbfzHT28Z6jsAl0IIAVLisMUR/QBrKfpuHxYzeqLhU0QI/dlXpe8V36PQiaZ9hBIAeNgriMJVQiKYnwYSSXmhAjF9TEhK4EzwwBcKKNoFDzQeKdy87Q7awainKNHNZqNK7MZxs+v+4Xxnlz3NwEoJIllIYeh3/HyCmzdZLAJbK2K1ItSoBBymrTEQgjBGnAMDkAIk8ABcB4ZD6HbRGUfkmGzvQOmlPGtJjwEHSEZwKaXEbXApeC56vidfvEP1uqYjslZBf/WIbeWDk6pwn+OuSwe+ZEhATIICKzZYOhxnZPcskD7Uz2EwAqRAZwj7x7Cza41YOVlYTlcWiwu5m58WN28tr21sXuAzAO75bOhiRUW6ghDBs4kwJCXgmTWWjs0bkADgM5SzWaGfSWVjpvP2h91owrMnwhhh9I1LlJiS4WRY1mIcUYK/D4ZgjDPGKcVhXGBO/NF1UU67kCaOL+jjVV4hJQLgUhL0J5yxciaVMXtc+c7oZ25JkTOL41R5lfmBkAJpGvnjIJqctAELIZngFBNKvwemZpwzziev69vf158e5nHOGech1QNPFeZg5pQycb4aH3sn4/XjxsbfeDVSfNPOhr7tQDNRMkQA335s/tYPTebg9DdL9PFLmHTmy2/yPkMIJn7kIWjA3/SV8gd6//Nk3JkGdQHyY4hqmnuemXHzRN0Z57sfPITg4Sn66kEZpuHkGMZyERCifBs+Axl6JwtJFES/+zQXkoOEKS5B8M3rNrpAVjPv8CNjOpSj++gr4AIQmqQaQi05AYDCJNjHpsmcMMRVK/zFyJcgpcQYfZe1d3JmkJwLjGFWYu3ftAt+pzzFnwWioclNCwksBGGAKAIMEs+htHB9RkKClCAkSCQlRhgjgiRWCMJIl4CpmEurxOPZe5/aufzaj89HJ6e7p9Xn1dNnxyfi5bMOFZCNweICbC1CNkVLCXl31S+UsFVGEEcACJiEEYCHAVTgWAghpYsAYQaOI0cD4fvI9QmAchLgX/6G11qSGKjt6hKLxTS5XVEXs0Djnk/83To/Piasr2QN4+Ea/w9/Edze5HunEiXx9pERyQBgDyQHkKCKXAbAAdmH3XPYO4DjOrRH4HKgqhKJLC/efPw4/9N88WahEE+UjXxWi6jxOZ4gUokOQgFOJUYCIYJCzwsU5jLEGP4CxqEtMwhAY4mTSfPsGJ+hKf9V4vFhE008usar8x81psYMACmllFgK9PGEmLjwDpmAJgSYUvQ9T08IE0LhwpB4IjL6sTkspBhnC7/D+ssvjg7oT53rmWYyxzWn74wI54DCRHRjslWNUz4YY6qrIIFg8sde5ORojzFS8PdOoSGExoTfOR/rP/bZfsd2l6tHEKaT7r1xj4Cc+bqw+Wl215bjSqMkHzGr+HZ250cG0zfdBZpkxMeHiwl95Bt/G/8WxCjn07ff8i7HGBWNM3PfPCLluKEJfct6MSkG/ADzS8xUBqaV7W/41rkBONm5Jo9lbNEx/TFC36ec8B0GLMIfu2kxt1J/p6PaRF8XYYrx971KjLBEY1tSDJd4ER+DwfOHQQnAZzu+Z+/zG14smmmVDZGhhNBs+KNni2k6B33zEJhWZdB3W9NgvFsiQJSSP7IyIMdaCei/WiLu+8FJNLlAQFICG3cDXBys5goFctwEygUINJZQI6GHJ4YLhXwgIBFD2Adk5PJWLp8BgP7w9vOn6c8/V9oddrgP7fP6MQ7aTRSM9NtbIh4dRg1uaRwYQA9AAgQAHoCPfMk4UIw5lRJjCRgUAFOFTEJWSvK8KYYgOz3/9Vs+4HA+pJii8zzFfSoHPFEQPOpzBhEzWM6JpCI+2eIPbnr6TeduHs48hRlIV8V5S5bfCDslgUO3C/0uDIZQa8HLPXi2C+cdSrTI0tLCo6U7tz/98ScP/93q2uKMixqTIDkgxAFzQECwqgrCBRGTZRVdjP9JZj/UX5yMLTaGbkDCyY4uHxg+XB3Qdxt6H5So5XTtCtsbwwKilCBFiBjHnxJcCgGhaAyiiE47HsbV2lB8F02qOJOU6lzqX0xulYT2PON5/uFUkEJCeDybnGWEBC6lAMBjubeZzJOcqpSMp2mYLZAzg5XPpB/hwsds7qQk5yrD4x1USClAYgAsx6fJca/MzF+W375JX3KjQbMb0OyCIi8yBJNKJABCY6XHcVp/OhguqjsXMH4ujzd5MJcq4JN3hWZ/Y4hdEMyUW+XFX4Wx0SXgq/ZNzscpIoQumpDlFWkCOQMX0MV6M/7vaeFi/E0XZbY5vWY5blhC0/GDLhDZd+B0hDfLOQ8pU9+QpLmMoeXMSX/2qcNche7iGme1DueGx/wrlxdk05A1IGY+HIpSIjmD69BFffPiOq6sFc18ZPpSQ7vfMJ0vheRCCiExRuE/3w/KTCouvgwtACRBgC+m9Pgh4os81ySlOZ1f4agVIUntqskzIc/M/EZ0oRn4kfsNjyHhbBczRR6YshLlzDCUkxmHLsQk5eUGLTkze1G4fEnJ5cWKjiY9pHNq5JNu/KsLo3KmVj2dd1JKLkQoOzpe6RDMjbPpdaF5uXJ0abkBmJvB4+d/BTcpHGEYzSTuQU64z3yuknjFFoQuVpXJsj4jey9RSKCCuec5nr5CApcgJGBAUw7Q3MHjAoDPVfXHxaZL831uLZXy0slXTmrjCJHwSkPL1xDoXsK2U0+LmaVl7tdfml4f/J8/GUSb4eYSieaXADS3JqCLa0UYKBofvdCFH4EI10IhuAQcICrJjHxwxFI3b9wcjTzm26a5Uj9t+KNBROs74J912uLw7LzXst4DJUAwEAU0DSwNsMqoyTWDWqZUNQ46gIIMA69IPBoiIdjakui2gEiBKXRd3HQ1RSPLGXl3ka9XvGSOCxtGDNYWWL/uRim/teHrqQFgAQQsW1iG6HeCZ89FdQ80BQSAL4AzcLzowI3p0WhhMRcpJMxIfGUld/vO0uad+6s3FuefIOGMeZwjgTVE8Xjxk3TSZjG/qs4IN43RsAQgs8v2VUcONP+3v+t4GO/DUogxDAcEGOGQrjGtuIUn6FCuXEohJEJC+EEo+IgRxgQIzNA55SwSC4toImw7mUr2SZCCCyFBAiaIhJZE6JKtwkzyY6wMxmTInwEpMJYhqeRDunvI/GCChVUoPO5wHiuNTUp7XAgmORYcpgrC0xS6GGf1J/+OZVi9mXSKCYSQDJ1oJJcgQAACisl4Xs/P7XnoOA4hBIDAgBFgRNA3H3Y/nomRMmwskQyEFCBmWqspBokxReN1NmTiMM4EYEyoQhC+cucNzdtFaEwkGADGF09GhJpTOLQouFiHr3hfXAgmJIDA09k/3p4xYAEy5GCJcEBgjAlGCFES0rEm+VshpZBByIiaEf2BC/AWficWiIQknxBsoktVnA9XbfTBT0KUBhgLITCGcNUeK2xJKYTgnId/BIDDhiw8Zj1JKSVn4+0ZMCYET2XtwrvgnAMHgoEggsh4zF49SEJKFw/VjgQAiMkwJxd7thCMCyZDrichoXEYuopzI4WUko3nOAgIm4vHfKzJsORSci4BCcFgfPCBkLF5aReWIEFIIbkUU4dTDASRWRGB8JEFLJCMMwQEYYQxHtdhwyc0IeKFnIgw6YKxCAF/CKamO8qlkpwMZzcL9fMwIpgQmN9PP7YKzpzE5OyTmszJyUWFsvvj/XisuS9BTFYJCgBCsPDIhwmheDwdhBCcB0IIgSEc1GgKdCd1x5m7GE/e8azAGI+nJIJ5DBSWmEXorCrE2I9RztYvMMaEEByedWG+oiBnnhvj43WYUjwZL3gyIeRMXlhKLgUfuyzhMFmA6OSkFq45468CwGQ8V9AlUDBXSQ0974VgIDkIDBgTTCbDJpwmkjMmAgCJMCH0ai7u+FXJsBM6NFYlKGyQRBfEafTBGUwIIZgQ40cmwlcAUmJCCFEIGXedc8FAAMaAMA4HNsz02gvOJRJCIAFMXuQtMYZJt3CYxMIhDh9nqCkhBOPvnsz7Hu0Cs0dViUL3ocnU+ZD/dIFsZ7E5HucxpiqcE4UahAHNZ1MFyHq9Xq91261Oq97pdRv95km3e9IfHPb6O07/xB80pAsahogNiTTkc5DKQSYLyRSkk5BMgBYBsBRQFPAUaMHxMZzX2LAnZQAcyIgZrjA1DWViQSU1yCdcHOegc5DYc/GoTxhDmsoN1Qs4nNXh9b7ybhednPi9JowGMHKACdB0iNjxTHYpkV6xkutW8oYRLdqRaDxpp+JGIZeKx2If1uNCOEJC/00cVoRhsvHM1ymmiXg0uxfJD2DcPBdtTkj7u1WKpjScsWTF5K/OpKTkhLwzO/nGL3Jyng0XVTz+K+Oi3GwbqYS50820bXJCgEAzJxYkAea2L3mxb8F8M9j06Hx5HssLc0t5qaYxSaPJ6ekZ5IdHn9mKyaU/miTMpgTNSV4KTR8burLUhWYZM7N+NbNnXvSxXKe8nPiahcAXXb4gLxkTAszkFyaPZZw0Q1f64siLeXopMSPRzCEUXTwAmKumyPFZWM4d8K8uEEp5Ka0zl42cGTlXKczID9I36CoANj8V5GwucDISPrjZmSeI5p7dVOl29lrnXuvFn6JZI69JFmJ2E7ni0aApDpIwmxiTV1zNxY18ULW7vDlezJ759My07jE7di6oeugKft5VVwezH5VTqvtkfs1+jbz8HuWln1xMarj4wrmnddHzPHuhlx/lZQffqwbOBy8P5qUl5exT/ZC0fpF5m+S1xEU7tpwBmGh+UIYePHD5IV6ioF7O18k5e1E0szZJmD1Oj6vm6MrT+ExX/weZNnRF3l5evraZZQ+kvHKyXMHul5fIglLOLSToYmaGLObxV34E01zsHxNB94u1DF3I716F0mBs0zLzjiXMnt5hft+Ylhfk5YEirxIlhUt1KDlvwvingWg/HDXnyrv65kse9Jv7uzvb2+9fbO+82d4+2j9qnp7xXtvEfjzKMzlZKKFCiRdyLJX2U0lIJiAWgUhEsUwKiADnwmGuEwQeSAYCVC5VwIaqYctwqT4CPQB1IsAmJXjSH0KjDWc1aDahN1C6PavZUqpVcXLKqjWv2ea+sCwrWcgX1jc3b92+eevuva1b99K5zLcmq66oklzHdVzHdVzHdVzHdfzbC51/Otw2LoMxJjiAUKmG5unPdiS1vkWBGAGNITVjR+rNdNfv9Ci4huqbRg/0Qc/r8Xqr2etqJwNNEZoCqhoYaqDh0F4PsAg1fwGQD8hHeEAV0AhQBBQBwiAQICyAgMAw9KDegdo5dPo6iISiJjGKJZKWVHQjRjMjIkjUtqLpbHp5pbKytba8tnIVPpOcM875tCAyo74EHzvfX8d1XMd1XMd1XMd/4/FnyKLBXNPIDI1ZhlRwAJAYkSvxSm/Yb7e7nVZ/MHAGfe72WeCzwOsPnNPh6MQdHPd6h6P+mTOqO04vcB3BBXBAApAYl+xRyOElk3ogAiqBSkACRGhBioHqoFtAVWBAuYxjmrTNXCpZSsQLkVheM/JESRDV1kxL1zXD1CIxOx6PJVMRXbv6doWY9KBMsqVXPI5ZFup1gu06ruM6ruM6ruMaov2vBKJdbgmZCutcNCyRmT+e+N5LaLfZ2dlh9XSndrJ3fHJwfnbSPK+1Wo1hb+QMHXfoBQEPfBH4gQQRivMjwiRyOXAugQhdkXHELc4lEw5gR9HAjljRqGVFrUQyGYunEolcNlfO5yrF0mK5spjN5cwYveq+pODiSp3Rb6hvfoz7ch3XcR3XcR3XcR3/zcafsdA55aShDwWFJm0XXHImOEcUERKadIUo7eKTBEE6STVrWbMU046asWwyu9putDrtntN3h47vjbzA554vPZ9JiSjFmAiicolcLhwuJeIRImPAbS64EI5ELlWEYRiRiBmNGal0NB6LRqKxVCKTyeRy+WKpkqYf0RoUnDHGheAIIYWqY+bstKcZ5DX2uo7ruI7ruI7ruI7vEn+WLJqUUxUcKWfkXT5oxQvlsqQEJDHCmOKPCSv6ACPHcZzRyHECN/Ad3/f8IOA8kNznXEIgkOBcIhT2uRMqhAwk+FKCkApIA6QiJQD3EQoQ5gqlioIVjWq6pmqqplBdMwzNtGzL0L9BI1SExiJorhFyKhx3uTVsBq7+V1XDu47ruI7ruI7ruI5riHYlRJMzrd9XQ7QJSps2bIfCHBPTNUASsAQsJsJVBCT5Yz0gv889TNhz81qScyDyClWFj0C067iO67iO67iO67iO2fhzdnSij8C3CZq5ADVTvSI5tp8S4X8QpqGOI8ZA0H81fCa4YEJwwSWACM1lMMEIKZe0bC6bNF8js+u4juu4juu4juv4jjDpz5VFm6GhoRlP6HmfHTSjHjfviDpjQ3mVqPyf/Ab4uAI7lUHFY5OmWSHO6/zZdVzHdVzHdVzHdfzb4s+YRUMXvh7f9KELIfgLKzaAy8Zk4gK+XXwIwUe+fsKFm/UZROjCV28eKc5+yQR7XRgJfhfsdY3PruM6ruM6ruM6ruN/KxDtAm59v5AfuiGFiTUkBQCXIvQWDM3LLlweBQBgEEIiBBxCawkRmg5OPY0RSCqFAESlkDh04EMABE9czNEMaoMPnUauvJ9rZHYd13Ed13Ed13Ed3xsh/Xl00b5JJGyKbMYobPw/H9rwgQDwAThIAFAAMEgMAEIiOW98OLELG2fO0MQ7EiD0aRaABEICJAhJQso/mrUrm7ELlDP5uys99cZmpQh97Da/ywO/RnXXcR3XcR3XcR3/jQf9X9sFXQFO5h2uL1JXaJJFmzdsRWNb9wsUemFMHUK0sXssnoFofGxKL/EliCa/H1i67g+4juu4juu4juu4jv89QrR5Ntks3pnDP6GemgQKwOc/LENcJeeoaiHFbLY6iS7Al0QyVMpAECqahVjuqquatUWQMONdP3MN17DsOq7jOq7jOq7jOv7Y+PMUOr8DPptDafICFI0/ghBIJAWIGUQU8s6mzZ+TyiaSaGzIOUVmGGSYbIMLPIfGrQNo2jQwuQR0AfVCt3cxqZmOfy1CAChMvyH0EXHdGXD57U5Q1+m367iO67iO67iO/8bjfxtZNIRmSGkT0CYBSUSmP0CXvyT09xQzRDY8IabNgzAJ45YBNJ+Lu3QR4x+HfuxifAUXGA0A0HUK7Tqu4zqu4zqu4zr+9wrRvh+ak3NQaqb4OEVpF5/6CO6CSwah3/oLJYC4yKJdaHvI6/F0HddxHddxHddxHT9I/P8ByRinNR8k6WkAAAAASUVORK5CYII=';
  let logoPromise = null;
  function loadLogo() {
    if (!logoPromise) {
      logoPromise = new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        setTimeout(() => res(null), 3000);
        im.src = LOGO_SRC;
      });
    }
    return logoPromise;
  }
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  load();
})();
