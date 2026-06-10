# 게임 DNA · 퍼즐 심화 라이브러리 — 색인 (INDEX)

> 잘 선별한 **퍼즐 게임 35종**(디지털 퍼즐 20 + 유명 퍼즐 보드게임 15)의 **재미 요소·메카닉**을 심화 분석해, WebGameForge `puzzle-game`이 새 퍼즐을 설계할 때 쓰는 **템플릿/조합 자료**다.
> 목적: 사용자에게 "어떤 퍼즐 만들지" 물을 때 검증된 재미를 제안하고, 여러 퍼즐의 재미 요소를 **조합해 새 퍼즐에 녹이는** 것.
> 분석 대상은 **메카닉·재미뿐** — 이름·스프라이트·음악·고유 레벨 등 저작물은 절대 쓰지 않는다(각 파일의 IP 안전 메모 참고).
> 전역(비-퍼즐 포함) 게임 DNA 색인은 [../INDEX.md](../INDEX.md).

## 이 라이브러리를 쓰는 법 (중요)

- 자동 트리거 스킬이 아니다. frontmatter 없는 **온디맨드 Read** 레퍼런스(스킬 listing 예산 0). 필요할 때만 해당 파일을 읽는다.
- **퍼즐 제작 명확화 단계**(`wgf-web-game-builder/SKILL.md` "0) 요청 명확화", `wgf-puzzle-game/SKILL.md` 0번 레시피, `commands/wgf-make-game.md`)에서 의사결정 도구로 쓴다. 흐름은 **[fun-elements.md](./fun-elements.md) §4 퍼즐 조합 설계법**에 4단계로 정의돼 있다:
  1. **퍼즐 하위장르/아키타입 제시** — 11종 코어(낙하/매치/병합/연역/공간/물리/규칙 + 보드게임 계열 드래프트/패킹/기입(롤앤라이트)/세트)에서 검증된 레시피 3~4개를 `AskUserQuestion` 옵션으로.
  2. **강조할 재미요소 선택** — 코어에 잘 붙는 `FE-*` 태그 2~3개를 묻고, 안티패턴(§3)을 내부 가드로 적용.
  3. **조합 설계** — 코어 1개 + 재미요소 2~3개로 레시피 조립(+ 아트 스타일·테마·분량 확정).
  4. **puzzle-game 스킬 라우팅** — 코어별 보드모델 스캐폴드 지정 + 재미요소별 제작요소 스킬 부가 호출.
- 코드 전, 만들 퍼즐과 가까운 **하위장르 파일 1~2개 + fun-elements.md**를 읽어 보드모델·재현 노트·IP 안전 메모를 반영한다.

## 게임 → 하위장르 → 스킬 라우팅 (35종)

모든 퍼즐은 `puzzle-game` 스킬로 라우팅(보드모델/렌더 분리 원칙). `재현` 열: ✅ 충실 재현 · ⚠️ 단순화(Matter·서버/콘텐츠 축소 등) 필요 · ❌ 핵심 불가(로컬 단일플레이 축소만).

### [falling-action.md](./falling-action.md) — 낙하 · 실시간 액션 퍼즐
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Tetris (1984) | 테트로미노를 빈틈없이 쌓아 가로줄 소거 | `FE-SPATIAL` `FE-FLOW` `FE-MASTERY` | ✅ |
| Puyo Puyo (1991) | 같은 색 4+ 인접 소거 → 무너짐 연쇄 | `FE-COMBO` `FE-MASTERY` `FE-AHA` | ✅ |
| Dr. Mario (1990) | 2색 알약으로 바이러스와 같은 색 4연결 소거 | `FE-SPATIAL` `FE-COMBO` `FE-PLANNING` | ✅ |
| Lumines (2004) | 2x2 같은 색 사각형을 타임라인 스윕으로 지연 소거 | `FE-TIMING` `FE-PLANNING` `FE-COMBO` | ✅ |
| Puzzle Bobble (1994) | 색 버블 조준·반사 발사로 3+ 매치 소거 | `FE-SPATIAL` `FE-COMBO` `FE-ESCALATION` | ⚠️ |

### [match-merge.md](./match-merge.md) — 매치 · 병합 퍼즐
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Bejeweled (2001) | 인접 스왑 3+ 매치 → 소거·낙하·리필 캐스케이드 | `FE-COMBO` `FE-AHA` `FE-JUICE` | ✅ |
| Candy Crush Saga (2012) | 제한 이동 수 안에서 스왑·캐스케이드로 목표 달성 | `FE-COMBO` `FE-CONSTRAINT` `FE-PLANNING` | ⚠️ |
| Puzzle & Dragons (2012) | 구슬 하나를 끌고 다니며 보드 재배열 → 일괄 매치=데미지 | `FE-COMBO` `FE-PLANNING` `FE-MASTERY` | ⚠️ |
| 2048 (2014) | 방향 슬라이드로 같은 수를 합쳐 더 큰 수로 | `FE-CONSTRAINT` `FE-PLANNING` `FE-AHA` | ✅ |
| Threes (2014) | 한 칸씩 시프트하며 1+2·동수 배수 병합 | `FE-CONSTRAINT` `FE-PLANNING` `FE-OPTIMIZE` | ✅ |

### [logic-deduction.md](./logic-deduction.md) — 논리 · 연역 퍼즐
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Sudoku | 행·열·박스 제약 교차로 빈 칸을 유일해로 채움 | `FE-DEDUCTION` `FE-CONSTRAINT` `FE-AHA` | ✅ |
| Picross (Nonogram) | 행·열 단서 연역으로 칠/X 후 도트 그림 리빌 | `FE-DEDUCTION` `FE-HIDDEN-INFO` `FE-COLLECT` | ✅ |
| Minesweeper | 인접 지뢰 수 단서로 안전·지뢰 칸 연역 | `FE-DEDUCTION` `FE-HIDDEN-INFO` `FE-RISK-REWARD` | ✅ |
| Wordle | 글자별 3색 피드백으로 6번 안에 단어 연역 | `FE-DEDUCTION` `FE-CONSTRAINT` `FE-SOCIAL` | ✅ |
| Flow Free (2012) | 색 점을 드래그로 잇고 보드를 빈칸 없이 채움 | `FE-SPATIAL` `FE-FLOW` `FE-ELEGANCE` | ✅ |

### [spatial-physics.md](./spatial-physics.md) — 공간 · 물리 · 규칙 퍼즐
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Sokoban (1982) | 한 칸씩 상자를 밀어 모든 목표칸에 정렬 | `FE-PLANNING` `FE-SPATIAL` `FE-FAIRNESS` | ✅ |
| Baba Is You (2019) | 'NOUN IS PROPERTY' 단어블록을 밀어 규칙을 다시 씀 | `FE-RULE-DISCOVERY` `FE-EMERGENCE` `FE-AHA` | ✅ |
| Monument Valley (2014) | 등각 구조물을 회전·슬라이드해 착시로 길을 이음 | `FE-AHA` `FE-SPATIAL` `FE-ELEGANCE` | ⚠️ |
| Lemmings (1991) | 자동 보행 군집에 제한 역할을 배정해 정족수 구출 | `FE-CONSTRAINT` `FE-PLANNING` `FE-TIMING` | ⚠️ |
| Cut the Rope (2010) | 밧줄을 타이밍 맞춰 잘라 진자·풍선으로 사탕을 입에 | `FE-AHA` `FE-TIMING` `FE-CONSTRAINT` | ⚠️ |

### [board-draft-pattern.md](./board-draft-pattern.md) — 보드게임: 드래프트 · 패턴 빌딩
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Azul (2017) | 공장 드래프트로 같은 색 타일을 모아 벽 패턴 완성, 못 쓴 타일은 바닥줄 감점 | `FE-DRAFT` `FE-PACKING` `FE-RISK-REWARD` | ✅ |
| Sagrada (2017) | 굴린 주사위를 드래프트해 색/값 인접 제약의 창에 배치 | `FE-DRAFT` `FE-LUCK-TAME` `FE-CONSTRAINT` | ✅ |
| Kingdomino (2016) | 도미노 드래프트(좋은 타일=다음 턴 후순위)로 5×5 왕국 짓고 영역×왕관 채점 | `FE-DRAFT` `FE-PACKING` `FE-PLANNING` | ✅ |
| Cascadia (2021) | 타일+동물토큰 페어 드래프트로 서식지 잇고 동물별 패턴 채점 | `FE-DRAFT` `FE-PACKING` `FE-SET-LOGIC` | ✅ |
| Take It Easy (1983) | 전원 같은 헥스 타일을 각자 보드에 동시 배치해 라인 완성 | `FE-LUCK-TAME` `FE-PACKING` `FE-PLANNING` | ✅ |

### [board-packing.md](./board-packing.md) — 보드게임: 폴리오미노 · 패킹
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Patchwork (2014) | 중립 토큰 시장에서 천 조각을 사 9×9 퀼트에 패킹, 버튼 경제·빈칸 감점 | `FE-PACKING` `FE-DRAFT` `FE-OPTIMIZE` | ✅ |
| Blokus (2000) | 21개 폴리오미노를 꼭짓점만 맞닿게 영토 확장, 남은 조각 감점 | `FE-PACKING` `FE-SPATIAL` `FE-PLANNING` | ⚠️ |
| Ubongo (2003) | 제한 시간 안에 폴리오미노로 퍼즐 영역을 빈틈없이 채우는 스피드 패킹 | `FE-PACKING` `FE-SPATIAL` `FE-LUCK-TAME` | ✅ |
| NMBR 9 (2017) | 전원 동일 뽑기로 숫자 타일을 층층이 쌓아 위층일수록 배점 | `FE-PACKING` `FE-LUCK-TAME` `FE-OPTIMIZE` | ✅ |
| Project L (2020) | 폴리오미노로 퍼즐 카드를 채워 보상 조각이 조각을 낳는 엔진 빌딩 | `FE-PACKING` `FE-BUILD` `FE-COMBO` | ⚠️ |

### [board-set-rollwrite.md](./board-set-rollwrite.md) — 보드게임: 세트 · 재배열 · 롤앤라이트
| 게임 | 코어 | 대표 재미요소 | 재현 |
|---|---|---|---|
| Rummikub (1977) | 손패로 런·그룹 세트를 만들되 테이블 전면을 합법 상태로 재배열 | `FE-REARRANGE` `FE-SET-LOGIC` `FE-PLANNING` | ⚠️ |
| SET (1991) | 4속성×3값 81장에서 '모두 같거나-모두 다른' 세트를 실시간 식별 | `FE-SET-LOGIC` `FE-DEDUCTION` `FE-FLOW` | ✅ |
| Qwirkle (2006) | 색/모양 라인 빌딩, 같은 속성 라인에 중복 금지, 6완성 보너스 | `FE-SET-LOGIC` `FE-SPATIAL` `FE-OPTIMIZE` | ⚠️ |
| Ganz schön clever (2018) | 주사위 드래프트로 5색 시트에 기입, 기입이 기입을 부르는 콤보 체인 | `FE-LUCK-TAME` `FE-COMBO` `FE-DRAFT` | ✅ |
| Railroad Ink (2018) | 공유 주사위 결과를 자기 7×7 보드에 철도/도로 경로로 그려 출구 잇기 | `FE-LUCK-TAME` `FE-PACKING` `FE-OPTIMIZE` | ✅ |

> ⚠️ 사유 요약: Puzzle Bobble(연속 각도 벽반사 예측은 격자 기반이 아님→직선/단순반사로 축소), Candy Crush·Puzzle & Dragons(서버 라이브 메타·수천 스테이지→로컬 베스트·15~30 손제작 레벨로 축소), Monument Valley(등각 착시·미려한 아트는 손제작 레벨 의존), Lemmings(실시간 자율 군집→턴제 N틱 일괄 시뮬레이션 단순화), Cut the Rope(정밀 강체/밧줄은 Matter ⚠️→단순 임펄스·진자 근사). **보드게임 ⚠️ 4종은 모두 '다인 인터랙션이 코어 재미의 큰 축'이 사유** — Blokus(영토 견제→AI 경쟁자 필수), Project L(다인 레이스·콘텐츠 규모→솔로 Automa식 축소), Rummikub(턴 경쟁·손패 숨김→AI 상대 또는 솔리테어 변형), Qwirkle(상대 라인 활용 견제→AI/데일리 축소). 순수 ❌(아예 불가)은 0종이며 모든 퍼즐의 **핵심 재미는 차용 가능**하다.

## 퍼즐 재미요소 사전 빠른 색인 — 자세한 정의는 [fun-elements.md](./fun-elements.md) §1

**퍼즐 특화(13):** `FE-DEDUCTION`(연역·소거) · `FE-RULE-DISCOVERY`(규칙 발견) · `FE-ELEGANCE`(우아한 해) · `FE-SPATIAL`(공간 추론) · `FE-PLANNING`(선계획·멀티스텝) · `FE-TRANSFORM`(변환·되돌리기) · `FE-HIDDEN-INFO`(숨은 정보) · `FE-OPTIMIZE`(최적화) · `FE-DRAFT`(드래프트·시장 선택) · `FE-PACKING`(패킹·빈틈 경제) · `FE-LUCK-TAME`(운 길들이기) · `FE-REARRANGE`(판 재구성) · `FE-SET-LOGIC`(같음·다름 세트)

**공통(퍼즐 맥락 재서술):** `FE-COMBO`(연쇄·콤보) · `FE-AHA`(통찰·아하) · `FE-CONSTRAINT`(제약) · `FE-JUICE`(감각 피드백) · `FE-TIMING`(타이밍·리듬) · `FE-RISK-REWARD`(위험-보상) · `FE-FAIRNESS`(공정함) · `FE-EMERGENCE`(창발) · `FE-JUST-ONE-MORE`(한 판 더) · `FE-ESCALATION`(점증 압박) · `FE-COLLECT`(수집·성장) · `FE-MASTERY`(숙련 표현) · `FE-NARRATIVE`(서사·분위기)

## 퍼즐 조합 레시피 빠른 색인 — 자세한 내용은 [fun-elements.md](./fun-elements.md) §2

연역 낙하 · 규칙발견 매치 · 병합 하이스코어 · 공간 푸시 머리싸움 · 물리 절단 별점 · 숨은정보 매치 2단 · 리듬 스윕 소거 · 경로 잇기 최적화 · 연역 그리드 데일리 · 변환 탐색 룸 · 군집 호위 제약 · 낙하 색연쇄 머리싸움 · 착시 공간 명상 · 조준 매치 캐스케이드 · **(보드게임 계열)** 드래프트 패턴 벽 · 주사위 창문 제약 · 데일리 같은뽑기 솔리테어 · 패킹 경제 · 콤보 기입 시트 · 테이블 대수술 — 그리고 **섞지 말 것**은 [fun-elements.md](./fun-elements.md) §3 안티패턴(연역+실시간가속, 우아한해+강RNG, 순수연역+운베팅, 명상형+과한주스, 되돌릴수없는한수+무제한undo, 서버라이브메타, 드래프트+경쟁자부재솔로, 다축채점과적+캐주얼첫판).

## 범위 밖 — 단일플레이 웹 전제로 축소되는 부분

WebGameForge는 **2D · 단일플레이 · 웹/모바일웹뷰 · 절차적(CC0) 에셋 · 서버 없음**이 범위다. 퍼즐의 다음 요소는 ❌ → 로컬 축소 재현한다.

- **서버 라이브 운영 메타** (Candy Crush·Puzzle & Dragons의 일일 글로벌 랭킹·라이프 충전·수천 스테이지 동기화·시즌 이벤트) → localStorage 베스트 · 해금 트리 · 15~30개 손제작 레벨 + 난도 파라미터 곡선.
- **실시간 글로벌 경쟁/친구 비교** → 로컬 리더보드 · 고스트 셀프경쟁 · 시드 공유(`?seed=`) · 결과 이모지 클립보드 공유(`FE-SOCIAL`은 '자랑'까지 보존).
- **정밀 강체/밧줄 물리** (Cut the Rope) → Matter(⚠️) 대신 단순 임펄스·진자 근사로 결정성·신뢰도 확보.
- **연속 각도 벽반사 예측** (Puzzle Bobble) → 격자 안착 + 직선/단순 반사로 축소.
- **멀티플레이 보드게임의 대인 상호작용** (Azul·Kingdomino의 드래프트 견제, Blokus의 영토 다툼, Rummikub의 턴 경쟁) → 휴리스틱 AI 경쟁자(탐욕 1수 평가, '왜 가져갔는지' 읽히게) · '남긴 것이 비용'이 되는 솔로 변형 규칙 · 날짜 시드 데일리 비동기 경쟁(모두 같은 뽑기 + 결과 이모지 공유) 중 하나로 축소(필수 — 드래프트+경쟁자 부재는 §3 안티패턴).
- **물리 구성물의 촉각** (타일 집기·주사위 굴림·조각 맞춤의 손맛) → 드래그&드롭 + 셀 스냅, juice-fx '딱 맞는' 스냅 팝, ChipAudio 굴림음·찰칵음으로 디지털 손맛 재현.

## 출처 · 원칙

- 잘 알려진 퍼즐 게임의 공개된 게임플레이·메카닉·디자인 통념을 정리한 것이다(법률 자문 아님).
- **IP 안전:** 메카닉·재미·장르는 저작권 보호 대상이 아니므로 자유 차용. 이름('Tetris'·'Wordle' 등은 상표)·스프라이트·로고·BGM/SFX·고유 레벨은 복제 금지, 전부 `PixelForge`/`VectorForge`/`ChipAudio` 절차 생성 오리지널로 환기. 상세는 각 파일의 **IP 안전 메모** 및 [`ip-license-guard`](../../../../wgf-ip-license-guard/SKILL.md).
