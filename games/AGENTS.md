<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-15 -->

# games/

## Purpose
엔진(`engine/`)과 스킬(`skills/`)을 실제로 실증하는 **데모 게임 10종**. 각 게임은 `games/<slug>/`에 `index.html` + `game.js`(일부는 추가 `.mjs`/`.tmj`)로 구성되며, 엔진 모듈을 `<script>`로 로드하는 무빌드 브라우저 게임이다. 모든 에셋은 100% 절차 생성(PixelForge/VectorForge/ChipAudio) 또는 CC0이며, 외부 CC0를 쓴 게임은 `CREDITS.txt`로 출처를 명시한다. 데모는 "이 엔진/스킬로 이런 게임이 나온다"는 레퍼런스이자 회귀 검증 대상이다.

> **두 번째 트랙 (WGF Studio 에디터 산출):** `wgf-editor` 스킬로 제작한 게임은 `games/<slug>/scene.json`(wgf-scene@1)이 단일 진실이며, export 산출물인 무빌드 `game.js`/`index.html`을 동일 디렉터리에 생성한다. 기존 손코딩 `game.js` 게임과 별도 트랙이며 역방향 변환(game.js → scene.json)은 지원하지 않는다. 현재 이 트랙의 데모는 `wgf-demo-arena/`(P5 탑다운 "절차 아레나" — `scene.json` 단일 진실 + export 산출 `game.js`/`index.html`/`CREDITS.txt`)와 `wgf-sprite-demo/`(Kenney Tiny Dungeon CC0 16x16 시트 — 비트맵 스프라이트시트 프레임 렌더 + AnimatedSprite 실프레임 재생 실증)이며, 아래 손코딩 카탈로그(10종)와 구분된다. 에디터 부트 샘플 씬은 `_editor-samples/`(예: `topdown-min/scene.json`)에 둔다.

## Subdirectories (데모 카탈로그)
| Directory | 게임 | 실증하는 것 |
|-----------|------|------------|
| `super-runner/` | SUPER RUNNER | **플래그십** 슈퍼마리오류 픽셀 플랫포머. 가변 점프·코요테·버퍼·카메라 추적·코인·물음표블록·적·파워업·HUD. `?tiled=1`로 Tiled 경로 동치 검증. `level.tmj`·`level.js` 동봉 |
| `nocturne/` | NOCTURNE | **Phaser 고급 4종 통합 데모**(WebGL) — Matter 슬링샷+상자 스택, 스플라인 등불, 점광원+절차 안개, 블룸+비네트. screenshot 2종 |
| `runeburst/` | Runeburst — 별무리 매치 | 매치3. VectorForge + 외부 CC0 룬 젬 SVG(game-icons.net, CC-BY-3.0, `CREDITS.txt`). `assets/gems/` |
| `is-rule/` | IS — 규칙을 다시 쓰는 퍼즐 | Baba Is You류 규칙 조작 퍼즐 |
| `style-preview/` | VectorForge 스무스 그래픽 프리뷰 | VectorForge 4가지 스타일 쇼케이스(`index.html` 단독, game.js 없음) |
| `cozy-crypt-demo/` | COZY CRYPT | `style-architect` 디렉터 스킬 데모 — **cozy-dungeon** 무드(따뜻한 횃불빛 던전)를 `style.json` 단일 진실로 정의하고 `engine/stylekit.js` 어댑터로 PixelForge 스프라이트·라이팅·포스트FX 를 일관 배선(WebGL 무드 + Canvas 틴트 폴백). `assets/palette.master.json` master_palette 상속. 384×224, 100% 절차 CC0. `window.CozyCrypt` 노출 |
| `sound-lab/` | SoundForge Lab | `sound-architect` 디렉터 스킬 데모(**T3 적응형**) — `engine/soundforge.js`(Tone.js v15) 쇼케이스 겸 검증 하니스. 인텐시티(수직 레이어)·섹션(수평 리시퀀싱)·SFX·믹스 HTML 패널. **Phaser 미사용**(순수 사운드 데모). `audio.json` 단일 진실·`AUDIO.md` 바이블. 100% 절차 합성 오리지널 CC0 |
| `tiled-topdown/` | GEM DUNGEON | 탑다운 Tiled 데모 — 타일 레이어 충돌의 정석. `level.tmj`·`map.mjs`. **`?stick=1`** = JoystickKit 트윈스틱 모드(좌스틱 이동·우스틱 조준/마법볼트 발사) — `virtual-joystick` 실증. 기본 경로는 디지털 D-패드 |
| `tiled-iso/` | FORGE ISO | 등각/육각 Tiled 맵(`?orient=hex`). `level-iso.tmj`·`level-hex.tmj`·`map-iso.mjs`·`map-hex.mjs` |
| `tiled-pack/` | FORGE PACK | `TilemapGPULayer`(WebGL) + 외부 CC0 팩 임포트 + `assets.json` 라이선스 게이트. `pack/`(tmj·pack.json·tileset.png) |

## For AI Agents

### Working In This Directory
- **데모는 엔진/스킬의 진실성을 증명한다 — 엔진을 바꾸면 영향받는 데모를 함께 검증·갱신**한다(특히 `super-runner` Tiled 경로, `nocturne` 고급 킷 4종, `tiled-*` 3종).
- 각 게임은 **자족적**(self-contained)이어야 한다: `index.html`에서 `../../engine/*.js`를 상대경로로 로드. 빌드/번들 도입 금지.
- 외부 CC0 에셋을 추가하면 ① `games/<slug>/CREDITS.txt`에 출처·라이선스 명시, ② 루트 `assets.json`의 `entries[]`에 등록, ③ `assets-library/library.json` 갱신(sprite-picker 경로).
- IP-safe 엄수: 캐릭터·이름·시그니처 조합이 상용 IP를 연상시키지 않게(예: super-runner 주인공은 '빨간 모자 러너', Mario 미사용).

### Testing Requirements
- 로컬 서버: `python -m http.server 8766` → `http://127.0.0.1:8766/games/<slug>/index.html`.
- 부팅 콘솔 에러 0(favicon 제외) + `game-qa` 헤드리스 step 하니스로 메카닉 결정적 검증.
- WebGL 데모(`nocturne`, `tiled-pack`)는 WebGL 컨텍스트에서 검증.

### Common Patterns
- 표준 구조: `index.html`(phaser + 필요한 엔진 킷 + game.js 로드) → `game.js`(Scene 정의). Tiled 게임은 `.tmj` + `map*.mjs`(맵 생성/저작) 동봉.
- 타이틀 → 'TAP TO START'(오디오 언락) → 게임 → HUD → 게임오버(registry 영속) 흐름이 표준.

## Dependencies

### Internal
- 모든 게임이 `engine/`(phaser·pixelforge·vectorforge·audio·mobile, 일부 tiled·*kit)에 의존.
- 라이선스: 루트 `assets.json` 게이트, `assets-library/library.json` 로컬 라이브러리.

### External
- Phaser 4.1.0 (engine 경유). 일부 게임은 CC0 SVG/팩(게이트 통과분)을 `assets/`·`pack/`에 벤더링.

<!-- MANUAL: -->
