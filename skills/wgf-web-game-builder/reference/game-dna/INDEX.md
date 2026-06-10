# 게임 DNA 레퍼런스 라이브러리 — 색인 (INDEX)

> 지난 10여 년간 많은 사람이 플레이한 **인기 2D 게임**의 **재미 요소·메카닉**을 분석해, WebGameForge(`web-game-builder`)가 새 게임을 설계할 때 쓰는 **템플릿/조합 자료**다. 전 장르 29작 + **퍼즐 심화 35작**(디지털 퍼즐 20 + 퍼즐 보드게임 15, [puzzle/](./puzzle/INDEX.md) 서브라이브러리) = 64작.
> 핵심 목적: 사용자에게 "어떤 게임 만들지" 물을 때 이 자료로 **검증된 재미를 제안**하고, 여러 게임의 재미 요소를 **조합해 새 게임에 녹이는** 것.
> 분석 대상은 **메카닉·재미뿐**이다 — 이름·캐릭터·스프라이트·음악 등 저작물은 절대 쓰지 않는다(각 파일의 IP 안전 메모 참고).

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산(컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`와 같은 **온디맨드 Read** 방식. 필요할 때만 해당 파일을 읽는다.
- **게임 제작 명확화 단계**(`wgf-web-game-builder/SKILL.md`의 "0) 요청 명확화", `commands/wgf-make-game.md`)에서 의사결정 도구로 쓴다. 흐름은 **[fun-elements.md](./fun-elements.md) §4 조합 설계법**에 4단계로 정의돼 있다:
  1. **템플릿 아키타입 제시** — 요청이 모호하면 검증된 조합 레시피 3~4개를 `AskUserQuestion` 옵션으로.
  2. **강조할 재미요소 선택** — 코어 루프에 잘 붙는 `FE-*` 태그 2~3개를 묻고, 안티패턴을 내부 가드로 적용.
  3. **조합 설계** — 코어 루프 1개 + 재미요소 2~3개로 레시피를 조립(+ 아트 스타일·테마·분량 확정).
  4. **장르 스킬 라우팅** — 확정된 코어 루프를 장르 스킬로, 재미요소를 제작요소 스킬로 잇는다.
- 코드를 짜기 전, 만들기로 한 게임과 가장 가까운 **장르 파일 1~2개 + fun-elements.md**를 읽어 메카닉·재현 노트·IP 안전 메모를 반영한다.

## 게임 → 장르 파일 → 스킬 라우팅

각 게임은 **메카닉/재미만** 차용한다. `재현` 열: ✅ 충실 재현 · ⚠️ 단순화(Matter·콘텐츠 축소 등) 필요 · ❌ 핵심이 불가(단일플레이 축소판만).

### [platformers.md](./platformers.md) — 플랫포머 · 메트로배니아 · 런앤건
| 게임 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|
| Celeste (2018) | `FE-FLOW` `FE-FAIRNESS` `FE-MASTERY` | `platformer-game` | ✅ |
| Hollow Knight (2017) | `FE-EXPLORE` `FE-COLLECT` `FE-MASTERY` | `platformer-game` | ⚠️ |
| Super Meat Boy (2010) | `FE-FLOW` `FE-JUST-ONE-MORE` `FE-FAIRNESS` | `platformer-game` | ✅ |
| Cuphead (2017) | `FE-MASTERY` `FE-TIMING` `FE-FAIRNESS` | `platformer-game` | ⚠️ |
| Shovel Knight (2014) | `FE-MASTERY` `FE-FAIRNESS` `FE-JUICE` | `platformer-game` | ✅ |
| Ori and the Blind Forest (2015) | `FE-FLOW` `FE-EXPLORE` `FE-TENSION` | `platformer-game` | ⚠️ |

### [runners.md](./runners.md) — 러너 · 플래피 · 리듬
| 게임 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|
| Flappy Bird (2013) | `FE-JUST-ONE-MORE` `FE-TENSION` `FE-FAIRNESS` | `endless-runner` | ✅ |
| Geometry Dash (2013) | `FE-TIMING` `FE-MASTERY` `FE-EXPRESSION` | `endless-runner` | ⚠️ |
| Jetpack Joyride (2011) | `FE-FLOW` `FE-COLLECT` `FE-RISK-REWARD` | `endless-runner` | ⚠️ |
| Alto's Odyssey (2018) | `FE-FLOW` `FE-COMBO` `FE-NARRATIVE` | `endless-runner` | ⚠️ |
| Canabalt (2009) | `FE-ESCALATION` `FE-TENSION` `FE-FLOW` | `endless-runner` | ✅ |
| Subway Surfers (2012) | `FE-ESCALATION` `FE-COLLECT` `FE-MASTERY` | `endless-runner` | ⚠️ |

### [arcade-casual.md](./arcade-casual.md) — 아케이드 · 캐주얼 · 하이퍼캐주얼
| 게임 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|
| Snake / Slither.io (계열 1976~ · 2016) | `FE-TENSION` `FE-RISK-REWARD` `FE-JUST-ONE-MORE` | `arcade-classic` | ⚠️ |
| Crossy Road (2014) | `FE-TENSION` `FE-JUST-ONE-MORE` `FE-COLLECT` | `arcade-classic` | ⚠️ |
| Stack (2016) | `FE-TIMING` `FE-COMBO` `FE-ESCALATION` | `arcade-classic` | ✅ |
| Doodle Jump (2009) | `FE-JUST-ONE-MORE` `FE-FLOW` `FE-RISK-REWARD` | `endless-runner` | ✅ |
| Fruit Ninja (2010) | `FE-JUICE` `FE-COMBO` `FE-TENSION` | `arcade-classic` | ✅ |
| Pac-Man (1980) | `FE-TENSION` `FE-RISK-REWARD` `FE-MASTERY` | `arcade-classic` | ✅ |

### [puzzle/](./puzzle/INDEX.md) — 퍼즐 (심화 서브라이브러리, 35종)
> 퍼즐은 **35종 심화 분석 서브라이브러리**(디지털 퍼즐 20 + 퍼즐 보드게임 15)로 확장됐다 → **[puzzle/INDEX.md](./puzzle/INDEX.md)**.
> 7개 하위장르 × 5종 + 퍼즐 전용 재미요소 사전·조합 플레이북([puzzle/fun-elements.md](./puzzle/fun-elements.md)).

| 하위장르 | 게임 | 주 스킬 |
|---|---|---|
| [낙하·실시간](./puzzle/falling-action.md) | Tetris · Puyo Puyo · Dr. Mario · Lumines · Puzzle Bobble | `puzzle-game` |
| [매치·병합](./puzzle/match-merge.md) | Bejeweled · Candy Crush · Puzzle & Dragons · 2048 · Threes | `puzzle-game` |
| [논리·연역](./puzzle/logic-deduction.md) | Sudoku · Picross · Minesweeper · Wordle · Flow Free | `puzzle-game` |
| [공간·물리·규칙](./puzzle/spatial-physics.md) | Sokoban · Baba Is You · Monument Valley · Lemmings · Cut the Rope | `puzzle-game` |
| [보드: 드래프트·패턴](./puzzle/board-draft-pattern.md) | Azul · Sagrada · Kingdomino · Cascadia · Take It Easy | `puzzle-game` |
| [보드: 폴리오미노·패킹](./puzzle/board-packing.md) | Patchwork · Blokus · Ubongo · NMBR 9 · Project L | `puzzle-game` |
| [보드: 세트·재배열·롤앤라이트](./puzzle/board-set-rollwrite.md) | Rummikub · SET · Qwirkle · Ganz schön clever · Railroad Ink | `puzzle-game` |

### [shooters-roguelite.md](./shooters-roguelite.md) — 슈터 · 로그라이트
| 게임 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|
| Vampire Survivors (2021) | `FE-POWER-FANTASY` `FE-BUILD` `FE-ESCALATION` | `topdown-shooter` | ⚠️ |
| Brotato (2022) | `FE-BUILD` `FE-POWER-FANTASY` `FE-RISK-REWARD` | `topdown-shooter` | ⚠️ |
| The Binding of Isaac (2011) | `FE-BUILD` `FE-SURPRISE` `FE-RISK-REWARD` | `topdown-shooter` | ⚠️ |
| Enter the Gungeon (2016) | `FE-TENSION` `FE-MASTERY` `FE-SURPRISE` | `topdown-shooter` | ⚠️ |
| Geometry Wars (2003) | `FE-JUICE` `FE-COMBO` `FE-ESCALATION` | `topdown-shooter` | ✅ |
| Nuclear Throne (2015) | `FE-JUST-ONE-MORE` `FE-BUILD` `FE-JUICE` | `topdown-shooter` | ⚠️ |

### [physics-casual.md](./physics-casual.md) — 물리 · 캐주얼 퍼즐 · 기타 메가히트
| 게임 | 대표 재미요소 | 주 스킬 | 재현 |
|---|---|---|---|
| Angry Birds (2009) | `FE-AHA` `FE-JUICE` `FE-CONSTRAINT` | `arcade-classic` | ⚠️ |
| Cut the Rope (2010) | `FE-AHA` `FE-TIMING` `FE-CONSTRAINT` | `puzzle-game` | ⚠️ |
| Plants vs. Zombies (2009) | `FE-BUILD` `FE-CONSTRAINT` `FE-ESCALATION` | `topdown-shooter` | ✅ |
| Jump King (2019) | `FE-MASTERY` `FE-FAIRNESS` `FE-FLOW` | `platformer-game` | ✅ |
| World of Goo (2008) | `FE-AHA` `FE-EXPRESSION` `FE-TENSION` | `puzzle-game` | ⚠️ |

> ⚠️가 많은 이유: 원작 다수가 **서버 메타(가챠·일일보상·글로벌 랭킹)·대량 콘텐츠·정밀 강체 물리·의사-3D**를 핵심에 두기 때문이다. 우리는 이를 **단일플레이 축소판**(로컬 리더보드·고스트·시드 공유, 단순 임펄스 모델, 사이드/의사-아이소 2D)으로 재해석한다. 그래서 순수 ❌(아예 불가)은 0종이며, 모든 게임의 **핵심 재미는 우리 스택으로 차용 가능**하다. Matter 물리(밧줄·강체)는 ⚠️ — 가능하지만 Arcade 단순 임펄스를 우선한다.

## 재미요소 사전 빠른 색인 — 자세한 정의는 [fun-elements.md](./fun-elements.md) §1

`FE-JUST-ONE-MORE`(한 판 더) · `FE-FLOW`(몰입 흐름) · `FE-MASTERY`(숙련 표현) · `FE-RISK-REWARD`(위험-보상) · `FE-SURPRISE`(변주·무작위) · `FE-COLLECT`(수집·성장) · `FE-COMBO`(연쇄·콤보) · `FE-TIMING`(타이밍·리듬) · `FE-POWER-FANTASY`(파워 판타지) · `FE-TENSION`(긴장·니어미스) · `FE-AHA`(통찰·아하) · `FE-BUILD`(빌드·시너지) · `FE-ESCALATION`(점증 압박) · `FE-EXPRESSION`(자기표현·창의) · `FE-NARRATIVE`(서사·분위기) · `FE-EXPLORE`(탐험·발견) · `FE-JUICE`(감각 피드백) · `FE-SOCIAL`(경쟁·공유) · `FE-FAIRNESS`(공정한 죽음) · `FE-CONSTRAINT`(제약 퍼즐) · `FE-EMERGENCE`(창발·시스템 상호작용)

> **퍼즐 특화 재미요소 13종** — `FE-DEDUCTION`·`FE-RULE-DISCOVERY`·`FE-ELEGANCE`·`FE-SPATIAL`·`FE-PLANNING`·`FE-TRANSFORM`·`FE-HIDDEN-INFO`·`FE-OPTIMIZE` + 보드게임 계열 `FE-DRAFT`·`FE-PACKING`·`FE-LUCK-TAME`·`FE-REARRANGE`·`FE-SET-LOGIC`은 [puzzle/fun-elements.md](./puzzle/fun-elements.md)에서 정식 정의한다(전역 21종을 퍼즐 도메인으로 확장).

## 조합 레시피 빠른 색인 — 자세한 내용은 [fun-elements.md](./fun-elements.md) §2

리듬 정밀 러너 · 불릿헤븐 러너 · 매치3 무기 장전 슈터 · 제약 물리 발사 퍼즐 · 규칙조작 그리드 퍼즐 · 역전 푸시유어럭 호퍼 · 수직 빌드 점퍼 · 점증 스택 타워 · 분위기 트릭 콤보 보더 · 닷지롤 탄막 퍼즐 · 등반 머리싸움 퍼즐 — 그리고 **섞지 말 것**은 [fun-elements.md](./fun-elements.md) §3 안티패턴.

## 범위 밖 — 의도적으로 제외한 게임들

WebGameForge는 **2D · 단일플레이 · 웹/모바일웹뷰 · 절차적(CC0) 에셋**이 범위다. 아래는 많이 플레이됐지만 **핵심이 우리 범위 밖**이라 분석 대상에서 제외했다 — 단, 이들의 **개별 재미 요소**(예: 사회적 추리, 수집)는 `FE-*`로 추상화해 차용할 수 있다.

- **Among Us** — 실시간 멀티 소셜 추리(서버·다인 동기화 필수). 단일플레이로는 코어가 성립 안 함.
- **Pokémon GO** — 위치기반 AR(GPS·카메라·서버). 웹 2D 범위 밖.
- **Clash of Clans / Clash Royale** — 실시간 멀티 전략·비동기 PvP(서버 메타 핵심).
- **PUBG Mobile / Fortnite** — 3D 배틀로얄(멀티·3D).
- **Roblox / Minecraft** — 대규모 샌드박스·UGC 서버 플랫폼.

> 이 게임들의 멀티/서버/3D 의존부는 ❌이지만, 떼어낸 재미(추리의 긴장, 덱빌딩의 `FE-BUILD`, 수집의 `FE-COLLECT` 등)는 단일플레이 2D로 재해석 가능하다. 필요 시 fun-elements.md의 조합 설계법으로 끌어온다.

## 출처 · 원칙

- 본 분석은 잘 알려진 상용/인디 2D 게임의 **공개된 게임플레이·메카닉·디자인 통념**을 정리한 것이다(법률 자문 아님).
- **IP 안전 원칙:** 메카닉·장르·재미 요소는 저작권 보호 대상이 아니므로 자유롭게 차용한다. 이름·캐릭터·스프라이트·로고·BGM/SFX·고유 레벨 레이아웃은 절대 복제하지 않고, 전부 `PixelForge`/`VectorForge`/`ChipAudio`로 절차 생성한 오리지널로 환기한다. 상세는 각 장르 파일의 **IP 안전 메모** 및 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
