# 무드·포스트FX — 분위기를 입히는 마지막 층 (`STY-MOOD-*`)

> 팔레트·폼·셰이딩 위에 *분위기*를 더하는 최상위 층 — 동적 라이팅(어둠 속 광원·안개)과 화면 포스트FX(블룸·비네트·
> 컬러 그레이딩). 여기서 style.json `lighting`/`postfx` 를 [lighting-mood](../../wgf-lighting-mood/SKILL.md)([`engine/lightingkit.js`](../../../engine/lightingkit.js))·
> [screen-fx](../../wgf-screen-fx/SKILL.md)([`engine/screenfx.js`](../../../engine/screenfx.js)) 프리셋으로 매핑하고, **R4 Canvas-safe 폴백**을 명시한다.
> 인터뷰 S6. **T3 전용** — 무드가 게임 정체성일 때만(던전·밤·호러). 디폴트는 무드 없음.

---

## `STY-MOOD-MOOD-FROM-PALETTE` — 무드는 팔레트를 따른다 (북극성)
무드는 *새 색을 칠하는 게 아니라* 이미 정한 팔레트(`master_palette`)를 *강조*하는 것이다. 앰비언트 어둠색은 `background` 에서, 광원색은 따뜻한 램프(`warm_light`)에서, 그레이딩 방향은 온도 대비(`STY-PAL-WARM-COOL-CONTRAST`)에서 온다. 무드를 위해 팔레트를 배신하면(차가운 게임에 갑자기 따뜻한 블룸) 응집이 깨진다.

## `STY-MOOD-LIGHTING-PRESET` — 라이팅 매핑 (style.json.lighting → lightingkit)
`style.json.lighting` 블록이 [`engine/lightingkit.js`](../../../engine/lightingkit.js) 호출로 변환된다([`stylekit.js`](../../../engine/stylekit.js) `StyleKit.applyLighting` 이 배선):

| style.json.lighting | LightingKit 호출 | 무엇 |
|---|---|---|
| `ambient: { color, alpha }` | `LightingKit.ambient(scene, x,y,w,h, color, alpha)` | 화면 전체 어둡게(앰비언트 어둠 사각형) |
| `point_lights: { color, radius, intensity }` | `LightingKit.light(scene, x,y, {color,radius,intensity})` · `LightingKit.attach(scene, target, {...})` | 횃불·광구(스프라이트 추적 가능) |
| `fog: { enabled, ... }` | `LightingKit.fog(scene, x,y,w,h, {...})` | Simplex Noise 안개(`STY-MOOD-FOG-DEPTH`) |

> lightingkit 의 PointLight 는 **WebGL 전용**(`scene.add.pointlight`) — `LightingKit` 내부가 `Phaser.WEBGL` 렌더러를 확인하고, 아니면 조용히 no-op. 그래서 `STY-MOOD-CANVAS-FALLBACK` 가 필수.

## `STY-MOOD-POSTFX-PRESET` — 포스트FX 매핑 (style.json.postfx → screenfx)
`style.json.postfx` 블록이 [`engine/screenfx.js`](../../../engine/screenfx.js) 호출로 변환된다(`StyleKit.applyPostFX` 배선):

| style.json.postfx | ScreenFX 호출 | 무엇 |
|---|---|---|
| `preset: "night"\|"warm-dungeon"\|...` | `ScreenFX.preset(camera, name)` | 무드 한 방(그레이딩+블룸+비네트 묶음) |
| `bloom: { threshold, amount }` | `ScreenFX.bloom(camera, {threshold, amount})` | 빛 번짐(네온·광원 강조) |
| `vignette: { radius, strength }` | `ScreenFX.vignette(camera, {radius, strength})` | 가장자리 어둡게(집중·극적) |
| `color_grade: { warm, ... }` | `ScreenFX.colorGrade(camera, fn\|preset)` | 색조 보정(따뜻/차갑게·night) |

> screenfx 의 모든 효과는 **WebGL 전용**(`addParallelFilters`·`addColorMatrix`) — 내부가 `Phaser.WEBGL` 을 확인하고 Canvas 면 no-op. 내장 preset: `night`·`dungeon`·`crt`·`dream` 등(screenfx.js 참고). style.json `postfx.preset` 값은 이 이름과 맞추거나 개별 bloom/vignette/grade 로 조립.

## `STY-MOOD-CANVAS-FALLBACK` — R4: Canvas-safe 폴백 (★필수)
**lightingkit PointLight 와 screenfx 포스트FX 는 둘 다 WebGL 렌더러 전용이다.** Phaser 가 Canvas 폴백 렌더러로 돌면(구형 기기·일부 인앱 브라우저·WebGL 컨텍스트 손실) 이 효과들이 *조용히 사라진다*. 무드에만 의존한 게임은 Canvas 에서 룩이 통째로 무너진다 — 이건 핵심 리스크(R4)다.

대책 — style.json `canvas_fallback` 블록이 WebGL 불가 시의 룩 유지 전략을 명시하고, `StyleKit.applyCanvasFallback` 이 배선:
```jsonc
"canvas_fallback": {
  "ambient_overlay": "#171320cc",   // 반투명 틴트 사각형(WebGL ambient 대체 — Canvas 에서도 그려짐)
  "pre_shade_sprites": true          // 스프라이트에 셰이딩을 미리 구워둠(STY-SHADE-PRE-SHADE)
}
```
- **`ambient_overlay`:** WebGL 앰비언트 라이팅 대신 *반투명 단색 사각형*(`scene.add.rectangle`, 알파 포함 8자리 hex)을 덮어 어둠 무드의 바닥을 Canvas 에서도 만든다. 광원의 '구멍'은 못 내지만 톤은 유지.
- **`pre_shade_sprites`:** 동적 라이팅이 입체의 *유일한* 소스가 아니게 스프라이트에 명암을 미리 굽는다(`STY-SHADE-PRE-SHADE`). 라이팅은 덤.
- **원칙:** *동적 라이팅·포스트FX 는 향상(enhancement), 폴백 룩이 기준(baseline).* WebGL 이면 더 멋지고, Canvas 면 여전히 멀쩡하게.

> 검증: [`game-qa`](../../wgf-game-qa/SKILL.md) 로 Canvas 렌더러 강제 후 룩이 깨지지 않는지 확인. lint-style.mjs 는 `lighting`/`postfx` 가 있는데 `canvas_fallback` 이 비면 warn.

## `STY-MOOD-FX-RESTRAINT` — 과FX 금지 (가독성 우선)
포스트FX 는 *분위기*를 위한 것이지 화면을 가리는 게 아니다(`STY-SCOPE-MOOD-INTENSITY`):
- **블룸:** threshold 너무 낮으면 HUD·텍스트가 번진다. 광원·네온만 번지게 threshold 0.5~0.7.
- **비네트:** strength 너무 높으면 가장자리 적·함정이 안 보인다. 0.3~0.5.
- **안개·어둠:** 게임플레이 요소를 가리면 공정성 위반(`STY-PAL-CONTRAST-ACCESS`). 가독을 먼저 본다.
- 적은 게 많다 — 효과 1~2개로 무드의 80%.

## `STY-MOOD-FOG-DEPTH` — 안개·뎁스로 공간감
`LightingKit.fog`(Simplex Noise) 로 던전·밤에 떠다니는 안개를 더해 깊이를 만든다. depth(레이어 순서)로 안개를 캐릭터 앞/뒤에 배치해 공간감. 알파 낮게(0.1~0.2) 시작 — 짙으면 가독을 먹는다. 정적 게임엔 과할 수 있으니 분위기가 핵심일 때만.

## `STY-MOOD-GRADE-WARM-COOL` — 컬러 그레이딩 온도
`ScreenFX.colorGrade` 로 화면 전체 온도를 민다 — 따뜻하게(아늑한 던전·석양), 차갑게(밤·얼음·공포), night(어둡고 푸르게). 팔레트의 온도 대비를 *증폭*하되(`STY-MOOD-MOOD-FROM-PALETTE`) 역할색 가독은 지킨다. 그레이딩이 위험 빨강을 죽이면 안 된다.

## `STY-MOOD-BLOOM-THRESHOLD` — 블룸 임계값으로 무엇이 빛나나
블룸 `threshold` 가 "얼마나 밝아야 번지나"를 정한다. 높으면(0.7) 광원·궁극기·네온만 번져 강조 효과, 낮으면(0.3) 화면 전반이 몽환적(dream 톤). 무엇을 빛나게 할지로 threshold 를 정한다 — 보통 광원·픽업·이펙트만 빛나게 0.5~0.7.

## `STY-MOOD-NIGHT-HORROR-RECIPE` — 무드 레시피 (따뜻한 던전 / 밤 / 호러)
검증된 무드 레시피(style.json 블록 → 룩):

**따뜻한 던전(warm-dungeon, cozy):**
```jsonc
"lighting": { "ambient": {"color":"#171320","alpha":0.5}, "point_lights": {"color":"#ffd9a0","radius":110,"intensity":0.9} },
"postfx": { "bloom": {"threshold":0.6,"amount":0.4}, "vignette": {"radius":0.7,"strength":0.4}, "color_grade": {"warm":0.15} },
"canvas_fallback": { "ambient_overlay": "#171320cc", "pre_shade_sprites": true }
```
어둠 속 따뜻한 횃불, 부드러운 블룸, 약한 온기 그레이딩. 아늑하면서 긴장.

**밤(night):**
```jsonc
"lighting": { "ambient": {"color":"#0a0e1e","alpha":0.55}, "point_lights": {"color":"#88e8ff","radius":90,"intensity":0.8} },
"postfx": { "preset": "night" },
"canvas_fallback": { "ambient_overlay": "#0a0e1ecc", "pre_shade_sprites": true }
```
푸른 어둠, 차가운 달빛 광원, screenfx `night` preset(어둡고 푸른 그레이딩+블룸+비네트).

**호러(horror, 강):**
```jsonc
"lighting": { "ambient": {"color":"#0c0a12","alpha":0.7}, "point_lights": {"color":"#c44","radius":70,"intensity":0.7}, "fog": {"enabled":true} },
"postfx": { "bloom": {"threshold":0.5,"amount":0.3}, "vignette": {"radius":0.55,"strength":0.6}, "color_grade": {"desaturate":0.3} },
"canvas_fallback": { "ambient_overlay": "#0c0a12dd", "pre_shade_sprites": true }
```
짙은 어둠·좁은 광원·붉은 기·강한 비네트·안개·탈채도. **단 가독 한계 — 적·함정은 보여야 공정**(`STY-MOOD-FX-RESTRAINT`).

> 모든 레시피는 *오리지널 톤*이다. 상용 게임의 시그니처 룩을 복제하지 않고 무드 관습만 차용(`STY-SCOPE` IP 안전).

---

## 안티패턴
- **Canvas 폴백 누락:** WebGL 효과만 믿어 Canvas 에서 룩 붕괴(`STY-MOOD-CANVAS-FALLBACK` 위반 — R4).
- **과FX:** 블룸/비네트/안개가 게임플레이 가림(`STY-MOOD-FX-RESTRAINT` 위반).
- **무드가 팔레트 배신:** 게임 톤과 따로 노는 그레이딩(`STY-MOOD-MOOD-FROM-PALETTE` 위반).
- **무드 과설계:** 단순 게임에 라이팅+포스트FX 풀세트(T3 불필요).
- **광원 정합 무시:** 씬 라이팅과 스프라이트 셰이딩 광원 방향 모순(`STY-SHADE-LUDO-LIGHT-MATCH`).

## 출처
- 동적 라이팅·포스트FX·무드 그레이딩(2D 분위기 연출 통념)을 작은 웹게임용으로 정리. 매핑 표는 실제 [`engine/lightingkit.js`](../../../engine/lightingkit.js)(`ambient`/`light`/`attach`/`fog`, WebGL 게이트)·[`engine/screenfx.js`](../../../engine/screenfx.js)(`preset`/`bloom`/`vignette`/`colorGrade`, WebGL 게이트) API 와 1:1. Canvas 폴백 전략은 두 모듈의 `Phaser.WEBGL` 렌더러 분기에 기반(R4).
