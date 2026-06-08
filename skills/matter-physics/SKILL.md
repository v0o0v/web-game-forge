---
name: matter-physics
description: "Matter 물리 엔진으로 강체(rigid body) 시뮬레이션을 구현합니다 — 물리 퍼즐, 앵그리버드류 슬링샷, 래그돌, 쌓기(crateStack), 로프/체인, 차량. Arcade 물리로 표현할 수 없는 회전·충격·무너짐이 필요할 때 사용. matter, 물리 퍼즐, 앵그리버드, 쌓기, 래그돌, 물리 엔진, slingshot, rigid body, crateStack, MatterKit."
allowed-tools: Read, Write, Edit, Bash
---

# matter-physics — MatterKit 강체 물리

Phaser 4.1.0 에 번들된 Matter.js(`this.matter`) 위에 얹는 얇은 래퍼 `engine/matterkit.js`를 사용한다.
config 블록·바디 팩토리·상자 스택·슬링샷 발사까지 한 모듈에서 제공한다.

## 언제 사용

| 필요한 상황 | 해결책 |
|---|---|
| 물체가 회전하며 쓰러져야 함 | Matter — 강체 회전 내장 |
| 슬링샷·공 던지기 발사 메커닉 | `MatterKit.slingshot` |
| 상자·벽돌 스택을 쌓아 무너뜨리기 | `MatterKit.crateStack` + `isToppled` |
| 앵그리버드·컷더로프류 물리퍼즐 | MatterKit 전체 |
| 래그돌·차량·로프/체인 | `this.matter.add.constraint` (native) |
| 단순 충돌·타일맵 충돌 | Arcade Physics(`physics-arcade.md`)로 충분 |

## 엔진 로드 순서 (`index.html`)

Phaser 다음, 게임 스크립트 이전에 `matterkit.js`를 추가한다.

```html
<script src="../../engine/phaser.min.js"></script>
<script src="../../engine/matterkit.js"></script>
<!-- 기타 엔진(옵션) -->
<script src="game.js"></script>
```

## 핵심 API

### `MatterKit.config(opts)` — physics 설정 블록

game config 의 `physics:` 키에 직접 넣는다.

```js
var config = {
  type: Phaser.AUTO,
  // ...
  physics: MatterKit.config({ gravity: { x: 0, y: 1 }, bounds: false })
};
```

| opts 키 | 기본값 | 설명 |
|---|---|---|
| `gravity` | `{x:0, y:1}` | 중력 벡터 |
| `bounds` | `false` | 캔버스 경계 벽 자동 생성 |
| `sleeping` | `true` | 정지 바디 슬립(성능) |
| `debug` | `false` | 물리 디버그 시각화 |
| `positionIterations` | `12` | 위치 정밀도 (레퍼 기본 6) |
| `velocityIterations` | `8` | 속도 정밀도 (레퍼 기본 4) |

> 반복수를 올린 이유: 스택 안정성 개선 + 고속 탄의 터널링 완화. 비용은 아래 성능 노트 참고.

---

### 바디 팩토리

#### `MatterKit.box(scene, x, y, texKey, o)` — 동적 사각 바디

상자·벽돌·판자 등 네모 물체.

```js
var brick = MatterKit.box(this, 300, 200, 'crate', {
  bounce: 0.06,
  friction: 0.32,
  frictionStatic: 0.4,
  density: 0.0009,   // 낮을수록 잘 쓰러짐
  chamfer: 2         // 모서리 둥글리기
});
```

| o 키 | 기본값 | 설명 |
|---|---|---|
| `bounce` | `0.04` | 반발(restitution) |
| `friction` | `0.55` | 동마찰 |
| `frictionStatic` | `1` | 정마찰 |
| `density` | `0.0016` | 질량 밀도 |
| `chamfer` | — | 모서리 반경(px) |
| `w`, `h` | 텍스처 크기 | 바디 크기 오버라이드 |
| `label` | — | `body.label` 태그 |

#### `MatterKit.ball(scene, x, y, texKey, o)` — 동적 원형 바디

슬링샷 탄·구슬·볼.

```js
var orb = MatterKit.ball(this, 86, 248, 'orb', {
  radius: 11,
  bounce: 0.42,
  frictionAir: 0.005
});
```

| o 키 | 기본값 | 설명 |
|---|---|---|
| `radius` | `12` | 원 반경(px) |
| `bounce` | `0.35` | 반발 |
| `friction` | `0.05` | 동마찰 |
| `frictionAir` | `0.006` | 공기저항 |
| `density` | `0.004` | 밀도 |

#### `MatterKit.ground(scene, x, y, w, h, o)` — 정적 바닥/벽

`texKey` 있으면 텍스처 이미지, 없으면 투명 정적 바디.

```js
// 보이는 바닥
MatterKit.ground(this, 240, 300, 480, 24, { texKey: 'ground', friction: 1 });

// 보이지 않는 천장
MatterKit.ground(this, 240, -16, 480, 32);
```

---

### 스택·토폴 판정

#### `MatterKit.crateStack(scene, baseX, baseY, cols, rows, cellW, cellH, texKey, o)`

그리드(또는 피라미드) 상자 스택. 각 상자에 `_homeX` / `_homeY` 기록.

```js
// nocturne 데모 — 피라미드 4행 × 4열, 22×22 crate
this.crates = MatterKit.crateStack(
  this, 320, GROUND_TOP - 12, 4, 4, 24, 24, 'crate',
  { pyramid: true, bounce: 0.06, friction: 0.32, frictionStatic: 0.4, density: 0.0009 }
);
```

`o.pyramid: true` 이면 아래 행이 넓고 위로 갈수록 좁아지는 피라미드 형태.

#### `MatterKit.isToppled(crate, distThresh?, angleThresh?)` — 쓰러짐 판정

시작 위치(`_homeX`/`_homeY`) 대비 이동량 또는 기울기가 임계값을 넘으면 `true`.

```js
// update() 안에서 매 프레임 순회
this.crates.forEach(function (c) {
  if (c._scored || !c.body) return;
  if (MatterKit.isToppled(c)) {       // 기본: distThresh=26, angleThresh=0.6
    c._scored = true;
    score += 50;
  }
});
```

---

### 슬링샷 레시피 (nocturne 데모 기반)

`MatterKit.slingshot` 은 포인터-다운 → 드래그 → 업 이벤트를 내부에서 처리하고
조준선(Graphics)까지 그린다. `ammo` 콜백이 새 탄환을 반환한다.

```js
// 탄환 팩토리
function makeOrb(x, y) {
  return MatterKit.ball(scene, x, y, 'orb', { radius: 11, bounce: 0.42, frictionAir: 0.005 });
}

// 슬링샷 생성 (anchorX, anchorY = 발사 기준점)
var sling = MatterKit.slingshot(this, 86, 248, {
  ammo:     makeOrb,
  onLaunch: function (ammo) { shots++; },
  power:    0.13,      // 당김 → 속도 환산 계수
  maxVel:   15,        // 최대 속도(step 단위). 터널링 방지를 위해 ≤15 권장
  reloadMs: 850,       // 발사 후 다음 탄 장전까지 ms
  depth:    50         // 조준선 depth
});

// 반환 객체
// sling.getCurrent()  — 현재 장전된 탄 (MatterImage | null)
// sling.isAiming()    — 드래그 중 여부
// sling.reload()      — 수동 재장전
// sling.aimGraphics   — 조준선 Graphics 객체
```

**opts 상세:**

| opts 키 | 기본값 | 설명 |
|---|---|---|
| `ammo` | 필수 | `fn(x, y) → MatterImage` |
| `onLaunch` | noop | 발사 시 콜백 `fn(ammo)` |
| `power` | `0.12` | 당김 길이 → 속도 변환 계수 |
| `maxPull` | `110` | 최대 당김 거리(px) |
| `maxVel` | `15` | 최대 발사 속도(step/frame) |
| `reloadMs` | `850` | 자동 재장전 딜레이(ms) |
| `depth` | `50` | 조준선 레이어 depth |

---

## 충돌 이벤트

Matter 월드 이벤트로 충돌을 감지한다.

```js
// collisionstart 이벤트 — 충돌 깊이가 일정 이상일 때 sfx
this.matter.world.on('collisionstart', function (ev) {
  for (var i = 0; i < ev.pairs.length; i++) {
    if (ev.pairs[i].collision && ev.pairs[i].collision.depth > 1.4) {
      sfx('bump'); break;
    }
  }
});
```

바디별 콜백이 필요하면 `body.setOnCollide(fn)` / `body.setOnCollideWith(target, fn)` 사용.

---

## 터널링 주의 사항 (Gotchas)

Matter.js 는 CCD(연속 충돌 감지)가 없다. 탄 속도가 너무 빠르면 얇은 물체를 통과한다.

| 상황 | 대처 |
|---|---|
| 탄이 상자 벽을 통과함 | `maxVel ≤ 15` 유지, `positionIterations:12` / `velocityIterations:8` |
| 스택이 발사 직후 흔들려 무너짐 | `frictionStatic` 올리기(0.4↑), `density` 낮추기(0.0009) |
| 바디 속도 단위 착각 | px/s 가 아니라 **step당** — `setVelocity(5, -8)` 정도가 적당 |
| `setRectangle`/`setCircle` 후 속성 초기화 | 생성 시 `options.shape` 로 전달 (MatterKit 이 이미 처리) |
| 위치가 예상과 다름 | Matter 위치는 **질량중심** 기준 (Arcade 의 top-left 아님) |
| force 값이 너무 큼 | `applyForce` 범위 `0.01~0.1` — velocity(`1~15`)와 단위 다름 |

실측 데이터 (nocturne 데모):
- `maxVel 21` → 22px 상자를 관통
- `maxVel 14` + `positionIterations:12` / `velocityIterations:8` → 한 발에 상자 7개 토폴 (정상 동작)

---

## Arcade vs Matter — 언제 어느 쪽?

| 기능 | Arcade | Matter |
|---|---|---|
| AABB 충돌·타일맵 충돌 | O | O (무겁) |
| 회전 강체 | X | O |
| 충격·반발 시뮬레이션 | 제한적 | O |
| 제약(constraint)/로프/스프링 | X | O |
| 퍼포먼스(모바일) | 가볍 | 반복수에 비례 |

플랫포머·탄막·러너 → Arcade. 물리퍼즐·래그돌·쌓기 → Matter.

---

## 모바일 / 성능 노트

- `positionIterations` / `velocityIterations` 를 올리면 정확도는 높아지지만 CPU 비용 증가. 모바일에서 체감 슬로우다운이 생기면 각각 8 / 6 으로 낮춘다.
- `enableSleeping: true` (기본) — 정지 바디를 슬립 처리해 연산 절약.
- 스택 상자는 한 씬에 40개 이하 권장 (모바일 기준). 피라미드 4×4 = 10개가 적정.
- 슬립한 바디가 충격으로 깨어나는 딜레이가 느껴지면 `sprite.setAwake()` 로 수동 해제.
- `?lite=1` 쿼리로 FX 를 끄면 물리 연산만 남아 저사양에서도 동작 (nocturne 패턴).

---

## web-game-builder 워크플로 연계

1. **장르 스캐폴드** — web-game-builder 로 물리퍼즐 뼈대(Boot + Game + UI 씬) 생성.
2. **physics 블록** — game config 에 `physics: MatterKit.config(...)` 삽입.
3. **바디 배치** — `MatterKit.ground` → `MatterKit.crateStack` → `MatterKit.slingshot` 순서로 추가.
4. **주스(juice)** — 충돌 시 `sfx` + `cameras.main.shake` + 파티클(`juice-fx` 스킬 참고).
5. **검증** — `?autostart=1` 로 헤드리스 실행, `window.Game.api.fire(vx, vy)` 로 자동 테스트.

Phaser 4 레퍼런스 전체: [physics-matter.md](../web-game-builder/reference/phaser/physics-matter.md).
엔진 API 색인: [reference/engine-api.md](../web-game-builder/reference/engine-api.md).
충돌·쌓기 외 포스트FX 연출: [juice-fx](../juice-fx/SKILL.md).
