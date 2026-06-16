/* ============================================================================
 * TilePalette — 타일 페인팅 팔레트 바 (결함1 수정: library() 소비)
 * ----------------------------------------------------------------------------
 * paintMode ON 시 Toolbar 아래 가로 팔레트 바로 표시.
 *
 * 데이터 소스: spriteApi.library() — frameConfig 보유 시트(kind!='collection')만 필터.
 * 브리지 미연결(local, library() ok:false) → 안내문 폴백.
 *
 * 셀 클릭 흐름:
 *   spriteApi.use({ relPath, frameConfig, frames, license, credit })
 *     → asset.id (씬 자산 id, Sprite.sprite 가 참조하는 것)
 *     → onSelect({ assetId: asset.id, frame })
 * use() 는 시트당 1회만: 같은 relPath 로 이미 use 한 결과는 캐시 재사용(중복 use 방지).
 *
 * Props:
 *   controller   — editorController 인스턴스 (현재 직접 미사용, 향후 확장용)
 *   selectedTile — {assetId:string, frame:number} | null
 *   onSelect     — (tile: {assetId, frame} | null) => void
 * ========================================================================== */
import { useState, useEffect, useRef } from 'preact/hooks';
import { spriteApi } from './sprite/spriteApi.js';
import { rectOf, frameCountOf } from './sprite/frameAnim.jsx';

// ── 이미지 로드 캐시 (URL → HTMLImageElement | 'error') ──────────────────────
const imgCache = {};

function loadImg(url, onDone) {
  if (!url) { onDone('error'); return; }
  const hit = imgCache[url];
  if (hit) { onDone(hit); return; }
  const img = new Image();
  img.onload = () => { imgCache[url] = img; onDone(img); };
  img.onerror = () => { imgCache[url] = 'error'; onDone('error'); };
  img.src = url;
}

// ── use() 결과 캐시 (relPath → Promise<string|null> | string | null) ─────────
// 시트당 1회만 use() 를 호출. 이후 재클릭은 캐시된 assetId 를 즉시 반환.
const useCache = {};

async function getOrUseSheet(sheet) {
  const key = sheet.relPath;
  if (!key) return null;

  // 완료된 캐시(문자열 assetId 또는 null)
  if (Object.prototype.hasOwnProperty.call(useCache, key) &&
      typeof useCache[key] !== 'object') {
    return useCache[key];
  }

  // 진행 중인 Promise 재사용
  if (useCache[key] && typeof useCache[key].then === 'function') {
    return useCache[key];
  }

  // 새 use() 호출
  const p = spriteApi.use({
    relPath: sheet.relPath,
    frameConfig: sheet.frameConfig || undefined,
    frames: (sheet.frames && sheet.frames.length) ? sheet.frames : undefined,
    license: sheet.license || undefined,
    credit: sheet.credit || undefined
  }).then((r) => {
    if (!r || !r.ok) {
      delete useCache[key];   // 실패 시 제거 → 재시도 가능
      return null;
    }
    const id = r.asset && r.asset.id;
    useCache[key] = id || null;   // 문자열로 교체(Promise 종료)
    return id || null;
  }).catch(() => {
    delete useCache[key];
    return null;
  });

  useCache[key] = p;
  return p;
}

// ── 단일 셀 canvas 렌더 ───────────────────────────────────────────────────────
function CellCanvas({ img, rect, size, active, onClick }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !img || img === 'error' || !rect) return;
    const c = ref.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, size, size);
  }, [img, rect, size]);

  return (
    <canvas ref={ref} width={size} height={size} onClick={onClick}
      style={{
        cursor: 'pointer',
        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: '2px',
        boxSizing: 'border-box',
        imageRendering: 'pixelated',
        background: active ? 'rgba(79,208,255,0.12)' : 'var(--bg)',
        flexShrink: 0
      }} />
  );
}

// ── 시트 셀 그리드 (라이브러리 item 기반) ─────────────────────────────────────
function SheetGrid({ sheet, selectedFrame, onSelectFrame }) {
  const [img, setImg] = useState(null);
  const CELL = 28;

  useEffect(() => {
    if (!sheet) return;
    setImg(null);
    const src = spriteApi.assetUrl(sheet.url || sheet.relPath || '');
    if (!src) return;
    loadImg(src, setImg);
  }, [sheet && (sheet.url || sheet.relPath)]);

  if (!sheet) return null;

  if (!img) {
    return <span style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '0 6px' }}>로딩 중…</span>;
  }
  if (img === 'error') {
    return <span style={{ color: 'var(--danger)', fontSize: '11px', padding: '0 6px' }}>이미지 오류</span>;
  }

  const fc = sheet.frameConfig || {};
  const frames = sheet.frames || null;
  const count = frameCountOf(fc, frames, img.naturalWidth, img.naturalHeight);

  if (!count) {
    return <span style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '0 6px' }}>프레임 없음</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center',
                  flexWrap: 'nowrap', overflowX: 'auto',
                  padding: '2px 4px', maxWidth: '480px' }}>
      {Array.from({ length: count }, (_, i) => {
        const rect = rectOf(fc, frames, i, img.naturalWidth);
        return (
          <CellCanvas key={i} img={img} rect={rect} size={CELL}
            active={selectedFrame === i}
            onClick={() => onSelectFrame(i)} />
        );
      })}
    </div>
  );
}

// ── 메인 팔레트 컴포넌트 ──────────────────────────────────────────────────────
export function TilePalette({ controller, selectedTile, onSelect }) {
  // library() 로 가져온 시트 목록(frameConfig 있는 것만). null = 로딩 중.
  const [sheets, setSheets] = useState(null);
  const [libErr, setLibErr] = useState('');
  // 현재 선택된 시트의 relPath.
  const [activeRelPath, setActiveRelPath] = useState(null);
  // use() 진행 중 플래그.
  const [using, setUsing] = useState(false);
  const [useErr, setUseErr] = useState('');

  // 라이브러리 로드 — 마운트 1회.
  useEffect(() => {
    setSheets(null); setLibErr('');
    spriteApi.library().then((r) => {
      if (!r.ok) {
        setLibErr(r.error || '라이브러리 조회 실패');
        setSheets([]);
        return;
      }
      // kind !== 'collection' 이고 frameConfig 있는 것만 타일셋으로 간주.
      const filtered = (r.items || []).filter(
        (it) => it.kind !== 'collection' &&
                 it.frameConfig &&
                 it.frameConfig.frameWidth > 0 &&
                 it.frameConfig.frameHeight > 0
      );
      setSheets(filtered);
    });
  }, []);

  const activeSheet = (sheets && activeRelPath)
    ? sheets.find((s) => s.relPath === activeRelPath) || null
    : null;

  // 드롭다운 시트 변경.
  function handleSheetChange(relPath) {
    setActiveRelPath(relPath || null);
    setUseErr('');
    if (!relPath) onSelect(null);
    // 셀 클릭 전까지 onSelect 는 호출하지 않음(use() 필요).
  }

  // 셀 클릭 → use() → onSelect.
  async function handleSelectFrame(frame) {
    if (!activeSheet) return;
    setUsing(true); setUseErr('');
    try {
      const assetId = await getOrUseSheet(activeSheet);
      if (!assetId) {
        setUseErr('씬 자산 등록 실패(브리지·409 확인)');
        setUsing(false);
        return;
      }
      onSelect({ assetId, frame });
    } catch (_) {
      setUseErr('use 오류');
    }
    setUsing(false);
  }

  // 선택된 셀 frame (activeRelPath 와 selectedTile 이 일치하는 경우).
  const currentFrame = selectedTile != null ? selectedTile.frame : null;
  const isRemote = spriteApi.isRemote();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', background: 'var(--panel2)',
      borderBottom: '1px solid var(--border)', overflowX: 'auto',
      minHeight: '40px', flexShrink: 0
    }}>
      {/* 비연결 안내 */}
      {!isRemote && (
        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
          (브리지 미연결 — 타일셋은 브리지 연결 후 라이브러리에서 표시됩니다)
        </span>
      )}

      {isRemote && (
        <>
          <span style={{ color: 'var(--text-dim)', fontSize: '11px', whiteSpace: 'nowrap' }}>타일셋:</span>

          {sheets === null && (
            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>라이브러리 로딩 중…</span>
          )}

          {libErr && (
            <span style={{ color: 'var(--danger)', fontSize: '11px' }}>{libErr}</span>
          )}

          {sheets !== null && !libErr && sheets.length === 0 && (
            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              (frameConfig 있는 시트 없음 — 에셋 브라우저 → 라이브러리에서 시트를 추가하세요)
            </span>
          )}

          {sheets !== null && sheets.length > 0 && (
            <select value={activeRelPath || ''}
              onChange={(e) => handleSheetChange(e.target.value || null)}
              style={{
                background: 'var(--bg)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '3px',
                padding: '2px 4px', fontSize: '11px'
              }}>
              <option value="">-- 시트 선택 --</option>
              {sheets.map((s) => (
                <option key={s.relPath} value={s.relPath}>
                  {s.name || s.relPath}
                </option>
              ))}
            </select>
          )}

          {/* 셀 그리드 */}
          {activeSheet && (
            <>
              <span style={{ color: 'var(--border)', fontSize: '12px' }}>|</span>
              <SheetGrid
                sheet={activeSheet}
                selectedFrame={activeRelPath ? currentFrame : null}
                onSelectFrame={handleSelectFrame}
              />
            </>
          )}

          {using && (
            <span style={{ color: 'var(--text-dim)', fontSize: '11px', whiteSpace: 'nowrap' }}>
              씬 자산 등록 중…
            </span>
          )}

          {useErr && (
            <span style={{ color: 'var(--danger)', fontSize: '11px', whiteSpace: 'nowrap' }}>
              {useErr}
            </span>
          )}

          {selectedTile && !using && (
            <span style={{ color: 'var(--accent)', fontSize: '11px', whiteSpace: 'nowrap',
                           marginLeft: '4px', flexShrink: 0 }}>
              {selectedTile.assetId} #{selectedTile.frame}
            </span>
          )}
        </>
      )}
    </div>
  );
}
