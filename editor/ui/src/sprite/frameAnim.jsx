/* ============================================================================
 * frameAnim — 스프라이트시트 프레임 기하 + 라이브 애니 미리보기(공유)
 * ----------------------------------------------------------------------------
 * SpriteBrowser(라이브러리/애니에디터)와 Inspector(2E 애니메이터-lite)가 공유한다.
 * 단일 진실: 프레임 셀 rect 계산(rectOf)·프레임 수(frameCountOf)·rAF 미리보기(AnimPreview).
 * 모두 순수/자기완결 — 코어(scenekit*.js) 무관, 결정적 기하만(렌더는 캔버스 rAF).
 *   · rectOf(frameConfig, frames, i, imgW)        → {x,y,w,h} | null  (frames 우선, 없으면 grid)
 *   · frameCountOf(frameConfig, frames, imgW, imgH) → int
 *   · <AnimPreview img frameSeq fps pixel loop size /> → frameSeq 를 fps 로 순환 재생
 * SheetSlicer 의 슬라이스 규칙과 동일(읽기 전용).
 * ==========================================================================*/
import { useRef, useEffect } from 'preact/hooks';

// ── 순수 헬퍼: 프레임 기하(SheetSlicer 와 동일 규칙, 읽기 전용) ─────────────────
export function rectOf(frameConfig, frames, i, imgW) {
  if (frames && frames.length) {
    const f = frames[i];
    if (!f) return null;
    return { x: f.x || 0, y: f.y || 0, w: f.w || 0, h: f.h || 0 };
  }
  const fc = frameConfig || {};
  const fw = fc.frameWidth, fh = fc.frameHeight;
  if (!fw || !fh) return null;
  const mg = fc.margin || 0, sp = fc.spacing || 0;
  const cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
  const c = i % cols, r = Math.floor(i / cols);
  return { x: mg + c * (fw + sp), y: mg + r * (fh + sp), w: fw, h: fh };
}

export function frameCountOf(frameConfig, frames, imgW, imgH) {
  if (frames && frames.length) return frames.length;
  const fc = frameConfig || {};
  const fw = fc.frameWidth, fh = fc.frameHeight;
  if (!fw || !fh) return imgW && imgH ? 1 : 0;  // 메타 없으면 전체 1프레임
  const mg = fc.margin || 0, sp = fc.spacing || 0;
  const cols = Math.max(1, Math.floor((imgW - mg + sp) / (fw + sp)));
  const rows = Math.max(1, Math.floor((imgH - mg + sp) / (fh + sp)));
  return cols * rows;
}

// ── 라이브 애니 미리보기 canvas(rAF, 단일) ────────────────────────────────────
//  frameSeq = [{rect}] 순서대로 fps 로 순환. img 로드 완료 후 동작.
export function AnimPreview({ img, frameSeq, fps, pixel, loop = true, size = 64 }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!img || !frameSeq || !frameSeq.length) return;
    let idx = 0, last = 0;
    const interval = 1000 / Math.max(1, fps || 8);
    const tick = (ts) => {
      if (!last) last = ts;
      if (ts - last >= interval) {
        last = ts;
        const cvs = ref.current;
        const r = frameSeq[idx % frameSeq.length];
        if (cvs && r && r.w && r.h) {
          cvs.width = r.w; cvs.height = r.h;
          try {
            const ctx = cvs.getContext('2d');
            ctx.clearRect(0, 0, r.w, r.h);
            ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
          } catch (e) {}
        }
        idx++;
        if (!loop && idx >= frameSeq.length) { rafRef.current = null; return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [img, frameSeq, fps, loop]);
  const first = frameSeq && frameSeq[0];
  const disp = first && first.w && first.h ? Math.max(1, Math.min(6, Math.floor(size / Math.max(first.w, first.h)) || 1)) : 1;
  return (
    <canvas ref={ref}
      style={{
        width: first ? first.w * disp + 'px' : size + 'px',
        height: first ? first.h * disp + 'px' : size + 'px',
        imageRendering: pixel ? 'pixelated' : 'auto',
        background: '#0e1016', borderRadius: '4px', border: '1px solid var(--accent)'
      }} />
  );
}
