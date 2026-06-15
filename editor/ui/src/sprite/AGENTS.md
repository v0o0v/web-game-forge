<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/ui/src/sprite/

## Purpose
에디터에 **네이티브 통합된 유니티식 스프라이트 브라우저**. 외부 `serve.mjs`/외부 브라우저/Claude 디스패치 경유 없이, 브리지 `/api/sprite/*` 백엔드 + Preact 패널로 "팩 → 시트 → 스프라이트" 탐색·라이브 애니 미리보기·시트 슬라이싱/이름 편집·엔티티 원클릭/드래그 적용을 제공한다. `AssetBrowser.jsx` 의 "에셋" 패널 본문이 여기 `SpriteBrowser` 를 렌더한다(과거 "CC0 고르기"가 채팅만 던져 실제로 안 뜨던 문제의 근본 해결).

## Key Files
| File | Description |
|------|-------------|
| `SpriteBrowser.jsx` | 패널 본문. 탭 3개 — **라이브러리**(로컬 sheet/collection → 프레임 그리드 canvas 슬라이스 + 라이브 애니 미리보기[rAF, 동시 제한] + 적용/편집/드래그), **카탈로그**(packs.json 78팩 카드 + 썸네일 lazy[IntersectionObserver] + safetyTier 배지 + 검색/필터 + CC0 다운로드), **씬에셋**(world.assets.sprites + 절차/CC0-URL/Unity 임포트 어더 보존) |
| `SheetSlicer.jsx` | 유니티식 시트 슬라이서 모달 — 그리드 모드(frameWidth/height/margin/spacing 즉시 오버레이) + 자유영역 모드(드래그 생성·이동·리사이즈), 프레임 제외/이름, 애니 정의 + 라이브 미리보기 → `spriteApi.slice` 저장 |
| `spriteApi.js` | `/api/sprite/*` 클라이언트 래퍼(`getBridgeConfig` 토큰·base 직접 fetch). `catalog()`·`library()`·`slice(relPath,patch)`·`use(body)`·`download(packId)` + `assetUrl(p)`·`loadImage(src)`(동시성 6 세마포어). 브리지 미연결 시 `{ok:false}` 안전 반환 |

## For AI Agents

### Working In This Directory
- **두 항목 종류를 구분**: `kind:'sheet'`(단일 이미지 — `relPath`+`frameConfig`/`frames`, 프레임 index 로 셀 선택) vs `kind:'collection'`(개별 타일 묶음 — `files[]`(웹 URL)·**`filesRel[]`(repo 상대경로)**, 각 파일이 1프레임). 적용·드래그 시 collection 은 `filesRel[frame]` 을 relPath 로 쓰고 frameConfig/frame 미전송(코드리뷰 HIGH 교훈 — relPath 누락 시 use 400·드래그 오염).
- **적용은 spriteApi.use 후 controller**: `use({relPath,frameConfig?,frame?,frames?})` → 반환 `asset.id` → `controller.assignAssetToEntity(entityId, asset.id, {frame, as, anims?, play?})`. UI 는 controller 만 받아도 동작(spriteApi 가 토큰 자체 보유).
- **드래그 페이로드**: `dataTransfer` 타입 `application/wgf-asset` 에 JSON `{relPath,frame,as}`(라이브러리) 또는 raw spriteId 문자열(씬에셋). 빈 relPath 를 절대 싣지 말 것(Hierarchy onDrop 이 빈 relPath 면 무시).
- **성능**: 썸네일 lazy(IntersectionObserver)+동시요청 제한, 시트 펼칠 때만 로드, 슬라이스 canvas 캐시, 검색 debounce, 애니 미리보기 동시 개수 제한, rAF/IO effect cleanup 필수.
- **백엔드 계약은 `editor/server/sprite-library.mjs`** — shape 변경 시 양쪽 동기. standalone `skills/wgf-sprite-picker/picker/` 와는 슬라이싱 *로직만* 공유(코드 공유 아님).

### Testing Requirements
- 백엔드: `node editor/server/test-sprite-library.mjs`(46 — catalog/library/slice/use·collection filesRel·frames[]·경로 가드).
- UI: `node editor/ui/build.mjs` 빌드 성공 + 브라우저 e2e(탭 렌더·collection 타일 적용·드래그·슬라이서 저장·라이브 애니). DOM 전용이라 헤드리스 불가.

### Common Patterns
- 프레임 사각형 계산은 SheetSlicer/SpriteBrowser/엔진(`bakeSheetTexture`)이 동일 공식(`cols=(W-margin+spacing)/(fw+spacing)`) — off-by-one 금지.
- 자유영역 `frames:[{x,y,w,h}]` 는 엔진 `bakeSheetTexture` 가 `tex.add(i,0,x,y,w,h)` 로 베이크(에셋 def.frames 영역배열 ≠ AnimatedSprite comp.anims[].frames 셀인덱스).

## Dependencies

### Internal
- `editor/server/sprite-library.mjs`(`/api/sprite/*` 백엔드)·`editorController.js`(assignAssetToEntity)·`Hierarchy.jsx`(드롭).
- 이미지/카탈로그: 브리지 정적 서빙 `/assets-library/*`·`/skills/wgf-sprite-picker/catalog/thumbnails/*`.

### External
- **preact/hooks** + 브라우저 Canvas·IntersectionObserver·requestAnimationFrame.

<!-- MANUAL: -->
