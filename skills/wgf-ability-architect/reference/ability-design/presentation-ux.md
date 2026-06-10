# 제시·UX — 능력을 한눈에 읽히게 + 아이콘 생성 (`UX-*`)

> 능력은 *보여야* 쓴다. 스킬바·쿨다운·자원 상태가 한눈에 읽히고, 아이콘이 작은 화면에서 무엇인지 말하고, 엄지로 굴릴 수
> 있어야 한다. 인터뷰 A9(비주얼 슬롯)·A5(입력). HUD/UI 구현은 [`game-ui-hud`](../../../wgf-game-ui-hud/SKILL.md), 아이콘 생성은 sprite 스킬.

---

## `UX-DESC-SLOTS` — 비주얼은 묘사가 아니라 슬롯으로 (아이콘 핸드오프) (북극성)
좋은 능력 아이콘의 전제는 *충분한 묘사*다. 산문 한 줄("멋진 불 스킬")은 생성 도구가 매번 다르게 그린다. 각 능력의 `visual.*` 고정 슬롯을 채워 어떤 생성 경로든 같은 입력을 결정론적으로 소비하게 한다.

| 슬롯 | 무엇 | 예 |
|---|---|---|
| `silhouette` | 외곽 한 단어(실루엣 우선) | "방사형 폭발", "낮은 유선형", "초승달 호" |
| `material` | 재질/원소 | 불·얼음·강철·전기·그림자·빛·독 |
| `palette` | §8 master_palette 참조(자유 hex 금지) | "적황 그라디언트", "한기 청록" |
| `focal_motif` | 이 아이콘이 말하는 단 하나 | "점화 순간", "중심 섬광" |
| `vfx_motif` | 발동 시 화면 이펙트의 결 | "방사 파편", "잔상 꼬리" |
| `telegraph_read` | (적/위험 능력) 적이 보고 피하는 단서 | "바닥 붉은 원 0.5s" |
| `rarity_visual` | 등급/궁극 강조(색 단독 금지) | "금테 + 코너 핍 + 글로우" |
| `lighting` | 광원(기본 NW 상속) | "NW" |

**어댑터:** 이 한 블록이 → [`sprite-forge`](../../../wgf-sprite-forge/SKILL.md)(픽셀 팔레트·프레임 시드) / [`vector-graphics`](../../../wgf-vector-graphics/SKILL.md)(베지어·글로우·재질 램프 명세) / [`sprite-picker`](../../../wgf-sprite-picker/SKILL.md)(태그·contentType·style 검색쿼리 + 대상 슬롯) 입력으로 변환된다.

## `UX-SILHOUETTE-FIRST` — 실루엣 먼저, 작은 크기 진실
능력 아이콘은 32~48px 작은 스킬바에서 *실루엣만으로* 구분돼야 한다. 색을 빼도 무엇인지 읽히게(색각·작은 화면). 디테일보다 윤곽·focal_motif.

## `UX-SKILLBAR` — 스킬바: 능력을 한 줄에
액티브 능력을 스킬바(아이콘 + 쿨다운 + 자원)로 한곳에 모은다. 순서·위치 고정(근육 기억). 모바일은 엄지 영역, 데스크톱은 화면 하단. T1(능력 1개)은 스킬바 불필요(버튼 힌트만).

## `UX-COOLDOWN-VIZ` — 쿨다운 시각화
쿨다운은 *남은 시간이 보이게* — 방사형 스윕(`AbilityKit.cooldownFrac()`) + 준비 완료 시 번쩍임/소리. 숫자 카운트다운은 보조. "언제 다시 쓰나"가 한눈에.

## `UX-RESOURCE-VIZ` — 자원 시각화
자원(마나/스태미나)은 바/구슬로 항상 보이게. 능력 비용을 자원바에 *미리보기*(이 능력 쓰면 여기까지 줄어듦)하면 관리가 쉽다. 부족하면 붉게(거부 피드백 `FEEL-FEEDBACK-CLARITY`).

## `UX-BUTTON-BUDGET` — 모바일 버튼 예산 (북극성)
화면에 *배치*할 수 있는 능력 버튼은 **3~4개**가 상한이지만, **동시에 *누를* 수 있는 건 엄지 2개가 물리 하드 상한**이다. 이동에 가상 스틱/D-패드를 쓰면 한 엄지가 점유되므로 **동시 능력 입력은 사실상 0~1개** — 능력은 *이산 탭*(연타 아님)으로 설계하고, 자동공격/자동발동으로 한 엄지를 비운다(트윈스틱이면 양엄지 점유, 능력은 짧은 탭으로 끼워넣기). 버튼이 예산을 넘으면 라디얼 메뉴·컨텍스트 입력(상황별 같은 버튼이 다른 능력, `SCOPE-DEPTH-NOT-BREADTH`)·근접 자동발동으로 흡수. 데스크톱은 키가 많아 여유(lint `input-budget` warn).

## `UX-THUMB-ZONE` — 엄지 영역·탭타겟
능력 버튼은 엄지가 닿는 화면 하단 모서리에, 충분히 큰 탭타겟(≥44px)으로. 작은/먼 버튼은 오발. 이동 스틱과 능력 버튼이 안 겹치게([`virtual-joystick`](../../../wgf-virtual-joystick/SKILL.md)·MobileHarness).

## `UX-TELEGRAPH-READ` — 텔레그래프 가독성
적 능력·위험 장판은 *명확히* 보여야 회피가 공정(`FEEL-TELEGRAPH`·`BAL-FAIR-ENEMY-ABILITY`). `visual.telegraph_read` 슬롯의 단서를 juice/그래픽으로 구현 — 색·모양·시간이 "여기 위험, N초 후"를 말하게.

## `UX-TOOLTIP-PROGRESSIVE` — 점진적 툴팁
능력 설명은 *필요한 만큼*만 — 한 줄 요약(항상) → 길게 누르면 상세(수치·시너지). 작은 화면에 수치를 다 띄우면 가린다. 드래프트 카드엔 핵심 한 줄 + 아이콘.

## `UX-RARITY-MULTI-CHANNEL` — 등급/궁극은 다채널
능력 등급(일반/희귀/궁극)을 색 *단독*으로 표시하면 색각·작은 화면에서 안 읽힌다 — 색 + 테두리 + 코너 핍 + 글로우 다채널(`visual.rarity_visual`).

## `UX-ACCESSIBILITY` — 접근성
- 색각: 등급·원소를 색 단독으로 부호화하지 않기(모양·아이콘 병행).
- 입력: hold/charge 능력에 토글 대안(접근성 옵션). 빠른 콤보에 입력 버퍼 관대(`FEEL-BUFFER`).
- 가독: 텍스트 대비·크기, 핵심 정보는 아이콘+텍스트 이중.

## `UX-MIN-CLUTTER` — 최소 잡음
HUD에 능력 정보가 과하면 게임 화면을 가린다. 핵심(쿨다운·자원)만 상시, 나머지는 온디맨드. 짧은 세션일수록 화면을 비운다(`SCOPE-READABILITY-CAP`).

---

## §8 스타일가이드 헤더 상수 (한 게임 한 스타일)
모든 능력 아이콘이 상속하는 상수를 ABILITIES.md §8에 둔다: `master_palette`(능력 공통 팔레트) · `role_colors`(주력/생존/이동/CC/버프 색) · `ultimate_accent`(궁극 강조) · `lighting`(광원 방향) · `display_px`(스킬바 크기) · `kind_grammar`(kind별 시각 문법 — 액티브=꽉 찬, 패시브=은은한 외곽 등). visual.* 슬롯이 이 상수를 참조해 일관성 유지.
> **master_palette 상류 권위(D6):** `master_palette`/`assets/palette.master.json`은 상류 디렉터 [`style-architect`](../../../wgf-style-architect/SKILL.md)(`style.json`)이 정한다 — `games/<slug>/style.json`이 있으면 §8은 이를 **상속**(능력 아이콘이 게임 전체 룩과 응집), 없으면 §8이 위 상수를 **인라인 정의**(하위호환, 기존 동작 그대로).

## 기계 검증 훅 (lint-abilities.mjs)
- `visual.*` 필수 슬롯 미채움 → `schema` warn(아이콘 품질 저하).
- 동시 바인딩 액티브 슬롯 > 버튼 예산 → `input-budget` warn(`UX-BUTTON-BUDGET`).

## 출처
- 스킬바·쿨다운/자원 시각화·모바일 버튼 예산·엄지 영역·툴팁·접근성·등급 다채널(MOBA/ARPG/모바일 UI 통념)을 작은 2D 웹게임·아이콘 생성 핸드오프용으로 정리. 상세: `.omc/research/ability-system-research-dossier.md`. item-architect `visual-inventory-ux.md`의 visual.* 슬롯·실루엣·등급 다채널을 능력 아이콘 도메인으로 적응.
