---
name: wgf-path-motion
description: "베지어/스플라인 경로로 패트롤 적, 탄막 패턴, 레일 이동, 타워디펜스 크립 경로, 커브 발사체, 떠다니는 앰비언트 오브젝트를 만든다. 키워드: 경로, path, 스플라인, 베지어, bezier, 패트롤, 탄막, bullet pattern, 타워디펜스, tower defense, 레일, 경로 추종, path follower"
allowed-tools: Read, Write, Edit, Bash
---

# path-motion — 경로·모션으로 패트롤·탄막·크립 구현

PathKit(`engine/pathkit.js`)으로 베지어/스플라인 경로를 만들고 스프라이트를 그 위에 올린다. web-game-builder의 전문 스킬. topdown-shooter 강화 + 타워디펜스 장르를 여는 핵심 모듈.

## 언제 사용
- 등불·구름·나비 등 앰비언트 오브젝트가 곡선을 따라 떠다녀야 할 때
- 적이 정해진 루트를 왕복(패트롤)해야 할 때
- 방사형·나선형 탄막을 커브로 쏘아야 할 때
- 타워디펜스에서 크립이 고정 경로를 따라 이동해야 할 때
- 레일 슈팅·롤러코스터·유도 미사일처럼 경로추종이 필요할 때

## 엔진 로드

```html
<!-- index.html — pathkit.js는 phaser.min.js 뒤에 -->
<script src="../../engine/phaser.min.js"></script>
<script src="../../engine/pathkit.js"></script>
```

PathKit은 `window.PathKit`으로 노출된다. Phaser 씬 `create()` 안에서 바로 호출 가능.

---

## 핵심 API

### PathKit.loop(scene, pts) → Path
닫힌 루프 스플라인. 마지막 점이 첫 점으로 매끄럽게 이어진다.  
`pts`: `[[x,y],...]` 또는 `[{x,y},...]` — **4개 이상에서 가장 매끄럽다**.

```js
var path = PathKit.loop(this, [[60,70],[180,44],[300,74],[200,124]]);
```

### PathKit.spline(scene, pts, close) → Path
열린 스플라인 경로. `close:true`로 끝-시작 선분을 이어 닫을 수 있다.

```js
var path = PathKit.spline(this, [[100,200],[250,150],[400,200],[550,180]]);
```

### PathKit.follower(scene, path, texKey, cfg) → PathFollower
경로추종 스프라이트. 내부적으로 Tween을 사용하므로 모든 tween 속성이 동작한다.

| cfg 키 | 기본값 | 설명 |
|---|---|---|
| `duration` | 6000 | 경로 1회 순회 시간(ms) |
| `repeat` | -1 | 반복 횟수, -1 = 무한 |
| `yoyo` | false | 역방향 왕복 |
| `rotateToPath` | false | 진행 방향으로 자동 회전 |
| `rotationOffset` | 0 | 자동회전 보정값(도) |
| `ease` | 'Sine.easeInOut' | 이징 함수 |
| `startAt` | 0 | 시작 위치 (0~1) |
| `onComplete` | undefined | 완료 콜백 |

```js
var follower = PathKit.follower(this, path, 'enemy', {
  duration: 4000,
  repeat: -1,
  rotateToPath: true,
  rotationOffset: 90   // 스프라이트가 오른쪽을 앞으로 그린 경우
});
```

### PathKit.patrol(scene, pts, texKey, cfg) → PathFollower
점들 사이를 왕복(yoyo)하는 단순 패트롤. `spline + follower(yoyo:true)`의 단축.

```js
var guard = PathKit.patrol(this, [[60,200],[260,200]], 'enemy', {
  duration: 2500,
  rotateToPath: true
});
```

### PathKit.draw(scene, path, o) → Graphics
경로를 그래픽 라인으로 렌더링. 앰비언트 장식 또는 디버그에 사용.

| o 키 | 기본값 | 설명 |
|---|---|---|
| `width` | 2 | 선 두께 |
| `color` | 0xffffff | 선 색상 |
| `alpha` | 0.4 | 투명도 |
| `smooth` | 64 | 드로잉 분할 수 |
| `depth` | (없음) | Graphics depth |

```js
PathKit.draw(this, path, { color: 0x33407a, alpha: 0.22, depth: -70 });
```

### PathKit.radialBurst(scene, x, y, texKey, o) → PathFollower[]
원점에서 N 방향으로 경로 + 추종 탄 배열을 생성. 방사형 탄막에 사용.

| o 키 | 기본값 | 설명 |
|---|---|---|
| `count` | 12 | 탄 수 |
| `distance` | 260 | 도달 반경(px) |
| `duration` | 1400 | 이동 시간(ms) |
| `startAngle` | 0 | 시작 각도(라디안) |
| `curve` | 0 | 휨 강도 (>0: 오른쪽 회전, <0: 왼쪽) |
| `frame` | undefined | 텍스처 프레임 |
| `destroyOnEnd` | true | 도달 후 자동 destroy |

```js
var bullets = PathKit.radialBurst(this, 240, 160, 'bullet', {
  count: 16,
  distance: 240,
  duration: 900,
  curve: 60          // 살짝 휘는 탄막
});
```

---

## 레시피

### ① 떠다니는 앰비언트 루프 (nocturne 데모)

`games/nocturne/game.js`의 등불 구현 — PathKit.loop + PathKit.follower + PathKit.draw 세 줄이 핵심.

```js
// GameScene.create() 내부
var loops = [
  [[60, 70], [180, 44], [300, 74], [200, 124]],
  [[300, 52], [424, 92], [330, 150], [232, 92]],
  [[110,150], [258,128], [400,158], [250,196]],
  [[200, 40], [384, 62], [300,128], [150,100]]
];
var self = this;
loops.forEach(function (pts, i) {
  var path = PathKit.loop(self, pts);
  // 앰비언트 경로선 (선택적, 낮은 alpha로 은은하게)
  PathKit.draw(self, path, { color: 0x33407a, alpha: 0.22, depth: -70 });
  // 각 등불이 서로 다른 속도·위상으로 출발
  var lan = PathKit.follower(self, path, 'lantern', {
    duration: 8000 + i * 1700,
    startAt: (i * 0.23) % 1
  });
  lan.setDepth(15);
});
```

`startAt`을 다르게 줘서 같은 루프에 여러 오브젝트를 위상 차이를 두고 올릴 수 있다.

---

### ② 패트롤 적

양쪽 끝을 왕복하는 가드. `rotateToPath:true`로 이동 방향을 바라본다.

```js
// 수평 왕복
var guard = PathKit.patrol(
  this,
  [[80, 200], [380, 200]],
  'enemy',
  { duration: 2800, rotateToPath: true }
);

// 복잡한 루트 (spline 직접 사용)
var route = PathKit.spline(this, [[80,200],[200,140],[320,200],[380,260]]);
var boss = PathKit.follower(this, route, 'boss', {
  duration: 5000,
  repeat: -1,
  yoyo: true,
  rotateToPath: true,
  rotationOffset: 90   // 스프라이트 앞면이 오른쪽인 경우
});
```

patrol이 반환하는 PathFollower에는 `._path` 참조가 붙어 있어 런타임에 경로를 교체할 수 있다:

```js
guard.stopFollow();
guard.setPath(newRoute, { duration: 3000 });  // Phaser 4 런타임 교체
```

---

### ③ 방사형 탄막 (슈팅 게임)

보스가 공격할 때 radialBurst를 호출한다. `curve` 값을 주면 나선형 탄막으로 변형된다.

```js
// 일반 방사형 (12방향)
function bossAttack(scene, bossX, bossY) {
  PathKit.radialBurst(scene, bossX, bossY, 'bullet', {
    count: 12,
    distance: 300,
    duration: 1200,
    destroyOnEnd: true
  });
}

// 나선형 탄막 (회전 시작 각도 누적)
var burstAngle = 0;
scene.time.addEvent({
  delay: 1800,
  repeat: -1,
  callback: function () {
    PathKit.radialBurst(scene, boss.x, boss.y, 'bullet', {
      count: 8,
      distance: 260,
      duration: 1000,
      startAngle: burstAngle,
      curve: 50
    });
    burstAngle += Math.PI / 8;
  }
});
```

탄이 명중 판정을 통과하면 follower 배열을 직접 destroy한다:

```js
var shots = PathKit.radialBurst(scene, x, y, 'bullet', { count:12 });
// 이후 충돌 처리
shots.forEach(function(b) {
  if (hitTest(b, player)) { b.destroy(); }
});
```

---

### ④ 타워디펜스 크립 경로

고정된 웨이포인트를 따라 크립이 한 방향으로 이동. `repeat:0`(1회 통과) + `onComplete` 로 기지 도달 처리.

```js
// 웨이포인트 정의 (맵 설계 시 한 번만)
var CREEP_PATH_PTS = [
  [-20, 160],  // 화면 밖 진입
  [100, 160],
  [100,  60],
  [380,  60],
  [380, 240],
  [500, 240]   // 화면 밖 탈출(기지)
];

function spawnCreep(scene, texKey, duration, onReach) {
  var path = PathKit.spline(scene, CREEP_PATH_PTS);
  var creep = PathKit.follower(scene, path, texKey, {
    duration: duration,
    repeat: 0,
    rotateToPath: true,
    onComplete: function () {
      onReach(creep);   // 기지 데미지 처리
      creep.destroy();
    }
  });
  return creep;
}

// 웨이브 스폰 — 0.8초 간격으로 5마리
var waveCount = 0;
scene.time.addEvent({
  delay: 800,
  repeat: 4,
  callback: function () {
    spawnCreep(scene, 'goblin', 6000 - waveCount * 200, function (c) {
      SHARED.baseHp -= 10;
    });
    waveCount++;
  }
});

// 경로선은 한 번만 그린다 (크립마다 그리지 않도록 주의)
var displayPath = PathKit.spline(scene, CREEP_PATH_PTS);
PathKit.draw(scene, displayPath, { color: 0xffaa00, alpha: 0.35, width: 3 });
```

> 크립마다 `PathKit.spline`을 호출하면 Path 오브젝트가 누적된다. 경로가 불변이라면 경로 객체를 변수에 저장해 재사용한다.

```js
// 재사용 패턴
var creepPath = PathKit.spline(scene, CREEP_PATH_PTS);
// 스폰 시
PathKit.follower(scene, creepPath, 'goblin', { duration:6000, repeat:0, onComplete:... });
```

---

## Phaser 4 레퍼런스 라우팅

PathKit이 감싸는 Phaser 4 내부 API의 전체 레퍼런스:

- 경로·커브 전반: [`reference/phaser/curves-and-paths.md`](../wgf-web-game-builder/reference/phaser/curves-and-paths.md)
- PathFollower 트윈 속성: [`reference/phaser/tweens.md`](../wgf-web-game-builder/reference/phaser/tweens.md)
- Graphics 렌더링: [`reference/phaser/graphics-and-shapes.md`](../wgf-web-game-builder/reference/phaser/graphics-and-shapes.md)
- 전체 레퍼런스 색인: [`reference/phaser/INDEX.md`](../wgf-web-game-builder/reference/phaser/INDEX.md)

---

## Gotcha

1. **Spline은 점 4개 이상에서 매끄럽다.** Catmull-Rom 보간 특성상 3개 이하면 꺾임이 생긴다.

2. **`getPoint(t)` vs `getPointAt(u)`.** `Path.getPoint(t)`는 전체 경로 호 길이 보정(균등 간격). 개별 Curve에서 균등 간격이 필요하면 `getPointAt(u)`를 사용한다.

3. **`quadraticBezierTo` 인자 순서 — 끝점 먼저.** 숫자 인자일 때: `path.quadraticBezierTo(endX, endY, cpX, cpY)`. 제어점이 아니라 끝점이 첫 번째다. `cubicBezierTo`도 동일: `(endX, endY, cp1X, cp1Y, cp2X, cp2Y)`.

4. **PathFollower는 내부 Tween이다.** `startFollow` cfg는 `scene.tweens.addCounter()`로 전달되므로 `ease`, `repeat`, `yoyo`, `delay`, `hold`, `onComplete` 등 모든 tween 속성이 유효하다.

5. **`moveTo`는 그리지 않는 가짜 커브다.** `active:false`인 MoveTo는 길이 0으로 `getPoints()`와 `draw()`에서 건너뛴다. PathKit.draw 결과에 영향 없음.

6. **크립 경로 재사용.** 크립마다 PathKit.spline을 호출하면 Path 오브젝트가 씬 내에 누적된다. 경로가 불변이면 한 번 생성 후 변수에 보관해 follower에 전달한다.

7. **`positionOnPath` 기본값은 false.** follower 생성 위치와 경로 시작 위치가 다르면 offset이 생긴다. 경로 시작점에 스냅하려면 `positionOnPath:true`를 전달하거나 PathKit.follower가 내부에서 `path.getStartPoint()`로 생성 위치를 맞추므로 별도 조작 불필요.

---

## 연계 / 원칙

- web-game-builder 워크플로의 일부. PathKit 엔진 소스: `engine/pathkit.js`.
- 동작 확인 데모: `games/nocturne/` — 4개 스플라인 루프 위 등불이 PathKit.loop + PathKit.follower + PathKit.draw 조합으로 떠다닌다.
- topdown-shooter와 연계: 적 패트롤(`patrol`)·보스 탄막(`radialBurst`)을 추가해 전투 다양성을 높인다.
- 타워디펜스 장르: 크립 경로를 PathKit.spline으로 정의하고 웨이브마다 follower를 스폰한다.
- IP-safe: 절차 생성 텍스처(`VectorForge.bake`)와 함께 쓰면 외부 에셋 0개로 동작한다.
- 관련 스킬: [juice-fx](../wgf-juice-fx/SKILL.md)(히트 이펙트), web-game-builder(전체 워크플로).
