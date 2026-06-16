/* ============================================================================
 * PrefabPanel — 2D 프리팹(서브트리 깊은복제·id재발급·Variant금지, ADR-003)
 * ----------------------------------------------------------------------------
 * 선택 엔티티의 서브트리를 즉석 복제(Ctrl+D)하거나 명명 프리팹으로 디스크 저장하고,
 * 저장된 프리팹 목록을 클릭해 씬에 배치한다. 모든 동작은 editorController 메서드
 * (duplicateEntity·savePrefab·listPrefabs·instantiatePrefab) 경유 → 코어 'instantiate'
 * 원자명령(단일 undo)으로 수렴. 디스크 저장·목록·배치는 브리지 권위(remote 전용).
 * ==========================================================================*/
import { useState, useEffect } from 'preact/hooks';

export function PrefabPanel({ controller, world, selection }) {
  const [prefabs, setPrefabs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const remote = !!controller.isRemote;
  const sel = (selection && selection.length) ? selection[0] : null;
  const selName = (() => {
    if (!sel || !world || !Array.isArray(world.entities)) return null;
    const e = world.entities.find((x) => x.id === sel);
    return e ? (e.name || e.id) : null;
  })();

  async function refresh() {
    if (!remote) return;
    try {
      const r = await controller.listPrefabs();
      setPrefabs((r && Array.isArray(r.prefabs)) ? r.prefabs : []);
    } catch (e) { /* 격리 */ }
  }
  useEffect(() => { refresh(); }, []);

  async function onDuplicate() {
    if (!sel) { setMsg('먼저 엔티티를 선택하세요.'); return; }
    setBusy(true);
    try { await Promise.resolve(controller.duplicateEntity(sel)); setMsg('선택 서브트리를 복제했습니다.'); }
    catch (e) { setMsg('복제 실패'); }
    setBusy(false);
  }

  async function onSave() {
    if (!sel) { setMsg('먼저 엔티티를 선택하세요.'); return; }
    const name = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt('프리팹 이름(영숫자 . _ - 만):', selName || sel) : null;
    if (!name) return;
    setBusy(true);
    try {
      const r = await controller.savePrefab(name, sel);
      if (r && r.ok) { setMsg(`프리팹 "${r.name}" 저장(엔티티 ${r.count}개)`); refresh(); }
      else setMsg('저장 실패: ' + ((r && r.error) || '알 수 없음'));
    } catch (e) { setMsg('저장 실패'); }
    setBusy(false);
  }

  async function onPlace(name) {
    setBusy(true);
    try {
      // 뷰포트 대략 중앙(160,120)에 루트 배치 — 배치 후 기즈모로 이동 가능.
      const r = await controller.instantiatePrefab(name, 160, 120, null);
      if (r && r.ok) setMsg(`프리팹 "${name}" 배치(엔티티 ${r.ids ? r.ids.length : '?'}개)`);
      else setMsg('배치 실패: ' + ((r && r.error) || '알 수 없음'));
    } catch (e) { setMsg('배치 실패'); }
    setBusy(false);
  }

  if (!remote) {
    return (
      <div style={panel}>
        <div style={header}>프리팹 (Prefab)</div>
        <div style={empty}>프리팹은 브리지 모드에서만 동작합니다.<br />(node editor/server/bridge.mjs 후 remote 접속)</div>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={header}>프리팹 (Prefab)</div>
      <div style={toolbar}>
        <button style={btn} disabled={!sel || busy} onClick={onDuplicate} title="선택 서브트리 즉석 복제 (Ctrl+D)">선택 복제</button>
        <button style={btn} disabled={!sel || busy} onClick={onSave} title="선택 서브트리를 명명 프리팹으로 저장">프리팹으로 저장…</button>
        <button style={btnGhost} disabled={busy} onClick={refresh} title="목록 새로고침">↻</button>
      </div>
      <div style={selInfo}>{sel ? `선택: ${selName}` : '엔티티를 선택해 복제·저장'}</div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {prefabs.length === 0 && <div style={empty}>저장된 프리팹 없음</div>}
        {prefabs.map((p) => (
          <div key={p.name} style={card} onClick={() => onPlace(p.name)} title="클릭해 씬에 배치">
            <div style={{ color: 'var(--text)' }}>📦 {p.name}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              엔티티 {p.count}개{p.root ? ` · 루트 ${p.root}` : ''}
            </div>
          </div>
        ))}
      </div>
      {msg && <div style={msgBar}>{msg}</div>}
    </div>
  );
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)', borderRight: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const toolbar = { padding: '8px 10px', display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' };
const selInfo = { padding: '4px 10px', fontSize: '11px', color: 'var(--text-dim)' };
const empty = { padding: '12px 10px', color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.5 };
const card = { padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' };
const btn = { padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: 'var(--accent)', color: '#08121b', border: 'none', borderRadius: '3px' };
const btnGhost = { padding: '4px 8px', fontSize: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px' };
const msgBar = { padding: '6px 10px', fontSize: '11px', color: 'var(--accent)', borderTop: '1px solid var(--border)' };
