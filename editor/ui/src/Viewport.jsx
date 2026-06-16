/* Viewport — scenekit-phaser 어댑터를 마운트해 현재 씬을 t=0 표시.
 *  + 라이브러리/카탈로그/씬에셋 드래그를 캔버스에 직접 드롭 → 드롭 위치에 새 엔티티 생성(기능 C).
 *    좌표 변환: host 안 <canvas>(Phaser 생성)의 getBoundingClientRect 로 CSS 스케일 흡수
 *    → 월드 좌표(엔진 1:1). gameW/gameH = sceneDoc.meta.viewport.{w,h}. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { spriteApi } from './sprite/spriteApi.js';
import { findTopTileAtCell, snapToGrid } from './tilemap.js';

export function Viewport({ controller, sceneDoc, paintMode, selectedTile, snapSize, activeLayerId, onLayerCreated }) {
  const hostRef = useRef(null);
  const mountedRef = useRef(false);
  const [dragHover, setDragHover] = useState(false);
  // 페인팅 중 마우스 버튼 눌림 추적 + 마지막 페인트된 격자(중복 skip 용).
  const paintingRef = useRef(false);
  const lastGridRef = useRef(null); // 'x,y' 문자열 키
  // 결함 2 수정: activeLayerId prop 을 ref 에 미러 — Preact 비동기 setState 보다
  // ref 갱신이 선행되므로 연속 드래그 시 컨테이너 중복 생성 race 를 차단한다.
  const activeLayerRef = useRef(activeLayerId);
  useEffect(() => { activeLayerRef.current = activeLayerId; }, [activeLayerId]);

  useEffect(() => {
    if (!hostRef.current || mountedRef.current) return;
    mountedRef.current = true;
    controller.mount(hostRef.current, sceneDoc, {});
  }, []);

  // 게임(월드) 크기 — 좌표 변환 스케일 분모. meta.viewport 없으면 320x240 기본.
  function gameSize() {
    const vp = sceneDoc && sceneDoc.meta && sceneDoc.meta.viewport;
    const w = (vp && Number(vp.w) > 0) ? Number(vp.w) : 320;
    const h = (vp && Number(vp.h) > 0) ? Number(vp.h) : 240;
    return { w, h };
  }

  // 드롭 위치(client 좌표) → 월드 좌표. host 안 canvas 의 rect 기준으로 스케일(CSS 확대) 흡수.
  //  canvas 없으면(아직 부트 전) null 반환 → 호출부 무시.
  function toWorld(ev) {
    const host = hostRef.current;
    if (!host) return null;
    const canvas = host.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    const { w: gameW, h: gameH } = gameSize();
    const scaleX = gameW / rect.width;
    const scaleY = gameH / rect.height;
    const worldX = (ev.clientX - rect.left) * scaleX;
    const worldY = (ev.clientY - rect.top) * scaleY;
    return { x: worldX, y: worldY };
  }

  // ── 타일 페인팅 ─────────────────────────────────────────────────────────────
  // snapToGrid 는 tilemap.js 공유 헬퍼(페인팅·우클릭 지우개가 동일 격자 규칙을 쓰도록).

  // 격자 위치에 타일이 이미 있는지 검사(같은 parentId·같은 로컬 x,y).
  function tileExistsAt(parentId, localX, localY) {
    const world = controller.getWorld ? controller.getWorld() : null;
    if (!world || !Array.isArray(world.entities)) return false;
    return world.entities.some((e) =>
      e.parentId === parentId &&
      e.transform && e.transform.x === localX && e.transform.y === localY
    );
  }

  // 컨테이너 엔티티의 월드 transform 회수(로컬좌표 계산용).
  function containerTransform(parentId) {
    const world = controller.getWorld ? controller.getWorld() : null;
    if (!world || !Array.isArray(world.entities)) return { x: 0, y: 0 };
    const c = world.entities.find((e) => e.id === parentId);
    return (c && c.transform) ? c.transform : { x: 0, y: 0 };
  }

  // 단일 격자에 타일 배치. 비동기(remote) + 동기(local) 양 경로 지원.
  async function paintAt(worldX, worldY) {
    if (!selectedTile) return;
    const snap = (snapSize && snapSize > 0) ? snapSize : 16;
    const gridX = snapToGrid(worldX, snap);
    const gridY = snapToGrid(worldY, snap);
    const gridKey = gridX + ',' + gridY;

    // 연속 드래그 중 같은 격자 재진입 skip.
    if (lastGridRef.current === gridKey) return;
    lastGridRef.current = gridKey;

    // 활성 레이어 없으면 컨테이너 생성.
    // 결함(MED, code-review): in-flight Promise 자체를 ref 에 *await 전에* 즉시 저장한다.
    //  remote(POST 왕복) addEntity 의 await 동안 다음 paintAt 이 재진입해도, ref 가 이미
    //  pending Promise 라 그것을 공유 await 하여 컨테이너를 1개만 만든다(중복생성 race 차단).
    //  TilePalette.getOrUseSheet 의 검증된 in-flight 캐시 패턴과 동일.
    let lid = activeLayerRef.current;
    if (lid && typeof lid.then === 'function') lid = await lid;   // ref 가 in-flight Promise 면 공유 대기
    if (!lid) {
      const pending = Promise.resolve(controller.addEntity({
        name: 'TilemapLayer:layer1',
        transform: { x: 0, y: 0 },
        components: []
      }));
      activeLayerRef.current = pending;          // await 전에 즉시 점유 — 재진입이 이 Promise 를 공유
      lid = await pending;
      if (lid != null) {
        activeLayerRef.current = lid;            // 확정 id 로 교체
        if (typeof onLayerCreated === 'function') onLayerCreated(lid);
      } else {
        activeLayerRef.current = null;           // 실패 시 해제(재시도 허용)
        return;
      }
    }

    // 컨테이너 월드 transform → 로컬 좌표 계산.
    const ct = containerTransform(lid);
    const localX = gridX - (ct.x || 0);
    const localY = gridY - (ct.y || 0);

    // 중복 격자 skip.
    if (tileExistsAt(lid, localX, localY)) return;

    // 타일 엔티티 생성.
    await Promise.resolve(controller.addEntity({
      name: 'tile',
      parentId: lid,
      transform: { x: localX, y: localY },
      components: [{ type: 'Sprite', sprite: selectedTile.assetId, frame: selectedTile.frame }]
    }));
  }

  function onPaintMouseDown(ev) {
    if (!paintMode || !selectedTile) return;
    if (ev.button !== 0) return; // 좌클릭만
    ev.preventDefault();
    paintingRef.current = true;
    lastGridRef.current = null;
    const world = toWorld(ev);
    if (world) paintAt(world.x, world.y);
  }

  function onPaintMouseMove(ev) {
    if (!paintMode || !paintingRef.current || !selectedTile) return;
    ev.preventDefault();
    const world = toWorld(ev);
    if (world) paintAt(world.x, world.y);
  }

  function onPaintMouseUp(ev) {
    if (!paintMode) return;
    paintingRef.current = false;
    lastGridRef.current = null;
  }

  // 우클릭 지우개 — paint 모드에서 타일 우클릭 시 그 격자 셀의 *최상단* 타일을 삭제(좌클릭=칠하기).
  //  selectedTile 불필요(빈 손으로도 지움). 컨테이너(TilemapLayer)는 자식이 아니라 매치 대상에서
  //  제외되므로 실수로 레이어가 통째 삭제되지 않는다. 코어 removeEntity(단일 undo) 단일 경로 경유.
  function onPaintContextMenu(ev) {
    if (!paintMode) return;
    ev.preventDefault();                 // 브라우저 컨텍스트 메뉴 억제
    const world = toWorld(ev);
    if (!world) return;
    const snap = (snapSize && snapSize > 0) ? snapSize : 16;
    const w = controller.getWorld ? controller.getWorld() : null;
    const tile = findTopTileAtCell(w, world.x, world.y, snap);
    if (tile && tile.id != null) controller.removeEntity(tile.id);
  }

  function onDragOver(ev) {
    if (ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('application/wgf-asset')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      if (!dragHover) setDragHover(true);
    }
  }
  function onDragLeave() { if (dragHover) setDragHover(false); }

  // 드롭: 페이로드 파싱 → (라이브러리면 use()로 assetId 회수 | 씬에셋이면 raw spriteId) →
  //  드롭 위치 월드 좌표에 새 엔티티 생성(controller.createEntityAtFromAsset). 성공 시 자동 선택.
  async function onDrop(ev) {
    setDragHover(false);
    let raw = null;
    try { raw = ev.dataTransfer.getData('application/wgf-asset'); } catch (e) {}
    if (!raw) return;
    ev.preventDefault();
    if (!controller.createEntityAtFromAsset) return;

    const world = toWorld(ev);
    if (!world) {
      if (typeof console !== 'undefined') console.warn('[Viewport] 캔버스 미준비 — 드롭 무시');
      return;
    }

    // JSON 페이로드(라이브러리/카탈로그) 시도. 파싱 실패 시 raw spriteId(씬에셋 카드) 경로.
    let payload = null;
    try { payload = JSON.parse(raw); } catch (e) { payload = null; }

    // 방어: 객체이지만 relPath 가 없으면(손상/빈 드래그) raw 폴백으로 가지 않고 중단.
    if (payload && typeof payload === 'object' && !payload.relPath) {
      if (typeof console !== 'undefined') console.warn('[Viewport] 드롭 페이로드에 relPath 없음 — 무시');
      return;
    }

    if (payload && typeof payload === 'object' && payload.relPath) {
      try {
        // frameConfig/frames 를 use 에 전달해 vendored asset 레코드에 보존한다 —
        //  AnimatedSprite 시트가 셀로 슬라이싱되고(없으면 전체 1장 렌더), 단일 Sprite 도 프레임 인덱스 표시가 정확해진다.
        const r = await spriteApi.use({
          relPath: payload.relPath,
          frame: payload.frame,
          frameConfig: payload.frameConfig,
          frames: payload.frames
        });
        if (!r || !r.ok) {
          if (r && r.status === 409 && typeof console !== 'undefined') {
            console.warn('[Viewport] 스프라이트 적용 실패 — 빈 씬(먼저 게임을 열어주세요)');
          } else if (typeof console !== 'undefined') {
            console.warn('[Viewport] 스프라이트 적용 실패:', (r && r.error) || '알 수 없음');
          }
          return;
        }
        const assetId = r.asset && r.asset.id;
        if (!assetId) { if (typeof console !== 'undefined') console.warn('[Viewport] 적용 실패 — 에셋 id 없음'); return; }
        await controller.createEntityAtFromAsset(payload, assetId, world.x, world.y);
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Viewport] 스프라이트 드롭 처리 오류:', e);
      }
      return;
    }

    // 씬에셋 카드(raw spriteId 문자열) — 이미 등록된 자산. 기본 정적 Sprite 로 새 엔티티.
    try {
      await controller.createEntityAtFromAsset({ as: 'Sprite' }, raw, world.x, world.y);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[Viewport] 씬에셋 드롭 처리 오류:', e);
    }
  }

  return (
    <div onDragOver={paintMode ? undefined : onDragOver}
         onDragLeave={paintMode ? undefined : onDragLeave}
         onDrop={paintMode ? undefined : onDrop}
         onMouseDown={paintMode ? onPaintMouseDown : undefined}
         onMouseMove={paintMode ? onPaintMouseMove : undefined}
         onMouseUp={paintMode ? onPaintMouseUp : undefined}
         onMouseLeave={paintMode ? onPaintMouseUp : undefined}
         onContextMenu={paintMode ? onPaintContextMenu : undefined}
         style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--viewport-bg, #0e1016)', overflow: 'auto', padding: '12px',
                  outline: dragHover ? '2px dashed var(--accent, #4a9eff)' : 'none',
                  outlineOffset: '-4px',
                  cursor: paintMode ? (selectedTile ? 'crosshair' : 'not-allowed') : 'default' }}>
      <div ref={hostRef} id="wgf-viewport"
           style={{ boxShadow: '0 0 0 1px #2c3346', lineHeight: 0 }} />
    </div>
  );
}
