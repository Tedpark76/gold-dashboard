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
    gold: '#a67c00', silver: '#6b7280', up: '#2563eb', down: '#dc2626', pin: '#111827'
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

  function setRich(el, text) {
    el.textContent = '';
    String(text).split(/([+\-−]\d+(?:\.\d+)?%)/).forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        const v = parseFloat(part.replace('−', '-'));
        const s = document.createElement('span');
        s.className = 'gd-pct' + (v > 0 ? ' up' : (v < 0 ? ' down' : ''));
        s.textContent = part;
        el.appendChild(s);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    });
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
  function drawChart(cv, metal, rows, spikes, W, H, dpr) {
    const nm = NAME[metal];
    const kf = metal + '_krw_don';
    const sf = metal + '_spread_pct';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.aspectRatio = W + ' / ' + H;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg;
    c.fillRect(0, 0, W, H);
    const small = W < 560;
    const fs = small ? 11 : 13;
    c.textAlign = 'left';
    c.fillStyle = PAL.fg;
    c.font = '600 ' + (small ? 15 : 19) + 'px ' + FONT;
    c.fillText(nm + ' 국내시세와 선물·현물 괴리율', 14, 26);
    c.fillStyle = PAL.mute;
    c.font = '600 ' + fs + 'px ' + FONT;
    c.fillText('최근 30일(일요일 제외) · 원/돈(3.75g) · 국제가 환산', 14, 26 + (small ? 16 : 20));

    const L = small ? 56 : 72, R = 14, T = small ? 62 : 72, B = small ? 54 : 50, gap = small ? 30 : 36;
    const plotW = W - L - R;
    const plotH = H - T - B - gap;
    const h1 = Math.round(plotH * 0.62);
    const h2 = plotH - h1;
    const n = rows.length;
    const x = (i) => L + plotW * (n < 2 ? 0.5 : i / (n - 1));

    const vals = rows.map((r) => Number(r[kf]));
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const pad = (hi - lo) * 0.14 || 1;
    const y0 = lo - pad, y1v = hi + pad;
    const y1 = (v) => T + h1 - ((v - y0) / (y1v - y0)) * h1;
    c.fillStyle = metal === 'gold' ? '#fff7e0' : '#eef1f6';
    c.fillRect(L, T, plotW, h1);
    c.fillStyle = '#f3f6fb';
    c.fillRect(L, T + h1 + gap, plotW, h2);

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
    rows.forEach((r, i) => { const px = x(i), py = y1(Number(r[kf])); i ? c.lineTo(px, py) : c.moveTo(px, py); });
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

    const top2 = T + h1 + gap;
    const sv = rows.map((r) => Number(r[sf]));
    const m = Math.max(0.2, Math.max.apply(null, sv.map(Math.abs))) * 1.15;
    const zero = top2 + h2 / 2;
    const y2 = (v) => zero - (v / m) * (h2 / 2);
    c.fillStyle = PAL.mute; c.textAlign = 'left'; c.font = '600 ' + fs + 'px ' + FONT;
    c.fillText('선물·현물 괴리율(%)', L, top2 - 10);
    [m, 0, -m].forEach((v) => {
      c.strokeStyle = v === 0 ? PAL.mute : PAL.grid;
      c.beginPath(); c.moveTo(L, y2(v)); c.lineTo(W - R, y2(v)); c.stroke();
      c.fillStyle = PAL.mute; c.textAlign = 'right';
      c.fillText(v.toFixed(2), L - 6, y2(v) + 4);
    });
    const bw = Math.max(3, (plotW / n) * 0.6);
    sv.forEach((v, i) => {
      c.fillStyle = v >= 0 ? PAL.up : PAL.down;
      const yy = y2(v);
      c.fillRect(x(i) - bw / 2, Math.min(yy, zero), bw, Math.max(1, Math.abs(yy - zero)));
    });

    c.fillStyle = PAL.mute; c.textAlign = 'center';
    const step = Math.max(1, Math.ceil(n / (small ? 5 : 8)));
    rows.forEach((r, i) => {
      if (i % step === 0 || i === n - 1) c.fillText(r.date.slice(5).replace('-', '/'), x(i), top2 + h2 + 18);
    });
    c.textAlign = 'left'; c.fillStyle = PAL.mute; c.font = '600 ' + (fs - 1) + 'px ' + FONT;
    const fy = H - (small ? 22 : 12);
    c.fillText('번호 마커: 전일 대비 ±3% 이상 변동(▲급등 ▼급락)', 14, fy);
    c.fillText('막대 파랑 = 콘탱고, 빨강 = 백워데이션', small ? 14 : W / 2 + 40, small ? fy + 14 : fy);
  }

  /* ---------- 시세 이미지 ---------- */
  function drawPrices(cv, r, W, dpr) {
    const rowH = 54, head = 100, secH = 52;
    const H = head + 3 * (secH + 3 * rowH) + 44;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = PAL.bg; c.fillRect(0, 0, W, H);
    c.textAlign = 'left'; c.fillStyle = PAL.fg;
    c.font = '700 32px ' + FONT;
    c.fillText('금·은 시세', 40, 52);
    c.fillStyle = PAL.mute; c.font = '600 20px ' + FONT;
    c.fillText(r.date + ' (' + r.weekday + ') 오전 9시(KST) 기준 · 국제시장 기준', 40, 82);
    let y = head;
    const sec = (title) => {
      c.fillStyle = PAL.fg; c.font = '700 24px ' + FONT; c.textAlign = 'left';
      c.fillText(title, 40, y + 34);
      c.strokeStyle = PAL.fg; c.lineWidth = 2;
      c.beginPath(); c.moveTo(40, y + 44); c.lineTo(W - 40, y + 44); c.stroke();
      y += secH;
    };
    const line = (label, value, extra, color, valColor) => {
      c.fillStyle = PAL.mute; c.font = '600 22px ' + FONT; c.textAlign = 'left';
      c.fillText(label, 40, y + 34);
      c.textAlign = 'right';
      let rx = W - 40;
      if (extra) {
        c.font = '600 20px ' + FONT; c.fillStyle = color || PAL.mute;
        c.fillText(extra, rx, y + 34);
        rx -= c.measureText(extra).width + 16;
      }
      c.font = '700 30px ' + FONT; c.fillStyle = valColor || color || PAL.fg;
      c.fillText(value, rx, y + 36);
      c.strokeStyle = PAL.grid; c.lineWidth = 1;
      c.beginPath(); c.moveTo(40, y + rowH); c.lineTo(W - 40, y + rowH); c.stroke();
      y += rowH;
    };
    const dod = (v) => (Number(v) > 0 ? '▲ ' : (Number(v) < 0 ? '▼ ' : '')) + fSign(Number(v)) + '%';
    const dodCol = (v) => (Number(v) > 0 ? PAL.up : (Number(v) < 0 ? PAL.down : PAL.mute));
    const spr = (v) => { const n = Number(v); return [fSign(n) + '%', n >= 0 ? '콘탱고' : '백워데이션', n >= 0 ? PAL.up : PAL.down]; };
    sec('국내 시세 (1돈 = 3.75g, 국제가 환산)');
    line('환율 (원/USD)', f2(Number(r.usdkrw)));
    line('원화 금 현물 (원/돈)', fInt(Number(r.gold_krw_don)), dod(r.gold_krw_dod_pct), dodCol(r.gold_krw_dod_pct), PAL.fg);
    line('원화 은 현물 (원/돈)', fInt(Number(r.silver_krw_don)), dod(r.silver_krw_dod_pct), dodCol(r.silver_krw_dod_pct), PAL.fg);
    ['gold', 'silver'].forEach((mt) => {
      sec(NAME[mt] + ' 국제 시세 (USD/온스)');
      line(NAME[mt] + ' 선물', f2(Number(r[mt + '_fut'])));
      line(NAME[mt] + ' 현물', f2(Number(r[mt + '_spot'])));
      const s = spr(r[mt + '_spread_pct']);
      line('선물·현물 괴리율', s[0], s[1], s[2]);
    });
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
    out.push('[금·은 시세] ' + r.date + ' (' + r.weekday + ') 오전 9시(KST) 기준');
    ['h1', 'h2', 'h3'].forEach((id) => out.push(byId(id)));
    out.push('');
    out.push('■ 시장분석');
    [['m1', '공통 요인'], ['m2', '금 요인'], ['m3', '은 요인'], ['m4', '선물·현물 괴리'], ['m5', '오늘의 주목 일정']]
      .forEach((p) => out.push('- ' + p[1] + ': ' + byId(p[0])));
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
      const cv = offscreen(); drawChart(cv, m, GD.rows, spikesOf(m), 1000, 720, 2); copyCanvas(cv, NAME[m] + ' 그래프');
    });
  });
  $('#gd-copy-text').addEventListener('click', () => { if (GD.latest) copyText(); });


  /* ---------- 한 장 인포그래픽 (시장분석 중심) ---------- */
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const INF = {
    bg: '#fbf8ff', ink: '#2a2540', mute: '#6b6785', gold: '#f5b301', silver: '#8fa3bf',
    teal: '#14b8a6', violet: '#7c3aed', up: '#2563eb', down: '#dc2626', blue: '#2563eb', red: '#dc2626'
  };
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function wrapText(c, text, maxW) {
    const out = [];
    let line = '';
    for (const ch of String(text)) {
      if (ch === ' ' && !line) continue;
      const t = line + ch;
      if (c.measureText(t).width > maxW && line) { out.push(line.trimEnd()); line = ch === ' ' ? '' : ch; } else { line = t; }
    }
    if (line) out.push(line);
    return out;
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
  function drawRich(c, text, x, y, base) {
    let cx = x;
    String(text).split(/([+\-−]\d+(?:\.\d+)?%)/).forEach((part, i) => {
      if (!part) return;
      const v = parseFloat(part.replace('−', '-'));
      c.fillStyle = (i % 2) ? (v > 0 ? INF.up : (v < 0 ? INF.down : base)) : base;
      c.fillText(part, cx, y);
      cx += c.measureText(part).width;
    });
  }
  function buildInfographic() {
    const W = 1080, P = 56, dpr = 2, TALL = 4200;
    const r = GD.latest;
    const clean = (s) => String(s || '').replace(/^샘플 문구:\s*/, '');
    const byId = (id) => clean((GD.ana.find((x) => x.id === id) || {}).text);
    const tall = document.createElement('canvas');
    tall.width = W * dpr; tall.height = TALL * dpr;
    const c = tall.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = INF.bg; c.fillRect(0, 0, W, TALL);
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
    c.fillText(r.date + ' (' + r.weekday + ') 오전 9시(KST) 기준', P, 142);
    c.fillText('시세와 시장 흐름을 한 장으로 담았어요', P, 178);
    if (GD.sample) pill(c, '샘플 데이터', P, 204, '#fde68a', '#5b4200', '700 20px ' + FONT);

    // 핵심 한 줄
    let y = 262;
    const hl = ['h1', 'h2', 'h3'].map((id, i) => ({
      font: (i === 0 ? '700 32px ' : '600 24px ') + FONT, lh: i === 0 ? 48 : 36, color: i === 0 ? '#3b2a8c' : INF.ink, text: byId(id)
    }));
    let boxH = 76;
    hl.forEach((o) => { c.font = o.font; o.lines = wrapText(c, o.text, W - 2 * P - 90); boxH += o.lines.length * o.lh + 10; });
    softCard(c, P, y, W - 2 * P, boxH, 28, '#ffffff');
    c.fillStyle = rgba(INF.gold, 0.9); c.font = '700 96px ' + FONT; c.fillText('“', P + 28, y + 86);
    let ty = y + 40;
    hl.forEach((o) => { c.font = o.font; c.fillStyle = o.color; o.lines.forEach((ln) => { ty += o.lh; drawRich(c, ln, P + 84, ty - 6, o.color); }); ty += 10; });
    y += boxH + 52;

    const sectionTitle = (emoji, text, sub) => {
      c.font = '36px ' + EMOJI; c.fillStyle = INF.ink; c.fillText(emoji, P, y + 36);
      c.font = '700 34px ' + FONT; c.fillText(text, P + 56, y + 36);
      if (sub) { c.font = '600 20px ' + FONT; c.fillStyle = INF.mute; c.fillText(sub, P + 56, y + 68); y += 18; }
      y += 68;
    };

    // 원화 시세 스트립
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
    sectionTitle('🌍', '금과 은, 국제 시세', '단위 USD/온스 · 선물과 현물의 간격(괴리율)');
    const bw2 = (W - 2 * P - 24) / 2, bh = 270;
    ['gold', 'silver'].forEach((mt, i) => {
      const x = P + i * (bw2 + 24);
      softCard(c, x, y, bw2, bh, 26, mt === 'gold' ? '#fff4d6' : '#eaf0f8');
      if (mt === 'gold') coin(c, x + 58, y + 62, 32, '#f5b301', '#fff3c4', '금', '#8a5a00');
      else coin(c, x + 58, y + 62, 32, '#a9b8cf', '#eef2f8', '은', '#46546b');
      c.fillStyle = INF.ink; c.font = '700 28px ' + FONT; c.fillText(NAME[mt], x + 104, y + 74);
      [[NAME[mt] + ' 선물', f2(Number(r[mt + '_fut']))], [NAME[mt] + ' 현물', f2(Number(r[mt + '_spot']))]].forEach((p, k) => {
        const ry = y + 116 + k * 50;
        c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.textAlign = 'left'; c.fillText(p[0], x + 28, ry);
        c.fillStyle = INF.ink; c.font = '700 30px ' + FONT; c.textAlign = 'right'; c.fillText(p[1], x + bw2 - 28, ry + 2);
      });
      c.textAlign = 'left';
      const sp = Number(r[mt + '_spread_pct']);
      const col = sp >= 0 ? INF.blue : INF.red;
      c.fillStyle = INF.mute; c.font = '600 20px ' + FONT; c.fillText('선물·현물 괴리율', x + 28, y + 232);
      const st = sp >= 0 ? '콘탱고' : '백워데이션';
      c.font = '700 17px ' + FONT;
      const pw = c.measureText(st).width + 28;
      pill(c, st, x + bw2 - 28 - pw, y + 206, rgba(col, 0.14), col, '700 17px ' + FONT);
      c.font = '700 26px ' + FONT; c.fillStyle = col; c.textAlign = 'right';
      c.fillText(fSign(sp) + '%', x + bw2 - 28 - pw - 14, y + 234); c.textAlign = 'left';
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
    const out = document.createElement('canvas');
    out.width = W * dpr; out.height = Math.round(y * dpr);
    out.getContext('2d').drawImage(tall, 0, 0, W * dpr, out.height, 0, 0, W * dpr, out.height);
    return out;
  }
  function infoToBlob(cv) { return new Promise((res) => cv.toBlob(res, 'image/png')); }
  async function downloadInfo() {
    if (!GD.latest) return;
    const blob = await infoToBlob(buildInfographic());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '금은-시세-인포그래픽-' + GD.latest.date + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    flash('인포그래픽을 내려받았습니다.');
  }
  $('#gd-info-download').addEventListener('click', downloadInfo);
  $('#gd-info-download-top').addEventListener('click', downloadInfo);
  $('#gd-info-copy').addEventListener('click', () => { if (GD.latest) copyCanvas(buildInfographic(), '인포그래픽'); });
  function drawInfoPreview() {
    const key = GD.latest.date + '|' + GD.rows.length + '|' + GD.ana.length;
    if (GD.infoKey === key) return;
    GD.infoKey = key;
    const cv = buildInfographic();
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
    const [rows, ana, meta] = lastData;
    GD.rows = rows.map((r) => Object.assign({}, r));
    GD.ana = ana.map((r) => Object.assign({}, r));
    GD.latest = GD.rows[GD.rows.length - 1];
    GD.sample = !!meta.sample;
    $('#gd-sample').hidden = !GD.sample;
    $('#gd-updated').textContent = meta.updated_at ? '· 갱신 ' + meta.updated_at.replace('T', ' ').slice(0, 16) : '';
    fillLatest(GD.latest);
    fillAnalysis(GD.ana);
    ['gold', 'silver'].forEach((m) => {
      const box = $('#gd-chart-' + m);
      const W = Math.max(280, Math.round(box.clientWidth || 320));
      const H = Math.round(W * (W < 560 ? 0.98 : 0.66));
      drawChart(box.querySelector('canvas'), m, GD.rows, spikesOf(m), W, H, window.devicePixelRatio || 1);
    });
    drawInfoPreview();
  }
  async function load() {
    try {
      const get = (n) => fetch('data/' + n + '?v=' + Date.now()).then((r) => { if (!r.ok) throw new Error(n); return r.json(); });
      lastData = await Promise.all([get('history.json'), get('analysis.json'), get('meta.json')]);
      render();
    } catch (e) {
      $('#gd-flash').textContent = '데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';
    }
  }
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  load();
})();
