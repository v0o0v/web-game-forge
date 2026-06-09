# 팔레트 이론 — 색이 스타일을 정한다 (`STY-PAL-*`)

> 제한된 색을 잘 고르면 그 자체로 게임이 통일되고 '예뻐' 보인다. 여기서 재질별 램프·hue-shift 셰이딩·역할색(의미색)·
> 따뜻/차가운 대비·접근성 대비를 정한다. 이 모든 색은 `master_palette` 단일 진실로 모이고, `assets/palette.master.json`
> 으로 emit 돼 아이템·능력·HUD·juice 가 상속한다(`STY-PAL-MASTER-SINGLE-SOURCE`·`STY-PAL-SHARED-INHERIT`). 인터뷰 S3.

---

## `STY-PAL-RAMP` — 재질별 dark→light 램프 (북극성)
색은 낱개가 아니라 **램프**로 정의한다 — 한 재질(돌·나무·살·따뜻한 빛)의 어두운 그림자색에서 밝은 하이라이트색까지 3~4단 그라데이션. 셰이딩은 이 램프 위에서 단계를 골라 칠한다(`STY-SHADE-RAMP-STEPS`). style.json `master_palette.ramps` 의 각 키가 한 재질:
```jsonc
"ramps": {
  "stone": ["#2a2438", "#3c3550", "#574a6e", "#7a6b94"],   // dark → light 4단
  "wood":  ["#3a2418", "#5a3a22", "#7a4a22", "#a06a34"]
}
```
키는 자유(stone/wood/metal/flesh/foliage…). 게임에 등장하는 재질 수만큼만 만든다(`STY-SCOPE-PALETTE-BUDGET`). 한 램프를 여러 오브젝트가 재사용하면 통일감이 생긴다.

## `STY-PAL-HUE-SHIFT` — hue-shift: 빛은 따뜻하게, 그림자는 차갑게 (북극성)
좋은 픽셀/2D 셰이딩의 핵심 비밀: 밝아질수록 **명도만 올리지 말고 색상(hue)도 따뜻한 쪽(노랑/주황)으로 민다**. 어두워질수록 차가운 쪽(파랑/보라)으로. 단순히 검정을 섞으면 칙칙하고, hue-shift 하면 색이 살아난다. style.json `shading.hue_shift: "warm-light-cool-shadow"` 가 이 규칙. 위 stone 램프도 어두운 끝이 보라(차가움), 밝은 끝이 라벤더로 hue 가 이동한다.

## `STY-PAL-LIMITED` — 제한 팔레트 = 응집
색을 적게 쓸수록 통일된다. 작은 웹게임은 16~48색(`STY-SCOPE-PALETTE-BUDGET`). 새 오브젝트에 *새 색*을 추가하기보다 *기존 램프를 재사용*한다. 제한 팔레트는 (1) 응집, (2) 생성 도구 시드 안정, (3) 작은 화면 가독을 동시에 준다. 잘 만든 CC0 팔레트(예: 절차생성·DawnBringer 계열 통념)를 출발점으로 삼되 오리지널로 조정.

## `STY-PAL-WARM-COOL-CONTRAST` — 따뜻/차가운 대비로 초점 만들기
화면 전체가 한 온도면 평면적이다. **따뜻한 초점(플레이어·픽업·광원) + 차가운 배경(앰비언트 어둠·돌)** 의 온도 대비로 시선을 유도한다. `master_palette.background` 는 보통 차가운 어두운 색, `role_colors.player`·`role_colors.pickup` 는 따뜻하거나 채도 높은 색으로 떠 보이게.

## `STY-PAL-ROLE-COLORS` — 역할색: 색에 의미를 (의미색)
게임플레이 요소는 **고정된 의미색**을 갖는다 — 플레이어·적·위험·픽업·UI 강조. 한 번 정하면 게임 전체에서 일관되게(빨강=위험, 노랑=픽업). style.json `role_colors`:
```jsonc
"role_colors": { "player":"#7ad6ff", "enemy":"#9a52c7", "danger":"#e83b2e", "pickup":"#ffd23f", "ui_accent":"#ffb347" }
```
이 역할색을 **HUD([`game-ui-hud`](../../game-ui-hud/SKILL.md))·능력(ability §8)·아이템(item §7)·juice 파티클**이 상속한다(`STY-PAL-SHARED-INHERIT`). 위험을 빨강으로 정했으면 데미지 파티클·위험 장판·적 강조가 모두 그 빨강을 쓴다.

## `STY-PAL-NEUTRALS` — 중립색: 진짜 검정·흰색은 피한다
`master_palette.neutrals.black`/`.white` 는 순수 `#000000`/`#ffffff` 가 아니라 *살짝 색이 도는* 어두운/밝은 색(예: black `#120e1a` 보라끼, white `#fff3e0` 따뜻끼). 순수 흑백은 눈에 거칠고 게임 톤과 따로 논다. 아웃라인·텍스트·하이라이트가 이 중립색을 쓴다.

## `STY-PAL-BACKGROUND-BASE` — 앰비언트 베이스색
`master_palette.background` 는 빈 공간·앰비언트 어둠의 기준색이다. 라이팅(T3)을 쓰면 `lighting.ambient.color` 가 보통 이 값과 같거나 더 어둡고, Canvas 폴백 오버레이(`canvas_fallback.ambient_overlay`)도 이 색을 알파와 함께 쓴다(`STY-MOOD-CANVAS-FALLBACK`). 무드의 바닥을 정하는 색.

## `STY-PAL-CONTRAST-ACCESS` — 접근성: 전경/배경 대비
게임플레이 중요 요소(플레이어·적·픽업·텍스트)는 **배경과 충분한 명도 대비**가 있어야 보인다 — `lintConfig.min_contrast_ratio`(기본 3.0) 로 기계 검증. 위험 요소를 색 *단독*으로 부호화하지 않는다(색각 — 모양·아이콘·테두리 병행, `STY-FORM-SILHOUETTE-FIRST`·item/ability 의 다채널 등급). 어두운 무드(T3)일수록 역할색의 채도·명도를 높여 가독을 지킨다.

## `STY-PAL-MASTER-SINGLE-SOURCE` — master_palette = 단일 진실 (북극성)
모든 색은 `style.json.master_palette` 한 곳에서 나온다. 이게 `games/<slug>/assets/palette.master.json` 으로 **emit** 되고(상류 진실), 다른 시스템은 거기서 *읽기만* 한다 — 색을 코드 곳곳에 하드코딩하지 않는다(`STYLE-SINGLE-SOURCE`). 색을 바꾸면 한 곳만 고치면 전체가 따라온다.

## `STY-PAL-SHARED-INHERIT` — 상속 체인 (item §7 / ability §8 / HUD / juice)
`master_palette`·`role_colors` 는 게임 전 시스템의 색 기준이다. 상속 체인:
- **아이템([`item-architect`](../../item-architect/SKILL.md) §7 스타일가이드):** 아이템 아이콘 `visual.palette` 가 master_palette 램프 참조, 등급 색이 역할색 체계와 정합.
- **능력([`ability-architect`](../../ability-architect/SKILL.md) §8 스타일가이드 헤더):** 능력 아이콘 `visual.palette`·`role_colors`·`ultimate_accent` 가 여기서 상속.
- **HUD(game-ui-hud):** 점수·체력바·강조가 `role_colors` 사용.
- **juice([`juice-fx`](../../juice-fx/SKILL.md)):** 데미지·픽업·위험 파티클이 `role_colors` 사용.

> 상세 계약·emit 형식은 [cohesion-tools.md](./cohesion-tools.md).

---

## 안티패턴
- **램프 없이 낱색:** 셰이딩이 명도만 오르내려 칙칙(`STY-PAL-HUE-SHIFT` 미적용).
- **순수 흑백:** `#000`/`#fff` 직접 사용(`STY-PAL-NEUTRALS` 위반).
- **색 의미 흔들림:** 빨강이 어디선 위험, 어디선 픽업(`STY-PAL-ROLE-COLORS` 위반).
- **색 하드코딩:** master_palette 안 거치고 코드에 hex 직접(`STY-PAL-MASTER-SINGLE-SOURCE` 위반).
- **저대비:** 어두운 배경에 어두운 적(`STY-PAL-CONTRAST-ACCESS` — lint 검출).

## 출처
- 제한 팔레트·hue-shift 셰이딩·온도 대비·의미색(2D 게임 아트·도트 통념)을 작은 웹게임·생성 도구 핸드오프용으로 정리. master_palette 단일 진실·상속 체인은 [item-architect](../../item-architect/SKILL.md) §7·[ability-architect](../../ability-architect/SKILL.md) §8 스타일가이드 헤더와 정합.
