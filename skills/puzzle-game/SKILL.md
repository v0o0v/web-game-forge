---
name: puzzle-game
description: "그리드 기반 퍼즐 게임을 스캐폴딩합니다 — 테트리스(Tetris), 매치3(Match-3), 2048, 뿌요뿌요류. 블록·타일을 맞추는 퍼즐 게임 요청 시 사용. puzzle, falling-block, match-3."
allowed-tools: Read, Write, Edit, Bash
---

# puzzle-game — 그리드 기반 퍼즐 게임

Tetris·Match-3·2048 등 2D 배열 보드 모델 기반의 퍼즐 게임을 스캐폴딩한다. 물리 엔진이 불필요한 순수 로직 기반 장르로, **보드 모델과 렌더를 분리**하는 것이 핵심이다. web-game-builder 플러그인의 전문 스킬이며 `engine/`(Phaser 4 + PixelForge + ChipAudio + MobileHarness)를 사용한다.

## 언제 사용
- "테트리스 만들어줘", "Tetris 클론", "낙하 블록 퍼즐"
- "매치3", "Match-3", "보석 맞추기", "뿌요뿌요"
- "2048 게임"
- 그 외 그리드·타일·블록을 맞추는 퍼즐 게임 전반

## 핵심 레시피

0. **스타일·테마 미지정이면 먼저 물어보기** — 아트 스타일(픽셀 `PixelForge` / 미려한 스무스 `VectorForge`)·테마·분량이 요청에 명시돼 있지 않으면, 코드 전에 `AskUserQuestion`으로 확인한다 (web-game-builder의 '요청 명확화' 참고). 어떤 재미요소를 넣을지 막막하면 [game-dna/puzzle.md](../web-game-builder/reference/game-dna/puzzle.md)(Tetris·Candy Crush·2048·Baba Is You 등 분석)와 [fun-elements.md](../web-game-builder/reference/game-dna/fun-elements.md)의 조합 설계법으로 아키타입·재미요소를 제안한다.
1. `games/<slug>/` 스캐폴딩. `index.html`은 super-runner의 모바일 하니스 + 스크립트 로드 순서 따르기. 물리 불필요하므로 `physics` 설정 생략 가능.
2. **보드 모델 / 렌더 분리**: `board[row][col]` 2D 배열이 유일한 상태 소스. 렌더는 `renderBoard()`가 매 변경 후 호출해 Phaser `Image`/`Rectangle`을 갱신한다. `update` 루프에서 직접 그리지 않는다.
3. 장르별 핵심 루프는 아래 참고.
4. 입력: 키보드(← → ↑ ↓, Space) + 모바일 스와이프(`input.on('pointermove')` 드래그 delta로 방향 감지).
5. PixelForge로 블록 색상 스프라이트(`PixelForge.bake` 단색 팔레트로 빠르게 정의). ChipAudio SFX: 블록 배치 `audio.sfx('bump')`, 라인/매치 클리어 `audio.sfx('coin')`, 게임오버 `audio.sfx('die')`.
6. MobileHarness 스케일·DOM 가드. 터치 입력은 스와이프로 방향 조작, 탭으로 회전/확인.
7. HUD에 점수·레벨·다음 피스 미리보기(Tetris) 또는 이동 횟수(Match-3/2048). `Title` 씬에서 'Tap to start' + `audio.unlock()`. 로컬 서버 검증.

### Tetris (낙하 블록)
- 테트로미노 7종을 `pieces` 배열로 정의(4×4 행렬 또는 좌표 오프셋).
- 매 스텝(레벨별 딜레이) 현재 피스를 1칸 하강. 바닥/다른 블록 충돌 시 보드에 고정 → 라인 클리어 → 새 피스 스폰.
- 회전: 피스 행렬을 전치 + 행 역순. 벽 킥(wall kick) 기본 구현.
- 라인 클리어: 꽉 찬 행을 `board.splice`로 제거 + 빈 행 앞에 추가.

### Match-3 (매치3)
- 보드 초기화: `ROWS × COLS` 랜덤 색상. 초기 매치 없도록 생성.
- 스왑: 인접 두 타일 교환 → 매치 탐색(가로/세로 3개 이상) → 매칭 타일 제거 → 중력 낙하(위 타일 아래로 이동) → 빈 자리 랜덤 리필 → 연쇄 매치 반복.
- 스왑 후 매치 없으면 스왑 취소.

### 2048
- 4×4 보드. 슬라이드 방향(← → ↑ ↓) 입력 시 해당 방향으로 모든 타일 이동+머지(같은 숫자 2개 합치기).
- 머지된 타일은 같은 방향으로 다시 머지 안 됨(플래그로 표시). 이동 후 빈 칸에 랜덤(2 또는 4) 타일 스폰.
- 2048 타일 달성 = 승리. 빈 칸 없고 이동 불가 = 패배.

## 짧은 스니펫

```js
// 2048 슬라이드 + 머지 (왼쪽 방향 예시, 나머지 방향은 보드 회전 후 동일 적용)
slideLeft() {
  let moved = false;
  for (let r = 0; r < 4; r++) {
    const row = this.board[r].filter(v => v !== 0);    // 0 제거
    const merged = [];
    for (let i = 0; i < row.length; i++) {
      if (i + 1 < row.length && row[i] === row[i + 1]) {
        merged.push(row[i] * 2);                       // 머지
        GAME_AUDIO.sfx('coin');
        i++;                                           // 다음 타일 건너뜀
      } else {
        merged.push(row[i]);
      }
    }
    while (merged.length < 4) merged.push(0);
    if (merged.some((v, i) => v !== this.board[r][i])) moved = true;
    this.board[r] = merged;
  }
  if (moved) { this.spawnTile(); this.renderBoard(); }
}

spawnTile() {
  const empty = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (this.board[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = Phaser.Utils.Array.GetRandom(empty);
  this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
}
```

## 연계 / 원칙
- 전체 흐름·엔진 API는 `skills/web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(CC0/절차적): 'Tetris'·'2048' 이름은 메카닉 설명용, 원작 스프라이트·폰트·상표 미사용.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`. 스와이프 입력은 `pointerdown`/`pointerup` delta로 방향 판별.
- 보드 모델과 렌더 분리가 버그 최소화의 핵심 — `update` 루프가 아닌 상태 변경 시점에만 `renderBoard()` 호출.
- Phaser 4 API 참고: [input-keyboard-mouse-touch](../web-game-builder/reference/phaser/input-keyboard-mouse-touch.md), [time-and-timers](../web-game-builder/reference/phaser/time-and-timers.md), [tweens](../web-game-builder/reference/phaser/tweens.md), [data-manager](../web-game-builder/reference/phaser/data-manager.md), [groups-and-containers](../web-game-builder/reference/phaser/groups-and-containers.md). 전체 색인은 [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
