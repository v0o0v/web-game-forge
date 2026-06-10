# Phaser 4 API 레퍼런스 라이브러리 — 색인 (INDEX)

> 본 플러그인(WebGameForge / `web-game-builder`)의 엔진은 **Phaser 4.1.0** (`engine/phaser.min.js`, MIT, vendored).
> 이 디렉터리는 **Phaser 공식 에이전트용 스킬 28종**([phaserjs/phaser/skills](https://github.com/phaserjs/phaser/tree/master/skills), MIT)을
> 우리 플러그인에 **온디맨드 레퍼런스**로 벤더링한 것이다. 게임 코드를 짜기 전에, 관련 문서를 골라 읽고 **정확한 Phaser 4 API**로 작성한다.

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter를 제거한 순수 레퍼런스 문서라서 스킬 listing 예산(컨텍스트 ~1%)을
  잡아먹지 않는다. **필요할 때만 Read** 한다.
- `web-game-builder`(오케스트레이터)와 전문 스킬들(sprite-forge, level-designer, juice-fx, …)은 작업을 시작할 때
  아래 **라우팅 표**에서 관련 문서를 골라 읽고, 거기 적힌 **v4 API/패턴/Gotcha**대로 코드를 작성한다.
- 새 코드는 **반드시 Phaser 4 문법**으로 쓴다. v3 관용구가 떠오르면 아래 **"v3 → v4 핵심 차이"**를 먼저 확인한다.
- 우리 엔진 라이브러리(`PixelForge`/`VectorForge`/`ChipAudio`/`MobileHarness`) API는 `../engine-api.md` 참고(버전 무관, v4에서 동작 검증됨).

## 작업 → 읽을 문서 라우팅

| 우리 스킬 / 작업 | 먼저 읽을 Phaser 4 문서 |
|---|---|
| `web-game-builder` (게임 부팅/설정) | [game-setup-and-config](./game-setup-and-config.md), [scenes](./scenes.md), [scale-and-responsive](./scale-and-responsive.md), [loading-assets](./loading-assets.md) |
| `platformer-game`, `endless-runner` | [physics-arcade](./physics-arcade.md), [sprites-and-images](./sprites-and-images.md), [animations](./animations.md), [cameras](./cameras.md), [tilemaps](./tilemaps.md), [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md) |
| `topdown-shooter` | [physics-arcade](./physics-arcade.md), [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md), [groups-and-containers](./groups-and-containers.md), [particles](./particles.md) |
| `arcade-classic` (벽돌깨기·뱀·퐁·인베이더) | [physics-arcade](./physics-arcade.md), [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md), [geometry-and-math](./geometry-and-math.md), [graphics-and-shapes](./graphics-and-shapes.md) |
| `puzzle-game` (테트리스·매치3·2048) | [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md), [time-and-timers](./time-and-timers.md), [tweens](./tweens.md), [data-manager](./data-manager.md), [groups-and-containers](./groups-and-containers.md) |
| `sprite-forge` (PixelForge 픽셀아트) | [sprites-and-images](./sprites-and-images.md), [animations](./animations.md), [loading-assets](./loading-assets.md) |
| `vector-graphics` (VectorForge 스무스/벡터) | [graphics-and-shapes](./graphics-and-shapes.md), [render-textures](./render-textures.md), [filters-and-postfx](./filters-and-postfx.md) |
| `chip-sound` (ChipAudio) | [audio-and-sound](./audio-and-sound.md) |
| `level-designer` (레벨/맵/타일맵) | [tilemaps](./tilemaps.md), [groups-and-containers](./groups-and-containers.md), [geometry-and-math](./geometry-and-math.md) |
| `game-ui-hud` (HUD/메뉴/UI) | [text-and-bitmaptext](./text-and-bitmaptext.md), [scenes](./scenes.md), [scale-and-responsive](./scale-and-responsive.md) |
| `juice-fx` (파티클/셰이크/트윈) | [particles](./particles.md), [tweens](./tweens.md), [cameras](./cameras.md), [filters-and-postfx](./filters-and-postfx.md) |
| `matter-physics` (MatterKit 강체 물리) | [physics-matter](./physics-matter.md), [game-setup-and-config](./game-setup-and-config.md) |
| `screen-fx` (ScreenFX 포스트FX 룩) | [filters-and-postfx](./filters-and-postfx.md), [cameras](./cameras.md), [v4-new-features](./v4-new-features.md) |
| `lighting-mood` (LightingKit 라이팅·분위기) | [game-object-components](./game-object-components.md), [v4-new-features](./v4-new-features.md), [filters-and-postfx](./filters-and-postfx.md) |
| `path-motion` (PathKit 경로·모션) | [curves-and-paths](./curves-and-paths.md), [tweens](./tweens.md) |
| `mobile-webview-tune` (모바일 최적화) | [scale-and-responsive](./scale-and-responsive.md), [game-setup-and-config](./game-setup-and-config.md), [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md) |
| `perf-60fps` (성능 최적화) | [game-object-components](./game-object-components.md), [groups-and-containers](./groups-and-containers.md), [particles](./particles.md), [game-setup-and-config](./game-setup-and-config.md) |
| `game-qa` (동작 검증) | [scenes](./scenes.md), [time-and-timers](./time-and-timers.md), [events-system](./events-system.md) |
| 물리를 Matter로 바꿀 때 | [physics-matter](./physics-matter.md) |
| v3 코드를 v4로 옮길 때 | [v3-to-v4-migration](./v3-to-v4-migration.md), [v4-new-features](./v4-new-features.md) |

## 전체 문서 목록 (28종 + 본 색인)

| 문서 | 이 문서를 읽어야 할 때 (트리거) |
|---|---|
| [game-setup-and-config](./game-setup-and-config.md) | new Phaser.Game, GameConfig, 렌더러, pixelArt, FPS, 부팅 |
| [scenes](./scenes.md) | Scene, 생명주기 preload/create/update, 씬 전환, SceneManager |
| [loading-assets](./loading-assets.md) | preload, this.load, 에셋 로딩, spritesheet, atlas, 진행률 |
| [sprites-and-images](./sprites-and-images.md) | Sprite, Image, add.sprite/image, texture, setTint, setAlpha |
| [animations](./animations.md) | 스프라이트 애니메이션, spritesheet, play, 프레임 |
| [physics-arcade](./physics-arcade.md) | physics, arcade, velocity, gravity, collide, overlap, body |
| [physics-matter](./physics-matter.md) | Matter, constraint, joint, rigid body, sensor |
| [input-keyboard-mouse-touch](./input-keyboard-mouse-touch.md) | keyboard, mouse, touch, pointer, drag, click, gamepad, cursor keys |
| [groups-and-containers](./groups-and-containers.md) | Group, Container, 오브젝트 풀, getFirstDead, children |
| [tweens](./tweens.md) | tween, ease, tweens.add, chain, stagger |
| [particles](./particles.md) | particles, emitter, 폭발/불/연기 이펙트 |
| [cameras](./cameras.md) | camera, viewport, scroll, zoom, follow, shake, fade |
| [tilemaps](./tilemaps.md) | Tilemap, Tiled, layer, 타일 충돌/속성 |
| [text-and-bitmaptext](./text-and-bitmaptext.md) | Text, BitmapText, add.text, font, word wrap, style |
| [audio-and-sound](./audio-and-sound.md) | sound, audio, music, volume, mute |
| [graphics-and-shapes](./graphics-and-shapes.md) | Graphics, 도형 그리기, fillRect, lineStyle, polygon, arc, generateTexture |
| [render-textures](./render-textures.md) | RenderTexture, DynamicTexture, snapshot, draw to texture, stamp |
| [filters-and-postfx](./filters-and-postfx.md) | filter, 포스트프로세싱, shader, bloom, blur, glow, color effects (v4 신규 Filter 체계) |
| [game-object-components](./game-object-components.md) | component/mixin, transform, mask, bounds, lighting |
| [geometry-and-math](./geometry-and-math.md) | Vector2, Rectangle, Circle, 거리/각도/랜덤/lerp |
| [time-and-timers](./time-and-timers.md) | timer, delay, delayedCall, TimerEvent, Clock |
| [events-system](./events-system.md) | events, on, emit, EventEmitter, scene events |
| [data-manager](./data-manager.md) | setData, getData, data events, registry |
| [cameras](./cameras.md) | (위 참조) |
| [scale-and-responsive](./scale-and-responsive.md) | ScaleManager, 반응형, resize, fullscreen, FIT, scale mode |
| [curves-and-paths](./curves-and-paths.md) | curve, path, spline, bezier, path follower |
| [actions-and-utilities](./actions-and-utilities.md) | align, 그리드 배치, Actions, 그룹 일괄 연산 |
| [v3-to-v4-migration](./v3-to-v4-migration.md) | migrate, upgrade, breaking changes, v3→v4 |
| [v4-new-features](./v4-new-features.md) | v4 신규: RenderNode, SpriteGPULayer, CaptureFrame, Gradient/Noise 게임오브젝트, 신규 tint mode |

---

## v3 → v4 핵심 차이 (코드 작성 전 필독 치트시트)

우리 엔진은 **Phaser 4.1.0**이다. 학습 데이터에 v3 관용구가 많으니, 아래는 **실제로 코드를 깨뜨리는** 변경만 추렸다.
전체 목록은 [v3-to-v4-migration.md](./v3-to-v4-migration.md) 참고.

| 영역 | v3 (쓰지 말 것) | v4 (이렇게 쓴다) |
|---|---|---|
| **그룹 순회** | `group.children.iterate(fn)` | `group.getChildren().forEach(fn)` — v4의 `children`은 **네이티브 `Set`**이라 `.iterate()`가 없다. 순회 중 `destroy()`가 있으면 `getChildren().slice().forEach(fn)`. |
| 자료구조 | `Phaser.Struct.Set`, `Phaser.Struct.Map` | 네이티브 `Set` / `Map` (`forEach/has/add/delete`). `iterateLocal`/`contains`/`setAll` 없음. |
| Tint 채움 | `sprite.setTintFill(0xRRGGBB)` | `sprite.setTint(0xRRGGBB).setTintMode(Phaser.TintModes.FILL)` |
| 픽셀 정렬 | `roundPixels` 기본 `true` 가정 | v4 기본 **`false`**. 픽셀아트면 config에 `pixelArt:true`(또는 `roundPixels:true`) **명시**. |
| 부드러운 픽셀 | (없음) | v4 신규 `smoothPixelArt:true` (WebGL 전용). |
| 스케일 모드 | — | v4 신규 `Phaser.Scale.EXPAND`(6). `FIT`/`CENTER_BOTH`는 그대로. |
| 기하 점 | `new Phaser.Geom.Point(x,y)` / `instanceof Geom.Point` | `new Phaser.Math.Vector2(x,y)`. 모든 Geom 헬퍼가 `Vector2` 반환. |
| 수학 상수 | `Math.TAU`(=PI/2), `Math.PI2` | `Math.TAU`는 이제 **PI*2**. v3의 PI/2는 `Math.PI_OVER_2`. `PI2`는 제거→`TAU`. |
| FX / 마스크 | `sprite.preFX/postFX`, `BitmapMask`, `setPipeline('Light2D')` | **Filter 체계**: `sprite.filters.internal/external.*`, 마스크는 `Mask` filter, 라이팅은 `sprite.setLighting(true)`. → [filters-and-postfx.md](./filters-and-postfx.md) |
| RenderTexture | draw 후 즉시 반영 | `DynamicTexture`/`RenderTexture`는 draw 후 **`.render()` 호출 필수**(커맨드 버퍼). → [render-textures.md](./render-textures.md) |
| DPR/해상도 | `config.resolution: Math.min(dpr,2)` | v4에 `resolution` config **없음**. ScaleManager가 DPR 처리. 과도하면 `scale.zoom`/`scale.max`로 캡. |
| 렌더러 | Canvas 폴백 가정 | Canvas는 **deprecated**(고급 WebGL 기능 미지원). `type: Phaser.AUTO`(WebGL 우선) 권장. |
| 제거된 GO | `Mesh`, `Plane` | 제거됨(향후 3D 별도). `Create.GenerateTexture`/`TextureManager.generate`도 제거. |

### v4에서 **그대로 동작**하는 것 (우리 엔진/데모 실측 검증)

아래는 v4에서 멀쩡히 동작하므로 "고장났다"고 오해하지 말 것 — `super-runner`(PixelForge)와 `style-preview`(VectorForge)에서 콘솔 에러 0으로 확인:

- `scene.textures.addCanvas(key, canvas)` + `texture.add(name, srcIdx, x, y, w, h)` — **PixelForge/VectorForge의 텍스처 굽기 기반.**
- `new Phaser.Class({ Extends: Phaser.Scene, ... })` — 레거시 클래스 헬퍼 유지(우리 모든 씬이 사용).
- `graphics.generateTexture(key, w, h)` — Graphics → 텍스처(예: 'spark').
- `this.add.particles(x, y, key, config)` + `emitter.explode()` — 파티클(3.60+/v4 동일 API).
- `this.input.addPointer(n)`, `this.input.manager.pointers` — 멀티터치.
- `Phaser.Scale.FIT` / `Phaser.Scale.CENTER_BOTH`, `setTint`, `cameras.main.shake/fadeIn/fadeOut`.

> 출처/라이선스: 각 문서 본문은 Phaser 공식 skills(MIT)의 벤더링본이다. 헤더·본 색인·치트시트는 WebGameForge가 한글로 작성·정리했다.
