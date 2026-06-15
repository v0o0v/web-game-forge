/* ============================================================================
 * MenuBar — 클래식 상단 메뉴바 컴포넌트
 * ----------------------------------------------------------------------------
 * props:
 *   menus: Array<{ label: string, items: MenuItem[] }>
 *
 * MenuItem 형:
 *   { label, action?, shortcut?, type?:'item'|'separator'|'checkbox'|'submenu',
 *     checked?, items?, disabled? }
 *
 * 동작:
 *  - 최상위 라벨 클릭 → 드롭다운 열기. 이미 열린 상태에서 다른 최상위 hover → 전환.
 *  - 바깥 클릭 / Esc → 닫기.
 *  - submenu 는 항목 hover 시 우측으로 펼침.
 *  - separator 는 구분선, checkbox 는 ✓ 표시, disabled 는 흐리게+클릭 무시.
 *  - shortcut 은 항목 우측에 흐린 텍스트.
 * ==========================================================================*/
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

// ── 상수 ────────────────────────────────────────────────────────────────────

const BAR_H = 28;   // 메뉴바 높이 px

// ── 스타일 객체 ─────────────────────────────────────────────────────────────

const sBar = {
  display: 'flex',
  alignItems: 'stretch',
  height: BAR_H + 'px',
  background: 'var(--panel)',
  borderBottom: '1px solid var(--border)',
  userSelect: 'none',
  position: 'relative',
  zIndex: 200,
  flexShrink: 0,
};

function sTopBtn(active) {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    height: '100%',
    fontSize: '12px',
    color: active ? '#08121a' : 'var(--text)',
    background: active ? 'var(--accent)' : 'transparent',
    border: 'none',
    borderRight: '1px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const sDropdown = {
  position: 'absolute',
  top: BAR_H + 'px',
  background: 'var(--panel2)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  minWidth: '180px',
  zIndex: 9999,
  padding: '3px 0',
};

function sItem(disabled, hovered) {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px 5px 24px',
    fontSize: '12px',
    color: disabled ? 'var(--text-dim)' : 'var(--text)',
    background: hovered && !disabled ? 'var(--accent)' : 'transparent',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
    position: 'relative',
  };
}

const sSeparator = {
  height: '1px',
  background: 'var(--border)',
  margin: '3px 0',
};

const sShortcut = {
  marginLeft: 'auto',
  paddingLeft: '20px',
  color: 'var(--text-dim)',
  fontSize: '11px',
};

const sArrow = {
  marginLeft: 'auto',
  paddingLeft: '12px',
  color: 'var(--text-dim)',
  fontSize: '10px',
};

const sCheck = {
  position: 'absolute',
  left: '7px',
  fontSize: '11px',
};

const sSubmenu = {
  position: 'absolute',
  top: '-3px',
  left: '100%',
  background: 'var(--panel2)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  minWidth: '170px',
  zIndex: 10000,
  padding: '3px 0',
};

// ── 내부 컴포넌트 ────────────────────────────────────────────────────────────

/**
 * 단일 메뉴 항목 (재귀적으로 서브메뉴 처리).
 */
function MenuItem({ item, onClose, depth }) {
  // 훅은 모두 최상단(조건부 return 이전)에서 호출 — 훅 순서 안정성 보장.
  // separator 는 부모(Dropdown/서브메뉴)가 MenuItem 을 거치지 않고 직접 렌더하므로
  // 여기로는 도달하지 않는다.
  const [subHovered, setSubHovered] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef(null);

  const isSubmenu = item.type === 'submenu' && Array.isArray(item.items);
  const isCheckbox = item.type === 'checkbox';
  const disabled = !!item.disabled;

  function handleClick(e) {
    e.stopPropagation();
    if (disabled) return;
    if (isSubmenu) return; // 서브메뉴는 hover 로만
    if (item.action) {
      try { item.action(); } catch (_) {}
    }
    onClose();
  }

  function handleMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSubHovered(true);
  }

  function handleMouseLeave() {
    timerRef.current = setTimeout(() => setSubHovered(false), 120);
  }

  return (
    <div
      style={sItem(disabled, hovered || subHovered)}
      onClick={handleClick}
      onMouseEnter={() => { setHovered(true); handleMouseEnter(); }}
      onMouseLeave={() => { setHovered(false); handleMouseLeave(); }}
    >
      {/* 체크 표시 */}
      {isCheckbox && item.checked && <span style={sCheck}>✓</span>}

      {/* 라벨 */}
      <span>{item.label}</span>

      {/* 단축키 */}
      {item.shortcut && !isSubmenu && (
        <span style={sShortcut}>{item.shortcut}</span>
      )}

      {/* 서브메뉴 화살표 */}
      {isSubmenu && <span style={sArrow}>▶</span>}

      {/* 서브메뉴 패널 */}
      {isSubmenu && subHovered && (
        <div style={sSubmenu} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          {item.items.map((sub, i) => (
            sub.type === 'separator'
              ? <div key={i} style={sSeparator} />
              : <MenuItem key={i} item={sub} onClose={onClose} depth={(depth || 0) + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 드롭다운 패널.
 */
function Dropdown({ items, left, onClose }) {
  return (
    <div style={{ ...sDropdown, left: left + 'px' }}>
      {items.map((item, i) => (
        item.type === 'separator'
          ? <div key={i} style={sSeparator} />
          : <MenuItem key={i} item={item} onClose={onClose} depth={0} />
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

/**
 * 클래식 상단 메뉴바.
 * @param {{ menus: Array<{label: string, items: MenuItem[]}> }} props
 */
export function MenuBar({ menus }) {
  // 열려 있는 최상위 메뉴 인덱스 (null = 닫힘)
  const [openIdx, setOpenIdx] = useState(null);
  // 각 최상위 버튼 DOM ref (드롭다운 위치 계산용)
  const btnRefs = useRef([]);
  const barRef = useRef(null);

  // 바깥 클릭 → 닫기
  useEffect(() => {
    if (openIdx === null) return;
    function onDown(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenIdx(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openIdx]);

  // Esc → 닫기
  useEffect(() => {
    if (openIdx === null) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpenIdx(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openIdx]);

  function close() { setOpenIdx(null); }

  function handleTopClick(idx) {
    setOpenIdx(openIdx === idx ? null : idx);
  }

  function handleTopHover(idx) {
    // 이미 열린 상태일 때만 hover 전환 (클래식 메뉴 UX)
    if (openIdx !== null && openIdx !== idx) {
      setOpenIdx(idx);
    }
  }

  // 드롭다운 left 위치 계산 (바 기준 상대 offset)
  function getLeft(idx) {
    const btn = btnRefs.current[idx];
    const bar = barRef.current;
    if (!btn || !bar) return 0;
    return btn.getBoundingClientRect().left - bar.getBoundingClientRect().left;
  }

  return (
    <div ref={barRef} style={sBar}>
      {(menus || []).map((menu, idx) => (
        <button
          key={idx}
          ref={(el) => { btnRefs.current[idx] = el; }}
          style={sTopBtn(openIdx === idx)}
          onClick={() => handleTopClick(idx)}
          onMouseEnter={() => handleTopHover(idx)}
        >
          {menu.label}
        </button>
      ))}

      {/* 드롭다운 (열려있는 메뉴만) */}
      {openIdx !== null && menus[openIdx] && (
        <Dropdown
          items={menus[openIdx].items}
          left={getLeft(openIdx)}
          onClose={close}
        />
      )}
    </div>
  );
}
