/* ============================================================================
 * SheetSlicer — 유니티식 스프라이트시트 슬라이서(모달) (Lane B)
 * ----------------------------------------------------------------------------
 * 계약 §3.3. canvas 위 그리드 오버레이 + 프레임 제외/선택/이름 + 애니 정의(라이브
 * 미리보기) → spriteApi.slice(relPath, patch) 저장. 기존 picker.js(597~1050행)의
 * 슬라이서 로직을 Preact 로 재작성(iframe 임베드 아님, 무의존 canvas).
 *
 * props:
 *   item       : library() 항목({ kind:'sheet', relPath, url, frameConfig?, frames?, anims?, excludedFrames?, name })
 *   onClose()  : 모달 닫기
 *   onSaved(item) : 저장 성공 시 갱신된 item 콜백(라이브러리 새로고침용)
 *
 * 사이드카 스키마(§1.1):
 *   frameConfig { frameWidth, frameHeight, margin, spacing }  (그리드)
 *   frames [{ name, x, y, w, h }]                              (비균일 — 있으면 우선)
 *   anims  [{ key, frames:[셀idx], fps, loop }]
 *   excludedFrames [idx...]
 * ==========================================================================*/
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { spriteApi } from './spriteApi.js';

// ── 순수 기하 헬퍼(셀 사각 계산) ───────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 프레임 인덱스 → 사각 {x,y,w,h}. free(frames[]) 우선, 없으면 grid(frameConfig).
function rectOf(mode, frameConfig, frames, i, imgW) {
  if (mode === 'free' && frames) {
    const f = frames[i];
    if (!f) return null;
    return { x: f.x, y: f.y, w: f.w, h: f.h };
  }
  const fc = frameConfig || {};
  const fw = fc.frameWidth, fh = fc.frameHeight;
  if (!fw || !fh) return null;
  const mg = fc.margin || 0, sp = fc.spacing || 0;
  const cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
  const c = i % cols, r = Math.floor(i / cols);
  return { x: mg + c * (fw + sp), y: mg + r * (fh + sp), w: fw, h: fh };
}

function countOf(mode, frameConfig, frames, imgW, imgH) {
  if (mode === 'free' && frames) return frames.length;
  const fc = frameConfig || {};
  const fw = fc.frameWidth, fh = fc.frameHeight;
  if (!fw || !fh) return 0;
  const mg = fc.margin || 0, sp = fc.spacing || 0;
  const cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
  const rows = Math.max(1, Math.floor((imgH - mg + sp) / (fh + sp)));
  return cols * rows;
}

function nearEdge(px, py, r, tol) {
  const rt = Math.abs(px - (r.x + r.w)) <= tol, lf = Math.abs(px - r.x) <= tol;
  const bt = Math.abs(py - (r.y + r.h)) <= tol, tp = Math.abs(py - r.y) <= tol;
  if (rt && bt) return 'se'; if (rt) return 'e'; if (bt) return 's'; if (lf) return 'w'; if (tp) return 'n';
  return null;
}

export function SheetSlicer({ item, onClose, onSaved }) {
  const [img, setImg] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [name, setName] = useState(item.name || '');
  // 그리드 모드 우선(frames[] 가 있으면 free 로 시작).
  const [mode, setMode] = useState(item.frames && item.frames.length ? 'free' : 'grid');
  const [frameConfig, setFrameConfig] = useState(
    item.frameConfig
      ? { frameWidth: item.frameConfig.frameWidth || 16, frameHeight: item.frameConfig.frameHeight || 16, margin: item.frameConfig.margin || 0, spacing: item.frameConfig.spacing || 0 }
      : { frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0 }
  );
  const [frames, setFrames] = useState(
    item.frames && item.frames.length ? item.frames.map((f) => ({ name: f.name || '', x: f.x || 0, y: f.y || 0, w: f.w || 0, h: f.h || 0 })) : null
  );
  const [excludedFrames, setExcludedFrames] = useState((item.excludedFrames || []).slice());
  const [anims, setAnims] = useState(
    (item.anims || []).map((a) => ({ key: a.key || a.name || 'anim', frames: (a.frames || []).slice(), fps: a.fps || a.frameRate || 8, loop: a.loop != null ? !!a.loop : true }))
  );
  const [sel, setSel] = useState(-1);             // 선택 프레임 인덱스
  const [multi, setMulti] = useState([]);          // 다중선택(애니 정의용)
  const [scale, setScale] = useState(1);
  const [playingAnim, setPlayingAnim] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const overlayRef = useRef(null);
  const baseRef = useRef(null);
  const dragRef = useRef(null);                    // {kind,...} 진행 중 드래그
  const previewRef = useRef(null);                 // 애니 미리보기 canvas
  const rafRef = useRef(null);

  const relPath = item.relPath || '';

  // 이미지 로드(동시성 제한 경유).
  useEffect(() => {
    let alive = true;
    const src = spriteApi.assetUrl(item.url || item.relPath);
    spriteApi.loadImage(src).then(
      (im) => { if (alive) { setImg(im); fitScale(im); } },
      () => { if (alive) setLoadErr('이미지를 불러오지 못했습니다: ' + src); }
    );
    return () => { alive = false; };
  }, [item.url, item.relPath]);

  function fitScale(im) {
    const maxW = 520;
    let s = Math.max(1, Math.min(8, Math.floor(maxW / im.width) || 1));
    if (im.width * s > maxW) s = Math.max(1, maxW / im.width);
    setScale(s);
  }

  const isPixel = item.style !== 'smooth' && item.style !== 'vector';

  // 베이스 캔버스에 원본 그리기.
  useEffect(() => {
    if (!img || !baseRef.current) return;
    const cv = baseRef.current;
    cv.width = img.width; cv.height = img.height;
    cv.style.width = (img.width * scale) + 'px';
    cv.style.height = (img.height * scale) + 'px';
    if (isPixel) cv.style.imageRendering = 'pixelated';
    try { cv.getContext('2d').drawImage(img, 0, 0); } catch (e) {}
  }, [img, scale]);

  // 오버레이 렌더(프레임 외곽선·인덱스·선택/제외/다중).
  const drawOverlay = useCallback(() => {
    const ov = overlayRef.current;
    if (!ov || !img) return;
    ov.width = img.width * scale; ov.height = img.height * scale;
    ov.style.width = (img.width * scale) + 'px';
    ov.style.height = (img.height * scale) + 'px';
    const x = ov.getContext('2d');
    x.clearRect(0, 0, ov.width, ov.height);
    const n = countOf(mode, frameConfig, frames, img.width, img.height);
    const exclSet = {}; excludedFrames.forEach((i) => { exclSet[i] = true; });
    const multiSet = {}; multi.forEach((i) => { multiSet[i] = true; });
    for (let i = 0; i < n; i++) {
      const r = rectOf(mode, frameConfig, frames, i, img.width);
      if (!r) continue;
      const px = r.x * scale, py = r.y * scale, pw = r.w * scale, ph = r.h * scale;
      if (exclSet[i]) { x.fillStyle = 'rgba(255,107,107,.28)'; x.fillRect(px, py, pw, ph); }
      else if (multiSet[i]) { x.fillStyle = 'rgba(255,210,63,.22)'; x.fillRect(px, py, pw, ph); }
      x.lineWidth = (i === sel) ? 2 : 1;
      x.strokeStyle = (i === sel) ? '#5ad1ff' : (exclSet[i] ? 'rgba(255,107,107,.7)' : 'rgba(255,255,255,.35)');
      x.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      if (scale >= 2 && pw > 22) {
        x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px + 1, py + 1, 16, 11);
        x.fillStyle = '#cfe'; x.font = '9px monospace'; x.textBaseline = 'top'; x.fillText(String(i), px + 2, py + 2);
      }
    }
    // 드래그 중 신규 영역 미리보기
    const d = dragRef.current;
    if (d && d.kind === 'new') {
      const nx = Math.min(d.x0, d.x1), ny = Math.min(d.y0, d.y1), nw = Math.abs(d.x1 - d.x0), nh = Math.abs(d.y1 - d.y0);
      x.strokeStyle = '#ffd23f'; x.lineWidth = 2; x.setLineDash([4, 3]);
      x.strokeRect(nx * scale + 0.5, ny * scale + 0.5, nw * scale, nh * scale); x.setLineDash([]);
    }
  }, [img, scale, mode, frameConfig, frames, excludedFrames, multi, sel]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // ── 캔버스 마우스(grid: 제외토글 / free: 영역 드래그·이동·리사이즈) ───────────
  function canvasPos(e) {
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    return { x: clamp(Math.round(x), 0, img.width), y: clamp(Math.round(y), 0, img.height) };
  }
  function frameAt(px, py) {
    const n = countOf(mode, frameConfig, frames, img.width, img.height);
    for (let i = n - 1; i >= 0; i--) {
      const r = rectOf(mode, frameConfig, frames, i, img.width);
      if (r && px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
    }
    return -1;
  }

  function onMouseDown(e) {
    if (!img) return;
    e.preventDefault();
    const p = canvasPos(e);
    const hit = frameAt(p.x, p.y);
    if (mode === 'grid') {
      if (hit >= 0) { toggleExcluded(hit); setSel(hit); }
      return;
    }
    // free 모드
    if (hit >= 0) {
      if (e.shiftKey) { toggleMulti(hit); return; }
      const r = rectOf('free', frameConfig, frames, hit, img.width);
      const edge = nearEdge(p.x, p.y, r, 6 / scale);
      setSel(hit);
      dragRef.current = { kind: edge ? 'resize' : 'move', i: hit, edge, sx: p.x, sy: p.y, orig: { x: r.x, y: r.y, w: r.w, h: r.h } };
    } else {
      dragRef.current = { kind: 'new', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      setSel(-1);
    }
  }

  // document 레벨 mousemove/mouseup(드래그가 캔버스 밖으로 나가도 추적).
  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d || !img) return;
      const p = canvasPos(e);
      if (d.kind === 'new') { d.x1 = p.x; d.y1 = p.y; drawOverlay(); }
      else if (d.kind === 'move') {
        setFrames((prev) => {
          if (!prev) return prev;
          const next = prev.slice();
          const f = { ...next[d.i] };
          f.x = clamp(d.orig.x + (p.x - d.sx), 0, img.width - f.w);
          f.y = clamp(d.orig.y + (p.y - d.sy), 0, img.height - f.h);
          next[d.i] = f;
          return next;
        });
      } else if (d.kind === 'resize') {
        setFrames((prev) => {
          if (!prev) return prev;
          const next = prev.slice();
          const f = { ...next[d.i] };
          resizeFrame(f, d.orig, d.edge, p.x - d.sx, p.y - d.sy, img.width, img.height);
          next[d.i] = f;
          return next;
        });
      }
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.kind === 'new') {
        const nx = Math.min(d.x0, d.x1), ny = Math.min(d.y0, d.y1), nw = Math.abs(d.x1 - d.x0), nh = Math.abs(d.y1 - d.y0);
        if (nw >= 2 && nh >= 2) {
          setFrames((prev) => {
            const base = prev || [];
            const next = base.concat([{ name: '', x: nx, y: ny, w: nw, h: nh }]);
            setSel(next.length - 1);
            return next;
          });
        }
      }
      drawOverlay();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [img, scale, drawOverlay]);

  function resizeFrame(f, orig, edge, dx, dy, maxW, maxH) {
    if (edge.indexOf('e') !== -1) f.w = clamp(orig.w + dx, 1, maxW - orig.x);
    if (edge.indexOf('s') !== -1) f.h = clamp(orig.h + dy, 1, maxH - orig.y);
    if (edge.indexOf('w') !== -1) { const nx = clamp(orig.x + dx, 0, orig.x + orig.w - 1); f.x = nx; f.w = orig.x + orig.w - nx; }
    if (edge.indexOf('n') !== -1) { const ny = clamp(orig.y + dy, 0, orig.y + orig.h - 1); f.y = ny; f.h = orig.y + orig.h - ny; }
  }

  function toggleExcluded(i) {
    setExcludedFrames((prev) => {
      const k = prev.indexOf(i);
      if (k === -1) return prev.concat([i]);
      const next = prev.slice(); next.splice(k, 1); return next;
    });
  }
  function toggleMulti(i) {
    setMulti((prev) => {
      const k = prev.indexOf(i);
      const next = k === -1 ? prev.concat([i]) : prev.filter((x) => x !== i);
      return next.slice().sort((a, b) => a - b);
    });
  }

  // ── 모드 전환(그리드 ↔ 자유) ──────────────────────────────────────────────────
  function switchMode(m) {
    if (m === mode) return;
    if (m === 'free' && !frames && img) {
      // 현재 그리드 칸을 frames[] 로 구체화(제외칸 빼고).
      const n = countOf('grid', frameConfig, null, img.width, img.height);
      const excl = {}; excludedFrames.forEach((i) => { excl[i] = true; });
      const out = [];
      for (let i = 0; i < n; i++) {
        if (excl[i]) continue;
        const r = rectOf('grid', frameConfig, null, i, img.width);
        if (r) out.push({ name: '', x: r.x, y: r.y, w: r.w, h: r.h });
      }
      setFrames(out);
      setExcludedFrames([]);
    }
    setMode(m);
    setSel(-1); setMulti([]);
  }

  // ── 애니 미리보기(rAF, 단일 재생) ─────────────────────────────────────────────
  function stopPreview() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPlayingAnim(-1);
  }
  // playingAnim 변경 시 rAF 루프 구동.
  useEffect(() => {
    if (playingAnim < 0 || !img) { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } return; }
    const a = anims[playingAnim];
    if (!a || !a.frames.length) return;
    let idx = 0, last = 0;
    const interval = 1000 / Math.max(1, a.fps);
    const tick = (ts) => {
      if (!last) last = ts;
      if (ts - last >= interval) {
        last = ts;
        const cvs = previewRef.current;
        if (cvs) {
          const fi = a.frames[idx % a.frames.length];
          const r = rectOf(mode, frameConfig, frames, fi, img.width);
          if (r) {
            const disp = Math.max(1, Math.min(6, Math.floor(96 / Math.max(r.w, r.h)) || 1));
            cvs.width = r.w; cvs.height = r.h;
            cvs.style.width = (r.w * disp) + 'px'; cvs.style.height = (r.h * disp) + 'px';
            if (isPixel) cvs.style.imageRendering = 'pixelated';
            try {
              const ctx = cvs.getContext('2d');
              ctx.clearRect(0, 0, r.w, r.h);
              ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
            } catch (e) {}
          }
        }
        idx++;
        if (!a.loop && idx >= a.frames.length) { rafRef.current = null; setPlayingAnim(-1); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [playingAnim, anims, mode, frameConfig, frames, img]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ── 애니 추가/삭제 ────────────────────────────────────────────────────────────
  const [newAnimKey, setNewAnimKey] = useState('');
  const [newAnimFps, setNewAnimFps] = useState(8);
  function addAnim() {
    if (!multi.length) return;
    const key = (newAnimKey || '').trim() || ('anim_' + (anims.length + 1));
    setAnims((prev) => prev.concat([{ key, frames: multi.slice(), fps: Math.max(1, parseInt(newAnimFps, 10) || 8), loop: true }]));
    setNewAnimKey(''); setMulti([]);
  }
  function removeAnim(ai) {
    if (playingAnim === ai) stopPreview();
    setAnims((prev) => { const next = prev.slice(); next.splice(ai, 1); return next; });
  }
  function patchAnim(ai, patch) {
    setAnims((prev) => { const next = prev.slice(); next[ai] = { ...next[ai], ...patch }; return next; });
  }

  // ── 선택 프레임 편집(free: 이름/삭제 / grid: 제외토글) ─────────────────────────
  function setSelName(v) {
    setFrames((prev) => { if (!prev) return prev; const next = prev.slice(); next[sel] = { ...next[sel], name: v }; return next; });
  }
  function deleteSel() {
    if (sel < 0) return;
    const removed = sel;
    setFrames((prev) => { if (!prev) return prev; const next = prev.slice(); next.splice(removed, 1); return next; });
    // 애니 프레임 참조 보정(삭제분 제거, 큰 인덱스 -1).
    setAnims((prev) => prev
      .map((a) => ({ ...a, frames: a.frames.filter((f) => f !== removed).map((f) => (f > removed ? f - 1 : f)) }))
      .filter((a) => a.frames.length));
    setSel(-1); setMulti([]);
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true); setSaveMsg('');
    const patch = { name: name.trim() || item.name };
    if (mode === 'grid') {
      patch.frameConfig = frameConfig;
      patch.frames = null;              // grid 우선 규칙: frames 가 null 이어야 frameConfig 사용
      patch.excludedFrames = excludedFrames.slice();
    } else {
      patch.frames = (frames || []).map((f) => ({ name: f.name || '', x: f.x, y: f.y, w: f.w, h: f.h }));
      patch.excludedFrames = [];
    }
    patch.anims = anims.map((a) => ({ key: a.key, frames: a.frames.slice(), fps: a.fps, loop: !!a.loop }));
    const r = await spriteApi.slice(relPath, patch);
    setSaving(false);
    if (!r.ok) { setSaveMsg('저장 실패: ' + (r.error || '')); return; }
    setSaveMsg('저장됨 ✓');
    if (onSaved) onSaved(r.item || { ...item, ...patch });
    setTimeout(() => { if (onClose) onClose(); }, 600);
  }

  const frameTotal = img ? countOf(mode, frameConfig, frames, img.width, img.height) : 0;

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div style={modal}>
        <div style={modalHead}>
          <span style={{ fontWeight: 600 }}>시트 편집 — {item.name || relPath}</span>
          <button style={closeBtn} onClick={() => onClose && onClose()}>✕</button>
        </div>
        {loadErr && <div style={{ padding: '12px', color: 'var(--danger)' }}>{loadErr}</div>}
        {!img && !loadErr && <div style={{ padding: '12px', color: 'var(--text-dim)' }}>이미지 로딩 중…</div>}
        {img && (
          <div style={body}>
            {/* 좌: 캔버스 스테이지 */}
            <div style={stage}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <canvas ref={baseRef} style={{ display: 'block', background: '#0e1016', borderRadius: '4px' }} />
                <canvas ref={overlayRef} onMouseDown={onMouseDown}
                        style={{ position: 'absolute', left: 0, top: 0, cursor: mode === 'free' ? 'crosshair' : 'pointer' }} />
              </div>
              <p style={hint}>
                프레임 {frameTotal}
                {mode === 'grid' && excludedFrames.length ? ` (제외 ${excludedFrames.length})` : ''}
                {' · 애니 '}{anims.length}
                {sel >= 0 ? ` · 선택 #${sel}` : ''}
              </p>
            </div>

            {/* 우: 컨트롤 패널 */}
            <div style={ctrlPanel}>
              <label style={field}>
                <span style={flabel}>항목 이름</span>
                <input style={inp} type="text" value={name} onInput={(e) => setName(e.target.value)} />
              </label>

              <div style={flabel}>분해 방식</div>
              <div style={row}>
                <button style={mode === 'grid' ? tabOn : tabOff} onClick={() => switchMode('grid')}>그리드</button>
                <button style={mode === 'free' ? tabOn : tabOff} onClick={() => switchMode('free')}>자유 영역</button>
              </div>

              {mode === 'grid' ? (
                <div>
                  <div style={gridFields}>
                    {[['frameWidth', '폭'], ['frameHeight', '높이'], ['margin', '여백'], ['spacing', '간격']].map(([k, lab]) => (
                      <label style={field} key={k}>
                        <span style={flabel}>{lab}</span>
                        <input style={numInp} type="number" min={(k === 'margin' || k === 'spacing') ? '0' : '1'}
                               value={frameConfig[k]}
                               onInput={(e) => setFrameConfig((p) => ({ ...p, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                      </label>
                    ))}
                  </div>
                  <p style={muted}>칸을 클릭하면 빈 프레임으로 제외/포함 토글됩니다.</p>
                </div>
              ) : (
                <p style={muted}>캔버스에서 드래그해 새 영역을 만들고, 영역을 클릭해 선택(Shift+클릭=다중)하세요.</p>
              )}

              {/* 선택 프레임 편집 */}
              <div style={subBox}>
                <div style={subHead}>선택 프레임</div>
                {sel < 0 ? (
                  <p style={muted}>캔버스에서 프레임을 선택하세요.</p>
                ) : mode === 'free' && frames && frames[sel] ? (
                  <div>
                    <label style={field}>
                      <span style={flabel}>이름</span>
                      <input style={inp} type="text" placeholder="예: idle_0" value={frames[sel].name || ''}
                             onInput={(e) => setSelName(e.target.value)} />
                    </label>
                    <p style={muted}>x{frames[sel].x} y{frames[sel].y} · {frames[sel].w}×{frames[sel].h}</p>
                    <div style={row}>
                      <button style={dangerBtn} onClick={deleteSel}>삭제</button>
                      <button style={smallBtn} onClick={() => toggleMulti(sel)}>
                        {multi.indexOf(sel) === -1 ? '다중선택 추가' : '다중선택 해제'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={muted}>칸 #{sel}{excludedFrames.indexOf(sel) !== -1 ? ' (제외됨)' : ''}</p>
                    <button style={smallBtn} onClick={() => toggleExcluded(sel)}>
                      {excludedFrames.indexOf(sel) !== -1 ? '포함하기' : '빈 프레임으로 제외'}
                    </button>
                  </div>
                )}
              </div>

              {/* 애니메이션 정의 */}
              <div style={subBox}>
                <div style={subHead}>애니메이션</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <input style={{ ...inp, flex: 1 }} type="text" placeholder="애니 키(예: run)"
                         value={newAnimKey} onInput={(e) => setNewAnimKey(e.target.value)} />
                  <input style={{ ...numInp, width: '54px' }} type="number" min="1" title="fps"
                         value={newAnimFps} onInput={(e) => setNewAnimFps(e.target.value)} />
                  <button style={{ ...smallBtn, whiteSpace: 'nowrap' }} disabled={!multi.length} onClick={addAnim}>
                    {multi.length ? `${multi.length}프레임 추가` : '다중선택 필요'}
                  </button>
                </div>
                <p style={muted}>Shift+클릭(자유) 또는 다중선택 버튼으로 프레임을 모은 뒤 추가하세요.</p>
                {anims.map((a, ai) => (
                  <div style={animRow} key={ai}>
                    <input style={{ ...inp, flex: 1, fontSize: '10px' }} value={a.key}
                           onInput={(e) => patchAnim(ai, { key: e.target.value })} />
                    <span style={{ ...muted, whiteSpace: 'nowrap' }}>[{a.frames.join(',')}] @{a.fps}fps</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px' }} title="반복">
                      <input type="checkbox" checked={!!a.loop} onChange={(e) => patchAnim(ai, { loop: e.target.checked })} />loop
                    </label>
                    <button style={miniBtn} onClick={() => (playingAnim === ai ? stopPreview() : setPlayingAnim(ai))}>
                      {playingAnim === ai ? '■' : '▶'}
                    </button>
                    <button style={{ ...miniBtn, color: 'var(--danger)' }} onClick={() => removeAnim(ai)}>✕</button>
                  </div>
                ))}
                {playingAnim >= 0 && (
                  <div style={{ marginTop: '6px', textAlign: 'center' }}>
                    <canvas ref={previewRef} style={{ background: '#0e1016', borderRadius: '4px' }} />
                  </div>
                )}
              </div>

              {/* 저장/닫기 */}
              <div style={foot}>
                {saveMsg && <span style={{ fontSize: '11px', color: saveMsg.indexOf('실패') >= 0 ? 'var(--danger)' : 'var(--ok)' }}>{saveMsg}</span>}
                <button style={ghostBtn} onClick={() => onClose && onClose()}>닫기</button>
                <button style={primaryBtn} disabled={saving} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일(패널 톤 일관: var(--panel)/var(--accent)/var(--border)) ─────────────
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(8,12,18,.72)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modal = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px',
  maxWidth: '900px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,.5)' };
const modalHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' };
const closeBtn = { background: 'transparent', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontSize: '15px' };
const body = { display: 'flex', gap: '12px', padding: '12px 14px', overflow: 'auto', minHeight: 0 };
const stage = { flex: '0 0 auto' };
const ctrlPanel = { flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' };
const hint = { fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' };
const field = { display: 'flex', flexDirection: 'column', gap: '2px' };
const flabel = { fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 };
const inp = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
const numInp = { ...inp, width: '100%' };
const gridFields = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' };
const row = { display: 'flex', gap: '4px' };
const tabOn = { flex: 1, background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px', padding: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 };
const tabOff = { flex: 1, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px', cursor: 'pointer', fontSize: '11px' };
const muted = { fontSize: '10px', color: 'var(--text-dim)', margin: '4px 0' };
const subBox = { borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '2px' };
const subHead = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' };
const smallBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 7px', cursor: 'pointer', fontSize: '11px' };
const dangerBtn = { ...smallBtn, color: 'var(--danger)', borderColor: 'var(--danger)' };
const miniBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' };
const animRow = { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' };
const foot = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' };
const ghostBtn = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' };
const primaryBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px', padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '11px' };
