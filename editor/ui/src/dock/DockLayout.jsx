/* ============================================================================
 * DockLayout — Unity 식 도킹 레이아웃 (모듈 A)
 * ----------------------------------------------------------------------------
 * 기능:
 *  1) row/col 스플릿 + 드래그 리사이저(포인터 이벤트, 최소 크기 가드).
 *  2) 탭 그룹(여러 패널을 탭으로), 활성 탭 강조, 탭 클릭 전환.
 *  3) 탭 닫기(×) → removePanelFromLayout, 빈 그룹 자동 붕괴.
 *  4) 탭 드래그 → 다른 그룹 위 5분할 드롭존(좌/우/상/하=스플릿, 중앙=탭 합류).
 *     포인터 이벤트 + 떠다니는 드래그 고스트(HTML5 DnD 미사용).
 *  5) 탭 전환은 unmount 가 아니라 display 토글 — 한 그룹의 모든 패널을 동시
 *     마운트(Phaser 캔버스/챗 스크롤 상태 보존). 비활성 패널은 display:none.
 *
 * 모든 색은 index.html :root CSS 변수. 드롭존 오버레이만 rgba 직접(반투명 허용).
 * ==========================================================================*/
import { Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import {
  DEFAULT_LAYOUT, normalizeLayout, removePanelFromLayout, normalizeSizes, isTabs, isSplit
} from './dockModel.js';

const MIN_PX = 120;        // 패널 최소 크기(리사이저 음수/0 방지)
const RESIZER_PX = 6;      // 리사이저 핸들 두께

export {
  DEFAULT_LAYOUT, normalizeLayout, collectPanelIds, addPanelToLayout,
  removePanelFromLayout, isPanelVisible, serializeLayout, activatePanel
} from './dockModel.js';

// ── 루트 ─────────────────────────────────────────────────────────────────────
/**
 * @param {{ [id]: { title:string, render:()=>VNode, icon?:string } }} panels
 * @param {object|null} layout  직렬화 트리(null → DEFAULT)
 * @param {(nextLayout:object)=>void} onLayoutChange
 */
export function DockLayout({ panels, layout, onLayoutChange }) {
  const availableIds = panels ? Object.keys(panels) : [];
  // 손상/누락 방어 — 항상 정규화된 트리로 렌더.
  const tree = normalizeLayout(layout, availableIds);
  // 드래그 onUp 은 useEffect 로 바인딩돼 시작 시점 클로저를 캡처한다 — 커밋 때
  // 최신 tree 를 쓰도록 ref 미러(드래그 중 외부 재렌더에도 안전).
  const treeRef = useRef(tree);
  treeRef.current = tree;

  // 드래그 상태(탭 리다킹). null 이면 비활성.
  //  { panelId, x, y, title, overGroupId, zone }
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);            // 포인터 핸들러가 읽는 최신 드래그
  dragRef.current = drag;

  // 그룹 DOM 참조 레지스트리(드롭존 히트테스트용). groupId → element.
  const groupElsRef = useRef(new Map());
  const registerGroup = (gid, el) => {
    if (el) groupElsRef.current.set(gid, el);
    else groupElsRef.current.delete(gid);
  };

  function emit(next) {
    if (onLayoutChange) onLayoutChange(next);
  }

  // ── 탭 닫기 ──
  function closePanel(panelId) {
    emit(normalizeLayout(removePanelFromLayout(tree, panelId), availableIds));
  }

  // ── 탭 활성화 ──
  function setActive(groupId, panelId) {
    emit(setActiveInTree(tree, groupId, panelId));
  }

  // ── 리사이저 커밋(splitPath = 스플릿 노드 경로, sizes = 새 비율) ──
  function commitResize(splitPath, sizes) {
    emit(setSizesAtPath(tree, splitPath, sizes));
  }

  // ── 탭 드래그 시작(포인터) ──
  function startTabDrag(panelId, title, ev) {
    ev.preventDefault();
    setDrag({ panelId, title, x: ev.clientX, y: ev.clientY, overGroupId: null, zone: null });
  }

  // 전역 포인터 이동/해제 — 드래그 중에만 바인딩.
  useEffect(() => {
    if (!drag) return;
    function onMove(ev) {
      const hit = hitTestGroup(groupElsRef.current, ev.clientX, ev.clientY);
      setDrag((d) => d && ({ ...d, x: ev.clientX, y: ev.clientY,
        overGroupId: hit ? hit.groupId : null, zone: hit ? hit.zone : null }));
    }
    function onUp() {
      const d = dragRef.current;
      setDrag(null);
      if (d && d.overGroupId && d.zone) {
        emit(applyDrop(treeRef.current, d.panelId, d.overGroupId, d.zone, availableIds));
      }
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag ? drag.panelId : null]);   // 드래그 1회 시작/종료마다 재바인딩

  return (
    <div style={ROOT_STYLE}>
      <NodeView node={tree} path={[]} panels={panels}
                onClose={closePanel} onActivate={setActive}
                onResize={commitResize} onTabDragStart={startTabDrag}
                registerGroup={registerGroup} drag={drag} />
      {drag && <DragGhost drag={drag} />}
    </div>
  );
}

const ROOT_STYLE = { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', position: 'relative' };

// ── 노드 디스패치 ─────────────────────────────────────────────────────────────
function NodeView(props) {
  const { node } = props;
  if (isTabs(node)) return <TabGroup {...props} />;
  return <SplitView {...props} />;
}

// ── 스플릿 + 리사이저 ─────────────────────────────────────────────────────────
function SplitView(props) {
  const { node, path, onResize } = props;
  const dir = node.dir === 'col' ? 'col' : 'row';
  const isRow = dir === 'row';
  const sizes = normalizeSizes(node.sizes, node.children.length);
  const containerRef = useRef(null);

  // 드래그 중 임시 sizes(커밋 전 시각 반영). null 이면 모델 sizes 사용.
  const [liveSizes, setLiveSizes] = useState(null);
  const view = liveSizes || sizes;

  function onResizerDown(i, ev) {
    ev.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const total = isRow ? rect.width : rect.height;
    if (total <= 0) return;
    const startPos = isRow ? ev.clientX : ev.clientY;
    const base = sizes.slice();
    const minFrac = MIN_PX / total;
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}

    function move(e) {
      const cur = isRow ? e.clientX : e.clientY;
      const deltaFrac = (cur - startPos) / total;
      // i, i+1 경계만 조정. 최소 크기 가드.
      let a = base[i] + deltaFrac;
      let b = base[i + 1] - deltaFrac;
      if (a < minFrac) { b -= (minFrac - a); a = minFrac; }
      if (b < minFrac) { a -= (minFrac - b); b = minFrac; }
      const next = base.slice();
      next[i] = a; next[i + 1] = b;
      setLiveSizes(next);
    }
    function up(e) {
      try { ev.target.releasePointerCapture(ev.pointerId); } catch (err) {}
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLiveSizes((finalSizes) => {
        if (finalSizes) onResize(path, finalSizes);
        return null;
      });
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const containerStyle = {
    flex: 1, minHeight: 0, minWidth: 0, display: 'flex',
    flexDirection: isRow ? 'row' : 'column'
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {node.children.map((child, i) => {
        const frac = view[i];
        const cellStyle = {
          flexGrow: 0, flexShrink: 0,
          flexBasis: `calc(${(frac * 100).toFixed(4)}% - ${RESIZER_PX * (node.children.length - 1) / node.children.length}px)`,
          minWidth: 0, minHeight: 0, display: 'flex'
        };
        return (
          <Fragment key={'seg' + i}>
            <div style={cellStyle}>
              <NodeView {...props} node={child} path={path.concat(i)} />
            </div>
            {i < node.children.length - 1 && (
              <div onPointerDown={(ev) => onResizerDown(i, ev)}
                   style={resizerStyle(isRow)}
                   class="wgf-dock-resizer" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function resizerStyle(isRow) {
  return {
    flex: `0 0 ${RESIZER_PX}px`,
    cursor: isRow ? 'col-resize' : 'row-resize',
    background: 'var(--border)',
    position: 'relative', zIndex: 2,
    touchAction: 'none'
  };
}

// ── 탭 그룹(리프) ─────────────────────────────────────────────────────────────
function TabGroup(props) {
  const { node, path, panels, onClose, onActivate, onTabDragStart, registerGroup, drag } = props;
  // 그룹 식별자 = 경로 문자열(레이아웃 내 유일).
  const groupId = path.length ? path.join('-') : 'root';
  const ids = (node.panels || []).filter((id) => panels && panels[id]);
  const active = ids.indexOf(node.active) >= 0 ? node.active : ids[0];
  const elRef = useRef(null);

  useEffect(() => {
    registerGroup(groupId, elRef.current);
    return () => registerGroup(groupId, null);
  }, [groupId]);

  const showOverlay = drag && drag.overGroupId === groupId && drag.zone;

  return (
    <div ref={elRef} style={GROUP_STYLE}>
      {/* 탭바 */}
      <div style={TABBAR_STYLE}>
        {ids.map((id) => {
          const isActive = id === active;
          const meta = panels[id];
          return (
            <div key={id}
                 onClick={() => onActivate(groupId, id)}
                 style={tabStyle(isActive)} title={meta.title}>
              {/* 탭 드래그 핸들(라벨 영역) */}
              <span style={{ ...tabLabel, cursor: 'grab' }}
                    onPointerDown={(ev) => { if (ev.button === 0) onTabDragStart(id, meta.title, ev); }}>
                {meta.icon ? meta.icon + ' ' : ''}{meta.title}
              </span>
              <span class="wgf-dock-tabclose"
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => { ev.stopPropagation(); onClose(id); }}
                    style={tabClose(isActive)} title="닫기">×</span>
            </div>
          );
        })}
      </div>
      {/* 본문 — 모든 패널 동시 마운트, 비활성은 display:none(상태 보존) */}
      <div style={BODY_STYLE}>
        {ids.map((id) => (
          <div key={id} style={{
            position: 'absolute', inset: 0,
            display: id === active ? 'flex' : 'none',
            flexDirection: 'column', minHeight: 0, minWidth: 0
          }}>
            {panels[id].render()}
          </div>
        ))}
        {ids.length === 0 && <div style={EMPTY_STYLE}>패널 없음</div>}
      </div>
      {showOverlay && <DropOverlay zone={drag.zone} />}
    </div>
  );
}

const GROUP_STYLE = {
  flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column',
  background: 'var(--panel)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden'
};
const TABBAR_STYLE = {
  display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', flexShrink: 0,
  background: 'var(--panel2)', borderBottom: '1px solid var(--border)', minHeight: '28px'
};
const BODY_STYLE = { flex: 1, minHeight: 0, minWidth: 0, position: 'relative' };
const EMPTY_STYLE = { padding: '12px 10px', color: 'var(--text-dim)' };

function tabStyle(isActive) {
  return {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 8px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    fontSize: '12px',
    background: isActive ? 'var(--panel)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
    borderRight: '1px solid var(--border)',
    borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent'
  };
}
const tabLabel = { userSelect: 'none' };
function tabClose(isActive) {
  return {
    fontSize: '14px', lineHeight: 1, padding: '0 2px', borderRadius: '3px',
    color: isActive ? 'var(--text)' : 'var(--text-dim)'
  };
}

// ── 드롭존 오버레이(5분할 시각) ───────────────────────────────────────────────
function DropOverlay({ zone }) {
  const box = zoneBox(zone);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      <div style={{
        position: 'absolute', ...box,
        background: 'rgba(79, 208, 255, 0.25)',
        border: '2px solid var(--accent)',
        transition: 'all 60ms ease'
      }} />
    </div>
  );
}

// 존별 하이라이트 박스(부모 100% 기준 %).
function zoneBox(zone) {
  switch (zone) {
    case 'left':   return { left: 0, top: 0, width: '50%', height: '100%' };
    case 'right':  return { left: '50%', top: 0, width: '50%', height: '100%' };
    case 'top':    return { left: 0, top: 0, width: '100%', height: '50%' };
    case 'bottom': return { left: 0, top: '50%', width: '100%', height: '50%' };
    default:       return { left: 0, top: 0, width: '100%', height: '100%' }; // center
  }
}

// ── 드래그 고스트(커서 따라다니는 떠다니는 라벨) ────────────────────────────────
function DragGhost({ drag }) {
  return (
    <div style={{
      position: 'fixed', left: drag.x + 12, top: drag.y + 12, zIndex: 9999,
      pointerEvents: 'none',
      background: 'var(--panel2)', color: 'var(--accent)',
      border: '1px solid var(--accent)', borderRadius: '4px',
      padding: '3px 8px', fontSize: '12px', opacity: 0.95,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
    }}>
      {drag.title}
    </div>
  );
}

// ── 히트테스트: 포인터가 어느 그룹의 어느 존 위인지 ────────────────────────────
function hitTestGroup(groupEls, x, y) {
  for (const [groupId, el] of groupEls) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const fx = (x - r.left) / r.width;   // 0..1
    const fy = (y - r.top) / r.height;
    // 중앙 코어(가운데 40%) = center, 나머지는 가장 가까운 가장자리.
    const edge = 0.3;
    if (fx > edge && fx < 1 - edge && fy > edge && fy < 1 - edge) {
      return { groupId, zone: 'center' };
    }
    // 가장자리까지의 거리로 존 결정.
    const dl = fx, dr = 1 - fx, dt = fy, db = 1 - fy;
    const m = Math.min(dl, dr, dt, db);
    let zone = 'center';
    if (m === dl) zone = 'left';
    else if (m === dr) zone = 'right';
    else if (m === dt) zone = 'top';
    else zone = 'bottom';
    return { groupId, zone };
  }
  return null;
}

// ── 트리 변환(경로 기반) ──────────────────────────────────────────────────────

/** groupId(경로 join '-') 의 active 패널 설정. 불변. */
function setActiveInTree(tree, groupId, panelId) {
  const path = groupId === 'root' ? [] : groupId.split('-').map(Number);
  const clone = JSON.parse(JSON.stringify(tree));
  const node = nodeAtPath(clone, path);
  if (node && node.type === 'tabs') node.active = panelId;
  return clone;
}

/** splitPath 위치 스플릿의 sizes 교체. 불변. */
function setSizesAtPath(tree, splitPath, sizes) {
  const clone = JSON.parse(JSON.stringify(tree));
  const node = nodeAtPath(clone, splitPath);
  if (node && node.type === 'split') node.sizes = sizes.slice();
  return clone;
}

function nodeAtPath(node, path) {
  let cur = node;
  for (const i of path) {
    if (!cur || cur.type !== 'split' || !cur.children) return null;
    cur = cur.children[i];
  }
  return cur;
}

/**
 * 드롭 적용: 대상 그룹(groupId)에 패널을 zone 으로 도킹.
 *  - center: 대상 그룹 탭으로 합류(active).
 *  - left/right: row 스플릿으로 쪼개 좌/우 새 탭그룹.
 *  - top/bottom: col 스플릿으로 쪼개 위/아래 새 탭그룹.
 * 대상 그룹은 **경로가 아니라 마커(__drop)로 식별**한다 — 드래그 패널을 빼면서
 * 형제 그룹이 붕괴/평탄화돼 인덱스가 시프트돼도 대상이 어긋나지 않는다(경로 기반의
 * 오도킹 버그 회피). 자기 단일 패널 그룹에 자기를 드롭하면(제거로 대상 소멸) 원본을
 * 유지하는 no-op. 불변(원본 tree 미변형).
 */
function applyDrop(tree, panelId, groupId, zone, availableIds) {
  // 1) 원본(제거 전) clone 에서 대상 그룹을 경로로 찾아 마커를 단다.
  const marked = JSON.parse(JSON.stringify(tree));
  const path = groupId === 'root' ? [] : groupId.split('-').map(Number);
  const targetNode = nodeAtPath(marked, path);
  if (!targetNode || targetNode.type !== 'tabs') {
    // 경로 무효 → 첫 탭그룹 합류 폴백.
    const merged = mergeIntoFirstTabs(removePanelFromLayout(tree, panelId), panelId);
    return normalizeLayout(merged, availableIds);
  }
  targetNode.__drop = true;

  // 2) 드래그 패널 제거(빈 그룹 붕괴 — 마커 노드는 다른 그룹이라 보존).
  const working = removePanelFromLayout(marked, panelId);
  // 빈 트리(드래그 패널이 유일했음) → 단일 패널 복원.
  if (isTabs(working) && (!working.panels || working.panels.length === 0)) {
    return { type: 'tabs', panels: [panelId], active: panelId };
  }

  // 3) 마커 노드 재탐색(경로 시프트 무관). 사라졌으면(자기 단일그룹 자기드롭) no-op.
  const target = findMarked(working);
  if (!target) return tree;

  if (zone === 'center') {
    if (target.panels.indexOf(panelId) < 0) target.panels.push(panelId);
    target.active = panelId;
    clearMarks(working);
    return normalizeLayout(working, availableIds);
  }

  // 스플릿 분할: 대상 탭그룹을 새 스플릿(기존 + 드롭 리프)으로 교체.
  const newLeaf = { type: 'tabs', panels: [panelId], active: panelId };
  const horizontal = (zone === 'left' || zone === 'right');
  const dir = horizontal ? 'row' : 'col';
  const before = (zone === 'left' || zone === 'top');
  const existing = JSON.parse(JSON.stringify(target));
  delete existing.__drop;
  const split = {
    type: 'split', dir, sizes: [0.5, 0.5],
    children: before ? [newLeaf, existing] : [existing, newLeaf]
  };
  const replaced = replaceMarked(working, split);
  clearMarks(replaced);
  return normalizeLayout(replaced, availableIds);
}

/** __drop 마커가 달린 노드 반환(DFS). 없으면 null. */
function findMarked(node) {
  if (!node) return null;
  if (node.__drop) return node;
  if (isSplit(node)) {
    for (const c of (node.children || [])) { const r = findMarked(c); if (r) return r; }
  }
  return null;
}

/** __drop 마커 노드를 newNode 로 교체(부모 참조 in-place). 루트가 대상이면 newNode 반환. */
function replaceMarked(root, newNode) {
  if (root && root.__drop) return newNode;
  (function walk(node) {
    if (isSplit(node) && node.children) {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i] && node.children[i].__drop) { node.children[i] = newNode; return true; }
        if (walk(node.children[i])) return true;
      }
    }
    return false;
  })(root);
  return root;
}

/** 모든 __drop 마커 제거(재귀). */
function clearMarks(node) {
  if (!node) return;
  if (node.__drop) delete node.__drop;
  if (isSplit(node)) for (const c of (node.children || [])) clearMarks(c);
}

/** 첫 탭그룹에 패널 합류(폴백). */
function mergeIntoFirstTabs(root, panelId) {
  let done = false;
  (function walk(node) {
    if (done) return;
    if (node && node.type === 'tabs') {
      node.panels.push(panelId);
      node.active = panelId;
      done = true;
    } else if (node && node.type === 'split') {
      for (const c of node.children) walk(c);
    }
  })(root);
  if (!done) return { type: 'tabs', panels: [panelId], active: panelId };
  return root;
}
