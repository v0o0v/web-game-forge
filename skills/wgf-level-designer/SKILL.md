---
name: wgf-level-designer
description: "게임 레벨/스테이지의 내부 지형을 빌드합니다 — 그리드 기반 레벨 데이터, 타일맵(staticGroup·타일 배치), 난이도 곡선, Tiled(.tmj) 연동 옵션. 레벨 내부 지형·타일맵 빌드 요청 시 사용. 스테이지를 잇는 월드맵/진행 구조는 world-map-architect, 개별 레벨 설계 의도는 level-architect 소관. level, stage, tilemap, level data."
allowed-tools: Read, Write, Edit
---

# level-designer — 그리드 기반 레벨·스테이지 설계

피처 리스트 방식으로 레벨 데이터를 정의하고 Phaser staticGroup으로 빌드한다. web-game-builder의 전문 스킬. `engine/`를 사용한다.

> **이 스킬은 *어떻게 빌드*하는가(구현 패턴)를 담당한다.** *무엇을·왜* 설계하는가(게임 분석·의도 인터뷰·난이도 곡선·재미 극대화)는 상위 스킬 [`level-architect`](../wgf-level-architect/SKILL.md)가 담당하고, 거기서 확정된 설계안을 받아 이 스킬이 빌드한다. 곡선·페이싱·공정성 원칙은 [level-architect의 LD-* 사전](../wgf-level-architect/reference/level-design/INDEX.md) 참고.

## 언제 사용
- 새 레벨·스테이지를 추가하거나 기존 레벨 구조를 수정·확장할 때
- 난이도 곡선(도입부→중반→후반)을 설계할 때
- 구덩이·블록·파이프·체크포인트 배치를 조정할 때

## 핵심 레시피

### 1) LEVEL 데이터 구조 (super-runner 모델 기준)
```js
var LEVEL = {
  width: 100,        // 전체 가로 타일 수
  rows: 14,          // 세로 타일 수
  groundTop: 12,     // 바닥 상단 행 번호 (row 12=잔디, 13=흙 자동 생성)
  pits: [[20,22], [45,47]],  // 구덩이: [시작열, 끝열] (바닥 타일 없음)
  features: [
    // t: 피처 타입, c: 열(column), r: 행(row)
    { t: 'o', c: 8,  r: 9  },   // 코인
    { t: '?', c: 10, r: 9  },   // 물음표 블록 (코인 나옴)
    { t: 'M', c: 12, r: 9  },   // 버섯 블록
    { t: 'B', c: 14, r: 9  },   // 벽돌
    { t: 'S', c: 16, r: 11 },   // 돌 블록 (고정 발판)
    { t: 'e', c: 20, r: 11 },   // 적
  ],
  pipes: [
    { c: 25, top: 10, h: 2 },   // 파이프: 열, 상단 행, 높이(타일)
  ],
  goal: { c: 90 },              // 깃발 열
  start: { c: 2, r: 11 }        // 플레이어 시작 위치
};
```

### 2) buildLevel — solid staticGroup 생성 패턴
```js
buildLevel: function () {
  this.solids = this.physics.add.staticGroup();
  var self = this;

  // 바닥 자동 생성 (구덩이 제외)
  var isPit = function (col) {
    return LEVEL.pits.some(function (p) { return col >= p[0] && col <= p[1]; });
  };
  for (var col = 0; col < LEVEL.width; col++) {
    if (isPit(col)) continue;
    self.solids.create(cx(col), cy(LEVEL.groundTop), 'ground').refreshBody();
    self.solids.create(cx(col), cy(LEVEL.groundTop + 1), 'dirt').refreshBody();
  }

  // 피처 배치
  LEVEL.features.forEach(function (f) {
    if (f.t === 'S') {
      self.solids.create(cx(f.c), cy(f.r), 'qblock', 2).refreshBody();
    }
    // ... 'o'(코인), 'e'(적), '?'/'B'/'M'(블록) 처리
  });
}
```

### 3) 돌계단(피라미드) 헬퍼
```js
// height 단계짜리 계단을 startCol부터 오른쪽으로 배치
function makeStairs(features, startCol, groundRow, height) {
  for (var step = 0; step < height; step++) {
    for (var rr = 0; rr <= step; rr++) {
      features.push({ t: 'S', c: startCol + step, r: groundRow - rr });
    }
  }
}
makeStairs(LEVEL.features, 40, 11, 4);
```

### 4) 난이도 곡선 원칙
| 구간 | 내용 |
|------|------|
| 도입부 (0~20%) | 넓은 발판, 코인 유도, 적 없음·느림 |
| 중반 (20~65%) | 구덩이 추가, 공중 블록 플랫폼, 적 2~3마리 무리 |
| 후반 (65~90%) | 짧은 발판, 구덩이 연속, 적 밀도 상승, 숨은 버섯 |
| 골 직전 (90~100%) | 돌계단, 깃발 연출, 스트레스 해소 보상 코인 |

### 5) 체크포인트 패턴
```js
// 체크포인트 존(비가시 physics zone) — 닿으면 리스폰 지점 갱신
this.checkpoint = this.add.zone(cx(50), cy(10), 16, LEVEL.rows * TILE);
this.physics.add.existing(this.checkpoint, true);
this.physics.add.overlap(this.hero, this.checkpoint, function () {
  if (!this._checkpointHit) {
    this._checkpointHit = true;
    this.run.spawnCol = 50;  // 죽으면 여기서 부활
  }
}, null, this);
```

## 짧은 스니펫 — 2스테이지 레벨 전환

```js
// LEVEL 배열로 다중 스테이지 관리
var LEVELS = [
  { width: 100, groundTop: 12, pits: [[25,27]], features: [...], goal: { c: 90 } },
  { width: 120, groundTop: 12, pits: [[30,32],[60,63]], features: [...], goal: { c: 110 } }
];
var currentLevel = 0;

// clearStage 내부
clearStage: function () {
  currentLevel = (currentLevel + 1) % LEVELS.length;
  LEVEL = LEVELS[currentLevel];  // 전역 교체
  this.scene.restart();
}
```

## Tiled(.tmj) 연동 — 절차 베이커 + 오브젝트 스포너

대형·복잡 맵, 라운드트립 편집(실제 Tiled 앱), 탑다운·던전 같은 그리드 장르엔 **`.tmj` 포맷**을
쓴다. **외부 PNG 없이** `engine/tiled.js`(`TiledForge`)가 타일셋 아틀라스를 절차 베이크(`PixelForge`)해
연결하므로 IP-safe 정체성을 유지한다. 분할 원칙: **타일 레이어 = 정적 지형 / 오브젝트 레이어 = 행동**.

```js
// preload: .tmj는 Phaser 로더로(http 서빙 필요). 타일셋 PNG 로드 안 함 — 절차 베이크.
preload: function () { this.load.tilemapTiledJSON('map', 'level.tmj'); }

// create: 절차 타일셋 베이크 → 로드(타일 레이어 충돌 + 오브젝트 스포너 위임)
var tileDefs = [
  { name: 'ground', collides: true, frame: PixelForge.LIB.ground.frames[0] }, // GID 1
  { name: 'dirt',   collides: true, frame: PixelForge.LIB.dirt.frames[0] },   // GID 2
  { name: 'stone',  collides: true, frame: PixelForge.LIB.qblock.frames[2] }  // GID 3
];
TiledForge.bakeTileset(this, tileDefs, { key:'forge-tiles', name:'forge', tileSize:16, columns:3 });
var res = TiledForge.loadTiledMap(this, 'map', {
  tilesetKey:'forge-tiles', tilesetName:'forge',
  spawners: {                              // type → 기존 게임 시스템 재사용(행동 로직 무변경)
    player: function (s, o) { s.placeHero(o.x, o.y); },
    enemy:  function (s, o) { s.spawnEnemy(o.x, o.y); },
    coin:   function (s, o) { s.makeCoin(o.x, o.y); }
  }
});
this.physics.add.collider(this.hero, res.solids[0]); // 충돌 설정된 타일 레이어
```

**.tmj 작성은 도구로**(손으로 GID 배열 쓰지 말 것, 무의존성 Node):
- `tools/level-to-tmj.mjs` — 자체 `LEVEL` 피처리스트 → `.tmj`(super-runner 이전·라운드트립).
- `tools/ascii-to-tmj.mjs` — ASCII 격자 → `.tmj`(LLM 친화, 탑다운·던전·퍼즐). `ORIENTATION`으로
  **등각/육각/스태거드** + `anim:{frames,duration}`으로 **애니메이션 타일** 지원.
- `tools/bake-tiled-pack.mjs` — 절차 CC0 팩(PNG+`.tmj`+`pack.json`) 생성(외부 팩 임포트 실증).
- `tools/verify-tiled-pack.mjs` — 외부 팩을 루트 `assets.json` 정책으로 라이선스 게이트(`--register`).

**고급 기능**: 애니메이션 타일 · 등각/육각 맵 · `TilemapGPULayer`(`loadTiledMap({gpu:true})`) ·
외부 CC0 팩 임포트(`licenseGate`). 자세한 건 아래 authoring 가이드 §7~§10.

> 전체 저작 가이드(타일셋 계약·오브젝트 type·로딩·애니·iso/hex·GPU·팩 게이트·게처·실증):
> [`reference/tiled/authoring.md`](reference/tiled/authoring.md).
> 실증: [`games/super-runner`](../../games/super-runner/)(`?tiled=1`, 절차 경로와 동치) ·
> [`games/tiled-topdown`](../../games/tiled-topdown/)(GEM DUNGEON) ·
> [`games/tiled-iso`](../../games/tiled-iso/)(등각/육각) · [`games/tiled-pack`](../../games/tiled-pack/)(GPU+팩 임포트).

## 절차적 생성(PCG) 알고리즘 메뉴

레벨 지형·오브젝트 배치·이름 생성을 자동화할 때 아래 4개 알고리즘을 참고한다.
모든 예제는 **RngForge 시드 고정 결정론**을 사용하며 `node` 헤드리스 실행 가능하다.

| 알고리즘 | 주 용도 |
|----------|---------|
| Cellular Automata | 동굴·유기적 지형 자동 생성 |
| Wave Function Collapse (WFC) | 타일 인접 규칙 제약 생성 |
| Poisson Disk Sampling | 오브젝트 자연 분포·스폰 배치 |
| n-gram / Markov 체인 | NPC 이름·텍스트 생성 |

> 전체 레퍼런스(각 알고리즘 절차·파라미터·교차 스킬·스니펫):
> [`reference/pcg/algorithms.md`](reference/pcg/algorithms.md)
>
> 동작 예제(시드 42 결정론 동굴, `--test` 플래그로 단독 검증 가능):
> [`examples/pcg-cave-cellular.mjs`](examples/pcg-cave-cellular.mjs)

```sh
# 동굴 생성 시각 확인
node skills/wgf-level-designer/examples/pcg-cave-cellular.mjs

# 결정론 단독 테스트 (exit 0 = 통과)
node skills/wgf-level-designer/examples/pcg-cave-cellular.mjs --test
```

## 연계 / 원칙
- 설계 의도·난이도 곡선·재미는 [`level-architect`](../wgf-level-architect/SKILL.md)가 결정 → 이 스킬이 빌드. 레벨이 "재미없다/단조롭다" 진단·리밸런싱도 level-architect 소관.
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(라이선스 안전·절차).
- `cx(col)`, `cy(row)` 헬퍼: `col * TILE + TILE/2` — 타일 중심 픽셀 좌표.
- staticGroup 생성 후 반드시 `.refreshBody()` 호출.
- 레벨 폭 카운팅 실수를 줄이려면 피처를 열 번호 오름차순으로 정렬해 작성한다.
- Phaser 4 API 참고: [tilemaps](../wgf-web-game-builder/reference/phaser/tilemaps.md), [groups-and-containers](../wgf-web-game-builder/reference/phaser/groups-and-containers.md), [geometry-and-math](../wgf-web-game-builder/reference/phaser/geometry-and-math.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
