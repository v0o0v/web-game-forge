/* ============================================================================
 * ScenePanel — 멀티 씬 관리 바(기능 E3, Unity 씬 의미)
 * ----------------------------------------------------------------------------
 * Hierarchy 패널 최상단에 항상 보이는 씬 셀렉터 바(dock 변경 최소). 씬을 여러 개
 * 추가/이름변경/삭제하고 활성 편집 씬을 전환한다(모두 브리지 권위 위임).
 *  - 목록: controller.listScenes() (mount 시 + onChange/'scene' 델타 시 재조회).
 *  - 탭 클릭 → switchScene(id). + 버튼 → addScene(). 더블클릭 → renameScene. × → removeScene.
 *  - local 모드(브리지 없음)는 안내만 표시(씬 관리 비활성).
 *  - 전환/추가/삭제 후 UI 동기화는 SSE 'scene' 델타 → controller.resyncFromBridge → onChange
 *    가 담당. 여기선 onChange 구독으로 목록만 재조회한다(권위 재조회 단일화).
 * ==========================================================================*/
import { useState, useEffect } from 'preact/hooks';

export function ScenePanel({ controller }) {
  const isRemote = !!(controller && controller.isRemote);
  const [scenes, setScenes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // 씬 목록 재조회(브리지 권위). local 은 비활성이라 호출하지 않는다.
  function refresh() {
    if (!isRemote || !controller.listScenes) return;
    Promise.resolve(controller.listScenes()).then((r) => {
      if (r && r.ok) {
        setScenes(Array.isArray(r.scenes) ? r.scenes : []);
        setActiveId(r.activeSceneId != null ? r.activeSceneId : null);
        setError('');
      }
    }).catch(() => {});
  }

  // mount 시 1회 + onChange(=명령/델타/씬 동기) 시마다 목록 재조회. 'scene' 델타는 컨트롤러가
  // resyncFromBridge → notifyChange 로 흘리므로 onChange 만 구독해도 전환/추가/삭제가 반영된다.
  useEffect(() => {
    if (!isRemote) return undefined;
    refresh();
    const off = controller.onChange ? controller.onChange(refresh) : (() => {});
    return off;
  }, []);

  if (!isRemote) {
    return (
      <div style={barLocal}>씬 관리 — 브리지 연결 시 사용 가능</div>
    );
  }

  function onSwitch(id) {
    if (id === activeId) return;
    setError('');
    Promise.resolve(controller.switchScene(id)).then((r) => {
      if (r && r.ok === false && r.error) setError(r.error);
    }).catch(() => {});
  }
  function onAdd() {
    setError('');
    Promise.resolve(controller.addScene()).then((r) => {
      if (r && r.ok === false && r.error) setError(r.error);
      else refresh();
    }).catch(() => {});
  }
  function onRemove(id, ev) {
    ev.stopPropagation();
    setError('');
    Promise.resolve(controller.removeScene(id)).then((r) => {
      if (r && r.ok === false && r.error) setError(r.error);
      else refresh();
    }).catch(() => {});
  }
  function startRename(scene, ev) {
    ev.stopPropagation();
    setEditingId(scene.id);
    setEditValue(scene.name || scene.id);
  }
  function commitRename(id) {
    const name = String(editValue || '').trim();
    setEditingId(null);
    if (!name) return;
    setError('');
    Promise.resolve(controller.renameScene(id, name)).then((r) => {
      if (r && r.ok === false && r.error) setError(r.error);
      else refresh();
    }).catch(() => {});
  }
  function onEditKey(id, ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); commitRename(id); }
    else if (ev.key === 'Escape') { ev.preventDefault(); setEditingId(null); }
  }

  return (
    <div style={wrap}>
      <div style={bar}>
        {scenes.map((s) => {
          const active = s.id === activeId;
          if (editingId === s.id) {
            return (
              <input key={s.id} value={editValue} autoFocus
                     onInput={(e) => setEditValue(e.target.value)}
                     onKeyDown={(e) => onEditKey(s.id, e)}
                     onBlur={() => commitRename(s.id)}
                     style={editInput} />
            );
          }
          return (
            <div key={s.id} title={(s.name || s.id) + (s.entityCount != null ? ` · ${s.entityCount}개` : '')}
                 onClick={() => onSwitch(s.id)}
                 onDblClick={(e) => startRename(s, e)}
                 style={tab(active)}>
              <span style={tabLabel}>{s.name || s.id}</span>
              {scenes.length > 1 && (
                <span onClick={(e) => onRemove(s.id, e)} title="씬 삭제" style={closeBtn}>×</span>
              )}
            </div>
          );
        })}
        <button onClick={onAdd} title="씬 추가" style={addBtn}>+ 씬</button>
      </div>
      {error && <div style={errBar}>{error}</div>}
    </div>
  );
}

const wrap = { borderBottom: '1px solid var(--border)' };
const bar = { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px',
  overflowX: 'auto', background: 'var(--panel)' };
const barLocal = { padding: '8px 10px', fontSize: '11px', color: 'var(--text-dim)',
  borderBottom: '1px solid var(--border)', background: 'var(--panel)' };
function tab(active) {
  return {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
    fontSize: '12px',
    background: active ? '#2b4a63' : 'transparent',
    color: active ? '#fff' : 'var(--text)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)'
  };
}
const tabLabel = { maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' };
const closeBtn = { color: 'var(--text-dim)', fontWeight: 700, padding: '0 2px', lineHeight: 1 };
const addBtn = { padding: '3px 8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
  background: 'transparent', color: 'var(--text-dim)', border: '1px dashed var(--border)', borderRadius: '4px' };
const editInput = { width: '110px', fontSize: '12px', padding: '2px 6px',
  background: 'var(--input-bg, #11151c)', color: 'var(--text)', border: '1px solid var(--accent)', borderRadius: '4px' };
const errBar = { padding: '4px 10px', fontSize: '11px', color: 'var(--danger, #e06c75)',
  background: 'var(--panel)' };
