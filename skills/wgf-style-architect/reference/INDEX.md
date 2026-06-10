# 비주얼 스타일 설계 레퍼런스 라이브러리 — 색인 (INDEX)

> [`style-architect`](../SKILL.md)가 게임에 **통합 비주얼 아트 디렉션**(팔레트·폼·셰이딩·무드·포스트FX)을 입힐 때 쓰는
> 코드화 설계 자료다. 검증된 2D 게임 아트 통념(제한 팔레트·hue-shift 램프 셰이딩·실루엣 우선·chibi 비율·셀 셰이딩·
> NW 광원·분위기 그레이딩)을 **작은 2D 웹게임**(단일플레이·무서버·CC0·픽셀 우선·모바일·Canvas 폴백 필수)에 맞게
> 적응시켜 코드화 원칙으로 정리했다. 핵심 목적: 인터뷰에서 *한 게임 한 스타일을 정하고*, 그것을 *모든 에셋이 상속하도록*
> `games/<slug>/STYLE.md`(사람용 바이블) + `style.json`(기계용 단일 진실)으로 산출하는 것.
>
> **용어:** "스타일"은 게임의 **비주얼 아트 디렉션**이다 — Claude Code 스킬과 무관.

## 이 라이브러리를 쓰는 법 (중요)
- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산을 먹지 않는다 — `reference/phaser/`·`ability-design/`·`item-design/`과 같은 **온디맨드 Read** 방식. 필요할 때만 읽는다.
- **스타일 설계 단계**(`wgf-style-architect/SKILL.md` 2단계, 인터뷰 [style-interview.md](./style-interview.md))에서 의사결정 도구로 쓴다.
- **항상 [style-scope.md](./style-scope.md)를 먼저 Read**(복잡도 티어 0~3·매체 게이트·팔레트 크기·무드 강도를 가장 먼저 가른다) → 복잡도·매체에 맞는 도메인 파일 1~3개 → 산출 직전 **[cohesion-tools.md](./cohesion-tools.md)**(style.json 계약·린트·어댑터). 스타일 결정마다 원칙 code(예: `STY-PAL-RAMP`)를 한 줄 근거로 단다.

## 복잡도 티어 → 읽을 파일 처방

| 복잡도 티어 | 무엇 | 읽을 파일 |
|---|---|---|
| **T0 팔레트만** | 색만 고정(폼·셰이딩은 엔진 기본) | [style-scope.md](./style-scope.md) + [palette-theory.md](./palette-theory.md) — STYLE.md 불필요, style.json `master_palette`만 |
| **T1 팔레트+폼** | 색 + 비율·라인·실루엣 | + [proportion-form.md](./proportion-form.md) |
| **T2 셰이딩+광원** | + 셀/소프트 셰이딩·NW 광원·AO | + [shading-light.md](./shading-light.md) |
| **T3 풀 스타일가이드** | + 라이팅 무드·포스트FX·Canvas 폴백 | + [mood-grade.md](./mood-grade.md)·[cohesion-tools.md](./cohesion-tools.md) 전부 |

## 도메인 파일 라우팅

| 파일 | prefix | 무엇 (언제 Read) |
|---|---|---|
| **[style-scope.md](./style-scope.md)** | `STY-SCOPE-*` (8) | ★인터뷰 최우선. 복잡도 4티어 사다리·매체 게이트(픽셀↔벡터)·팔레트 크기 예산·무드 강도·디폴트 미니멀·한 게임 한 스타일·매체-render 1:1. 복잡도·매체를 정할 때. |
| [palette-theory.md](./palette-theory.md) | `STY-PAL-*` (10) | 재질별 dark→light 램프·hue-shift(warm light/cool shadow)·제한 팔레트·따뜻/차가운 대비·역할색(의미색)·접근성 전경/배경 대비·중립색·앰비언트 베이스. 색을 정할 때. |
| [proportion-form.md](./proportion-form.md) | `STY-FORM-*` (8) | chibi/cute 비율(head_to_body)·실루엣 우선·min_feature_px·라인웨이트·아웃라인 규칙(none/selective/full)·폼 언어 일관·display_px 그리드. 폼·라인을 정할 때(T1+). |
| [shading-light.md](./shading-light.md) | `STY-SHADE-*` (8) | 셀/소프트/플랫 셰이딩·ramp_steps·NW 광원 관습·AO 근사(접지 그림자)·하이라이트 절제·림라이트·조명무드 정합·사전셰이딩. 셰이딩을 정할 때(T2+). |
| [mood-grade.md](./mood-grade.md) | `STY-MOOD-*` (9) | style.json lighting/postfx → [lighting-mood](../../wgf-lighting-mood/SKILL.md)(lightingkit)·[screen-fx](../../wgf-screen-fx/SKILL.md)(screenfx) 프리셋 매핑 표·무드 레시피(따뜻한 던전·밤·호러)·**R4 Canvas-safe 폴백**·무드는 팔레트를 따른다·과FX 금지. 무드·포스트FX를 정할 때(T3). |
| **[cohesion-tools.md](./cohesion-tools.md)** | (스펙) | **STYLE.md/style.json 섹션 스펙 + style.json 스키마 계약 전재 + 린트 체크리스트 + 어댑터(visual.* → sprite-forge/vector-graphics/sprite-picker) + master_palette↔palette.master.json↔item §7/ability §8 상속**. 바이블을 산출·검수할 때. |
| [style-interview.md](./style-interview.md) | (플레이북) | 탑다운 1문1답: S1 매체·복잡도 → S2 무드·레퍼런스 → S3 팔레트 → S4 비율·라인 → S5 셰이딩·조명 → S6 포스트FX → S7 응집·검증. 매 라운드 Claude가 먼저 제안. 의도가 모호할 때. |

## 빠른 처방 (장르 스캐폴드 → 디폴트 스타일) — 자세히는 [style-scope.md](./style-scope.md)

| 장르 스캐폴드 | 디폴트 매체·무드 | 기본 티어 |
|---|---|---|
| platformer-game | 픽셀·밝은 야외(cute chibi) | T1~T2 |
| topdown-shooter | 픽셀·네온/어두운 무드 | T2~T3 |
| arcade-classic | 픽셀·고대비 레트로 | T0~T1 |
| puzzle-game | 벡터/픽셀·차분한 파스텔 | T0~T1 |
| endless-runner | 픽셀·단순 실루엣 | T1 |
| 던전/호러/밤 | 픽셀·warm-dungeon/night(라이팅+포스트FX) | T3 |
| 캐주얼/하이퍼 | 벡터·플랫 컬러풀 | T0~T1 |

> 항상 **한 게임 한 스타일**(`STY-SCOPE-ONE-STYLE`), 디폴트 **팔레트만(T0)에서 한 칸씩**(`STY-SCOPE-DEFAULT-MINIMAL`).

## 코드 빠른 색인 (prefix별 — 정식 정의는 각 도메인 파일)

- **`STY-SCOPE-*` 복잡도·범위(8):** DEFAULT-MINIMAL · ONE-STYLE · LADDER · MEDIUM-GATE · MEDIUM-RENDER-MATCH · PALETTE-BUDGET · MOOD-INTENSITY · GENRE-FIT
- **`STY-PAL-*` 팔레트(10):** RAMP · HUE-SHIFT · LIMITED · WARM-COOL-CONTRAST · ROLE-COLORS · NEUTRALS · BACKGROUND-BASE · CONTRAST-ACCESS · MASTER-SINGLE-SOURCE · SHARED-INHERIT
- **`STY-FORM-*` 비율·폼(8):** SILHOUETTE-FIRST · PROPORTION · MIN-FEATURE-PX · LINE-WEIGHT · OUTLINE-RULE · FORM-LANGUAGE · DISPLAY-GRID · READABLE-SMALL
- **`STY-SHADE-*` 셰이딩·광원(8):** MODEL-PICK-ONE · RAMP-STEPS · LIGHT-DIR-NW · AO-GROUND · HIGHLIGHT-RESTRAINT · RIMLIGHT · LUDO-LIGHT-MATCH · PRE-SHADE
- **`STY-MOOD-*` 무드·포스트FX(9):** MOOD-FROM-PALETTE · LIGHTING-PRESET · POSTFX-PRESET · FX-RESTRAINT · CANVAS-FALLBACK · FOG-DEPTH · GRADE-WARM-COOL · BLOOM-THRESHOLD · NIGHT-HORROR-RECIPE

## 산출물

스타일 설계의 산출물은 **`games/<slug>/STYLE.md`(사람용 설계 바이블) + `games/<slug>/style.json`(기계용 단일 진실 = `engine/stylekit.js` 런타임 로드 + `lint-style.mjs` 입력) + `games/<slug>/assets/palette.master.json`(master_palette 상류 진실 — item §7 / ability §8 / HUD / juice 가 상속)**이다.
섹션 스펙·style.json 스키마 계약·린트 체크리스트·어댑터(visual.* → sprite 스킬)·상속 관계는 [cohesion-tools.md](./cohesion-tools.md). 이 라이브러리는 그 바이블을 *설계*하는 자료다.
스타일 검수 도구는 [`tools/lint-style.mjs`](../tools/lint-style.mjs)(정적, 무의존성 — 대비·팔레트 크기·IP 레드워드·스키마·매체-render 정합 검증).

## 출처 · 원칙
- 본 자료는 공개된 2D 게임 아트 통념(제한 팔레트·hue-shift 셰이딩·실루엣 우선·셀 셰이딩·광원 방향·분위기 그레이딩 등)을 작은 웹게임용으로 정리한 것이다. 각 파일 ## 출처 참고.
- **IP 안전:** 색·셰이딩·라이팅 기법은 저작권 대상이 아니므로 자유 차용. 단 특정 상용 게임(예: Enter the Gungeon)의 **고유 에셋·캐릭터 이름·시그니처 룩**은 복제하지 않고, *스타일/무드 관습*(예: "따뜻한 던전 톤")만 차용해 오리지널로 재구성. style.json `lintConfig.ip_redwords` 로 기계 검증. 상세는 [`ip-license-guard`](../../wgf-ip-license-guard/SKILL.md).
