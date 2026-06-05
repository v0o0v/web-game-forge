---
name: topdown-shooter
description: "탑다운/트윈스틱 슈팅 게임을 스캐폴딩합니다. 위에서 내려다보는 시점의 사격 게임 요청 시 사용 — 탑다운, 트윈스틱, 슈팅, 총게임, 슈먹, top-down, twin-stick, shoot 'em up, shmup."
allowed-tools: Read, Write, Edit, Bash
---

# topdown-shooter — 탑다운/트윈스틱 슈팅 게임

위에서 내려다보는 시점(탑다운)의 슈팅 게임을 스캐폴딩한다. 8방향 이동과 조준 사격, 적 웨이브, 오브젝트 풀 구조를 갖춘다. web-game-builder 플러그인의 전문 스킬이며 `engine/`(Phaser 3 + PixelForge + ChipAudio + MobileHarness)를 사용한다.

## 언제 사용
- "탑다운 슈팅", "위에서 보는 총게임", "트윈스틱 슈터"
- "shoot 'em up", "shmup", "top-down shooter" 등 조감 시점 사격 요청
- 적을 총이나 투사체로 처치하는 탑다운 게임 전반

## 핵심 레시피
1. `games/<slug>/` 스캐폴딩. `index.html`은 super-runner의 모바일 하니스 + 스크립트 로드 순서(phaser → pixelforge → audio → mobile → game) 따르기.
2. **중력 0**: `physics: { arcade: { gravity: { y: 0 }, debug: false } }`. 탑다운에서는 중력이 없다.
3. **8방향 이동**: `setVelocity(vx, vy)`. 대각선 이동 시 벡터 정규화(`Phaser.Math.Vector2.normalize`)로 속도 일정하게 유지.
4. **조준**: 데스크톱은 `scene.input.activePointer` 월드 좌표 → 플레이어 방향 각도(`Phaser.Math.Angle.Between`). 모바일은 우측 가상 영역 드래그 방향.
5. **총알 오브젝트 풀**: `this.physics.add.group({ maxSize: 30 })`. 발사 시 `group.get()` → `body.reset(x,y)` → `setActive(true).setVisible(true)` → `setVelocityFromRotation(angle, speed)`. 화면 밖 총알은 `killAndHide()`.
6. **적 스포너**: `this.time.addEvent({ delay: 1500, callback: spawnEnemy, loop: true })`. 적은 플레이어 방향으로 `moveTo` 또는 `velocityFromAngle`.
7. **충돌 처리**: `physics.add.overlap(bullets, enemies, onHit)`, `physics.add.overlap(enemies, player, onDamage)`. `onHit`에서 `GAME_AUDIO.sfx('stomp')`, `killAndHide` 양쪽.
8. **웨이브/체력**: 적 처치 수로 웨이브 카운터 증가 → 스폰 주기 단축. 플레이어 HP 0 → 게임오버.
9. PixelForge로 플레이어·적·총알 스프라이트 정의(`PixelForge.bake`). ChipAudio SFX(`audio.sfx('bump')` 피격, `audio.sfx('die')` 사망). MobileHarness 터치 컨트롤.
10. **모바일 입력**: 좌측 영역 드래그 = 이동, 우측 영역 드래그 = 조준+자동사격. `MobileHarness.TouchControlsClass`를 좌측 D-패드로 이동, 우측은 씬에서 `input.on('pointermove')` 커스텀 처리.
11. HUD에 HP 바·점수·웨이브 표시. `Title` 씬에서 'Tap to start' + `audio.unlock()`. 로컬 서버로 검증.

## 짧은 스니펫

```js
// Game 씬 — 오브젝트 풀 총알 발사
create() {
  this.bullets = this.physics.add.group({ maxSize: 30, runChildUpdate: true });
  this.lastFired = 0;

  this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
    bullet.setActive(false).setVisible(false);
    enemy.hp -= 1;
    if (enemy.hp <= 0) { enemy.setActive(false).setVisible(false); this.score += 10; }
    GAME_AUDIO.sfx('bump');
  });
}

fireBullet(fromX, fromY, angle) {
  const now = this.time.now;
  if (now - this.lastFired < 200) return;   // 발사 속도 제한
  this.lastFired = now;

  const b = this.bullets.get(fromX, fromY, 'bullet');
  if (!b) return;                            // 풀 소진 시 무시
  b.setActive(true).setVisible(true);
  b.body.reset(fromX, fromY);
  this.physics.velocityFromAngle(angle, 500, b.body.velocity);
  GAME_AUDIO.sfx('jump');
}

update() {
  // 화면 밖 총알 회수
  this.bullets.getChildren().forEach(b => {
    if (b.active && !this.cameras.main.worldView.contains(b.x, b.y))
      b.setActive(false).setVisible(false);
  });
}
```

## 연계 / 원칙
- 전체 흐름·엔진 API는 `skills/web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(CC0/절차적): 외부 스프라이트·상표명 금지.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`, 터치 조준 처리 포함.
- 오브젝트 풀(`maxSize` + `get`/`killAndHide`)은 모바일 GC 부담을 줄이는 필수 패턴.
