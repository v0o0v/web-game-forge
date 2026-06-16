/* ============================================================================
 * SpriteBrowser — 통합 스프라이트 브라우저 본문(탭 3개) (Lane B)
 * ----------------------------------------------------------------------------
 * 계약 §3.2. AssetBrowser 가 이 컴포넌트를 렌더(panels.assets 불변).
 * 탭: 라이브러리(메인) / 카탈로그 / 씬에셋.
 *  - 라이브러리: library() → 팩별 그룹 → 시트/컬렉션 → 프레임 그리드(canvas 슬라이스) +
 *    라이브 애니 미리보기 + "선택 엔티티에 적용" + "시트 편집"(SheetSlicer) + HTML5 드래그.
 *  - 카탈로그: catalog() → 팩 카드(썸네일 lazy-load·안전 배지·태그) + 검색(debounce)/필터 +
 *    상세(다운로드: cc0 & !downloaded). 다운로드 완료 후 라이브러리 새로고침.
 *  - 씬에셋: world.assets.sprites + 절차/CC0-URL/Unity 임포트(기존 AssetBrowser 보존).
 *
 * props: { controller, selection, importers }
 *   importers = { ProceduralDefiner, Cc0Adder, UnityFolderImporter }  (AssetBrowser 가 주입)
 *
 * 적용 흐름(§4.2): use({relPath,frameConfig,frame,license,credit}) → asset.id →
 *   controller.assignAssetToEntity(selection[0], asset.id, { frame, as, anims, play }).
 * ==========================================================================*/
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { spriteApi } from './spriteApi.js';
import { SheetSlicer } from './SheetSlicer.jsx';
import { rectOf, frameCountOf, AnimPreview } from './frameAnim.jsx';

// 안전 등급 배지 색.
const TIER_COLOR = {
  'cc0': '#1a6e3c', 'permissive-attribution': '#b8860b', 'mixed-per-item': '#7a5cff', 'avoid': '#c0392b'
};
const TIER_LABEL = {
  'cc0': 'CC0', 'permissive-attribution': '표기필요', 'mixed-per-item': '항목별', 'avoid': '주의'
};

// rectOf·frameCountOf 는 ./frameAnim.jsx 로 추출(Inspector 2E 와 공유). 상단 import.

// ── 단일 프레임 canvas(시트 슬라이스 또는 컬렉션 개별 파일) ─────────────────────
//  · 시트: img(로드 완료) + rect 로 그린다.
//  · pixel 스타일은 imageRendering: pixelated.
function FrameCanvas({ img, rect, pixel, size = 48, selected, excluded, onClick, title }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !img || !rect || !rect.w || !rect.h) return;
    cv.width = rect.w; cv.height = rect.h;
    try {
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, rect.w, rect.h);
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    } catch (e) {}
  }, [img, rect && rect.x, rect && rect.y, rect && rect.w, rect && rect.h]);
  // 표시 배율: 셀을 size px 박스에 맞춤.
  const disp = rect && rect.w && rect.h ? Math.max(1, Math.min(8, Math.floor(size / Math.max(rect.w, rect.h)) || 1)) : 1;
  return (
    <canvas ref={ref} title={title}
      onClick={onClick}
      style={{
        width: rect ? rect.w * disp + 'px' : size + 'px',
        height: rect ? rect.h * disp + 'px' : size + 'px',
        imageRendering: pixel ? 'pixelated' : 'auto',
        background: '#0e1016', borderRadius: '3px', cursor: onClick ? 'pointer' : 'default',
        outline: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
        opacity: excluded ? 0.35 : 1
      }} />
  );
}

// AnimPreview(라이브 애니 미리보기 canvas)는 ./frameAnim.jsx 로 추출(Inspector 2E 와 공유). 상단 import.

// ── 라이브러리 항목(시트/컬렉션) 카드 — 펼치면 프레임 그리드 + 애니 미리보기 ─────
//  애니 미리보기 동시 개수는 부모(LibraryTab) 의 previewCount/maxPreview 로 제한(§3.4).
function LibraryItem({ item, onApply, onEdit, onEditAnim, selectedFrame, onSelectFrame, previewCount, maxPreview, onPreviewToggle }) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState(null);          // 시트 단일 이미지
  const [collImgs, setCollImgs] = useState(null); // 컬렉션 개별 이미지 배열
  const [err, setErr] = useState('');
  const [showAnim, setShowAnim] = useState(false);
  const pixel = item.style !== 'smooth' && item.style !== 'vector';
  const isCollection = item.kind === 'collection';

  // 미리보기 토글 — 부모 카운트 증감(동시 개수 상한 enforce). 언마운트/접힘 시 자동 정리.
  function toggleAnim() {
    setShowAnim((prev) => { const next = !prev; onPreviewToggle(next); return next; });
  }
  useEffect(() => () => { if (showAnim) onPreviewToggle(false); }, []); // 언마운트 시 카운트 반납
  useEffect(() => { if (!open && showAnim) { setShowAnim(false); onPreviewToggle(false); } }, [open]); // 접으면 정리

  // 펼칠 때만 이미지 로드(lazy).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (isCollection) {
      const files = (item.files || []).slice(0, 256); // 상한
      Promise.all(files.map((f) => spriteApi.loadImage(spriteApi.assetUrl(f)).catch(() => null)))
        .then((imgs) => { if (alive) setCollImgs(imgs); });
    } else {
      spriteApi.loadImage(spriteApi.assetUrl(item.url || item.relPath)).then(
        (im) => { if (alive) setImg(im); },
        () => { if (alive) setErr('이미지 로드 실패'); }
      );
    }
    return () => { alive = false; };
  }, [open]);

  // 시트 프레임 수.
  const frameCount = isCollection
    ? (item.files || []).length
    : (img ? frameCountOf(item.frameConfig, item.frames, img.width, img.height) : 0);

  // 애니 미리보기 시퀀스(anims 우선, 없으면 전체 프레임 순환).
  //  useMemo 로 안정 참조 — 매 부모 렌더마다 새 배열이면 AnimPreview rAF 가 재시작된다(M-2).
  //  컬렉션은 개별 이미지라 시퀀스 null(애니 미리보기 비대상).
  const animSeq = useMemo(() => {
    if (isCollection) return null;
    if (!img) return [];
    const exclSet = {}; (item.excludedFrames || []).forEach((i) => { exclSet[i] = true; });
    let indices;
    if (item.anims && item.anims.length && item.anims[0].frames && item.anims[0].frames.length) {
      indices = item.anims[0].frames;
    } else {
      indices = [];
      for (let i = 0; i < frameCount; i++) { if (!exclSet[i]) indices.push(i); }
    }
    return indices.map((i) => rectOf(item.frameConfig, item.frames, i, img.width)).filter(Boolean);
  }, [isCollection, item.anims, item.frameConfig, item.frames, img, frameCount, item.excludedFrames]);
  const animFps = (item.anims && item.anims[0] && (item.anims[0].fps || item.anims[0].frameRate)) || 8;

  // 드래그 페이로드(§3.2): application/wgf-asset 에 JSON {relPath, frame, as}.
  //  · collection: 각 파일이 단일 이미지 1프레임 → relPath=filesRel[frame], frame 은 싣지 않음.
  //  · sheet: relPath=item.relPath + frame(시트 셀 인덱스).
  //  빈 relPath 는 절대 싣지 않는다(Hierarchy 오염 차단).
  function onFrameDragStart(e, frame) {
    try {
      let payload;
      if (isCollection) {
        const rel = (item.filesRel && frame != null) ? item.filesRel[frame] : null;
        if (!rel) return;   // filesRel 누락/범위 밖 — 빈 드래그 금지
        payload = JSON.stringify({ relPath: rel, as: 'Sprite' });
      } else {
        if (!item.relPath) return;
        payload = JSON.stringify({ relPath: item.relPath, frame: frame == null ? null : frame, as: 'Sprite' });
      }
      e.dataTransfer.setData('application/wgf-asset', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) {}
  }

  const canPreviewAnim = previewCount < maxPreview;
  // 시트가 동작 클립(anims)을 가지면 "하나의 캐릭터(AnimatedSprite)"로 통째로 드래그 가능(D4).
  const hasAnims = !isCollection && !!(item.anims && item.anims.length);

  // 캐릭터 드래그 페이로드(§드래그 페이로드): 시트 전체 + anims + 기본 play.
  //  anims 가 없으면 비활성(먼저 자동분석/편집해 클립 생성 안내). 빈 relPath 는 싣지 않는다.
  function onCharacterDragStart(e) {
    try {
      if (!hasAnims || !item.relPath) { e.preventDefault(); return; }
      // frameConfig/frames 를 페이로드에 실어 use 가 vendored asset 레코드에 보존하게 한다.
      //  (어댑터가 시트를 셀로 슬라이싱하려면 이 메타가 필요 — 없으면 시트 전체 한 장으로 렌더된다.)
      const payload = JSON.stringify({
        relPath: item.relPath,
        as: 'AnimatedSprite',
        anims: item.anims,
        play: (item.anims[0] && (item.anims[0].key || item.anims[0].name)) || undefined,
        frameConfig: item.frameConfig,
        frames: (item.frames && item.frames.length) ? item.frames : undefined
      });
      e.dataTransfer.setData('application/wgf-asset', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) {}
  }

  return (
    <div style={libItem}>
      <div style={libItemHead} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.relPath}>
          {item.name || item.relPath}
        </span>
        {/* 캐릭터로 드래그(시트+anims → AnimatedSprite). anims 없으면 비활성. */}
        {!isCollection && (
          <span draggable={hasAnims}
                onDragStart={onCharacterDragStart}
                onClick={(e) => e.stopPropagation()}
                style={hasAnims ? dragHandle : dragHandleOff}
                title={hasAnims ? '캐릭터로 드래그(전체 동작 AnimatedSprite) → 씬/뷰포트에 드롭' : '먼저 "애니 편집"으로 동작 클립을 만들면 캐릭터로 드래그할 수 있습니다'}>
            🧍
          </span>
        )}
        <span style={kindBadge}>{isCollection ? `컬렉션 ${item.count || (item.files || []).length}` : '시트'}</span>
      </div>
      {open && (
        <div style={{ padding: '6px 8px' }}>
          {err && <div style={{ color: 'var(--danger)', fontSize: '11px' }}>{err}</div>}
          {/* 액션 바 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <button style={miniAction} onClick={() => onApply(item, selectedFrame)}>선택 엔티티에 적용</button>
            {!isCollection && <button style={miniAction} onClick={() => onEdit(item)}>시트 편집</button>}
            {!isCollection && <button style={hasAnims ? miniActionOn : miniAction} onClick={() => onEditAnim(item)} title="동작별 애니메이션 클립 편집·자동분석">{hasAnims ? `애니 편집(${item.anims.length})` : '애니 편집'}</button>}
            {!isCollection && img && frameCount > 1 && (
              <button style={showAnim ? miniActionOn : miniAction}
                      onClick={toggleAnim}
                      disabled={!showAnim && !canPreviewAnim}
                      title={!canPreviewAnim && !showAnim ? '애니 미리보기 동시 개수 한도' : ''}>
                {showAnim ? '■ 애니' : '▶ 애니'}
              </button>
            )}
          </div>
          {/* 애니 라이브 미리보기 */}
          {showAnim && !isCollection && img && (
            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AnimPreview img={img} frameSeq={animSeq} fps={animFps} pixel={pixel} size={72} />
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                {item.anims && item.anims.length ? `애니 "${item.anims[0].key || item.anims[0].name}" @${animFps}fps` : `전체 ${frameCount}프레임 @${animFps}fps`}
              </span>
            </div>
          )}
          {/* 프레임 그리드 */}
          {!isCollection && img && (
            <SheetFrameGrid item={item} img={img} pixel={pixel} frameCount={frameCount}
                            selectedFrame={selectedFrame} onSelectFrame={onSelectFrame}
                            onFrameDragStart={onFrameDragStart} onApply={onApply} />
          )}
          {isCollection && collImgs && (
            <CollectionFrameGrid item={item} imgs={collImgs} pixel={pixel}
                                 selectedFrame={selectedFrame} onSelectFrame={onSelectFrame}
                                 onFrameDragStart={onFrameDragStart} onApply={onApply} />
          )}
          {!img && !collImgs && !err && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>로딩 중…</div>}
        </div>
      )}
    </div>
  );
}

// 시트 프레임 그리드(canvas 슬라이스).
function SheetFrameGrid({ item, img, pixel, frameCount, selectedFrame, onSelectFrame, onFrameDragStart, onApply }) {
  const exclSet = {}; (item.excludedFrames || []).forEach((i) => { exclSet[i] = true; });
  const cells = [];
  for (let i = 0; i < frameCount; i++) {
    const r = rectOf(item.frameConfig, item.frames, i, img.width);
    if (!r || !r.w || !r.h) continue;
    const fname = (item.frames && item.frames[i] && item.frames[i].name) ? item.frames[i].name : ('#' + i);
    cells.push(
      <div key={i} draggable onDragStart={(e) => onFrameDragStart(e, i)}
           style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
           onDblClick={() => onApply(item, i)}>
        <FrameCanvas img={img} rect={r} pixel={pixel} size={44}
                     selected={selectedFrame === i} excluded={!!exclSet[i]} title={fname + ' — 클릭 선택 / 더블클릭 적용'}
                     onClick={() => onSelectFrame(i)} />
        <span style={frameIdx}>{fname}</span>
      </div>
    );
  }
  if (!cells.length) {
    return <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>프레임 메타 없음 — "시트 편집"으로 그리드를 지정하세요.</div>;
  }
  return <div style={frameGrid}>{cells}</div>;
}

// 컬렉션 프레임 그리드(개별 이미지 = 프레임).
function CollectionFrameGrid({ item, imgs, pixel, selectedFrame, onSelectFrame, onFrameDragStart, onApply }) {
  const cells = imgs.map((im, i) => {
    if (!im) return null;
    const r = { x: 0, y: 0, w: im.width, h: im.height };
    return (
      <div key={i} draggable onDragStart={(e) => onFrameDragStart(e, i)}
           style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
           onDblClick={() => onApply(item, i)}>
        <FrameCanvas img={im} rect={r} pixel={pixel} size={44}
                     selected={selectedFrame === i} title={'#' + i + ' — 클릭 선택 / 더블클릭 적용'}
                     onClick={() => onSelectFrame(i)} />
        <span style={frameIdx}>#{i}</span>
      </div>
    );
  }).filter(Boolean);
  return <div style={frameGrid}>{cells}</div>;
}

// ── 적용 옵션 팝오버(정적 Sprite / 애니 AnimatedSprite 선택) ────────────────────
function ApplyDialog({ item, frame, onConfirm, onCancel }) {
  const hasAnims = !!(item.anims && item.anims.length);
  const [as, setAs] = useState(hasAnims ? 'AnimatedSprite' : 'Sprite');
  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={applyModal}>
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>엔티티에 적용</div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>
          {item.name || item.relPath}{frame != null ? ` · 프레임 #${frame}` : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          <label style={radioRow}>
            <input type="radio" name="as" checked={as === 'Sprite'} onChange={() => setAs('Sprite')} />
            <span><b>정적 Sprite</b> — 단일 프레임{frame != null ? ` (#${frame})` : ''}</span>
          </label>
          <label style={{ ...radioRow, opacity: hasAnims ? 1 : 0.5 }}>
            <input type="radio" name="as" checked={as === 'AnimatedSprite'} disabled={!hasAnims} onChange={() => setAs('AnimatedSprite')} />
            <span><b>애니 AnimatedSprite</b> — {hasAnims ? `${item.anims.length}개 애니 재생` : '애니 정의 없음(시트 편집에서 추가)'}</span>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button style={ghostBtn} onClick={onCancel}>취소</button>
          <button style={primaryBtn} onClick={() => onConfirm(as)}>적용</button>
        </div>
      </div>
    </div>
  );
}

// ── 시트 애니메이션 에디터(D3) — "동작별 애니메이션" 클립 편집 모달 ──────────────
//  SheetSlicer(그리드/영역 지오메트리 편집)와 별개로, 이미 슬라이싱된 시트의 anims[] 를
//  "동작 클립"으로 편집한다. AnimPreview·FrameCanvas·rectOf·frameCountOf(상단 헬퍼) 재사용.
//
//  · 프레임 그리드: 클릭 토글 다중선택, Shift+클릭 범위선택. 선택 순서를 클립 frames[] 로.
//  · 클립 목록: key 인라인 편집, fps 숫자, loop 체크박스, 삭제, ▶ 라이브 프리뷰(AnimPreview),
//    "선택 프레임으로 설정"(현재 다중선택을 그 클립 frames 로 덮어쓰기).
//  · 클립 추가: 이름·fps·loop 지정 → 현재 다중선택을 frames 로.
//  · "동작 자동 분석": spriteApi.analyze({relPath,w,h,frameConfig}) → 반환 anims 로 채움(대체/병합).
//  · 저장: spriteApi.slice(relPath, { name?, frameConfig?, frames?, anims }).
function AnimEditor({ item, onClose, onSaved }) {
  const [img, setImg] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [sel, setSel] = useState([]);              // 다중선택 프레임 인덱스(선택 순서 보존)
  const [lastClicked, setLastClicked] = useState(-1); // Shift 범위선택 기준
  const [anims, setAnims] = useState(
    (item.anims || []).map((a) => ({ key: a.key || a.name || 'anim', frames: (a.frames || []).slice(), fps: a.fps || a.frameRate || 8, loop: a.loop != null ? !!a.loop : true }))
  );
  const [playing, setPlaying] = useState(-1);       // 라이브 프리뷰 중인 클립 index
  const [newKey, setNewKey] = useState('');
  const [newFps, setNewFps] = useState(8);
  const [newLoop, setNewLoop] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const pixel = item.style !== 'smooth' && item.style !== 'vector';
  const relPath = item.relPath || '';

  // 이미지 로드(동시성 제한 경유).
  useEffect(() => {
    let alive = true;
    spriteApi.loadImage(spriteApi.assetUrl(item.url || item.relPath)).then(
      (im) => { if (alive) setImg(im); },
      () => { if (alive) setLoadErr('이미지를 불러오지 못했습니다.'); }
    );
    return () => { alive = false; };
  }, [item.url, item.relPath]);

  const frameCount = img ? frameCountOf(item.frameConfig, item.frames, img.width, img.height) : 0;

  // 클립 frames → rect 시퀀스(AnimPreview 용). useMemo 로 안정 참조(rAF 재시작 방지).
  const playSeq = useMemo(() => {
    if (playing < 0 || !img || !anims[playing]) return [];
    return (anims[playing].frames || [])
      .map((i) => rectOf(item.frameConfig, item.frames, i, img.width))
      .filter(Boolean);
  }, [playing, anims, img, item.frameConfig, item.frames]);
  const playFps = (playing >= 0 && anims[playing] && anims[playing].fps) || 8;
  const playLoop = playing >= 0 && anims[playing] ? !!anims[playing].loop : true;

  // 프레임 클릭: 일반=토글, Shift=lastClicked~i 범위 추가.
  function clickFrame(i, e) {
    if (e && e.shiftKey && lastClicked >= 0) {
      const lo = Math.min(lastClicked, i), hi = Math.max(lastClicked, i);
      setSel((prev) => {
        const next = prev.slice();
        for (let k = lo; k <= hi; k++) if (next.indexOf(k) === -1) next.push(k);
        return next;
      });
    } else {
      setSel((prev) => {
        const k = prev.indexOf(i);
        return k === -1 ? prev.concat([i]) : prev.filter((x) => x !== i);
      });
    }
    setLastClicked(i);
  }
  function clearSel() { setSel([]); setLastClicked(-1); }

  // 선택 프레임으로 즉석 클립 캐릭터 드래그(1E) — 다중선택을 임시 anims[1] 로 만들어
  //  AnimatedSprite 페이로드로 드래그한다(저장 없이도 드롭→엔티티화 가능).
  //  선택 순서가 곧 클립 frames[] 순서. 빈 선택/빈 relPath 면 드래그 금지.
  //  frameConfig/frames 메타도 실어 어댑터가 시트를 셀로 슬라이싱하게 한다(없으면 전체 1장 렌더).
  function onSelectionDragStart(e) {
    try {
      if (!sel.length || !relPath) { e.preventDefault(); return; }
      const clip = { key: 'clip', frames: sel.slice(), fps: Math.max(1, parseInt(newFps, 10) || 8), loop: !!newLoop };
      const payload = JSON.stringify({
        relPath: relPath,
        as: 'AnimatedSprite',
        anims: [clip],
        play: clip.key,
        frameConfig: item.frameConfig,
        frames: (item.frames && item.frames.length) ? item.frames : undefined
      });
      e.dataTransfer.setData('application/wgf-asset', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) {}
  }

  // 클립 조작.
  function addClip() {
    if (!sel.length) { setMsg('프레임을 먼저 선택하세요'); return; }
    const key = (newKey || '').trim() || ('anim_' + (anims.length + 1));
    setAnims((prev) => prev.concat([{ key, frames: sel.slice(), fps: Math.max(1, parseInt(newFps, 10) || 8), loop: !!newLoop }]));
    setNewKey(''); clearSel(); setMsg('');
  }
  function removeClip(ci) {
    if (playing === ci) setPlaying(-1);
    setAnims((prev) => { const next = prev.slice(); next.splice(ci, 1); return next; });
  }
  function patchClip(ci, patch) {
    setAnims((prev) => { const next = prev.slice(); next[ci] = { ...next[ci], ...patch }; return next; });
  }
  function setClipFramesFromSel(ci) {
    if (!sel.length) { setMsg('프레임을 먼저 선택하세요'); return; }
    patchClip(ci, { frames: sel.slice() });
    setMsg('');
  }
  function loadClipToSel(ci) {
    const a = anims[ci];
    if (a) { setSel((a.frames || []).slice()); setLastClicked(a.frames && a.frames.length ? a.frames[a.frames.length - 1] : -1); }
  }

  // 동작 자동 분석 — 이미지 실제 픽셀 크기 + frameConfig 로 analyze 호출, 반환 anims 로 대체.
  async function autoAnalyze() {
    setAnalyzing(true); setMsg('');
    const body = { relPath };
    if (img) { body.w = img.naturalWidth || img.width; body.h = img.naturalHeight || img.height; }
    if (item.frameConfig) body.frameConfig = item.frameConfig;
    const r = await spriteApi.analyze(body);
    setAnalyzing(false);
    if (!r.ok) { setMsg('자동 분석 실패: ' + (r.error || '')); return; }
    const got = (r.anims || []).map((a) => ({ key: a.key || a.name || 'anim', frames: (a.frames || []).slice(), fps: a.fps || a.frameRate || 8, loop: a.loop != null ? !!a.loop : true }));
    if (!got.length) { setMsg('분석된 동작 클립이 없습니다(그리드/사이드카 메타 확인).'); return; }
    setPlaying(-1);
    setAnims(got);
    setMsg(`동작 ${got.length}개 자동 도출됨 — 검토 후 저장하세요.`);
  }

  // 저장 — anims 보존(frameConfig/frames 도 함께 보내 라운드트립 안전).
  async function save() {
    setSaving(true); setMsg('');
    const patch = { anims: anims.map((a) => ({ key: a.key, frames: a.frames.slice(), fps: a.fps, loop: !!a.loop })) };
    if (item.name) patch.name = item.name;
    if (item.frameConfig) patch.frameConfig = item.frameConfig;
    if (item.frames && item.frames.length) patch.frames = item.frames;
    const r = await spriteApi.slice(relPath, patch);
    setSaving(false);
    if (!r.ok) { setMsg('저장 실패: ' + (r.error || '')); return; }
    setMsg('저장됨 ✓');
    if (onSaved) onSaved(r.item || { ...item, ...patch });
    setTimeout(() => { if (onClose) onClose(); }, 600);
  }

  // 프레임 그리드 셀.
  const cells = [];
  if (img) {
    for (let i = 0; i < frameCount; i++) {
      const r = rectOf(item.frameConfig, item.frames, i, img.width);
      if (!r || !r.w || !r.h) continue;
      const order = sel.indexOf(i);
      cells.push(
        <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <FrameCanvas img={img} rect={r} pixel={pixel} size={40}
                       selected={order !== -1} title={'#' + i + ' — 클릭 선택 / Shift 범위'}
                       onClick={(e) => clickFrame(i, e)} />
          {order !== -1 && <span style={animOrderBadge}>{order + 1}</span>}
          <span style={frameIdx}>#{i}</span>
        </div>
      );
    }
  }

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div style={animModal}>
        <div style={modalHead}>
          <span style={{ fontWeight: 600 }}>동작 애니메이션 편집 — {item.name || relPath}</span>
          <button style={closeBtn} onClick={() => onClose && onClose()}>✕</button>
        </div>
        {loadErr && <div style={{ padding: '12px', color: 'var(--danger)' }}>{loadErr}</div>}
        {!img && !loadErr && <div style={{ padding: '12px', color: 'var(--text-dim)' }}>이미지 로딩 중…</div>}
        {img && (
          <div style={animBody}>
            {/* 좌: 프레임 선택 그리드 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={subHead}>프레임 선택</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{sel.length ? `${sel.length}개 선택(순서대로)` : '클릭으로 선택, Shift+클릭 범위'}</span>
                {sel.length > 0 && <button style={miniAction} onClick={clearSel}>선택 해제</button>}
                {/* 다중선택 프레임을 즉석 클립으로 통째 드래그(1E) — 저장 없이 드롭→AnimatedSprite 엔티티화. */}
                {sel.length > 0 && (
                  <span draggable
                        onDragStart={onSelectionDragStart}
                        style={dragHandle}
                        title={`선택한 ${sel.length}프레임을 캐릭터(AnimatedSprite)로 드래그 → 씬/뷰포트에 드롭`}>
                    🧍 선택 드래그
                  </span>
                )}
              </div>
              {frameCount === 0
                ? <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>프레임 메타 없음 — "시트 편집"으로 그리드를 먼저 지정하세요.</div>
                : <div style={{ ...frameGrid, maxHeight: '300px' }}>{cells}</div>}
            </div>

            {/* 우: 클립 목록 + 추가 + 자동분석 + 저장 */}
            <div style={animCtrl}>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button style={miniAction} disabled={analyzing} onClick={autoAnalyze}>
                  {analyzing ? '분석 중…' : '🔍 동작 자동 분석'}
                </button>
              </div>

              <div style={subHead}>동작 클립 ({anims.length})</div>
              {anims.length === 0 && <p style={animMuted}>클립이 없습니다. 프레임을 선택해 아래에서 추가하거나, "동작 자동 분석"을 누르세요.</p>}
              {anims.map((a, ci) => (
                <div style={clipBox} key={ci}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input style={{ ...inp, flex: 1, fontSize: '11px' }} value={a.key}
                           title="동작 이름" onInput={(e) => patchClip(ci, { key: e.target.value })} />
                    <button style={miniBtn2} title={playing === ci ? '정지' : '미리보기'}
                            onClick={() => setPlaying(playing === ci ? -1 : ci)}>{playing === ci ? '■' : '▶'}</button>
                    <button style={{ ...miniBtn2, color: 'var(--danger)' }} title="삭제" onClick={() => removeClip(ci)}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
                      fps
                      <input style={{ ...inp, width: '46px', fontSize: '10px' }} type="number" min="1"
                             value={a.fps} onInput={(e) => patchClip(ci, { fps: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }} title="반복">
                      <input type="checkbox" checked={!!a.loop} onChange={(e) => patchClip(ci, { loop: e.target.checked })} />loop
                    </label>
                    <span style={animMuted} title="프레임 인덱스">[{(a.frames || []).join(',')}]</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    <button style={miniAction} title="현재 선택 프레임을 이 클립으로" onClick={() => setClipFramesFromSel(ci)}>선택→프레임</button>
                    <button style={miniAction} title="이 클립 프레임을 선택으로 불러오기" onClick={() => loadClipToSel(ci)}>프레임→선택</button>
                  </div>
                  {playing === ci && playSeq.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center' }}>
                      <AnimPreview img={img} frameSeq={playSeq} fps={playFps} pixel={pixel} loop={playLoop} size={96} />
                    </div>
                  )}
                </div>
              ))}

              {/* 클립 추가 */}
              <div style={{ ...clipBox, borderStyle: 'dashed' }}>
                <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px' }}>새 클립 추가</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <input style={{ ...inp, flex: 1 }} type="text" placeholder="동작 이름(예: walk)" value={newKey} onInput={(e) => setNewKey(e.target.value)} />
                  <input style={{ ...inp, width: '50px' }} type="number" min="1" title="fps" value={newFps} onInput={(e) => setNewFps(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
                    <input type="checkbox" checked={newLoop} onChange={(e) => setNewLoop(e.target.checked)} />loop
                  </label>
                  <button style={{ ...primaryBtn, flex: 1 }} disabled={!sel.length} onClick={addClip}>
                    {sel.length ? `${sel.length}프레임으로 추가` : '프레임 선택 필요'}
                  </button>
                </div>
              </div>

              {/* 저장/닫기 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                {msg && <span style={{ fontSize: '10px', flex: 1, color: msg.indexOf('실패') >= 0 ? 'var(--danger)' : 'var(--ok)' }}>{msg}</span>}
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

// ── 카탈로그 팩 카드(썸네일 lazy-load) ─────────────────────────────────────────
function CatalogCard({ pack, onOpen }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { setVisible(true); io.disconnect(); } });
    }, { rootMargin: '120px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const thumb = pack.preview ? spriteApi.assetUrl(pack.preview) : (pack.previewUrl || '');
  return (
    <div ref={ref} style={catCard} onClick={() => onOpen(pack)} title={pack.notes || pack.name}>
      <div style={catThumbWrap}>
        {visible && thumb
          ? <img src={thumb} alt={pack.name} loading="lazy" style={catThumb}
                 onError={(e) => { e.target.style.display = 'none'; }} />
          : <div style={{ ...catThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '10px' }}>{pack.downloaded ? '받음' : '미리보기'}</div>}
        {pack.downloaded && <span style={dlBadge}>다운로드됨</span>}
      </div>
      <div style={{ padding: '5px 6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pack.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
          <span style={{ ...tierBadge, background: TIER_COLOR[pack.safetyTier] || '#555' }}>{TIER_LABEL[pack.safetyTier] || pack.safetyTier}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(pack.tags || []).slice(0, 3).join(' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 카탈로그 상세(미리보기·notes·다운로드) ─────────────────────────────────────
function CatalogDetail({ pack, onClose, onDownloaded }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const canDownload = pack.safetyTier === 'cc0' && !pack.downloaded;
  const thumb = pack.preview ? spriteApi.assetUrl(pack.preview) : (pack.previewUrl || '');

  async function doDownload() {
    setBusy(true); setMsg('다운로드·분석 중… (최대 2분)');
    const r = await spriteApi.download(pack.id);
    setBusy(false);
    if (!r.ok) { setMsg('다운로드 실패: ' + (r.error || '')); return; }
    setMsg('완료 — 라이브러리에 추가됨 ✓');
    if (onDownloaded) onDownloaded(pack);
  }

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={detailModal}>
        <div style={modalHead}>
          <span style={{ fontWeight: 600 }}>{pack.name}</span>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
          {thumb && <img src={thumb} alt={pack.name} style={{ maxWidth: '100%', borderRadius: '6px', marginBottom: '10px', imageRendering: pack.style === 'pixel' ? 'pixelated' : 'auto' }} />}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span style={{ ...tierBadge, background: TIER_COLOR[pack.safetyTier] || '#555' }}>{TIER_LABEL[pack.safetyTier] || pack.safetyTier}</span>
            <span style={metaPill}>{pack.license}</span>
            {pack.style && <span style={metaPill}>{pack.style}</span>}
            {(pack.contentTypes || []).map((c) => <span style={metaPill} key={c}>{c}</span>)}
          </div>
          {(pack.tags || []).length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>태그: {(pack.tags || []).join(', ')}</div>
          )}
          {pack.notes && <p style={{ fontSize: '11px', color: 'var(--text)', lineHeight: 1.5 }}>{pack.notes}</p>}
          {pack.previewUrl && <a href={pack.previewUrl} target="_blank" rel="noopener" style={{ fontSize: '11px', color: 'var(--accent)' }}>원본 페이지 ↗</a>}
          <div style={{ marginTop: '12px' }}>
            {pack.downloaded ? (
              <div style={{ fontSize: '11px', color: 'var(--ok)' }}>이미 다운로드됨 — 라이브러리 탭에서 사용하세요.</div>
            ) : canDownload ? (
              <button style={{ ...primaryBtn, width: '100%' }} disabled={busy} onClick={doDownload}>
                {busy ? '받는 중…' : '⬇ 다운로드(CC0)'}
              </button>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                이 팩은 에디터 내 자동 다운로드 대상이 아닙니다(CC0 아님). 원본 페이지에서 받아 Unity 임포트/URL 추가를 사용하세요.
              </div>
            )}
            {msg && <div style={{ fontSize: '11px', marginTop: '6px', color: msg.indexOf('실패') >= 0 ? 'var(--danger)' : 'var(--ok)' }}>{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ───────────────────────────────────────────────────────────────────────
export function SpriteBrowser({ controller, selection, importers }) {
  const remote = controller.isRemote;
  const [tab, setTab] = useState('library');     // library | catalog | scene
  const [toast, setToast] = useState('');
  function flash(t) { setToast(t); setTimeout(() => setToast(''), 2800); }

  return (
    <div style={panel}>
      <div style={header}>에셋 · 스프라이트</div>
      {/* 탭 바 */}
      <div style={tabBar}>
        <button style={tab === 'library' ? tabBtnOn : tabBtn} onClick={() => setTab('library')}>라이브러리</button>
        <button style={tab === 'catalog' ? tabBtnOn : tabBtn} onClick={() => setTab('catalog')}>카탈로그</button>
        <button style={tab === 'scene' ? tabBtnOn : tabBtn} onClick={() => setTab('scene')}>씬에셋</button>
      </div>
      {toast && <div style={toastBar}>{toast}</div>}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {!remote && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '10px' }}>
            브리지 미연결(local) — 스프라이트 브라우저는 /wgf-editor 브리지에서만 동작합니다.
          </div>
        )}
        {remote && tab === 'library' && <LibraryTab controller={controller} selection={selection} flash={flash} onGotoCatalog={() => setTab('catalog')} />}
        {remote && tab === 'catalog' && <CatalogTab flash={flash} />}
        {remote && tab === 'scene' && <SceneAssetsTab controller={controller} selection={selection} importers={importers} flash={flash} onGotoCatalog={() => setTab('catalog')} />}
      </div>
    </div>
  );
}

// ── 라이브러리 탭 ──────────────────────────────────────────────────────────────
function LibraryTab({ controller, selection, flash, onGotoCatalog }) {
  const [items, setItems] = useState(null);
  const [truncated, setTruncated] = useState(false);  // 스캔 상한 도달(L-1) 배너용
  const [err, setErr] = useState('');
  const [editItem, setEditItem] = useState(null);     // SheetSlicer 대상
  const [editAnimItem, setEditAnimItem] = useState(null); // AnimEditor 대상(D3)
  const [applyTarget, setApplyTarget] = useState(null); // {item, frame}
  const [selectedFrame, setSelectedFrame] = useState(null);
  // 애니 미리보기 동시 개수 제한(과부하 방지, §3.4) — 토글이 카운트 증감, 상한 도달 시 비활성.
  const [previewCount, setPreviewCount] = useState(0);
  const MAX_PREVIEW = 3;
  const onPreviewToggle = useCallback((on) => {
    setPreviewCount((n) => Math.max(0, n + (on ? 1 : -1)));
  }, []);

  const reload = useCallback(() => {
    setItems(null); setErr('');
    spriteApi.library().then((r) => {
      if (!r.ok) { setErr(r.error || '라이브러리 조회 실패'); setItems([]); setTruncated(false); return; }
      setItems(r.items || []);
      setTruncated(!!r.truncated);
    });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // 팩별 그룹.
  const groups = {};
  (items || []).forEach((it) => {
    const k = it.packId || '기타';
    (groups[k] = groups[k] || []).push(it);
  });
  const groupKeys = Object.keys(groups).sort();

  // 적용 시작 — 옵션 다이얼로그.
  function startApply(item, frame) {
    if (!selection || selection.length === 0) { flash('엔티티를 먼저 선택하세요'); return; }
    setApplyTarget({ item, frame: frame == null ? selectedFrame : frame });
  }

  // 적용 확정 — use() → assignAssetToEntity(opts).
  //  · collection: 프레임 index i → 대상 파일 = item.filesRel[i]. 각 파일이 단일 이미지 1프레임이므로
  //    frameConfig/frame/frames 를 보내지 않고, 컴포넌트도 frame 없는 정적 Sprite 로 부착.
  //  · sheet: relPath=item.relPath + frameConfig + frame(시트 셀 인덱스).
  //    free-mode(비균일 영역 item.frames[]) 면 frames 도 전달하고 frame = 영역 index.
  async function confirmApply(as) {
    const { item, frame } = applyTarget;
    setApplyTarget(null);
    const isColl = item.kind === 'collection';

    let body;
    if (isColl) {
      const rel = (item.filesRel && frame != null) ? item.filesRel[frame] : null;
      if (!rel) { flash('적용 실패: 컬렉션 프레임 경로 없음'); return; }
      body = { relPath: rel, license: item.license, credit: item.credit };
      // collection 은 frameConfig/frame/frames 미전송(단일 이미지 1프레임).
    } else {
      if (!item.relPath) { flash('적용 실패: 시트 경로 없음'); return; }
      body = { relPath: item.relPath, frame: frame == null ? undefined : frame, license: item.license, credit: item.credit };
      if (item.frameConfig) body.frameConfig = item.frameConfig;
      // free-mode 비균일 영역(frames[]) — 적용~렌더까지 살리려면 use 에 frames 전달(M-1).
      if (item.frames && item.frames.length) body.frames = item.frames;
    }

    const r = await spriteApi.use(body);
    if (!r.ok) {
      flash(r.status === 409 ? '빈 씬 — 먼저 게임을 열어주세요' : ('적용 실패: ' + (r.error || '')));
      return;
    }
    const assetId = r.asset && r.asset.id;
    if (!assetId) { flash('적용 실패: 에셋 id 없음'); return; }
    // collection 은 frame 없는 정적 Sprite(단일 이미지). sheet 는 frame(셀/영역 index) 유지.
    const opts = { frame: isColl ? undefined : (frame == null ? undefined : frame), as };
    if (as === 'AnimatedSprite' && item.anims && item.anims.length) {
      opts.anims = item.anims;
      opts.play = item.anims[0].key || item.anims[0].name;
    }
    try {
      await controller.assignAssetToEntity(selection[0], assetId, opts);
      flash(`"${assetId}" → ${selection[0]} 적용 ✓`);
    } catch (e) { flash('컴포넌트 부착 실패'); }
  }

  return (
    <div style={{ padding: '8px 10px' }}>
      {err && <div style={{ color: 'var(--danger)', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}
      {truncated && <div style={truncBanner}>⚠ 항목이 많아 일부만 표시됨 — 검색/팩으로 좁혀 보세요.</div>}
      {items === null && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>라이브러리 로딩 중…</div>}
      {items && items.length === 0 && !err && (
        <div style={emptyBox}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>로컬 라이브러리가 비어 있습니다.</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>카탈로그에서 CC0 팩을 받아오거나, 씬에셋 탭에서 Unity/URL 로 추가하세요.</div>
          <button style={primaryBtn} onClick={onGotoCatalog}>카탈로그에서 찾기</button>
        </div>
      )}
      {groupKeys.map((gk) => (
        <div key={gk} style={{ marginBottom: '10px' }}>
          <div style={packGroupHead}>{gk} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({groups[gk].length})</span></div>
          {groups[gk].map((it) => (
            <LibraryItem key={it.id} item={it}
                         onApply={startApply} onEdit={setEditItem} onEditAnim={setEditAnimItem}
                         selectedFrame={selectedFrame} onSelectFrame={setSelectedFrame}
                         previewCount={previewCount} maxPreview={MAX_PREVIEW} onPreviewToggle={onPreviewToggle} />
          ))}
        </div>
      ))}
      {editItem && <SheetSlicer item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); reload(); }} />}
      {editAnimItem && <AnimEditor item={editAnimItem} onClose={() => setEditAnimItem(null)} onSaved={() => { setEditAnimItem(null); reload(); }} />}
      {applyTarget && <ApplyDialog item={applyTarget.item} frame={applyTarget.frame} onConfirm={confirmApply} onCancel={() => setApplyTarget(null)} />}
    </div>
  );
}

// ── 카탈로그 분류(group-by) 빌더 ───────────────────────────────────────────────
//  필터 후 팩 배열을 분류 기준으로 묶는다. 반환 [{ key, label, packs:[...] }] (label 오름차순).
//  · 'source'   : sourceId → sources[].name 매핑(없으면 sourceId 그대로). 팩 1개 → 그룹 1개.
//  · 'contentType': contentTypes[] 각각으로 — 한 팩이 여러 그룹에 중복 노출(자연스러움).
//  · 'style'    : pack.style. 그룹 내 팩은 입력 순서(=기존 정렬) 유지.
function groupPacks(packs, groupBy, sourceNameById) {
  if (groupBy === 'none') return [{ key: '__all__', label: '', packs }];
  const map = new Map();  // key → { key, label, packs:[] }
  const push = (key, label, p) => {
    let g = map.get(key);
    if (!g) { g = { key, label, packs: [] }; map.set(key, g); }
    g.packs.push(p);
  };
  packs.forEach((p) => {
    if (groupBy === 'source') {
      const sid = p.sourceId || '기타';
      push(sid, sourceNameById[sid] || sid, p);
    } else if (groupBy === 'contentType') {
      const cts = (p.contentTypes || []);
      if (!cts.length) { push('기타', '기타', p); }
      else cts.forEach((c) => push(c, c, p));
    } else if (groupBy === 'style') {
      const s = p.style || '기타';
      push(s, s, p);
    }
  });
  return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label), 'ko'));
}

// ── 카탈로그 탭 ────────────────────────────────────────────────────────────────
function CatalogTab({ flash }) {
  const [packs, setPacks] = useState(null);
  const [sources, setSources] = useState([]);    // 출처 분류 라벨용(sourceId→name)
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [fContent, setFContent] = useState('');
  const [fStyle, setFStyle] = useState('');
  const [groupBy, setGroupBy] = useState('source'); // none | source | contentType | style (기본 출처)
  const [collapsed, setCollapsed] = useState({});   // { [groupKey]: true } — 접힌 섹션
  const [detail, setDetail] = useState(null);

  const reload = useCallback(() => {
    setPacks(null); setErr('');
    spriteApi.catalog().then((r) => {
      if (!r.ok) { setErr(r.error || '카탈로그 조회 실패'); setPacks([]); setSources([]); return; }
      setPacks(r.packs || []);
      setSources(r.sources || []);
    });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // 검색 debounce(250ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // sourceId → name 매핑(출처 그룹 라벨).
  const sourceNameById = useMemo(() => {
    const m = {};
    (sources || []).forEach((s) => { if (s && s.id) m[s.id] = s.name || s.id; });
    return m;
  }, [sources]);

  // 필터 옵션(팩에서 수집).
  const contentTypes = Array.from(new Set((packs || []).flatMap((p) => p.contentTypes || []))).filter(Boolean).sort();
  const styles = Array.from(new Set((packs || []).map((p) => p.style))).filter(Boolean).sort();

  const filtered = (packs || []).filter((p) => {
    if (fContent && !(p.contentTypes || []).includes(fContent)) return false;
    if (fStyle && p.style !== fStyle) return false;
    if (debouncedQ) {
      const hay = (p.name + ' ' + (p.tags || []).join(' ') + ' ' + (p.contentTypes || []).join(' ') + ' ' + p.style + ' ' + (p.notes || '')).toLowerCase();
      if (hay.indexOf(debouncedQ) === -1) return false;
    }
    return true;
  });

  // 분류(필터 후 그룹핑).
  const grouped = useMemo(() => groupPacks(filtered, groupBy, sourceNameById), [filtered, groupBy, sourceNameById]);

  function toggleGroup(key) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ padding: '8px 10px' }}>
      {err && <div style={{ color: 'var(--danger)', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}
      {/* 검색 + 필터 */}
      <input style={{ ...inp, width: '100%', marginBottom: '6px' }} placeholder="팩 검색(이름·태그·타입)" value={q} onInput={(e) => setQ(e.target.value)} />
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <select style={{ ...inp, flex: 1 }} value={fContent} onChange={(e) => setFContent(e.target.value)}>
          <option value="">모든 타입</option>
          {contentTypes.map((c) => <option value={c} key={c}>{c}</option>)}
        </select>
        <select style={{ ...inp, flex: 1 }} value={fStyle} onChange={(e) => setFStyle(e.target.value)}>
          <option value="">모든 스타일</option>
          {styles.map((s) => <option value={s} key={s}>{s}</option>)}
        </select>
      </div>
      {/* 분류(group-by) 셀렉터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>분류</span>
        <select style={{ ...inp, flex: 1 }} value={groupBy} onChange={(e) => { setGroupBy(e.target.value); setCollapsed({}); }}>
          <option value="none">없음(평면)</option>
          <option value="source">출처</option>
          <option value="contentType">종류</option>
          <option value="style">스타일</option>
        </select>
      </div>
      {packs === null && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>카탈로그 로딩 중…</div>}
      {packs && (
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px' }}>{filtered.length} / {packs.length}개 팩</div>
      )}
      {/* 분류 없음(평면): 단일 그리드. 분류 있음: 접이식 섹션. */}
      {groupBy === 'none'
        ? <div style={catGrid}>{filtered.map((p) => <CatalogCard key={p.id} pack={p} onOpen={setDetail} />)}</div>
        : grouped.map((g) => {
            const isCol = !!collapsed[g.key];
            return (
              <div key={g.key} style={{ marginBottom: '10px' }}>
                <div style={catGroupHead} onClick={() => toggleGroup(g.key)}>
                  <span style={{ fontSize: '10px', width: '12px' }}>{isCol ? '▸' : '▾'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label || '(미분류)'}</span>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({g.packs.length})</span>
                </div>
                {!isCol && <div style={catGrid}>{g.packs.map((p) => <CatalogCard key={g.key + '/' + p.id} pack={p} onOpen={setDetail} />)}</div>}
              </div>
            );
          })}
      {detail && <CatalogDetail pack={detail} onClose={() => setDetail(null)} onDownloaded={() => { setDetail(null); flash('다운로드 완료 — 라이브러리 탭에서 확인하세요'); reload(); }} />}
    </div>
  );
}

// ── 씬에셋 탭(기존 AssetBrowser 기능 보존) ─────────────────────────────────────
function SceneAssetsTab({ controller, selection, importers, flash, onGotoCatalog }) {
  const remote = controller.isRemote;
  const [assets, setAssets] = useState(controller.getAssets ? controller.getAssets() : { sprites: [] });
  const [showProc, setShowProc] = useState(false);
  const [showCc0, setShowCc0] = useState(false);
  const [showUnity, setShowUnity] = useState(false);

  useEffect(() => {
    if (!controller.onAssetChange) return;
    const off = controller.onAssetChange((a) => setAssets(a || { sprites: [] }));
    return off;
  }, []);
  useEffect(() => {
    if (!controller.onChange) return;
    const off = controller.onChange(() => { if (controller.getAssets) setAssets(controller.getAssets()); });
    return off;
  }, []);

  async function assignToSelected(spriteId) {
    if (!selection || selection.length === 0) { flash('엔티티를 먼저 선택하세요'); return; }
    try { await controller.assignAssetToEntity(selection[0], spriteId); flash(`"${spriteId}" → ${selection[0]} 적용 ✓`); }
    catch (e) { flash('적용 실패'); }
  }

  const { ProceduralDefiner, Cc0Adder, UnityFolderImporter } = importers || {};

  return (
    <div style={{ padding: '8px 10px' }}>
      {/* 추가 버튼 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button style={addBtn} disabled={!remote} onClick={() => { setShowProc(!showProc); setShowCc0(false); setShowUnity(false); }}>＋ 절차</button>
        <button style={addBtn} disabled={!remote} onClick={() => { setShowCc0(!showCc0); setShowProc(false); setShowUnity(false); }}>＋ CC0 URL</button>
        <button style={addBtn} disabled={!remote} onClick={() => { setShowUnity(!showUnity); setShowProc(false); setShowCc0(false); }}>＋ Unity</button>
      </div>
      <button style={{ ...addBtn, width: '100%', marginBottom: '8px' }} onClick={onGotoCatalog}>카탈로그에서 찾기</button>

      {showProc && ProceduralDefiner && <ProceduralDefiner controller={controller} onDone={(t) => { setShowProc(false); flash(t); }} />}
      {showCc0 && Cc0Adder && <Cc0Adder controller={controller} onDone={(t) => { setShowCc0(false); flash(t); }} />}
      {showUnity && UnityFolderImporter && <UnityFolderImporter controller={controller} onDone={(t) => { setShowUnity(false); flash(t); }} />}

      <div style={{ marginTop: '6px' }}>
        {assets.sprites.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>씬 스프라이트 없음</div>}
        {assets.sprites.map((s) => <SceneAssetCard key={s.id} asset={s} onAssign={() => assignToSelected(s.id)} />)}
      </div>
    </div>
  );
}

// 씬에셋 카드(기존 AssetCard 보존 — 드래그는 raw id 문자열로 Hierarchy 호환).
function SceneAssetCard({ asset, onAssign }) {
  const isCc0 = asset.source === 'cc0';
  const isLocal = asset.source === 'local';
  function onDragStart(e) {
    // 씬에셋은 이미 등록된 자산 id — Hierarchy 드롭(getData→spriteId 문자열) 호환 위해 raw id.
    try { e.dataTransfer.setData('application/wgf-asset', asset.id); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {}
  }
  const badgeBg = isCc0 ? 'var(--accent2)' : isLocal ? 'var(--accent)' : 'var(--accent)';
  const badgeLabel = isCc0 ? 'CC0' : isLocal ? 'Local' : '절차';
  return (
    <div draggable onDragStart={onDragStart} title="엔티티로 드래그하거나 ↓ 버튼으로 선택 엔티티에 적용"
         style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '5px 7px', marginBottom: '5px',
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', background: 'var(--panel2)' }}>
      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: badgeBg, color: '#08121a' }}>{badgeLabel}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.id}
          {isLocal && asset.attested && <span title="사용자 권리 보유 선언" style={{ marginLeft: '4px', fontSize: '9px' }}>⚠️</span>}
        </div>
        {asset.desc && <div style={{ fontSize: '10px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.desc}</div>}
        {isLocal && asset.license && <div style={{ fontSize: '9px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.license}</div>}
      </div>
      <button style={assignBtn} title="선택 엔티티에 Sprite 로 적용" onClick={onAssign}>↓</button>
    </div>
  );
}

// ── 스타일 ─────────────────────────────────────────────────────────────────────
const panel = { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tabBar = { display: 'flex', borderBottom: '1px solid var(--border)' };
const tabBtn = { flex: 1, background: 'transparent', color: 'var(--text-dim)', border: 'none', borderBottom: '2px solid transparent', padding: '7px 4px', cursor: 'pointer', fontSize: '11px' };
const tabBtnOn = { ...tabBtn, color: 'var(--text)', borderBottom: '2px solid var(--accent)', fontWeight: 600 };
const toastBar = { background: 'var(--panel2)', color: 'var(--accent2)', fontSize: '11px', padding: '5px 10px', borderBottom: '1px solid var(--border)' };
const emptyBox = { border: '1px dashed var(--border)', borderRadius: '6px', padding: '14px', textAlign: 'center', marginTop: '8px' };
const truncBanner = { background: 'var(--panel2)', color: 'var(--text-dim)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', marginBottom: '6px' };
const packGroupHead = { fontSize: '11px', fontWeight: 700, color: 'var(--accent)', padding: '3px 0', marginBottom: '4px', borderBottom: '1px solid var(--border)' };
const libItem = { border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '5px', background: 'var(--bg)', overflow: 'hidden' };
const libItemHead = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', cursor: 'pointer', background: 'var(--panel2)' };
const kindBadge = { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--border)', color: 'var(--text)' };
const frameGrid = { display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '260px', overflowY: 'auto', padding: '2px' };
const frameIdx = { fontSize: '8px', color: 'var(--text-dim)', maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const miniAction = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' };
const miniActionOn = { ...miniAction, background: 'var(--accent)', color: '#08121a', fontWeight: 600 };
const miniBtn2 = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' };
const subHead = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)' };
const animMuted = { fontSize: '10px', color: 'var(--text-dim)', margin: '2px 0' };
const animModal = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', maxWidth: '760px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.5)' };
const animBody = { display: 'flex', gap: '12px', padding: '12px 14px', overflow: 'auto', minHeight: 0 };
const animCtrl = { flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '70vh' };
const clipBox = { border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', background: 'var(--panel2)' };
const animOrderBadge = { position: 'absolute', top: '-3px', left: '-3px', fontSize: '8px', minWidth: '12px', textAlign: 'center', padding: '0 3px', borderRadius: '8px', background: 'var(--accent)', color: '#08121a', fontWeight: 700, lineHeight: '13px' };
const dragHandle = { fontSize: '13px', cursor: 'grab', padding: '0 2px', userSelect: 'none' };
const dragHandleOff = { ...dragHandle, opacity: 0.3, cursor: 'not-allowed' };
const catGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' };
const catGroupHead = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', padding: '4px 2px', marginBottom: '6px', borderBottom: '1px solid var(--border)', cursor: 'pointer' };
const catCard = { border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', background: 'var(--panel2)' };
const catThumbWrap = { position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#0e1016' };
const catThumb = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };
const dlBadge = { position: 'absolute', top: '4px', right: '4px', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: 'var(--ok)', color: '#08121a' };
const tierBadge = { fontSize: '8px', padding: '1px 4px', borderRadius: '3px', color: '#fff', whiteSpace: 'nowrap' };
const metaPill = { fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--panel2)', color: 'var(--text-dim)', border: '1px solid var(--border)' };
const addBtn = { flex: 1, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' };
const assignBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer', fontWeight: 700 };
const inp = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(8,12,18,.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const applyModal = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', maxWidth: '360px', width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,.5)' };
const detailModal = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', maxWidth: '460px', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.5)' };
const modalHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '13px' };
const closeBtn = { background: 'transparent', color: 'var(--text-dim)', border: 'none', cursor: 'pointer', fontSize: '15px' };
const radioRow = { display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', cursor: 'pointer', lineHeight: 1.4 };
const ghostBtn = { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontSize: '11px' };
const primaryBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px', padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '11px' };
