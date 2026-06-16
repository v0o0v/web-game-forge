/* ============================================================================
 * tilemap.js — TilemapLayer(2C) 규약 공통 헬퍼 (코어 무수정·순수 함수)
 * ----------------------------------------------------------------------------
 * 타일맵은 새 컴포넌트가 아니라 parentId 계층(2A)의 사용 규약이다(SCHEMA.md §TilemapLayer):
 *   - 컨테이너 엔티티: name 이 "TilemapLayer:<레이어이름>" (예: "TilemapLayer:ground"),
 *     컴포넌트 0개(또는 마커), transform = 레이어 원점.
 *   - 타일 엔티티: parentId = 컨테이너 id, Sprite{sprite,frame}, transform = 컨테이너
 *     기준 로컬 격자 좌표.
 *
 * 이 모듈은 그 규약을 식별·검색하는 순수 헬퍼를 한 곳에 모아 Viewport(우클릭 지우개)·
 * Inspector(레이어 이동 reparent UI)·main(activeLayerId 검증)이 공유하게 한다(드리프트 방지).
 * ========================================================================== */

// 컨테이너 식별 접두사 — 규약상 컨테이너 name 은 "TilemapLayer:<레이어이름>"(콜론 포함). 콜론까지
// 매칭해 'TilemapLayerMeta' 같은 비-컨테이너 이름이 컨테이너로 오인되는 드리프트를 막는다. 타일
// 엔티티는 'tile'/'타일0' 등으로 명명되므로 이 접두사로 컨테이너만 유일하게 골라낸다.
export const TILEMAP_LAYER_PREFIX = 'TilemapLayer:';

// 엔티티가 TilemapLayer 컨테이너인가(name 접두사). parentId 유무는 보지 않는다 —
// 타일은 이 접두사로 명명되지 않으므로 접두사만으로 컨테이너를 유일하게 식별한다.
export function isTilemapContainer(e) {
  return !!(e && typeof e.name === 'string' && e.name.indexOf(TILEMAP_LAYER_PREFIX) === 0);
}

// 월드 좌표를 격자에 스냅(페인팅과 동일 규칙). size<=0 이면 16 기본.
export function snapToGrid(v, size) {
  const s = (size && size > 0) ? size : 16;
  return Math.round(v / s) * s;
}

// 현재 씬(world)에서 TilemapLayer 컨테이너 엔티티 목록을 반환(없으면 빈 배열).
export function listTilemapContainers(world) {
  if (!world || !Array.isArray(world.entities)) return [];
  return world.entities.filter(isTilemapContainer);
}

// 월드 클릭 좌표(worldX,worldY)가 떨어지는 격자 셀에 있는 *최상단* 타일 엔티티를 찾는다.
//  - 타일 = parentId 가 TilemapLayer 컨테이너를 가리키는 엔티티.
//  - 타일의 월드 위치 = 컨테이너 transform + 타일 로컬 transform(어댑터 translate-only 합성과 정합).
//  - 클릭·타일 위치를 같은 size 로 스냅해 비교하므로, 그리드에 정확히 올라간 페인팅 타일은 물론
//    셀 안 임의 지점 클릭도 그 셀의 타일을 집는다(없으면 null).
//  - 여러 레이어가 같은 셀에 겹치면 entities 배열의 *마지막* 매치를 돌려준다. 2C 평면 레이어는
//    배열 순서 = 렌더 순서라 이것이 시각적 최상단이다(transform.depth 는 고려하지 않음 — depth 를
//    쓰는 레이어가 도입되면 후속 lane 에서 depth 우선 선택으로 확장).
export function findTopTileAtCell(world, worldX, worldY, size) {
  if (!world || !Array.isArray(world.entities)) return null;
  const gx = snapToGrid(worldX, size);
  const gy = snapToGrid(worldY, size);
  // 컨테이너 id → transform 색인.
  const containers = Object.create(null);
  for (const e of world.entities) {
    if (isTilemapContainer(e)) containers[e.id] = (e.transform || { x: 0, y: 0 });
  }
  let target = null;
  for (const e of world.entities) {
    if (e.parentId == null || !containers[e.parentId]) continue;   // 타일만(컨테이너의 자식)
    const ct = containers[e.parentId];
    const wx = (ct.x || 0) + (e.transform ? (e.transform.x || 0) : 0);
    const wy = (ct.y || 0) + (e.transform ? (e.transform.y || 0) : 0);
    if (snapToGrid(wx, size) === gx && snapToGrid(wy, size) === gy) target = e;  // 마지막=최상단
  }
  return target;
}
