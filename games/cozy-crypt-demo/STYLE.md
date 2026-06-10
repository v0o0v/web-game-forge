# COZY CRYPT — 비주얼 스타일 바이블

`style-architect` 디렉터 스킬의 산출 데모. **cozy-dungeon** 무드(따뜻한 횃불빛 던전)를
`style.json` 단일 진실로 정의하고, `engine/stylekit.js` 어댑터로 PixelForge 스프라이트·
라이팅·포스트FX 를 일관되게 배선한다. 100% 코드 생성(CC0 / IP-safe).

> 이 문서는 **사람용 바이블**, `style.json` 은 **기계용 단일 진실**이다. 둘이 어긋나면
> `style.json`(+ `assets/palette.master.json`)이 권위다(D6: style.json 있으면 권위).

---

## 1. 무드 한 줄

차갑고 축축한 돌 던전을, 군데군데 타오르는 횃불의 **따뜻한 주황 광원**이 감싸 "위험하지만
포근한" 탐험감을 만든다. 짙은 앰비언트 어둠 + 부드러운 비네트 + 옅은 블룸으로 빛 주변이
아늑하게 빛난다.

## 2. 매체 · 복잡도

| 항목 | 값 | 근거 |
|------|----|----|
| `medium` | `pixel` | NES풍 절차 픽셀아트(PixelForge). `render.pixelArt:true` 와 1:1(D7). |
| `tier` | 2 | 팔레트 + 폼언어 + 라이팅/포스트FX 무드까지(0=팔레트만, 3=풀 가이드). |
| `mood` | `cozy-dungeon` | 프리셋 `skills/wgf-style-architect/reference/presets/cozy-dungeon.json` 기반. |

## 3. master_palette (상류 진실)

`assets/palette.master.json` 으로도 emit — sprite-forge·item-architect·ability-architect·
game-ui-hud·juice-fx 가 **이 색을 상속**한다. 재질별 dark→light 4단 램프(hue-shift 셰이딩):

| 램프 | dark → light | 용도 |
|------|--------------|------|
| `stone` | `#2a2438 #3c3550 #574a6e #7a6b94` | 벽·바닥·구조물 |
| `wood` | `#3a2418 #5a3a22 #7a4a22 #a06a34` | 횃불대·문·상자 |
| `warm_light` | `#5a3a1a #a8631e #ffb347 #ffe6a8` | 불꽃·발광·금빛 픽업 |
| `moss` | `#23351f #395a2e #56823f #7caa55` | 이끼·식생 악센트 |
| `flesh` | `#7a4a52 #c07a6e #ffce9e #ffe6c8` | 캐릭터 피부 |

- neutrals: black `#120e1a`, white `#fff3e0` (순흑·순백 금지 — 톤 통일).
- background `#171320` (앰비언트 어둠 베이스).

## 4. role_colors (의미색)

HUD·능력·아이템·juice 파티클이 상속하는 **의미 기반 색**(재질색과 분리):

| 역할 | 색 | 쓰임 |
|------|----|----|
| `player` | `#7ad6ff` | 주인공 망토·플레이어 글로우 |
| `enemy` | `#9a52c7` | 적 식별 |
| `danger` | `#e83b2e` | 피해·함정·체력 경고 |
| `pickup` | `#ffd23f` | 코인·수집물 |
| `ui_accent` | `#ffb347` | HUD 강조·버튼 |

## 5. 폼 언어 · 라인 · 셰이딩

- `proportions`: head_to_body `1:1.2`, silhouette `chunky-rounded`, min_feature_px `2`
  (작고 둥근 청키 실루엣 — 아늑함의 핵심).
- `line`: outline `selective`(채움보다 어두운 색), weight `1px`.
- `shading`: model `cell`, light_dir `NW`, ramp_steps `3`, hue_shift `warm-light-cool-shadow`
  (하이라이트는 따뜻하게, 그림자는 차갑게 — 횃불 무드 강화).

## 6. 라이팅 · 포스트FX (WebGL) · 폴백 (Canvas)

`StyleKit.apply(scene, STYLE)` 한 줄로 배선한다.

**WebGL** (`engine/lightingkit.js`, `engine/screenfx.js`):
- `ambient`: 색 `#171320`, alpha `0.55` — 화면 전체를 어둡게(MULTIPLY).
- `point_lights`: 색 `#ffd9a0`, radius `110`, intensity `0.4` — 횃불 위치에 가산 발광.
  플레이어 글로우는 게임이 radius `70`·intensity `0.22` 로 오버라이드(영웅이 코어에 안 묻히게).
- `postfx`: bloom(threshold 0.6, amount 0.4) + vignette(radius 0.7, strength 0.45) +
  color_grade(warm 0.15).

**Canvas 폴백** (R4 — lighting/postfx 는 WebGL 전용):
- `canvas_fallback.ambient_overlay` `#171320cc` — 반투명 어둠 오버레이로 무드 근사.
- `pre_shade_sprites: true` — 스프라이트를 미리 어둡게 셰이딩(굽기 단계 플래그).

## 7. 엔진 배선 (어떻게 적용되나)

`index.html` 로드 순서: `phaser → pixelforge → screenfx → lightingkit → stylekit → game.js`.

```js
var STYLE = StyleKit.load(STYLE_SPEC);                  // style.json 단일 진실
// 굽기 전 팔레트 오버라이드 → master_palette 색으로 스프라이트:
PixelForge.bake(scene, 'cc-wall', { frames: ART.wall.frames,
  palette: StyleKit.palette(STYLE, { 'd':{ramp:'stone',step:0}, 'l':{ramp:'stone',step:3} }) });
// 씬 create() 끝 무드 배선(WebGL/Canvas 자동 분기):
StyleKit.apply(scene, STYLE, { lights: torchSpots });
```

- 스프라이트 char→색 매핑은 `game.js` 의 `STONE_MAP/HERO_MAP/TORCH_MAP/GEM_MAP` 참조.
- `StyleKit.renderConfig(STYLE)` 로 `Phaser.Game` config 의 render 블록을 채운다(D7).

## 8. IP 안전성

- 모든 그래픽은 PixelForge 문자 그리드로 코드 생성 — 외부 다운로드 0, 100% CC0.
- 특정 상용 던전/로그라이크 게임의 **에셋·이름·시그니처를 복제하지 않는다**. "따뜻한
  던전 픽셀"이라는 **스타일/무드만** 일반화해 차용.
- `lintConfig.ip_redwords` 로 금지어를 기계 검증(`tools/lint-style.mjs`).
- 라이선스 고지: 본 데모의 모든 비주얼은 CC0. 자세한 정책은 루트 `CREDITS`/`assets.json` 참조.
