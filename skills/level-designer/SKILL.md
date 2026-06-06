---
name: level-designer
description: "게임 레벨/맵/스테이지를 설계합니다 — 그리드 기반 레벨 데이터, 타일맵, 난이도 곡선, Tiled(.tmj) 연동 옵션. 레벨/맵/스테이지 제작·확장 요청 시 사용. level, map, stage, tilemap."
allowed-tools: Read, Write, Edit
---

# level-designer — 그리드 기반 레벨·스테이지 설계

피처 리스트 방식으로 레벨 데이터를 정의하고 Phaser staticGroup으로 빌드한다. web-game-builder의 전문 스킬. `engine/`를 사용한다.

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

## Tiled(.tmj) 연동 옵션 (간략)
```js
// preload
this.load.tilemapTiledJSON('map', 'assets/level1.tmj');
this.load.image('tiles', 'assets/tileset.png');

// create
var map = this.make.tilemap({ key: 'map' });
var tiles = map.addTilesetImage('tileset', 'tiles');
var layer = map.createLayer('Ground', tiles, 0, 0);
layer.setCollisionByProperty({ collides: true });
this.physics.add.collider(this.hero, layer);
```
Tiled 방식은 대형 맵에 유리하나, 타일 이미지가 CC0여야 IP-safe를 유지한다.

## 연계 / 원칙
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(CC0/절차적).
- `cx(col)`, `cy(row)` 헬퍼: `col * TILE + TILE/2` — 타일 중심 픽셀 좌표.
- staticGroup 생성 후 반드시 `.refreshBody()` 호출.
- 레벨 폭 카운팅 실수를 줄이려면 피처를 열 번호 오름차순으로 정렬해 작성한다.
- Phaser 4 API 참고: [tilemaps](../web-game-builder/reference/phaser/tilemaps.md), [groups-and-containers](../web-game-builder/reference/phaser/groups-and-containers.md), [geometry-and-math](../web-game-builder/reference/phaser/geometry-and-math.md). 전체 색인은 [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
