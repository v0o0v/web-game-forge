/* Hierarchy — 엔티티 트리(선택·다중선택 연동). 최상단에 멀티씬 셀렉터 바(ScenePanel) 통합. */
import { useState, useRef, useEffect } from 'preact/hooks';
import { spriteApi } from './sprite/spriteApi.js';
import { ScenePanel } from './ScenePanel.jsx';
import { ContextMenu } from './ContextMenu.jsx';

export function Hierarchy({ controller, world, selection }) {
  const entities = world ? world.entities : [];
  const selSet = new Set(selection);

  // 우클릭 컨텍스트 메뉴 상태 {x,y,id}|null + 비-시각 동작(프리팹 저장) 피드백 메시지.
  const [menu, setMenu] = useState(null);
  const [msg, setMsg] = useState('');
  const msgTimer = useRef(null);
  function flash(text) {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(''), 3000);
  }
  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  function entityName(id) {
    const e = entities.find((x) => x.id === id);
    return e ? (e.name || e.id) : null;
  }

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
        // frameConfig/frames 를 use 에 전달해 vendored asset 레코드에 보존한다 —
        //  AnimatedSprite 시트가 셀로 슬라이싱되고(없으면 전체 1장 렌더), 단일 Sprite 도 프레임 인덱스 표시가 정확해진다.
        const r = await spriteApi.use({ relPath: payload.relPath, frame, frameConfig: payload.frameConfig, frames: payload.frames });
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
        // AnimatedSprite 페이로드(시트+anims)면 anims·play 동반 전달, 아니면 정적 Sprite(frame).
        if (as === 'AnimatedSprite') {
          await controller.assignAssetToEntity(id, assetId, { as: 'AnimatedSprite', anims: payload.anims, play: payload.play });
        } else {
          await controller.assignAssetToEntity(id, assetId, { frame, as });
        }
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Hierarchy] 스프라이트 드롭 처리 오류:', e);
      }
      return;
    }

    // 기존 씬에셋 카드(raw spriteId 문자열) — 그대로 배정.
    controller.assignAssetToEntity(id, raw);
  }

  // ── 우클릭 컨텍스트 메뉴(2D 프리팹 UI) ─────────────────────────────────────────
  // 엔티티 행 우클릭 → 그 엔티티 선택 + 메뉴 표시. 동작은 모두 controller 단일 경로
  //  (복제=duplicateEntity / 프리팹저장=savePrefab[prompt 이름] / 삭제=removeEntity).
  function onContext(id, ev) {
    ev.preventDefault();
    controller.select([id]);
    setMenu({ x: ev.clientX, y: ev.clientY, id });
  }
  async function doDuplicate(id) {
    try { await Promise.resolve(controller.duplicateEntity(id)); }
    catch (e) { flash('복제 실패'); }
  }
  async function doSavePrefab(id) {
    const name = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt('프리팹 이름(영숫자 . _ - 만):', entityName(id) || id) : null;
    if (!name) return;
    try {
      const r = await controller.savePrefab(name, id);
      if (r && r.ok) flash(`프리팹 "${r.name}" 저장(엔티티 ${r.count}개)`);
      else flash('저장 실패: ' + ((r && r.error) || '알 수 없음'));
    } catch (e) { flash('저장 실패'); }
  }
  function doDelete(id) {
    try { controller.removeEntity(id); controller.select([]); }
    catch (e) { flash('삭제 실패'); }
  }
  function menuItems(id) {
    const items = [{ label: '⧉  복제', onClick: () => doDuplicate(id) }];
    // 프리팹 저장은 브리지(remote) 전용 — local 모드에선 메뉴바(menuModel)·PrefabPanel 과 동일하게 숨긴다.
    if (controller.isRemote) items.push({ label: '📦  프리팹으로 저장…', onClick: () => doSavePrefab(id) });
    items.push({ label: '🗑  삭제', danger: true, onClick: () => doDelete(id) });
    return items;
  }

  return (
    <div style={panel}>
      <ScenePanel controller={controller} />
      <div style={header}>계층 (Hierarchy)</div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {entities.length === 0 && <div style={empty}>엔티티 없음</div>}
        {entities.map((e) => {
          const sel = selSet.has(e.id);
          const types = e.components.map((c) => c.type).filter(Boolean);
          return (
            <div key={e.id}
                 onClick={(ev) => onClick(e.id, ev)}
                 onContextMenu={(ev) => onContext(e.id, ev)}
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
      {msg && <div style={msgBar}>{msg}</div>}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.id)}
                     onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderRight: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const empty = { padding: '12px 10px', color: 'var(--text-dim)' };
const msgBar = { padding: '6px 10px', fontSize: '11px', color: 'var(--accent)', borderTop: '1px solid var(--border)' };
