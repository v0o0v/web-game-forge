---
name: wgf-style-architect
description: >
  게임 **전체의 시각 스타일(아트 디렉션)을 정의·강제하는** 상위 디렉터 스킬 — 아트스타일·룩·비주얼톤·무드·분위기, 색팔레트·
  색램프·hue-shift 셰이딩, 라인아트·아웃라인·비율(치비), 셀/소프트 셰이딩·NW 광원, 라이팅·포스트FX 무드(따뜻한 던전·밤·호러),
  카툰룩·픽셀룩·플랫·벡터. **이미지를 직접 *생성*하지 않는다** — 스프라이트·아이콘·타일 생성은 sprite-forge/vector-graphics/
  sprite-picker 소관이고, 이 스킬은 그 위에서 **게임 전체의 시각 언어를 한 번 정의해 강제하는 디렉션 권위**다(master_palette·
  역할색·셰이딩·광원·무드가 단일 진실). game.js render(pixelArt)·기존 에셋·STORY.md 톤을 먼저 분석하고, 모호하면 탑다운 1문1답으로
  캐물으며(레퍼런스 이미지 인제스트) 매 라운드 무드·팔레트를 먼저 제안한다. **복잡도·매체를 가장 먼저 가른다**(디폴트 제한 팔레트 +
  무드 하나, 픽셀↔벡터를 game.render 와 1:1). games/<slug>/STYLE.md + style.json + assets/palette.master.json 을 산출하고
  engine/stylekit.js 로 배선해 PixelForge/VectorForge·tiled/HUD/juice·lighting-mood/screen-fx 가 이 스타일을 상속하게 한다.
  tools/lint-style.mjs 로 대비·색 수·IP 금칙어를 기계 검증. 초반(룩 확정)·중반(리스킨·무드 변경) 모두 사용.
  아트스타일/아트디렉션/룩/비주얼톤/무드/분위기/스타일가이드/색팔레트/색램프/카툰룩/픽셀룩/플랫/벡터룩/셰이딩/셀셰이딩/라인아트/
  아웃라인/비율/치비/광원/조명무드/포스트FX/리스킨/컬러그레이딩을 정해·잡아·바꿔·통일·강제 해 달라는 요청에 사용.
  English: define and ENFORCE a game's whole visual style / art direction. Does NOT *generate* images (sprite-forge/
  vector-graphics/sprite-picker do) — this is the **direction authority** defining the visual language once
  (master_palette, role colors, shading, light, mood), wiring engine/stylekit.js. Keywords: art style, art direction,
  look, visual tone, mood, style guide, color palette, color ramp, cartoon, pixel look, flat, vector, shading, cell
  shading, line art, outline, proportion, chibi, light direction, lighting mood, post-FX, color grading, reskin.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, WebFetch
---

# style-architect — 게임 비주얼 아트 디렉션 디렉터

> **용어 주의 — 스타일 정의 ≠ 이미지 생성.** 이 스킬은 **그림을 직접 그리지 않는다.** 스프라이트·아이콘·타일 같은
> 실제 이미지 생성은 [`sprite-forge`](../wgf-sprite-forge/SKILL.md)·[`vector-graphics`](../wgf-vector-graphics/SKILL.md)·
> [`sprite-picker`](../wgf-sprite-picker/SKILL.md)의 소관이다. style-architect는 **그 위에서 "이 게임은 어떻게 보이는가"를
> 한 번 정의하고, 모든 생성기·엔진·UI가 그 룩을 따르도록 강제하는 디렉션 권위**다. 헷갈릴 여지가 있으면 "스타일 정의"
> 또는 "아트 디렉션"으로 부른다.

게임에 **'무엇이 어떻게 보이고, 그 룩을 모든 에셋이 어떻게 일관되게 지키는가(시각 언어)'를 입히는** 상위 스킬.
픽셀 한 게임의 제한 팔레트 하나부터 풀 스타일가이드까지, **게임 전체의 시각 스타일**(팔레트·셰이딩·라인·비율·무드·
라이팅·포스트FX)을 정의한다. 코드를 바로 짜지 않고 **① 현재 게임 분석(render·에셋·톤) → ② 복잡도·매체부터 의도를
인터뷰로 명확화(+레퍼런스 이미지 인제스트) → ③ 검증된 아트디렉션 이론 적용 → ④ STYLE.md 바이블 + style.json 데이터 +
assets/palette.master.json 마스터 팔레트로 산출 → ⑤ 게임 적용(engine/stylekit.js 배선·팔레트/무드 상속) 또는 위임 →
⑥ 응집 검수(validator + 수동, 작성과 분리)**한다. web-game-builder 워크플로의 일부. `reference/`(검증된 아트디렉션
통념을 광범위 웹 리서치로 모아 작은 2D 웹게임용으로 정리한 라이브러리)로 설계하고, 런타임은 `engine/stylekit.js`,
실제 이미지·라이팅·포스트FX·UI·사운드 구현은 제작요소 스킬에 위임한다.

> **역할 분리 (디렉터 7계층 + 생성기).** 같은 게임을 여러 스킬이 다른 층에서 본다 — 반드시 구분한다.
> - **무엇을 플레이하나(재미·메카닉):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../wgf-web-game-builder/reference/game-dna/fun-elements.md)
> - **톤·이야기·캐릭터·대사:** [`story-architect`](../wgf-story-architect/SKILL.md) (STYLE.md는 STORY.md 톤을 상속한다)
> - **습득·사용하는 모든 것(아이템):** [`item-architect`](../wgf-item-architect/SKILL.md) (§7 비주얼이 master_palette를 상속)
> - **캐릭터가 할 수 있는 행동(능력):** [`ability-architect`](../wgf-ability-architect/SKILL.md) (§8 비주얼이 master_palette를 상속)
> - **개별 레벨·진행 맵:** [`level-architect`](../wgf-level-architect/SKILL.md) · [`world-map-architect`](../wgf-world-map-architect/SKILL.md)
> - **그 위에 입히는 소리:** [`sound-architect`](../wgf-sound-architect/SKILL.md)
> - **실제 이미지를 *생성*하는 도구:** [`sprite-forge`](../wgf-sprite-forge/SKILL.md)/[`vector-graphics`](../wgf-vector-graphics/SKILL.md)/[`sprite-picker`](../wgf-sprite-picker/SKILL.md) — **이들은 style.json을 입력으로 받는다.**
> - **게임이 *어떻게 보이는가*(시각 스타일·룩·무드) 그 자체:** `STY-SCOPE STY-PAL STY-FORM STY-SHADE STY-MOOD` — **이 스킬** ([reference/INDEX.md](./reference/INDEX.md))
>
> **스타일 ≠ 무조건 화려하게.** 우리 게임은 작은 2D 웹게임이다. **디폴트는 제한 팔레트(16~32색) + 무드 하나**
> (`STY-SCOPE-DEFAULT-MINIMAL`) — 많은 게임은 잘 고른 팔레트 + NW 셀셰이딩 하나로 룩이 완성된다. 복잡도를 4티어로
> 가르고 매체(픽셀↔벡터)를 가장 먼저 못 박는다. 과채도·과대비는 모바일 OLED 절전과 가독성을 해치니 절제한다.

## 생성기와의 경계 (sprite-forge / vector-graphics / sprite-picker)
- **이 스킬(style-architect)이 시각 스타일의 권위다** — 팔레트·역할색·셰이딩 모델·광원·무드는 `style.json`이 단일 진실이고,
  `assets/palette.master.json`이 마스터 팔레트다. 생성기는 이 데이터를 **읽어서 그 룩으로** 이미지를 만든다.
- **생성기가 실제 픽셀/벡터를 만든다** — 이 스킬은 한 장의 그림도 직접 출력하지 않는다. style-architect가 "어떻게 보일지"를
  정의하면, sprite-forge(PixelForge 팔레트 `P`)·vector-graphics(VectorForge 재질 램프)·sprite-picker(CC0 검색 style 필터)가
  그 정의를 **결정론적으로 소비**해 일관된 에셋을 산출한다.
- 거꾸로 "한 장짜리 일회성 아이콘"만 필요하면 style-architect 없이 생성기를 바로 써도 된다 — **스타일을 *여러 에셋에
  걸쳐 강제*해야 할 때** 이 스킬을 쓴다(과설계 금지, `STY-SCOPE-DEFAULT-MINIMAL`).

## 언제 사용
- 새 게임의 **아트 디렉션을 처음 잡을 때**(web-game-builder가 "style-architect로 아트 디렉션을 잡을까요?"로 위임)
- **팔레트·무드·룩·셰이딩·라인·비율·라이팅·포스트FX**를 정하거나 통일하고 싶을 때("카툰룩으로", "따뜻한 던전 무드로", "팔레트 통일해줘", "픽셀룩 잡아줘", "리스킨")
- 에셋이 **제각각이라 룩이 안 맞을 때**(스프라이트·HUD·타일·파티클 색이 따로 놂) — 마스터 팔레트로 응집을 강제
- **제작 중반에 무드를 바꾸거나**(밤→낮, 코지→호러) **리스킨**할 때(STYLE.md/style.json을 단일 진실로 갱신)
- 룩이 "밋밋하다/촌스럽다/안 어울린다/너무 화려하다/대비가 안 보인다"를 진단하고 **응집 리뷰**를 할 때

## 핵심 원칙
1. **분석 먼저.** 진공에서 룩을 발명하지 않는다 — 현재 game.js 의 **render 설정(`pixelArt`·`antialias`·`roundPixels`)·기존 에셋·코어 동사·STORY.md 톤·플랫폼**을 찾아 *그 위에* 스타일을 잡는다. 매체(픽셀↔벡터)는 `game.render.pixelArt`와 1:1로 못 박는다(`STY-SCOPE-MEDIUM-MATCH`, 계약 D7).
2. **복잡도·매체를 가장 먼저 못 박는다.** story-architect가 톤을, ability-architect가 능력 복잡도를 먼저 정하듯, 이 스킬은 **복잡도 티어(0~3)와 매체 1개**를 먼저 확정한다(`STY-SCOPE-DEFAULT-MINIMAL`). 작은 게임에 풀 스타일가이드를 욱여넣지 않는다 — **간단/복잡을 사용자에게 적극적으로 묻는다**(디폴트 = 제한 팔레트 + 무드 하나).
3. **의도가 모호하면 끈질기게 묻고, Claude가 먼저 무드·팔레트를 제안한다.** 탑다운 1문1답 인터뷰([reference/style-interview.md](./reference/style-interview.md))로 약점 차원을 캔다. 빈 객관식 금지 — 매 라운드 *그림이 그려지는 한 컷*(무드 한 줄 + 팔레트 키 색 + 셰이딩 결)을 먼저 내고 의견을 밝힌다. **레퍼런스 이미지를 받으면 인제스트**해 팔레트·무드를 추출하되 그대로 베끼지 않는다(IP 안전).
4. **제한 팔레트 + hue-shift가 룩을 만든다.** 색을 무한정 쓰지 않는다 — 재질별 dark→light **색 램프**를 짜고, 그림자는 차갑게·하이라이트는 따뜻하게 **hue-shift** 한다(`STY-PAL-HUE-SHIFT`). 전경/배경 **대비**로 가독성을 보장한다(`STY-PAL-CONTRAST`).
5. **룩은 일관성으로 산다.** 한 게임 한 스타일 — 모든 스프라이트·아이콘·타일·HUD·파티클이 **같은 master_palette·같은 광원(NW)·같은 셰이딩 모델**을 상속해야 룩이 응집한다(`STY-SHADE-LIGHT-DIR`·`STY-MOOD-COHESION`). 실루엣을 먼저 읽히게 한다(`STY-FORM-SILHOUETTE-FIRST`).
6. **무드는 라이팅·포스트FX로 입힌다.** 팔레트가 정한 룩 위에 **라이팅(lighting-mood)**·**포스트FX(screen-fx)**로 분위기를 완성한다(따뜻한 던전·밤·호러). 단 WebGL 전용이므로 **Canvas 폴백을 반드시 함께 정의**한다(`STY-MOOD-CANVAS-FALLBACK`, 계약 R4) — 폴백 없이 무드가 사라지면 안 된다.
7. **단일 진실 + 작성/검수 분리.** 모든 팔레트·셰이딩·무드는 `games/<slug>/STYLE.md`(설계 바이블) + `style.json`(기계 데이터 = stylekit 로드 + 린터 입력 + 생성기 상속) + `assets/palette.master.json`(마스터 팔레트)을 **유일한 출처**로 생성한다. 설계(③④)와 **응집 검수(⑥: `lint-style.mjs` + 수동)는 반드시 다른 패스**로 분리한다.
8. **과설계 금지 · IP 안전.** 한 게임 한 매체·작은 팔레트(색 수 상한), 죽은 색·저대비·과채도 차단. **상용 게임의 에셋·이름·시그니처 룩을 복제하지 않는다** — 스타일/무드/기법만 차용해 오리지널로 재구성한다(`lintConfig.ip_redwords`로 기계 점검, [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)).

## 워크플로

### 0) 현재 게임 분석 (필수 · 설계 전)
대상 게임의 `game.js`/`index.html`과 있으면 기존 `STYLE.md`/`style.json`·`STORY.md`·`ITEMS.md`·`ABILITIES.md`를 Read 해서 파악한다:
- **render 설정 = 매체 결정** — `game.js`의 Phaser config `render.pixelArt`/`antialias`/`roundPixels`. `pixelArt: true`면 픽셀 매체, false면 벡터/스무스 매체. style.json `medium`·`render`를 이것과 1:1로 못 박는다(`STY-SCOPE-MEDIUM-MATCH`).
- **기존 에셋·색** — 이미 쓰인 스프라이트·타일·HUD 색, PixelForge `P` 맵/VectorForge 명세. *룩이 이미 있는지, 응집돼 있는지, 무엇을 통일해야 하는지*.
- **서사·톤** — STORY.md가 있으면 톤·세계관·Glossary를 상속(`STY-MOOD-COHESION`). 같은 "회복"도 코지=빵·SF=주사기처럼 톤이 룩을 제약한다.
- **자매 데이터** — ITEMS.md(§7)·ABILITIES.md(§8)가 있으면 그들의 비주얼 헤더를 확인해 master_palette를 상위에서 공급한다(아래 §8 권위 규칙).
- **플랫폼** — 모바일이면 과채도/과대비 절제(OLED·가독성), 최소 피처 px(`min_feature_px`). 색 수·디테일 상한.

분석 결과를 **한 화면 요약**(매체 · 기존 룩/색 · 톤 · 플랫폼 · 추정 복잡도 티어 · 통일이 필요한 지점)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 스타일 인터뷰 (매체·복잡도 먼저, 모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비면 **온디맨드로 [reference/style-interview.md](./reference/style-interview.md)를 Read** 해 탑다운 1문1답 인터뷰를 수행한다:
- **탑다운 순서**(S1 매체·복잡도 **★먼저** → S2 무드·레퍼런스(이미지 인제스트) → S3 팔레트 → S4 비율·라인 → S5 셰이딩·조명 → S6 포스트FX → S7 응집·검증), 약점 차원 하나씩 + "왜 지금".
- **S1에서 매체와 복잡도 티어(0~3)를 못 박는다.** Tier 0(팔레트만)·1이면 인터뷰 대부분을 건너뛰고 바로 청사진으로 — **간단해도 된다고 적극 안내**한다.
- **매 라운드 Claude가 먼저 무드·팔레트·룩을 제안**(백지 금지)하고 의견을 밝힌다. 추상적 답("예쁘게")은 구체 무드·키 색·셰이딩 모델로 되묻는다.
- **레퍼런스 이미지 인제스트:** 사용자가 레퍼런스를 주면 팔레트·무드·셰이딩 결을 추출해 제안에 반영하되, **에셋/이름/시그니처를 복제하지 않고** 스타일만 차용한다(IP 안전).
- 사용자가 "알아서/그냥 만들어"면 분석 기반 추천 기본값(매체에 맞는 무드 프리셋)으로 채워 진행한다.

### 2) 아트디렉션 이론 적용 (설계 전 필수 Read)
[reference/INDEX.md](./reference/INDEX.md) 라우팅으로 **항상 [style-scope.md](./reference/style-scope.md) 먼저** Read 하고, 복잡도 티어·매체·무드에 맞는 도메인 파일 1~3개를 Read 한 뒤, 설계 결정마다 원칙 code를 한 줄 근거로 단다:
- **복잡도·매체 정합** → [style-scope.md](./reference/style-scope.md) (`STY-SCOPE-*`). 티어 0~3·픽셀↔벡터 게이트·팔레트 크기·무드 강도. 항상 먼저.
- **팔레트·색 이론** → [palette-theory.md](./reference/palette-theory.md) (`STY-PAL-*`). 색 램프·hue-shift·제한 팔레트·따뜻/차가운 대비·접근성 대비.
- **비율·폼·라인** → [proportion-form.md](./reference/proportion-form.md) (`STY-FORM-*`). chibi/cute 비율·실루엣 우선·라인웨이트·아웃라인 규칙.
- **셰이딩·광원** → [shading-light.md](./reference/shading-light.md) (`STY-SHADE-*`). 셀/소프트 셰이딩·NW 광원 관습·AO 근사·조명 무드 정합.
- **무드·라이팅·포스트FX** → [mood-grade.md](./reference/mood-grade.md) (`STY-MOOD-*`). style.json lighting/postfx → lighting-mood·screen-fx 프리셋 매핑·무드 레시피·**Canvas 폴백(R4)**.
- **응집·바이블·툴** → [cohesion-tools.md](./reference/cohesion-tools.md). STYLE.md/style.json 스펙 + lint 체크리스트 + visual.* → 생성기 어댑터 표 + master_palette ↔ palette.master.json ↔ item §7/ability §8 상속.
- **라이브 웹 리서치(WebSearch/WebFetch):** 내장 원칙은 광범위 웹 리서치를 작은 웹게임용으로 정리한 1차 라이브러리이니 **항상 먼저 적용**. 그 위에, 특정 무드·장르의 아트 *결*이 필요하면 그 관습·기법을 능동 리서치해 보강한다. **IP 안전 가드**: 팔레트 무드·기법만 차용, 고유 에셋·이름·시그니처는 오리지널 재구성([`ip-license-guard`](../wgf-ip-license-guard/SKILL.md)).

### 3) STYLE.md 바이블 + style.json + palette.master.json 산출 (games/<slug>/ · 단일 진실)
이론을 적용해 game.js 옆에 **`games/<slug>/STYLE.md`(사람용 설계 바이블)** + **`games/<slug>/style.json`(기계용 데이터 = stylekit 로드 + 린터 입력 + 생성기 상속)** + **`games/<slug>/assets/palette.master.json`(마스터 팔레트, item §7·ability §8이 상속)**을 만든다(스펙: [cohesion-tools.md](./reference/cohesion-tools.md)). 복잡도 티어에 비례해 섹션을 켜고 끈다(Tier 0~1은 §0·§1·§2만).
- STYLE.md 섹션: §0 메타(티어·매체·무드) · §1 마스터 팔레트(램프·중립·배경) · §2 역할색(player/enemy/pickup/danger/ui_accent) · §3 비율·폼·라인 · §4 셰이딩·광원 · §5 라이팅 무드 · §6 포스트FX · §7 Canvas 폴백 · §8 응집 점검 로그.
- **style.json**: `.omc/handoffs/team-plan.md`의 **스키마 계약을 단일 진실**로 따른다 — `slug·schema_version·medium·tier·mood·master_palette·role_colors·proportions·line·shading·lighting·postfx·canvas_fallback·render·lintConfig`. 기존 키 의미/이름을 바꾸지 않는다.
- **assets/palette.master.json**: style.json `master_palette`를 그대로 emit해 sprite-forge·vector-graphics·sprite-picker·item-architect·ability-architect가 공유하는 마스터 팔레트로 삼는다.

### 4) 게임 적용 / 위임 (★stylekit 배선 + 룩 상속)
style.json을 game.js에 1:1로 연결하고, 룩을 모든 에셋·UI·무드에 상속시키거나 web-game-builder로 위임한다:
- **런타임 엔진(index.html):** SoundForge/AbilityKit 패턴과 동일하게 `engine/stylekit.js` 를 **phaser 다음·game 이전**에 추가. T0(팔레트만)이면 stylekit 없이 game.js 에서 style.json 색을 직접 읽어도 된다(과설계 금지).
- **인스턴스·전역 등록(game.js):** `var STYLE = StyleKit.load(STYLE_SPEC); window.GAME_STYLE = STYLE;`. `STYLE_SPEC` = style.json(fetch 또는 인라인). `StyleKit.palette(STYLE)`로 PixelForge `P`(char→hex) 호환 맵/램프 헬퍼를 얻는다.
- **생성기 팔레트 상속:** [`sprite-forge`](../wgf-sprite-forge/SKILL.md)(PixelForge)·[`vector-graphics`](../wgf-vector-graphics/SKILL.md)(VectorForge)·[`sprite-picker`](../wgf-sprite-picker/SKILL.md)가 `StyleKit.palette`/`palette.master.json`·셰이딩·광원 상수를 입력으로 받아 같은 룩으로 생성한다.
- **타일·HUD·juice 색 상속:** [`level-designer`](../wgf-level-designer/SKILL.md)(tiled 타일색)·[`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)(role_colors HUD)·[`juice-fx`](../wgf-juice-fx/SKILL.md)(파티클 색)가 `role_colors`·master_palette를 상속해 게임 전체가 한 스타일을 유지한다.
- **라이팅·포스트FX 무드:** `StyleKit.applyLighting(scene, STYLE)`→[`lighting-mood`](../wgf-lighting-mood/SKILL.md)(engine/lightingkit.js), `StyleKit.applyPostFX(camera, STYLE)`→[`screen-fx`](../wgf-screen-fx/SKILL.md)(engine/screenfx.js). **WebGL 불가 시 `StyleKit.applyCanvasFallback(scene, STYLE)`**로 틴트 오버레이/사전셰이딩(`STY-MOOD-CANVAS-FALLBACK`, R4).
- **중반 리스킨·무드 변경:** STYLE.md/style.json/palette.master.json을 단일 진실로 갱신한 뒤 영향받은 에셋·무드만 재생성(바이블 → 코드 한 방향). 무드만 바꾸려면 `mood`·`lighting`·`postfx`만 갱신, 팔레트를 갈려면 master_palette 전체를 재emit하고 생성기를 재실행한다.

### 5) 검수 패스 + 응집 린트 (작성과 분리 · 필수)
**별도 패스로** style.json을 validator로 기계 검증하고 STYLE.md §8에 결과를 적는다(체크리스트: [cohesion-tools.md](./reference/cohesion-tools.md)):
```bash
node skills/wgf-style-architect/tools/lint-style.mjs games/<slug>/style.json
```
- 검출: (a) 스키마/필수 키 무결성, (b) 전경/배경·역할색 **대비**(`min_contrast_ratio`), (c) 색 수 상한(`max_palette_colors`), (d) 매체↔render 정합(medium vs render.pixelArt), (e) Canvas 폴백 존재, (f) **IP 금칙어**(`ip_redwords`로 mood/slug에 상용 IP 누출 점검). 임계값은 style.json `lintConfig`에서 읽는다.
- **수동 보강:** "룩이 한 스타일로 응집되나? 전경이 배경에서 읽히나? 무드가 톤과 같은 말을 하나? 폴백에서도 무드가 유지되나?"(`STY-MOOD-COHESION`·`STY-PAL-CONTRAST`).
- 위반은 **사람이 보게 리포트**하고 재생성한다. 가능하면 로컬 서버로 띄워 룩·무드·폴백을 [`game-qa`](../wgf-game-qa/SKILL.md)로 점검 후 **근거와 함께 보고**한다.

## §8 권위 규칙 — master_palette 상속 (D6, 하위호환)
style-architect의 `style.json` / `assets/palette.master.json`은 **게임 전체 팔레트의 상류 권위**다. 자매 디렉터는 다음 규칙으로 상속한다:
- **있으면 상속:** `games/<slug>/style.json`(또는 `assets/palette.master.json`)이 있으면 [`item-architect`](../wgf-item-architect/SKILL.md) §7 비주얼 헤더와 [`ability-architect`](../wgf-ability-architect/SKILL.md) §8 스타일가이드 헤더의 `master_palette`는 **이 파일을 상속**한다 — 아이템·능력 아이콘이 게임 전체 룩과 자동으로 응집한다.
- **없으면 인라인 하위호환:** style.json이 없으면 item §7/ability §8이 **각자 인라인 master_palette를 정의**한다(기존 동작 그대로). 즉 style-architect는 **선택적 상위 권위**이고, 그 부재가 기존 스킬을 깨지 않는다.
- **단일 방향:** 팔레트 변경은 style.json → item/ability 한 방향으로 흐른다. 마스터를 갈면 자매 데이터의 인라인 참조를 비우고 상속으로 전환한다.

## make-game 적용 게이트 (반드시 묻는 항목)
- **make-game 적용:** web-game-builder/make-game 흐름에서 게임 청사진 인터뷰 직후, **story 게이트 전(또는 함께)**에 **"이 게임에 style-architect로 아트 디렉션(룩·무드·팔레트)을 잡을까요?"를 묻는다**. 룩은 톤과 함께 게임 인상을 좌우하고, 이후 story·ability·item의 비주얼이 이 master_palette를 상속하므로 **시퀀스는 style → story → ability → item**이다. '네'면 이 워크플로로(매체·복잡도부터), '아니요'면 엔진 기본 룩(코어 동사 색만), '나중에'면 게임부터 만들고 중반에 이 스킬로 리스킨(초·중반 어디서든 가능).
- **복잡도 적극 안내:** 작은 게임이면 "제한 팔레트 + 무드 하나로 충분합니다"를 먼저 제시한다 — 과설계를 권하지 않는다(`STY-SCOPE-DEFAULT-MINIMAL`).

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../wgf-web-game-builder/SKILL.md) 오케스트레이션의 아트 디렉션 레인. 명시 호출은 [`commands/wgf-make-game.md`](../../commands/wgf-make-game.md), 게임 인터뷰는 [game-interview.md](../wgf-web-game-builder/reference/game-interview.md).
- **자매 디렉터:** [`story-architect`](../wgf-story-architect/SKILL.md)(톤↔무드 정합, STYLE는 STORY 상속) · [`item-architect`](../wgf-item-architect/SKILL.md)(§7 master_palette 상속) · [`ability-architect`](../wgf-ability-architect/SKILL.md)(§8 master_palette 상속) · [`level-architect`](../wgf-level-architect/SKILL.md)/[`world-map-architect`](../wgf-world-map-architect/SKILL.md)(진행) · [`sound-architect`](../wgf-sound-architect/SKILL.md)(청각 무드 정합).
- **이미지 생성기(style.json 상속):** [`sprite-forge`](../wgf-sprite-forge/SKILL.md)(PixelForge 팔레트) · [`vector-graphics`](../wgf-vector-graphics/SKILL.md)(VectorForge 재질 램프) · [`sprite-picker`](../wgf-sprite-picker/SKILL.md)(CC0 검색 style 필터).
- **무드·UI 구현:** [`lighting-mood`](../wgf-lighting-mood/SKILL.md)(라이팅) · [`screen-fx`](../wgf-screen-fx/SKILL.md)(포스트FX) · [`level-designer`](../wgf-level-designer/SKILL.md)(타일 색) · [`game-ui-hud`](../wgf-game-ui-hud/SKILL.md)(role_colors HUD) · [`juice-fx`](../wgf-juice-fx/SKILL.md)(파티클 색) · [`game-qa`](../wgf-game-qa/SKILL.md)(룩·무드·폴백 검증).
- **레퍼런스:** 색인 [reference/INDEX.md](./reference/INDEX.md) · 복잡도·매체 [style-scope.md](./reference/style-scope.md) · 팔레트 [palette-theory.md](./reference/palette-theory.md) · 비율·라인 [proportion-form.md](./reference/proportion-form.md) · 셰이딩·광원 [shading-light.md](./reference/shading-light.md) · 무드·그레이드 [mood-grade.md](./reference/mood-grade.md) · 응집·툴 [cohesion-tools.md](./reference/cohesion-tools.md) · 인터뷰 [style-interview.md](./reference/style-interview.md). 런타임 [engine/stylekit.js](../../engine/stylekit.js) · 툴 [tools/lint-style.mjs](./tools/lint-style.mjs).

## IP 안전
- 시각 스타일 **기법·구조**(제한 팔레트·hue-shift 셰이딩·셀셰이딩·NW 광원·치비 비율·라이팅/포스트FX 무드 등)는 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임의 고유 에셋·캐릭터 외형·시그니처 룩 조합**(예: 특정 게임의 캐릭터 스프라이트·시그니처 색조합·로고)을 그대로 복제하지 않는다 — 스타일/무드/기법만 가져와 **오리지널로 재구성**한다. 레퍼런스 이미지를 받아도 팔레트 무드·기법만 추출한다.
- 무드 id·고유명사는 STYLE.md 와 STORY.md `## 8. Glossary`에 오리지널로 정의한다. 모든 에셋은 CC0/절차생성(PixelForge·VectorForge) 또는 CC0(sprite-picker). `style.json` `lintConfig.ip_redwords`로 상용 IP 이름이 mood/slug에 누출되지 않는지 기계 점검한다. 상세는 [`ip-license-guard`](../wgf-ip-license-guard/SKILL.md).
