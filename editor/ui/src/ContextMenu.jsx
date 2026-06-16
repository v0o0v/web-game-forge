/* ============================================================================
 * ContextMenu — 화면 좌표(x,y)에 뜨는 경량 컨텍스트 메뉴(Preact).
 * ----------------------------------------------------------------------------
 * 전체화면 백드롭으로 바깥 클릭/우클릭·Esc 시 닫힌다(onClose). items 는
 * [{ label, onClick, danger? }] 배열 — 항목 클릭 = 먼저 닫고 그 동작 실행.
 * 메뉴 박스는 뷰포트 밖으로 넘치지 않게 좌표를 클램프한다.
 *
 * 범용 프리미티브 — 현재 Hierarchy 우클릭 메뉴가 사용(향후 다른 패널 재사용 가능).
 * 엔진/씬 상태를 직접 만지지 않는 순수 표시 컴포넌트(동작은 items.onClick 위임).
 * ==========================================================================*/
import { useEffect } from 'preact/hooks';

export function ContextMenu({ x, y, items, onClose }) {
  // Esc 로 닫기 — 언마운트 시 리스너 정리(누수 가드, AGENTS.md 규약).
  useEffect(() => {
    function onKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); onClose(); } }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = Array.isArray(items) ? items.filter(Boolean) : [];

  // 화면 밖으로 넘치지 않게 클램프(메뉴 추정 크기 기준). window 미존재(테스트) 시 보수 기본값.
  const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1280;
  const vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 800;
  const MENU_W = 184;
  const estH = list.length * 30 + 8;
  const left = Math.max(4, Math.min(x, vw - MENU_W - 4));
  const top = Math.max(4, Math.min(y, vh - estH - 4));

  return (
    <div style={backdrop}
         onClick={onClose}
         onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div style={{ ...menu, left, top, width: MENU_W }}
           onClick={(e) => e.stopPropagation()}
           onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        {list.map((it, i) => (
          <div key={i}
               style={{ ...itemStyle, ...(it.danger ? itemDanger : {}) }}
               onMouseEnter={(e) => { if (e.currentTarget) e.currentTarget.style.background = it.danger ? '#5a2630' : '#2b4a63'; }}
               onMouseLeave={(e) => { if (e.currentTarget) e.currentTarget.style.background = 'transparent'; }}
               onClick={() => { onClose(); try { it.onClick(); } catch (err) { /* 격리 */ } }}>
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const backdrop = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 };
const menu = {
  position: 'fixed', background: 'var(--panel, #1b1f2a)', border: '1px solid var(--border, #2c3346)',
  borderRadius: '4px', padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.45)', zIndex: 10001, fontSize: '12px'
};
const itemStyle = { padding: '5px 14px', cursor: 'pointer', color: 'var(--text, #e6e9ef)', whiteSpace: 'nowrap' };
const itemDanger = { color: '#ff6b6b' };
