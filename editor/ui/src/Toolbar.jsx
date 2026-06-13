/* Toolbar — 기즈모 모드 토글, 스냅 토글, Undo/Redo, Save, 엔티티 추가, Play/Edit. */
import { useState } from 'preact/hooks';

export function Toolbar({ controller, gizmoMode, snap, snapSize, mode, undoDepth, redoDepth, onSnapChange }) {
  const [savedMsg, setSavedMsg] = useState('');

  function setGizmo(m) { controller.setGizmoMode(m); }
  function toggleSnap() { onSnapChange(!snap, snapSize); }

  function addEntity() {
    // 기본: 결정적 플레이스홀더 스프라이트 없이 Body 만 가진 엔티티(뷰포트 중앙).
    controller.addEntity({
      name: '새 엔티티',
      transform: { x: 160, y: 120 },
      components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }]
    });
  }

  function save() {
    controller.save(true);    // localStorage + 파일 다운로드
    setSavedMsg('저장됨 ✓');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  function reload() {
    const ok = controller.reloadFromSaved();
    setSavedMsg(ok ? '재로드됨 ✓' : '저장본 없음');
    setTimeout(() => setSavedMsg(''), 1500);
  }

  function toggleMode() {
    controller.setMode(mode === 'play' ? 'edit' : 'play');
  }

  return (
    <div style={bar}>
      <Group label="기즈모">
        <Btn active={gizmoMode === 'move'} onClick={() => setGizmo('move')} title="이동">↔</Btn>
        <Btn active={gizmoMode === 'rotate'} onClick={() => setGizmo('rotate')} title="회전">⟳</Btn>
        <Btn active={gizmoMode === 'scale'} onClick={() => setGizmo('scale')} title="스케일">⤢</Btn>
      </Group>

      <Group label="스냅">
        <Btn active={snap} onClick={toggleSnap} title="그리드 스냅">{snap ? '스냅 ON' : '스냅 OFF'}</Btn>
        <input type="number" min="1" style={snapInp} value={snapSize}
               onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) onSnapChange(snap, v); }} />
      </Group>

      <Group label="편집">
        <Btn disabled={undoDepth === 0} onClick={() => controller.undo()} title={'실행 취소 (' + undoDepth + ')'}>↶ Undo</Btn>
        <Btn disabled={redoDepth === 0} onClick={() => controller.redo()} title={'다시 실행 (' + redoDepth + ')'}>↷ Redo</Btn>
        <Btn onClick={addEntity} title="엔티티 추가">＋ 엔티티</Btn>
      </Group>

      <Group label="씬">
        <Btn onClick={save} title="저장(localStorage + 다운로드)">💾 Save</Btn>
        <Btn onClick={reload} title="저장본 재로드">⟲ Load</Btn>
        <Btn active={mode === 'play'} onClick={toggleMode} title="Play/Edit 전환">
          {mode === 'play' ? '⏹ Stop' : '▶ Play'}</Btn>
      </Group>

      {savedMsg && <span style={{ color: 'var(--ok)', marginLeft: 'auto', alignSelf: 'center' }}>{savedMsg}</span>}
    </div>
  );
}

function Group({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '10px',
                  marginRight: '4px', borderRight: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '10px', marginRight: '2px' }}>{label}</span>
      {children}
    </div>
  );
}
function Btn({ active, disabled, onClick, title, children }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick}
            style={{
              background: active ? 'var(--accent)' : 'var(--panel2)',
              color: active ? '#08121a' : (disabled ? 'var(--text-dim)' : 'var(--text)'),
              border: '1px solid var(--border)', borderRadius: '3px',
              padding: '4px 8px', cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1
            }}>{children}</button>
  );
}

const bar = { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
  background: 'var(--panel)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' };
const snapInp = { width: '48px', background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '3px', padding: '3px 5px' };
