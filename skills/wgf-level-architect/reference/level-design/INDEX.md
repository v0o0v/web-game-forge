# 레벨 디자인 레퍼런스 라이브러리 — 색인 (INDEX)

> 검증된 **레벨 디자인 이론·기법**을 정리해, [`level-architect`](../../SKILL.md) 스킬이 레벨을
> 설계할 때 쓰는 **원칙/처방 자료**다. 핵심 목적: 감이 아니라 `LD-*` 원칙으로 *왜 이렇게 배치했는지*
> 설명 가능한 레벨을 만들고, **플레이어의 재미를 극대화**하는 것.
> 재미 요소 조합(`FE-*`)은 [game-dna/fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md),
> 실제 빌드 패턴은 [`level-designer`](../../../wgf-level-designer/SKILL.md), 인터뷰는 [../level-interview.md](../level-interview.md).

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산(컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`·`game-dna/`와 같은 **온디맨드 Read** 방식. 필요할 때만 읽는다.
- `level-architect` 워크플로의 **2) 이론 적용** 단계에서 의사결정 도구로 쓴다:
  1. **[principles.md](./principles.md) 먼저** — `LD-*` 원칙 사전 + 난이도 곡선 설계법 + 안티패턴. 모든 장르 공통.
  2. **장르 파일 1개** — 아래 라우팅 표에서 대상 게임의 장르 파일을 골라 Read. 메카닉별 배치 규칙·튜닝 노브·worked example(현재 게임 스키마)을 반영.
- 레벨을 설계하기 전, 대상 게임의 `game.js` 레벨 데이터 스키마를 먼저 분석하고(스킬 0단계), 그 **기존 스키마 그대로** 산출한다(새 포맷 발명 금지).

## 장르 → 레벨 파일 → 스킬 라우팅

| 장르 / 코어 | 레벨 파일 | 저장소 예시 게임 | 빌드 위임 |
|---|---|---|---|
| 옆스크롤 플랫포머 / 차징 점프 | [platformer-levels.md](./platformer-levels.md) | super-runner | `platformer-game` + `level-designer` |
| 매치·머지 / 규칙조작·소코반 퍼즐 | [puzzle-levels.md](./puzzle-levels.md) | runeburst · is-rule | `puzzle-game` + `level-designer` |
| 탑다운 / 트윈스틱 / 불릿헤븐 | [shooter-arena-levels.md](./shooter-arena-levels.md) | — | `topdown-shooter` |
| 엔드리스 러너 / 플래피 / 절차생성 | [runner-procedural-levels.md](./runner-procedural-levels.md) | — | `endless-runner` |
| 벽돌깨기·스네이크·스택·픽스드 아케이드 | [arcade-levels.md](./arcade-levels.md) | — | `arcade-classic` |

> 공통 원칙은 항상 [principles.md](./principles.md). 장르 파일은 그 공통 원칙을 *해당 장르의 데이터·메카닉으로 구체화*한 처방전이다.

## LD-* 원칙 빠른 색인 — 자세한 정의는 [principles.md](./principles.md) §1

**곡선·페이싱**
`LD-CURVE`(난이도 곡선) · `LD-FLOW-CHANNEL`(몰입 채널: 도전-실력 균형) · `LD-PACING`(긴장-완화 파동) · `LD-REST`(쉼표·완급) · `LD-DDA`(동적 난이도 조정)

**가르치기·구성**
`LD-TEACH`(무텍스트 튜토리얼) · `LD-4BEAT`(도입→전개→비틀기→마무리) · `LD-ONE-IDEA`(한 레벨 한 개념) · `LD-FORESHADOW`(예고·복선) · `LD-VARIETY`(변주·반복회피)

**가독성·유도**
`LD-SIGNPOST`(시선 유도·랜드마크) · `LD-AFFORDANCE`(행동유도성·가독성) · `LD-TELEGRAPH`(텔레그래프)

**보상·공정성**
`LD-RISK-PATH`(위험-보상 분기) · `LD-SECRET`(비밀·탐험 보상) · `LD-REWARD`(보상 스케줄) · `LD-MASTERY-CEILING`(숙련 천장) · `LD-FAIR`(공정성·안티프러스트레이션) · `LD-CHECKPOINT`(체크포인트·실패비용)

**퍼즐 특화**
`LD-SOLVABLE`(해결가능성·교착방지) · `LD-BUDGET`(자원·이동수 예산)

**프로세스**
`LD-PLAYTEST`(플레이테스트·계측 튜닝)

## 난이도 곡선 빠른 처방 — 자세한 내용은 [principles.md](./principles.md) §2

| 곡선상 위치 | 처방 (LD-*) |
|---|---|
| 도입부 (튜토리얼) | LD-TEACH·LD-4BEAT(도입)·LD-ONE-IDEA·LD-FAIR — 안전한 환경에서 새 메카닉 1개를 무텍스트로 체험 |
| 전개 (중반) | LD-4BEAT(전개·비틀기)·LD-VARIETY·LD-PACING — 배운 메카닉을 조합·변주, 강도 파동 |
| 정점 (후반/보스) | LD-MASTERY-CEILING·LD-TELEGRAPH·LD-RISK-PATH — 종합 시험, 공정한 고난도 |
| 휴식 (스파이크 후) | LD-REST·LD-REWARD — 회복·보상으로 완급, 다음 상승 준비 |

## 출처 · 원칙

- 본 자료는 GDC 강연, GMTK(Game Maker's Toolkit) 등 공개 분석, 디자인 통념과 고전 저작(The Art of Game Design, Level Up!, A Game Design Vocabulary, Game Feel)을 한글로 소화·정리한 것이다(법률 자문·학술 인용 아님).
- **IP 안전 원칙:** 레벨디자인 *원칙·기법·메카닉*은 저작권 보호 대상이 아니므로 자유롭게 차용한다. 단, 특정 상용 게임의 **고유 레벨 레이아웃**(마리오 1-1, 특정 캔디크러시 스테이지 등)을 그대로 복제하지 않는다 — 기법만 가져와 절차생성/오리지널 배치로 재구성한다. 상세는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
