# 발동·게임필 — 능력을 쓰는 "손맛" (`FEEL-*`)

> 능력의 1차 가치는 *쓸 때의 감각*이다. 같은 +10 대미지도 선딜·후딜·텔레그래프·피드백이 있으면 시원하고 공정하고
> 숙련 가능해진다. 인터뷰 A5. juice/연출은 [`juice-fx`](../../../juice-fx/SKILL.md)·사운드는 [`sound-architect`](../../../sound-architect/SKILL.md)가 구현,
> 이 파일은 *타이밍·입력 구조*를 정한다.

---

## `FEEL-ANTICIPATION` — 선딜·발동·후딜 3박자 (북극성)
모든 의미 있는 능력은 **선딜(anticipation/windup) → 발동(active) → 후딜(recovery)**의 3박자를 가진다(`abilities.json`의 `cast`/`active`/`recovery`).
- **선딜**: "지금 시작했다"를 알리는 준비 동작. 큰 능력일수록 길게(리스크·텔레그래프). 0이면 즉발(가볍고 반응적).
- **발동**: 효과가 실제로 나가는 구간.
- **후딜**: 발동 뒤 잠시 무방비. *커밋*을 만든다 — "썼으니 잠깐 책임진다". 후딜이 없으면 리스크·리듬·카운터플레이가 사라진다.
- **smallWebGame:** 가벼운 능력은 선딜 0·후딜 0.1~0.2s, 강한 능력은 선딜 0.2~0.4s·후딜 0.3~0.5s. `AbilityKit`는 타이밍을 굴리고 game.js가 그 창에 맞춰 무적/무방비·애니를 처리.

## `FEEL-TELEGRAPH` — 예고가 공정성을 만든다
적의 능력(또는 위험한 플레이어 능력)은 **발동 전 시각/청각 예고**(telegraph)를 준다. 장판 표시·번쩍임·소리·캐릭터 자세. 예고 없는 즉사·기습은 불공정(`BAL-FAIR-ENEMY-ABILITY`). 예고 창이 곧 회피·리액션의 기회.
- **smallWebGame:** `visual.telegraph_read` 슬롯에 "적 입장에서 무엇을 보고 피하나"를 적어 sprite/juice로 전달. 예고 0.3~0.6s가 모바일 반응에 공정.

## `FEEL-BUFFER` — 입력 버퍼·코요테로 관용
정확한 프레임을 못 맞춰도 의도가 통하게 한다. **입력 버퍼**(능력 입력을 0.1~0.15s 저장해 쿨다운/후딜이 끝나는 순간 자동 발동), **코요테 타임**(발판을 벗어난 직후 짧게 점프/대시 허용). 손맛의 8할은 관용에서 나온다.
- **smallWebGame:** super-runner의 점프 버퍼/코요테 패턴을 능력에도 적용. 모바일 터치 지연(70~120ms)을 버퍼가 흡수 — 모바일은 데스크톱보다 약간 넉넉히, 코요테 80~100ms가 1차 기본.
- **over-buffer 가드(접근성 ↔ 정밀 충돌 해소):** 버퍼는 만료 후 자동 폐기하고, 이미 다음 입력으로 넘어갔으면 버퍼를 클리어한다 — 안 그러면 sticky/mushy 컨트롤·오발동(의도 안 한 입력)이 된다.

## `FEEL-COYOTE-CANCEL` — 캔슬: 능력이 능력을 잇는다
한 능력의 후딜을 다른 행동으로 *끊어내기*(cancel)가 콤보의 핵이다([synergy-combo.md](./synergy-combo.md) `COMBO-CANCEL`). 예: 공격 후딜을 대시로 캔슬해 빠르게 잇기. 캔슬 가능 지점·대상을 명시해 *의도된 깊이*로 둔다(아무 캔슬이나 다 되면 무한콤보).
- **smallWebGame:** 캔슬은 숙련 천장을 만드는 가장 싼 방법 — 능력 수를 안 늘리고 깊이만 늘린다(`SCOPE-DEPTH-NOT-BREADTH`).

## `FEEL-CHARGE-CURVE` — 차지·홀드 곡선
차지(input:charge)·홀드 능력은 *누른 시간*에 따라 효과가 커진다. 단계별(3단 차지)이 연속보다 읽기 쉽고 피드백이 명확(각 단계에 시각·음향 신호). 설계 변수: 단계 수·단계별 효과·완충 시간·오버차지 패널티(너무 오래 = 폭발/취소)·차지 중 이동속도(보통 감속 = 커밋).
- **smallWebGame:** 모바일은 길게 누르기로 차지 — 2~3단이 명료(연속 게이지는 판정 모호). 단계 도달 시 번쩍임·피치 상승(`FEEL-FEEDBACK-CLARITY`). 차지가 곧 숙련 표현(`IDENT-MASTERY-EXPRESSION`) — 풀차지 타이밍이 실력. 플랫포머 차징 점프(super-runner 패턴)가 좋은 예.

## `FEEL-HITSTOP` — 히트스톱·임팩트
타격 순간 1~5프레임(≤80ms) 정지로 "맞았다"의 무게를 준다. 강한 능력일수록 길게(단 80ms 초과는 흐름 끊김, `FE-JUICE` 주의). 스크린셰이크·파티클·SFX와 묶어 [`juice-fx`](../../../juice-fx/SKILL.md)가 구현.

## `FEEL-FEEDBACK-CLARITY` — 발동/실패 피드백 명료성
플레이어는 능력이 (a) 나갔는지 (b) 왜 안 나갔는지(쿨다운/자원부족/잠김)를 즉시 알아야 한다. `AbilityKit`의 `onReject(id, reason)`로 거부 사유별 피드백(쿨다운 스윕 깜빡임 / 자원바 붉게 / "잠김" 표시).
- **smallWebGame:** 무반응이 최악. 못 쓰면 *왜 못 쓰는지*를 0.1s 안에 보여준다.

## `FEEL-COMMIT-WINDOW` — 커밋과 무적창
큰 능력은 *커밋*(중간 취소 불가)으로 무게를, 회피기는 *무적창(i-frame)*으로 보상을 준다. 대시의 i-frame(0.1~0.15s), 궁극의 발동 중 슈퍼아머. 커밋·무적창 길이가 리스크/보상을 정한다.
- **smallWebGame:** 대시 i-frame은 작은 게임에서 가장 만족스러운 한 요소 — "아슬하게 통과"의 쾌감(`FE-TENSION`).

## `FEEL-MOBILE-INPUT` — 모바일 입력 정합
능력 입력을 엄지에 맞춘다: 탭(instant), 길게(charge/hold), 조준 스틱(aim, [`virtual-joystick`](../../../virtual-joystick/SKILL.md)), 스와이프(방향 능력). 작은 버튼·먼 위치는 오발을 부른다 — 엄지 영역(`UX-THUMB-ZONE`)에 큰 탭타겟.
- **smallWebGame:** 동시 입력 한계(엄지 2개)를 존중 — 이동 + 능력 1개가 동시의 현실적 상한. 자동발동(근접 시 자동)으로 버튼을 줄인다.

## `FEEL-AIM-ASSIST` — 조준 보정
조준 능력(aim/target)은 작은 화면에서 빗나가기 쉽다 — 약한 자동조준·근접 스냅·관대한 히트박스로 의도를 살린다(`FE-FAIRNESS`). 단 과하면 숙련 표현을 죽이니 약하게.

## `FEEL-JUICE-RESTRAINT` — 연출은 적게, 정확하게
모든 능력에 풀 연출을 깔면 감각이 마비되고 흐름을 가린다. 시그니처·궁극에 강한 연출, 기본기엔 가벼운 피드백. juice는 *정보*(무엇이 일어났나)를 먼저, *멋*은 그다음([`juice-fx`](../../../juice-fx/SKILL.md) `FE-JUICE` 주의).

---

## 기계 검증 훅 (lint-abilities.mjs)
- `cast`/`active`/`recovery`는 수치 검증 대상은 아니나, 고파워+무쿨+무비용은 `cooldown` warn(리듬·리스크 부재 신호).
- 적 능력에 telegraph 권장(수동 점검 — `visual.telegraph_read` 슬롯 채움 여부는 `schema`로 일부 점검).

## 출처
- 격투·캐릭터액션·플랫포머의 게임필 통념(anticipation-active-recovery, telegraph, input buffer, coyote time, cancel, hitstop, i-frame)을 작은 2D 웹게임·모바일 입력용으로 정리. 상세: `.omc/research/ability-system-research-dossier.md`. 구현 연출은 juice-fx, 사운드는 sound-architect 소관.
