---
name: platformer-game
description: "옆스크롤 2D 플랫포머(슈퍼마리오류)를 스캐폴딩합니다. 달리기·점프·적 밟기·코인·깃발 골인이 있는 게임 요청 시 사용 — 플랫포머, 마리오류, 점프 게임, side-scroller, platformer, jump'n'run. games/super-runner 템플릿을 복제·개조한다."
allowed-tools: Read, Write, Edit, Bash
---

# platformer-game — 옆스크롤 2D 플랫포머

옆스크롤 플랫포머 게임을 빠르게 스캐폴딩한다. `games/super-runner/`를 복제해 레벨·테마·캐릭터만 바꾸는 것이 가장 빠른 경로다. web-game-builder 플러그인의 전문 스킬이며 `engine/`(Phaser 4 + PixelForge + ChipAudio + MobileHarness)를 사용한다.

## 언제 사용
- "마리오 같은 게임 만들어줘", "플랫포머 게임", "점프하고 적 밟는 게임"
- "side-scroller", "jump'n'run", "달리기 점프 게임" 등 옆스크롤 메카닉 요청
- 코인·블록·깃발 골인처럼 플랫포머 요소가 명시된 경우

## 핵심 레시피

0. **스타일·테마 미지정이면 먼저 물어보기** — 아트 스타일(픽셀 `PixelForge` / 미려한 스무스 `VectorForge`)·테마·분량이 요청에 명시돼 있지 않으면, 코드 전에 `AskUserQuestion`으로 확인한다 (web-game-builder의 '요청 명확화' 참고).
1. `games/super-runner/`를 `games/<slug>/`로 복제 후 개조. `index.html`의 모바일 하니스(뷰포트 meta + CSS 리셋)와 스크립트 로드 순서(phaser → pixelforge → audio → mobile → game)를 유지한다.
2. **물리**: `arcade.gravity.y = 800` 내외. 캐릭터에 `setDragX`로 마찰 적용. `body.blocked.down`으로 착지 판정.
3. **가변 점프**: 버튼을 길게 누를수록 높이 뜨도록 점프 중 버튼 해제 시 `vy`를 절반으로 줄인다. 코요테 타임(착지 후 N프레임 허용)과 점프 버퍼(공중에서 미리 누른 점프 기억)를 구현한다.
4. **카메라**: `camera.setBounds(0, 0, levelWidth, levelHeight)` + `camera.startFollow(player)`. 구덩이 사망은 `player.y > levelHeight + 32` 감지.
5. **타일/블록**: `StaticGroup`으로 solid 플랫폼. `?` 블록은 `overlap`으로 머리 박기 감지 후 아이템 스폰.
6. **적 밟기**: `player`-`enemies` overlap에서 `player.vy > 0 && player.y < enemy.y`면 stomped → `audio.sfx('stomp')`. 그 외 측면 접촉은 플레이어 피격.
7. **코인·파워업**: `staticGroup` overlap, `audio.sfx('coin')` / `audio.sfx('powerup')`.
8. **골인**: 깃발 poles에 overlap → `audio.sfx('flag')`, 씬 전환.
9. PixelForge로 스프라이트(`PixelForge.buildAll(scene)` 또는 `PixelForge.bake`로 커스텀), ChipAudio로 BGM+SFX, MobileHarness로 터치 컨트롤 추가.
10. HUD(`UI` 씬)에 점수·목숨·타이머 표시. `Title` 씬에서 'Tap to start' + `audio.unlock()`.
11. `python -m http.server 8766`으로 로컬 서버 실행 후 브라우저 확인.

## 짧은 스니펫

```js
// Game 씬 — 가변 점프 + 코요테 타임 예시
const COYOTE = 6;   // 프레임 수
const JUMP_BUFFER = 8;

update(time, delta) {
  const onGround = this.player.body.blocked.down;
  if (onGround) this.coyote = COYOTE;
  else if (this.coyote > 0) this.coyote--;

  const left  = cursors.left.isDown  || GAME_INPUT.left;
  const right = cursors.right.isDown || GAME_INPUT.right;
  const jumpPressed = cursors.up.isDown || GAME_INPUT.up;

  if (jumpPressed) this.jumpBuffer = JUMP_BUFFER;
  else if (this.jumpBuffer > 0) this.jumpBuffer--;

  if (this.jumpBuffer > 0 && this.coyote > 0) {
    this.player.body.setVelocityY(-480);
    this.coyote = 0; this.jumpBuffer = 0;
    GAME_AUDIO.sfx('jump');
  }
  // 가변 점프: 버튼 해제 시 상승 속도 감쇠
  if (!jumpPressed && this.player.body.velocity.y < -100) {
    this.player.body.setVelocityY(this.player.body.velocity.y * 0.75);
  }

  if (left)       this.player.body.setVelocityX(-180);
  else if (right) this.player.body.setVelocityX(180);
  else            this.player.body.setVelocityX(0);
}
```

## 연계 / 원칙
- 전체 흐름·엔진 API는 `skills/web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(CC0/절차적): 'Mario' 이름·닌텐도 스프라이트 금지. 장르·메카닉은 자유.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`, `TouchControlsClass` 포함.
- 동작 예제 전체 코드는 `games/super-runner/game.js` 참조.
- Phaser 4 API 참고: [physics-arcade](../web-game-builder/reference/phaser/physics-arcade.md), [sprites-and-images](../web-game-builder/reference/phaser/sprites-and-images.md), [animations](../web-game-builder/reference/phaser/animations.md), [cameras](../web-game-builder/reference/phaser/cameras.md), [tilemaps](../web-game-builder/reference/phaser/tilemaps.md), [input-keyboard-mouse-touch](../web-game-builder/reference/phaser/input-keyboard-mouse-touch.md). 전체 색인은 [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
