/* Hierarchy — 엔티티 트리(선택·다중선택 연동). */
export function Hierarchy({ controller, world, selection }) {
  const entities = world ? world.entities : [];
  const selSet = new Set(selection);

  function onClick(id, ev) {
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
      const next = selection.slice();
      const i = next.indexOf(id);
      if (i >= 0) next.splice(i, 1); else next.push(id);
      controller.select(next);
    } else {
      controller.select([id]);
    }
  }

  return (
    <div style={panel}>
      <div style={header}>계층 (Hierarchy)</div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {entities.length === 0 && <div style={empty}>엔티티 없음</div>}
        {entities.map((e) => {
          const sel = selSet.has(e.id);
          const types = e.components.map((c) => c.type).filter(Boolean);
          return (
            <div key={e.id}
                 onClick={(ev) => onClick(e.id, ev)}
                 style={{
                   padding: '4px 10px', cursor: 'pointer',
                   background: sel ? '#2b4a63' : 'transparent',
                   borderLeft: sel ? '2px solid var(--accent)' : '2px solid transparent'
                 }}>
              <div style={{ color: sel ? '#fff' : 'var(--text)' }}>{e.name || e.id}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                {e.id}{types.length ? ' · ' + types.join(', ') : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderRight: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const empty = { padding: '12px 10px', color: 'var(--text-dim)' };
