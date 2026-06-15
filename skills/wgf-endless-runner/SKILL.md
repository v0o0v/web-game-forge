---
name: wgf-endless-runner
description: "무한 러너 게임을 스캐폴딩합니다 — 플래피버드류, 자동 전진 점프 게임, 무한 스크롤 러너. runner, endless, flappy, auto-runner 요청 시 사용."
allowed-tools: Read, Write, Edit, Bash
---

# endless-runner — 무한 러너 / 자동 전진 게임

자동 전진(또는 배경·장애물 좌측 이동)하며 단일 입력(탭=점프/플랩)으로 플레이하는 무한 러너를 스캐폴딩한다. 패럴랙스 스크롤, 장애물 풀링, 거리 점수 구조를 갖춘다. web-game-builder 플러그인의 전문 스킬이며 `engine/`(Phaser 4 + PixelForge + ChipAudio + MobileHarness)를 사용한다.

## 언제 사용
- "무한 달리기 게임", "endless runner", "자동 전진 게임"
- "플래피버드 만들어줘", "flappy clone", "파이프 피하기"
- "점프 하나로 하는 게임", "탭 게임", "auto-runner"
- 장애물을 피하며 거리/시간 점수를 쌓는 스크롤 게임 전반

## 핵심 레시피

0. **스타일·테마 미지정이면 먼저 물어보기** — 아트 스타일(픽셀 `PixelForge` / 미려한 스무스 `VectorForge`)·테마·분량이 요청에 명시돼 있지 않으면, 코드 전에 `AskUserQuestion`으로 확인한다 (web-game-builder의 '요청 명확화' 참고). 어떤 재미요소를 넣을지 막막하면 [game-dna/runners.md](../wgf-web-game-builder/reference/game-dna/runners.md)(Flappy Bird·Geometry Dash·Canabalt 등 분석)와 [fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md)의 조합 설계법으로 아키타입·재미요소를 제안한다.
1. `games/<slug>/` 스캐폴딩. `index.html`은 super-runner의 모바일 하니스 + 스크립트 로드 순서 따르기.
2. **월드 이동 vs 카메라 이동**: 플레이어 x좌표는 고정, 장애물·배경을 매 프레임 왼쪽으로 이동시키는 방식이 가장 단순하다. 또는 `camera.scrollX += speed * dt`로 카메라를 전진시켜도 됨.
3. **패럴랙스 스크롤**: `tileSprite`(배경 레이어)를 속도 차이로 이동 — `bg.tilePositionX += 0.5 * speed * dt`, `ground.tilePositionX += speed * dt`. 또는 2개 이미지를 교대로 재배치.
4. **단일 입력(점프/플랩)**:
   - 러너형: `pointerdown` / `cursors.space` → `setVelocityY(-jumpForce)`.
   - 플래피형: 매 탭마다 `setVelocityY(-flapForce)` (중력이 지속 작용).
   - 모바일: `input.on('pointerdown')` 화면 전체 탭.
5. **장애물 풀링**: `physics.add.group({ maxSize: 10 })`. 오른쪽 끝에서 스폰, 왼쪽 화면 밖으로 나가면 `get()`으로 재활용(`body.reset`). `time.addEvent`로 스폰 간격 제어. 시간이 지날수록 속도·간격 조정(난이도 상승).
6. **충돌 = 즉사**: `physics.add.overlap(player, obstacles, onHit)` → `audio.sfx('die')` → 게임오버 씬 전환. 최고 점수(LocalStorage)와 비교해 갱신.
7. **점수**: 생존 거리(`camera.scrollX / 100`) 또는 시간(`time.now / 1000`). `UI` 씬 HUD에 실시간 표시.
8. PixelForge로 캐릭터·장애물·배경 스프라이트. ChipAudio SFX: 점프 `audio.sfx('jump')`, 충돌 `audio.sfx('die')`. BGM `audio.startBgm()`.
9. MobileHarness 스케일·DOM 가드. 터치 컨트롤은 `TouchControlsClass` 대신 씬 전체 `pointerdown`으로 단순화.
10. `Title` 씬에서 'Tap to start' + `audio.unlock()`. 로컬 서버 검증.

## 짧은 스니펫

```js
// Game 씬 — 장애물 풀 + 패럴랙스 + 단일 점프
create() {
  // 배경 tileSprite
  this.bg     = this.add.tileSprite(0, 0, GAME_W, GAME_H, 'hill').setOrigin(0, 0).setDepth(0);
  this.ground = this.add.tileSprite(0, GAME_H - 16, GAME_W, 16, 'ground').setOrigin(0, 0).setDepth(1);

  // 플레이어 (x 고정, 중력 적용)
  this.player = this.physics.add.sprite(80, GAME_H - 48, 'hero');
  this.player.body.setGravityY(600);

  // 장애물 풀
  this.obstacles = this.physics.add.group({ maxSize: 8 });
  this.time.addEvent({ delay: 1400, callback: this.spawnObstacle, callbackScope: this, loop: true });

  // 충돌
  this.physics.add.overlap(this.player, this.obstacles, () => {
    GAME_AUDIO.sfx('die');
    this.scene.start('Title');
  });

  // 단일 입력 (PC + 모바일)
  this.input.on('pointerdown', this.doJump, this);
  this.cursors = this.input.keyboard.createCursorKeys();
}

doJump() {
  if (this.player.body.blocked.down) {
    this.player.body.setVelocityY(-420);
    GAME_AUDIO.sfx('jump');
  }
}

update(time, delta) {
  const dt = delta / 1000;
  this.speed = 180 + time * 0.01;                      // 시간에 따라 가속

  // 패럴랙스
  this.bg.tilePositionX     += 0.3 * this.speed * dt;
  this.ground.tilePositionX += this.speed * dt;

  // 장애물 이동 + 화면 밖 회수
  this.obstacles.getChildren().forEach(ob => {
    if (!ob.active) return;
    ob.x -= this.speed * dt;
    if (ob.x < -32) ob.setActive(false).setVisible(false);
  });

  // 점프 키
  if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.doJump();

  // 점수(거리)
  this.score = Math.floor(time / 100);
  this.scene.get('UI').setScore(this.score);
}

spawnObstacle() {
  const ob = this.obstacles.get(GAME_W + 16, GAME_H - 32, 'enemy');
  if (!ob) return;
  ob.setActive(true).setVisible(true);
  ob.body.reset(GAME_W + 16, GAME_H - 32);
  ob.body.setAllowGravity(false);
}
```

## 연계 / 원칙
- 전체 흐름·엔진 API는 `skills/wgf-web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(라이선스 안전·절차): 'Flappy Bird' 이름·스프라이트·새 캐릭터 외형 직접 복제 금지. 메카닉은 자유.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`. 점프 입력은 화면 전체 탭으로 단순하게.
- 난이도 곡선: `speed = baseSpeed + elapsedTime * factor`로 선형 증가가 가장 밸런스 잡기 쉽다.
- 최고 점수 영속화: `localStorage.setItem('highscore', score)`로 새로고침 후에도 유지.
- Phaser 4 API 참고: [physics-arcade](../wgf-web-game-builder/reference/phaser/physics-arcade.md), [sprites-and-images](../wgf-web-game-builder/reference/phaser/sprites-and-images.md), [groups-and-containers](../wgf-web-game-builder/reference/phaser/groups-and-containers.md), [tweens](../wgf-web-game-builder/reference/phaser/tweens.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
