---
name: wgf-juice-fx
description: "게임필(juice)을 더합니다 — 파티클, 스크린셰이크, 트윈/이징, 히트스톱, 화면 전환 이펙트. 게임이 밋밋하다·타격감/이펙트 추가 요청 시 사용. juice, particle, screenshake, tween, game feel."
allowed-tools: Read, Write, Edit
---

# juice-fx — 파티클·셰이크·트윈으로 게임필 향상

파티클·스크린셰이크·트윈 이징·히트스톱으로 타격감과 생동감을 더한다. web-game-builder의 전문 스킬. `engine/`를 사용한다.

## 언제 사용
- 게임이 밋밋하거나 타격감이 부족하다는 피드백이 있을 때
- 코인 획득·적 처치·점프 등에 시각·진동 피드백을 추가할 때
- 씬 전환·클리어·게임오버에 연출 이펙트가 필요할 때

## 핵심 레시피

### 1) 'spark' 텍스처 생성 (Boot 씬)
파티클·조각 이펙트의 기반이 되는 작은 사각 텍스처를 미리 구워둔다.
```js
// Boot.create() 내
var g = this.make.graphics({ x: 0, y: 0, add: false });
g.fillStyle(0xffffff, 1);
g.fillRect(0, 0, 4, 4);
g.generateTexture('spark', 4, 4);
g.destroy();
// 이후 'spark'를 파티클·Image 조각에 자유롭게 사용
```

### 2) 파티클 흩뿌리기 (Phaser 4 ParticleEmitter)
```js
function burst(scene, x, y, tint) {
  var emitter = scene.add.particles(x, y, 'spark', {
    speed: { min: 40, max: 140 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0 },
    lifespan: 400,
    quantity: 10,
    tint: tint || 0xffe23f,
    gravityY: 200,
    emitting: false
  });
  emitter.explode();  // 즉시 burst 후 자동 소멸
}
// 코인 획득 시
burst(this, coin.x, coin.y, 0xffe23f);
// 적 처치 시
burst(this, enemy.x, enemy.y, 0x884400);
```

### 3) 조각 흩뿌리기 (트윈 기반 — 파티클이 무거울 때의 대안)
파티클 emitter 대신 트윈으로 조각을 흩뿌린다. 파티클 emitter가 부담스러운 저사양 기기에서 쓴다.
```js
function breakBurst(scene, x, y, tint, count) {
  count = count || 6;
  for (var i = 0; i < count; i++) {
    var p = scene.add.image(x, y, 'spark').setTint(tint || 0xc0612a).setDepth(9);
    var angle = (i / count) * Math.PI * 2;
    var dist = 30 + Math.random() * 40;
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - 20,
      alpha: 0,
      scale: 0.3,
      duration: 500,
      ease: 'Quad.out',
      onComplete: function () { p.destroy(); }
    });
  }
}
```

### 4) 스크린셰이크
```js
// 가벼운 진동 (점프 착지, 작은 타격)
this.cameras.main.shake(80, 0.004);

// 중간 진동 (적 밟기, 블록 파괴)
this.cameras.main.shake(120, 0.008);

// 강한 진동 (폭발, 데미지)
this.cameras.main.shake(200, 0.016);
```

### 5) 트윈 이징 모음
```js
// 스쿼시 & 스트레치 — 점프 시
this.tweens.add({ targets: hero, scaleX: 0.75, scaleY: 1.3, duration: 80, yoyo: true });

// 코인 팝업 — 위로 튀어오르다 사라짐
this.tweens.add({ targets: coinPop, y: y - 28, alpha: 0, duration: 350, ease: 'Quad.out',
  onComplete: function () { coinPop.destroy(); } });

// 배너 등장 — Back.out(오버슈트)
this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: 'Back.out' });

// 버튼 눌림 — 살짝 수축
this.tweens.add({ targets: btn, scale: 0.9, duration: 60, yoyo: true, ease: 'Sine.inOut' });

// 피격 플래시
this.tweens.add({ targets: hero, alpha: 0.2, duration: 80, yoyo: true,
  repeat: 5, ease: 'Sine.inOut' });
```

### 6) 히트스톱 (time scale 순간 정지)
```js
function hitStop(scene, duration) {
  duration = duration || 80;  // ms
  scene.physics.world.timeScale = 8;  // 물리를 8배 느리게 (사실상 정지)
  scene.time.timeScale = 0.1;         // 트윈·time 도 느리게
  scene.time.delayedCall(duration, function () {
    scene.physics.world.timeScale = 1;
    scene.time.timeScale = 1;
  });
}
// 적 밟기 성공 시
hitStop(this, 60);
GAME_AUDIO.sfx('stomp');
```

## 짧은 스니펫 — 코인 획득 전체 주스 패키지

```js
onCoin: function (hero, coin) {
  var x = coin.x, y = coin.y;
  coin.destroy();

  // 1) 파티클 burst
  burst(this, x, y, 0xffe23f);

  // 2) 팝업 텍스트 (+100)
  var pop = this.add.text(x, y - 8, '+100', {
    fontFamily: 'monospace', fontSize: '10px',
    color: '#ffe23f', stroke: '#000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(10);
  this.tweens.add({ targets: pop, y: y - 30, alpha: 0, duration: 600,
    ease: 'Quad.out', onComplete: function () { pop.destroy(); } });

  // 3) 경미한 셰이크
  this.cameras.main.shake(50, 0.003);

  // 4) SFX
  GAME_AUDIO.sfx('coin');

  this.addScore(100);
  this.state.coins++;
}
```

## 모바일 성능 고려
- 동시 파티클 emitter는 화면당 2~3개로 제한한다.
- 조각 이미지(breakBurst)는 count를 6 이하로 유지한다.
- 히트스톱은 80ms 이하로 짧게; 길면 입력 지연처럼 느껴진다.
- 셰이크 magnitude는 0.01 이하; 과도하면 멀미감.
- 오버드로(투명 레이어 중첩)가 많으면 모바일 GPU가 버티지 못한다 — depth 레이어를 최소화한다.

## 연계 / 원칙
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(CC0/절차적).
- 'spark' 텍스처는 Boot에서 `graphics.generateTexture`로 생성 — 외부 이미지 불필요.
- Phaser 4 `add.particles()` API: `emitting: false` + `explode()` 패턴이 일회성 burst에 적합.
- 주스는 '적게, 정확하게' — 모든 이벤트에 다 쓰면 감각이 마비된다.
- Phaser 4 API 참고: [particles](../wgf-web-game-builder/reference/phaser/particles.md), [tweens](../wgf-web-game-builder/reference/phaser/tweens.md), [cameras](../wgf-web-game-builder/reference/phaser/cameras.md), [filters-and-postfx](../wgf-web-game-builder/reference/phaser/filters-and-postfx.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
