---
name: wgf-perf-60fps
description: "게임 성능을 60fps로 최적화합니다 — 오브젝트 풀링, 텍스처 아틀라스 배칭, 프레임당 할당 제거, Arcade 물리 컬링, devicePixelRatio 제한. 렉/끊김/성능/최적화 요청 시 사용. performance, fps, lag, optimize, 60fps."
allowed-tools: Read, Write, Edit
---

# perf-60fps — 60fps 성능 최적화 스킬

GC 스톨·과도한 드로우콜·물리 연산 낭비를 제거해 모바일 포함 60fps를 유지한다.
측정 → 병목 식별 → 수정 순서로 진행한다. web-game-builder의 전문 스킬.

## 언제 사용
- "게임이 버벅거려요", "모바일에서 끊겨요", "fps가 낮아요"
- "성능 최적화해줘", "렉 잡아줘", "60fps 나오게 해줘"
- 신규 기능 추가 후 성능 회귀 점검

## 우선순위 최적화 항목

### 1순위: 프레임당 GC 스톨 제거 (가장 큰 영향)

프레임당 객체/배열/클로저/문자열 할당은 GC 일시정지를 유발한다.

**나쁜 패턴 → 좋은 패턴**
```js
// ❌ update() 안에서 매 프레임 객체/배열 생성
update(t, dt) {
  const enemies = this.enemies.getChildren().filter(e => e.active); // 매 프레임 배열 생성
  const vel = { x: speed * dir, y: 0 };                             // 매 프레임 객체 생성
  this.scoreText.setText(`Score: ${this.score}`);                   // 매 프레임 문자열
}

// ✅ 사전 할당 + 조건부 업데이트
create() {
  this._vel = { x: 0, y: 0 };         // 한 번만 생성
  this._activeEnemies = [];            // 재사용 배열
}
update(t, dt) {
  this._vel.x = speed * dir;          // 기존 객체 재사용
  if (this._prevScore !== this.score) {
    this.scoreText.setText(`Score: ${this.score}`);  // 변경 시만
    this._prevScore = this.score;
  }
}
```

### 2순위: 오브젝트 풀링

자주 생성/파괴되는 총알·파티클·코인·적은 Group 풀로 관리한다.

```js
// create() — 풀 초기화
this.bullets = this.physics.add.group({
  classType: Phaser.Physics.Arcade.Image,
  maxSize: 20,       // 최대 오브젝트 수 제한
  runChildUpdate: false,
});

// 발사 — 풀에서 get()
fireBullet(x, y) {
  const b = this.bullets.get(x, y, 'bullet');  // 비활성 객체 재사용
  if (!b) return;                               // 풀 소진 시 스킵
  b.setActive(true).setVisible(true);
  b.body.setVelocityX(400);
}

// 화면 밖 처리 — killAndHide()
updateBullets() {
  this.bullets.getChildren().forEach(b => {
    if (b.active && b.x > this.scale.width + 50) {
      b.setActive(false).setVisible(false);     // killAndHide 패턴
      b.body.reset(0, 0);
    }
  });
}
```

### 3순위: 텍스처 아틀라스 배칭

개별 이미지 로드는 드로우콜을 늘린다. 스프라이트시트 또는 아틀라스로 묶는다.

```js
// preload — 스프라이트시트 (절차적 생성 후 단일 텍스처로)
// PixelForge로 생성한 스프라이트를 아틀라스에 패킹하거나
// 단일 스프라이트시트 이미지로 구성

// create — 텍스처 여러 번 재사용 (드로우콜 배칭)
// 같은 텍스처 키를 쓰는 스프라이트는 자동으로 배칭됨
this.platforms = this.physics.add.staticGroup();
for (let i = 0; i < 10; i++) {
  this.platforms.create(x, y, 'tiles');  // 동일 텍스처 → 배칭
}
```

### 4순위: Arcade 물리 + 화면 밖 컬링

Matter.js 대신 Arcade를 사용하고, 화면 밖 바디는 비활성화한다.

```js
// Phaser config — Arcade 물리 지정
physics: {
  default: 'arcade',                 // Matter 아님
  arcade: { gravity: { y: 600 }, debug: false },
},

// 화면 밖 오브젝트 바디 컬링
update() {
  this.enemies.getChildren().forEach(e => {
    if (!e.active) return;
    const onScreen = e.x > -100 && e.x < this.scale.width + 100;
    e.body.enable = onScreen;        // 화면 밖 물리 비활성
  });
}
```

### 5순위: DPR 제한

고해상도 디바이스에서 픽셀 4배 이상 렌더링 방지.

Phaser 4에는 game config `resolution`이 없다. DPR은 ScaleManager가 처리하며, 과도한 렌더 해상도가 문제면 `scale.zoom` 또는 `scale.max`로 캡한다.

```js
// Phaser config — resolution 설정 없이 ScaleManager에 위임
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: W,
  height: H,
  // 과도한 확대를 막으려면 zoom 또는 max를 지정
  // zoom: Phaser.Scale.MAX_ZOOM,
},
```

### 6순위: 알파 오버레이·파티클 자제

전체화면 알파 오버레이(어두워지기 등)와 과도한 파티클은 fillRate 병목을 유발한다.

```js
// ❌ 전체화면 알파 오버레이
this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.5);  // 매 프레임 전체 픽셀 처리

// ✅ 페이드는 카메라 fadeIn/fadeOut 사용
this.cameras.main.fadeIn(500, 0, 0, 0);

// 파티클: 개수 제한 + 수명 최소화
this.add.particles(x, y, 'spark', {
  quantity: 5,          // 적게
  lifespan: 300,        // 짧게
  maxParticles: 20,     // 상한 설정
});
```

### 7순위: fps.target 명시

```js
// Phaser config
fps: {
  target: 60,
  forceSetTimeOut: false,  // rAF 우선
},
```

## 성능 측정 방법

```js
// 브라우저 콘솔에서 현재 fps 확인
const game = window.SuperRunner.game;  // 또는 window.MyGame.game
setInterval(() => {
  console.log('fps:', Math.round(game.loop.actualFps));
}, 1000);
```

- 브라우저 DevTools Performance 탭: Long Tasks(>50ms) 식별
- game-qa 스킬의 step 하니스로 특정 씬 부하 측정 가능
- 모바일 실기기 테스트: 크롬 `chrome://inspect` 원격 디버깅

## 연계 / 원칙
- 성능 문제 재현: `game-qa` 스킬의 step 하니스 활용
- 모바일 DPR·Scale 설정: `mobile-webview-tune` 스킬 연계
- 엔진 API 참조: `skills/wgf-web-game-builder/reference/engine-api.md`
- web-game-builder 워크플로의 품질 게이트. 모바일 배포 전 필수 통과.
- Phaser 4 API 참고: [game-object-components](../wgf-web-game-builder/reference/phaser/game-object-components.md), [groups-and-containers](../wgf-web-game-builder/reference/phaser/groups-and-containers.md), [particles](../wgf-web-game-builder/reference/phaser/particles.md), [game-setup-and-config](../wgf-web-game-builder/reference/phaser/game-setup-and-config.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
