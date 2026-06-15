/* Hierarchy — 엔티티 트리(선택·다중선택 연동). */
import { spriteApi } from './sprite/spriteApi.js';

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

  // 에셋을 엔티티로 드래그 배정. 드롭 페이로드(application/wgf-asset) 두 형태 분기:
  //  ① 라이브러리 프레임: JSON 문자열 {relPath, frame, as} → use() 로 vendoring + local 에셋
  //     등록 후 그 asset.id 로 컴포넌트 부착.
  //  ② 씬에셋 카드: raw spriteId 문자열(기존 호환) → 바로 assignAssetToEntity.
  function onDragOver(ev) {
    if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('application/wgf-asset')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    }
  }
  async function onDrop(id, ev) {
    let raw = null;
    try { raw = ev.dataTransfer.getData('application/wgf-asset'); } catch (e) {}
    if (!raw) return;
    ev.preventDefault();
    if (!controller.assignAssetToEntity) return;

    // JSON 페이로드(라이브러리 프레임) 시도. 파싱 실패 또는 relPath 없으면 raw spriteId 경로.
    let payload = null;
    try { payload = JSON.parse(raw); } catch (e) { payload = null; }

    // 방어: 파싱돼 객체이지만 relPath 가 비었으면(빈 드래그/손상 페이로드) raw 폴백으로 가지 않고 중단한다.
    //  (JSON 문자열이 sprite id 로 부착되는 오염 차단 — 객체이면 라이브러리 경로가 의도였음.)
    if (payload && typeof payload === 'object' && !payload.relPath) {
      if (typeof console !== 'undefined') console.warn('[Hierarchy] 드롭 페이로드에 relPath 없음 — 무시');
      return;
    }

    if (payload && typeof payload === 'object' && payload.relPath) {
      const frame = payload.frame;
      const as = payload.as;
      try {
        const r = await spriteApi.use({ relPath: payload.relPath, frame });
        if (!r || !r.ok) {
          if (r && r.status === 409 && typeof console !== 'undefined') {
            console.warn('[Hierarchy] 스프라이트 적용 실패 — 빈 씬(먼저 게임을 열어주세요)');
          } else if (typeof console !== 'undefined') {
            console.warn('[Hierarchy] 스프라이트 적용 실패:', (r && r.error) || '알 수 없음');
          }
          return;
        }
        const assetId = r.asset && r.asset.id;
        if (!assetId) { if (typeof console !== 'undefined') console.warn('[Hierarchy] 적용 실패 — 에셋 id 없음'); return; }
        await controller.assignAssetToEntity(id, assetId, { frame, as });
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Hierarchy] 스프라이트 드롭 처리 오류:', e);
      }
      return;
    }

    // 기존 씬에셋 카드(raw spriteId 문자열) — 그대로 배정.
    controller.assignAssetToEntity(id, raw);
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
                 onDragOver={onDragOver}
                 onDrop={(ev) => onDrop(e.id, ev)}
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
