# 정체성·판타지 — 능력이 "내가 누구인가"를 말한다 (`IDENT-*`)

> 능력은 숫자가 아니라 *판타지*다. "이 능력을 쓸 때 나는 누구인가" — 그림자 암살자인가, 화염 마법사인가, 날렵한 곡예사인가.
> 능력이 캐릭터·서사·코어 동사와 같은 말을 할 때 몰입한다. 인터뷰 A9. 톤·이름은 [`story-architect`](../../../wgf-story-architect/SKILL.md) STORY.md 상속.

---

## `IDENT-FANTASY-FIRST` — 판타지를 먼저, 수치는 나중 (북극성)
능력을 "+20 대미지"가 아니라 *판타지*로 먼저 구상한다 — "적들 사이로 순간이동해 베고 사라진다". 판타지가 정해지면 수치·자원·게임필이 그것을 *구현*한다. 수치부터 짜면 영혼 없는 스탯 덩어리가 된다.

## `IDENT-VERB-OVER-STAT` — 동사 > 스탯 (북극성)
최고의 능력은 새 *동사*(할 수 있는 일)를 준다, 스탯이 아니라. 점프 게임의 최고 능력은 +5 방어가 아니라 더블점프. 동사는 플레이를 바꾸고, 스탯은 숫자만 바꾼다. 패시브조차 "대시가 적을 관통한다"처럼 동사를 변형하게.

## `IDENT-LUDO-HARMONY` — 능력이 코어 동사·주제와 같은 말 (북극성)
능력 효과·이름·외형이 게임의 코어 동사·톤·서사와 *조화*해야 한다(ludonarrative harmony). 평화로운 정원 게임에 살상 궁극기, 잠입 게임에 화려한 폭발은 불협. STORY.md 톤을 상속해 능력의 결을 맞춘다.
- **smallWebGame:** STORY.md `## 8. Glossary`에서 세계관 어휘를 빌려 능력 이름·flavor를 짓는다.

## `IDENT-MASTERY-EXPRESSION` — 숙련 표현의 여지
능력에 *잘 쓰는 법*이 있어야 한다 — 차지량·조준 각도·콤보 타이밍·캔슬. 같은 능력도 숙련자가 더 잘 쓰면 그게 실력 표현(`FE-MASTERY`). 모든 게 자동·즉발이면 표현의 여지가 없다.
- **smallWebGame:** `charge`/`aim`/`combo` 입력이 숙련 표현의 싼 원천(`KIT-INPUT-TYPE`·`FEEL-*`).

## `IDENT-SELF-EXPRESSION` — 빌드가 곧 자기표현
능력 선택(빌드·스킬트리)이 *플레이어의 스타일*을 드러내게 한다 — 공격적 vs 신중한, 화염 vs 빙결. 빌드가 "내 캐릭터"라는 소유감(`FE-EXPRESSION`)을 만든다. 의미 있는 분기(`PROG-MEANINGFUL-CHOICE`)가 전제.

## `IDENT-SIGNATURE-ABILITY` — 시그니처 능력 4요소
킷의 정체성을 응축한 시그니처 능력 1개를 둔다. 4요소로 설계: **이름**(환기형) · **실루엣**(한눈에 알아보는 외형) · **발동 동사**(무엇을 하나) · **순간**("이걸 쓸 때 나는 누구"의 한 컷). 플레이어가 "이 게임 = 그 능력"으로 기억하게(`KIT-SIGNATURE-CORE`).

## `IDENT-NAME-EVOCATIVE` — 환기형 명명
능력 이름은 기능 설명("3초 무적")이 아니라 *환기*("불사의 한 순간", "그림자 발걸음")로. 이름이 판타지를 부른다. 단 기능이 이름에서 *추측 가능*해야(완전 추상은 혼란). 오리지널(상용 게임 고유명 복제 금지, `ip-license-guard`).

## `IDENT-CONSISTENT-VOICE` — 일관된 보이스
모든 능력 이름·flavor가 한 목소리(STORY.md 톤)를 공유한다 — 진지한 게임엔 진지한 이름, 코믹엔 코믹. 한 능력만 톤이 튀면 몰입이 깨진다. flavor는 [`story-architect`](../../../wgf-story-architect/SKILL.md)와 정합.

## `IDENT-THEME-FAMILY` — 테마 패밀리
능력들을 테마 패밀리로 묶는다(불 계열·그림자 계열·기계 계열) — 같은 패밀리는 비주얼·이름·효과가 가족처럼 닮는다. 패밀리가 곧 시너지 태그(`SYN-TAG-COHESION`)·빌드 정체성. 시각 일관성은 §8 스타일가이드.

## `IDENT-CONSTRAINED-KIT` — 절제된 킷이 정체성을 만든다
모든 걸 하는 만능 킷은 정체성이 없다. *못 하는 것*이 캐릭터를 정의한다 — "근접만, 대신 강하다", "약하지만 빠르다". 의도적 약점이 빌드 선택과 캐릭터성을 만든다(`KIT-MINIMAL-KIT`·`BAL-NICHE`).

---

## 인터뷰에서 (A9)
- **챌린지 모드 Signature:** "플레이어가 *어떤 능력*을 처음 썼을 때 '오!' 하고 멈췄으면 하나요?" — 그 한 능력의 4요소를 먼저 못 박고 나머지를 받쳐 설계.
- **비주얼 슬롯 채움:** signature·각 능력의 `visual.*`(실루엣·재질·팔레트·focal_motif·vfx_motif)을 채워 아이콘 핸드오프 준비([presentation-ux.md](./presentation-ux.md) `UX-DESC-SLOTS`).

## 기계 검증 훅 (lint-abilities.mjs)
- 정체성은 정성적이라 직접 검증은 적으나, `visual.*` 슬롯 채움(`schema`)·태그 응집(`synergy`)이 간접 신호. ludo 조화·이름 톤은 수동 점검.

## 출처
- 능력 판타지·동사>스탯·ludonarrative 조화·숙련 표현·자기표현·시그니처·환기형 명명(액션/RPG 디자인 통념)을 작은 2D 웹게임·STORY.md 정합용으로 정리. 상세: `.omc/research/ability-system-research-dossier.md`. item-architect `identity-narrative.md`의 동사>스탯·미니캐릭터·테마 패밀리를 능력 도메인으로 적응.
