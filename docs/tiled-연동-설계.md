# Tiled(.tmj) 맵 연동 — 설계 명세

> WebGameForge에 Tiled 맵 에디터 포맷(.tmj)을 **외부 파일 0 · 절차 생성 · CC0/IP-safe** 정체성을
> 유지한 채로 들이는 설계. 로드맵 항목 "Tiled 맵 에디터(.tmj) 연동"의 구현 명세.

## 0. 확정된 방향 (의사결정 기록)

| 항목 | 결정 | 근거 |
|------|------|------|
| **1차 동기** | **저작 업그레이드** | 자체 `LEVEL` 피처리스트를 표준 `.tmj`로 격상. Claude가 `.tmj`를 작성하고, 실제 Tiled 앱에서 라운드트립 편집 가능. 외부 에셋 인터롭은 후속 옵션. |
| **타일셋 이미지** | **절차 베이커 우선** | `PixelForge`로 타일셋 아틀라스를 코드 생성 → `addCanvas` 등록. 외부 PNG 0, CC0/IP-safe 정체성 보존. 외부 CC0 팩 로딩은 후속. |
| **데모** | **super-runner 이전 + 신규 탑다운** | 플랫포머는 플래그십 레벨을 `.tmj` 경로로 이전(라운드트립 실증). 탑다운은 기존 게임이 없어(runeburst=매치3, is-rule=규칙퍼즐) 신규 최소 데모 — 타일 레이어 충돌의 정석 케이스. |
| **super-runner 이전 방식** | **플러거블 소스** | `game.js` 하나로 유지하되 레벨 소스를 `?tiled=1` 플래그로 전환. 절차 `LEVEL` 경로와 `.tmj` 경로 양쪽을 한 코드에서 검증, 원본 절차 참조 보존. |

핵심 긴장과 해법: Phaser 타일맵은 **단일 타일셋 이미지(PNG)가 필수**다("Collection of Images" 미지원).
`addTilesetImage('name', textureKey)`가 텍스처 *키*를 받는다는 점을 이용해, `PixelForge`로 타일셋
아틀라스를 절차 베이크 → `textures.addCanvas`로 등록 → 그 키를 `.tmj`의 embedded tileset에 연결한다.
**PNG 없이 Phaser 네이티브 타일맵 파이프라인이 그대로 돈다.**

## 1. 아키텍처 분할 원칙

> **타일 레이어 = 정적 충돌 지형 / 오브젝트 레이어 = 행동하는 모든 것**

- **타일 레이어**: 바닥·흙·돌·벽 등 *정적 지형*만. 절차 베이크된 타일셋으로 렌더,
  `setCollisionByProperty({ collides: true })`로 충돌. 직교맵(orthogonal).
- **오브젝트 레이어**: 플레이어·적·코인·파워업·상호작용 블록·파이프·골 등 *행동/구조가 있는 것* 전부.
  각 오브젝트가 `type`(Tiled class) + 커스텀 프로퍼티를 갖고, 게임이 등록한 **스포너 레지스트리**
  (`spawners[type](scene, obj)`)로 기존 엔진 시스템에 스폰. 엔진은 게임 로직을 모른다(완전 위임).
- **배경 장식**(언덕·구름·덤불 패럴랙스)은 타일이 아니다(스크롤팩터·스케일 때문) — 게임 코드가 직접 그린다.

이 분할이면 `engine/tiled.js`는 게임에 독립적이다: 타일 레이어 빌드+충돌만 책임지고, 행동은 위임.

## 2. 타일셋 정의 컨벤션 (베이커 ↔ 변환기 공유 계약)

타일셋은 **순서 있는 타일 def 배열**이다. **GID = 배열 인덱스 + 1**(Tiled `firstgid=1`).
베이커(런타임 아틀라스)와 변환기(.tmj embedded tileset)가 **같은 배열을 공유**해 GID·기하가 항상 일치한다.

```js
// 타일 def: PixelForge 문자 그리드 재사용(같은 팔레트·라가드 패딩) 또는 draw 콜백
{ name: 'ground', collides: true,  frame: ["nnnn…", …16행] }   // 픽셀 그리드
{ name: 'floor',  collides: false, draw: function (ctx,x,y,w,h) { … } } // 콜백(스무스/탑다운)
```

베이커는 def들을 `columns` 그리드로 한 아틀라스 캔버스에 굽고, `imagewidth/imageheight/columns/
tilecount`와 per-tile `collides` 프로퍼티를 메타로 반환한다. 변환기는 같은 메타로 embedded tileset
블록을 emit한다.

### 플랫포머(super-runner) 표준 타일셋

| GID | name | collides | 비고 |
|----:|------|:---:|------|
| 1 | `ground` | ✓ | 잔디 윗면 (PixelForge `ground`) |
| 2 | `dirt` | ✓ | 흙 (PixelForge `dirt`) |
| 3 | `stone` | ✓ | 고정 발판 (PixelForge `qblock` frame 2 = 빈 블록 룩) |

코인·적·블록·파이프·골·시작점은 **전부 오브젝트 레이어**(아래 §3).

### 탑다운 표준 타일셋

| GID | name | collides | 비고 |
|----:|------|:---:|------|
| 1 | `floor` | ✗ | 바닥 |
| 2 | `wall` | ✓ | 벽 |

## 3. 오브젝트 type 컨벤션

오브젝트 좌표는 **타일 중심 픽셀**(`x = col*TILE + TILE/2`, `y = row*TILE + TILE/2`) — super-runner의
`cx/cy`와 일치. point 오브젝트 사용. 로더는 `obj.type || obj.class`(Tiled 버전차 흡수)로 분기.

### 플랫포머 type

| type | props | 스포너 동작(super-runner 기존 메서드 재사용) |
|------|-------|------|
| `player` | — | 히어로 배치 (`buildHero` 위치) |
| `coin` | — | `coins.create` + `coin-spin` |
| `enemy` | `kind`(기본 slime) | `spawnEnemy(x,y)` |
| `block` | `kind`: coin\|brick\|mushroom | `makeBlock(x,y,...)` |
| `pipe` | `height`(타일) | 파이프 비주얼+콜라이더 빌드 |
| `goal` | — | 깃대·깃발·골 존 빌드 |

### 탑다운 type

| type | props | 동작 |
|------|-------|------|
| `player` | — | 플레이어 배치 |
| `enemy` | `kind` | 적 스폰 |
| `pickup` | `kind` | 픽업 스폰 |

## 4. .tmj 구조 (embedded tileset)

```jsonc
{
  "type": "map", "version": "1.10", "orientation": "orthogonal", "renderorder": "right-down",
  "infinite": false, "width": 132, "height": 14, "tilewidth": 16, "tileheight": 16,
  "tilesets": [{
    "firstgid": 1, "name": "forge", "tilewidth": 16, "tileheight": 16,
    "tilecount": 3, "columns": 3, "margin": 0, "spacing": 0,
    "image": "forge-tileset.png",          // 플레이스홀더 — 로드 시 베이크 텍스처로 치환
    "imagewidth": 48, "imageheight": 16,
    "tiles": [
      { "id": 0, "properties": [{ "name": "collides", "type": "bool", "value": true }] },
      { "id": 1, "properties": [{ "name": "collides", "type": "bool", "value": true }] },
      { "id": 2, "properties": [{ "name": "collides", "type": "bool", "value": true }] }
    ]
  }],
  "layers": [
    { "id": 1, "type": "tilelayer", "name": "Ground", "x": 0, "y": 0,
      "width": 132, "height": 14, "opacity": 1, "visible": true,
      "data": [ /* width*height GID 배열, 0=빈칸 */ ] },
    { "id": 2, "type": "objectgroup", "name": "Objects", "opacity": 1, "visible": true,
      "objects": [
        { "id": 1, "type": "player", "x": 40,  "y": 184, "point": true, "properties": [] },
        { "id": 2, "type": "enemy",  "x": 344, "y": 184, "point": true,
          "properties": [{ "name": "kind", "type": "string", "value": "slime" }] },
        { "id": 3, "type": "pipe",   "x": 376, "y": 168, "point": true,
          "properties": [{ "name": "height", "type": "int", "value": 2 }] }
      ] }
  ]
}
```

- **타일 데이터**: `data`는 `width*height` 길이 1D 배열, row-major(right-down), `0`=빈칸, 그 외=GID.
- **로드 시 텍스처 치환**: `.tmj`의 `image`는 플레이스홀더. 로더가 `add.tilemap` 후
  `map.addTilesetImage(tilesetName, bakedTextureKey)`로 베이크 아틀라스를 연결 → Phaser가 parsed
  Tileset 객체를 텍스처로 갱신(이미지 로딩 불필요).
- **프로퍼티 파싱**: Phaser가 `properties` 배열을 `{ key: value }` 객체로 변환. 로더는 배열/객체 양형 흡수.

## 5. 엔진 API (`engine/tiled.js`)

```js
// 1) 타일셋 아틀라스 절차 베이크 → 텍스처 등록 + embedded tileset 메타
var meta = TiledForge.bakeTileset(scene, tileDefs, {
  key: 'forge-tiles',        // 등록 텍스처 키
  tileSize: 16, columns: 8,  // 아틀라스 그리드
  palette: PixelForge.PALETTE
});
// meta = { key, name, tilewidth, tileheight, columns, tilecount, imagewidth, imageheight, collides:[...] }

// 2) .tmj 로드 → 레이어 빌드 + 충돌 + 오브젝트 위임
var result = TiledForge.loadTiledMap(scene, 'map', {
  tilesetKey: 'forge-tiles',          // bakeTileset이 등록한 키
  tilesetName: 'forge',               // .tmj 안 tileset name
  spawners: {
    player: function (s, o) { … },
    enemy:  function (s, o) { … }
  },
  gpu: false
});
// result = { map, layers:{Ground}, objects:[…], solidLayer }
```

`.tmj` 로드 경로 2가지:
- **권장(http):** `preload`에서 `this.load.tilemapTiledJSON(key, url)`. 두 데모 모두 이 방식
  (super-runner·tiled-topdown). 로더가 첫 프레임 전 완료를 보장하고 정적 페이지를 경량으로 유지한다.
  단 `file://`에선 fetch가 막히므로 **http 서빙 필요**(README의 `python -m http.server`).
- **폴백(file://):** 인라인 JSON을 전역으로 노출(`level.tmj.js` 래퍼 `window.X = {...}`) 후
  `TiledForge.injectMap(scene, key, json)`로 캐시에 주입. `level-to-tmj.mjs`에 globalVar 인자를 주면
  래퍼를 함께 emit한다. super-runner의 `buildLevelTiled`는 캐시 미스 시 전역에서 자동 폴백한다.

## 6. 산출물 / 시퀀싱

1. **설계 문서**(이 파일).
2. **`engine/tiled.js`** — `bakeTileset` + `buildTilesetBlock` + `injectMap` + `loadTiledMap`.
3. **저작 도구**(무의존성 Node, `skills/level-designer/tools/`):
   - `level-to-tmj.mjs` — `LEVEL` 피처리스트 → `.tmj`(super-runner 이전·라운드트립).
   - `ascii-to-tmj.mjs` — ASCII 격자 → `.tmj`(LLM 친화 저작; 탑다운 맵에 사용).
4. **super-runner 플러거블 이전** — `?tiled=1`에서 베이크+로드, 스포너가 기존 메서드 재사용.
   레벨 데이터는 `games/super-runner/level.js`로 분리해 게임·변환기가 단일 소스 공유.
5. **신규 탑다운 데모** — `games/tiled-topdown/`(GEM DUNGEON). `map.mjs`(ASCII) → `level.tmj`.
6. **`level-designer` 스킬 확장** + `reference/tiled/` 저작 가이드.
7. **검증** — 양 데모 렌더·충돌·스폰·콘솔 에러 0, 절차↔Tiled 경로 동치(아래 §7).

## 7. 검증 결과 (2026-06-08)

chrome-devtools/preview MCP 실측:
- **super-runner**: `?tiled=1` 경로가 절차 경로와 **픽셀 단위 동치**(동일 입력 → 최종X 400/399,
  코인 5/5, 점수 600/600, 무사망). 충돌 타일 277(=ground 121 + dirt 121 + stone 35), 오브젝트
  스폰 52(코인 23·블록 17·적 8·파이프 2·골 1·플레이어 1), 콘솔 에러 0.
- **tiled-topdown**: 스폰(플레이어·적 5·보석 8·골·벽 타일 158), 4방향 이동, 타일레이어 벽 충돌
  (`blocked.up/left` 확인), 보석 수집(+100), 콘솔 에러 0.
- **베이커 IP-safe**: 타일셋 아틀라스 100% 절차 베이크(`PixelForge`), 외부 파일 0 — 정체성 유지.

### ⚠ 알려진 사항 — `?autostart=1` 첫-프레임 레이스(기존 현상)
실시간 rAF + `?autostart=1`(타이틀 60ms 후 시작)이 페이지 로드와 경쟁할 때, 시스템 부하에 따라
첫 라이프에서 히어로/적이 큰 첫-프레임 dt로 바닥을 터널링해 추락 후 자동 리스폰하는 일이 있다.
**이는 원본 super-runner에도 동일하게 존재하는 합성 아티팩트**(원본을 같은 조건으로 실측 확인)로,
본 Tiled 이전이 유발한 회귀가 아니다. **실제 탭-시작 플레이는 무관**(안정 후 시작은 항상 정상).
결정적 검증은 안정-후-시작(settle-start) 또는 manual-step 하니스로 수행하며, 게임 물리에 손대는
워밍업/델타클램프/물리정지 류의 우회는 resume-dump 등으로 역효과라 도입하지 않는다.

## 8. IP / 라이선스

- 타일셋은 100% 절차 베이크(`PixelForge`/`VectorForge`) → 외부 파일 0, CC0/IP-safe 정체성 유지.
- 후속 옵션(범위 밖): 외부 CC0 Tiled 팩을 `assets.json` 게이트로 로딩하는 인터롭 경로.

## 9. 범위 밖 (후속 과제)

- 외부 CC0 타일셋 팩 임포트(`assets.json` 게이트).
- 등각/육각/스태거드 맵, 애니메이션 타일, `TilemapGPULayer` 최적화.
- 실제 Tiled 앱 왕복 편집 UX 다듬기(현재는 포맷 호환까지).
