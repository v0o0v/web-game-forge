# 맵디자인 레퍼런스 라이브러리 — 색인 (INDEX)

> 검증된 **스테이지 연결 맵(진행 위상) 설계 이론·기법**을 정리해, [`world-map-architect`](../../SKILL.md)
> 스킬이 맵을 설계할 때 쓰는 **원칙/처방 자료**다. 핵심 목적: 감이 아니라 `MAP-*` 원칙으로 *왜 이 위상·이
> 게이트·이 곡선인지* 설명 가능한 진행 구조를 만들고, **플레이어가 '계속 하고 싶게' 만드는 것**.
> 개별 레벨 내용·난이도는 [`level-architect`](../../../wgf-level-architect/SKILL.md)(LD-*), 재미요소 조합은
> [game-dna/fun-elements.md](../../../wgf-web-game-builder/reference/game-dna/fun-elements.md)(FE-*) 참고.

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산
  (컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`·`level-design/`과 같은 **온디맨드 Read** 방식.
- `world-map-architect` 워크플로의 **2) 이론 적용** 단계에서 의사결정 도구로 쓴다:
  1. **[topologies.md](./topologies.md) 먼저** — 위상 선택표로 *어떤 모양의 여정*인지 고르고(선형/사가/
     그리드/노드맵/액트/허브/무한), 그 아키타입의 게이팅·내비·페이싱·영속 처방을 본다.
  2. **[principles.md](./principles.md)** — `MAP-*` 캐논(곡선·게이팅·에이전시·내비·영속). 위상에 얹는 공통 원칙.
  3. **[build-patterns.md](./build-patterns.md)** — 데이터 스키마 진화(`MAP-SCHEMA`)와 Phaser 4 Map 씬·내비·
     진행 저장의 실제 구현 패턴. 빌드 단계에서 Read.
- 맵을 설계하기 전, 대상 게임의 `game.js` **진행 모델**(LEVELS·진행 저장·씬 흐름)을 먼저 분석하고(스킬 0단계),
  그 **기존 모델을 진화**시킨다(선형은 그래프의 특수형이므로 깨지 않고 확장).

## 위상(topology) → 파일 → 빌드 라우팅

| 위상 / 진행 모양 | 한 줄 정의 | 저장소 예시 | 자세히 |
|---|---|---|---|
| 선형 체인 · 사가맵 · 레벨선택 그리드 | 정해진 한 줄(또는 여정 메타포) | runeburst·is-rule(현 상태) | [topologies.md](./topologies.md) §1~3 |
| 분기 노드맵 (로그라이크) | 한 런=한 절차생성 DAG | — | [topologies.md](./topologies.md) §4 |
| 액트/챕터 월드맵 | 테마 묶음 + 마일스톤 보스 | — | [topologies.md](./topologies.md) §5 |
| 허브앤스포크 오버월드 | 중앙 거점 + 방사형 왕복 | — | [topologies.md](./topologies.md) §6 |
| 개방형 상호연결 / 루프 (메트로배니아) | 능력 게이팅 + 사이클·지름길 | — | [topologies.md](./topologies.md) §7 |
| 무한 / 엔드리스 / 절차맵 | 거리=진행, 맵 없는 맵 | runeburst `daily` 모드 | [topologies.md](./topologies.md) §8 |

> 위상은 **단독으로 쓰기보다 조합**한다 — 모바일 캐주얼은 보통 '선형 베이스 + 가벼운 분기/액트 + 무한 모드 별도'.
> 위상 선택표는 [topologies.md](./topologies.md) 맨 위.

## MAP-* 빠른 색인 — 원칙 정의는 [principles.md](./principles.md), 위상 아키타입 정의는 [topologies.md](./topologies.md)

**위상 아키타입** — 정의는 [topologies.md](./topologies.md)
`MAP-LINEAR`(선형 체인) · `MAP-SAGA`(사행 사가맵) · `MAP-GRID`(에피소드 그리드) · `MAP-DAG`(분기 노드맵) ·
`MAP-ACT`(액트 월드맵) · `MAP-HUB`(허브앤스포크) · `MAP-LOOP`(개방형/루프) · `MAP-INFINITE`(무한·절차)

**거시 곡선·페이싱**
`MAP-MACRO`(거시 톱니/프랙탈 곡선) · `MAP-BOSS`(보스·관문 케이던스) · `MAP-REST`(휴식 비트·완급) ·
`MAP-CLOSE`(정점 직후 하강 마무리) · `MAP-FLOW`(micro/macro 중첩 몰입 채널)

**위상·에이전시(주도성)**
`MAP-TOPOLOGY-CURVE`(위상별 곡선 강제력: 선형/분기/허브) · `MAP-BRANCH`(의미 있는 분기=위험-보상 라우팅) ·
`MAP-AGENCY`(입력 무작위성·자율성·시퀀스 브레이킹 허용)

**게이팅·진행**
`MAP-GATE`(하드/소프트 게이트·자물쇠를 열쇠보다 먼저) · `MAP-LOCKKEY`(락앤키·미션/공간 의존성 그래프) ·
`MAP-STAR`(별 게이트·진행≠숙련 분리) · `MAP-ETHICS`(라이프/시간 게이트 윤리·anti-dark-pattern)

**내비게이션·가독성**
`MAP-NAV`(현재위치·다음노드 단일 강조·랜드마크) · `MAP-PROGRESS`(진척 가시화·목표 구배·기대감) ·
`MAP-MOBILE`(한손 thumb-zone·탭 타깃·줌) · `MAP-A11Y`(색+형태 이원부호화·작은 화면)

**영속·리플레이·절차생성**
`MAP-PERSIST`(노드별 진행 영속·봉투형) · `MAP-SEED`(시드 결정성=재현·공유) · `MAP-PCG`(절차 청크+풀이가능 경로) ·
`MAP-DAILY`(데일리/주간 동일 시드) · `MAP-RUN`(런 기반 vs 영속 캠페인) · `MAP-META`(런 사이 메타 해금·NG+)

**데이터·구현** — [build-patterns.md](./build-patterns.md)
`MAP-SCHEMA`(평평한 `LEVELS[]` → 노드 그래프 진화)

## 위상별 거시 곡선 빠른 처방 — 자세한 내용은 [principles.md](./principles.md) `MAP-TOPOLOGY-CURVE`

| 위상 | 곡선 강제력 | 처방 (MAP-*) |
|---|---|---|
| 선형 | 단일 곡선을 모두에게 강제 | 톱니·휴식·보스 케이던스를 엄격 검증(우회 없어 벽 1개=이탈). `MAP-MACRO`·`MAP-REST` |
| 분기(노드맵) | 플레이어가 곡선 기울기 선택 | 합류점 + 위험-보상 정렬. `MAP-BRANCH`·`MAP-AGENCY` |
| 액트/허브 | 여러 곡선 병렬, 자기 곡선 조립 | act별 자체 톱니 + 게이팅으로 이른 고난도 잠금. `MAP-ACT`·`MAP-GATE` |
| 무한 | 곡선=시간/거리 함수 | 완만 램프(로그/계단) + 휴지. `MAP-INFINITE`·`MAP-MACRO` |

## 출처 · 원칙

- 본 자료는 GDC 강연, GMTK(Game Maker's Toolkit), The Level Design Book, 개발사 포스트모템(Valve·Mega Crit·
  Subset·Supergiant), 학술 논문(Csikszentmihalyi·Dormans·Hull·Nunes&Drèze·Zagal 등)과 디자인 통념을 한글로
  소화·정리한 것이다(법률 자문·학술 인용 아님). **1차 제창자와 대중화한 해설자를 구분**해 표기한다(예: flow
  채널=Csikszentmihalyi 1975, 게임 적용=Jenova Chen 2006 / 락앤키=장르 관행, 그래프 가시화=Mark Brown).
- **IP 안전 원칙:** 맵디자인 *원칙·기법·위상*은 저작권 보호 대상이 아니므로 자유롭게 차용한다. 단, 특정 상용
  게임의 **고유 맵 레이아웃**(Candy Crush 특정 사가맵, Mario 특정 오버월드 등)을 그대로 복제하지 않는다 —
  기법만 가져와 절차생성/오리지널 배치로 재구성한다. 상세는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
