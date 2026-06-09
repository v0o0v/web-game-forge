# 스타일 바이블 스펙 · style.json 계약 · 린트 · 어댑터 (STYLE.md / style.json)

> [`style-architect`](../SKILL.md)가 스타일을 **산출·검수**할 때의 단일 스펙. 설계 자료(다른 도메인 파일)가 *무엇을
> 정할지*를 다룬다면, 이 파일은 *어떤 형식으로 적고, 어떻게 기계 검증하고, 어떤 도구로 변환되는지*를 정한다.
> 산출물은 **`games/<slug>/STYLE.md`(사람용 바이블) + `games/<slug>/style.json`(기계용 단일 진실 = `engine/stylekit.js`
> 런타임 로드 + `tools/lint-style.mjs` 입력) + `games/<slug>/assets/palette.master.json`(master_palette 상류 진실)**.
> 셋은 한 방향(바이블 → style.json → emit·코드)으로 동기화한다.

---

## 1. STYLE.md 섹션 스펙 (복잡도 티어에 비례해 켠다)

| 섹션 | 내용 | 언제(티어) |
|---|---|---|
| **§0 메타** | 복잡도 티어(0~3)·매체(pixel/vector)·장르·코어동사·플랫폼·엔진(stylekit 사용 여부) | 항상 |
| **§1 무드 한 줄** | 이 게임의 비주얼을 한 문장으로(예: "어둠 속 따뜻한 횃불의 아늑한 던전") | 항상 |
| **§2 팔레트** | master_palette(재질 램프·중립·배경) + role_colors(의미색) — **단일 진실** | 항상 |
| **§3 폼·라인** | 비율(head_to_body)·실루엣·min_feature_px·라인웨이트·아웃라인 규칙·display_px | T1+ |
| **§4 셰이딩·광원** | 셰이딩 모델·ramp_steps·NW 광원·AO·림라이트 | T2+ |
| **§5 무드·포스트FX** | lighting/postfx 레시피·Canvas 폴백·FX 절제 한계 | T3 |
| **§6 상속·핸드오프** | 어떤 시스템이 무엇을 상속하나(item §7·ability §8·HUD·juice) + visual.* 어댑터 | 항상(요약) |
| **§7 검수 로그** | lint-style 결과·수동 점검(작은 크기 가독·Canvas 폴백)·수정 이력 | 검수 시 |

> Tier 0(팔레트만)은 STYLE.md 불필요(style.json `master_palette`·`role_colors`·`render` 만으로 완결). Tier 1 은 §0~§3 몇 줄.

---

## 2. style.json 스키마 계약 (단일 진실 — `.omc/handoffs/team-plan.md` 전재)

`games/<slug>/style.json` 의 정규 형태. 이 계약을 **lint-style.mjs · STYLE.md · stylekit.js · SKILL.md · 프리셋이 동일하게** 따른다. 필드 추가는 가능하나 **기존 키 의미/이름은 바꾸지 않는다**.

```jsonc
{
  "slug": "<game-slug>",
  "schema_version": 1,
  "medium": "pixel",            // "pixel" | "vector"  — D7: 게임 render.pixelArt 와 1:1
  "tier": 1,                     // 0..3 복잡도 (0=팔레트만, 3=풀 스타일가이드)
  "mood": "cozy-dungeon",        // 프리셋 id 또는 "custom"

  // master_palette = 단일 진실. assets/palette.master.json 으로도 emit (item §7 / ability §8 상속).
  "master_palette": {
    "ramps": {                   // 재질별 dark→light 램프(hue-shift 셰이딩). 키는 자유(stone/wood/...).
      "stone":      ["#2a2438", "#3c3550", "#574a6e", "#7a6b94"],
      "wood":       ["#3a2418", "#5a3a22", "#7a4a22", "#a06a34"],
      "warm_light": ["#5a3a1a", "#a8631e", "#ffb347", "#ffe6a8"],
      "flesh":      ["#7a4a52", "#c07a6e", "#ffce9e", "#ffe6c8"]
    },
    "neutrals": { "black": "#120e1a", "white": "#fff3e0" },
    "background": "#171320"      // 앰비언트 어둠 베이스
  },

  // role_colors = 의미색. HUD(game-ui-hud)·능력(ability §8)·아이템(item §7)·juice 파티클이 상속.
  "role_colors": {
    "player": "#7ad6ff", "enemy": "#9a52c7", "danger": "#e83b2e",
    "pickup": "#ffd23f", "ui_accent": "#ffb347"
  },

  "proportions": {               // 폼 언어 (chibi/cute)
    "head_to_body": "1:1.2", "silhouette": "chunky-rounded", "min_feature_px": 2
  },
  "line": {                      // 픽셀 매체 라인아트
    "outline": "selective",      // "none" | "selective" | "full"
    "outline_color": "darker-of-fill",  // 또는 hex
    "weight_px": 1
  },
  "shading": {
    "model": "cell",             // "cell" | "soft" | "flat"
    "light_dir": "NW", "ramp_steps": 3, "hue_shift": "warm-light-cool-shadow"
  },

  "lighting": {                  // → lighting-mood (engine/lightingkit.js)
    "ambient": { "color": "#171320", "alpha": 0.55 },
    "point_lights": { "color": "#ffd9a0", "radius": 110, "intensity": 0.9 },
    "fog": { "enabled": false }
  },
  "postfx": {                    // → screen-fx (engine/screenfx.js)
    "preset": "warm-dungeon",
    "bloom": { "threshold": 0.6, "amount": 0.4 },
    "vignette": { "radius": 0.7, "strength": 0.4 },
    "color_grade": { "warm": 0.15 }
  },
  "canvas_fallback": {           // R4: WebGL lighting/postfx 불가 시 룩 유지
    "ambient_overlay": "#171320cc", "pre_shade_sprites": true
  },
  "render": { "pixelArt": true, "antialias": false, "roundPixels": true }, // D7: game.js config 미러

  "lintConfig": {                // lint-style.mjs 임계값(없으면 보수적 기본)
    "min_contrast_ratio": 3.0,
    "max_palette_colors": 48,
    "ip_redwords": ["gungeon", "enter the gungeon", "mario", "zelda", "isaac", "metroid"]
  }
}
```

### 필드 의미 요약

| 필드 | 의미 | 도메인 |
|---|---|---|
| `slug`·`schema_version` | 게임 slug · 스키마 버전(현재 1) | 메타 |
| `medium` | `pixel`/`vector` — 생성 도구·셰이딩 어휘를 가르는 매체. game.js `render.pixelArt` 와 1:1(`STY-SCOPE-MEDIUM-RENDER-MATCH`) | [style-scope](./style-scope.md) |
| `tier` | 0~3 복잡도(섹션 1 표) | [style-scope](./style-scope.md) |
| `mood` | 프리셋 id 또는 `custom` | [mood-grade](./mood-grade.md) |
| `master_palette.ramps` | 재질별 dark→light 램프(hue-shift). **단일 진실**(`STY-PAL-MASTER-SINGLE-SOURCE`) | [palette-theory](./palette-theory.md) |
| `master_palette.neutrals`·`.background` | 색 도는 흑백 · 앰비언트 베이스 | [palette-theory](./palette-theory.md) |
| `role_colors` | 의미색(player/enemy/danger/pickup/ui_accent) — 상속 체인의 기준 | [palette-theory](./palette-theory.md) |
| `proportions` | head_to_body·silhouette·min_feature_px | [proportion-form](./proportion-form.md) |
| `line` | outline(none/selective/full)·outline_color·weight_px | [proportion-form](./proportion-form.md) |
| `shading` | model(cell/soft/flat)·light_dir·ramp_steps·hue_shift | [shading-light](./shading-light.md) |
| `lighting` | ambient·point_lights·fog → lightingkit(WebGL) | [mood-grade](./mood-grade.md) |
| `postfx` | preset·bloom·vignette·color_grade → screenfx(WebGL) | [mood-grade](./mood-grade.md) |
| `canvas_fallback` | ambient_overlay·pre_shade_sprites — R4 폴백 | [mood-grade](./mood-grade.md) |
| `render` | pixelArt·antialias·roundPixels — game.js config 미러 | [style-scope](./style-scope.md) |
| `lintConfig` | min_contrast_ratio·max_palette_colors·ip_redwords | (린트) |

---

## 3. 상속 체인 — master_palette ↔ palette.master.json ↔ item §7 / ability §8 (★핵심)

`style.json.master_palette` 가 **모든 색의 상류 진실**이다. 흐름:

```
style.json.master_palette  ──emit──▶  games/<slug>/assets/palette.master.json   (상류 진실 파일)
        │                                          │ (읽기 전용 상속)
        │ role_colors                              ├─▶ item-architect  §7 스타일가이드 (아이템 visual.palette·등급색)
        └────────────────────────────────────────▶├─▶ ability-architect §8 스타일가이드 헤더 (능력 visual.palette·role_colors·ultimate_accent)
                                                    ├─▶ game-ui-hud (점수·체력·강조 = role_colors)
                                                    └─▶ juice-fx (데미지·픽업·위험 파티클 = role_colors)
```

- **상류(이 스킬):** style-architect 가 `master_palette`·`role_colors` 를 정하고 `assets/palette.master.json` 으로 emit. 이게 단일 진실.
- **하류(상속):** item/ability/HUD/juice 는 `palette.master.json` 을 *읽기만* 한다 — 자기 색을 새로 정의하지 않고 램프/역할색을 참조. 그래서 색을 한 곳(master)에서 바꾸면 전체가 따라온다.
- **권위 규칙(D6):** style.json 이 있으면 그게 권위(authoritative). 없으면 item/ability 가 §7/§8 에 인라인 정의한 색이 하위호환으로 동작(기존 게임 안 깨짐). 즉 style-architect 는 *기존 인라인 색을 master 로 끌어올리는* 역할도 한다.
- **palette.master.json 형식(emit 대상):** `master_palette` + `role_colors` 를 그대로 담은 평면 JSON(stylekit `StyleKit.emitMasterPalette(style)` 가 생성). item/ability 의 visual 슬롯이 이 파일의 램프 키·역할색 이름으로 참조한다.

---

## 4. visual.* 어댑터 — 스타일 상수 → sprite 생성 도구 쿼리

style.json 의 스타일 상수가 각 에셋의 `visual.*` 슬롯을 *채우는 기준*이 되고, 그 슬롯이 생성 도구 입력으로 변환된다(item/ability 의 `UX-DESC-SLOTS` 와 동일 패턴). 어댑터 표:

| visual.* 슬롯 | style.json 기준 | → 생성 도구 변환 |
|---|---|---|
| `palette` | `master_palette.ramps`·`role_colors` 의 키/이름 참조 | sprite-forge: 픽셀 팔레트 `P` 맵(char→hex) / vector-graphics: 재질 램프 명세 / sprite-picker: style 검색 태그 |
| `silhouette` | `proportions.silhouette`·`STY-FORM-SILHOUETTE-FIRST` | 외곽 형태 시드 |
| `material` | `master_palette.ramps` 키(stone/wood/flesh…) | 재질 셰이딩 램프 선택 |
| `lighting` | `shading.light_dir`(기본 NW) | 셰이딩 광원 방향 |
| `shading_model` | `shading.model`(cell/soft/flat) | 셰이딩 방식 |
| `outline` | `line.outline`·`line.outline_color`·`weight_px` | 라인아트 처리 |
| `display_px` | `proportions`·display 그리드 | 표시 크기 |

**어댑터 라우팅(`medium` 으로 갈림):**
- `medium:"pixel"` → [`sprite-forge`](../../sprite-forge/SKILL.md)(PixelForge 팔레트·프레임) / 외부 CC0 픽셀은 [`sprite-picker`](../../sprite-picker/SKILL.md)(태그·style 쿼리).
- `medium:"vector"` → [`vector-graphics`](../../vector-graphics/SKILL.md)(VectorForge 베지어·글로우·재질 램프) / 외부 HD CC0.

> stylekit `StyleKit.palette(style)` 가 PixelForge `P`(char→hex) 호환 맵 또는 ramp 조회 헬퍼를 돌려준다([stylekit.js](../../../engine/stylekit.js) 어댑터 계약).

---

## 5. lint-style.mjs 스타일 린트 체크리스트

```bash
node skills/style-architect/tools/lint-style.mjs games/<slug>/style.json
node skills/style-architect/tools/lint-style.mjs <file> --json     # 마지막 줄 단일 JSON
node skills/style-architect/tools/lint-style.mjs <file> --strict   # warn 도 실패
```

| 룰 | severity | 무엇 | 원칙 |
|---|---|---|---|
| `schema` | error/warn | 필수 필드·enum(medium/tier/outline/model)·hex 형식·필드 타입·schema_version | (계약) |
| `medium-render` | error/warn | `medium:pixel`↔`render.pixelArt:true`/`roundPixels:true`, `vector`↔`pixelArt:false` 불일치 | `STY-SCOPE-MEDIUM-RENDER-MATCH` |
| `palette-size` | warn | 총 고유색 수 > `max_palette_colors`(기본 48) · 램프 미재사용 | `STY-SCOPE-PALETTE-BUDGET`·`STY-PAL-LIMITED` |
| `contrast` | error/warn | role_colors(player/enemy/danger/pickup) ↔ `background` 명도 대비 < `min_contrast_ratio`(기본 3.0) | `STY-PAL-CONTRAST-ACCESS` |
| `ramp-monotonic` | warn | 램프가 dark→light 명도 단조 증가 안 함 · hue-shift 없음(검정만 섞음) | `STY-PAL-RAMP`·`STY-PAL-HUE-SHIFT` |
| `canvas-fallback` | warn | `lighting`/`postfx` 있는데 `canvas_fallback` 없음/빈 값(R4) | `STY-MOOD-CANVAS-FALLBACK` |
| `fx-restraint` | info/warn | bloom.threshold 과저 · vignette.strength 과고(가독 위협) | `STY-MOOD-FX-RESTRAINT` |
| `ip-redword` | error | `mood`·`slug` 등 문자열 필드에 `lintConfig.ip_redwords` 매치(상용 IP명) | (IP 안전) |
| `tier-fields` | info | tier 에 비해 채운 필드 과다(과설계) 또는 과소(필수 누락) | `STY-SCOPE-LADDER` |

- 출력 계약: 사람용 라인 + **stdout 마지막 줄 단일 JSON** `{"ok":bool,"counts":{error,warn,info},"findings":[{rule,severity,id,message}],"file":path}`. 종료코드: error 0건이면 0, 있으면 1(`--strict` 면 warn 도 1).
- 임계값은 전부 `style.json.lintConfig` 에서 읽는다(데이터로 조정). Node 빌트인만(무의존성).

### 수동 보강(린터가 못 잡는 것)
- **"실제 게임 크기에서 읽히나?"** — 캐릭터·아이콘을 display_px 로 줄여 실루엣·역할이 구분되는지(`STY-FORM-READABLE-SMALL`).
- **"Canvas 렌더러에서 룩이 멀쩡한가?"** — [`game-qa`](../../game-qa/SKILL.md) 로 WebGL 끄고 폴백 확인(`STY-MOOD-CANVAS-FALLBACK`).
- **"한 세계로 보이나?"** — 매체·셰이딩·광원 방향이 한 게임 한 스타일인지 눈으로(`STY-SCOPE-ONE-STYLE`).

---

## 6. stylekit 배선 요약 (engine/stylekit.js)

```js
// index.html: phaser 다음·lightingkit/screenfx 다음·game 이전
//   <script src="../../engine/stylekit.js"></script>
// game.js (Game 씬 create):
var STYLE = StyleKit.load(STYLE_SPEC);          // style.json 로드·정규화
var PAL   = StyleKit.palette(STYLE);             // PixelForge P 호환 맵 / ramp 조회
if (StyleKit.isWebGL(this)) {
  StyleKit.applyLighting(this, STYLE);           // lightingkit ambient+point_lights
  StyleKit.applyPostFX(this.cameras.main, STYLE);// screenfx bloom/vignette/grade
} else {
  StyleKit.applyCanvasFallback(this, STYLE);     // R4: 틴트 오버레이(pre-shade 는 에셋이 보유)
}
// 색 참조:  rect.setFillStyle(StyleKit.role(STYLE, 'danger'));
```
- stylekit 은 **엔진 무관 코어 + 얇은 Phaser 어댑터**. Node `require('engine/stylekit.js')` 로 `load`/`palette`/`role`/`emitMasterPalette` 결정적 테스트 가능([`game-qa`](../../game-qa/SKILL.md) 호환). `Date.now` 미사용.
- 색은 master_palette 단일 진실 — 코드에 hex 중복 금지(`STYLE-SINGLE-SOURCE`).

## 출처
- 본 스펙은 [`ability-architect`](../../ability-architect/SKILL.md)의 `consistency-tools.md`(abilities.json·lint-abilities.mjs)·[`item-architect`](../../item-architect/SKILL.md) `consistency-tools.md` 컨벤션을 비주얼 스타일 도메인으로 적응시킨 것이다(출력 계약·lintConfig 임계값·단일 진실·작성/검수 분리·visual.* 어댑터 동일). style.json 스키마 계약은 `.omc/handoffs/team-plan.md` 의 확정본을 전재.
