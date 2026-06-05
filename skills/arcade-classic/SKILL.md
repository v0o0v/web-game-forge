---
name: arcade-classic
description: "클래식 아케이드 게임을 스캐폴딩합니다 — 벽돌깨기(Breakout), 뱀(Snake), 퐁(Pong), 스페이스 인베이더(Space Invaders). 이런 단순 아케이드·고전 게임 클론 요청 시 사용."
allowed-tools: Read, Write, Edit, Bash
---

# arcade-classic — 클래식 아케이드 게임

Breakout·Snake·Pong·Space Invaders 등 고전 아케이드 게임 4종의 핵심 루프를 스캐폴딩한다. 물리 의존도가 낮고 직접 좌표 이동으로 구현해도 충분하다. web-game-builder 플러그인의 전문 스킬이며 `engine/`(Phaser 3 + PixelForge + ChipAudio + MobileHarness)를 사용한다.

## 언제 사용
- "벽돌깨기", "Breakout 만들어줘"
- "스네이크 게임", "Snake 클론"
- "퐁", "Pong"
- "스페이스 인베이더", "Space Invaders"
- 그 외 '고전 아케이드', '클래식 게임' 클론 요청

## 핵심 레시피

0. **스타일·테마 미지정이면 먼저 물어보기** — 아트 스타일(픽셀 `PixelForge` / 미려한 스무스 `VectorForge`)·테마·분량이 요청에 명시돼 있지 않으면, 코드 전에 `AskUserQuestion`으로 확인한다 (web-game-builder의 '요청 명확화' 참고).
1. `games/<slug>/` 스캐폴딩. `index.html`은 super-runner의 모바일 하니스 + 스크립트 로드 순서 따르기.
2. 아래 장르별 핵심 루프를 `Game` 씬에 구현. 물리 엔진 없이 `update`에서 직접 좌표 이동해도 무방(단순도 우선).
3. PixelForge로 필요한 스프라이트(`PixelForge.bake` 또는 `PixelForge.buildAll`), ChipAudio로 SFX, MobileHarness로 모바일 컨트롤.
4. HUD에 점수·레벨·목숨. `Title` 씬에서 'Tap to start' + `audio.unlock()`. 로컬 서버 검증.

### Breakout (벽돌깨기)
- 패들: 하단 고정, 좌우 이동(키보드 ← → / 터치 좌-우 영역 탭).
- 공: 매 `update`에서 `vx`·`vy` 더해 이동. 벽/천장 반사(`vx *= -1` 또는 `vy *= -1`). 패들 충돌 시 패들 위치 기반 각도 조정.
- 벽돌: 2D 배열로 생성. 공 충돌 시 해당 벽돌 `destroy()` + `vy *= -1`. 전멸 시 레벨업.
- 바닥 탈출 = 목숨 감소. `audio.sfx('bump')` 반사, `audio.sfx('coin')` 벽돌 파괴.

### Snake (뱀)
- 그리드 단위 이동(TILE 크기). `setInterval` 또는 누적 `delta`로 스텝 주기 제어.
- 꼬리를 `Array`(큐)로 관리: 매 스텝 앞에 head 위치 추가 → 맨 뒤 제거(먹이 먹으면 제거 안 함).
- 자기 몸·벽 충돌 = 즉사. 먹이 먹기: 랜덤 위치 재배치 + `audio.sfx('coin')`.
- 모바일: 4방향 스와이프(`input.on('pointermove')` delta 기반 방향 감지).

### Pong (퐁)
- 좌우 2개 패들. 좌: 플레이어(W/S 키 또는 터치), 우: AI(`Math.sign(ball.y - aiPaddle.y)`로 추적).
- 공 좌우 벽 탈출 시 상대 득점. 상하 벽 반사. 패들 맞으면 `vy`에 패들 속도 일부 반영(스핀).
- `audio.sfx('bump')` 패들/벽 반사, `audio.sfx('die')` 실점.

### Space Invaders (스페이스 인베이더)
- 적 그리드: 5×11 등. 매 스텝 전체 그리드를 좌우로 이동, 끝에 닿으면 한 행 하강 + 방향 반전.
- 플레이어 총알: 위 방향. 적 총알: 살아있는 적 중 랜덤 선택 → 아래 방향. 둘 다 오브젝트 풀.
- 적 전멸 시 레벨업(속도 증가). 적이 바닥까지 내려오거나 플레이어 피격 시 게임오버.
- `audio.sfx('bump')` 적 피격, `audio.sfx('die')` 플레이어 피격.

## 짧은 스니펫

```js
// Breakout 패들-공 충돌 예시 (Arcade physics 없이 직접 처리)
update(time, delta) {
  const dt = delta / 1000;
  this.ball.x += this.bvx * dt;
  this.ball.y += this.bvy * dt;

  // 벽/천장 반사
  if (this.ball.x < 8 || this.ball.x > GAME_W - 8) this.bvx *= -1;
  if (this.ball.y < 8) this.bvy *= -1;

  // 패들 충돌
  if (Phaser.Geom.Intersects.RectangleToRectangle(
        this.ball.getBounds(), this.paddle.getBounds())) {
    // 패들 위치로 반사 각도 결정 (-60~60도)
    const offset = (this.ball.x - this.paddle.x) / (this.paddle.width / 2);
    const angle  = offset * 60 * (Math.PI / 180);
    const speed  = Math.hypot(this.bvx, this.bvy);
    this.bvx = speed * Math.sin(angle);
    this.bvy = -Math.abs(speed * Math.cos(angle));
    GAME_AUDIO.sfx('bump');
  }
}
```

## 연계 / 원칙
- 전체 흐름·엔진 API는 `skills/web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(CC0/절차적): 게임 이름('Breakout'·'Pong' 등)은 메카닉 설명용, 스프라이트·로고 무단 복제 금지.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`. 터치 입력은 장르별로 스와이프·탭·D-패드 적절히 선택.
- 물리 엔진보다 직접 좌표 이동이 이 장르들에 더 직관적이고 버그가 적다.
