---
name: wgf-puzzle-game
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

0. **모호하면 청사진 인터뷰 먼저 (탑다운·조합주도)** — 요청이 한 줄·모호하거나 플랫폼·타깃 유저·퍼즐 코어·재미 조합·아트(픽셀 `PixelForge` / 미려한 스무스 `VectorForge`)·사운드·분량이 명시돼 있지 않으면, 코드 전에 **[reference/game-interview.md](../wgf-web-game-builder/reference/game-interview.md)의 탑다운·조합주도 1문1답 인터뷰**를 수행한다 (web-game-builder '요청 명확화' = `deep-interview` 적응판). 추상적 객관식 1회로 끝내지 말 것 — (a) **탑다운**: 맥락(C1 플랫폼·타깃 유저)부터 → 코어 → 재미조합 → 아트 → 사운드 → 승패·분량 → 조작; (b) **재미 요소 조합은 사용자 주도**: 완성 아키타입 강매 금지, 퍼즐 `FE-*` 팔레트를 `AskUserQuestion` multiSelect로 펼쳐 사용자가 직접 2~4개 조합하게 하고 받으면 **구체적 한 컷 반영 → 검증 → 본인의 다른 아이디어(대안) 제시**; (c) 매 라운드 Claude가 game-dna 기반 참신한 컨셉을 *먼저* 제안·의견 개진. 제안·조합·팔레트의 출처는 **퍼즐 심화 라이브러리 [game-dna/puzzle/INDEX.md](../wgf-web-game-builder/reference/game-dna/puzzle/INDEX.md)**(20종 — 낙하·매치/병합·논리/연역·공간/물리·규칙)와 [puzzle/fun-elements.md](../wgf-web-game-builder/reference/game-dna/puzzle/fun-elements.md)의 §1 재미요소 사전·§4 조합 설계법(낙하/매치/병합 기존 레시피 + 연역 그리드·규칙조작·공간 푸시·물리 신규 스캐폴드). 안티패턴(§3: 연역+실시간가속, 우아한해+강RNG 등)은 절충 되묻기로 가드. 준비도 게이트(C1 확정 + 코어·재미조합·아트 구체) 후 **청사진을 한 화면으로 읽어주고 최종 확인** → 그 뒤에만 스캐폴딩한다. 요청이 이미 구체적이면 인터뷰를 건너뛴다.
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

### 신규 하위장르 스캐폴드 (game-dna/puzzle 심화 20종 기반)
보드모델/렌더 분리 원칙은 동일. 재미요소·조합·재현 노트 전체는 [game-dna/puzzle/INDEX.md](../wgf-web-game-builder/reference/game-dna/puzzle/INDEX.md), 재미요소 사전·조합 레시피는 [puzzle/fun-elements.md](../wgf-web-game-builder/reference/game-dna/puzzle/fun-elements.md).
- **연역 그리드 (Sudoku·Picross·Minesweeper·Wordle)**: 셀에 `state`(unknown/filled/marked) + `candidates`(후보 비트마스크). 입력 시점에만 제약 전파 1패스(행/열/박스/단서 라인). 생성 단계에서 백트래킹 솔버로 **유일해 + 추측 불필요**를 검증(FE-FAIRNESS 핵심). undo 스택·펜슬마크 제공. 실시간 가속 금지(추론 시간 보장).
- **규칙조작 (Baba Is You류)**: Sokoban 밀기 코어 재사용 + `isYou`/`isPush`/`isWin`/`isStop` 비트마스크 규칙엔진을 **매 수 직후 재평가**. 단어블록도 그냥 밀리는 보드 객체. 규칙 종류는 소수로 유지(폭발 ⚠️), `game-qa`로 창발 버그 검증, undo 필수.
- **공간 푸시 (Sokoban)**: 방향 벡터 한 칸 이동(당기기 불가) + 교착 감지. 머리싸움 긴장형이면 undo 제한, 실험형이면 풀개방. 이동 수 카운트 → 별 1~3 판정.
- **공간 경로 (Flow Free)**: `pointermove` 드래그로 인접 셀 경로 트레이스, 선 겹침 금지, 모든 칸 채움 판정. perfect(최소 교차)로 `FE-OPTIMIZE`.
- **물리 (Cut the Rope류)**: 정밀 강체는 Matter(⚠️) 대신 **단순 임펄스 + 진자 근사**로 결정성·신뢰도 확보. 절단 횟수 제약 + 별 3개 판정. 궤적을 예측 가능하게 튜닝(FE-FAIRNESS).

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
- 전체 흐름·엔진 API는 `skills/wgf-web-game-builder/SKILL.md` 및 `reference/` 참고.
- IP-safe(CC0/절차적): 'Tetris'·'2048' 이름은 메카닉 설명용, 원작 스프라이트·폰트·상표 미사용.
- 모바일 필수: `MobileHarness.scaleConfig`, `installDomGuards`. 스와이프 입력은 `pointerdown`/`pointerup` delta로 방향 판별.
- 보드 모델과 렌더 분리가 버그 최소화의 핵심 — `update` 루프가 아닌 상태 변경 시점에만 `renderBoard()` 호출.
- Phaser 4 API 참고: [input-keyboard-mouse-touch](../wgf-web-game-builder/reference/phaser/input-keyboard-mouse-touch.md), [time-and-timers](../wgf-web-game-builder/reference/phaser/time-and-timers.md), [tweens](../wgf-web-game-builder/reference/phaser/tweens.md), [data-manager](../wgf-web-game-builder/reference/phaser/data-manager.md), [groups-and-containers](../wgf-web-game-builder/reference/phaser/groups-and-containers.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
