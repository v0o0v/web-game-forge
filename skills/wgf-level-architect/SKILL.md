---
name: wgf-level-architect
description: >
  현재 게임을 분석한 뒤 재미와 난이도 곡선을 설계해 레벨/스테이지를 추가합니다. game.js 의
  레벨 데이터·장르·메카닉·기존 난이도 곡선을 먼저 파악하고, 사용자의 의도가 모호하면 1문1답
  인터뷰로 끈질기게 캐물어, 검증된 레벨디자인 이론(난이도 곡선·몰입 채널·페이싱·도입→전개→비틀기→
  마무리 4단 비트·무텍스트 튜토리얼·공정성·해결가능성)으로 플레이어 재미를 극대화한 레벨을 설계합니다.
  새 레벨/스테이지 추가, 난이도 밸런싱, 레벨 곡선 개선, 튜토리얼·보스·휴식 구간 설계, 레벨 리뷰
  요청 시 사용. 실제 빌드(타일/스태틱그룹·보드 배치)는 level-designer 에 위임합니다.
  English: use when the user wants to add or improve levels/stages, tune difficulty, design a
  difficulty curve, or make levels more fun — analyze the game first, interview for intent, then
  apply level-design theory. Keywords: 레벨, 스테이지, 난이도 곡선, 밸런싱, 레벨 디자인, level,
  stage, level design, difficulty curve, balancing, pacing, tutorial level.
  스테이지를 잇는 월드맵/진행 위상(액트·무한맵·분기·허브)은 world-map-architect, 타일맵 빌드는 level-designer 소관.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
---

# level-architect — 레벨 디자인 디렉터 (분석·의도·재미)

게임에 **재미있고 잘 설계된 레벨**을 추가하는 상위 스킬. 코드를 바로 짜지 않고 **① 현재 게임을
분석 → ② 사용자 의도를 인터뷰로 명확화 → ③ 검증된 레벨디자인 이론을 적용 → ④ 설계를 게임의
기존 레벨 데이터 형식으로 산출 → ⑤ 구현은 [`level-designer`](../wgf-level-designer/SKILL.md)에 위임 →
⑥ 검증**한다. web-game-builder 워크플로의 일부. `engine/` 와 `reference/` 를 쓴다.

> **역할 분리:** 이 스킬은 *무엇을·왜* 설계하는가(의도·재미·곡선)를 담당한다. *어떻게* 빌드하는가
> (staticGroup·타일맵·보드 빌드 패턴)는 [`level-designer`](../wgf-level-designer/SKILL.md)가 담당한다.
> 재미 요소(`FE-*`) 조합은 [game-dna/fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md),
> 레벨디자인 원칙(`LD-*`)은 [reference/level-design/INDEX.md](./reference/level-design/INDEX.md).

## 언제 사용
- 기존 게임에 **새 레벨·스테이지를 추가**하거나 레벨팩을 확장할 때
- **난이도 곡선**을 설계·개선하거나 특정 레벨이 너무 쉽/어렵다는 피드백을 반영할 때
- **튜토리얼 도입 레벨**, **보스/정점 레벨**, **휴식 구간**을 설계할 때
- 레벨이 "재미없다/단조롭다"를 진단하고 **레벨 리뷰·리밸런싱**을 할 때

## 핵심 원칙
1. **분석 먼저.** 새 형식을 발명하지 않는다 — 현재 game.js 의 레벨 데이터 구조를 찾아 **그 스키마 그대로** 산출한다.
2. **의도가 모호하면 끈질기게 묻는다.** 1문1답 탑다운 인터뷰([reference/level-interview.md](./reference/level-interview.md))로 약점 차원을 캔다. 4문항 객관식 한 방으로 끝내지 않는다.
3. **이론으로 설계한다.** 감이 아니라 `LD-*` 원칙(난이도 곡선·몰입 채널·페이싱·4단 비트·공정성)으로 결정하고 *왜 이렇게 배치했는지* 한 줄로 근거를 남긴다.
4. **재미 극대화.** 한 레벨에 한 개념(LD-ONE-IDEA), 도입→전개→비틀기→마무리(LD-4BEAT), 공정한 실패(LD-FAIR), 변주(LD-VARIETY)로 *유저가 계속 하고 싶게* 만든다.
5. **검증.** 퍼즐은 해결가능성·데드락, 러너는 통과가능성, 전 장르는 난이도 곡선 단조성을 확인하고 보고한다.

## 워크플로

### 0) 현재 게임 분석 (필수 · 코드 작성 전)
대상 게임의 `game.js`(또는 게임 디렉터리)를 Read 해서 다음을 파악한다:
- **레벨 데이터 위치·스키마** — 보통 game.js 상단의 선언적 `LEVEL`/`LEVELS`/`STAGES` 블록. 그 필드를 그대로 표로 정리한다.
- **장르·코어 루프** — 플랫포머/러너/슈터/아케이드/퍼즐(매치·머지·규칙조작 등) 중 무엇인가.
- **메카닉·기믹·블로커** — 점프/적/구덩이/파워업, 또는 젤리/얼음/확산/규칙블록 등 *이미 구현된* 요소 목록(없는 걸 쓰지 않는다).
- **승리/실패·목표 타입** — score/collect/jelly/ingredient/도달/생존/규칙완성 등.
- **난이도 노브** — 이 게임이 난이도를 올리는 손잡이(예: 매치3=색 수↑·이동수↓·블로커, 플랫포머=구덩이 폭·발판 간격·적 밀도, 러너=속도·스폰 간격).
- **기존 곡선·삽입 지점** — 현재 레벨들의 난이도 추세와, 새 레벨을 *곡선의 어디에* 끼울지.

> 저장소의 현재 게임 스키마 예시(분석의 본보기): super-runner=`LEVEL{features/pits/pipes/goal}`,
> runeburst=`LEVELS[{shape,colors,moves,goal,win,블로커,seed}]`, is-rule=`LEVELS[{par,ent격자,texts규칙}]`.
> 장르별 분석·튜닝 노브는 [reference/level-design/INDEX.md](./reference/level-design/INDEX.md) 라우팅 표 참고.

분석 결과를 **한 화면 요약**(장르 · 스키마 · 메카닉 목록 · 목표 타입 · 난이도 노브 · 기존 곡선)으로 사용자에게 읽어준 뒤 1)로 넘어간다.

### 1) 의도 분석 + 레벨 인터뷰 (모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비어 있으면 **온디맨드로 [reference/level-interview.md](./reference/level-interview.md)를 Read** 해
탑다운 1문1답 인터뷰를 수행한다. `oh-my-claudecode` deep-interview / web-game-builder game-interview 방법론을 레벨 설계에 적응시킨 것:
- **약점 차원 하나씩, "왜 지금" 명시.** L1 분석확인 → L2 레벨의 목적/의도 → L3 곡선상 위치(도입/전개/정점/선택적) → L4 도입·강조 메카닉 → L5 난이도·길이·페이싱 → L6 목표·자원예산 → L7 개수·삽입지점 → L8 재미요소(`FE-*`)·비밀.
- **매 라운드 Claude가 먼저 구체안을 제안**하고(백지 금지) 본인 의견을 밝힌다. 추상적 답("그냥 어렵게")은 구체 사례로 되묻는다.
- **준비도 게이트**(L2 의도 + L3 위치 + L4 메카닉 + L5 난이도 구체화) 충족 전엔 설계를 확정하지 않는다.
- 사용자가 "알아서/그냥 추가해"라고 하면 분석 기반 추천 기본값으로 설계안을 채워 진행한다.

### 2) 레벨디자인 이론 적용 (설계 전 필수 Read)
[reference/level-design/principles.md](./reference/level-design/principles.md)(LD-* 원칙·난이도 곡선 설계법·안티패턴) +
장르 파일 1개([INDEX.md](./reference/level-design/INDEX.md) 라우팅) 를 읽고, 설계 결정마다 LD-* 근거를 단다:
- 곡선상 위치 → LD-CURVE/LD-PACING, 도입 레벨이면 LD-TEACH/LD-4BEAT, 정점이면 LD-MASTERY-CEILING.
- 새 메카닉은 LD-ONE-IDEA·LD-FORESHADOW(안전한 예고)·LD-4BEAT로 가르친다.
- 공정성 LD-FAIR(회피 가능·기습 금지), 퍼즐은 LD-SOLVABLE·LD-BUDGET, 액션은 LD-TELEGRAPH.

### 3) 레벨 설계 (게임의 기존 스키마로 산출)
이론을 적용해 **구체적 레벨 데이터**를 game.js 의 *기존 형식 그대로* 만든다(새 포맷 발명 금지).
각 레벨에 **한 줄 디자인 노트**(이 레벨의 의도 + 적용한 LD-*)를 주석으로 남긴다. 곡선 단조성·변주·휴식 배치를 표로 점검한다.

### 4) 구현 위임 / 적용
- **플랫포머·러너 등 빌드형:** 설계한 레벨 데이터 + 배치 규칙을 [`level-designer`](../wgf-level-designer/SKILL.md)로 넘겨 staticGroup/타일/청크로 빌드한다.
- **퍼즐·데이터 주도형:** `LEVELS` 배열에 항목을 직접 추가/수정한다(스키마 일치 필수).
- 새 메카닉/연출이 필요하면 제작요소 스킬(juice-fx·game-ui-hud·chip-sound)로 라우팅한다.

### 5) 검증 (필수)
- **퍼즐:** 해결가능성(최소 한 해 존재)·데드락/노무브(셔플 규칙)·`par`/이동수 예산 적정성.
- **러너/절차:** 모든 생성 패턴이 통과가능(LD-FAIR)한지 검증 규칙.
- **전 장르:** 난이도 곡선 단조성(스파이크 의도 표시), 새 메카닉이 안전하게 학습되는지.
- 로컬 서버(`python -m http.server 8766`)로 띄워 플레이/부팅 확인, 가능하면 game-qa 헤드리스 step·preview MCP 로 점검 후 **결과를 근거와 함께 보고**한다.

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 레벨 설계 레인.
- **구현:** [`level-designer`](../wgf-level-designer/SKILL.md)(staticGroup·타일맵·보드 빌드 패턴).
- **장르 스킬:** platformer-game · endless-runner · arcade-classic · puzzle-game · topdown-shooter.
- **제작요소:** juice-fx(연출) · game-ui-hud(목표·잔여자원 표시) · chip-sound(비트 기반 페이싱).
- **레퍼런스:** 원칙 [reference/level-design/](./reference/level-design/INDEX.md) · 인터뷰 [reference/level-interview.md](./reference/level-interview.md) · 재미요소 [fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md) · Phaser4 [INDEX](../wgf-web-game-builder/reference/phaser/INDEX.md).

## IP 안전
- 레벨디자인 **원칙·메카닉·난이도 기법**(4단 비트·텔레그래프·체크포인트 등)은 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임의 고유 레벨 레이아웃**(예: 마리오 1-1, 특정 캔디크러시 스테이지 배치)을 그대로 복제하지 않는다 — 기법만 가져와 오리지널 배치로 재구성한다.
- 에셋은 라이선스 안전한 외부 에셋 또는 절차 생성(PixelForge·VectorForge·ChipAudio). 상세는 [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md).
