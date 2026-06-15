/* ============================================================================
 * editorSettings — WGF Studio 에디터 환경설정 스토어
 * ----------------------------------------------------------------------------
 * 에디터 전역 UI 설정(폰트 크기·강조색·밀도 등)을 localStorage 에 영속하고,
 * CSS 변수 오버라이드로 즉시 반영한다. 구독 패턴으로 컴포넌트 재렌더 지원.
 *
 * 사용법:
 *   const settings = createEditorSettings();
 *   settings.set({ fontSize: 15 });   // 즉시 CSS 반영 + 구독자 통지
 *   const off = settings.subscribe(s => ...);  // 구독
 *   off();  // 구독 해제
 * ==========================================================================*/

const STORAGE_KEY = 'wgf-studio-settings';

/** 기본 설정값 */
const DEFAULTS = {
  /** 에디터 전역 UI 폰트 px (5~24 범위 가드) */
  fontSize: 13,
  /** --accent 오버라이드 (테마 강조색) */
  accent: '#4fd0ff',
  /** UI 밀도: 'comfortable'(8px 패딩) | 'compact'(4px 패딩) */
  density: 'comfortable',
  /** 뷰포트 배경색 */
  viewportBg: '#0e1016',
  /** 스냅 기본값 (리드/툴바가 참조) */
  snapDefault: false,
  /** 스냅 그리드 크기 px */
  snapSize: 16,
};

const FONT_MIN = 5;
const FONT_MAX = 24;

/**
 * 에디터 환경설정 스토어 생성.
 * @returns {{ get, set, subscribe, reset, applyToDocument, increaseFont, decreaseFont, resetFont }}
 */
export function createEditorSettings() {
  // localStorage 에서 읽기, 파싱 실패/없음 → 기본값
  let current = Object.assign({}, DEFAULTS);
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      // 알려진 키만 병합 (불필요한 필드 오염 방지)
      for (const k of Object.keys(DEFAULTS)) {
        if (parsed[k] !== undefined) current[k] = parsed[k];
      }
      // 폰트 범위 가드 (저장된 값이 범위 밖일 수 있음)
      current.fontSize = clampFont(current.fontSize);
    }
  } catch (_) {
    // 사적 모드 / JSON 파싱 오류 → 기본값 유지
  }

  const subscribers = [];

  /** 현재 설정 복제 반환 */
  function get() {
    return Object.assign({}, current);
  }

  /** 설정 병합·영속·구독자 통지·CSS 반영 */
  function set(patch) {
    const next = Object.assign({}, current, patch);
    // 폰트 범위 가드
    if (patch.fontSize !== undefined) {
      next.fontSize = clampFont(next.fontSize);
    }
    current = next;
    _persist();
    applyToDocument();
    _notify();
  }

  /** 기본값으로 복원 */
  function reset() {
    set(Object.assign({}, DEFAULTS));
  }

  /**
   * CSS 변수를 document.documentElement 에 반영.
   * body font-size 는 리드가 var(--font-size) 참조하도록 처리 — 여기선 변수 세팅만.
   */
  function applyToDocument() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    try {
      root.style.setProperty('--font-size', current.fontSize + 'px');
      root.style.setProperty('--accent', current.accent);
      root.style.setProperty(
        '--pad',
        current.density === 'compact' ? '4px' : '8px'
      );
      root.style.setProperty('--viewport-bg', current.viewportBg);
    } catch (_) {
      // 스타일 접근 불가 → 무시
    }
  }

  /**
   * 구독 등록. 반환 함수로 해제.
   * @param {(settings: object) => void} cb
   * @returns {() => void}
   */
  function subscribe(cb) {
    subscribers.push(cb);
    return () => {
      const i = subscribers.indexOf(cb);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  // ── 폰트 크기 헬퍼 ────────────────────────────────────────────────────────

  /** 폰트 +1px (범위 가드) */
  function increaseFont() {
    set({ fontSize: clampFont(current.fontSize + 1) });
  }

  /** 폰트 -1px (범위 가드) */
  function decreaseFont() {
    set({ fontSize: clampFont(current.fontSize - 1) });
  }

  /** 폰트 기본값(13px)으로 리셋 */
  function resetFont() {
    set({ fontSize: DEFAULTS.fontSize });
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  function _persist() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      }
    } catch (_) {
      // 사적 모드 → 무시
    }
  }

  function _notify() {
    const snap = get();
    for (const cb of subscribers) {
      try { cb(snap); } catch (_) {}
    }
  }

  // 초기 CSS 반영 (페이지 로드 시 저장된 설정 즉시 적용)
  applyToDocument();

  return { get, set, subscribe, reset, applyToDocument, increaseFont, decreaseFont, resetFont };
}

/** 폰트 크기 범위(5~24) 클램프 */
function clampFont(v) {
  const n = Number(v);
  if (!isFinite(n)) return DEFAULTS.fontSize;
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));
}
