# Tiled(.tmj) 맵 저작 가이드

> WebGameForge에서 Tiled 맵 포맷(.tmj)으로 레벨을 빌드하는 실전 레퍼런스. **외부 파일 0 ·
> 절차 생성 · CC0/IP-safe** 정체성을 유지한다. 엔진: [`engine/tiled.js`](../../../../engine/tiled.js)(`TiledForge`).
> 전체 설계: [`docs/tiled-연동-설계.md`](../../../../docs/tiled-연동-설계.md).

## 언제 Tiled를 쓰나

- **대형·복잡 맵**: 자체 `LEVEL` 피처리스트가 버거울 때(수백 타일·여러 레이어·패럴랙스).
- **라운드트립 편집**: 사용자가 실제 Tiled 데스크톱 앱에서 맵을 열어 손보게 하고 싶을 때.
- **그리드 장르**: 탑다운·던전·퍼즐처럼 셀 기반 지형이 자연스러운 장르.
- 작은 선형 레벨이면 기존 `LEVEL` 피처리스트([level-designer SKILL](../../SKILL.md))가 더 가볍다. 택1.

## 핵심 분할 원칙

> **타일 레이어 = 정적 충돌 지형 / 오브젝트 레이어 = 행동하는 모든 것**

- **타일 레이어**: 바닥·흙·돌·벽 등 *정적 지형*만. 절차 베이크 타일셋으로 렌더, 충돌은 타일
  프로퍼티 `collides:true` + `setCollisionByProperty`.
- **오브젝트 레이어**: 플레이어·적·코인·파워업·상호작용 블록·파이프·골 등 *행동/구조가 있는 것* 전부.
  각 오브젝트가 `type` + 커스텀 프로퍼티를 갖고, 게임이 등록한 **스포너**(`type → factory`)로 위임.
- **배경 장식**(패럴랙스 언덕·구름)은 타일이 아니다 — 게임 코드가 직접 그린다.

## 1. 절차 타일셋 (외부 PNG 없이)

Phaser 타일맵은 단일 타일셋 이미지가 필수다("Collection of Images" 미지원). `PixelForge` 문자
그리드(또는 `draw` 콜백)로 아틀라스를 코드 베이크해 텍스처로 등록하고, 그 키를 `.tmj`의 embedded
tileset에 연결한다 → PNG 0으로 네이티브 타일맵이 돈다.

```js
// 순서 배열 = GID. index 0 → GID 1. 베이커와 저작 도구가 같은 순서를 공유해야 한다(계약).
var tileDefs = [
  { name: 'ground', collides: true,  frame: PixelForge.LIB.ground.frames[0] }, // GID 1
  { name: 'dirt',   collides: true,  frame: PixelForge.LIB.dirt.frames[0] },   // GID 2
  { name: 'stone',  collides: true,  frame: PixelForge.LIB.qblock.frames[2] }  // GID 3
];
TiledForge.bakeTileset(scene, tileDefs, {
  key: 'forge-tiles', name: 'forge', tileSize: 16, columns: 3, palette: PixelForge.PALETTE
});
```

- `frame`: PixelForge 문자 그리드(같은 팔레트·투명 `.`/` `). **지형 타일은 16칸 꽉 채워** 구멍이 없게.
- `draw`: 스무스/벡터 타일은 `draw(ctx, x, y, w, h, VectorForge)` 콜백도 지원(셀 원점 기준).
- `columns` 미지정 시 단일 행. embedded tileset 블록은 저작 도구가 동일 기하로 emit한다.

## 2. 오브젝트 type 컨벤션

오브젝트 좌표는 **타일 중심 픽셀**(`x = col*TILE + TILE/2`). 로더는 `obj.type || obj.class`(Tiled
버전차 흡수)로 분기한다. 게임이 스포너를 등록하면 엔진이 위임한다:

```js
var res = TiledForge.loadTiledMap(scene, 'map', {
  tilesetKey: 'forge-tiles', tilesetName: 'forge',
  spawners: {
    player: function (s, o) { s.placeHero(o.x, o.y); },
    enemy:  function (s, o) { s.spawnEnemy(o.x, o.y, o.props.kind); },
    coin:   function (s, o) { s.makeCoin(o.x, o.y); },
    pickup: function (s, o) { s.makeGem(o.x, o.y); },
    goal:   function (s, o) { s.makeGoal(o.x, o.y); }
  }
  // solidLayers: ['Ground']  // 생략 시 모든 타일 레이어에 충돌 설정
});
// res.solids[0] = 충돌 설정된 타일 레이어 → physics.add.collider(player, res.solids[0])
```

`o = { x, y, type, name, width, height, props, raw, layer }`. 미등록 type은 콘솔 경고 후 무시.
**엔진은 게임 로직을 모른다** — 스포너가 기존 게임 시스템을 재사용한다(행동 로직 무변경).

## 3. .tmj 작성 — 두 경로

손으로 GID 배열을 쓰지 말고 도구로 생성한다(둘 다 무의존성 Node, `tools/`).

### (a) LEVEL 피처리스트 → .tmj — `level-to-tmj.mjs`
기존 `LEVEL`(super-runner 포맷: `groundTop`/`pits`/`features`/`pipes`/`goal`/`start`)을 변환.
```
node skills/wgf-level-designer/tools/level-to-tmj.mjs <level.js> <out.tmj> [globalVarName]
```
`'S'`→stone 타일, 나머지 피처→오브젝트. globalVar를 주면 `out.tmj.js` 래퍼도 emit(file:// 폴백).
실증: super-runner는 `level.js` 단일 소스 → `level.tmj`로 변환, `?tiled=1`에서 로드.

### (b) ASCII 격자 → .tmj — `ascii-to-tmj.mjs` (LLM 친화)
탑다운·던전·퍼즐에 적합. 격자를 "그리듯" 작성한다.
```
node skills/wgf-level-designer/tools/ascii-to-tmj.mjs <map.mjs> <out.tmj>
```
`map.mjs`는 `export default { TILE, TILES, FLOOR, LEGEND, GRID }`. LEGEND 규약:
```js
LEGEND = {
  '#': { tile: 'wall' },                                  // 타일 레이어(충돌)
  '.': { tile: 'floor' },                                 // 타일 레이어
  '@': { object: 'player' },                              // 오브젝트(+아래 FLOOR 자동)
  'e': { object: 'enemy',  props: { kind: 'walker' } },
  '*': { object: 'pickup', props: { kind: 'gem' } },
  'X': { object: 'goal' }
}
```
`FLOOR`로 지정한 타일이 오브젝트/일반 셀 아래 자동으로 깔린다. 빈칸(` `)은 void(바닥 없음).
손으로 격자를 그리면 행 길이 실수가 잦으니 2D 배열로 프로그램적으로 구성하길 권장(예:
[`games/tiled-topdown/map.mjs`](../../../../games/tiled-topdown/map.mjs)).

## 4. 로딩 — preload + 빌드

```js
// GameScene/BootScene.preload
preload: function () { this.load.tilemapTiledJSON('map', 'level.tmj'); }
// create
buildMap: function () {
  TiledForge.bakeTileset(this, tileDefs(), { key:'forge-tiles', name:'forge', tileSize:16, columns:3 });
  var res = TiledForge.loadTiledMap(this, 'map', { tilesetKey:'forge-tiles', tilesetName:'forge', spawners:{...} });
  this.terrain = res.solids[0];
}
```

- **http 서빙 필요**: Phaser 로더는 fetch라 `file://`에서 막힌다. `python -m http.server`로 띄운다.
- **file:// 폴백**: `level.tmj.js`(전역 래퍼)를 `<script>`로 함께 로드하고, 캐시 미스 시
  `TiledForge.injectMap(scene, key, window.X)`로 주입(super-runner `buildLevelTiled` 참고).

## 5. 게처(gotchas)

1. **tileset name 일치**: `addTilesetImage`/`loadTiledMap`의 `tilesetName`은 `.tmj` 안 tileset
   `name`과 정확히 일치해야 한다(불일치 시 `null`).
2. **layer name 일치**: `solidLayers`를 줄 땐 `.tmj` 타일 레이어명과 정확히 일치.
3. **GID 순서 = 타일 def 순서**: 베이커 `tileDefs`와 저작 도구의 `TILES` 순서가 어긋나면 타일이
   뒤섞인다. §1 계약을 단일 소스로 유지.
4. **지형 타일은 꽉 채우기**: 짧은 행은 투명 패딩되어 바닥에 구멍이 생긴다.
5. **충돌 먼저**: `setCollisionByProperty`(loadTiledMap이 자동 호출) 없이는 collider가 통과한다.
6. **첫-프레임 레이스**: `?autostart=1` 실시간 검증은 로드 경쟁으로 첫 라이프가 불안정할 수 있다
   (기존 현상, 실제 플레이 무관). 결정적 검증은 settle-start/manual-step으로([설계 §7](../../../../docs/tiled-연동-설계.md)).

## 6. 실증 레퍼런스

- **플랫포머**: [`games/super-runner/`](../../../../games/super-runner/) — `?tiled=1`이면 `level.tmj`
  경로(절차 경로와 동치). 변환기 `level-to-tmj.mjs`.
- **탑다운**: [`games/tiled-topdown/`](../../../../games/tiled-topdown/) — GEM DUNGEON. `map.mjs`(ASCII)
  → `level.tmj`, 벽 타일 충돌 + 4방향 이동 + 보석/적/포털. 저작 도구 `ascii-to-tmj.mjs`.
- **등각/육각**: [`games/tiled-iso/`](../../../../games/tiled-iso/) — FORGE ISO. `?orient=hex`로 전환.
- **GPU 레이어 + 외부 팩**: [`games/tiled-pack/`](../../../../games/tiled-pack/) — FORGE PACK.

---

## 7. 애니메이션 타일

타일 def에 다중 프레임을 주면 베이커가 **프레임마다 연속 칸**으로 굽고, embedded tileset의 `tiles[]`에
`animation:[{tileid,duration}]`을 자동으로 단다. Phaser 파서가 CPU·GPU 레이어 양쪽에서 자동 재생한다.
GID는 **첫 프레임 칸**이 되며, 맵 `data`는 그 GID만 참조한다.

```js
// 런타임 베이커(아트 포함): animFrames = [grid|{frame}|{draw}, ...]
{ name:'water', collides:false, animDuration:240, animFrames:[
  { draw: waterFrame(0) }, { draw: waterFrame(1) }, { draw: waterFrame(2) }
] }

// 저작 도구(ascii-to-tmj, 아트 없이 개수만): anim:{frames, duration|durations}
TILES: [
  { name:'floor', collides:false },                                 // GID 1
  { name:'water', collides:false, anim:{ frames:3, duration:240 } }, // GID 2 (칸 2,3,4)
  { name:'wall',  collides:true }                                   // GID 5  ← 애니로 GID 밀림 주의!
]
```

> ⚠ 애니 타일은 N칸을 차지하므로 **뒤 타일 GID가 밀린다**(위 예: wall=GID 5). `expandTileDefs`(엔진)
> 계약을 단일 소스로 쓰면(베이커·`buildTilesetBlock`·`ascii-to-tmj`가 `createRequire`로 공유) 자동 정합.

## 8. 등각/육각 맵 (isometric / hexagonal / staggered)

`ascii-to-tmj`의 맵 모듈에 `ORIENTATION` + 비정방형 타일 크기를 준다. Phaser `createLayer`가
`orientation`으로 좌표 투영을 자동 선택한다.

```js
// 등각(다이아몬드 32x16)
export default { ORIENTATION:'isometric', TILE_WIDTH:32, TILE_HEIGHT:16, TILES, LEGEND, GRID, FLOOR:'floor' }
// 육각(32x32, 행 스태거)
export default { ORIENTATION:'hexagonal', TILE_WIDTH:32, TILE_HEIGHT:32,
  HEX:{ sideLength:16, staggerAxis:'y', staggerIndex:'odd' }, TILES, LEGEND, GRID, FLOOR:'floor' }
```

- **타일 아트**: iso는 다이아몬드, hex는 육각형을 `bakeTileset`의 `draw` 콜백으로 그린다
  (`tileWidth`/`tileHeight`를 베이커에도 동일하게 전달).
- **이동/충돌**: arcade 물리는 AABB라 iso/hex 타일 모양과 맞지 않는다. **타일 좌표 논리 이동**을 쓴다 —
  `layer.tileToWorldXY(col,row)`로 칸 중심을 구하고, `layer.getTileAt(col,row).index`로 통행 가능 판정.
  ([`games/tiled-iso/game.js`](../../../../games/tiled-iso/game.js)의 `walkable`/`tryMove` 참고.)
- iso/hex는 **GPU 레이어 미지원** → CPU 레이어(엔진이 자동 가드).

## 9. TilemapGPULayer (대형 직교 맵 최적화)

`loadTiledMap(scene, key, { gpu:true })` 면 타일 레이어를 `TilemapGPULayer`(WebGL 단일 quad 셰이더)로
렌더한다. 대형 맵에서 거의 GPU 바운드.

```js
var res = TiledForge.loadTiledMap(this, 'map', { tilesetKey:'forge', tilesetName:'forge', gpu:true });
// res.gpu === true 면 GPU 레이어. 타일을 런타임에 바꿨다면:
res.layers['Ground'].putTileAt(5, 10, 10);
res.regenerate(); // GPU 데이터 텍스처 재생성(필수)
```

- **제약**: WebGL 전용 · **직교 전용**(iso/hex 불가) · 단일 타일셋 · 최대 4096×4096. 위반 시 엔진이
  **CPU 레이어로 자동 폴백 + 경고**(`res.gpu===false`로 확인).
- **애니 타일·arcade 충돌**은 GPU 레이어에서도 동작(`setCollisionByProperty` + `physics.add.collider`).
- 편집 후 `res.regenerate()`를 부르지 않으면 변경이 화면에 반영되지 않는다.

## 10. 외부 CC0 Tiled 팩 임포트 (`assets.json` 게이트)

절차 베이크 대신 **외부 타일셋 이미지(PNG) + .tmj + `pack.json`(라이선스 매니페스트)** 를 임포트하는
경로. 라이선스는 루트 [`assets.json`](../../../../assets.json)의 `policy`로 게이트한다(CC0/MIT/… 허용,
ARR/unknown 거부, CC-BY는 attribution 필수).

```js
// 런타임 게이트: 거부 라이선스면 loadTiledMap 이 throw 로 로드를 막는다.
var policy = this.cache.json.get('assets-policy').policy;     // ../../assets.json 로드
var manifest = this.cache.json.get('pack-manifest');          // pack/pack.json
var res = TiledForge.loadTiledMap(this, 'pack-map', {
  tilesetKey:'forge-pack', tilesetName: manifest.tilesetName, // this.load.image 로 임포트한 PNG 키
  gpu:true, licenseGate:{ policy:policy, manifest:manifest }
});
```

**도구**(둘 다 무의존성 Node):
- `bake-tiled-pack.mjs <outDir>` — 문자 그리드 타일을 **PNG로 직접 인코딩**(내장 `zlib`) + `.tmj` +
  `pack.json`(CC0) 생성. 우리 절차 저작 → 제3자 다운로드 0, 100% CC0.
- `verify-tiled-pack.mjs <pack.json> [--register]` — `assets.json` 정책으로 게이트(위반 시 exit 1),
  `--register`면 통과 시 `assets.json.entries`에 자동 등록.

> ⚠ 실제 제3자 CC0 팩(Kenney 등)을 들일 때도 **반드시 `verify-tiled-pack`을 먼저** 통과시키고
> `CREDITS.txt`/attribution을 기록한다. 닌텐도 등 상용 IP는 `denyAlways`로 영구 차단.
