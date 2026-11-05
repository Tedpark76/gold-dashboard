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
  function drawPrices(cv, r, W, dpr) {
    const rowH = 54, head = 100, secH = 52;
    const rt = GD.rates;
    const hasRt = !!(rt && (rt.us10y !== undefined || rt.bok_rate !== undefined));
    const H = head + 3 * (secH + 3 * rowH) + (hasRt ? secH + 2 * rowH : 0) + 44 + 4 * 26;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, W, H);
    c.textAlign = 'left'; c.fillStyle = PAL.fg;
    c.font = '700 32px ' + FONT;
    c.fillText('금·은 시세', 40, 52);
    c.fillStyle = PAL.mute; c.font = '600 20px ' + FONT;
    c.fillText(r.date + ' (' + r.weekday + ') 오전 10시 30분 기준', 40, 82);
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
      c.textAlign = 'right';
      let rx = W - 40;
      if (extra && !below) {
        c.font = '600 ' + (smallExtra === false ? 20 : 18) + 'px ' + FONT; c.fillStyle = color || PAL.mute;
        c.fillText(extra, rx, y + 34);
        rx -= c.measureText(extra).width + 16;
      }
      c.font = '700 30px ' + FONT; c.fillStyle = valColor || color || PAL.fg;
      c.fillText(value, rx, y + 36);
      if (extra && below) {
        c.font = '600 18px ' + FONT; c.fillStyle = color || PAL.mute;
        c.fillText(extra, W - 40, y + 62);
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
      sec(NAME[mt] + ' 국제 시세 (USD/온스, 31.1g)');
      ['fut', 'spot'].forEach((kind) => {
        const key = mt + '_' + kind;
        const pv = prevRow ? Number(prevRow[key]) : 0;
        const cv = pv ? (Number(r[key]) / pv - 1) * 100 : null;
        line(NAME[mt] + (kind === 'fut' ? ' 선물' : ' 현물'), f2(Number(r[key])),
          cv === null ? '' : dod(cv), cv === null ? PAL.mute : dodCol(cv), PAL.fg, undefined, true);
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
    c.fillStyle = PAL.mute; c.font = '600 16px ' + FONT; c.textAlign = 'left';
    c.fillText((GD.sample ? '샘플 데이터 · ' : '') + '국제 현물가×환율 환산값으로 실제 거래가와 다를 수 있습니다.', 40, H - 16);
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
    out.push('[금·은 시세] ' + r.date + ' (' + r.weekday + ') 오전 10시 30분 기준');
    headlineLines().filter(Boolean).forEach((t) => out.push(t));
    out.push('');
    out.push('■ 시장분석');
    [['m1', '공통 요인'], ['m2', '금 요인'], ['m3', '은 요인'], ['m4', '선물·현물 괴리'], ['m5', '오늘의 주목 일정']]
      .forEach((p) => out.push('- ' + p[1] + ': ' + (p[0] === 'm4' ? spreadLine() : byId(p[0]))));
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
          const st = stateAfter(parts, i);
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
    c.fillText(r.date + ' (' + r.weekday + ') 오전 10시 30분 기준', P, 142);
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
    const bw2 = (W - 2 * P - 24) / 2, bh = 352;
    const prevI = GD.rows.length > 1 ? GD.rows[GD.rows.length - 2] : null;
    ['gold', 'silver'].forEach((mt, i) => {
      const x = P + i * (bw2 + 24);
      softCard(c, x, y, bw2, bh, 26, mt === 'gold' ? '#fff4d6' : '#eaf0f8');
      if (mt === 'gold') coin(c, x + 58, y + 62, 32, '#f5b301', '#fff3c4', '금', '#8a5a00');
      else coin(c, x + 58, y + 62, 32, '#a9b8cf', '#eef2f8', '은', '#46546b');
      [[NAME[mt] + ' 선물', f2(Number(r[mt + '_fut'])), mt + '_fut'], [NAME[mt] + ' 현물', f2(Number(r[mt + '_spot'])), mt + '_spot']].forEach((p, k) => {
        const ry = y + 158 + k * 78;
        c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.textAlign = 'left'; c.fillText(p[0], x + 28, ry);
        c.fillStyle = INF.ink; c.font = '700 30px ' + FONT; c.textAlign = 'right'; c.fillText(p[1], x + bw2 - 28, ry + 2);
        const pv = prevI ? Number(prevI[p[2]]) : 0;
        if (pv) {
          const cv3 = (Number(r[p[2]]) / pv - 1) * 100;
          c.font = '700 18px ' + FONT;
          c.fillStyle = cv3 > 0 ? INF.up : (cv3 < 0 ? INF.down : INF.mute);
          c.fillText((cv3 > 0 ? '▲ ' : (cv3 < 0 ? '▼ ' : '')) + fSign(cv3) + '%', x + bw2 - 28, ry + 28);
        }
      });
      c.textAlign = 'left';
      const sp = Number(r[mt + '_spread_pct']);
      const col = sp >= 0 ? INF.blue : INF.red;
      c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.fillText('선물·현물 괴리율', x + 28, y + 314);
      const st = sp >= 0 ? '콘탱고' : '백워데이션';
      c.font = '700 17px ' + FONT;
      const pw = c.measureText(st).width + 28;
      pill(c, st, x + bw2 - 28 - pw, y + 288, rgba(col, 0.14), col, '700 17px ' + FONT);
      c.font = '700 26px ' + FONT; c.fillStyle = col; c.textAlign = 'right';
      c.fillText(fSign(sp) + '%', x + bw2 - 28 - pw - 14, y + 316); c.textAlign = 'left';
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
  function bankArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 200, w / 200);
    poly(c, [[100, 20], [185, 70], [15, 70]], '#c7b8ff', INK, 5);
    box(c, 22, 72, 156, 16, 0, '#9f8cf2', INK, 5);
    [36, 72, 108, 144].forEach((cx) => box(c, cx, 92, 22, 66, 0, '#efeaff', INK, 4));
    box(c, 12, 158, 176, 22, 0, '#9f8cf2', INK, 5);
    cir(c, 80, 54, 5, INK); cir(c, 120, 54, 5, INK);
    pth(c, 'M68 42 l20 7 M132 42 l-20 7', null, INK, 5); pth(c, 'M86 62 h28', null, INK, 4);
    txt(c, '연준', 100, 85, '900 13px ' + TOON, INK, 'center');
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
  function scaleArt(c, x, y, w) {
    c.save(); c.translate(x, y); c.scale(w / 300, w / 300);
    box(c, 140, 44, 20, 130, 0, '#b8c0cc', INK, 5);
    pth(c, 'M96 178 h108 v14 h-108 z', '#8a93a3', INK, 5);
    pth(c, 'M50 56 L250 56', null, INK, 9);
    cir(c, 150, 44, 12, '#f6c32d', INK, 5);
    [[50, '#ffd66b'], [250, '#bfe3ff']].forEach((p) => {
      c.save(); c.translate(p[0], 60);
      pth(c, 'M0 0 L-40 70 M0 0 L40 70', null, INK, 4);
      pth(c, 'M-52 70 h104 q-8 30 -52 30 q-44 0 -52 -30 z', p[1], INK, 5);
      c.restore();
    });
    c.restore();
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
  function richCentered(c, line, cx, y, base) {
    const baseFont = c.font;
    const parts = String(line).split(/(\(변동 [\d,]+원\)|\(?[+\-−]\d[\d,]*(?:\.\d+)?(?:%|원)\)?)/);
    const fontFor = (p, i) => (i % 2 && p.charAt(0) === '(' ? scaledFont(baseFont, 0.6) : baseFont);
    let total = 0;
    parts.forEach((p, i) => { if (!p) return; c.font = fontFor(p, i); total += c.measureText(p).width; });
    let x = cx - total / 2;
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
      c.font = fontFor(p, i);
      c.fillStyle = col;
      c.textAlign = 'left'; c.fillText(p, x, y); x += c.measureText(p).width;
    });
    c.font = baseFont;
  }
  function bubbleDraw(c, ox, oy, text, l, t, w, tail, size) {
    c.font = '900 ' + size + 'px ' + TOON;
    const lines = paras(c, text, w - 48), lh = size * 1.3, h = lines.length * lh + 36;
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

  function artOf(f) {
    const t = (f.title || '') + ' ' + (f.summary || '');
    if (/선물|현물|괴리|콘탱고|백워/.test(t)) return 'scale';
    if (/달러|환율/.test(t)) return 'dollar';
    if (/금리|연준|FOMC|Fed/i.test(t)) return 'bank';
    if (/안전|지정학|중앙은행|ETF|불안/.test(t)) return 'shield';
    if (/산업|제조|경기|공장|수요/.test(t)) return 'factory';
    return 'coin';
  }

  /* 한 컷(요인) 그림: 그림 영역은 750x400 */
  function factorArt(c, ox, oy, f, idx, r) {
    const kind = artOf(f);
    const who = f.target === '금' ? ['gold'] : (f.target === '은' ? ['silver'] : ['gold', 'silver']);
    const st = f.impact === 'up' ? { e: 'proud', a: 'up', say: '힘이 나요!', sfx: '쑥!' }
      : (f.impact === 'down' ? { e: 'sweat', a: 'down', say: '조금 무거워요…', sfx: '꾸욱…' } : { e: 'smile', a: 'down', say: '지켜보는 중!', sfx: '흠…' });
    narrDraw(c, ox, oy, (idx + 1) + '. ' + f.title);
    const two = who.length === 2;
    const coinAt = (i, x, y, w) => coinArt(c, ox + x, oy + y, w, who[i], st.e, st.a);
    if (kind === 'dollar') {
      dollarArt(c, ox + 235, oy + 56, 280, f.impact === 'down');
      two ? (coinAt(0, 70, 255, 130), coinAt(1, 550, 255, 130)) : coinAt(0, 310, 250, 140);
      sfxDraw(c, ox, oy, st.sfx, 540, 70, 8, 72);
    } else if (kind === 'bank') {
      bankArt(c, ox + 40, oy + 80, 240);
      two ? (coinAt(0, 350, 180, 170), coinAt(1, 545, 190, 150)) : coinAt(0, 440, 175, 190);
      bubbleDraw(c, ox, oy, st.say, 330, 56, 380, 'dl', 28);
      sfxDraw(c, ox, oy, st.sfx, 60, 330, -6, 56, '#fff');
    } else if (kind === 'shield') {
      cloudArt(c, ox + 10, oy + 40, 200); cloudArt(c, ox + 540, oy + 36, 180);
      two ? (coinAt(0, 190, 110, 170), coinAt(1, 400, 120, 160)) : coinAt(0, 280, 110, 200);
      shieldArt(c, ox + 320, oy + 255, 110);
      bubbleDraw(c, ox, oy, st.say, 40, 250, 250, 'dr', 26);
      sfxDraw(c, ox, oy, st.sfx, 560, 300, -8, 60);
    } else if (kind === 'factory') {
      factoryArt(c, ox + 40, oy + 100, 250);
      two ? (coinAt(0, 350, 160, 170), coinAt(1, 545, 170, 150)) : coinAt(0, 430, 150, 190);
      bubbleDraw(c, ox, oy, st.say, 330, 40, 380, 'dl', 28);
      sfxDraw(c, ox, oy, st.sfx, 60, 330, -6, 56);
    } else if (kind === 'scale') {
      scaleArt(c, ox + 225, oy + 40, 300);
      txt(c, '선물', ox + 258, oy + 232, '900 26px ' + TOON, INK); txt(c, '현물', ox + 458, oy + 232, '900 26px ' + TOON, INK);
      coinArt(c, ox + 30, oy + 215, 150, 'gold', 'smile', 'down'); coinArt(c, ox + 590, oy + 220, 140, 'silver', 'smile', 'down');
      const g = Number(r.gold_spread_pct), s = Number(r.silver_spread_pct);
      bubbleDraw(c, ox, oy, '금 ' + fSign(g) + '% ' + (g >= 0 ? '콘탱고' : '백워데이션'), 14, 110, 250, 'dl', 26);
      bubbleDraw(c, ox, oy, '은 ' + fSign(s) + '% ' + (s >= 0 ? '콘탱고' : '백워데이션'), 490, 110, 250, 'dr', 26);
    } else {
      two ? (coinAt(0, 130, 110, 220), coinAt(1, 400, 120, 210)) : coinAt(0, 270, 100, 240);
      bubbleDraw(c, ox, oy, st.say, 220, 30, 310, 'dl', 28);
      sfxDraw(c, ox, oy, st.sfx, 560, 70, 8, 64);
    }
  }
  function captionMetrics(c, f) {
    c.font = '900 30px ' + TOON; const sl = wrapText(c, String(f.summary || '').replace(/^샘플 문구:\s*/, ''), 702);
    c.font = '600 23px ' + TOON; const dl = wrapText(c, String(f.text || '').replace(/^샘플 문구:\s*/, ''), 702);
    return { sl, dl, h: 5 + 16 + 44 + 10 + sl.length * 39 + 8 + dl.length * 30 + 20 };
  }
  function captionDraw(c, ox, capTop, f, m) {
    c.fillStyle = '#fff'; c.fillRect(ox, capTop, 750, m.h);
    c.fillStyle = INK; c.fillRect(ox, capTop, 750, 5);
    let x = ox + 24; const y0 = capTop + 5 + 16;
    const imp = f.impact === 'up' ? ['▲ 상승 요인', 'up'] : (f.impact === 'down' ? ['▼ 하락 요인', 'down'] : ['● 중립', 'flat']);
    x += chipDraw(c, x, y0, imp[0], imp[1]) + 10;
    if (f.target) chipDraw(c, x, y0, f.target, 'metal');
    let y = y0 + 44 + 10;
    c.font = '900 30px ' + TOON;
    m.sl.forEach((ln) => { y += 39; drawRich(c, ln, ox + 24, y - 9, INK); });
    y += 8; c.font = '600 23px ' + TOON;
    m.dl.forEach((ln) => { y += 30; drawRich(c, ln, ox + 24, y - 8, '#333333'); });
  }

  async function buildToon(want) {
    try { await document.fonts.load('900 30px Jua'); } catch (e) { /* 폰트가 없으면 고딕으로 대신 */ }
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
    const cp = GD.ana.find((x) => x.kind === 'checkpoint');
    const list = factors.map((f) => ({ f, m: captionMetrics(m0, f) }));
    const panels = [{ h: 660, id: 'cover' }, { h: 700, id: 'price' }];
    list.forEach((it, i) => panels.push({ h: 10 + ART + it.m.h, id: 'factor', it, i }));
    if (cp) { const m = captionMetrics(m0, cp); panels.push({ h: 10 + ART + m.h, id: 'check', it: { f: cp, m } }); }
    panels.push({ h: 520, id: 'end' });
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
    panels.forEach((p) => {
      const oy = y + 5;
      if (p.id === 'cover') {
        panelFrame(c, P, y, W - 2 * P, p.h, (x0, y0, w0, h0) => bgFocus(c, x0, y0, w0, h0, '#1b2a5a', 0.5, 0.66, 0.09));
        narrDraw(c, ox, oy, '웹툰 스타일');
        c.textAlign = 'center'; c.lineJoin = 'round';
        c.font = '900 66px ' + TOON; c.lineWidth = 8; c.strokeStyle = INK; c.strokeText('오늘의', W / 2, oy + 150); c.fillStyle = '#fff'; c.fillText('오늘의', W / 2, oy + 150);
        c.font = '900 92px ' + TOON; c.lineWidth = 10; c.strokeText('금·은 이야기', W / 2, oy + 250); c.fillStyle = '#ffd400'; c.fillText('금·은 이야기', W / 2, oy + 250);
        c.textAlign = 'left';
        txt(c, r.date + ' (' + r.weekday + ') 오전 10시 30분 기준' + (GD.sample ? ' · 샘플 데이터' : ''), W / 2, oy + 316, '700 28px ' + TOON, '#ffffff', 'center');
        bubbleDraw(c, ox, oy, '오늘 시세, 같이 볼까요?', 40, 340, 330, 'dl', 30);
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
          const gk = dm.gold_sell_chg, sk = dm.silver_sell_chg;
          const gx = Number(gk) < 0 ? ['sweat', 'down'] : (Number(gk) > 0 ? ['proud', 'up'] : ['smile', 'down']);
          const sx = Number(sk) < 0 ? ['sweat', 'down'] : (Number(sk) > 0 ? ['proud', 'up'] : ['smile', 'down']);
          bubbleDraw(c, ox, oy, '순금<br>살 때 ' + fInt(dm.gold_buy) + '원 ' + chgPart('gold_buy') + '<br>팔 때 ' + fInt(dm.gold_sell) + '원 ' + chgPart('gold_sell'), 14, 84, 360, 'dl', 24);
          coinArt(c, ox + 79, oy + 280, 230, 'gold', gx[0], gx[1]);
          bubbleDraw(c, ox, oy, '은<br>살 때 ' + fInt(dm.silver_buy) + '원 ' + chgPart('silver_buy') + '<br>팔 때 ' + fInt(dm.silver_sell) + '원 ' + chgPart('silver_sell'), 376, 84, 360, 'dr', 24);
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
          factorArt(c, ox, oy, f, p.i, r);
        } else {
          narrDraw(c, ox, oy, '오늘의 체크포인트');
          calendarArt(c, ox + 265, oy + 50, 220);
          coinArt(c, ox + 40, oy + 200, 150, 'gold', 'shock', 'up'); coinArt(c, ox + 560, oy + 206, 140, 'silver', 'shock', 'up');
          bubbleDraw(c, ox, oy, '발표 시각을<br>꼭 확인!', 20, 80, 220, 'dl', 26);
          sfxDraw(c, ox, oy, '두근!', 540, 70, 8, 64);
        }
        captionDraw(c, ox, oy + ART, f, p.it.m);
      } else {
        panelFrame(c, P, y, W - 2 * P, p.h, (x0, y0, w0, h0) => bgFocus(c, x0, y0, w0, h0, '#fff0b3', 0.5, 0.45, 0.08));
        txt(c, '오늘 이야기는 여기까지!', W / 2, oy + 96, '900 56px ' + TOON, INK, 'center');
        coinArt(c, ox + 40, oy + 170, 200, 'gold', 'smile', 'wave');
        coinArt(c, ox + 510, oy + 176, 190, 'silver', 'proud', 'wave');
        bubbleDraw(c, ox, oy, '내일 아침에 또 만나요!', 230, 150, 290, 'dl', 28);
        c.fillStyle = '#fff'; c.fillRect(ox, oy + 390, IN, p.h - 10 - 390);
        c.fillStyle = INK; c.fillRect(ox, oy + 390, IN, 5);
        c.font = '600 20px ' + TOON; c.fillStyle = '#333';
        wrapText(c, byId('n1') + (GD.sample ? ' 이 이미지는 샘플 데이터로 만든 예시입니다.' : ''), IN - 44).forEach((ln, i) => c.fillText(ln, ox + 22, oy + 430 + i * 28));
      }
      y += p.h + GAP;
    });
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
  $('#gd-info-download').addEventListener('click', downloadInfo);
  $('#gd-toon-download').addEventListener('click', downloadToon);
  $('#gd-toon-download-top').addEventListener('click', downloadToon);
  $('#gd-toon-preview').addEventListener('click', previewToon);
  $('#gd-info-download-top').addEventListener('click', downloadInfo);
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
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  load();
})();
