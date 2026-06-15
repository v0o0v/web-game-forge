/* ============================================================================
 * dockModel — 도킹 레이아웃 트리의 순수 모델 헬퍼 (모듈 A)
 * ----------------------------------------------------------------------------
 * 레이아웃 트리는 직렬화 가능한 plain 객체. 노드 타입 2종:
 *   스플릿: { type:'split', dir:'row'|'col', sizes:number[], children:Node[] }
 *           (sizes.length === children.length, 합은 임의 비율 — 사용 시 정규화)
 *   탭그룹(리프): { type:'tabs', panels:string[], active:string }
 *
 * 모든 헬퍼는 순수 함수(불변 업데이트). 깊은 복제는 cloneNode(구조 복제).
 * panelId 는 레이아웃 전체에서 단 한 곳에만 존재한다(중복 배치 금지).
 * ==========================================================================*/

// ── 기본 레이아웃 ─────────────────────────────────────────────────────────────
// row[ 좌(hierarchy,assets 탭) | 중앙(viewport) | 우(inspector,skills 탭) | 끝(chat) ]
// 현재 main.jsx 의 고정 레이아웃을 탭화한 형태. sizes 는 비율(합 1.0).
export const DEFAULT_LAYOUT = {
  type: 'split', dir: 'row', sizes: [0.18, 0.5, 0.2, 0.12],
  children: [
    { type: 'tabs', panels: ['hierarchy', 'assets'], active: 'hierarchy' },
    { type: 'tabs', panels: ['viewport'], active: 'viewport' },
    { type: 'tabs', panels: ['inspector', 'skills'], active: 'inspector' },
    { type: 'tabs', panels: ['chat'], active: 'chat' }
  ]
};

// ── 내부 유틸 ────────────────────────────────────────────────────────────────

/** plain 객체 구조 복제(함수/순환 없음 가정). */
export function cloneNode(node) {
  return node == null ? node : JSON.parse(JSON.stringify(node));
}

/** 노드가 탭그룹(리프)인지. */
export function isTabs(node) {
  return !!node && node.type === 'tabs';
}

/** 노드가 스플릿인지. */
export function isSplit(node) {
  return !!node && node.type === 'split';
}

/** 합이 1이 되도록 sizes 정규화. 비정상(빈/음수/0합) 입력은 균등 분배. */
function normalizeSizes(sizes, count) {
  const arr = Array.isArray(sizes) ? sizes.slice(0, count) : [];
  while (arr.length < count) arr.push(0);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const v = Number(arr[i]);
    arr[i] = (isFinite(v) && v > 0) ? v : 0;
    sum += arr[i];
  }
  if (sum <= 0) {
    const even = count > 0 ? 1 / count : 0;
    return arr.map(() => even);
  }
  return arr.map((v) => v / sum);
}

// ── 탭그룹 정제 ──────────────────────────────────────────────────────────────

/**
 * 탭그룹의 panels 를 availableIds 로 필터(중복 제거), active 보정.
 * 빈 그룹이면 null 반환(상위에서 붕괴).
 */
function pruneTabs(node, availableIds, seen) {
  const out = [];
  for (const id of (Array.isArray(node.panels) ? node.panels : [])) {
    if (typeof id !== 'string') continue;
    if (availableIds && !availableIds.has(id)) continue;
    if (seen.has(id)) continue;          // 전역 중복 배치 방지
    seen.add(id);
    out.push(id);
  }
  if (out.length === 0) return null;
  let active = node.active;
  if (!active || out.indexOf(active) < 0) active = out[0];
  return { type: 'tabs', panels: out, active };
}

// ── 정규화(핵심) ─────────────────────────────────────────────────────────────

/**
 * 손상/빈 입력 방어 + 정제. availableIds 에 없는 패널 제거, 빈 그룹 붕괴,
 * 단일 자식 스플릿 평탄화, active 보정, sizes 정규화.
 * @param {object|null} layout
 * @param {string[]|Set<string>=} availableIds  배치 허용 패널 집합(생략 시 전부 허용)
 * @returns {object} 항상 유효한 레이아웃(완전 비면 DEFAULT_LAYOUT 정제본)
 */
export function normalizeLayout(layout, availableIds) {
  const idSet = availableIds == null
    ? null
    : (availableIds instanceof Set ? availableIds : new Set(availableIds));
  const seen = new Set();
  const result = normalizeNode(layout, idSet, seen);
  if (result) return result;
  // 입력이 완전히 비었거나 손상 → DEFAULT 정제(availableIds 로 한 번 더 필터).
  const fallback = normalizeNode(cloneNode(DEFAULT_LAYOUT), idSet, new Set());
  return fallback || { type: 'tabs', panels: [], active: null };
}

function normalizeNode(node, idSet, seen) {
  if (isTabs(node)) {
    return pruneTabs(node, idSet, seen);
  }
  if (isSplit(node)) {
    const dir = (node.dir === 'col') ? 'col' : 'row';
    const kids = [];
    const sizesIn = Array.isArray(node.sizes) ? node.sizes : [];
    const sizesKept = [];
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = 0; i < children.length; i++) {
      const child = normalizeNode(children[i], idSet, seen);
      if (child) {
        kids.push(child);
        const s = Number(sizesIn[i]);
        sizesKept.push((isFinite(s) && s > 0) ? s : 0);
      }
    }
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0];  // 단일 자식 스플릿 평탄화
    // 같은 방향의 스플릿 자식은 평탄화(중첩 단순화).
    const flatKids = [];
    const flatSizes = [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (isSplit(k) && k.dir === dir) {
        const inner = normalizeSizes(k.sizes, k.children.length);
        const w = sizesKept[i] || 0;
        for (let j = 0; j < k.children.length; j++) {
          flatKids.push(k.children[j]);
          flatSizes.push((w > 0 ? w : 1) * inner[j]);
        }
      } else {
        flatKids.push(k);
        flatSizes.push(sizesKept[i]);
      }
    }
    return { type: 'split', dir, sizes: normalizeSizes(flatSizes, flatKids.length), children: flatKids };
  }
  return null;
}

// ── 조회 헬퍼 ────────────────────────────────────────────────────────────────

/** 레이아웃에 배치된 모든 panelId(순서대로). */
export function collectPanelIds(layout) {
  const out = [];
  (function walk(node) {
    if (isTabs(node)) {
      for (const id of (node.panels || [])) out.push(id);
    } else if (isSplit(node)) {
      for (const c of (node.children || [])) walk(c);
    }
  })(layout);
  return out;
}

/** 배치돼 있으면 true. */
export function isPanelVisible(layout, panelId) {
  return collectPanelIds(layout).indexOf(panelId) >= 0;
}

/** 첫 번째 탭그룹(DFS) 반환. 없으면 null. */
function findFirstTabs(node) {
  if (isTabs(node)) return node;
  if (isSplit(node)) {
    for (const c of (node.children || [])) {
      const r = findFirstTabs(c);
      if (r) return r;
    }
  }
  return null;
}

// ── 불변 변환 ────────────────────────────────────────────────────────────────

/**
 * 패널 추가. 이미 있으면 그 그룹의 active 로, 없으면 첫 탭그룹에 탭으로 추가.
 * 레이아웃이 비어 있으면 단일 탭그룹 생성.
 */
export function addPanelToLayout(layout, panelId) {
  if (isPanelVisible(layout, panelId)) {
    return activatePanel(layout, panelId);
  }
  const clone = cloneNode(layout);
  const first = clone ? findFirstTabs(clone) : null;
  if (!first) {
    return { type: 'tabs', panels: [panelId], active: panelId };
  }
  first.panels.push(panelId);
  first.active = panelId;
  return clone;
}

/** 패널이 속한 탭그룹의 active 를 그 패널로 설정(불변). */
export function activatePanel(layout, panelId) {
  const clone = cloneNode(layout);
  (function walk(node) {
    if (isTabs(node)) {
      if ((node.panels || []).indexOf(panelId) >= 0) node.active = panelId;
    } else if (isSplit(node)) {
      for (const c of (node.children || [])) walk(c);
    }
  })(clone);
  return clone;
}

/**
 * 패널 제거 + 빈 그룹 자동 붕괴(상위 스플릿에서 제거, sizes 재정규화,
 * 단일 자식 스플릿 평탄화). 불변.
 */
export function removePanelFromLayout(layout, panelId) {
  const clone = cloneNode(layout);
  const pruned = removeFromNode(clone, panelId);
  // 제거로 전부 비면 빈 탭그룹(상위에서 normalizeLayout 이 DEFAULT 복원 가능).
  return pruned || { type: 'tabs', panels: [], active: null };
}

function removeFromNode(node, panelId) {
  if (isTabs(node)) {
    const idx = (node.panels || []).indexOf(panelId);
    if (idx < 0) return node;
    node.panels.splice(idx, 1);
    if (node.panels.length === 0) return null;  // 빈 그룹 붕괴 신호
    if (node.active === panelId) node.active = node.panels[Math.min(idx, node.panels.length - 1)];
    return node;
  }
  if (isSplit(node)) {
    const kids = [];
    const sizes = [];
    for (let i = 0; i < node.children.length; i++) {
      const c = removeFromNode(node.children[i], panelId);
      if (c) { kids.push(c); sizes.push(node.sizes[i]); }
    }
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0];      // 단일 자식 평탄화
    node.children = kids;
    node.sizes = normalizeSizes(sizes, kids.length);
    return node;
  }
  return node;
}

/** JSON 안전 복제(함수/순환 없음 — 영속/전달용). null 안전. */
export function serializeLayout(layout) {
  return cloneNode(layout);
}

/** sizes 정규화를 외부에 노출(리사이저 커밋용). */
export { normalizeSizes };
